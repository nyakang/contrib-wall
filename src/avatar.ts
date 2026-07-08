import type { Contributor } from "./types";

const MAX_AVATAR_BYTES = 512 * 1024;
const AVATAR_FETCH_CONCURRENCY = 8;
const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export async function embedContributorAvatars(contributors: Contributor[], size: number): Promise<Contributor[]> {
  const result: Contributor[] = [];

  for (let index = 0; index < contributors.length; index += AVATAR_FETCH_CONCURRENCY) {
    const batch = contributors.slice(index, index + AVATAR_FETCH_CONCURRENCY);
    const embedded = await Promise.all(batch.map((contributor) => embedContributorAvatar(contributor, size)));
    result.push(...embedded);
  }

  return result;
}

async function embedContributorAvatar(contributor: Contributor, size: number): Promise<Contributor> {
  const avatarDataUrl = await fetchAvatarDataUrl(contributor.avatarUrl, size);
  if (!avatarDataUrl) return contributor;

  return {
    ...contributor,
    avatarDataUrl
  };
}

async function fetchAvatarDataUrl(url: string, size: number): Promise<string | undefined> {
  let requestUrl: URL;

  try {
    requestUrl = new URL(avatarWithSize(url, size));
  } catch {
    return undefined;
  }

  if (requestUrl.protocol !== "https:") return undefined;

  try {
    const response = await fetch(requestUrl.toString(), {
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.8,*/*;q=0.1",
        "User-Agent": "contrib-wall-avatar-fetcher"
      }
    });

    if (!response.ok) return undefined;

    const contentLength = Number.parseInt(response.headers.get("Content-Length") || "", 10);
    if (Number.isFinite(contentLength) && contentLength > MAX_AVATAR_BYTES) return undefined;

    const contentType = normalizeContentType(response.headers.get("Content-Type"));
    if (!contentType || !SUPPORTED_IMAGE_TYPES.has(contentType)) return undefined;

    const bytes = await readLimitedBytes(response, MAX_AVATAR_BYTES);
    if (!bytes) return undefined;

    return `data:${contentType};base64,${base64EncodeBytes(bytes)}`;
  } catch {
    return undefined;
  }
}

async function readLimitedBytes(response: Response, maxBytes: number): Promise<Uint8Array | undefined> {
  const reader = response.body?.getReader();
  if (!reader) return undefined;

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return undefined;
    }

    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
}

function normalizeContentType(value: string | null): string | undefined {
  const contentType = value?.split(";")[0]?.trim().toLowerCase();
  return contentType || undefined;
}

function avatarWithSize(url: string, size: number): string {
  if (url.includes("s=") || url.includes("size=")) return url;

  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}s=${size}`;
}

function base64EncodeBytes(bytes: Uint8Array): string {
  let binary = "";

  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }

  return btoa(binary);
}
