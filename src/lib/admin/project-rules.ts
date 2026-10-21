import * as gh from "@/lib/admin/github-client";

export const RULES_PATH = "AGENTS.md";
export const KNOWLEDGE_BASE_DIR = "docs/ai";

// Tools that change the site. A connected Claude/ChatGPT session can ignore server instructions,
// so these refuse to run until the caller proves it loaded the current rules by echoing back the
// rulesVersion from get_project_rules. Stateless: the proof travels with each call.
export const RULES_GATED_TOOLS = new Set([
  "github_write_file",
  "github_delete_file",
  "start_change",
  "confirm_change",
  "submit_for_review",
  "publish_changes",
  "discard_change",
]);

export const RULES_VERSION_PARAM = "rules_version";

const CACHE_TTL_MS = 5 * 60 * 1000;
let cached: { version: string; content: string; at: number } | null = null;

export function versionFromSha(sha: string): string {
  return sha.slice(0, 10);
}

// Read live from the default branch, so editing AGENTS.md changes the version once published and
// every connected session has to re-read the rules.
export async function getProjectRules(): Promise<{ version: string; content: string }> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached;
  const branch = await gh.getDefaultBranch();
  const file = await gh.getFile(RULES_PATH, branch);
  if (!file) throw new Error(`${RULES_PATH} not found on ${branch}`);
  cached = { version: versionFromSha(file.sha), content: file.content, at: Date.now() };
  return cached;
}

export async function listKnowledgeBase(): Promise<string[]> {
  const branch = await gh.getDefaultBranch();
  const entries = await gh.listDir(KNOWLEDGE_BASE_DIR, branch);
  return entries.filter((e) => e.type === "file" && e.path.endsWith(".md")).map((e) => e.path);
}

export function rulesVersionError(provided: unknown, current: string): string | null {
  if (typeof provided !== "string" || provided.trim() === "") {
    return `Blocked: call get_project_rules first, read and follow the rules it returns, then retry this call with ${RULES_VERSION_PARAM} set to its rulesVersion.`;
  }
  if (provided.trim() !== current) {
    return `Blocked: the project rules changed since you read them (you sent ${provided.trim()}, current is ${current}). Call get_project_rules again, re-read the rules, then retry with the new ${RULES_VERSION_PARAM}.`;
  }
  return null;
}

type JsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
};

export function withRulesVersionParam<T extends JsonSchema>(schema: T): T & { required: string[] } {
  return {
    ...schema,
    properties: {
      ...schema.properties,
      [RULES_VERSION_PARAM]: {
        type: "string",
        description:
          "The rulesVersion returned by get_project_rules. Required: proves the project rules (AGENTS.md) were read this conversation.",
      },
    },
    // A duplicate in "required" makes the schema invalid, and ChatGPT then drops the whole app.
    required: [...(schema.required ?? []).filter((k) => k !== RULES_VERSION_PARAM), RULES_VERSION_PARAM],
  };
}
