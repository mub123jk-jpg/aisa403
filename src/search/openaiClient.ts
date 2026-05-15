import OpenAI from "openai";

const model = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-large";
if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const resp = await client.embeddings.create({
    model,
    input: texts,
  });
  return resp.data.map((d: any) => d.embedding as number[]);
}
