import { kvGetText, kvPutText, memoryGet, memoryPut } from "./cache";
import { AppError, type Env, type ImageOptions, type SnapshotRecord } from "./types";

export function createSnapshotId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return base64UrlEncodeBytes(bytes);
}

export async function saveSnapshot(
  env: Env,
  snapshotId: string,
  record: SnapshotRecord,
  ttlSeconds?: number
): Promise<void> {
  const key = snapshotKey(snapshotId);
  const value = JSON.stringify(record);

  memoryPut(key, record, Math.min(ttlSeconds || 600, 600));
  await kvPutText(env, key, value, ttlSeconds);
}

export async function readSnapshot(env: Env, snapshotId: string): Promise<SnapshotRecord> {
  const key = snapshotKey(snapshotId);

  const memory = memoryGet<SnapshotRecord>(key);
  if (memory) return assertSnapshotAlive(memory);

  const text = await kvGetText(env, key);
  if (!text) {
    throw new AppError(404, "snapshot_not_found", "Snapshot not found or expired");
  }

  let record: SnapshotRecord;

  try {
    record = JSON.parse(text) as SnapshotRecord;
  } catch {
    throw new AppError(500, "snapshot_corrupted", "Snapshot is corrupted", false);
  }

  memoryPut(key, record, 600);

  return assertSnapshotAlive(record);
}

export function buildSnapshotRecord(
  svg: string,
  options: ImageOptions,
  contributorCount: number,
  expiresInDays: number
): SnapshotRecord {
  const createdAt = Date.now();
  const expiresAt = expiresInDays > 0 ? createdAt + expiresInDays * 86_400 * 1000 : null;

  return {
    svg,
    createdAt,
    expiresAt,
    repo: options.repo.fullName,
    contributorCount,
    options: {
      repo: options.repo.fullName,
      mode: options.mode,
      max: options.max,
      columns: options.columns,
      avatarSize: options.avatarSize,
      gap: options.gap,
      radius: options.radius,
      theme: options.theme,
      animation: options.animation,
      sticker: options.sticker,
      title: options.title,
      description: options.description,
      showName: options.showName,
      anon: options.anon
    }
  };
}

export function ttlSecondsFromDays(expiresInDays: number): number | undefined {
  if (expiresInDays <= 0) return undefined;
  return Math.max(60, Math.floor(expiresInDays * 86_400));
}

export function snapshotImageUrl(origin: string, snapshotId: string, token: string): string {
  const url = new URL("/image", origin);
  url.searchParams.set("snapshot", snapshotId);
  url.searchParams.set("sealed_token", token);
  return url.toString();
}

function assertSnapshotAlive(record: SnapshotRecord): SnapshotRecord {
  if (record.expiresAt != null && Date.now() > record.expiresAt) {
    throw new AppError(404, "snapshot_expired", "Snapshot has expired");
  }

  return record;
}

function snapshotKey(snapshotId: string): string {
  return `snapshot:v1:${snapshotId}`;
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = "";

  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
