import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Expose the deployment commit SHA to the client so the UI build label
  // reflects the actual deployed commit (Vercel sets VERCEL_GIT_COMMIT_SHA).
  env: {
    NEXT_PUBLIC_BUILD_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
  },
};

export default nextConfig;
