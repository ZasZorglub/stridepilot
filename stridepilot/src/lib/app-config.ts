export const APP_NAME = "StridePilot";
export const APP_VERSION = "v0.9.0-beta.1";

/**
 * Build label derived from the actual deployment commit.
 * Returns e.g. "build f7cc620" on Vercel (first 7 chars of the commit SHA),
 * or a calm "build local" fallback when no commit SHA is available.
 */
export function buildLabel(): string {
  const sha = (
    process.env.NEXT_PUBLIC_BUILD_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    ""
  ).trim();
  const short = sha.slice(0, 7);
  return short ? `build ${short}` : "build local";
}
