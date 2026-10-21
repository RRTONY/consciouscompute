import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
import * as gh from "@/lib/admin/github-client";
import { READ_ONLY_TOOLS, canUseTool, type McpUser } from "@/lib/admin/mcp-auth";
import { isPathDenied, isPathReadDenied, normalizeRepoPath } from "@/lib/admin/guardrails";
import { checkCode } from "@/lib/admin/code-check";
import {
  APPLIES_TO_LABELS,
  normalizeAppliesTo,
  normalizeChangeKey,
  normalizeConversationUrl,
  type BeforeAfter,
} from "@/lib/admin/change-record";
import {
  buildReview,
  confirmChange,
  createChange,
  discardChange,
  getChange,
  isOpen,
  listOpenChanges,
  markEdited,
  otherPendingText,
  pendingRows,
  publishChange,
  submitForReview,
  type Change,
} from "@/lib/admin/changes";
import {
  RULES_GATED_TOOLS,
  RULES_PATH,
  RULES_VERSION_PARAM,
  getProjectRules,
  listKnowledgeBase,
  rulesVersionError,
  withRulesVersionParam,
} from "@/lib/admin/project-rules";
import { PENDING_CHANGES_HTML, PENDING_CHANGES_UI_URI } from "@/lib/admin/mcp-ui-widget";

// MIME type the MCP Apps extension expects for an interactive UI resource.
const MCP_APP_MIME_TYPE = "text/html;profile=mcp-app";

const CHANGE_ID_PARAM = "change_id";

interface ToolSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
}

interface ToolDef {
  name: string;
  description: string;
  input_schema: ToolSchema;
  _meta?: Record<string, unknown>;
}

const changeIdSchema = (description: string) => ({ type: "string", description });

const TOOLS: ToolDef[] = [
  {
    name: "get_project_rules",
    description:
      "CALL THIS FIRST, before anything else in a conversation. Returns the Conscious Compute project rules (AGENTS.md: workflow, plain-language style, the author's sign-off rules for the paper's wording, coding patterns, review checklist, testing rules, and the Status Report format every reply must end with), the list of background notes in docs/ai/, and a rulesVersion. Every tool that changes the site requires that rulesVersion as its rules_version argument and refuses to run without it. Read the rules fully and follow them for the rest of the conversation.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "start_change",
    description:
      "Start a new, separate change for ONE request from the person (e.g. 'fix the typo in section 3'). Returns a change_id. Every edit for this request (github_write_file, github_delete_file) must pass this change_id, so each request is kept apart and publishing it never takes any other request live. Start a new change for each new request; keep using the same change_id for follow-up tweaks to the same request. If the request is at all unclear, set needs_confirmation: the card then shows the person 'I understand your request as: ...' and every edit is refused until they say yes (confirm_change). Any change to the paper's wording needs the author's sign-off before it is published (AGENTS.md).",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short plain-English name, e.g. 'Fix typo in section 3'." },
        request: { type: "string", description: "What the person asked for, in their words." },
        understood_as: {
          type: "string",
          description: "One or two plain sentences saying exactly what you will change and where.",
        },
        applies_to: {
          type: "string",
          enum: ["both", "desktop", "mobile"],
          description: "Where the change should show. Default 'both'. Use desktop or mobile only when the person said so.",
        },
        conversation_url: {
          type: "string",
          description:
            "Optional: a link to this chat (a chatgpt.com or claude.ai share link) if the person gave you one. Never make one up.",
        },
        needs_confirmation: {
          type: "boolean",
          description:
            "true when the request could mean more than one thing, uses loose words (box, section, header...), or you had to guess. false only when it names exactly what to change.",
        },
      },
      required: ["title", "request", "understood_as", "needs_confirmation"],
    },
    _meta: { ui: { resourceUri: PENDING_CHANGES_UI_URI } },
  },
  {
    name: "confirm_change",
    description:
      "Record the person's YES to what you understood for a change that is 'Waiting for your OK'. Only call it after they clearly agreed (the card's Yes button calls it too). If they said you got it wrong, don't call this: discard_change and start_change again.",
    input_schema: {
      type: "object",
      properties: {
        [CHANGE_ID_PARAM]: changeIdSchema("The change to confirm."),
        applies_to: {
          type: "string",
          enum: ["both", "desktop", "mobile"],
          description: "Optional: the person's choice. Default keeps the current one.",
        },
      },
      required: [CHANGE_ID_PARAM],
    },
  },
  {
    name: "github_list_dir",
    description: 'List files and folders at a path in the site\'s code. Use "" for the root.',
    input_schema: {
      type: "object",
      properties: { path: { type: "string", description: 'e.g. "src/app". Use "" for the root, not "." or "/".' } },
      required: ["path"],
    },
  },
  {
    name: "github_read_file",
    description:
      "Read a file in the site's code. Always read a file before editing it. The paper's text is in src/app/page.tsx; its tables, use cases and references are in src/lib/paper.ts.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string", description: "e.g. src/app/page.tsx" } },
      required: ["path"],
    },
  },
  {
    name: "github_write_file",
    description:
      "Create or update a file with new content, saved to this change only (never the live site directly). Pass the FULL new file content, not a diff. Call check_code_quality on the content first.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
        message: { type: "string", description: "Short description of the edit." },
      },
      required: ["path", "content", "message"],
    },
  },
  {
    name: "github_delete_file",
    description: "Delete a file, in this change only (never the live site directly). Confirm with the person first.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" }, message: { type: "string" } },
      required: ["path", "message"],
    },
  },
  {
    name: "check_code_quality",
    description:
      "Check proposed file content against this site's house rules BEFORE writing it (design tokens instead of hex colors, next/image, Tailwind instead of inline styles, mobile first, no new libraries, the noindex setting and the Temporary placement notice kept). Fix anything it flags first. Type check, lint and build run automatically on the change afterwards.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "The file path this content is for, e.g. src/app/page.tsx" },
        content: { type: "string" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "check_pr_status",
    description:
      "Current status of the automatic checks on a change (Vercel preview build, and the type check, lint and build in GitHub Actions). Waits up to ~20s for running checks before answering. If it still says pending, call it again; you have no timer of your own. Returns failing checks with an id for get_check_log_excerpt.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_check_log_excerpt",
    description:
      "The end of the log for one failed GitHub check, by its id from check_pr_status or list_pending_changes. Use it to see the real error before fixing.",
    input_schema: {
      type: "object",
      properties: { checkRunId: { type: "number", description: "The id from a failingChecks entry." } },
      required: ["checkRunId"],
    },
  },
  {
    name: "submit_for_review",
    description:
      "Call when the edits for a change are finished and checked. Saves a plain-English summary and marks it 'Ready for review'; only then can it be published. Any later edit sends it back to Draft, so submit again after more edits. Then call list_pending_changes with the same change_id to show the person the review card.",
    input_schema: {
      type: "object",
      properties: {
        [CHANGE_ID_PARAM]: changeIdSchema("The change_id from start_change."),
        summary: {
          type: "string",
          description: "1 to 3 plain sentences: what changed and where. No jargon.",
        },
        before_after: {
          type: "array",
          description:
            "For every visible wording change: what the reader saw before and will see after. Required for paper wording, so the author can sign off on the exact words.",
          items: {
            type: "object",
            properties: { label: { type: "string" }, before: { type: "string" }, after: { type: "string" } },
            required: ["label", "before", "after"],
          },
        },
      },
      required: [CHANGE_ID_PARAM, "summary"],
    },
  },
  {
    name: "list_pending_changes",
    description:
      'Show waiting changes. With a change_id: the full review for that change: ONE state (working, checking, ready, failed, stuck, awaiting_ok, published, discarded) with nextStep, the checks, what will go live, before and after, the preview link, and its reviewToken. The card shows Preview, Discard and Publish (greyed out when not allowed). Without a change_id: every waiting change. Always show the person this review before publishing. Lead your reply with the state and nextStep in one line; don\'t repeat the card. If state is "checking", call it again in a bit.',
    input_schema: {
      type: "object",
      properties: { [CHANGE_ID_PARAM]: changeIdSchema("Optional: the change to review.") },
      required: [],
    },
    _meta: { ui: { resourceUri: PENDING_CHANGES_UI_URI } },
  },
  {
    name: "publish_changes",
    description:
      "Go live with ONE reviewed change, and nothing else. Needs the change_id and the review_token from list_pending_changes; refuses if anything changed since that review, if a check isn't passing, or if the change isn't 'Ready for review'. Before calling, show the person exactly what will go live and get a clear yes: 'You are about to publish this change to the live Conscious Compute website. Are you sure?' Wording changes to the paper need the author's own sign-off.",
    input_schema: {
      type: "object",
      properties: {
        [CHANGE_ID_PARAM]: changeIdSchema("The change to publish."),
        review_token: { type: "string", description: "The reviewToken from list_pending_changes for this change." },
      },
      required: [CHANGE_ID_PARAM, "review_token"],
    },
  },
  {
    name: "discard_change",
    description:
      "Reject a waiting change completely: its edits are thrown away and nothing goes live. Use when the person doesn't want it. Confirm with them first.",
    input_schema: {
      type: "object",
      properties: { [CHANGE_ID_PARAM]: changeIdSchema("The change to discard.") },
      required: [CHANGE_ID_PARAM],
    },
  },
  {
    name: "check_deploy",
    description:
      "Vercel build status in plain words. With a change_id: that change's preview build and link. Without: the live site's latest builds, e.g. to confirm a publish went live. Read-only.",
    input_schema: {
      type: "object",
      properties: { [CHANGE_ID_PARAM]: changeIdSchema("Optional: show this change's preview build instead.") },
      required: [],
    },
  },
];

// Edits must name their change; reads may, to see that change's version instead of the live one.
const CHANGE_REQUIRED_TOOLS = new Set(["github_write_file", "github_delete_file"]);
const CHANGE_ACTION_TOOLS = new Set(["confirm_change", "submit_for_review", "publish_changes", "discard_change"]);
const CHANGE_OPTIONAL_TOOLS = new Set(["github_read_file", "github_list_dir", "check_pr_status"]);

function withChangeIdParam(name: string, schema: ToolSchema): ToolSchema {
  if (CHANGE_REQUIRED_TOOLS.has(name)) {
    return {
      ...schema,
      properties: {
        ...schema.properties,
        [CHANGE_ID_PARAM]: changeIdSchema("The change_id from start_change for the request this edit belongs to."),
      },
      required: [...(schema.required ?? []).filter((k) => k !== CHANGE_ID_PARAM), CHANGE_ID_PARAM],
    };
  }
  if (CHANGE_OPTIONAL_TOOLS.has(name)) {
    return {
      ...schema,
      properties: {
        ...schema.properties,
        [CHANGE_ID_PARAM]: changeIdSchema("Optional: read/check this change's version instead of the live site."),
      },
    };
  }
  return schema;
}

// structuredContent is what MCP Apps hosts hand to the card; the text block is for everything else.
function toResult(output: unknown, isError = false) {
  const isObject = !!output && typeof output === "object" && !Array.isArray(output);
  return {
    content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
    ...(isObject && !isError ? { structuredContent: output as Record<string, unknown> } : {}),
    isError,
  };
}

function fromChangeResult<T extends { ok: boolean }>(result: T) {
  return toResult(result, !result.ok);
}

// Hosts use these to decide when to ask the person before running a tool.
const DESTRUCTIVE_TOOLS = new Set(["github_delete_file", "publish_changes", "discard_change"]);
const OPEN_WORLD_TOOLS = new Set(["publish_changes"]);

function toolAnnotations(name: string) {
  const readOnly = READ_ONLY_TOOLS.has(name);
  return {
    title: name
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
    readOnlyHint: readOnly,
    destructiveHint: !readOnly && DESTRUCTIVE_TOOLS.has(name),
    openWorldHint: OPEN_WORLD_TOOLS.has(name),
  };
}

// ChatGPT extras on top of the MCP Apps keys: status lines while a tool runs, and widgetAccessible
// so the card's buttons may call the tools.
const CHATGPT_TOOL_META: Record<string, Record<string, unknown>> = {
  start_change: {
    "openai/outputTemplate": PENDING_CHANGES_UI_URI,
    "openai/toolInvocation/invoking": "Starting the change…",
    "openai/toolInvocation/invoked": "Change started",
    "openai/widgetAccessible": true,
  },
  confirm_change: {
    "openai/toolInvocation/invoking": "Saving your OK…",
    "openai/toolInvocation/invoked": "Confirmed",
    "openai/widgetAccessible": true,
  },
  list_pending_changes: {
    "openai/outputTemplate": PENDING_CHANGES_UI_URI,
    "openai/toolInvocation/invoking": "Checking waiting website changes…",
    "openai/toolInvocation/invoked": "Changes ready to review",
    "openai/widgetAccessible": true,
  },
  publish_changes: {
    "openai/toolInvocation/invoking": "Publishing to the live site…",
    "openai/toolInvocation/invoked": "Publish finished",
    "openai/widgetAccessible": true,
  },
  discard_change: {
    "openai/toolInvocation/invoking": "Discarding the change…",
    "openai/toolInvocation/invoked": "Change discarded",
    "openai/widgetAccessible": true,
  },
  get_project_rules: {
    "openai/toolInvocation/invoking": "Loading the project rules…",
    "openai/toolInvocation/invoked": "Rules loaded",
  },
};

const SERVER_INSTRUCTIONS = `This server lets you prepare and publish changes to the Conscious Compute website (a working paper).

STEP 1, EVERY CONVERSATION: call get_project_rules before anything else, read the rules it returns in
full, and follow them for the rest of the conversation. They override your defaults. Every tool that
changes the site requires the rulesVersion it returns as the rules_version argument.

STEP 2, EVERY REQUEST: one request = one change. Call start_change, pass its change_id on every edit,
then submit_for_review with a plain summary (and before_after for any wording), then
list_pending_changes with that change_id to show the review card. The person then publishes or
discards THAT change only.

Key rules (details in AGENTS.md): plain, short, jargon-free replies, no em dashes; the paper's wording
belongs to the author and every wording change needs their sign-off before it goes live; keep the
"Temporary placement" notice and noindex/nofollow; Tailwind tokens, mobile first, inline SVG icons;
confirm with the person before publish_changes; end every reply that did work with the Status Report.`;

const WAIT_BUDGET_MS = 20_000;
const WAIT_STEP_MS = 3_000;

async function waitForChecks(headSha: string, prNumber: number) {
  const start = Date.now();
  let detail = await gh.getChecksDetail(headSha, prNumber);
  const done = (s: gh.CheckState) => s === "success" || s === "failure";
  const pending = () => !done(detail.build) || !done(detail.ci);
  while (pending() && Date.now() - start < WAIT_BUDGET_MS) {
    await new Promise((r) => setTimeout(r, WAIT_STEP_MS));
    detail = await gh.getChecksDetail(headSha, prNumber);
  }
  return pending()
    ? { ...detail, note: `Still running after ~${Math.round((Date.now() - start) / 1000)}s. Call check_pr_status again.` }
    : detail;
}

async function rulesVersionOrNull(): Promise<string | null> {
  return getProjectRules()
    .then((r) => r.version)
    .catch(() => null);
}

async function listPendingChanges(changeKey: string | null) {
  const open = await listOpenChanges();
  const target = changeKey ? await getChange(changeKey) : open.length === 1 ? open[0] : null;
  if (changeKey && !target) {
    return { view: "list" as const, error: `No change found with id ${changeKey}.`, changes: open.map((c) => c.record.key) };
  }
  if (!target) return { view: "list" as const, changes: open.map((c) => c.record.key) };
  const others = open.filter((c) => c.record.key !== target.record.key).length;
  return buildReview(target, others);
}

export function createAdminMcpServer(user: McpUser): Server {
  const server = new Server(
    { name: "consciouscompute-admin", version: "1.0.0" },
    { capabilities: { tools: {}, resources: {} }, instructions: SERVER_INSTRUCTIONS },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.filter((t) => canUseTool(user.role, t.name)).map((t) => {
      const schema = withChangeIdParam(t.name, t.input_schema);
      const meta = { ...(t._meta ?? {}), ...(CHATGPT_TOOL_META[t.name] ?? {}) };
      return {
        name: t.name,
        description: RULES_GATED_TOOLS.has(t.name)
          ? `${t.description} Requires ${RULES_VERSION_PARAM} from get_project_rules.`
          : t.description,
        inputSchema: RULES_GATED_TOOLS.has(t.name) ? withRulesVersionParam(schema) : schema,
        annotations: toolAnnotations(t.name),
        ...(Object.keys(meta).length ? { _meta: meta } : {}),
      };
    }),
  }));

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [{ uri: PENDING_CHANGES_UI_URI, name: "Pending changes", mimeType: MCP_APP_MIME_TYPE }],
  }));

  // Declaring resources means clients may ask for templates; "method not found" there made some
  // clients abort setup (seen in ramprate-ui). There are none, so say so.
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({ resourceTemplates: [] }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    if (request.params.uri !== PENDING_CHANGES_UI_URI) throw new Error(`Unknown resource "${request.params.uri}"`);
    return {
      contents: [
        {
          uri: PENDING_CHANGES_UI_URI,
          mimeType: MCP_APP_MIME_TYPE,
          text: PENDING_CHANGES_HTML,
          _meta: {
            ui: { prefersBorder: true, csp: { resourceDomains: ["https://esm.sh"] } },
            "openai/widgetDescription":
              "Review card for one website change: status and next step, what will go live, before and after, checks, the preview link, and Publish or Discard with a confirm step.",
            "openai/widgetPrefersBorder": true,
          },
        },
      ],
    };
  });

  const handleCall = async (request: CallToolRequest) => {
    const { name, arguments: rawArgs } = request.params;
    const { [RULES_VERSION_PARAM]: rulesVersion, ...input } = (rawArgs ?? {}) as Record<string, unknown>;

    console.log(`[mcp] ${user.name}${user.email ? ` <${user.email}>` : ""} (${user.role}) called ${name}`);
    if (!TOOLS.some((t) => t.name === name)) return toResult({ error: `Unknown tool "${name}"` }, true);
    if (!canUseTool(user.role, name)) {
      return toResult(
        { error: `${user.name}'s access level (${user.role}) doesn't allow ${name}. Ask the webmaster if you need it.` },
        true,
      );
    }

    if (name === "get_project_rules") {
      const [rules, knowledgeBase] = await Promise.all([getProjectRules(), listKnowledgeBase().catch(() => [])]);
      return toResult({
        rulesVersion: rules.version,
        you: {
          name: user.name,
          role: user.role,
          note:
            user.role === "read"
              ? "Look-only access: you can read, check and report, not change anything."
              : user.role === "edit"
                ? "You can prepare changes (they wait as pending), but a team member with write access must publish them."
                : "Full access, including publishing.",
        },
        howToUse: `Follow every rule below for the rest of this conversation. One request = one change: start_change, pass its change_id on every edit, submit_for_review with a plain summary (and before_after for wording), then list_pending_changes with that change_id so the person sees exactly what will go live and can Publish or Discard it. Pass "${rules.version}" as ${RULES_VERSION_PARAM} on every tool that changes something. End every reply that did work with the Status Report. Before touching an area, read its note from knowledgeBase with github_read_file.`,
        rules: rules.content,
        knowledgeBase,
      });
    }

    if (RULES_GATED_TOOLS.has(name)) {
      let current: string;
      try {
        current = (await getProjectRules()).version;
      } catch (err) {
        return toResult(
          { error: `Could not load ${RULES_PATH} to check the rules version, so nothing was changed: ${String(err)}` },
          true,
        );
      }
      const blocked = rulesVersionError(rulesVersion, current);
      if (blocked) return toResult({ error: blocked }, true);
    }

    const rawChangeId = input[CHANGE_ID_PARAM];
    delete input[CHANGE_ID_PARAM];
    const changeKey = rawChangeId === undefined || rawChangeId === "" ? null : normalizeChangeKey(rawChangeId);
    if (rawChangeId !== undefined && rawChangeId !== "" && !changeKey) {
      return toResult(
        { error: `"${String(rawChangeId)}" isn't a valid change_id. Use the one start_change returned.` },
        true,
      );
    }

    if (name === "check_code_quality") {
      return toResult(checkCode(normalizeRepoPath(input.path), String(input.content ?? "")));
    }

    if (name === "get_check_log_excerpt") {
      const id = Number(input.checkRunId);
      if (!Number.isFinite(id)) return toResult({ error: "A numeric checkRunId is required." }, true);
      try {
        return toResult({ log: await gh.getFailingCheckLogExcerpt(id) });
      } catch (err) {
        return toResult({ error: err instanceof Error ? err.message : "Could not read the log" }, true);
      }
    }

    if (name === "start_change") {
      const title = String(input.title ?? "").trim();
      const requestText = String(input.request ?? "").trim();
      const understoodAs = String(input.understood_as ?? "").trim();
      if (!title || !requestText || !understoodAs) {
        return toResult(
          { error: "A title, the person's request, and understood_as (what you will change, in plain words) are all required." },
          true,
        );
      }
      const appliesTo = normalizeAppliesTo(input.applies_to);
      const needsConfirmation = input.needs_confirmation === true;
      const change = await createChange({
        title,
        request: requestText,
        understoodAs,
        appliesTo,
        needsConfirmation,
        conversationUrl: normalizeConversationUrl(input.conversation_url),
        user,
      });
      const key = change.record.key;
      return {
        ...toResult({
          view: "confirm",
          change_id: key,
          changeId: key,
          title,
          request: requestText,
          understoodAs,
          appliesTo,
          appliesToLabel: APPLIES_TO_LABELS[appliesTo],
          needsConfirmation,
          state: needsConfirmation ? "awaiting_ok" : "working",
          stateLabel: needsConfirmation ? "Waiting for your OK" : "Working",
          nextStep: needsConfirmation
            ? "Check what the AI understood. Say yes to let it start, or tell it what you meant."
            : "The AI is making this change. Nothing to do yet.",
          next: needsConfirmation
            ? `STOP: show the person exactly this and wait for their answer: "I understand your request as: ${understoodAs} (Applies to: ${APPLIES_TO_LABELS[appliesTo]}). Is that right?" Edits are refused until they say yes and you call confirm_change.`
            : `Pass change_id "${key}" on every edit for this request. When done, call submit_for_review, then list_pending_changes with this change_id.`,
          youCanDiscard: canUseTool(user.role, "discard_change"),
          youCanPublish: canUseTool(user.role, "publish_changes"),
        }),
        _meta: { rulesVersion: await rulesVersionOrNull() },
      };
    }

    if (name === "list_pending_changes") {
      const pending = await listPendingChanges(changeKey);
      return {
        ...toResult({
          ...pending,
          youCanPublish: canUseTool(user.role, "publish_changes"),
          youCanDiscard: canUseTool(user.role, "discard_change"),
          you: { name: user.name, role: user.role },
        }),
        // Card-only: the model still has to call get_project_rules itself before it can publish.
        _meta: { rulesVersion: await rulesVersionOrNull() },
      };
    }

    if (name === "check_deploy") {
      if (changeKey) {
        const target = await getChange(changeKey);
        if (!target) return toResult({ error: `No change found with id ${changeKey}.` }, true);
        const detail = await gh.getChecksDetail(target.pr.headSha, target.pr.number);
        return toResult({
          site: `Preview of change ${changeKey}`,
          build: detail.build,
          previewUrl: detail.previewUrl,
          buildDetails: detail.buildUrl,
        });
      }
      const main = await gh.getDefaultBranch();
      const commits = await gh.recentCommits(main, 3);
      const builds = await Promise.all(
        commits.map(async (c) => {
          const detail = await gh.getChecksDetail(c.sha, null).catch(() => null);
          return { change: c.message, date: c.date, build: detail?.build ?? "unknown" };
        }),
      );
      return toResult({ site: "Live site (consciouscompute.org)", latestBuilds: builds });
    }

    if ((CHANGE_REQUIRED_TOOLS.has(name) || CHANGE_ACTION_TOOLS.has(name)) && !changeKey) {
      return toResult(
        {
          error:
            name === "publish_changes" || name === "discard_change"
              ? "Say which change: pass its change_id (see list_pending_changes)."
              : "Every edit must belong to a change. Call start_change for this request first and pass its change_id.",
        },
        true,
      );
    }

    if (name === "confirm_change") {
      const result = await confirmChange(changeKey!, input.applies_to);
      return fromChangeResult(
        result.ok
          ? {
              ...result,
              appliesToLabel: APPLIES_TO_LABELS[result.appliesTo],
              next: `Confirmed. Now make the change, passing change_id "${result.changeId}" on every edit, then submit_for_review.`,
            }
          : result,
      );
    }
    if (name === "publish_changes") {
      return fromChangeResult(await publishChange(changeKey!, String(input.review_token ?? ""), user));
    }
    if (name === "discard_change") {
      return fromChangeResult(await discardChange(changeKey!));
    }

    let change: Change | null = null;
    if (changeKey) {
      change = await getChange(changeKey);
      if (!change) {
        return toResult({ error: `No change found with id ${changeKey}. Call start_change for a new request.` }, true);
      }
    }
    const readRef = change && isOpen(change) ? change.pr.branch : await gh.getDefaultBranch();

    if (name === "submit_for_review") {
      const summary = String(input.summary ?? "").trim();
      if (!summary) return toResult({ error: "A plain-English summary is required." }, true);
      const beforeAfter: BeforeAfter[] = Array.isArray(input.before_after)
        ? (input.before_after as Array<Record<string, unknown>>)
            .filter((b) => b && typeof b === "object")
            .map((b) => ({ label: String(b.label ?? ""), before: String(b.before ?? ""), after: String(b.after ?? "") }))
        : [];
      const result = await submitForReview(change!, summary, beforeAfter);
      return fromChangeResult(
        result.ok
          ? { ...result, next: `Now call list_pending_changes with change_id "${change!.record.key}" to show the person the review.` }
          : result,
      );
    }

    if (name === "github_list_dir") {
      return toResult(await gh.listDir(normalizeRepoPath(input.path), readRef));
    }

    if (name === "github_read_file") {
      const path = normalizeRepoPath(input.path);
      if (!path) return toResult({ error: "A file path is required." }, true);
      if (isPathReadDenied(path)) return toResult({ error: `${path} can't be read from here.` }, true);
      const file = await gh.getFile(path, readRef);
      return file ? toResult({ path, content: file.content }) : toResult({ error: `${path} does not exist` }, true);
    }

    if (name === "check_pr_status") {
      if (!change || !isOpen(change)) {
        return toResult({ status: "no_pending_change", message: "Pass the change_id of a waiting change." });
      }
      return toResult(await waitForChecks(change.pr.headSha, change.pr.number));
    }

    // github_write_file / github_delete_file
    const path = normalizeRepoPath(input.path);
    if (!path) return toResult({ error: "A file path is required." }, true);
    if (isPathDenied(path)) return toResult({ error: `${path} can't be changed from here.` }, true);
    if (change!.record.status === "awaiting_confirmation" && isOpen(change!)) {
      return toResult(
        {
          error: `The person hasn't confirmed what you understood yet ("${change!.record.understoodAs}"). Ask them, wait for a clear yes, then call confirm_change.`,
        },
        true,
      );
    }
    if (!isOpen(change!)) {
      return toResult({ error: `Change ${change!.record.key} is no longer open. Call start_change for a new request.` }, true);
    }
    const message = `${String(input.message ?? "Edit").slice(0, 200)} [by ${user.name}]`;
    await markEdited(change!);
    if (name === "github_write_file") {
      await gh.putFile(path, String(input.content ?? ""), message, change!.pr.branch);
    } else {
      await gh.deleteFile(path, message, change!.pr.branch);
    }
    return toResult({
      ok: true,
      path,
      changeId: change!.record.key,
      note: "Saved to this change only. The preview rebuilds automatically. When all edits are done, call submit_for_review.",
    });
  };

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const result = await handleCall(request);
    if (!OTHER_PENDING_TOOLS.has(request.params.name)) return result;
    return withOtherPending(result, request.params.arguments?.[CHANGE_ID_PARAM] as string | undefined);
  });

  return server;
}

// Every change-related answer carries the other waiting changes, for the card and for the AI to
// end its reply with, so an old change is never forgotten.
const OTHER_PENDING_TOOLS = new Set([
  "start_change",
  "confirm_change",
  "submit_for_review",
  "list_pending_changes",
  "publish_changes",
  "discard_change",
]);

async function withOtherPending<
  T extends {
    content: Array<{ type: "text"; text: string }>;
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
  },
>(result: T, requestedKey: string | undefined): Promise<T> {
  const sc = result.structuredContent;
  if (result.isError || !sc) return result;
  const exclude =
    sc.view === "list" ? null : typeof sc.changeId === "string" ? sc.changeId : (normalizeChangeKey(requestedKey) ?? null);
  // Never fails the answer it is attached to.
  const rows = await listOpenChanges()
    .then((open) => pendingRows(open, exclude))
    .catch(() => null);
  const merged = {
    ...sc,
    otherPending: rows,
    otherPendingNote: `End your reply with a section titled "Other Pending Changes" listing these in plain words (what it is, when it was asked, status), or "No other pending changes." if there are none. Each can be previewed, published or discarded on its own.\n${otherPendingText(rows)}`,
  };
  return { ...result, structuredContent: merged, content: [{ type: "text", text: JSON.stringify(merged, null, 2) }] };
}
