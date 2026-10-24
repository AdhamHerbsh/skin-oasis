import type { NextConfig } from "next";
// Keep production output separate from Next's dev cache and older failed builds.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  distDir: process.env.NEXT_DIST_DIR || ".next-bundle",
  cleanDistDir: process.env.NEXT_PRESERVE_DIST === "true" ? false : undefined,
  output: process.env.NEXT_OUTPUT_MODE === "standard" ? undefined : "standalone",
  outputFileTracingExcludes: {
    "/*": [
      "./.git/**/*",
      "./work/**/*",
      "./data/**/*",
      "./runtime/**/*",
      "./.next-bundle/**/*",
      "./.next-release/**/*",
      "./.next-packaging/**/*",
    ],
  },
  allowedDevOrigins: ["192.168.*.*", "localhost", "127.0.0.1", "*.local"],
  experimental: {
    cpus: 1,
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};
export default nextConfig;
