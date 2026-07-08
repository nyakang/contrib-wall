import { clamp, getAllowedRepos } from "./config";
import {
  AppError,
  type AnimationStyle,
  type ContributorMode,
  type Env,
  type ImageOptions,
  type ParsedRepo,
  type StickerStyle,
  type Theme
} from "./types";

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

export function parseRepo(value: string | null): ParsedRepo {
  if (!value) {
    throw new AppError(400, "missing_repo", "Missing required field: repo");
  }

  const trimmed = value.trim();

  if (trimmed.includes("://") || trimmed.includes("?") || trimmed.includes("#")) {
    throw new AppError(400, "invalid_repo", "repo must use owner/repo format, not a URL");
  }

  const parts = trimmed.split("/");
  if (parts.length !== 2) {
    throw new AppError(400, "invalid_repo", "repo must use owner/repo format");
  }

  const [owner, repo] = parts;

  if (!OWNER_RE.test(owner)) {
    throw new AppError(400, "invalid_owner", "Invalid GitHub owner name");
  }

  if (!REPO_RE.test(repo)) {
    throw new AppError(400, "invalid_repo", "Invalid GitHub repository name");
  }

  return {
    owner,
    repo,
    fullName: `${owner}/${repo}`
  };
}

export function assertRepoAllowed(env: Env, repo: ParsedRepo): void {
  const allowed = getAllowedRepos(env);
  if (!allowed) return;

  if (!allowed.has(repo.fullName.toLowerCase())) {
    throw new AppError(403, "repo_not_allowed", `Repository is not allowed: ${repo.fullName}`);
  }
}

export function parseMode(value: unknown): ContributorMode {
  if (value == null || value === "") return "github";

  if (value === "github" || value === "mixed" || value === "manual") {
    return value;
  }

  throw new AppError(400, "invalid_mode", "mode must be one of: github, mixed, manual");
}

export function parseTheme(value: unknown): Theme {
  if (value == null || value === "") return "transparent";

  if (
    value === "transparent" ||
    value === "light" ||
    value === "dark" ||
    value === "github" ||
    value === "ocean" ||
    value === "sunset" ||
    value === "forest" ||
    value === "candy" ||
    value === "terminal"
  ) {
    return value;
  }

  throw new AppError(
    400,
    "invalid_theme",
    "theme must be one of: transparent, light, dark, github, ocean, sunset, forest, candy, terminal"
  );
}

export function parseAnimation(value: unknown): AnimationStyle {
  if (value == null || value === "") return "none";

  if (value === "none" || value === "float" || value === "pop" || value === "pulse") {
    return value;
  }

  throw new AppError(400, "invalid_animation", "animation must be one of: none, float, pop, pulse");
}

export function parseSticker(value: unknown): StickerStyle {
  if (value == null || value === "") return "none";

  if (value === "none" || value === "sparkle" || value === "star" || value === "heart" || value === "code") {
    return value;
  }

  throw new AppError(400, "invalid_sticker", "sticker must be one of: none, sparkle, star, heart, code");
}

export function parseBool(value: unknown, defaultValue = false): boolean {
  if (value == null || value === "") return defaultValue;

  if (typeof value === "boolean") return value;

  const normalized = String(value).toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function parseIntField(
  value: unknown,
  defaultValue: number,
  min: number,
  max: number,
  name: string
): number {
  if (value == null || value === "") return defaultValue;

  const parsed = Number.parseInt(String(value), 10);

  if (!Number.isFinite(parsed)) {
    throw new AppError(400, `invalid_${name}`, `${name} must be an integer`);
  }

  return clamp(parsed, min, max);
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("Content-Type") || "";

  if (!contentType.includes("application/json")) {
    throw new AppError(415, "unsupported_media_type", "Content-Type must be application/json");
  }

  const body = await request.json();

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError(400, "invalid_body", "Request body must be a JSON object");
  }

  return body as Record<string, unknown>;
}

export function optionsFromObject(body: Record<string, unknown>): ImageOptions {
  const repo = parseRepo(stringField(body.repo, "repo"));

  return {
    repo,
    mode: parseMode(body.mode),
    max: parseIntField(body.max, 100, 1, 100, "max"),
    columns: parseIntField(body.columns, 8, 1, 20, "columns"),
    avatarSize: parseIntField(body.avatarSize, 64, 16, 128, "avatarSize"),
    gap: parseIntField(body.gap, 8, 0, 32, "gap"),
    radius: parseIntField(body.radius, 999, 0, 999, "radius"),
    theme: parseTheme(body.theme),
    animation: parseAnimation(body.animation),
    sticker: parseSticker(body.sticker),
    title: optionalTextField(body.title, "title", 80),
    description: optionalTextField(body.description, "description", 140),
    showName: parseBool(body.showName, false),
    anon: parseBool(body.anon, false)
  };
}

export function parseExpiresInDays(value: unknown): number {
  if (value == null || value === "") return 365;

  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > 3650) {
    throw new AppError(400, "invalid_expires_in_days", "expiresInDays must be a number between 0 and 3650");
  }

  return num;
}

export function readBearerToken(request: Request, name = "GitHub Token"): string {
  const auth = request.headers.get("Authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);

  if (!match?.[1]?.trim()) {
    throw new AppError(401, "missing_github_token", `${name} is required in Authorization: Bearer <token>`);
  }

  const token = match[1].trim();

  if (token.length > 512) {
    throw new AppError(400, "invalid_github_token", `${name} is too long`);
  }

  return token;
}

export function parseSnapshotId(value: string | null): string {
  if (!value) {
    throw new AppError(400, "missing_snapshot", "Missing required query parameter: snapshot");
  }

  if (!/^[A-Za-z0-9_-]{16,128}$/.test(value)) {
    throw new AppError(400, "invalid_snapshot", "Invalid snapshot id");
  }

  return value;
}

function stringField(value: unknown, name: string): string | null {
  if (value == null) return null;

  if (typeof value !== "string") {
    throw new AppError(400, `invalid_${name}`, `${name} must be a string`);
  }

  return value;
}

function optionalTextField(value: unknown, name: string, maxLength: number): string | undefined {
  if (value == null || value === "") return undefined;

  if (typeof value !== "string") {
    throw new AppError(400, `invalid_${name}`, `${name} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (trimmed.length > maxLength) {
    throw new AppError(400, `invalid_${name}`, `${name} must be at most ${maxLength} characters`);
  }

  return trimmed;
}
