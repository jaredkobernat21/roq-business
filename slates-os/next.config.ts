import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives in a subfolder of the slates-website git repo (which
  // isn't a Node project itself), so tell Turbopack its root explicitly
  // instead of letting it search upward for a lockfile/VCS root.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
