# Next.js 16 loading.tsx Breaks 404s

> A folder-level loading.tsx silently breaks notFound()/redirect() status codes for nested dynamic routes

Conscious Compute rule: on Next.js 16, a misplaced `loading.tsx` makes 404 pages return HTTP 200, so Google sees "soft 404s" and pages go unindexed. The site has no `loading.tsx` today; keep it that way unless this rule is followed.

**Mechanism:** `loading.tsx` wraps its segment's page and every nested route in a `<Suspense>` boundary. Next.js starts streaming the response (status locked at 200) before a nested page's `notFound()` or `redirect()` resolves. You get a noindex meta tag or a meta-refresh instead of a real 404/308. See `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md` ("Status Codes").

**How to apply:** Before adding a `loading.tsx`, check for any dynamic `[slug]` route under that folder. If there is one, use a local `<Suspense>` inside the specific page instead. Call `notFound()`/`redirect()` before any `await` that could suspend. Verify with `npm run build && npm start` and `curl -I` on a bad URL.

Also: `global-error.tsx` renders outside the root layout, so `globals.css` never loads there; it is the one place hardcoded inline styles are allowed.
