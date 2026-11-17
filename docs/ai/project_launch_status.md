# Launch status: email, Search Console, indexing (checked 2026-11-18)

What still has to happen before the site is promoted. Update this note when an item changes.

## join@consciouscompute.org does not work yet

- Tony's redesign (live since 2026-11-17) added two "Join the movement" mailto links to `join@consciouscompute.org`.
- The domain uses Namecheap email forwarding (MX `eforward*.registrar-servers.com`), but the mail server
  rejects `join@` with "Relay access denied", exactly like a made-up address. So no forward exists for it
  and mail to it bounces.
- Fix: in Namecheap → Domain → Redirect Email, forward `join@` to a monitored inbox, then send a real test.
- Both links are hidden behind `CONTACT_EMAIL` in `src/lib/paper.ts`
  (null = hidden) since 2026-11-18. Set it back to the address once the test email arrives.
- How to re-test without sending mail: connect to `eforward1.registrar-servers.com:25`, `MAIL FROM` a real
  domain (a domain with a null MX, like example.com, is rejected first), then `RCPT TO:<join@...>`.
  250 = accepted, 554 relay denied = not set up.

## Google Search Console: not set up

- The team's service account sees ramprate.com, clarisseartist.com and tonygreenberg.com, not this domain.
- No `google-site-verification` TXT record on the domain.
- Add it as a Domain property (DNS TXT at Namecheap), add the service account as a user, and submit
  `https://consciouscompute.org/sitemap.xml`.

## Indexing: open since 2026-11-18

- In a team thread around the 2026-11-17 redesign, Sam asked to remove the notice and noindex; Tony first
  wrote "Do not remove the temporary". Both were removed on 2026-11-18 with approval, together with a
  sitemap (`src/app/sitemap.ts`) and a canonical URL on the paper page.
- The sign-in, MCP and `.well-known` routes keep `noindex`.

## Published together on 2026-11-18

Security update (Next.js 16.4.6), the join@ buttons hidden, these notes, and the indexing change above.
