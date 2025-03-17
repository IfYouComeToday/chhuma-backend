// /pages/api/reversecontact.js
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Get email and linkedInUrl from query parameters.
  // (Your frontend should send one or the other.)
  const { email, linkedInUrl } = req.query;
  
  if (!email && !linkedInUrl) {
    return res.status(400).json({ error: "Email or LinkedIn URL is required" });
  }

  // Get your API key from environment variables
  const apiKey = process.env.REVERSECONTACT_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ReverseContact API key is not set" });
  }

  let url = "";
  // If an email is provided, use the email enrichment endpoint.
  if (email) {
    const encodedEmail = encodeURIComponent(email);
    url = `https://api.reversecontact.com/enrichment?apikey=${apiKey}&email=${encodedEmail}`;
  } 
  // Else if a LinkedIn URL is provided, use the LinkedIn profile endpoint.
  else if (linkedInUrl) {
    const encodedLinkedInUrl = encodeURIComponent(linkedInUrl);
    url = `https://api.reversecontact.com/enrichment/profile?apikey=${apiKey}&linkedInUrl=${encodedLinkedInUrl}`;
  }

  console.log("Constructed URL:", url);

  try {
    const response = await fetch(url, { method: "GET" });
    const data = await response.json();

    // If the API returns a non-success status, forward a 404 error.
    if (!data.success) {
      return res.status(404).json({ error: "No ReverseContact data found" });
    }

    // Return the retrieved data
    return res.status(200).json(data);
  } catch (error) {
    console.error("ReverseContact API error:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch ReverseContact data" });
  }
}
