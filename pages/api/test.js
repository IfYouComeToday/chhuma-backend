// pages/api/test.js

export default function handler(req, res) {
  // Define allowed origins
  const allowedOrigins = [
    "https://peaceful-one-060007.framer.app",
    "https://studio.framer.com",
    "http://localhost:3000"
  ];
  
  // Get the request origin from headers or fallback to "*"
  const requestOrigin = req.headers.origin || "*";
  // If the request origin is in our allowed list, use it; otherwise, use "*"
  const originToSet = allowedOrigins.includes(requestOrigin) ? requestOrigin : "*";
  
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", originToSet);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Vary", "Origin");
  
  // Return a simple JSON message
  res.status(200).json({ message: "Hello from the API!" });
}
