import { PineconeClient } from "@pinecone-database/pinecone";

const pinecone = new PineconeClient();

export async function initPinecone() {
  const apiKey = process.env.PINECONE_API_KEY;
  const env = process.env.PINECONE_ENVIRONMENT;
  if (!apiKey || !env) throw new Error("PINECONE_API_KEY or PINECONE_ENVIRONMENT missing");
  await pinecone.init({ apiKey, environment: env });
}

export function getIndex(name: string) {
  return pinecone.Index(name);
}

export async function ensureIndex(name: string, dims: number) {
  const existing = await pinecone.listIndexes();
  if (!existing.includes(name)) {
    await pinecone.createIndex({
      createRequest: {
        name,
        dimension: dims,
        metric: "cosine",
      },
    });
    await new Promise((r) => setTimeout(r, 2000));
  }
}
