# Launch status: email, Search Console, indexing (checked 2026-11-18)

What still has to happen before the site is promoted. Update this note when an item changes.

## join@consciouscompute.org: working (2026-11-18)

- Namecheap → Domain tab → Redirect Email: `join` → a team inbox. Mail Settings stays "Email Forwarding";
  don't edit the locked SPF TXT record on Advanced DNS.
- The mail server accepts `join@` (RCPT TO returns 250). Before the forwarder existed it returned
  "554 Relay access denied".
- Both "Join the movement" links use `CONTACT_EMAIL` in `src/lib/paper.ts` (`null` hides them).
- Re-test without sending mail: connect to `eforward1.registrar-servers.com:25`, `MAIL FROM` a real domain
  (one with a null MX, like example.com, is rejected first), then `RCPT TO:<join@...>`.

## Google Search Console: set up, sitemap accepted (2026-11-18)

- `consciouscompute.org` is a Domain property (`sc-domain:consciouscompute.org`) and existed before 2026
  (a 2021 `sitemap.website.xml` from the old site is listed with an error; remove it if still there).
- `https://consciouscompute.org/sitemap.xml` submitted 2026-11-18: Success, 1 page discovered.
- Not yet done: add the team's service account (the `.iam.gserviceaccount.com` user on ramprate.com) as a
  Full user, so AI tools can check indexing. Until then the Search Console tools can't see this site.

## Indexing: open since 2026-11-18

- In a team thread around the 2026-11-17 redesign, Sam asked to remove the notice and noindex; Tony first
  wrote "Do not remove the temporary". Both were removed on 2026-11-18 with approval, together with a
  sitemap (`src/app/sitemap.ts`) and a canonical URL on the paper page.
- The sign-in, MCP and `.well-known` routes keep `noindex`.

## Published together on 2026-11-18

Security update (Next.js 16.4.6), the join@ buttons hidden (shown again once the inbox worked), these notes, and the indexing change above.
