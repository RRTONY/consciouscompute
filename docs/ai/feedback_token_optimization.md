# Claude API Cost Rules

> Model choice, no polling, max_tokens caps, prompt caching, per-app keys

Conscious Compute rule: polling the Claude API every few seconds with the most expensive model as default can cost hundreds of dollars in weeks. These rules apply if this site ever calls the Claude API.

1. **Cheapest model that does the job** (Haiku) by default. A stronger model only with a code comment saying why.
2. **No polling.** AI calls only on a user action or webhook, never `setInterval`/`setTimeout` loops.
3. **Always set `max_tokens`:** 128 to 256 classify, 1024 summary, 2048 draft, 4096 long report max.
4. **One API key per app**, with its own monthly spending limit.
5. **Prompt caching** (`cache_control: { type: "ephemeral" }`) for long system prompts sent on every request.
6. **Test cost before launch:** run it 10 times by hand and check the usage console.
7. Keys only on the server (`src/app/api/...`), never in the browser.
