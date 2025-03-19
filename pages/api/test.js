// pages/api/test.js

export default function handler(req, res) {
  // If this is an OPTIONS preflight request, handle it immediately:
  if (req.method === "OPTIONS") {
    res.writeHead(200, {
      "Access-Control-Allow-Origin": "https://peaceful-one-060007.framer.app",
      "Access-Control-Allow-Methods": "GET,OPTIONS,POST,PUT",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
    });
    res.end();
    return;
  }
  
  // For other requests, set headers using writeHead and send the response.
  res.writeHead(200, {
    "Access-Control-Allow-Origin": "https://peaceful-one-060007.framer.app",
    "Access-Control-Allow-Methods": "GET,OPTIONS,POST,PUT",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify({ message: "Hello from the API!" }));
}
