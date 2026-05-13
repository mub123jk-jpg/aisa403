import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Sparkles } from "lucide-react";
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
  "Explain a hard idea simply",
  "Help me draft something",
  "Brainstorm ideas with me",
  "Walk me through a plan",
];

export function ChatWindow({ threadId }: { threadId: string }) {
  // Initialize empty for SSR-safe render, hydrate from storage in effect.
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

  // persist messages + thread title
  useEffect(() => {
    if (!hydrated || messages.length === 0) return;
    saveMessages(threadId, messages);
    const firstUser = messages.find((m) => m.role === "user");
    let title = "New chat";
    if (firstUser) {
      const txt = firstUser.parts
        .map((p) => (p.type === "text" ? p.text : ""))
        .join(" ")
        .trim();
      if (txt) title = txt.slice(0, 50);
    }
    upsertThread({ id: threadId, title, updatedAt: Date.now() });
    window.dispatchEvent(new Event("nova:threads-changed"));
  }, [messages, threadId, hydrated]);

  // focus textarea
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

  return (
    <div className="flex h-full flex-col bg-background">
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
                    I'm Nova. Ask me anything — I'll think it through and stream
                    a clear answer back to you.
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
              const text = m.parts
                .map((p) => (p.type === "text" ? p.text : ""))
                .join("");
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
                        <MessageResponse>{text}</MessageResponse>
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
                <Shimmer className="pt-1.5 text-sm">
                  Nova is thinking…
                </Shimmer>
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
            <PromptInputTextarea
              ref={inputRef}
              placeholder="Message Nova…"
            />
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
