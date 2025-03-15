// pages/api/test-db.js
import clientPromise from '../../lib/mongodb';

export default async function handler(req, res) {
  try {
    // Get the connected MongoDB client
    const client = await clientPromise;
    // Use the database name you specified in your MongoDB URI
    const db = client.db("cluster0"); // Replace "yourDbName" with your actual DB name
    
    // List all collections in the database
    const collections = await db.listCollections().toArray();

    // Return a success message along with the list of collections
    res.status(200).json({ message: "Connected to MongoDB successfully!", collections });
  } catch (error) {
    // If there's an error, log it and return a 500 status code with the error message
    console.error("DB connection error:", error);
    res.status(500).json({ error: error.message });
  }
}
