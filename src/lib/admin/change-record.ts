import { randomBytes } from "crypto";

// One request = one change = one branch + one pull request. This site has no database, so the
// change record (who asked, what was understood, status, summary) lives as JSON inside the pull
// request's description, below a plain-English summary people can read on GitHub. Published and
// Discarded aren't stored: they come from GitHub itself (merged / closed), so a change merged or
// closed by hand in GitHub is never shown with a stale status.
// Pure functions only, so they can be tested without GitHub.

export type StoredStatus = "awaiting_confirmation" | "draft" | "ready_for_review";
export type ChangeStatus = StoredStatus | "published" | "discarded";

export const STATUS_LABELS: Record<ChangeStatus, string> = {
  awaiting_confirmation: "Waiting for your OK",
  draft: "Draft",
  ready_for_review: "Ready for review",
  published: "Published",
  discarded: "Discarded",
};

export type AppliesTo = "both" | "desktop" | "mobile";

export const APPLIES_TO_LABELS: Record<AppliesTo, string> = {
  both: "Desktop and mobile",
  desktop: "Desktop only (mobile unchanged)",
  mobile: "Mobile only (desktop unchanged)",
};

export interface BeforeAfter {
  label: string;
  before: string;
  after: string;
}

export interface ChangeRecord {
  v: 1;
  key: string;
  title: string;
  request: string;
  understoodAs: string;
  appliesTo: AppliesTo;
  status: StoredStatus;
  requestedBy: { name: string; email: string };
  createdAt: string;
  lastEditedAt: string | null;
  conversationUrl: string | null;
  summary: string | null;
  beforeAfter: BeforeAfter[];
  // The pull request head commit at submit_for_review. Ready for review only counts while the
  // head is still this commit, so an edit made any other way can't slip past the review.
  submittedSha: string | null;
}

export const BRANCH_PREFIX = "change/";

export function branchForChange(key: string): string {
  return `${BRANCH_PREFIX}${key}`;
}

export function newChangeKey(now = new Date()): string {
  const stamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const suffix = [...randomBytes(6)].map((b) => alphabet[b % alphabet.length]).join("");
  return `${stamp}-${suffix}`;
}

// Accepts "20261022-ab12cd" or the branch name, so an AI passing back any form it was shown works.
export function normalizeChangeKey(raw: unknown): string | null {
  const s = String(raw ?? "")
    .trim()
    .replace(/^change\//, "");
  return /^\d{8}-[a-z0-9]{6}$/.test(s) ? s : null;
}

export function normalizeAppliesTo(raw: unknown): AppliesTo {
  return raw === "desktop" || raw === "mobile" ? raw : "both";
}

// Neither ChatGPT nor Claude tells the server which chat a request came from, so a link is only
// saved when the person shares one, and only a real chat address.
const CONVERSATION_HOSTS = ["chatgpt.com", "chat.openai.com", "claude.ai"];

export function normalizeConversationUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" && CONVERSATION_HOSTS.includes(url.hostname.toLowerCase()) && url.pathname.length > 1
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

const OPEN_MARK = "<!-- cc-change";
const CLOSE_MARK = "-->";

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function sanitizeRecord(r: ChangeRecord): ChangeRecord {
  return {
    ...r,
    title: clip(r.title, 120),
    request: clip(r.request, 2000),
    understoodAs: clip(r.understoodAs, 1000),
    summary: r.summary ? clip(r.summary, 1000) : null,
    beforeAfter: r.beforeAfter.slice(0, 20).map((b) => ({
      label: clip(b.label, 120),
      before: clip(b.before, 500),
      after: clip(b.after, 500),
    })),
  };
}

// "-->" inside the JSON would end the HTML comment early, so it is escaped as a JSON unicode
// escape, which JSON.parse turns back into the same text.
export function encodeRecordBody(record: ChangeRecord): string {
  const r = sanitizeRecord(record);
  const lines = [
    `**Requested by:** ${r.requestedBy.name}`,
    "",
    `**What they asked:** ${r.request}`,
    "",
    `**Understood as:** ${r.understoodAs} (${APPLIES_TO_LABELS[r.appliesTo]})`,
    "",
    `**Status:** ${STATUS_LABELS[r.status]}`,
  ];
  if (r.summary) lines.push("", `**Summary:** ${r.summary}`);
  lines.push(
    "",
    "_Made through the Conscious Compute editor (MCP). Review and publish it from ChatGPT or Claude, not by merging here._",
    "",
    OPEN_MARK,
    JSON.stringify(r).replace(/-->/g, "--\\u003e"),
    CLOSE_MARK,
  );
  return lines.join("\n");
}

export function decodeRecordBody(body: string | null | undefined): ChangeRecord | null {
  if (!body) return null;
  const start = body.lastIndexOf(OPEN_MARK);
  if (start === -1) return null;
  const end = body.indexOf(CLOSE_MARK, start + OPEN_MARK.length);
  if (end === -1) return null;
  try {
    const r = JSON.parse(body.slice(start + OPEN_MARK.length, end).trim()) as Partial<ChangeRecord>;
    if (r.v !== 1 || !normalizeChangeKey(r.key) || typeof r.title !== "string") return null;
    const status: StoredStatus =
      r.status === "awaiting_confirmation" || r.status === "ready_for_review" ? r.status : "draft";
    return {
      v: 1,
      key: r.key as string,
      title: r.title,
      request: String(r.request ?? ""),
      understoodAs: String(r.understoodAs ?? ""),
      appliesTo: normalizeAppliesTo(r.appliesTo),
      status,
      requestedBy: {
        name: String(r.requestedBy?.name ?? "Unknown"),
        email: String(r.requestedBy?.email ?? ""),
      },
      createdAt: String(r.createdAt ?? ""),
      lastEditedAt: r.lastEditedAt ? String(r.lastEditedAt) : null,
      conversationUrl: normalizeConversationUrl(r.conversationUrl),
      summary: r.summary ? String(r.summary) : null,
      beforeAfter: Array.isArray(r.beforeAfter)
        ? r.beforeAfter.map((b) => ({
            label: String(b?.label ?? ""),
            before: String(b?.before ?? ""),
            after: String(b?.after ?? ""),
          }))
        : [],
      submittedSha: r.submittedSha ? String(r.submittedSha) : null,
    };
  } catch {
    return null;
  }
}

// The status to show: GitHub's merged/closed wins over the stored one, and Ready for review
// falls back to Draft if the code moved on after it was submitted.
export function effectiveStatus(
  record: ChangeRecord,
  pr: { open: boolean; merged: boolean; headSha: string },
): ChangeStatus {
  if (pr.merged) return "published";
  if (!pr.open) return "discarded";
  if (record.status === "ready_for_review" && record.submittedSha !== pr.headSha) return "draft";
  return record.status;
}
