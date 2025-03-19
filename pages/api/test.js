// pages/api/test.js

// A helper function to wrap your handler with CORS support and a debug header
const allowCors = (fn) => async (req, res) => {
  // Debug header to confirm our code runs
  res.setHeader("X-Debug", "CORS wrapper executed");

  // Set CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );
  
  // If it's an OPTIONS (preflight) request, respond immediately
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  
  // Otherwise, call the actual handler
  return await fn(req, res);
};

// Your API handler – it just returns a simple message
const handler = (req, res) => {
  res.status(200).json({ message: "Hello from the API!" });
};

// Export the handler wrapped with our CORS function
export default allowCors(handler);
