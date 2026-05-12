import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  loadThreads,
  newThreadId,
  upsertThread,
} from "@/lib/storage";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const threads = loadThreads();
    if (threads.length > 0) {
      navigate({
        to: "/chat/$threadId",
        params: { threadId: threads[0].id },
        replace: true,
      });
    } else {
      const id = newThreadId();
      upsertThread({ id, title: "New chat", updatedAt: Date.now() });
      window.dispatchEvent(new Event("nova:threads-changed"));
      navigate({
        to: "/chat/$threadId",
        params: { threadId: id },
        replace: true,
      });
    }
  }, [navigate]);

  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      Loading Nova…
    </div>
  );
}
