import { execSync } from "node:child_process";
import type { NextConfig } from "next";

function resolveBuildId(): string {
  const vercelCommit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  if (vercelCommit) {
    return vercelCommit;
  }

  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: resolveBuildId(),
  },
};

export default nextConfig;
