import { getGenerateRateLimitPerHour } from "./config";
import { kvGetText, kvPutText } from "./cache";
import { AppError, type Env } from "./types";

/**
 * 简单 KV 限流。
 *
 * KV 不是强一致计数器，这里只做低成本防刷兜底。
 * 真正公共服务建议接 Cloudflare Turnstile / WAF / Durable Object rate limiter。
 */
export async function enforceGenerateRateLimit(env: Env, request: Request): Promise<void> {
  const limit = getGenerateRateLimitPerHour(env);
  if (limit <= 0) return;

  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown";
  const hour = new Date().toISOString().slice(0, 13);
  const key = `ratelimit:v1:generate:${hashString(ip)}:${hour}`;

  const current = Number.parseInt((await kvGetText(env, key)) || "0", 10) || 0;

  if (current >= limit) {
    throw new AppError(429, "rate_limited", `Too many generate requests. Limit is ${limit} per hour.`);
  }

  await kvPutText(env, key, String(current + 1), 60 * 60 * 2);
}

function hashString(value: string): string {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16);
}
