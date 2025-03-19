// next.config.js
module.exports = {
  async headers() {
    return [
      {
        // This applies to all API routes (and any route starting with /api/)
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "https://peaceful-one-060007.framer.app" },
          { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
};
