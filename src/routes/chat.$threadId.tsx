import { createFileRoute, useParams } from "@tanstack/react-router";
import { ChatWindow } from "@/components/chat-window";

export const Route = createFileRoute("/chat/$threadId")({
  component: ChatPage,
});

function ChatPage() {
  const { threadId } = useParams({ from: "/chat/$threadId" });
  return <ChatWindow key={threadId} threadId={threadId} />;
}
