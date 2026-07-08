export interface Env {
  ASSETS?: Fetcher;
  CONTRIB_CACHE?: KVNamespace;
  GITHUB_API_BASE?: string;
  SERVICE_NAME?: string;
  IMAGE_CACHE_TTL_SECONDS?: string;
  SEALING_SECRET?: string;
  REQUIRE_SNAPSHOT_TOKEN?: string;
  ALLOWED_REPOS?: string;
  GENERATE_RATE_LIMIT_PER_HOUR?: string;
}

export type ContributorMode = "github" | "mixed" | "manual";
export type Theme = "transparent" | "light" | "dark" | "github" | "ocean" | "sunset" | "forest" | "candy" | "terminal";
export type AnimationStyle = "none" | "float" | "pop" | "pulse";
export type StickerStyle = "none" | "sparkle" | "star" | "heart" | "code";

export interface ParsedRepo {
  owner: string;
  repo: string;
  fullName: string;
}

export interface Contributor {
  login: string;
  avatarUrl: string;
  avatarDataUrl?: string;
  profileUrl: string;
  contributions?: number;
  roles?: string[];
  note?: string;
  source: "github" | "manual" | "mixed";
}

export interface ManualContributor {
  login: string;
  avatarUrl?: string;
  profileUrl?: string;
  contributions?: number;
  roles?: string[];
  note?: string;
}

export interface ImageOptions {
  repo: ParsedRepo;
  mode: ContributorMode;
  max: number;
  columns: number;
  avatarSize: number;
  gap: number;
  radius: number;
  theme: Theme;
  animation: AnimationStyle;
  sticker: StickerStyle;
  title?: string;
  description?: string;
  showName: boolean;
  anon: boolean;
}

export interface SnapshotRecord {
  svg: string;
  createdAt: number;
  expiresAt: number | null;
  repo: string;
  contributorCount: number;
  options: Omit<ImageOptions, "repo"> & {
    repo: string;
  };
}

export interface SnapshotSealPayload {
  v: 1;
  type: "snapshot";
  snapshot: string;
  exp: number;
}

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly expose: boolean;

  constructor(status: number, code: string, message: string, expose = true) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.expose = expose;
  }
}
