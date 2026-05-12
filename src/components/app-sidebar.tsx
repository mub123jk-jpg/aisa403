import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, MessageSquare, Trash2, BookOpen } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  loadThreads,
  upsertThread,
  deleteThread,
  newThreadId,
  type ThreadMeta,
} from "@/lib/storage";
import novaLogo from "@/assets/nova-logo.png";
import { KnowledgeDialog } from "./knowledge-dialog";

export function AppSidebar() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [threads, setThreads] = useState<ThreadMeta[]>([]);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);

  const refresh = () => setThreads(loadThreads());

  useEffect(() => {
    refresh();
    const onStorage = () => refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener("nova:threads-changed", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("nova:threads-changed", onStorage);
    };
  }, []);

  const handleNew = () => {
    const id = newThreadId();
    upsertThread({ id, title: "New chat", updatedAt: Date.now() });
    window.dispatchEvent(new Event("nova:threads-changed"));
    navigate({ to: "/chat/$threadId", params: { threadId: id } });
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    deleteThread(id);
    refresh();
    if (pathname.includes(id)) navigate({ to: "/" });
  };

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4">
        <Link to="/" className="flex items-center gap-2">
          <img
            src={novaLogo}
            alt="Nova logo"
            width={32}
            height={32}
            className="h-8 w-8"
          />
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight">Nova</span>
            <span className="text-xs text-muted-foreground">Your AI</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <div className="px-3 pb-2">
          <Button
            onClick={handleNew}
            className="w-full justify-start gap-2"
            style={{ background: "var(--gradient-nova)", color: "var(--primary-foreground)" }}
          >
            <Plus className="h-4 w-4" />
            New chat
          </Button>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Conversations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {threads.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  No chats yet. Start a new conversation.
                </p>
              )}
              {threads.map((t) => {
                const isActive = pathname === `/chat/${t.id}`;
                return (
                  <SidebarMenuItem key={t.id}>
                    <div className="group/thread relative flex items-center">
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link
                          to="/chat/$threadId"
                          params={{ threadId: t.id }}
                          className="flex items-center gap-2 pr-8"
                        >
                          <MessageSquare className="h-4 w-4 shrink-0" />
                          <span className="truncate">{t.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, t.id)}
                        aria-label="Delete chat"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground opacity-0 hover:bg-destructive/20 hover:text-destructive group-hover/thread:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-3 pb-4">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => setKnowledgeOpen(true)}
        >
          <BookOpen className="h-4 w-4" />
          Knowledge base
        </Button>
        <p className="mt-2 px-1 text-[10px] text-muted-foreground">
          Saved in this browser only
        </p>
      </SidebarFooter>

      <KnowledgeDialog open={knowledgeOpen} onOpenChange={setKnowledgeOpen} />
    </Sidebar>
  );
}
