import type { Env } from "./types";

interface MemoryEntry<T> {
  value: T;
  expiresAt: number;
}

const memory = new Map<string, MemoryEntry<unknown>>();

function now(): number {
  return Date.now();
}

export function memoryGet<T>(key: string): T | null {
  const entry = memory.get(key);

  if (!entry) return null;

  if (entry.expiresAt <= now()) {
    memory.delete(key);
    return null;
  }

  return entry.value as T;
}

export function memoryPut<T>(key: string, value: T, ttlSeconds: number): void {
  memory.set(key, {
    value,
    expiresAt: now() + ttlSeconds * 1000
  });

  if (memory.size > 512) {
    const firstKey = memory.keys().next().value;
    if (firstKey) memory.delete(firstKey);
  }
}

export async function kvGetText(env: Env, key: string): Promise<string | null> {
  if (!env.CONTRIB_CACHE) return null;

  try {
    return await env.CONTRIB_CACHE.get(key);
  } catch (error) {
    console.warn("KV get failed", key, error);
    return null;
  }
}

export async function kvPutText(
  env: Env,
  key: string,
  value: string,
  ttlSeconds?: number
): Promise<void> {
  if (!env.CONTRIB_CACHE) return;

  try {
    const options = ttlSeconds && ttlSeconds >= 60 ? { expirationTtl: ttlSeconds } : undefined;
    await env.CONTRIB_CACHE.put(key, value, options);
  } catch (error) {
    console.warn("KV put failed", key, error);
  }
}

export async function kvDelete(env: Env, key: string): Promise<void> {
  if (!env.CONTRIB_CACHE) return;

  try {
    await env.CONTRIB_CACHE.delete(key);
  } catch (error) {
    console.warn("KV delete failed", key, error);
  }
}
