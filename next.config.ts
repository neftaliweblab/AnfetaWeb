import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/auth",
        destination: "/api/auth",
      },
    ];
  },
};

export default nextConfig;
