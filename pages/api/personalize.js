// pages/api/personalize.js

import NextCors from "nextjs-cors";
import clientPromise from "../../lib/mongodb";
import OpenAI from "openai";
import fetch from "node-fetch"; // Only needed if you're using node-fetch for ReverseContact

// ----- Helper Function -----
// This function extracts the JSON block from the AI's response.
// It looks for a code block that starts with ```json and ends with ```.
// If it doesn't find one, it throws an error.
function extractJsonBlock(aiMessage) {
  const match = aiMessage.match(/```json\s*([\s\S]*?)```/);
  if (!match) {
    throw new Error("Failed to find fenced JSON in the AI response.");
  }
  return match[1].trim();
}

export default async function handler(req, res) {
  // --- [A] Enable CORS using nextjs-cors middleware ---
  await NextCors(req, res, {
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    origin: "*", // For development. In production, replace "*" with your allowed origin(s)
    optionsSuccessStatus: 200,
  });

  // --- [B] Handle OPTIONS requests explicitly ---
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // --- [C] Enforce POST for the main logic ---
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

  // Decide which field to use for MongoDB lookup
  const queryField = email ? { email } : { linkedInUrl };

  try {
    // 1. Connect to MongoDB
    const client = await clientPromise;
    const db = client.db("myDB"); // Replace with your DB name if needed

    // Collections for ReverseContact data and ChatGPT outputs
    const reverseContacts = db.collection("reverseContacts");
    const chatOutputs = db.collection("chatOutputs");

    // 2. Check for a cached AI output
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
      // No record found; call ReverseContact API
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

      // Store the new ReverseContact data in DB
      const newRecord = {
        ...(email ? { email } : { linkedInUrl }),
        data: reverseData,
        createdAt: new Date(),
      };
      await reverseContacts.insertOne(newRecord);
      record = newRecord;
    }

    // 4. Extract fields from ReverseContact data
    const person = record.data.person || {};
    const companyData = record.data.company || {};
    const workflowPainPoints = record.data.workflow_pain_points || [];

    const name = person.firstName || "there";
    const title = person.headline || "Professional";
    const company = companyData.name || "your company";
    const industry = companyData.industry || "your industry";

    // 5. Construct the OpenAI prompts using your new prompt code.
    const systemPrompt = `Chhuma Website Pitch – Detailed Documentation
1. Overarching Context of Chhuma
Vision:
Chhuma is designed to redefine what “responsive” means in B2B content. Rather than simply adapting to the device, Chhuma adapts content to the viewer’s identity and context. It’s about making business communication as personalized and engaging as consumer experiences.

Purpose of Generation:
The aim is to showcase how Chhuma works by transforming existing marketing assets into a personalized sales pitch for each user. This proof-of-concept demonstrates that Chhuma can repurpose verified content (without generating new, “hallucinated” data) while preserving the brand’s voice.

2. Voicing and Tonality
Voice Characteristics:
Conversational & Authentic:
The voice should feel genuine, as if speaking directly to the viewer without pretense.
Edgy & Bold:
A touch of irreverence—akin to Deadpool—keeps it memorable and challenges the status quo.
Witty & Clever:
Use subtle wordplay, dry humor, and a hint of sarcasm without overdoing it.
Tonality:
Direct & Punchy:
Sentences are short and impactful.
Confident & Assured:
The tone conveys authority while remaining humble and grounded.
Sardonic & Provocative:
A light, self-aware sarcasm is acceptable, especially when breaking the fourth wall.
Delivery Guidelines:
Economical with Words:
Keep each section concise—ideally, each benefit or idea is expressed in no more than two sentences.
Vivid Imagery & Metaphors:
Use evocative language when needed, but maintain brevity.
Rhythmic & Punctuated:
Vary sentence lengths for emphasis without sacrificing clarity.
3. Sections and Their Purpose
We broke down the pitch into five key sections. Each section has a defined role:

[Opener] – Big Idea:
Introduce the core proposition. This section should address the user by first name and establish why the concept matters.
Example (from Amandeep pitch):
“Amandeep, you know that at Automattic every interaction is tailored—from distributed teams to the way you supercharge recruitment. Yet, too many B2B pitches still feel generic. What if your marketing content could adapt as dynamically as your recruiting strategies?”

[Ice-Breaker]:
Break the fourth wall intelligently. This section should challenge expectations, acknowledge the viewer’s familiarity with personalized apps, and hint at the demo’s irreverent spirit—without overpraising or fluff.
Example:
“Before you roll your eyes thinking, ‘Another sales pitch,’ let’s get real. You’re used to apps that intuit your every need, but business content still serves the same tired message to everyone. And while you’re reading this, know that a dash of irreverence has been coded into this demo—just enough to challenge the status quo without taking itself too seriously.”

[Friction Points]:
Identify the core problem with current B2B content—namely, its generic, one-size-fits-all approach.
Example:
“Every day, companies deliver the same generic message to CEOs, marketers, and engineers alike—like handing every Netflix viewer the same movie and expecting a standing ovation. When prospects feel overlooked, they naturally search for a solution that speaks directly to their unique needs.”

[Solution]:
Describe how Chhuma transforms existing materials into personalized content. This is the most detailed section and should include use cases relevant to the viewer’s workflow. Emphasize that Chhuma repurposes rather than generates new content, preserving authenticity.
Example (compact version):
“Imagine if your existing materials—your whitepapers, pitch decks, and case studies—were automatically reassembled to speak directly to each prospect. With just a work email and a few cues from your profile, Chhuma transforms your content into a personalized experience.
Use Cases:
- Recruitment Campaigns: Tailor outreach pages so that each candidate sees benefits specific to their role.
- Client Pitches: Rearrange presentations to emphasize value points that resonate with every potential partner.
- Internal Communications: Customize updates for different regional teams, making global messaging more relevant.
Chhuma doesn’t generate new content—it intelligently repurposes what you already have, preserving your authentic voice while amplifying its impact.”

[Close]:
End with a gentle, conversational call to action that invites further discussion rather than demanding immediate clicks.
Example:
“This isn’t about selling a miracle—it’s about exploring a smarter way to connect. If you’re curious about transforming static B2B content into a dynamic, personalized experience that truly speaks to each individual, let’s have a conversation. No flashy buttons or over-the-top promises—just an honest chat about making business content as engaging as the world around us.”

Below is the final documentation of our process. In addition to all the details already covered, please note that the output must be sectioned/parsed into keys as follows:
opener
iceBreaker
frictionPoints
solution
close
Each key should contain the corresponding section text exactly as developed (length and composition remain unchanged).`;

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

    // 7. Instantiate the OpenAI client using the API key from your environment variable.
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // 8. Call the OpenAI Chat Completions API.
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

    // 9. Attempt to parse the AI response as JSON using a regular expression.
    let parsed;
    try {
      const jsonMatch = rawAiMessage.match(/{[\s\S]*}/);
      if (!jsonMatch) {
        throw new Error("No JSON object found in AI response");
      }
      parsed = JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.error("JSON parse error. Full text was:", rawAiMessage);
      return res.status(500).json({ error: "Failed to parse AI JSON." });
    }

    // 10. Destructure the parsed JSON.
    const { opener, iceBreaker, frictionPoints, solution, close } = parsed;

    // 11. Store the generated output in the chatOutputs collection.
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

    // 12. Return the generated sections to the client.
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
