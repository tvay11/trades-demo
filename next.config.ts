import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  cacheComponents: true,
  logging: {
    browserToTerminal: "error",
    incomingRequests: false,
  },
  turbopack: {
    root: projectRoot,
  },
  experimental: {
    instantNavigationDevToolsToggle: true,
  },
};

export default nextConfig;
