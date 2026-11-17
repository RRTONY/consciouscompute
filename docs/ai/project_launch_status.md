# Launch status: email, Search Console, indexing (checked 2026-11-18)

What still has to happen before the site is promoted or opened to Google. Update this note when an item changes.

## join@consciouscompute.org does not work yet

- Tony's redesign (live since 2026-11-17) added two "Join the movement" mailto links to `join@consciouscompute.org`.
- The domain uses Namecheap email forwarding (MX `eforward*.registrar-servers.com`), but the mail server
  rejects `join@` with "Relay access denied", exactly like a made-up address. So no forward exists for it
  and mail to it bounces.
- Fix: in Namecheap → Domain → Redirect Email, forward `join@` to a monitored inbox, then send a real test.
- Branch `fix/hide-unverified-email` hides both links behind `CONTACT_EMAIL` in `src/lib/paper.ts`
  (null = hidden). Set it back to the address once the test email arrives.
- How to re-test without sending mail: connect to `eforward1.registrar-servers.com:25`, `MAIL FROM` a real
  domain (a domain with a null MX, like example.com, is rejected first), then `RCPT TO:<join@...>`.
  250 = accepted, 554 relay denied = not set up.

## Google Search Console: not set up

- The team's service account sees ramprate.com, clarisseartist.com and tonygreenberg.com, not this domain.
- No `google-site-verification` TXT record on the domain.
- Add it as a Domain property (DNS TXT at Namecheap), add the service account as a user, and submit
  `https://consciouscompute.org/sitemap.xml`. Only useful once noindex is removed.

## Indexing: blocked on purpose

- The "Temporary placement" notice and `noindex, nofollow` stay until the author says otherwise
  (AGENTS.md section 2). On 2026-11-17 Sam asked to remove both; Tony replied "Do not remove the temporary".
- Branch `seo/sitemap-canonical` adds `src/app/sitemap.ts` and a canonical URL, with notice and noindex
  kept. When noindex is lifted, change `src/app/layout.tsx` and `vercel.json` together.

## Open preview branches (not published)

| Branch | What |
| --- | --- |
| `seo/sitemap-canonical` | Sitemap + canonical URL |
| `chore/security-updates` | Patched Next.js (16.4.6) and dependencies; lockfile only |
| `fix/hide-unverified-email` | Hides the two join@ buttons |
