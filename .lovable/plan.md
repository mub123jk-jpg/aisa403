# Switch model + fix build errors

Three small fixes (I can't apply them from plan mode — approve this plan to run them).

## Changes

1. **`src/routes/api/chat.ts`** — switch model id from `google/gemini-3-flash-preview` to **`google/gemini-2.5-flash-lite`** (cheapest free-tier option since DeepSeek isn't on the Lovable AI gateway).
2. **`wrangler.jsonc`** — remove the dangling `"main": "src/server.ts"` line (that file was deleted earlier, breaking the build).
3. **`src/components/chat-window.tsx`** (lines 293–297) — add TS types to the `escapeHtml` helper so strict TS stops failing:
   ```ts
   const escapeMap: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
   const escapeHtml = (str: string) => str.replace(/[&<>"']/g, (c) => escapeMap[c]);
   ```
