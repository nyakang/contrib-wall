import { AppError, type Env } from "./types";

export function getKv(env: Env): KVNamespace {
  const kv = env.kv || env.CONTRIB_CACHE;

  if (!kv) {
    throw new AppError(
      500,
      "kv_binding_missing",
      "KV binding is missing. Please bind a KV namespace with name: kv",
      false
    );
  }

  return kv;
}

export function getAssets(env: Env): Fetcher | undefined {
  return env.assets || env.ASSETS;
}
