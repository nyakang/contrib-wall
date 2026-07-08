import { getGitHubApiBase, getServiceName } from "./config";
import { AppError, type Contributor, type Env, type ParsedRepo } from "./types";

interface GitHubContributorResponse {
  login?: string;
  name?: string;
  email?: string;
  avatar_url?: string;
  html_url?: string;
  contributions?: number;
}

export async function fetchGitHubContributors(
  env: Env,
  repo: ParsedRepo,
  anon: boolean,
  githubToken: string
): Promise<Contributor[]> {
  const apiBase = getGitHubApiBase(env);
  const requestUrl = new URL(`${apiBase}/repos/${repo.owner}/${repo.repo}/contributors`);
  requestUrl.searchParams.set("per_page", "100");

  if (anon) {
    requestUrl.searchParams.set("anon", "1");
  }

  const response = await fetch(requestUrl.toString(), {
    method: "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${githubToken}`,
      "User-Agent": getServiceName(env),
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });

  if (!response.ok) {
    const message = await safeReadError(response);

    if (response.status === 401) {
      throw new AppError(401, "github_token_invalid", "GitHub Token is invalid or expired");
    }

    if (response.status === 404) {
      throw new AppError(
        404,
        "repo_not_found_or_no_access",
        `Repository not found or token has no access: ${repo.fullName}`
      );
    }

    if (response.status === 403 || response.status === 429) {
      throw new AppError(
        503,
        "github_rate_limited",
        `GitHub API rate limited or forbidden for this token. ${message}`
      );
    }

    throw new AppError(
      502,
      "github_api_error",
      `GitHub API request failed with status ${response.status}. ${message}`
    );
  }

  const raw = (await response.json()) as GitHubContributorResponse[];

  return raw
    .map((item): Contributor | null => {
      const login = item.login || item.name || item.email;
      if (!login) return null;

      return {
        login,
        avatarUrl: item.avatar_url || `https://github.com/${encodeURIComponent(login)}.png`,
        profileUrl: item.html_url || `https://github.com/${encodeURIComponent(login)}`,
        contributions: item.contributions,
        source: "github"
      };
    })
    .filter((item): item is Contributor => Boolean(item));
}

async function safeReadError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text) return "";
    return text.slice(0, 300);
  } catch {
    return "";
  }
}
