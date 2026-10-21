import { timingSafeEqual } from "crypto";

// Who may use the MCP server. MCP_ADMIN_USERS is a JSON array, one entry per person:
//   [{"name":"Jane Doe","email":"jane@example.com","role":"write","token":"<optional, 64 hex>"}]
// An email lets the person sign in on /oauth/authorize (see mcp-oauth.ts). A token is optional,
// for apps that can only send a fixed header (Claude Code, a Claude.ai org connector).
// Roles: "read" (look only), "edit" (prepare changes, no publishing), "write" (everything).
// "admin" is accepted as "write". Removing someone is one env var edit plus a redeploy.

export type McpRole = "read" | "edit" | "write";

export interface McpUser {
  name: string;
  email: string;
  role: McpRole;
}

interface McpUserEntry extends McpUser {
  token: string;
}

const MIN_TOKEN_LENGTH = 32;

function normalizeRole(role: unknown): McpRole | null {
  if (role === "read" || role === "edit" || role === "write") return role;
  if (role === "admin") return "write";
  return null;
}

export function parseMcpUsers(raw: string | undefined): McpUserEntry[] {
  if (!raw || !raw.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("MCP_ADMIN_USERS is not valid JSON - nobody can sign in");
    return [];
  }
  if (!Array.isArray(parsed)) {
    console.error("MCP_ADMIN_USERS must be a JSON array - nobody can sign in");
    return [];
  }
  const users: McpUserEntry[] = [];
  parsed.forEach((entry, i) => {
    const e = entry as Record<string, unknown>;
    const role = normalizeRole(e?.role);
    const token = typeof e?.token === "string" ? e.token.trim() : "";
    const name = typeof e?.name === "string" ? e.name.trim() : "";
    const email = typeof e?.email === "string" ? e.email.trim() : "";
    const tokenOk = token === "" || token.length >= MIN_TOKEN_LENGTH;
    if (!name || !role || !tokenOk || (!token && !email)) {
      console.error(
        `MCP_ADMIN_USERS entry ${i} skipped: needs name, a role of read/edit/write, and an email or a token of at least ${MIN_TOKEN_LENGTH} characters`,
      );
      return;
    }
    users.push({ name, email, role, token });
  });
  return users;
}

function tokensMatch(candidate: string, expected: string): boolean {
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isMcpAuthConfigured(): boolean {
  return parseMcpUsers(process.env.MCP_ADMIN_USERS).length > 0;
}

export function authenticateMcpToken(candidate: string | null | undefined): McpUser | null {
  const token = (candidate ?? "").trim();
  if (!token) return null;
  const users = parseMcpUsers(process.env.MCP_ADMIN_USERS);
  // No early exit, so response time doesn't reveal which entry matched.
  let match: McpUserEntry | null = null;
  for (const user of users) {
    if (user.token && tokensMatch(token, user.token) && !match) match = user;
  }
  return match ? { name: match.name, email: match.email, role: match.role } : null;
}

export function findMcpUserByEmail(email: string): McpUser | null {
  const wanted = email.trim().toLowerCase();
  if (!wanted) return null;
  const user = parseMcpUsers(process.env.MCP_ADMIN_USERS).find((u) => u.email.toLowerCase() === wanted);
  return user ? { name: user.name, email: user.email, role: user.role } : null;
}

export function bearerFromRequest(req: Request): string {
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

// Anything not listed here needs at least "edit", and WRITE_ONLY_TOOLS need "write",
// so a newly added tool is never accidentally open to read-only users.
export const READ_ONLY_TOOLS = new Set([
  "get_project_rules",
  "list_pending_changes",
  "check_deploy",
  "github_list_dir",
  "github_read_file",
  "check_code_quality",
  "check_pr_status",
  "get_check_log_excerpt",
]);

export const WRITE_ONLY_TOOLS = new Set(["publish_changes"]);

export function canUseTool(role: McpRole, tool: string): boolean {
  if (READ_ONLY_TOOLS.has(tool)) return true;
  if (role === "read") return false;
  if (WRITE_ONLY_TOOLS.has(tool)) return role === "write";
  return true;
}
