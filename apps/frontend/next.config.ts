import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stop `next dev` from writing an AGENTS.md file into the repo.
  agentRules: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
