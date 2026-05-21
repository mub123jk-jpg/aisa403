# Switch chat model

DeepSeek isn't available on the built-in Lovable AI gateway, so we'll stay on the gateway and swap to the cheapest free-tier-friendly model: **`google/gemini-2.5-flash-lite`** (fastest + lowest cost).

## Change

- `src/routes/api/chat.ts`: change the model id from `google/gemini-3-flash-preview` to `google/gemini-2.5-flash-lite`. No other code changes.

That's the entire change — one line.
