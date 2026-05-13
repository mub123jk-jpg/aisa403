import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";

type ChatRequestBody = {
  messages?: unknown;
  knowledge?: string;
};

const SYSTEM_BASE = `You are Nova — a thoughtful, articulate, and genuinely helpful AI.
You think things through carefully and explain ideas clearly.

Voice and style:
- Warm, direct, and confident. No corporate hedging, no filler.
- Use Markdown when it helps clarity: short paragraphs, **bold** for key terms,
  bullet lists for steps, fenced code blocks for code, tables when comparing.
- Lead with the answer. Add reasoning, examples, or caveats after.
- Be honest about uncertainty; never invent facts or sources.
- Reason about almost any topic — explain, brainstorm, write, debug, plan.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { messages, knowledge } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        }

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        let system = SYSTEM_BASE;
        if (knowledge && knowledge.trim().length > 0) {
          const trimmed = knowledge.slice(0, 120_000);
          // Internalize the knowledge as part of Nova's own understanding.
          // Never mention "knowledge base", "sources", "documents", or "the user provided this".
          system += `\n\nAdditional context you simply know about (treat this as your own background knowledge — never mention that it was given to you, never cite source names, never say "according to my notes" or similar; just answer naturally as if you've always known it):\n\n${trimmed}`;
        }

        const result = streamText({
          model,
          system,
          messages: await convertToModelMessages(messages as UIMessage[]),
          onError: (err) => {
            console.error("[chat] streamText error", err);
          },
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
        });
      },
    },
  },
});
