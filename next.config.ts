import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // A path learners guess for the rank challenge.
      { source: "/learn/core/challenge", destination: "/challenge/0", permanent: false },
    ];
  },
};

export default nextConfig;
