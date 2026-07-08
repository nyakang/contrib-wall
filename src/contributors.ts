import { fetchGitHubContributors } from "./github";
import { MANUAL_CONTRIBUTORS } from "./manual-contributors";
import type { Contributor, Env, ImageOptions, ManualContributor, ParsedRepo } from "./types";

export async function getContributorsForSnapshot(
  env: Env,
  options: ImageOptions,
  githubToken: string
): Promise<Contributor[]> {
  if (options.mode === "manual") {
    return normalizeManualContributors(options.repo);
  }

  const githubContributors = await fetchGitHubContributors(env, options.repo, options.anon, githubToken);

  if (options.mode === "github") {
    return githubContributors;
  }

  return mergeContributors(githubContributors, normalizeManualContributors(options.repo));
}

function normalizeManualContributors(repo: ParsedRepo): Contributor[] {
  const manual = MANUAL_CONTRIBUTORS[repo.fullName] || [];

  return manual.map((item) => normalizeManualContributor(item));
}

function normalizeManualContributor(item: ManualContributor): Contributor {
  return {
    login: item.login,
    avatarUrl: item.avatarUrl || `https://github.com/${encodeURIComponent(item.login)}.png`,
    profileUrl: item.profileUrl || `https://github.com/${encodeURIComponent(item.login)}`,
    contributions: item.contributions,
    roles: item.roles,
    note: item.note,
    source: "manual"
  };
}

function mergeContributors(githubContributors: Contributor[], manualContributors: Contributor[]): Contributor[] {
  const result: Contributor[] = [];
  const indexByLogin = new Map<string, number>();

  for (const contributor of githubContributors) {
    indexByLogin.set(contributor.login.toLowerCase(), result.length);
    result.push(contributor);
  }

  for (const manual of manualContributors) {
    const key = manual.login.toLowerCase();
    const existingIndex = indexByLogin.get(key);

    if (existingIndex == null) {
      indexByLogin.set(key, result.length);
      result.push(manual);
      continue;
    }

    const existing = result[existingIndex];
    result[existingIndex] = {
      ...existing,
      ...manual,
      contributions: existing.contributions ?? manual.contributions,
      source: "mixed"
    };
  }

  return result;
}
