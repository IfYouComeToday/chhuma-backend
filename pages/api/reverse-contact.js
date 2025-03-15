// /pages/api/reversecontact.js
export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Get the email from the query parameters
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  // URL-encode the email (so that "@" becomes "%40")
  const encodedEmail = encodeURIComponent(email);

  // Get your API key from environment variables
  const apiKey = process.env.REVERSECONTACT_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ReverseContact API key is not set" });
  }

  // Construct the API URL using your API key and the encoded email
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

    // Return the ReverseContact data in the response
    return res.status(200).json(data);
  } catch (error) {
    console.error("ReverseContact API error:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch ReverseContact data" });
  }
}
