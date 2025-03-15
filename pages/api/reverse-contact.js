// /pages/api/reversecontact.js
import clientPromise from "../../lib/mongodb";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  // URL-encode the email (so that "@" becomes "%40")
  const encodedEmail = encodeURIComponent(email);

  // Get your ReverseContact API key from environment variables
  const apiKey = process.env.REVERSECONTACT_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ReverseContact API key is not set" });
  }

  // Construct the API URL
  const url = `https://api.reversecontact.com/enrichment?apikey=${apiKey}&email=${encodedEmail}`;
  console.log("Constructed URL:", url);

  try {
    // Make the API request using fetch
    const response = await fetch(url, { method: "GET" });
    const data = await response.json();

    // Check if the API call was successful
    if (!data.success) {
      return res.status(404).json({ error: "No ReverseContact data found for that email" });
    }

    // Connect to MongoDB and store the fetched data
    const client = await clientPromise;
    const db = client.db("myDB"); // Replace "myDB" with your actual database name if needed
    const reverseContacts = db.collection("reverseContacts");

    // Update the document (or insert if not present) and log the result
    const result = await reverseContacts.updateOne(
      { email: email },
      { $set: { data: data, updatedAt: new Date() } },
      { upsert: true }
    );
    console.log("MongoDB updateOne result:", result);

    // Return the data back to the client
    return res.status(200).json(data);
  } catch (error) {
    console.error("ReverseContact API error:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch ReverseContact data" });
  }
}
