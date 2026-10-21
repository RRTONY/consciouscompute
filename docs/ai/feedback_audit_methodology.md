# Audit Methodology

> Fix a11y/perf findings at the shared component and sweep every route; two Next.js pitfalls to check

When fixing a Lighthouse/PageSpeed/axe finding, or asked to "check accessibility/performance", don't stop at the flagged page. Sweep every route and fix the shared component causing it.

Pitfalls to check on Conscious Compute:
- A shared metadata/layout helper calling `headers()`/`cookies()` forces the whole site dynamic. First check: `npm run build` route table shows `ƒ (Dynamic)` instead of `○ (Static)`.
- A barrel `index.ts` re-export can leak a heavy dependency into every page's JS.
- Never trust one local Lighthouse score; CPU noise swings it 10 to 15 points. Test a production build (`npm run build && npm start`, never `npm run dev`) or the deployed site.
