import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Download, Loader2, Sparkles, Volume2, VolumeX } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import {
  loadMessages,
  saveMessages,
  upsertThread,
  loadKnowledge,
  knowledgeAsContext,
} from "@/lib/storage";
import novaLogo from "@/assets/nova-logo.png";
import { toast } from "sonner";

const SUGGESTIONS = [
  "Draw me a neon astronaut on Mars",
  "Search what's new in AI today",
  "Build a downloadable HTML starfield",
  "Explain quantum computing for a kid",
];

function downloadHtml(filename: string, html: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function SpeakButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setState("idle");
  };

  const speak = async () => {
    if (state === "playing") return stop();
    setState("loading");
    try {
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!r.ok) throw new Error(await r.text());
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setState("idle");
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setState("idle");
        toast.error("Couldn't play audio");
      };
      await audio.play();
      setState("playing");
    } catch (e: any) {
      setState("idle");
      toast.error(e?.message?.slice(0, 120) || "TTS failed");
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={speak}
      className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
    >
      {state === "loading" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : state === "playing" ? (
        <VolumeX className="h-3.5 w-3.5" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" />
      )}
      {state === "playing" ? "Stop" : "Listen"}
    </Button>
  );
}

function ToolPart({ part }: { part: any }) {
  const type: string = part.type;
  const state: string = part.state;
  const name = type.startsWith("tool-") ? type.slice(5) : type;
  const out = part.output;

  if (state !== "output-available") {
    const label =
      name === "generate_image"
        ? "Drawing image…"
        : name === "web_search"
          ? "Searching the web…"
          : name === "make_html_file"
            ? "Building HTML file…"
            : name === "explain_for_kid"
              ? "Simplifying…"
              : "Working…";
    return (
      <div className="my-2 flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {label}
      </div>
    );
  }

  if (!out?.ok) {
    return (
      <div className="my-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        {out?.error || "Tool failed"}
      </div>
    );
  }

  if (name === "generate_image") {
    return (
      <figure className="my-3 overflow-hidden rounded-xl border border-border/60 bg-card/40">
        <img
          src={out.imageUrl}
          alt={out.prompt}
          className="h-auto w-full max-w-lg"
        />
        <figcaption className="px-3 py-2 text-xs text-muted-foreground">
          {out.prompt}
        </figcaption>
      </figure>
    );
  }

  if (name === "web_search") {
    return (
      <div className="my-3 rounded-xl border border-border/60 bg-card/40 p-3 text-sm">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          Web search · {out.query}
        </div>
        <ul className="space-y-2">
          {out.results.slice(0, 5).map((r: any, i: number) => (
            <li key={i} className="text-sm">
              {r.url ? (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  {r.title}
                </a>
              ) : (
                <span className="font-medium">{r.title}</span>
              )}
              <p className="text-xs text-muted-foreground">{r.snippet}</p>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (name === "explain_for_kid") {
    return (
      <div className="my-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div className="mb-1 text-xs font-medium text-primary">
          For a kid · {out.topic}
        </div>
        <p className="text-sm leading-relaxed text-foreground">
          {out.explanation}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <SpeakButton text={out.explanation} />
          <span className="text-[10px] text-muted-foreground">
            Magnus voice
          </span>
        </div>
      </div>
    );
  }

  if (name === "make_html_file") {
    return (
      <div className="my-3 flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/40 p-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{out.title}</div>
          <div className="truncate text-xs text-muted-foreground">
            {out.filename} · {Math.round((out.html?.length ?? 0) / 1024)} KB
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => downloadHtml(out.filename, out.html)}
          className="gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </Button>
      </div>
    );
  }

  return null;
}

export function ChatWindow({ threadId }: { threadId: string }) {
  const [initial, setInitial] = useState<UIMessage[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [knowledge, setKnowledge] = useState<string>("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setInitial(loadMessages(threadId));
    setKnowledge(knowledgeAsContext(loadKnowledge()));
    setHydrated(true);
  }, [threadId]);

  const transport = new DefaultChatTransport({
    api: "/api/chat",
    body: () => ({ knowledge }),
  });

  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initial,
    transport,
    onError: (err) => {
      console.error(err);
      toast.error("Something went wrong. Try again.");
    },
  });

  useEffect(() => {
    if (!hydrated || messages.length === 0) return;
    saveMessages(threadId, messages);
    const firstUser = messages.find((m) => m.role === "user");
    let title = "New chat";
    if (firstUser) {
      const txt = firstUser.parts
        .map((p: any) => (p.type === "text" ? p.text : ""))
        .join(" ")
        .trim();
      if (txt) title = txt.slice(0, 50);
    }
    upsertThread({ id: threadId, title, updatedAt: Date.now() });
    window.dispatchEvent(new Event("nova:threads-changed"));
  }, [messages, threadId, hydrated]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId, status]);

  const handleSubmit = async (msg: PromptInputMessage) => {
    if (!msg.text?.trim()) return;
    await sendMessage({ text: msg.text });
  };

  const handleSuggestion = async (text: string) => {
    await sendMessage({ text });
  };

  const isLoading = status === "submitted" || status === "streaming";

  const handleDownloadChat = () => {
    const escapeMap: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    const escapeHtml = (str: string) =>
      str.replace(/[&<>"']/g, (c) => escapeMap[c]);
    const rows = messages
      .map((m) => {
        const text = (m.parts || [])
          .filter((p) => p.type === "text")
          .map((p) => p.text)
          .join("\n");
        const isUser = m.role === "user";
        return `<div class="msg ${isUser ? "user" : "assistant"}"><div class="role">${isUser ? "You" : "Nova"}</div><div class="bubble">${escapeHtml(text).replace(/\n/g, "<br/>")}</div></div>`;
      })
      .join("\n");
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>Nova chat export</title><meta name="viewport" content="width=device-width,initial-scale=1"/><style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:radial-gradient(1200px 600px at 20% -10%,#2a1a4a 0%,transparent 60%),#0b0a14;color:#e7e6f0;padding:32px 16px}.wrap{max-width:760px;margin:0 auto}header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#7c3aed,#22d3ee);box-shadow:0 0 30px rgba(124,58,237,.5)}h1{font-size:20px;margin:0;background:linear-gradient(135deg,#c4b5fd,#67e8f9);-webkit-background-clip:text;background-clip:text;color:transparent}.meta{color:#a1a1b3;font-size:12px;margin-top:2px}.msg{margin:18px 0;display:flex;flex-direction:column;gap:6px}.msg.user{align-items:flex-end}.role{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#a1a1b3}.bubble{max-width:90%;padding:12px 16px;border-radius:16px;line-height:1.55;white-space:pre-wrap;word-wrap:break-word}.user .bubble{background:linear-gradient(135deg,#7c3aed,#6366f1);color:#fff;border-bottom-right-radius:4px}.assistant .bubble{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-bottom-left-radius:4px}footer{margin-top:32px;color:#6b6b80;font-size:12px;text-align:center}</style></head><body><div class="wrap"><header><div class="logo"></div><div><h1>Nova conversation</h1><div class="meta">Exported ${new Date().toLocaleString()} · ${messages.length} messages</div></div></header>${rows}<footer>Generated by Nova</footer></div></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nova-chat-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {messages.length > 0 && (
        <div className="flex justify-end border-b border-border/40 bg-background/60 px-4 py-2 backdrop-blur">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDownloadChat}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5" />
            Download as HTML
          </Button>
        </div>
      )}
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-8">
          {messages.length === 0 ? (
            <ConversationEmptyState className="py-16">
              <div className="flex flex-col items-center gap-5 text-center">
                <div
                  className="flex h-20 w-20 items-center justify-center rounded-2xl shadow-[var(--shadow-glow)]"
                  style={{ background: "var(--gradient-nova)" }}
                >
                  <img
                    src={novaLogo}
                    alt=""
                    width={56}
                    height={56}
                    className="h-14 w-14"
                  />
                </div>
                <div className="space-y-2">
                  <h1
                    className="text-3xl font-semibold tracking-tight bg-clip-text text-transparent"
                    style={{ backgroundImage: "var(--gradient-nova)" }}
                  >
                    How can I help today?
                  </h1>
                  <p className="max-w-md text-sm text-muted-foreground">
                    I'm Nova. Ask me anything — I can draw, search, build
                    downloadable HTML, and explain things out loud.
                  </p>
                </div>
                <div className="mt-2 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSuggestion(s)}
                      className="group rounded-xl border border-border/70 bg-card/40 px-4 py-3 text-left text-sm transition hover:border-primary/50 hover:bg-card hover:shadow-[var(--shadow-glow)]"
                    >
                      <Sparkles className="mb-1.5 h-3.5 w-3.5 text-primary opacity-70 transition group-hover:opacity-100" />
                      <div className="text-foreground/90">{s}</div>
                    </button>
                  ))}
                </div>
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((m) => {
              const textParts = m.parts.filter(
                (p: any) => p.type === "text",
              ) as any[];
              const toolParts = m.parts.filter((p: any) =>
                p.type?.startsWith("tool-"),
              );
              const text = textParts.map((p) => p.text).join("");

              return (
                <Message key={m.id} from={m.role}>
                  {m.role === "assistant" ? (
                    <div className="flex w-full gap-3">
                      <div
                        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-[var(--shadow-glow)]"
                        style={{ background: "var(--gradient-nova)" }}
                      >
                        <img
                          src={novaLogo}
                          alt=""
                          width={20}
                          height={20}
                          className="h-5 w-5"
                        />
                      </div>
                      <div className="nova-prose min-w-0 flex-1">
                        {toolParts.map((p: any, i: number) => (
                          <ToolPart key={i} part={p} />
                        ))}
                        {text && <MessageResponse>{text}</MessageResponse>}
                        {text && (
                          <div className="mt-1 -ml-2 opacity-0 transition group-hover:opacity-100">
                            <SpeakButton text={text} />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <MessageContent>{text}</MessageContent>
                  )}
                </Message>
              );
            })
          )}
          {status === "submitted" && (
            <Message from="assistant">
              <div className="flex w-full gap-3">
                <div
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-[var(--shadow-glow)]"
                  style={{ background: "var(--gradient-nova)" }}
                >
                  <img
                    src={novaLogo}
                    alt=""
                    width={20}
                    height={20}
                    className="h-5 w-5"
                  />
                </div>
                <Shimmer className="pt-1.5 text-sm">Nova is thinking…</Shimmer>
              </div>
            </Message>
          )}
          {error && (
            <p className="text-sm text-destructive">
              {error.message || "Request failed"}
            </p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border/60 bg-gradient-to-b from-transparent to-background/80 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-4 py-4">
          <PromptInput
            onSubmit={handleSubmit}
            className="rounded-2xl border-border/70 bg-card/60 shadow-lg backdrop-blur transition focus-within:border-primary/50 focus-within:shadow-[var(--shadow-glow)]"
          >
            <PromptInputTextarea ref={inputRef} placeholder="Message Nova…" />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit
                status={status}
                disabled={isLoading}
                size="icon-sm"
                className="rounded-full"
                style={{
                  background: "var(--gradient-nova)",
                  color: "var(--primary-foreground)",
                }}
              />
            </PromptInputFooter>
          </PromptInput>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Nova can be wrong sometimes — double-check anything important.
          </p>
        </div>
      </div>
    </div>
  );
}
