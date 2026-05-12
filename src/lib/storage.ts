import type { UIMessage } from "ai";
import { nanoid } from "nanoid";

const THREADS_KEY = "nova.threads.v1";
const MESSAGES_PREFIX = "nova.messages.v1.";
const KNOWLEDGE_KEY = "nova.knowledge.v1";

export type ThreadMeta = {
  id: string;
  title: string;
  updatedAt: number;
};

export type KnowledgeItem = {
  id: string;
  name: string;
  content: string;
  source: "html" | "text" | "url";
  addedAt: number;
};

const isBrowser = () => typeof window !== "undefined";

export function loadThreads(): ThreadMeta[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(THREADS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ThreadMeta[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveThreads(threads: ThreadMeta[]) {
  if (!isBrowser()) return;
  localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
}

export function upsertThread(meta: ThreadMeta) {
  const threads = loadThreads();
  const idx = threads.findIndex((t) => t.id === meta.id);
  if (idx >= 0) threads[idx] = meta;
  else threads.unshift(meta);
  threads.sort((a, b) => b.updatedAt - a.updatedAt);
  saveThreads(threads);
}

export function deleteThread(id: string) {
  saveThreads(loadThreads().filter((t) => t.id !== id));
  if (isBrowser()) localStorage.removeItem(MESSAGES_PREFIX + id);
}

export function loadMessages(threadId: string): UIMessage[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(MESSAGES_PREFIX + threadId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UIMessage[]) : [];
  } catch {
    return [];
  }
}

export function saveMessages(threadId: string, messages: UIMessage[]) {
  if (!isBrowser()) return;
  localStorage.setItem(MESSAGES_PREFIX + threadId, JSON.stringify(messages));
}

export function newThreadId() {
  return nanoid(10);
}

export function loadKnowledge(): KnowledgeItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(KNOWLEDGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as KnowledgeItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveKnowledge(items: KnowledgeItem[]) {
  if (!isBrowser()) return;
  localStorage.setItem(KNOWLEDGE_KEY, JSON.stringify(items));
}

export function knowledgeAsContext(items: KnowledgeItem[]): string {
  if (items.length === 0) return "";
  return items
    .map(
      (it) =>
        `### Source: ${it.name}\n${it.content.slice(0, 30_000)}`,
    )
    .join("\n\n");
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
