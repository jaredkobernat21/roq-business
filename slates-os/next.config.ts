import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives in a subfolder of the roq-business git repo (which
  // isn't a Node project itself), so tell Turbopack its root explicitly
  // instead of letting it search upward for a lockfile/VCS root.
  turbopack: {
    root: path.join(__dirname),
  },
  experimental: {
    serverActions: {
      // Default 1MB is too small for a customer CSV import — the mapped
      // rows are sent to importCustomersAction as one action payload.
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
