// pages/api/test.js

export default function handler(req, res) {
  // Set CORS headers
  const allowedOrigins = [
    "https://peaceful-one-060007.framer.app",
    "https://studio.framer.com",
    "http://localhost:3000"
  ];
  const requestOrigin = req.headers.origin || "*";
  const originToSet = allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : "*";

  res.setHeader("Access-Control-Allow-Origin", originToSet);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Vary", "Origin");

  // Respond with a simple JSON message
  res.status(200).json({ message: "Test endpoint: CORS headers should be set." });
}
