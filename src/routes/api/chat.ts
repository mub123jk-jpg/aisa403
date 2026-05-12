import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";

type ChatRequestBody = {
  messages?: unknown;
  knowledge?: string;
};

const SYSTEM_BASE = `You are Nova, a helpful, thoughtful, and articulate AI assistant.
Answer clearly and conversationally. Use Markdown for formatting when helpful (lists, code blocks, headings).
You can reason about almost any topic. Be honest about uncertainty.`;

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
          system += `\n\n---\nThe user has provided the following custom knowledge base. Treat it as authoritative reference material for their world. When the user asks something covered here, prefer this knowledge over general knowledge, and cite the source name in parentheses where relevant.\n\n${trimmed}`;
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
