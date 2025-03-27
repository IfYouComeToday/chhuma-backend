// pages/api/personalize.js

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
  // ----- Debug Log for Step 1 -----
  console.log("API endpoint reached, method:", req.method);

  // ----- [A] Set up CORS headers dynamically -----
  const allowedOrigins = [
    "https://peaceful-one-060007.framer.app", // Your Framer site URL
    "https://studio.framer.com",
    "http://localhost:3000" // For development
  ];
  const requestOrigin = req.headers.origin || "*";
  const originToSet = allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : "*";

  res.setHeader("Access-Control-Allow-Origin", originToSet);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Vary", "Origin");

  // ----- [B] Handle the preflight (OPTIONS) request -----
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // ----- [C] Enforce POST for the main logic -----
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed. Use POST." });
  }

  // Expect a JSON body with either an "email" or "linkedInUrl" field.
  const { email, linkedInUrl } = req.body;
  if (!email && !linkedInUrl) {
    return res.status(400).json({ error: "Missing required field: email or linkedInUrl" });
  }

  const queryField = email ? { email } : { linkedInUrl };

  try {
    // 1. Connect to MongoDB.
    const client = await clientPromise;
    const db = client.db("myDB"); // Replace with your actual DB name if needed

    // Collections for ReverseContact data & ChatGPT outputs.
    const reverseContacts = db.collection("reverseContacts");
    const chatOutputs = db.collection("chatOutputs");

    // 2. Check if there's already a cached AI output.
    const cachedOutput = await chatOutputs.findOne(queryField);
    if (cachedOutput) {
      console.log(`Returning cached AI output for ${email ? "email" : "LinkedIn URL"}: ${email || linkedInUrl}`);
      return res.status(200).json({
        opener: cachedOutput.opener,
        iceBreaker: cachedOutput.iceBreaker,
        frictionPoints: cachedOutput.frictionPoints,
        solution: cachedOutput.solution,
        close: cachedOutput.close,
      });
    }

    // 3. Retrieve ReverseContact data.
    let record = await reverseContacts.findOne(queryField);
    if (!record) {
      // Not in DB → call ReverseContact API.
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
          error: `No ReverseContact data found for that ${email ? "email" : "LinkedIn URL"}`,
        });
      }

      // Store the new ReverseContact data in DB.
      const newRecord = {
        ...(email ? { email } : { linkedInUrl }),
        data: reverseData,
        createdAt: new Date(),
      };
      await reverseContacts.insertOne(newRecord);
      record = newRecord;
    }

    // 4. Extract relevant fields from ReverseContact.
    const person = record.data.person || {};
    const companyData = record.data.company || {};
    const workflowPainPoints = record.data.workflow_pain_points || [];

    const name = person.firstName || "there";
    const title = person.headline || "Professional";
    const company = companyData.name || "your company";
    const industry = companyData.industry || "your industry";

    // 5. Construct the OpenAI prompts using your new prompt code.
    const systemPrompt = `Chhuma Website Pitch – Detailed Documentation

1. What is Chhuma: Essential Context and Purpose
Chhuma is a revolutionary communication technology that transforms how businesses communicate with their audiences. At its core, Chhuma uses AI to make business content contextually responsive to the recipient's identity, professional background, company, and needs—moving beyond the traditional definition of "responsive" (which only adapts to devices).

Key Capabilities of Chhuma:
- Reordering and emphasizing different aspects of content based on recipient profile
- Adjusting terminology and examples to match the recipient's industry
- Adapting tone and style to align with the recipient's organizational culture
- Highlighting features and benefits most relevant to the recipient's role
- Maintaining the authentic voice of the organization while personalizing delivery

Chhuma is not:
- A content generator that creates new material from scratch
- A simple mail merge or name insertion tool
- A system that compromises content integrity for personalization

The purpose of this personalized demo is to showcase Chhuma's capabilities by creating a tailored pitch that demonstrates the value of personalized communication for the specific visitor. The personalization should feel intelligent and respectful, not invasive.

2. Voicing and Tonality
Voice Characteristics:
- Conversational & Authentic: Speak directly to the viewer without pretense, as if you're having a thoughtful business conversation.
- Thoughtful & Intelligent: Show nuanced understanding of business communication challenges and opportunities.
- Subtly Confident: Convey authority while remaining humble and service-oriented.

Tonality:
- Direct & Concise: Use short, impactful sentences that deliver value efficiently.
- Balanced & Measured: Personalize meaningfully without overwhelming the reader with too many personal details.
- Warm & Professional: Maintain professionalism with a human touch that acknowledges the person behind the role.

Delivery Guidelines:
- Economical with Words: Keep each section concise and focused. No unnecessary elaboration.
- Selective Personalization: Choose 2-3 most relevant personal details per section that meaningfully connect to Chhuma's value.
- Natural Integration: Weave personal elements in naturally, as a thoughtful colleague would reference your experience in conversation.

3. Personalization Strategy: The Art of Meaningful Personalization
Guidelines for Effective Personalization:
- Select only details that directly connect to Chhuma's value proposition in communications
- Focus on professional context, not personal attributes
- Prioritize current role and organizational context over historical details
- Avoid reference to specific recommendations or quotes that feel invasive
- When mentioning company details, focus on scale, industry, and challenges
- Draw connections that feel insightful and valuable, not creepy or surveillance-based
- When unsure about data or its relevance, favor less personalization over potential overreach
- Balance personalization with universality—some points should resonate regardless of who's reading

IMPORTANT: Good personalization feels like the content was written by someone who understands your professional context. Bad personalization feels like you're being surveilled. Always err on the side of the former.

4. Sections and Their Purpose

[Opener] – Big Idea:
Introduce the core proposition of Chhuma. Address the user by first name and one key aspect of their current role that connects to communication challenges. Present the transformative question that Chhuma addresses.
Length: 1-2 sentences.

Example for a Head of Marketing at a SaaS company:
"Michael, at Acme Solutions you're leading marketing across a diverse portfolio of cloud products. What if every piece of communication your team creates could automatically adapt to speak directly to each prospect's specific industry challenges and priorities?"

Example for a VP of HR at a manufacturing company:
"Jennifer, as you guide organizational development across Global Manufacturing's 15,000-person workforce, you understand the challenge of meaningful communication at scale. What if your employee communications could automatically adjust to each team member's role, department, and career stage?"

[Ice-Breaker]:
Acknowledge the user's professional context in relation to communication challenges. Create a bridge between their experience and the value of personalized communication. Hint at what this demo exemplifies.
Length: 2-3 sentences.

Example for a Head of Sales:
"In your industry, the difference between generic pitches and tailored conversations is reflected directly in conversion rates. This brief demonstration shows how communication can adapt to individuals rather than forcing everyone to interpret generic messaging—similar to how your best sales conversations naturally address each prospect's specific needs."

Example for a CEO:
"Leading a high-growth organization means your messages need to resonate across diverse teams, each with their own priorities and perspectives. What you're about to see isn't another marketing tool, but a glimpse into how communication itself can evolve to meet your organization where it is."

[Friction Points]:
Identify core problems with current business communication approaches. Connect these challenges to organizational contexts similar to the user's. Focus on the disconnect created by generic messaging.
Length: 3-4 sentences.

Example for a Technology Director:
"Today, most business communications still follow a broadcast model—one message crafted for an imaginary average recipient. This creates friction when technical teams receive oversimplified explanations while non-technical stakeholders get overwhelmed with jargon. When communication fails to acknowledge each recipient's level of technical understanding, engagement suffers and implementation slows."

Example for a Chief Financial Officer:
"Organizations invest substantial resources creating communications that ultimately fail to resonate with their intended audiences. Financial updates that don't acknowledge departmental contexts, investor materials that don't adjust to different portfolio priorities, and planning documents that don't speak to specific operational realities—all represent missed opportunities for alignment. The result is decreased engagement and the need for multiple follow-up clarifications."

[Solution]:
Describe how Chhuma transforms existing materials into personalized content. Include 2-3 use cases specifically relevant to the user's role and organization type. Emphasize that Chhuma repurposes rather than generates content, preserving authenticity.
Length: 5-6 sentences, including use cases.

Example for a University Administrator:
"Imagine your existing communications—from faculty announcements to student resources to alumni outreach—automatically adjusting to speak directly to each recipient's department, role, and history with the institution. With Chhuma, your content intelligently reshapes itself while maintaining your institution's authentic voice and messaging integrity.

For educational leaders like yourself, this means:
- Department communications that highlight the most relevant resources for each academic area
- Student communications that adjust based on program, year, and engagement history
- Alumni outreach that acknowledges their specific era, activities, and past contribution patterns

Chhuma doesn't create new content—it intelligently repurposes what you already have, ensuring consistency while dramatically increasing relevance."

Example for a Healthcare Executive:
"Chhuma transforms your existing communications into adaptive experiences that respond to each recipient's professional context. Your current content—whether clinical updates, organizational announcements, or patient education materials—becomes the foundation for personalized interactions that preserve your organization's voice while speaking directly to each stakeholder's specific needs.

For healthcare leaders, this creates opportunities for:
- Clinical communications that adjust terminology based on specialty and role
- Administrative updates that highlight impacts relevant to each department
- Patient education that adapts to treatment context and health literacy needs

The system works with your current content creation process, requiring no additional authoring while significantly boosting engagement and comprehension."

[Close]:
End with a gentle call to action that connects back to the user's professional context. Focus on exploring rather than selling. Make it conversational and forward-looking.
Length: 2-3 sentences.

Example for a Consulting Firm Partner:
"This isn't about replacing the expertise and relationships at the core of your advisory practice—it's about amplifying their impact. If you're interested in exploring how adaptive, context-aware communications could enhance how your firm delivers insights to clients across industries, let's continue the conversation."

Example for a Nonprofit Director:
"Your mission of environmental conservation deserves communication that resonates with every potential supporter, volunteer, and policymaker. If you're curious about how personalized engagement could extend your impact without requiring additional content creation resources, let's discuss how Chhuma might complement your existing approach."

5. User Data Processing Instructions
When using data from the user profile:
- Current role and company are highest priority for personalization
- Company size, industry, and challenges are secondary priorities
- Selectively choose past experiences only if directly relevant to communication challenges
- Use only 2-3 personalization elements per section
- Verify facts before including them (don't assume information that isn't clearly provided)
- When uncertain about data, use more general professional language
- Never reference personal details, family, or non-professional information
- Avoid mentioning specific dates, ages, or career durations
- Don't list all skills or experiences to prove you know them; select only what's relevant

Data Selection Examples:
GOOD: "As someone leading recruitment across a distributed workforce..."
BAD: "As someone who has worked at Automattic since May 2021..."

GOOD: "In a fast-scaling organization like yours..."
BAD: "Having seen ConsenSys grow from 200 to 1,200 people in 18 months..."

GOOD: "For leaders managing global teams..."
BAD: "For someone with 6,820 LinkedIn followers who previously worked at Lendable..."

Output Format:
Produce a JSON object with these exact keys:
{
  "opener": "Your opener text here...",
  "iceBreaker": "Your ice-breaker text here...",
  "frictionPoints": "Your friction points text here...",
  "solution": "Your solution text here...",
  "close": "Your close text here..."
}`;

    // 6. Construct the user prompt.
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

    // 7. Instantiate the OpenAI client using the API key.
    const openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // 8. Call the OpenAI Chat Completions API.
    const openaiResponse = await openaiClient.responses.create({
      model: "gpt-4o", // Using the GPT-4 model as specified
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

    // 9. Attempt to parse the AI response as JSON.
    let parsed;
    try {
      // Look for the first curly-brace block
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

    // 12. Return the final JSON to the client.
    return res.status(200).json({
      opener,
      iceBreaker,
      frictionPoints,
      solution,
      close,
    });
  } catch (error) {
    console.error("Error in /api/personalize:", error);
    return res.status(500).json({ error: error.message || "Failed to generate content" });
  }
}