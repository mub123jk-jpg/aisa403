import { useEffect, useState } from "react";
import { Trash2, Upload, Link as LinkIcon, FileText } from "lucide-react";
import { nanoid } from "nanoid";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  loadKnowledge,
  saveKnowledge,
  stripHtml,
  type KnowledgeItem,
} from "@/lib/storage";

export function KnowledgeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setItems(loadKnowledge());
  }, [open]);

  const persist = (next: KnowledgeItem[]) => {
    setItems(next);
    saveKnowledge(next);
    window.dispatchEvent(new Event("nova:knowledge-changed"));
  };

  const addItem = (item: KnowledgeItem) => {
    persist([item, ...items]);
    setName("");
    setText("");
    setUrl("");
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const raw = await file.text();
    const isHtml = /\.html?$/i.test(file.name) || raw.trim().startsWith("<");
    addItem({
      id: nanoid(8),
      name: file.name,
      content: isHtml ? stripHtml(raw) : raw,
      source: isHtml ? "html" : "text",
      addedAt: Date.now(),
    });
    e.target.value = "";
    toast.success(`Added ${file.name}`);
  };

  const handleAddText = () => {
    if (!text.trim()) return;
    addItem({
      id: nanoid(8),
      name: name.trim() || "Pasted note",
      content: text.trim(),
      source: "text",
      addedAt: Date.now(),
    });
    toast.success("Knowledge added");
  };

  const handleAddUrl = async () => {
    if (!url.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(url.trim(), { mode: "cors" });
      const html = await res.text();
      addItem({
        id: nanoid(8),
        name: name.trim() || url.trim(),
        content: stripHtml(html),
        source: "url",
        addedAt: Date.now(),
      });
      toast.success("Page indexed");
    } catch {
      toast.error("Could not fetch that URL (CORS or network).");
    } finally {
      setBusy(false);
    }
  };

  const remove = (id: string) =>
    persist(items.filter((i) => i.id !== id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Teach Nova</DialogTitle>
          <DialogDescription>
            Upload HTML files, paste URLs, or add notes. Nova will use this as
            its private knowledge when answering you.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="file" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="file">
              <Upload className="mr-2 h-4 w-4" />
              File
            </TabsTrigger>
            <TabsTrigger value="text">
              <FileText className="mr-2 h-4 w-4" />
              Text
            </TabsTrigger>
            <TabsTrigger value="url">
              <LinkIcon className="mr-2 h-4 w-4" />
              URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="space-y-3 pt-3">
            <Label>Upload HTML, MD, or TXT</Label>
            <Input
              type="file"
              accept=".html,.htm,.md,.txt,.json,.csv"
              onChange={handleFile}
            />
          </TabsContent>

          <TabsContent value="text" className="space-y-3 pt-3">
            <Input
              placeholder="Source name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Textarea
              placeholder="Paste any text — facts, notes, docs…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
            />
            <Button onClick={handleAddText} disabled={!text.trim()}>
              Add to knowledge
            </Button>
          </TabsContent>

          <TabsContent value="url" className="space-y-3 pt-3">
            <Input
              placeholder="Label (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              placeholder="https://example.com/page"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <Button onClick={handleAddUrl} disabled={!url.trim() || busy}>
              {busy ? "Fetching…" : "Fetch & add"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Some sites block cross-origin fetches. If a URL fails, paste the
              text directly.
            </p>
          </TabsContent>
        </Tabs>

        <div className="mt-2 max-h-64 overflow-auto rounded-md border border-border">
          {items.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No sources yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((it) => (
                <li
                  key={it.id}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{it.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {it.source.toUpperCase()} · {it.content.length.toLocaleString()} chars
                    </p>
                  </div>
                  <button
                    onClick={() => remove(it.id)}
                    className="rounded p-1.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
