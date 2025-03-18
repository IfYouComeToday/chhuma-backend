// pages/api/personalize.js

import clientPromise from "../../lib/mongodb";
import OpenAI from "openai";
import fetch from "node-fetch"; // Only needed if you're using node-fetch for ReverseContact

export default async function handler(req, res) {
  //
  // -- [1] Always set CORS headers for every request (including POST) --
  //
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  //
  // -- [2] Handle the preflight (OPTIONS) request --
  //
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  //
  // -- [3] Enforce POST for the main logic --
  //
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed. Use POST." });
  }

  // Expect a JSON body with either an "email" or "linkedInUrl" field.
  const { email, linkedInUrl } = req.body;
  if (!email && !linkedInUrl) {
    return res
      .status(400)
      .json({ error: "Missing required field: email or linkedInUrl" });
  }

  // Decide which field we use to find data in MongoDB
  const queryField = email ? { email } : { linkedInUrl };

  try {
    // 1. Connect to MongoDB
    const client = await clientPromise;
    const db = client.db("myDB"); // Replace with your DB name if needed

    // Collections for ReverseContact data & ChatGPT outputs
    const reverseContacts = db.collection("reverseContacts");
    const chatOutputs = db.collection("chatOutputs");

    // 2. Check if there's already a cached AI output
    const cachedOutput = await chatOutputs.findOne(queryField);
    if (cachedOutput) {
      console.log(
        `Returning cached AI output for ${
          email ? "email" : "LinkedIn URL"
        }: ${email || linkedInUrl}`
      );
      return res.status(200).json({
        opener: cachedOutput.opener,
        iceBreaker: cachedOutput.iceBreaker,
        frictionPoints: cachedOutput.frictionPoints,
        solution: cachedOutput.solution,
        close: cachedOutput.close,
      });
    }

    // 3. Retrieve ReverseContact data
    let record = await reverseContacts.findOne(queryField);
    if (!record) {
      // Not in DB -> call ReverseContact
      let lookupUrl = "";
      if (email) {
        const encodedEmail = encodeURIComponent(email);
        lookupUrl = `https://api.reversecontact.com/enrichment?apikey=${process.env.REVERSECONTACT_API_KEY}&email=${encodedEmail}`;
      } else {
        const encodedUrl = encodeURIComponent(linkedInUrl);
        lookupUrl = `https://api.reversecontact.com/enrichment/profile?apikey=${process.env.REVERSECONTACT_API_KEY}&linkedInUrl=${encodedUrl}`;
      }
      console.log("Calling ReverseContact API:", lookupUrl);

      const reverseResponse = await fetch(lookupUrl, { method: "GET" });
      const reverseData = await reverseResponse.json();

      if (!reverseData.success) {
        return res.status(404).json({
          error: `No ReverseContact data found for that ${
            email ? "email" : "LinkedIn URL"
          }`,
        });
      }

      // Store in DB
      const newRecord = {
        ...(email ? { email } : { linkedInUrl }),
        data: reverseData,
        createdAt: new Date(),
      };
      await reverseContacts.insertOne(newRecord);
      record = newRecord;
    }

    // 4. Extract fields from ReverseContact
    const person = record.data.person || {};
    const companyData = record.data.company || {};
    const workflowPainPoints = record.data.workflow_pain_points || [];

    const name = person.firstName || "there";
    const title = person.headline || "Professional";
    const company = companyData.name || "your company";
    const industry = companyData.industry || "your industry";

    // 5. The system prompt (the big instructions)
    const systemPrompt = `Chhuma Website Pitch – Detailed Documentation
[... your big instructions as before ...]
Below is the final documentation of our process. In addition to all the details already covered, please note that the output must be sectioned/parsed into keys as follows:
opener
iceBreaker
frictionPoints
solution
close
Each key should contain the corresponding section text exactly as developed (length and composition remain unchanged).`;

    // 6. The user prompt
    const userPrompt = `Visitor Data:
Name: ${name}
Title: ${title}
Company: ${company}
Industry: ${industry}
Workflow Pain Points: ${workflowPainPoints.join(", ")}

Using the guidelines above, generate a personalized marketing pitch with the five sections:
[Opener], [Ice-Breaker], [Friction Points], [Solution], and [Close].

IMPORTANT: At the end, output valid JSON with exactly these keys:
opener, iceBreaker, frictionPoints, solution, close.
Do not include any extra text outside the JSON.`;

    // 7. Instantiate OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // 8. Call the OpenAI Chat Completions API
    const openaiResponse = await openai.responses.create({
      model: "gpt-4o",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 1,
      max_output_tokens: 2048,
      top_p: 1,
      stream: false,
      store: true,
    });

    console.log("OpenAI response:", openaiResponse);

    const rawAiMessage =
      openaiResponse.output_text ||
      (openaiResponse.choices && openaiResponse.choices[0]?.message?.content) ||
      "No content generated";

    // 9. Attempt to parse the AI response as JSON
    let parsed;
    try {
      // We'll look for a curly-brace block
      const jsonMatch = rawAiMessage.match(/{[\s\S]*}/);
      if (!jsonMatch) {
        throw new Error("No JSON object found in AI response");
      }
      parsed = JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.error("JSON parse error. Full text was:", rawAiMessage);
      return res.status(500).json({ error: "Failed to parse AI JSON." });
    }

    // 10. Destructure
    const { opener, iceBreaker, frictionPoints, solution, close } = parsed;

    // 11. Store in chatOutputs
    await chatOutputs.insertOne({
      ...queryField,
      opener,
      iceBreaker,
      frictionPoints,
      solution,
      close,
      createdAt: new Date(),
    });
    console.log(`AI output stored in DB for ${email || linkedInUrl}.`);

    // 12. Return the final JSON to the client
    return res.status(200).json({
      opener,
      iceBreaker,
      frictionPoints,
      solution,
      close,
    });
  } catch (error) {
    console.error("Error in /api/personalize:", error);
    return res
      .status(500)
      .json({ error: error.message || "Failed to generate content" });
  }
}
