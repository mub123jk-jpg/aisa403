import fs from "fs";
import path from "path";
import glob from "glob";
import { embedTexts } from "./openaiClient";
import { initPinecone, ensureIndex, getIndex } from "./pineconeClient";

const ROOT = process.env.SEARCH_SOURCE_DIR ?? path.resolve(process.cwd(), "agents");
const INDEX = process.env.PINECONE_INDEX_NAME ?? "aisa403-search";
const BATCH = Number(process.env.EMBED_BATCH_SIZE ?? 16);

function fileList(root: string) {
  const patterns = ["**/*.{ts,js,json,md,txt}"];
  const files = patterns.flatMap((p) => glob.sync(p, { cwd: root, absolute: true }));
  return files;
}

function docFromFile(filePath: string) {
  const content = fs.readFileSync(filePath, "utf8");
  return {
    id: path.relative(process.cwd(), filePath),
    text: content,
    metadata: {
      path: path.relative(process.cwd(), filePath),
      filename: path.basename(filePath),
      snippet: content.slice(0, 800),
    },
  };
}

export async function buildAndUpsertIndex(progressCb?: (n: number, total: number) => void) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");
  await initPinecone();

  const files = fileList(ROOT);
  const docs = files.map(docFromFile);
  if (docs.length === 0) return { indexed: 0 };

  const sampleEmb = await embedTexts([docs[0].text.slice(0, 1000)]);
  const dims = sampleEmb[0].length;
  await ensureIndex(INDEX, dims);
  const index = getIndex(INDEX);

  for (let i = 0; i < docs.length; i += BATCH) {
    const batch = docs.slice(i, i + BATCH);
    const texts = batch.map((d) => d.text);
    const vectors = await embedTexts(texts);
    const upserts = vectors.map((vec, idx) => ({
      id: batch[idx].id,
      values: vec,
      metadata: batch[idx].metadata,
    }));
    await index.upsert({ upsertRequest: { vectors: upserts } });
    progressCb?.(Math.min(i + upserts.length, docs.length), docs.length);
  }

  return { indexed: docs.length };
}
