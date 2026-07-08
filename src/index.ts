import { getImageCacheTtlSeconds } from "./config";
import { embedContributorAvatars } from "./avatar";
import { getContributorsForSnapshot } from "./contributors";
import { errorResponse, jsonResponse, optionsResponse, svgResponse, textResponse } from "./http";
import {
  assertRepoAllowed,
  optionsFromObject,
  parseExpiresInDays,
  parseSnapshotId,
  readBearerToken,
  readJsonBody
} from "./params";
import { enforceGenerateRateLimit } from "./rate-limit";
import { sealSnapshot, verifySnapshotTokenIfNeeded } from "./seal";
import {
  buildSnapshotRecord,
  createSnapshotId,
  readSnapshot,
  saveSnapshot,
  snapshotImageUrl,
  ttlSecondsFromDays
} from "./snapshot";
import { renderContributorsSvg } from "./svg";
import { AppError, type Env } from "./types";

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
    return await handleImage(url, env);
  }

  if (pathname.startsWith("/api/")) {
    throw new AppError(404, "not_found", "API route not found");
  }

  // 静态资源交给 Workers Static Assets。
  if ((request.method === "GET" || request.method === "HEAD") && env.ASSETS) {
    return env.ASSETS.fetch(request);
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

  const record = buildSnapshotRecord(svg, options, embeddedContributors.length, expiresInDays);
  await saveSnapshot(env, snapshotId, record, ttlSecondsFromDays(expiresInDays));

  const origin = new URL(request.url).origin;
  const imageUrl = snapshotImageUrl(origin, snapshotId, sealedToken);
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

async function handleImage(url: URL, env: Env): Promise<Response> {
  const snapshotId = parseSnapshotId(url.searchParams.get("snapshot"));
  await verifySnapshotTokenIfNeeded(env, snapshotId, url.searchParams.get("sealed_token"));

  const record = await readSnapshot(env, snapshotId);
  return svgResponse(record.svg, getImageCacheTtlSeconds(env));
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
