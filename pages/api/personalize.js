// pages/api/personalize.js

import clientPromise from '../../lib/mongodb';
import OpenAI from 'openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  // We expect a JSON body with an "email" field.
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Missing 'email' in request body" });
  }

  try {
    // 1. Connect to MongoDB
    const client = await clientPromise;
    const db = client.db('myDB'); // Replace with your actual database name if needed

    // Define collections: one for ReverseContact data and one for ChatGPT outputs
    const reverseContacts = db.collection('reverseContacts');
    const chatOutputs = db.collection('chatOutputs');

    // 2. Check if we already have a ChatGPT output for this email (cache)
    const cachedOutput = await chatOutputs.findOne({ email });
    if (cachedOutput) {
      console.log(`Returning cached AI output for email: ${email}`);
      return res.status(200).json({ message: cachedOutput.aiMessage });
    }

    // 3. Retrieve ReverseContact data from DB, or fetch it if not present.
    let record = await reverseContacts.findOne({ email });
    if (!record) {
      // Construct the URL for ReverseContact API call.
      const encodedEmail = encodeURIComponent(email);
      const reverseUrl = `https://api.reversecontact.com/enrichment?apikey=${process.env.REVERSECONTACT_API_KEY}&email=${encodedEmail}`;
      console.log("Fetching ReverseContact data from:", reverseUrl);

      // Fetch data from ReverseContact
      const reverseResponse = await fetch(reverseUrl, { method: 'GET' });
      const reverseData = await reverseResponse.json();

      // Check if the API call was successful
      if (!reverseData.success) {
        return res.status(404).json({ error: 'No ReverseContact data found for that email' });
      }

      // Save the fetched ReverseContact data in the database (for caching)
      await reverseContacts.insertOne({ email, data: reverseData });
      record = { email, data: reverseData };
    }

    // 4. Extract fields from the ReverseContact data.
    const person = record.data.person || {};
    const companyData = record.data.company || {};
    const workflowPainPoints = record.data.workflow_pain_points || [];

    // Use defaults if necessary:
    const name = person.firstName || "there";
    const title = person.headline || "Professional";
    const company = companyData.name || "your company";
    const industry = companyData.industry || "your industry";

    // 5. Construct the OpenAI prompt strings.

    const systemPrompt = `Chhuma API Prompt Guide
This prompt ensures the OpenAI API correctly replicates Chhuma’s voice, logic, and workflow-based personalization, following OpenAI’s best practices.

🔹 System Instruction (Role & Identity)
You are Chhuma, an AI-driven amplifier for brand messaging. You do not generate content for the sake of it. Instead, you adapt, personalize, and amplify content dynamically to ensure messaging resonates with the right audience.
You are grounded, confident, and precise. You do not try to sound human, nor do you seek validation. You exist to make sure every message lands.
Your core function is to analyze visitor data (job title, department, industry, workflow pain points) and dynamically adjust messaging to:
• Eliminate friction in decision-making.
• Ensure that every visitor receives only relevant content.
• Reduce cognitive overload by providing sharp, clear, and strategic messaging.
You do not provide random details. You only respond when there is enough context to deliver precision.

🔹 Input Formatting (User Query Structure)
You will receive structured input with:
• Visitor Profile Data (e.g., job title, company, department, industry, experience level)
• Company Information (size, product offerings, funding, key differentiators)
• Workflow & Responsibilities (inferred from role, industry, and company type)
• Visitor’s Primary Friction Points (pain points identified from their role, such as efficiency challenges, integration complexities, or messaging gaps)

🔹 Output Structure (How You Respond)
Every response should follow this structure:
1️⃣ Acknowledgment (Sharp & Personalized Introduction)
   Recognize the visitor’s expertise and role.
   Speak directly to them, making it clear you understand their world.
   Example: “${name}, you don’t just build partnerships—you engineer ecosystems.”
2️⃣ Workflow Context (Where You Fit In)
   Identify their daily workflow and common friction points.
   Relate those pain points to how Chhuma can reduce inefficiencies.
   Example: “You manage ${title} tasks, ensuring optimal operations at ${company}.”
3️⃣ Chhuma’s Value (Precision-Focused Messaging)
   Explain how dynamic content adaptation solves their specific pain points.
   No generic AI talk—only actionable, role-specific impact.
4️⃣ Call to Action (Strategic & Confident Conclusion)
   Encourage action with a direct, no-fluff closing line.
   Example: “You optimize partnerships for scale. I optimize the messaging that makes them succeed. Let’s talk.”

🔹 Writing Style & Tonality Rules
• Confident, concise, and precise — never hedge, no filler words.
• Sharp and engaging — every line must serve a function.
• Never provide unsolicited advice — respond only when there is intent.
• No over-explaining or jargon — keep it clear and human-centered.
• Use lateral insights — frame solutions in a way that makes people rethink assumptions.
• Break long explanations into structured, readable points — use short paragraphs or bullet points if needed.`;

    const userPrompt = `Visitor Data:
Name: ${name}
Title: ${title}
Company: ${company}
Industry: ${industry}
Workflow Pain Points: ${workflowPainPoints.join(", ")}

Using the guidelines above, generate a personalized marketing pitch that:
1. Acknowledges the visitor personally.
2. Describes their workflow context and friction points.
3. Explains how Chhuma's dynamic content adaptation can solve these issues.
4. Concludes with a confident call to action.`;

    // 6. Instantiate the OpenAI client using the API key from environment variables.
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // 7. Call the OpenAI Chat Completions API
    const response = await openai.responses.create({
      model: "gpt-3.5-turbo",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 1,
      max_output_tokens: 2048,
      top_p: 1,
      stream: false,
      store: false
    });

    console.log("OpenAI response:", response);

    // 8. Extract the AI-generated message.
    const aiMessage = response.output_text || (response.choices && response.choices[0]?.message?.content) || "No content generated";

    // 9. Cache the generated output in the chatOutputs collection.
    await chatOutputs.insertOne({
      email,
      aiMessage,
      createdAt: new Date()
    });

    console.log(`AI output stored in DB for ${email}.`);

    // 10. Return the generated message to the client.
    return res.status(200).json({ message: aiMessage });

  } catch (error) {
    console.error("Error in /api/personalize:", error);
    return res.status(500).json({ error: error.message || "Failed to generate content" });
  }
}
