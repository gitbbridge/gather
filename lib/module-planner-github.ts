export const GATHER_GITHUB_OWNER = "gitbbridge";
export const GATHER_GITHUB_REPOSITORY = "gather";
export const GATHER_GITHUB_URL = `https://github.com/${GATHER_GITHUB_OWNER}/${GATHER_GITHUB_REPOSITORY}`;

export type GithubModule = { id: string; moduleCode: string };
export type GithubActivityInput = {
  eventType: "commit" | "pull_request_open" | "pull_request_merged";
  externalId: string;
  sha?: string | null;
  title: string;
  author: string;
  url: string;
  occurredAt: number;
  changedFiles: string[];
  pullRequestNumber?: number | null;
  matchedModuleId?: string | null;
  matchMethod?: string | null;
};

type GithubCommit = {
  sha: string;
  html_url: string;
  commit: { message: string; author: { name: string; date: string } | null };
  author: { login: string } | null;
};

type GithubPullRequest = {
  id: number;
  number: number;
  state: string;
  merged_at: string | null;
  updated_at: string;
  title: string;
  html_url: string;
  user: { login: string } | null;
  head: { sha: string };
};

export class GithubSyncError extends Error {
  status: number;
  rateLimitRemaining: number | null;
  constructor(message: string, status: number, rateLimitRemaining: number | null) {
    super(message);
    this.status = status;
    this.rateLimitRemaining = rateLimitRemaining;
  }
}

function headers() {
  const result: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "gather-module-planner",
  };
  const token = process.env.GITHUB_READ_TOKEN?.trim();
  if (token) result.Authorization = `Bearer ${token}`;
  return result;
}

async function github<T>(path: string) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: headers(),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const remaining = Number(response.headers.get("x-ratelimit-remaining"));
  if (!response.ok) {
    let detail = "GitHub could not complete this request.";
    try { detail = String((await response.json() as { message?: string }).message || detail); } catch { /* response was not JSON */ }
    if (response.status === 403 && remaining === 0) detail = "GitHub API rate limit reached. Configure a repository-scoped read token or wait for the limit to reset.";
    throw new GithubSyncError(detail, response.status, Number.isFinite(remaining) ? remaining : null);
  }
  return {
    data: await response.json() as T,
    rateLimitRemaining: Number.isFinite(remaining) ? remaining : null,
  };
}

export function exactModuleAssociation(text: string, modules: GithubModule[]) {
  const normalized = text.toUpperCase();
  const matches = modules.filter((module) => new RegExp(`(^|[^A-Z0-9-])${escapeRegex(module.moduleCode.toUpperCase())}([^A-Z0-9-]|$)`).test(normalized));
  return matches.length === 1 ? { moduleId: matches[0].id, method: "exact_task_identifier" } : null;
}

export function githubReferenceUrl(linkType: string, reference: string) {
  const cleaned = reference.trim().replace(/^\/+/, "");
  if (!cleaned) return null;
  const base = GATHER_GITHUB_URL;
  if (linkType === "file" || linkType === "directory") return `${base}/tree/main/${cleaned}`;
  if (linkType === "commit" && /^[a-f0-9]{7,40}$/i.test(cleaned)) return `${base}/commit/${cleaned}`;
  if (linkType === "pull_request" && /^\d+$/.test(cleaned)) return `${base}/pull/${cleaned}`;
  if (linkType === "issue" && /^\d+$/.test(cleaned)) return `${base}/issues/${cleaned}`;
  if (linkType === "branch") return `${base}/tree/${encodeURIComponent(cleaned)}`;
  if (linkType === "release") return `${base}/releases/tag/${encodeURIComponent(cleaned)}`;
  return null;
}

export async function synchronizeGatherGithub(branch: string, modules: GithubModule[]) {
  const repository = await github<{ default_branch: string; html_url: string; pushed_at: string }>(`/repos/${GATHER_GITHUB_OWNER}/${GATHER_GITHUB_REPOSITORY}`);
  const trackedBranch = branch || repository.data.default_branch;
  const commits = await github<GithubCommit[]>(`/repos/${GATHER_GITHUB_OWNER}/${GATHER_GITHUB_REPOSITORY}/commits?sha=${encodeURIComponent(trackedBranch)}&per_page=30`);
  const pulls = await github<GithubPullRequest[]>(`/repos/${GATHER_GITHUB_OWNER}/${GATHER_GITHUB_REPOSITORY}/pulls?state=all&sort=updated&direction=desc&per_page=30`);
  let remaining = pulls.rateLimitRemaining ?? commits.rateLimitRemaining ?? repository.rateLimitRemaining;
  const activities: GithubActivityInput[] = [];
  for (const [index, commit] of commits.data.entries()) {
    const association = exactModuleAssociation(commit.commit.message, modules);
    let changedFiles: string[] = [];
    if (association || index < 5) {
      const detail = await github<{ files?: Array<{ filename: string }> }>(`/repos/${GATHER_GITHUB_OWNER}/${GATHER_GITHUB_REPOSITORY}/commits/${commit.sha}`);
      changedFiles = (detail.data.files || []).map((file) => file.filename).slice(0, 100);
      remaining = detail.rateLimitRemaining ?? remaining;
    }
    activities.push({
      eventType: "commit",
      externalId: commit.sha,
      sha: commit.sha,
      title: commit.commit.message.split("\n")[0],
      author: commit.author?.login || commit.commit.author?.name || "Unknown",
      url: commit.html_url,
      occurredAt: Date.parse(commit.commit.author?.date || "") || Date.now(),
      changedFiles,
      matchedModuleId: association?.moduleId || null,
      matchMethod: association?.method || null,
    });
  }
  for (const pull of pulls.data) {
    if (pull.state === "closed" && !pull.merged_at) continue;
    const association = exactModuleAssociation(pull.title, modules);
    activities.push({
      eventType: pull.merged_at ? "pull_request_merged" : "pull_request_open",
      externalId: String(pull.id),
      sha: pull.head.sha,
      title: pull.title,
      author: pull.user?.login || "Unknown",
      url: pull.html_url,
      occurredAt: Date.parse(pull.merged_at || pull.updated_at),
      changedFiles: [],
      pullRequestNumber: pull.number,
      matchedModuleId: association?.moduleId || null,
      matchMethod: association?.method || null,
    });
  }
  const latest = commits.data[0] || null;
  return {
    trackedBranch,
    repositoryUrl: repository.data.html_url,
    latest,
    openPullRequests: pulls.data.filter((pull) => pull.state === "open").length,
    activities: activities.sort((a, b) => b.occurredAt - a.occurredAt),
    rateLimitRemaining: remaining,
    authMode: process.env.GITHUB_READ_TOKEN?.trim() ? "repository_token" : "public_read_only",
  };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

