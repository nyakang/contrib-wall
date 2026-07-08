import { getAssets } from "./bindings";
import { getContribRefreshIntervalSeconds, getImageCacheTtlSeconds } from "./config";
import { embedContributorAvatars } from "./avatar";
import { getContributorsForSnapshot } from "./contributors";
import { errorResponse, jsonResponse, optionsResponse, svgResponse, textResponse } from "./http";
import {
  assertRepoAllowed,
  optionsFromObject,
  parseExpiresInDays,
  parseRepo,
  parseSnapshotId,
  readBearerToken,
  readJsonBody
} from "./params";
import { enforceGenerateRateLimit } from "./rate-limit";
import { sealGitHubToken, sealSnapshot, unsealGitHubToken, verifySnapshotTokenIfNeeded } from "./seal";
import {
  buildSnapshotRecord,
  createSnapshotId,
  readSnapshot,
  saveSnapshot,
  snapshotImageUrl,
  ttlSecondsFromDays,
  ttlSecondsFromRecord
} from "./snapshot";
import { renderContributorsSvg } from "./svg";
import { AppError, type Env, type ImageOptions, type SnapshotRecord } from "./types";

const REFRESH_RETRY_BACKOFF_MS = 3_600_000;
const STALE_IMAGE_CACHE_TTL_SECONDS = 60;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await handleRequest(request, env, ctx);
    } catch (error) {
      return errorResponse(error);
    }
  }
};

async function handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (request.method === "OPTIONS") {
    return optionsResponse();
  }

  const url = new URL(request.url);
  const pathname = normalizePath(url.pathname);

  if (pathname === "/healthz" && request.method === "GET") {
    return textResponse("ok");
  }

  if (pathname === "/api/generate" && request.method === "POST") {
    return await handleGenerate(request, env);
  }

  if ((pathname === "/image" || pathname === "/image.svg") && (request.method === "GET" || request.method === "HEAD")) {
    return await handleImage(url, env, ctx);
  }

  if (pathname.startsWith("/api/")) {
    throw new AppError(404, "not_found", "API route not found");
  }

  // 静态资源交给 Workers Static Assets。
  const assets = getAssets(env);
  if ((request.method === "GET" || request.method === "HEAD") && assets) {
    return assets.fetch(request);
  }

  throw new AppError(405, "method_not_allowed", "Only GET, HEAD, POST and OPTIONS are supported");
}

async function handleGenerate(request: Request, env: Env): Promise<Response> {
  await enforceGenerateRateLimit(env, request);

  const githubToken = readBearerToken(request, "GitHub Token");
  const body = await readJsonBody(request);
  const options = optionsFromObject(body);
  const expiresInDays = parseExpiresInDays(body.expiresInDays);

  assertRepoAllowed(env, options.repo);

  const contributors = await getContributorsForSnapshot(env, options, githubToken);
  const embeddedContributors = await embedContributorAvatars(contributors, options.avatarSize);
  const svg = renderContributorsSvg(embeddedContributors, options);
  const snapshotId = createSnapshotId();

  const expiresAt = expiresInDays > 0 ? Math.floor(Date.now() / 1000 + expiresInDays * 86_400) : 0;
  const sealedToken = await sealSnapshot(env, snapshotId, expiresAt);
  const sealedGitHubToken = await sealGitHubToken(env, snapshotId, options.repo.fullName, githubToken, expiresAt);

  const record = buildSnapshotRecord(
    svg,
    options,
    embeddedContributors.length,
    expiresInDays,
    getContribRefreshIntervalSeconds(env)
  );
  await saveSnapshot(env, snapshotId, record, ttlSecondsFromDays(expiresInDays));

  const origin = new URL(request.url).origin;
  const imageUrl = snapshotImageUrl(origin, snapshotId, sealedToken, sealedGitHubToken);
  const repoUrl = `https://github.com/${options.repo.fullName}/graphs/contributors`;
  const imageAlt = options.title || `Contributors to ${options.repo.fullName}`;

  return jsonResponse({
    snapshot: snapshotId,
    imageUrl,
    repoUrl,
    contributorCount: embeddedContributors.length,
    expiresAt: record.expiresAt ? new Date(record.expiresAt).toISOString() : null,
    markdown: `<a href="${escapeHtml(repoUrl)}">\n  <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(imageAlt)}" />\n</a>`,
    html: `<a href="${escapeHtml(repoUrl)}"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(imageAlt)}" /></a>`
  });
}

async function handleImage(url: URL, env: Env, ctx: ExecutionContext): Promise<Response> {
  const snapshotId = parseSnapshotId(url.searchParams.get("snapshot"));
  await verifySnapshotTokenIfNeeded(env, snapshotId, url.searchParams.get("sealed_token"));

  const record = await readSnapshot(env, snapshotId);
  const sealedGitHubToken = url.searchParams.get("sealed_github_token");
  const stale = Boolean(sealedGitHubToken && shouldRefresh(env, record));

  if (sealedGitHubToken && stale) {
    ctx.waitUntil(refreshSnapshot(env, snapshotId, record, sealedGitHubToken));
  }

  const cacheTtlSeconds = stale
    ? Math.min(getImageCacheTtlSeconds(env), STALE_IMAGE_CACHE_TTL_SECONDS)
    : getImageCacheTtlSeconds(env);

  return svgResponse(record.svg, cacheTtlSeconds);
}

async function refreshSnapshot(
  env: Env,
  snapshotId: string,
  record: SnapshotRecord,
  sealedGitHubToken: string
): Promise<void> {
  const refreshIntervalSeconds = getContribRefreshIntervalSeconds(env);

  try {
    const options = imageOptionsFromSnapshot(record);
    assertRepoAllowed(env, options.repo);

    const githubToken = await unsealGitHubToken(env, snapshotId, options.repo.fullName, sealedGitHubToken);
    const contributors = await getContributorsForSnapshot(env, options, githubToken);
    const embeddedContributors = await embedContributorAvatars(contributors, options.avatarSize);
    const svg = renderContributorsSvg(embeddedContributors, options);
    const refreshedAt = Date.now();

    await saveSnapshot(
      env,
      snapshotId,
      {
        ...record,
        svg,
        refreshedAt,
        nextRefreshAt: refreshedAt + refreshIntervalSeconds * 1000,
        lastRefreshError: undefined,
        contributorCount: embeddedContributors.length
      },
      ttlSecondsFromRecord(record)
    );
  } catch (error) {
    const retryAt = Date.now() + REFRESH_RETRY_BACKOFF_MS;
    const errorCode = error instanceof AppError ? error.code : "refresh_failed";

    console.warn("Snapshot refresh failed", { snapshotId, error });

    await saveSnapshot(
      env,
      snapshotId,
      {
        ...record,
        nextRefreshAt: retryAt,
        lastRefreshError: errorCode
      },
      ttlSecondsFromRecord(record)
    );
  }
}

function shouldRefresh(env: Env, record: SnapshotRecord): boolean {
  const nextRefreshAt = record.nextRefreshAt ?? record.createdAt + getContribRefreshIntervalSeconds(env) * 1000;
  return Date.now() >= nextRefreshAt;
}

function imageOptionsFromSnapshot(record: SnapshotRecord): ImageOptions {
  return {
    ...record.options,
    repo: parseRepo(record.options.repo)
  };
}

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

function escapeHtml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => {
    switch (char) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}
