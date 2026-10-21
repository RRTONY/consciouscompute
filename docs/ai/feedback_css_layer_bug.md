# CSS Layer Bug

> Unlayered CSS in globals.css silently overrides Tailwind v4 utilities; use @layer base

Tailwind v4's styles live in cascade layers (`theme, base, components, utilities`). Per the cascade-layers spec, any unlayered rule beats every layered rule regardless of specificity or order.

**Why:** On Conscious Compute, an unlayered `a { color: inherit }` reset would silently override every Tailwind text color on links (for example making them invisible on a light background).

**How to apply:** Put any element-selector rule (`a`, `h1`, `body`...) in `globals.css` inside `@layer base { }`. If a Tailwind class seems to "do nothing", look for an unlayered rule winning before blaming the class.

**Related gotcha (found here, 2026-10-22):** don't give a next/font `variable` the same name as a `@theme` token. `--font-serif: var(--font-serif), Georgia` refers to itself and only works by cascade luck. Fonts use `--font-fraunces` / `--font-plex-mono`, and the theme maps them to `--font-serif` / `--font-mono`.
