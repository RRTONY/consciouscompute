// Cheap, mechanical checks for this project's house rules (AGENTS.md), run on proposed file
// content before it is written. Type check, lint and build run in GitHub Actions on every change
// (.github/workflows/checks.yml) and gate publishing, so ESLint isn't bundled into the server
// function (in ramprate-ui that grew the function to ~100 MB and broke once in production).

export interface CodeCheckResult {
  path: string;
  issues: string[];
  note: string;
}

const PATTERN_CHECKS: Array<{ test: (content: string, filePath: string) => boolean; message: string }> = [
  {
    test: (c, f) => /\.(tsx?|css)$/.test(f) && !f.endsWith("globals.css") && /#[0-9a-fA-F]{3,8}\b/.test(c),
    message: "Raw hex color found. Use the design tokens (bg-paper, text-ink, text-violet...) from globals.css.",
  },
  {
    test: (c, f) => /\.tsx$/.test(f) && /<img[\s>]/.test(c),
    message: "Raw <img> tag found. Use next/image's <Image> instead.",
  },
  {
    test: (c, f) => /\.tsx$/.test(f) && /style=\{\{/.test(c),
    message: "Inline style={{...}} found. Use Tailwind classes (only per-render computed values may stay inline).",
  },
  {
    test: (c) => /from ["'](framer-motion|motion|react-icons|lucide-react)["']/.test(c),
    message: "Animation or icon library import found. No new dependencies; icons are inline SVG in src/components/icons.tsx.",
  },
  {
    test: (c, f) => /\.tsx$/.test(f) && /\bmax-(sm|md|lg|xl):/.test(c),
    message: "Desktop-first max-*: variant found. Styles are mobile first: write the phone style unprefixed and add sm:/md: for larger screens.",
  },
  {
    test: (c, f) => f === "src/app/layout.tsx" && !/index:\s*false/.test(c),
    message: "The noindex setting in layout.tsx is missing. The author asked to keep noindex/nofollow.",
  },
  {
    test: (c, f) => f === "src/app/page.tsx" && !/Temporary placement/.test(c),
    message: "The \"Temporary placement\" notice is missing from the page. The author asked to keep it.",
  },
];

export function checkCode(filePath: string, content: string): CodeCheckResult {
  const issues = PATTERN_CHECKS.filter((p) => p.test(content, filePath)).map((p) => p.message);
  return {
    path: filePath,
    issues,
    note: "House-rule check only. Type check, lint and build run automatically on the change and must pass before it can be published (see list_pending_changes).",
  };
}
