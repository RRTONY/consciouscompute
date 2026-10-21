// Thin fetch-based wrapper around GitHub's REST API (no @octokit dependency).
//
// Owner/repo are hardcoded constants, never accepted as a parameter from any caller, so a
// prompt-injected instruction can't redirect a write to a different repository.
const OWNER = "RRTONY";
const REPO = "consciouscompute";
const API = "https://api.github.com";

export const GITHUB_REPO = { owner: OWNER, repo: REPO };

function token(): string {
  const t = process.env.GITHUB_TOKEN;
  if (!t) throw new Error("GITHUB_TOKEN is not set");
  return t;
}

class GitHubApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function gh<T = unknown>(path: string, init: RequestInit = {}): Promise<T | null> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GitHubApiError(res.status, `GitHub ${init.method || "GET"} ${path} -> ${res.status}: ${body.slice(0, 300)}`);
  }
  if (res.status === 204) return null;
  return (await res.json()) as T;
}

const repoPath = (rest: string) => `/repos/${OWNER}/${REPO}${rest}`;

export function isNotFound(err: unknown): boolean {
  return err instanceof GitHubApiError && err.status === 404;
}

export function errorStatus(err: unknown): number | null {
  return err instanceof GitHubApiError ? err.status : null;
}

// ── Files ──────────────────────────────────────────────────────────────────────

export interface FileContent {
  content: string;
  sha: string;
}

export async function getFile(path: string, ref: string): Promise<FileContent | null> {
  try {
    const data = await gh<{ content: string; sha: string; type: string }>(
      repoPath(`/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`),
    );
    if (!data || data.type !== "file") return null;
    return { content: Buffer.from(data.content, "base64").toString("utf-8"), sha: data.sha };
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export interface DirEntry {
  path: string;
  type: "file" | "dir";
  size: number;
}

export async function listDir(path: string, ref: string): Promise<DirEntry[]> {
  // The repo root is `/contents` with no trailing segment.
  const segment = path ? `/${encodeURI(path)}` : "";
  const data = await gh<
    Array<{ path: string; type: string; size: number }> | { path: string; type: string; size: number }
  >(repoPath(`/contents${segment}?ref=${encodeURIComponent(ref)}`));
  const arr = Array.isArray(data) ? data : data ? [data] : [];
  return arr.map((e) => ({ path: e.path, type: e.type === "dir" ? "dir" : "file", size: e.size }));
}

export async function putFile(path: string, content: string, message: string, branch: string): Promise<void> {
  const existing = await getFile(path, branch);
  await gh(repoPath(`/contents/${encodeURI(path)}`), {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf-8").toString("base64"),
      branch,
      ...(existing ? { sha: existing.sha } : {}),
    }),
  });
}

export async function deleteFile(path: string, message: string, branch: string): Promise<void> {
  const existing = await getFile(path, branch);
  if (!existing) throw new Error(`${path} does not exist on ${branch}, nothing to delete`);
  await gh(repoPath(`/contents/${encodeURI(path)}`), {
    method: "DELETE",
    body: JSON.stringify({ message, sha: existing.sha, branch }),
  });
}

// ── Branches ───────────────────────────────────────────────────────────────────

let cachedDefaultBranch: string | null = null;

// Don't assume "main": resolve and cache the repo's actual default branch.
export async function getDefaultBranch(): Promise<string> {
  if (cachedDefaultBranch) return cachedDefaultBranch;
  const repo = await gh<{ default_branch: string }>(repoPath(""));
  cachedDefaultBranch = repo?.default_branch || "main";
  return cachedDefaultBranch;
}

export async function getBranchSha(branch: string): Promise<string> {
  const ref = await gh<{ object: { sha: string } }>(repoPath(`/git/ref/heads/${encodeURIComponent(branch)}`));
  if (!ref) throw new Error(`Could not resolve ${branch}`);
  return ref.object.sha;
}

// A new branch off the default branch carrying one empty commit, so a pull request (which holds
// the change record) can be opened before any file is edited. The squash merge drops it.
export async function createChangeBranch(branch: string, message: string): Promise<void> {
  const baseSha = await getBranchSha(await getDefaultBranch());
  const base = await gh<{ tree: { sha: string } }>(repoPath(`/git/commits/${baseSha}`));
  if (!base) throw new Error("Could not read the live site's latest version");
  const commit = await gh<{ sha: string }>(repoPath("/git/commits"), {
    method: "POST",
    body: JSON.stringify({ message, tree: base.tree.sha, parents: [baseSha] }),
  });
  if (!commit) throw new Error("Could not start the change");
  await gh(repoPath("/git/refs"), {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }),
  });
}

export async function deleteBranch(branch: string): Promise<void> {
  await gh(repoPath(`/git/refs/heads/${encodeURIComponent(branch)}`), { method: "DELETE" });
}

export interface CompareResult {
  files: Array<{ path: string; status: string; additions: number; deletions: number }>;
  aheadBy: number;
}

export async function compareToDefaultBranch(branch: string): Promise<CompareResult> {
  const base = await getDefaultBranch();
  const data = await gh<{
    ahead_by: number;
    files?: Array<{ filename: string; status: string; additions: number; deletions: number }>;
  }>(repoPath(`/compare/${base}...${encodeURIComponent(branch)}`));
  return {
    aheadBy: data?.ahead_by ?? 0,
    files: (data?.files || []).map((f) => ({
      path: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
    })),
  };
}

// ── Pull requests ──────────────────────────────────────────────────────────────

export interface PullRequest {
  number: number;
  url: string;
  title: string;
  body: string;
  branch: string;
  headSha: string;
  open: boolean;
  merged: boolean;
  createdAt: string;
  closedAt: string | null;
  mergedAt: string | null;
}

interface RawPR {
  number: number;
  html_url: string;
  title: string;
  body: string | null;
  state: string;
  merged?: boolean;
  merged_at: string | null;
  closed_at: string | null;
  created_at: string;
  head: { ref: string; sha: string };
}

function toPR(pr: RawPR): PullRequest {
  return {
    number: pr.number,
    url: pr.html_url,
    title: pr.title,
    body: pr.body ?? "",
    branch: pr.head.ref,
    headSha: pr.head.sha,
    open: pr.state === "open",
    merged: !!pr.merged || !!pr.merged_at,
    createdAt: pr.created_at,
    closedAt: pr.closed_at,
    mergedAt: pr.merged_at,
  };
}

export async function openPR(branch: string, title: string, body: string): Promise<PullRequest> {
  const base = await getDefaultBranch();
  const pr = await gh<RawPR>(repoPath("/pulls"), {
    method: "POST",
    body: JSON.stringify({ title, head: branch, base, body }),
  });
  if (!pr) throw new Error("Opening the change returned no data");
  return toPR(pr);
}

export async function getPR(prNumber: number): Promise<PullRequest | null> {
  try {
    const pr = await gh<RawPR>(repoPath(`/pulls/${prNumber}`));
    return pr ? toPR(pr) : null;
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export async function findPRForBranch(branch: string): Promise<PullRequest | null> {
  const prs = await gh<RawPR[]>(repoPath(`/pulls?state=all&head=${OWNER}:${encodeURIComponent(branch)}&per_page=5`));
  const pr = (prs || [])[0];
  return pr ? getPR(pr.number) : null;
}

export async function listPRs(state: "open" | "closed", branchPrefix: string, limit = 100): Promise<PullRequest[]> {
  const base = await getDefaultBranch();
  const prs = await gh<RawPR[]>(
    repoPath(`/pulls?state=${state}&base=${base}&sort=created&direction=desc&per_page=${Math.min(limit, 100)}`),
  );
  return (prs || []).filter((pr) => pr.head.ref.startsWith(branchPrefix)).map(toPR);
}

export async function updatePRBody(prNumber: number, body: string): Promise<void> {
  await gh(repoPath(`/pulls/${prNumber}`), { method: "PATCH", body: JSON.stringify({ body }) });
}

export async function closePR(prNumber: number): Promise<void> {
  await gh(repoPath(`/pulls/${prNumber}`), { method: "PATCH", body: JSON.stringify({ state: "closed" }) });
}

// expectedHeadSha makes GitHub refuse the merge if anything was added after the review.
export async function mergePR(
  prNumber: number,
  expectedHeadSha: string,
  commitTitle: string,
): Promise<{ merged: boolean; sha: string }> {
  const result = await gh<{ merged: boolean; sha: string }>(repoPath(`/pulls/${prNumber}/merge`), {
    method: "PUT",
    body: JSON.stringify({ merge_method: "squash", sha: expectedHeadSha, commit_title: commitTitle }),
  });
  if (!result) throw new Error("Merge returned no data");
  return result;
}

// ── Checks and previews ────────────────────────────────────────────────────────

export type CheckState = "success" | "pending" | "failure" | "unknown";

export interface FailingCheck {
  id: number;
  name: string;
  url: string | null;
}

export interface ChecksDetail {
  // Vercel's preview build (its "Vercel" commit status).
  build: CheckState;
  // GitHub Actions jobs (type check, lint, build).
  ci: CheckState;
  ciWaiting: string[];
  ciFailing: string[];
  failingChecks: FailingCheck[];
  previewUrl: string | null;
  buildUrl: string | null;
}

function combine(states: CheckState[]): CheckState {
  if (!states.length) return "unknown";
  if (states.includes("failure")) return "failure";
  if (states.includes("pending")) return "pending";
  return "success";
}

function statusState(state: string): CheckState {
  return state === "success" ? "success" : state === "pending" ? "pending" : "failure";
}

// Vercel's own check run only carries comments/feedback, not the build result.
const VERCEL_RUN = /^Vercel/;
// Branch preview hosts for this project only, e.g. consciouscompute-git-<branch>-<team>.vercel.app.
const PREVIEW_HOST = /consciouscompute-[a-z0-9-]+\.vercel\.app/;

export function findPreviewUrl(texts: string[]): string | null {
  for (const text of texts) {
    const match = text.match(PREVIEW_HOST);
    if (match) return `https://${match[0]}/`;
  }
  return null;
}

export async function getChecksDetail(headSha: string, prNumber: number | null): Promise<ChecksDetail> {
  const [status, runs, comments] = await Promise.all([
    gh<{ statuses?: Array<{ context: string; state: string; target_url: string | null }> }>(
      repoPath(`/commits/${headSha}/status`),
    ).catch(() => null),
    gh<{
      check_runs: Array<{
        id: number;
        name: string;
        status: string;
        conclusion: string | null;
        html_url: string;
        output?: { summary?: string | null };
      }>;
    }>(repoPath(`/commits/${headSha}/check-runs`)).catch(() => null),
    prNumber
      ? gh<Array<{ body: string }>>(repoPath(`/issues/${prNumber}/comments`)).catch(() => null)
      : Promise.resolve(null),
  ]);

  const buildStates: CheckState[] = [];
  const ciStates: CheckState[] = [];
  let buildUrl: string | null = null;
  for (const st of status?.statuses ?? []) {
    if (st.context.startsWith("Vercel")) {
      buildStates.push(statusState(st.state));
      buildUrl = st.target_url;
    } else {
      ciStates.push(statusState(st.state));
    }
  }

  const ciWaiting: string[] = [];
  const ciFailing: string[] = [];
  const failingChecks: FailingCheck[] = [];
  const previewTexts: string[] = [];
  for (const run of runs?.check_runs ?? []) {
    if (VERCEL_RUN.test(run.name)) {
      if (run.output?.summary) previewTexts.push(run.output.summary);
      continue;
    }
    if (run.status !== "completed") {
      ciStates.push("pending");
      ciWaiting.push(run.name);
    } else if (["success", "neutral", "skipped"].includes(run.conclusion ?? "")) {
      ciStates.push("success");
    } else {
      ciStates.push("failure");
      ciFailing.push(run.name);
      failingChecks.push({ id: run.id, name: run.name, url: run.html_url });
    }
  }
  for (const c of comments ?? []) previewTexts.push(c.body);

  return {
    build: combine(buildStates),
    ci: combine(ciStates),
    ciWaiting,
    ciFailing,
    failingChecks,
    previewUrl: findPreviewUrl(previewTexts),
    buildUrl,
  };
}

// GitHub Actions logs run to hundreds of KB, but the error is almost always at the end.
const LOG_TAIL_LINES = 200;
const LOG_TAIL_MAX_CHARS = 8000;

export function truncateLogTail(text: string): string {
  const tail = text.split("\n").slice(-LOG_TAIL_LINES).join("\n");
  return tail.length > LOG_TAIL_MAX_CHARS ? tail.slice(-LOG_TAIL_MAX_CHARS) : tail;
}

// Plain text (GitHub redirects to a signed log URL), so this can't use gh().
export async function getFailingCheckLogExcerpt(checkRunId: number): Promise<string> {
  const res = await fetch(`${API}${repoPath(`/actions/jobs/${checkRunId}/logs`)}`, {
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) throw new GitHubApiError(res.status, `Failed to fetch log for check run ${checkRunId} (${res.status})`);
  return truncateLogTail(await res.text());
}

export interface CommitSummary {
  sha: string;
  message: string;
  date: string;
}

export async function recentCommits(branch: string, limit: number): Promise<CommitSummary[]> {
  const commits = await gh<Array<{ sha: string; commit: { message: string; committer: { date: string } } }>>(
    repoPath(`/commits?sha=${encodeURIComponent(branch)}&per_page=${limit}`),
  );
  return (commits || []).map((c) => ({
    sha: c.sha,
    message: c.commit.message.split("\n")[0],
    date: c.commit.committer.date,
  }));
}
