import { shouldRequireSnapshotToken } from "./config";
import { AppError, type Env, type GitHubTokenSealPayload, type SnapshotSealPayload } from "./types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const GITHUB_TOKEN_IV_BYTES = 12;
const MAX_SEALED_GITHUB_TOKEN_LENGTH = 8192;

export async function sealSnapshot(env: Env, snapshotId: string, exp = 0): Promise<string> {
  const secret = getSealingSecret(env);
  const payload = payloadFromSnapshot(snapshotId, exp);
  const payloadText = stablePayloadString(payload);
  const payloadB64 = base64UrlEncodeText(payloadText);
  const signatureB64 = await sign(secret, payloadB64);

  return `${payloadB64}.${signatureB64}`;
}

export async function verifySnapshotTokenIfNeeded(
  env: Env,
  snapshotId: string,
  token: string | null
): Promise<void> {
  if (!shouldRequireSnapshotToken(env)) return;

  if (!token) {
    throw new AppError(401, "missing_sealed_token", "Missing required query parameter: sealed_token");
  }

  await verifySnapshotToken(env, snapshotId, token);
}

export async function verifySnapshotToken(env: Env, snapshotId: string, token: string): Promise<void> {
  if (token.length > 8192) {
    throw new AppError(401, "invalid_sealed_token", "sealed_token is too long");
  }

  const [payloadB64, signatureB64, extra] = token.split(".");
  if (!payloadB64 || !signatureB64 || extra !== undefined) {
    throw new AppError(401, "invalid_sealed_token", "Invalid sealed_token format");
  }

  const secret = getSealingSecret(env);
  const ok = await verify(secret, payloadB64, signatureB64);

  if (!ok) {
    throw new AppError(401, "invalid_sealed_token", "Invalid sealed_token signature");
  }

  const payload = parsePayload(payloadB64);

  if (payload.snapshot !== snapshotId) {
    throw new AppError(401, "sealed_token_mismatch", "sealed_token does not match current snapshot");
  }

  if (payload.exp > 0 && Math.floor(Date.now() / 1000) > payload.exp) {
    throw new AppError(401, "sealed_token_expired", "sealed_token has expired");
  }
}

export async function sealGitHubToken(
  env: Env,
  snapshotId: string,
  repo: string,
  githubToken: string,
  exp = 0
): Promise<string> {
  const payload = stableGitHubTokenPayloadString({
    v: 1,
    type: "github_token",
    snapshot: snapshotId,
    repo,
    token: githubToken,
    exp
  });
  const iv = crypto.getRandomValues(new Uint8Array(GITHUB_TOKEN_IV_BYTES));
  const key = await deriveGitHubTokenKey(getSealingSecret(env));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: bufferSourceFromBytes(iv)
    },
    key,
    bufferSourceFromBytes(encoder.encode(payload))
  );

  return `${base64UrlEncodeBytes(iv)}.${base64UrlEncodeBytes(new Uint8Array(ciphertext))}`;
}

export async function unsealGitHubToken(
  env: Env,
  snapshotId: string,
  repo: string,
  token: string
): Promise<string> {
  if (token.length > MAX_SEALED_GITHUB_TOKEN_LENGTH) {
    throw new AppError(401, "invalid_sealed_github_token", "sealed_github_token is too long");
  }

  const [ivB64, ciphertextB64, extra] = token.split(".");
  if (!ivB64 || !ciphertextB64 || extra !== undefined) {
    throw new AppError(401, "invalid_sealed_github_token", "Invalid sealed_github_token format");
  }

  const iv = base64UrlDecodeBytes(ivB64);
  if (iv.byteLength !== GITHUB_TOKEN_IV_BYTES) {
    throw new AppError(401, "invalid_sealed_github_token", "Invalid sealed_github_token IV");
  }

  let payload: GitHubTokenSealPayload;

  try {
    const key = await deriveGitHubTokenKey(getSealingSecret(env));
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: bufferSourceFromBytes(iv)
      },
      key,
      bufferSourceFromBytes(base64UrlDecodeBytes(ciphertextB64))
    );
    payload = parseGitHubTokenPayload(decoder.decode(plaintext));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(401, "invalid_sealed_github_token", "Invalid sealed_github_token");
  }

  if (payload.snapshot !== snapshotId) {
    throw new AppError(401, "sealed_github_token_mismatch", "sealed_github_token does not match current snapshot");
  }

  if (payload.repo !== repo) {
    throw new AppError(401, "sealed_github_token_repo_mismatch", "sealed_github_token does not match current repo");
  }

  if (payload.exp > 0 && Math.floor(Date.now() / 1000) > payload.exp) {
    throw new AppError(401, "sealed_github_token_expired", "sealed_github_token has expired");
  }

  return payload.token;
}

function payloadFromSnapshot(snapshotId: string, exp: number): SnapshotSealPayload {
  return {
    v: 1,
    type: "snapshot",
    snapshot: snapshotId,
    exp
  };
}

function getSealingSecret(env: Env): string {
  const secret = env.SEALING_SECRET;
  if (!secret || secret.length < 32) {
    throw new AppError(500, "sealing_secret_missing", "SEALING_SECRET must be configured and at least 32 characters", false);
  }

  return secret;
}

async function sign(secret: string, payloadB64: string): Promise<string> {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, bufferSourceFromBytes(encoder.encode(payloadB64)));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

async function verify(secret: string, payloadB64: string, signatureB64: string): Promise<boolean> {
  const key = await importHmacKey(secret);
  const signature = base64UrlDecodeBytes(signatureB64);

  return await crypto.subtle.verify(
    "HMAC",
    key,
    bufferSourceFromBytes(signature),
    bufferSourceFromBytes(encoder.encode(payloadB64))
  );
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    bufferSourceFromBytes(encoder.encode(secret)),
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign", "verify"]
  );
}

async function deriveGitHubTokenKey(secret: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey("raw", bufferSourceFromBytes(encoder.encode(secret)), "HKDF", false, [
    "deriveKey"
  ]);

  return await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: bufferSourceFromBytes(encoder.encode("contrib-wall-seal-v1")),
      info: bufferSourceFromBytes(encoder.encode("github-token"))
    },
    baseKey,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );
}

function parsePayload(payloadB64: string): SnapshotSealPayload {
  let raw: unknown;

  try {
    raw = JSON.parse(base64UrlDecodeText(payloadB64));
  } catch {
    throw new AppError(401, "invalid_sealed_token", "Invalid sealed_token payload");
  }

  if (!raw || typeof raw !== "object") {
    throw new AppError(401, "invalid_sealed_token", "Invalid sealed_token payload");
  }

  const payload = raw as SnapshotSealPayload;

  if (
    payload.v !== 1 ||
    payload.type !== "snapshot" ||
    typeof payload.snapshot !== "string" ||
    typeof payload.exp !== "number"
  ) {
    throw new AppError(401, "invalid_sealed_token", "Invalid sealed_token payload");
  }

  return payload;
}

function stablePayloadString(payload: SnapshotSealPayload): string {
  return JSON.stringify({
    v: payload.v,
    type: payload.type,
    snapshot: payload.snapshot,
    exp: payload.exp
  });
}

function parseGitHubTokenPayload(value: string): GitHubTokenSealPayload {
  let raw: unknown;

  try {
    raw = JSON.parse(value);
  } catch {
    throw new AppError(401, "invalid_sealed_github_token", "Invalid sealed_github_token payload");
  }

  if (!raw || typeof raw !== "object") {
    throw new AppError(401, "invalid_sealed_github_token", "Invalid sealed_github_token payload");
  }

  const payload = raw as GitHubTokenSealPayload;

  if (
    payload.v !== 1 ||
    payload.type !== "github_token" ||
    typeof payload.snapshot !== "string" ||
    typeof payload.repo !== "string" ||
    typeof payload.token !== "string" ||
    typeof payload.exp !== "number"
  ) {
    throw new AppError(401, "invalid_sealed_github_token", "Invalid sealed_github_token payload");
  }

  return payload;
}

function stableGitHubTokenPayloadString(payload: GitHubTokenSealPayload): string {
  return JSON.stringify({
    v: payload.v,
    type: payload.type,
    snapshot: payload.snapshot,
    repo: payload.repo,
    token: payload.token,
    exp: payload.exp
  });
}

function base64UrlEncodeText(value: string): string {
  return base64UrlEncodeBytes(encoder.encode(value));
}

function base64UrlDecodeText(value: string): string {
  const bytes = base64UrlDecodeBytes(value);
  return decoder.decode(bytes);
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = "";

  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecodeBytes(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function bufferSourceFromBytes(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}
