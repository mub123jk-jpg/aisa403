import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
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

export function ChatWindow({ threadId }: { threadId: string }) {
  const [initial] = useState<UIMessage[]>(() => loadMessages(threadId));
  const [knowledge, setKnowledge] = useState<string>(() =>
    knowledgeAsContext(loadKnowledge()),
  );
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const refresh = () => setKnowledge(knowledgeAsContext(loadKnowledge()));
    window.addEventListener("nova:knowledge-changed", refresh);
    return () => window.removeEventListener("nova:knowledge-changed", refresh);
  }, []);

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
    if (messages.length === 0) return;
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
  }, [messages, threadId]);

  // focus textarea
  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId, status]);

  const handleSubmit = async (msg: PromptInputMessage) => {
    if (!msg.text?.trim()) return;
    await sendMessage({ text: msg.text });
  };

  const isLoading = status === "submitted" || status === "streaming";

  return (
    <div className="flex h-full flex-col">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={
                <img
                  src={novaLogo}
                  alt=""
                  width={64}
                  height={64}
                  className="h-16 w-16"
                />
              }
              title="How can I help today?"
              description="Ask me anything. Add HTML files or notes to the Knowledge base and I'll use them as my reference."
            />
          ) : (
            messages.map((m) => {
              const text = m.parts
                .map((p) => (p.type === "text" ? p.text : ""))
                .join("");
              return (
                <Message key={m.id} from={m.role}>
                  {m.role === "assistant" ? (
                    <MessageResponse>{text}</MessageResponse>
                  ) : (
                    <MessageContent>{text}</MessageContent>
                  )}
                </Message>
              );
            })
          )}
          {status === "submitted" && (
            <Message from="assistant">
              <Shimmer>Nova is thinking…</Shimmer>
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

      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea
            ref={inputRef}
            placeholder="Message Nova…"
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit
              status={status}
              disabled={isLoading}
              size="icon-sm"
            />
          </PromptInputFooter>
        </PromptInput>
        {knowledge && (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Using your knowledge base ({knowledge.length.toLocaleString()} chars)
          </p>
        )}
      </div>
    </div>
  );
}
