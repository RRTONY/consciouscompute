# MCP Editor (2026-10-22)

> How team members edit the site through ChatGPT/Claude, why it has no database, and what is verified

Built 2026-10-22 on request ("check ramprate-ui and its MCP server, the same thing for this project: login, and users can edit and update"). Ported from ramprate-ui's `src/lib/admin/` (also looked at tonyg-site's port; both store change records in Sanity and deploy on Netlify, so neither was copied as is). Scope chosen by the user: core editing plus the review card. No screenshots, file uploads, history/undo, email or reports.

**Why no database:** the site is static and has no CMS. Change records live in the pull request description (JSON in an HTML comment, `change-record.ts`), sign-in tokens are HMAC-signed blobs (`mcp-oauth.ts`), and statuses Published/Discarded come from GitHub (merged/closed). `start_change` makes a branch with one empty commit so its pull request (the record) can open before any edit; the squash merge drops it.

**Differences from ramprate-ui**
- Lint is not run inside the server function (it made ramprate's function ~100 MB and broke once live). The GitHub Actions `checks` job (type check, lint, build) plus Vercel's preview build gate publishing instead. `check_code_quality` only checks house rules (tokens not hex, next/image, no inline style, mobile first, no icon/animation libraries, noindex and the Temporary placement notice kept).
- Vercel instead of Netlify: build status is the `Vercel` commit status; the preview link is read from Vercel's check-run summary or bot comment (`findPreviewUrl`, only `consciouscompute-*.vercel.app`). `check_deploy` reads the same statuses, so no Vercel token is needed.
- `vercel.json` is not writable through MCP, since it carries the noindex header the author asked to keep.
- No token-in-URL route (`/api/mcp/[token]`); everyone signs in (OAuth) or uses a header token.

**Verified locally 2026-10-22**
- 35-check flow test against an in-memory fake GitHub through the real request handler: rules gate, roles, confirm-before-edit, live site untouched by edits, attribution, submit, publish refused while checks run / with a wrong token / after a later edit, publish merges the reviewed version, discard, other-pending rows, list view, house-rule check.
- 19-check sign-in test on a local production build: discovery metadata, look-alike connector refused, sign-in page (noindex), wrong password and unknown email refused without the password in the URL, PKCE, tokens, MCP initialize, role-filtered tools (15 write / 8 read), review card served, refresh, tampered token refused, GET → 405.
- Review card script parses as valid JavaScript.

**Not yet verified:** against real GitHub and Vercel (needs `GITHUB_TOKEN` and the other env vars in Vercel, and the domain). First live check: start a tiny change from Claude or ChatGPT, confirm the pull request opens with the record, the preview link appears, and discard it. The test scripts are not in the repo yet (they ran with `npx tsx`); adding Vitest to keep them needs a yes (no new dependency without asking).

**Fixed 2026-10-22 after the first real change (PR #1, Tony's orange notice border):**
- ChatGPT showed "Couldn't display" instead of the review card: the card loaded `ext-apps@1.7.5` from esm.sh with its dependencies unpinned, esm.sh now picks zod 4.x, and the runtime crashed on import (`t.custom is not a function`, reproduced in Chrome). The runtime URL now pins `sdk@1.30.0` and `zod@3.25.76` (same fix as tonyg-site, 2026-10-17), a failed load shows a plain message, and the card URI moved to v2. ramprate-ui's card still has the unpinned import.
- The GitHub `checks` job failed at `npm ci` on every change: the runner's npm 10 (Node 22) rejected the lock file written by npm 11 (`fdir` wants picomatch ^3||^4, the top-level copy is 2.3.2). The workflow now runs on Node 24 (npm 11). Changes opened before the fix need their branch updated from `main` to pick it up.
