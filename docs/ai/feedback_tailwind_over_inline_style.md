# Tailwind Over Inline Style

> Tailwind utilities and shared tokens, not inline style or one-off values

Conscious Compute rule (2026-10-22, "you can use tailwind css"): Tailwind classes everywhere instead of inline `style={{...}}`, and one shared style and color system instead of one-off values on each page.

**How it's set up here:** colors are CSS variables in `:root` in `src/app/globals.css`, exposed as Tailwind tokens in `@theme inline` (`bg-paper`, `text-ink`, `text-violet`, `border-rule`, `bg-wash`, `border-rust`, `font-serif`, `font-mono`). Article typography for `h1`, `h2`, `p`, `a` lives in `@layer base` written with `@apply`.

**How to apply:** Use the tokens. For a true one-off use arbitrary values (`text-[0.85rem]`). Only values computed per render (e.g. an animation delay from a loop index) stay inline. If a pattern repeats, make it a small component (see `DataTable`, `TestBox`, `Note` in `src/app/page.tsx`).
