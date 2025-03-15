// pages/api/reverse-contact.js
import clientPromise from '../../lib/mongodb';

export default async function handler(req, res) {
  // 1. Enforce GET requests only
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 2. Grab the "email" query param
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ error: 'Email is required as a query param: ?email=' });
  }

  try {
    // 3. Connect to MongoDB
    const client = await clientPromise;
    const db = client.db("myDB"); // or whatever DB name you use
    const collection = db.collection("reverseContacts"); // collection name of your choice

    // 4. Check if we have a cached record for this email
    const existingRecord = await collection.findOne({ email });
    if (existingRecord) {
      console.log("Data found in DB. Returning cached record.");
      return res.status(200).json(existingRecord);
    }

    // 5. Not found in DB -> call ReverseContact
    // NOTE: Replace with your actual key if needed
    const apiKey = "sk_f4477c7545e31be572a92c56c96898d1788332e4"; 
    const url = `https://api.reversecontact.com/enrichment?apikey=${apiKey}&email=${encodeURIComponent(email)}`;

    // 6. Fetch data from ReverseContact
    const response = await fetch(url, { method: 'GET' });
    const data = await response.json();

    // 7. Check if ReverseContact returned success
    if (!data.success) {
      return res.status(500).json({
        error: 'ReverseContact lookup failed',
        details: data
      });
    }

    // 8. Store the record in MongoDB
    const record = {
      email,
      data,
      createdAt: new Date()
    };
    await collection.insertOne(record);
    console.log("New data stored in DB.");

    // 9. Return the newly stored record
    return res.status(200).json(record);

  } catch (error) {
    console.error("Error in reverse-contact handler:", error);
    return res.status(500).json({ error: error.message });
  }
}
