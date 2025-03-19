// middleware.js
import { NextResponse } from 'next/server';

export function middleware(req) {
  const response = NextResponse.next();

  // Only apply for /api/ routes
  if (req.nextUrl.pathname.startsWith('/api/')) {
    // Set CORS headers
    response.headers.set("Access-Control-Allow-Origin", "https://peaceful-one-060007.framer.app");
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  return response;
}

// Apply the middleware to all routes under /api/
export const config = {
  matcher: '/api/:path*',
};
