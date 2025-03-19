// pages/api/test.js

// Step 1: Create a helper function to wrap your handler with CORS support
const allowCors = (fn) => async (req, res) => {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  // Use the request’s Origin header, or default to "*"
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  // List the HTTP methods your API accepts
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST,PUT");
  // List the headers that are allowed in requests
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );
  
  // If this is a preflight (OPTIONS) request, respond immediately with 200 OK
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  
  // Otherwise, call your actual API handler
  return await fn(req, res);
};

// Step 2: Create your original API handler function
const handler = (req, res) => {
  // This is a simple response that returns JSON
  res.status(200).json({ message: "Hello from the API!" });
};

// Step 3: Export your API handler wrapped with the allowCors function
export default allowCors(handler);
