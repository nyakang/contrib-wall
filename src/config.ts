import type { Env } from "./types";

const DEFAULT_IMAGE_CACHE_TTL_SECONDS = 86_400;
const MIN_IMAGE_CACHE_TTL_SECONDS = 60;
const MAX_IMAGE_CACHE_TTL_SECONDS = 604_800;

export function getServiceName(env: Env): string {
  return env.SERVICE_NAME || "contrib-wall";
}

export function getGitHubApiBase(env: Env): string {
  return (env.GITHUB_API_BASE || "https://api.github.com").replace(/\/+$/, "");
}

export function getImageCacheTtlSeconds(env: Env): number {
  const raw = Number.parseInt(env.IMAGE_CACHE_TTL_SECONDS || "", 10);
  if (!Number.isFinite(raw)) return DEFAULT_IMAGE_CACHE_TTL_SECONDS;

  return clamp(raw, MIN_IMAGE_CACHE_TTL_SECONDS, MAX_IMAGE_CACHE_TTL_SECONDS);
}

export function shouldRequireSnapshotToken(env: Env): boolean {
  const raw = (env.REQUIRE_SNAPSHOT_TOKEN || "true").toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "no" && raw !== "off";
}

export function getAllowedRepos(env: Env): Set<string> | null {
  const raw = env.ALLOWED_REPOS?.trim();
  if (!raw) return null;

  const repos = raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return repos.length ? new Set(repos) : null;
}

export function getGenerateRateLimitPerHour(env: Env): number {
  const raw = Number.parseInt(env.GENERATE_RATE_LIMIT_PER_HOUR || "", 10);
  if (!Number.isFinite(raw)) return 30;

  return clamp(raw, 0, 10_000);
}

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}
