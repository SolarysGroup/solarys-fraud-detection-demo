import type { NextConfig } from "next";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env from monorepo root
config({ path: resolve(import.meta.dirname, "../../.env") });

const nextConfig: NextConfig = {
  basePath: "/mcp-a2a",
  transpilePackages: ["@solarys/types"],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
};

export default nextConfig;
