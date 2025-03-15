import clientPromise from "../../lib/mongodb";

export default async function handler(req, res) {
  try {
    // Wait for the client to connect
    const client = await clientPromise;
    // Access a database (replace "myDB" with the actual DB name if you have one)
    const db = client.db("myDB");

    // Test a simple command or collection query if you want
    // For example, list collections:
    const collections = await db.listCollections().toArray();

    return res.status(200).json({
      message: "Database connection successful!",
      collections
    });
  } catch (error) {
    console.error("DB Test Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
