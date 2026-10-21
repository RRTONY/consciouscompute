import * as gh from "@/lib/admin/github-client";
import type { McpUser } from "@/lib/admin/mcp-auth";
import {
  BRANCH_PREFIX,
  STATUS_LABELS,
  branchForChange,
  decodeRecordBody,
  effectiveStatus,
  encodeRecordBody,
  newChangeKey,
  normalizeAppliesTo,
  type AppliesTo,
  type BeforeAfter,
  type ChangeRecord,
  type ChangeStatus,
} from "@/lib/admin/change-record";
import {
  describeFiles,
  goesLiveList,
  reviewChecks,
  reviewOutcome,
  reviewToken,
  type AffectedArea,
  type CheckRow,
  type ReviewOutcome,
} from "@/lib/admin/review";

// GitHub-backed change sets: each change is a branch + pull request, and its record lives in the
// pull request description (change-record.ts). No database.

const STUCK_MS = 20 * 60_000;

export interface Change {
  record: ChangeRecord;
  pr: gh.PullRequest;
  status: ChangeStatus;
}

export type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function toChange(pr: gh.PullRequest): Change | null {
  const record = decodeRecordBody(pr.body);
  if (!record || branchForChange(record.key) !== pr.branch) return null;
  return { record, pr, status: effectiveStatus(record, pr) };
}

export function isOpen(change: Change): boolean {
  return change.pr.open && !change.pr.merged;
}

export async function getChange(key: string): Promise<Change | null> {
  const pr = await gh.findPRForBranch(branchForChange(key));
  return pr ? toChange(pr) : null;
}

export async function listOpenChanges(): Promise<Change[]> {
  const prs = await gh.listPRs("open", BRANCH_PREFIX);
  return prs
    .map(toChange)
    .filter((c): c is Change => !!c)
    .sort((a, b) => a.record.createdAt.localeCompare(b.record.createdAt));
}

async function saveRecord(change: Change, patch: Partial<ChangeRecord>): Promise<void> {
  change.record = { ...change.record, ...patch };
  await gh.updatePRBody(change.pr.number, encodeRecordBody(change.record));
  change.pr.body = encodeRecordBody(change.record);
  change.status = effectiveStatus(change.record, change.pr);
}

export async function createChange(input: {
  title: string;
  request: string;
  understoodAs: string;
  appliesTo: AppliesTo;
  needsConfirmation: boolean;
  conversationUrl: string | null;
  user: McpUser;
}): Promise<Change> {
  const key = newChangeKey();
  const branch = branchForChange(key);
  const record: ChangeRecord = {
    v: 1,
    key,
    title: input.title,
    request: input.request,
    understoodAs: input.understoodAs,
    appliesTo: input.appliesTo,
    status: input.needsConfirmation ? "awaiting_confirmation" : "draft",
    requestedBy: { name: input.user.name, email: input.user.email },
    createdAt: new Date().toISOString(),
    lastEditedAt: null,
    conversationUrl: input.conversationUrl,
    summary: null,
    beforeAfter: [],
    submittedSha: null,
  };
  await gh.createChangeBranch(branch, `Start change: ${input.title} [by ${input.user.name}]`);
  const pr = await gh.openPR(branch, input.title, encodeRecordBody(record));
  return { record, pr, status: record.status };
}

// The person said yes to what the AI understood. Only then may the AI edit.
export async function confirmChange(
  key: string,
  appliesToRaw: unknown,
): Promise<Result<{ changeId: string; appliesTo: AppliesTo }>> {
  const change = await getChange(key);
  if (!change) return fail(`No change found with id ${key}.`);
  if (!isOpen(change)) return fail(`This change is already ${STATUS_LABELS[change.status].toLowerCase()}.`);
  const appliesTo = appliesToRaw === undefined ? change.record.appliesTo : normalizeAppliesTo(appliesToRaw);
  await saveRecord(change, {
    status: change.record.status === "awaiting_confirmation" ? "draft" : change.record.status,
    appliesTo,
  });
  return { ok: true, changeId: key, appliesTo };
}

// Any edit after "Ready for review" sends the change back to Draft, so the summary and review
// always describe the latest version. The edit time is what "stuck" is measured from.
export async function markEdited(change: Change): Promise<void> {
  await saveRecord(change, {
    lastEditedAt: new Date().toISOString(),
    ...(change.record.status === "ready_for_review" ? { status: "draft" as const, submittedSha: null } : {}),
  });
}

async function changedFiles(change: Change) {
  return (await gh.compareToDefaultBranch(change.pr.branch)).files;
}

export async function submitForReview(
  change: Change,
  summary: string,
  beforeAfter: BeforeAfter[],
): Promise<Result<{ changeId: string; status: ChangeStatus; files: string[] }>> {
  if (!isOpen(change)) return fail(`This change is already ${STATUS_LABELS[change.status].toLowerCase()}.`);
  if (change.record.status === "awaiting_confirmation") {
    return fail("The person hasn't confirmed what you understood yet. Wait for their yes (confirm_change) first.");
  }
  const files = await changedFiles(change);
  if (!files.length) return fail("Nothing has been changed in this change yet, so there's nothing to review.");
  const pr = await gh.getPR(change.pr.number);
  if (!pr) return fail("Could not read this change from GitHub. Try again.");
  change.pr = pr;
  await saveRecord(change, { status: "ready_for_review", summary, beforeAfter, submittedSha: pr.headSha });
  return { ok: true, changeId: change.record.key, status: change.status, files: files.map((f) => f.path) };
}

export interface ChangeReview {
  view: "detail";
  changeId: string;
  title: string;
  request: string;
  understoodAs: string;
  appliesTo: AppliesTo;
  requestedBy: string;
  createdAt: string;
  status: ChangeStatus;
  statusLabel: string;
  state: ReviewOutcome["state"];
  stateLabel: string;
  nextStep: string;
  actions: ReviewOutcome["actions"];
  canPublish: boolean;
  goesLive: string[];
  areas: AffectedArea[];
  files: string[];
  checks: CheckRow[];
  beforeAfter: BeforeAfter[];
  previewUrl: string | null;
  previewLinks: Array<{ label: string; url: string }>;
  failingChecks: gh.FailingCheck[];
  pullRequestUrl: string;
  headSha: string;
  reviewToken: string;
}

export async function buildReview(change: Change, otherPendingCount: number): Promise<ChangeReview> {
  const open = isOpen(change);
  const files = open ? await changedFiles(change) : [];
  const areas = describeFiles(files.map((f) => f.path));
  const detail = open ? await gh.getChecksDetail(change.pr.headSha, change.pr.number) : null;
  const lastActivity = Date.parse(change.record.lastEditedAt ?? change.record.createdAt);
  const stuck = Number.isFinite(lastActivity) && Date.now() - lastActivity > STUCK_MS;
  const checks = reviewChecks({
    hasCode: files.length > 0,
    build: detail?.build ?? null,
    ci: detail?.ci ?? null,
    ciWaiting: detail?.ciWaiting ?? [],
    ciFailing: detail?.ciFailing ?? [],
    stuck,
  });
  const previewUrl = detail?.previewUrl ?? null;
  const problems =
    change.status === "ready_for_review" && files.length === 0 ? ["Nothing has been changed yet"] : [];
  const outcome = reviewOutcome({ status: change.status, checks, hasPreview: !!previewUrl, problems });
  const previewLinks = previewUrl
    ? areas
        .filter((a) => a.route)
        .map((a) => ({ label: a.label, url: new URL(a.route as string, previewUrl).toString() }))
    : [];

  return {
    view: "detail",
    changeId: change.record.key,
    title: change.record.title,
    request: change.record.request,
    understoodAs: change.record.understoodAs,
    appliesTo: change.record.appliesTo,
    requestedBy: change.record.requestedBy.name,
    createdAt: change.record.createdAt,
    status: change.status,
    statusLabel: STATUS_LABELS[change.status],
    state: outcome.state,
    stateLabel: outcome.label,
    nextStep: outcome.nextStep,
    actions: outcome.actions,
    canPublish: outcome.actions.publish,
    goesLive: goesLiveList({
      summary: change.record.summary,
      appliesTo: change.record.appliesTo,
      areas,
      otherPendingCount,
    }),
    areas,
    files: files.map((f) => f.path),
    checks,
    beforeAfter: change.record.beforeAfter,
    previewUrl,
    previewLinks: previewLinks.length ? previewLinks : previewUrl ? [{ label: "Home page", url: previewUrl }] : [],
    failingChecks: detail?.failingChecks ?? [],
    pullRequestUrl: change.pr.url,
    headSha: change.pr.headSha,
    reviewToken: reviewToken(change.pr.headSha),
  };
}

export async function publishChange(
  key: string,
  token: string,
  user: McpUser,
): Promise<Result<{ changeId: string; mergeSha: string; liveSoon: string }>> {
  const change = await getChange(key);
  if (!change) return fail(`No change found with id ${key}.`);
  if (change.status !== "ready_for_review") {
    return fail(
      change.status === "draft"
        ? "This change is still a draft (or was edited after review). The AI must finish it and submit it for review first."
        : `This change is ${STATUS_LABELS[change.status].toLowerCase()}, so it can't be published.`,
    );
  }
  if (token !== reviewToken(change.pr.headSha)) {
    return fail("This change was updated after it was reviewed. Review it again (list_pending_changes) before publishing.");
  }
  if (!(await changedFiles(change)).length) return fail("This change has nothing in it to publish.");
  const detail = await gh.getChecksDetail(change.pr.headSha, change.pr.number);
  if (detail.build === "failure" || detail.ci === "failure") {
    return fail("A check failed for this change. It needs a fix before it can go live.");
  }
  if (detail.build !== "success" || detail.ci !== "success") {
    return fail("The checks are still running. Try again in a minute.");
  }

  let mergeSha: string;
  try {
    const merged = await gh.mergePR(
      change.pr.number,
      change.pr.headSha,
      `${change.record.title} [asked by ${change.record.requestedBy.name}, published by ${user.name}]`,
    );
    if (!merged.merged) return fail("GitHub could not merge this change.");
    mergeSha = merged.sha;
  } catch (err) {
    const status = gh.errorStatus(err);
    if (status === 409) return fail("This change was updated after it was reviewed. Review it again before publishing.");
    if (status === 405) {
      return fail(
        "This change can't go live as is, most likely because another published change edited the same file. Discard it and ask again.",
      );
    }
    throw err;
  }
  await gh.deleteBranch(change.pr.branch).catch(() => {});
  return {
    ok: true,
    changeId: key,
    mergeSha,
    liveSoon: "Vercel builds the live site from it now; it is usually live within 2 minutes (check_deploy shows it).",
  };
}

export async function discardChange(key: string): Promise<Result<{ changeId: string; status: ChangeStatus }>> {
  const change = await getChange(key);
  if (!change) return fail(`No change found with id ${key}.`);
  if (!isOpen(change)) return fail(`This change is already ${STATUS_LABELS[change.status].toLowerCase()}.`);
  await gh.closePR(change.pr.number);
  await gh.deleteBranch(change.pr.branch).catch(() => {});
  return { ok: true, changeId: key, status: "discarded" };
}

export interface PendingRow {
  changeId: string;
  title: string;
  request: string;
  requestedBy: string;
  createdAt: string;
  status: ChangeStatus;
  statusLabel: string;
  previewUrl: string | null;
  readyToPublish: boolean;
  conversationUrl: string | null;
}

export async function pendingRows(open: Change[], exclude: string | null): Promise<PendingRow[]> {
  const rows = open.filter((c) => c.record.key !== exclude);
  return Promise.all(
    rows.map(async (c) => {
      const detail = await gh.getChecksDetail(c.pr.headSha, c.pr.number).catch(() => null);
      return {
        changeId: c.record.key,
        title: c.record.title,
        request: c.record.request,
        requestedBy: c.record.requestedBy.name,
        createdAt: c.record.createdAt,
        status: c.status,
        statusLabel: STATUS_LABELS[c.status],
        previewUrl: detail?.previewUrl ?? null,
        readyToPublish: c.status === "ready_for_review" && detail?.build === "success" && detail?.ci === "success",
        conversationUrl: c.record.conversationUrl,
      };
    }),
  );
}

export function otherPendingText(rows: PendingRow[] | null): string {
  if (rows === null) return "Could not load the other pending changes right now.";
  if (!rows.length) return "No other pending changes.";
  return rows
    .map((r) => `- ${r.title} (asked by ${r.requestedBy}, ${r.createdAt.slice(0, 10)}): ${r.statusLabel}`)
    .join("\n");
}
