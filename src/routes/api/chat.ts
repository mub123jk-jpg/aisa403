import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";

type ChatRequestBody = {
  messages?: unknown;
  knowledge?: string;
};

const SYSTEM_BASE = `You are Nova — a sharp, versatile, and highly intelligent AI. You handle everything in one unified brain: casual chat, deep coding, research, creative work, life advice. No switching, no limitations.

You can ALSO use tools when they actually help the user:
- generate_image — draw or generate a picture from a description.
- web_search — look something up on the live internet, then summarize the results.
- explain_for_kid — when the user wants a kid-friendly summary of something (often paired with web_search), call this so the UI can play it out loud in the Magnus voice.
- make_html_file — produce a complete, downloadable, single-file HTML page (with inline CSS and JS, custom animations, etc.) the user can download.

Tool rules:
- Only call a tool when it genuinely helps. For pure chat / explanation, just talk.
- After a tool returns, briefly comment in your own voice — do NOT re-print the raw output.
- For HTML files: always produce a COMPLETE standalone <!doctype html> document, with everything inlined. Make it polished, animated, and beautiful.
- For images: write vivid, specific prompts.

━━━ TONE & VIBE ━━━

Match the user's energy. Casual when they're casual, deep when they're deep. Gen Z fluency when it fits, never forced. Max 1 emoji per message. No sycophantic openers. No filler closings. Never repeat the same closing twice.

If someone is rude, clap back — playful, savage, never the same comeback twice.

━━━ HONESTY ━━━

Never invent facts, URLs, quotes, or stats. If unsure, say so. If you don't know, say "I don't know" and suggest where to look (or just web_search it).

━━━ FORMATTING ━━━

Markdown when it helps. Lead with the answer. Code in fenced blocks. Lists only when content needs them. For coding requests, output complete working code with no TODOs.`;

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
        const model = gateway("google/gemini-2.5-flash-lite");

        let system = SYSTEM_BASE;
        if (knowledge && knowledge.trim().length > 0) {
          const trimmed = knowledge.slice(0, 120_000);
          system += `\n\nAdditional context you simply know about (treat this as your own background knowledge — never mention that it was given to you, never cite source names; just answer naturally as if you've always known it):\n\n${trimmed}`;
        }

        const tools = {
          generate_image: tool({
            description:
              "Generate an image from a text prompt. Returns an image the UI displays inline.",
            inputSchema: z.object({
              prompt: z
                .string()
                .min(3)
                .describe("Vivid, specific description of the image to generate."),
            }),
            execute: async ({ prompt }) => {
              try {
                const r = await fetch(
                  "https://ai.gateway.lovable.dev/v1/chat/completions",
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Lovable-API-Key": key,
                      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
                    },
                    body: JSON.stringify({
                      model: "google/gemini-2.5-flash-image",
                      messages: [{ role: "user", content: prompt }],
                      modalities: ["image", "text"],
                    }),
                  },
                );
                if (!r.ok) {
                  const txt = await r.text();
                  return { ok: false, error: `Image API ${r.status}: ${txt.slice(0, 200)}` };
                }
                const data = (await r.json()) as any;
                const msg = data?.choices?.[0]?.message;
                const imageUrl: string | undefined =
                  msg?.images?.[0]?.image_url?.url ??
                  msg?.images?.[0]?.url ??
                  (Array.isArray(msg?.content)
                    ? msg.content.find((c: any) => c?.image_url)?.image_url?.url
                    : undefined);
                if (!imageUrl) {
                  return { ok: false, error: "No image returned." };
                }
                return { ok: true, imageUrl, prompt };
              } catch (e: any) {
                return { ok: false, error: e?.message ?? "Image generation failed." };
              }
            },
          }),

          web_search: tool({
            description:
              "Search the live web and return short text snippets. Use when the user asks about current events, specific facts, or wants you to look something up.",
            inputSchema: z.object({
              query: z.string().min(2).describe("Search query."),
            }),
            execute: async ({ query }) => {
              try {
                const r = await fetch(
                  `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
                );
                const data = (await r.json()) as any;
                const results: { title: string; snippet: string; url?: string }[] = [];
                if (data.AbstractText) {
                  results.push({
                    title: data.Heading || query,
                    snippet: data.AbstractText,
                    url: data.AbstractURL,
                  });
                }
                for (const t of (data.RelatedTopics ?? []).slice(0, 6)) {
                  if (t.Text) {
                    results.push({
                      title: t.Text.slice(0, 80),
                      snippet: t.Text,
                      url: t.FirstURL,
                    });
                  }
                }
                if (results.length === 0) {
                  return { ok: false, error: "No results.", query };
                }
                return { ok: true, query, results };
              } catch (e: any) {
                return { ok: false, error: e?.message ?? "Search failed." };
              }
            },
          }),

          explain_for_kid: tool({
            description:
              "Produce a kid-friendly explanation (5–8 year old level) of a topic. The UI will offer a button to play it aloud in the Magnus voice. Use after web_search when the user asks for a kid-friendly summary, or any time they ask you to ELI5 something.",
            inputSchema: z.object({
              topic: z.string().min(2),
              explanation: z
                .string()
                .min(20)
                .describe(
                  "The kid-friendly explanation itself. Short sentences. Simple words. Friendly tone.",
                ),
            }),
            execute: async ({ topic, explanation }) => {
              return { ok: true, topic, explanation };
            },
          }),

          make_html_file: tool({
            description:
              "Build a COMPLETE single-file HTML document (inline CSS/JS, custom animations) the user can download. Use when the user asks for a webpage, demo, animation, mini-app, game, or similar.",
            inputSchema: z.object({
              filename: z
                .string()
                .min(1)
                .describe("Filename ending in .html, e.g. 'starfield.html'."),
              title: z.string().min(1),
              html: z
                .string()
                .min(50)
                .describe(
                  "FULL <!doctype html> document with everything inlined. Polished, animated, beautiful.",
                ),
            }),
            execute: async ({ filename, title, html }) => {
              const safeName = filename.endsWith(".html") ? filename : `${filename}.html`;
              return { ok: true, filename: safeName, title, html };
            },
          }),
        };

        const result = streamText({
          model,
          system,
          tools,
          stopWhen: stepCountIs(50),
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
