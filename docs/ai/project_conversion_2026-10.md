# Static HTML to Next.js (2026-10-22)

> How the static index.html became this Next.js app, and what was kept identical

The site started as one hand-written `index.html` with inline CSS, plus `image.svg` and a `vercel.json` noindex header. On 2026-10-22 it was rebuilt as a Next.js 16 + Tailwind v4 app following the rules in AGENTS.md.

**Kept identical:** all paper text, citations, dates and links; colors (same hex values, now tokens); fonts (Fraunces and IBM Plex Mono, now self-hosted via next/font instead of a Google Fonts link); layout (46rem column, 18px base, 16px safe-area gutter); `noindex, nofollow` (metadata and the `vercel.json` header).

**Changed:** `image.svg` moved to `public/` and renders through `next/image`. Tables, use cases and references are data in `src/lib/paper.ts`.

**Check after deploy:** the Vercel project should detect Next.js automatically. If it was set up as a static site ("Other" framework preset), switch the preset to Next.js in the Vercel dashboard.

**Published 2026-10-22:** the Next.js version, the author's requested changes (Temporary placement notice, headline, scoring, use cases, reorder, invitation without a contact link) and the MCP editor went to `main` after the webmaster confirmed Tony's sign-off on the wording. noindex/nofollow stays on.
