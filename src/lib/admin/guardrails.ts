// Files the MCP tools may never write, whatever is asked: secrets, dependencies, CI, deploy
// settings, and the editing system's own code and sign-in (so an agent can't weaken its own
// gate). Checked on every read/write/delete tool call.
const DENYLIST_PATTERNS: RegExp[] = [
  /^\.env(\..*)?$/i,
  /^package(-lock)?\.json$/i,
  // Holds the site-wide noindex header the author asked to keep (AGENTS.md).
  /^vercel\.json$/i,
  /^\.mcp\.json$/i,
  /^\.github\//i,
  /^\.git\//i,
  /^src\/lib\/admin\//i,
  /^src\/app\/api\//i,
  /^src\/app\/oauth\//i,
  /^src\/app\/\.well-known\//i,
];

// Denylisted files that hold no secrets, so they may be read (never written) for debugging.
const READ_ONLY_PATTERNS: RegExp[] = [/^package\.json$/i, /^vercel\.json$/i, /^\.github\/workflows\/[^/]+\.ya?ml$/i];

function normalizePath(path: string): string {
  return path.replace(/^\/+/, "");
}

export function isPathDenied(path: string): boolean {
  const normalized = normalizePath(path);
  return DENYLIST_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isPathReadDenied(path: string): boolean {
  const normalized = normalizePath(path);
  return isPathDenied(normalized) && !READ_ONLY_PATTERNS.some((pattern) => pattern.test(normalized));
}

// Accepts the forms models tend to send ("./src/x", "\"src/x\"", "root") and returns a clean
// repo-relative path ("" for the root).
export function normalizeRepoPath(raw: unknown): string {
  let p = String(raw ?? "").trim();
  while (p.length >= 2 && ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'")))) {
    p = p.slice(1, -1).trim();
  }
  p = p.replace(/^\.?\/+/, "").replace(/\/+$/, "");
  if (p === "." || p === "/" || p.toLowerCase() === "root") return "";
  return p;
}
