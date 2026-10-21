import { createHash } from "crypto";
import type { AppliesTo, ChangeStatus } from "@/lib/admin/change-record";
import { APPLIES_TO_LABELS } from "@/lib/admin/change-record";
import type { CheckState as GitHubCheckState } from "@/lib/admin/github-client";

// Plain-language review for one change: what it touches, its checks, ONE status with the next
// step, and a fingerprint of exactly what was reviewed. Pure functions only.

export interface AffectedArea {
  label: string;
  // A page address to open on the preview, when there is one.
  route: string | null;
}

const KNOWN_FILES: Record<string, AffectedArea> = {
  "src/app/page.tsx": { label: "The working paper (home page)", route: "/" },
  "src/lib/paper.ts": { label: "The paper's tables, use cases and references (home page)", route: "/" },
  "src/app/globals.css": { label: "Site-wide colors, fonts and text styles", route: "/" },
  "src/app/layout.tsx": { label: "Site-wide layout, page title and search settings", route: "/" },
  "src/components/icons.tsx": { label: "Icons used in the paper", route: "/" },
  "AGENTS.md": { label: "Project rules for AI tools (not shown on the site)", route: null },
  "next.config.ts": { label: "Site settings (redirects, build options)", route: null },
};

export function describeFile(path: string): AffectedArea {
  if (KNOWN_FILES[path]) return KNOWN_FILES[path];
  if (path.startsWith("docs/")) return { label: `Background notes: ${path} (not shown on the site)`, route: null };
  if (path.startsWith("public/")) return { label: `Image or file: /${path.slice(7)}`, route: `/${path.slice(7)}` };
  const page = path.match(/^src\/app\/(.+)\/page\.tsx$/);
  if (page && !page[1].includes("[")) return { label: `Page: /${page[1]}`, route: `/${page[1]}` };
  return { label: `Code: ${path}`, route: null };
}

export function describeFiles(paths: string[]): AffectedArea[] {
  const seen = new Set<string>();
  return paths.map(describeFile).filter((a) => (seen.has(a.label) ? false : (seen.add(a.label), true)));
}

// Fingerprint of exactly what the person reviewed: the change's latest commit. Publish refuses
// if it no longer matches, so nothing added after the review can slip out with it.
export function reviewToken(headSha: string): string {
  return createHash("sha256").update(`cc-review|${headSha}`).digest("hex").slice(0, 16);
}

export type CheckKey = "build" | "ci";
export type CheckState = "passed" | "running" | "timed_out" | "failed" | "not_needed";

export interface CheckRow {
  key: CheckKey;
  label: string;
  state: CheckState;
  detail: string;
  required: boolean;
}

export function reviewChecks(input: {
  hasCode: boolean;
  build: GitHubCheckState | null;
  ci: GitHubCheckState | null;
  ciWaiting: string[];
  ciFailing: string[];
  // True when anything has been running 20+ minutes since the last edit.
  stuck: boolean;
}): CheckRow[] {
  if (!input.hasCode) {
    return [
      { key: "build", label: "Preview build", state: "not_needed", detail: "Nothing changed yet.", required: false },
      { key: "ci", label: "Code checks", state: "not_needed", detail: "Nothing changed yet.", required: false },
    ];
  }

  const build: CheckRow =
    input.build === "success"
      ? { key: "build", label: "Preview build", state: "passed", detail: "The preview site built.", required: true }
      : input.build === "failure"
        ? {
            key: "build",
            label: "Preview build",
            state: "failed",
            detail: "The preview site didn't build. The AI needs to fix it.",
            required: true,
          }
        : input.stuck
          ? {
              key: "build",
              label: "Preview build",
              state: "timed_out",
              detail: "Has been running for over 20 minutes.",
              required: true,
            }
          : {
              key: "build",
              label: "Preview build",
              state: "running",
              detail: "Building the preview site on Vercel (usually 1 to 3 minutes).",
              required: true,
            };

  const ci: CheckRow =
    input.ci === "failure"
      ? {
          key: "ci",
          label: "Code checks",
          state: "failed",
          detail: `Failed: ${input.ciFailing.join(", ") || "a GitHub check"}. The AI can read the error with get_check_log_excerpt and fix it.`,
          required: true,
        }
      : input.ci === "pending"
        ? input.stuck
          ? {
              key: "ci",
              label: "Code checks",
              state: "timed_out",
              detail: `Still waiting after 20+ minutes: ${input.ciWaiting.join(", ") || "a GitHub check"}.`,
              required: true,
            }
          : {
              key: "ci",
              label: "Code checks",
              state: "running",
              detail: `Running: ${input.ciWaiting.join(", ") || "type check, lint and build"} (usually 1 to 2 minutes).`,
              required: true,
            }
        : input.ci === "success"
          ? {
              key: "ci",
              label: "Code checks",
              state: "passed",
              detail: "Type check, lint and build passed.",
              required: true,
            }
          : {
              key: "ci",
              label: "Code checks",
              state: "running",
              detail: "Waiting for the type check, lint and build to start.",
              required: true,
            };

  return [build, ci];
}

export type ReviewState =
  | "awaiting_ok"
  | "working"
  | "checking"
  | "ready"
  | "failed"
  | "stuck"
  | "published"
  | "discarded";

export const REVIEW_STATE_LABELS: Record<ReviewState, string> = {
  awaiting_ok: "Waiting for your OK",
  working: "Working",
  checking: "Checking",
  ready: "Ready for review",
  failed: "Failed",
  stuck: "Stuck",
  published: "Published",
  discarded: "Discarded",
};

export interface ReviewActions {
  preview: boolean;
  discard: boolean;
  publish: boolean;
  retry: boolean;
}

export interface ReviewOutcome {
  state: ReviewState;
  label: string;
  nextStep: string;
  actions: ReviewActions;
}

const NONE: ReviewActions = { preview: false, discard: false, publish: false, retry: false };

// One status and one next step, worked out here so neither the person nor the AI has to piece
// together "ready" + "still running" + "not ready" themselves.
export function reviewOutcome(input: {
  status: ChangeStatus;
  checks: CheckRow[];
  hasPreview: boolean;
  problems: string[];
}): ReviewOutcome {
  const out = (state: ReviewState, nextStep: string, actions: Partial<ReviewActions>): ReviewOutcome => ({
    state,
    label: REVIEW_STATE_LABELS[state],
    nextStep,
    actions: { ...NONE, ...actions },
  });
  const preview = input.hasPreview;

  if (input.status === "published") return out("published", "Nothing to do. It's live.", {});
  if (input.status === "discarded") return out("discarded", "Nothing to do. Nothing from this change went live.", {});
  if (input.status === "awaiting_confirmation") {
    return out(
      "awaiting_ok",
      "Check what the AI understood. Say yes to let it start, or tell it what you meant.",
      { discard: true },
    );
  }
  if (input.status === "draft") {
    return out("working", "The AI is still making this change. Nothing to do yet.", { discard: true, preview });
  }

  const required = input.checks.filter((c) => c.required);
  const broken = required.filter((c) => c.state === "failed");
  if (broken.length || input.problems.length) {
    const what = [...broken.map((c) => `${c.label} failed`), ...input.problems].join(". ");
    return out("failed", `${what}. Ask the AI to fix it, Retry, or Discard the change.`, {
      retry: true,
      discard: true,
      preview,
    });
  }
  if (required.some((c) => c.state === "timed_out")) {
    return out("stuck", "A check has been running far longer than normal. Retry, or Discard the change.", {
      retry: true,
      discard: true,
      preview,
    });
  }
  if (required.some((c) => c.state === "running")) {
    return out(
      "checking",
      preview
        ? "Checks are still running. You can open the Preview now. Publish unlocks when they pass."
        : "Checks are still running (the preview site is being built). Publish unlocks when they pass.",
      { retry: true, discard: true, preview },
    );
  }
  return out(
    "ready",
    preview
      ? "Open the Preview and look it over, then Publish or Discard."
      : "Look over what will go live below, then Publish or Discard.",
    { preview, discard: true, publish: true },
  );
}

// The list under "What will go live", always ending with what is NOT included.
export function goesLiveList(input: {
  summary: string | null;
  appliesTo: AppliesTo;
  areas: AffectedArea[];
  otherPendingCount: number;
}): string[] {
  const items: string[] = [];
  if (input.summary) items.push(input.summary);
  for (const a of input.areas) items.push(a.label);
  if (input.areas.some((a) => a.route)) items.push(`Applies to: ${APPLIES_TO_LABELS[input.appliesTo]}`);
  items.push(
    input.otherPendingCount > 0
      ? `${input.otherPendingCount} other waiting change${input.otherPendingCount === 1 ? " is" : "s are"} NOT included`
      : "No other changes are included",
  );
  return items;
}
