import express from "express";
import { embedTexts } from "../search/openaiClient";
import { initPinecone, getIndex } from "../search/pineconeClient";
import { buildAndUpsertIndex } from "../search/indexer";

const router = express.Router();
const INDEX = process.env.PINECONE_INDEX_NAME ?? "aisa403-search";
const REQUIRE_API_KEY = process.env.SEARCH_API_KEY; // simple protection

function requireApiKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!REQUIRE_API_KEY) return next();
  const key = (req.headers["x-api-key"] ?? req.query.apiKey) as string | undefined;
  if (key !== REQUIRE_API_KEY) return res.status(401).json({ error: "invalid api key" });
  next();
}

router.post("/index", requireApiKey, async (req, res) => {
  try {
    const result = await buildAndUpsertIndex((n, total) => {
      console.log(`Indexed ${n}/${total}`);
    });
    res.json({ ok: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

router.get("/search", requireApiKey, async (req, res) => {
  const q = String(req.query.q || "");
  const topK = Number(req.query.topK || 5);
  if (!q) return res.status(400).json({ error: "q required" });

  try {
    await initPinecone();
    const index = getIndex(INDEX);
    const qVec = (await embedTexts([q]))[0];
    const resp = await index.query({
      queryRequest: { vector: qVec, topK, includeMetadata: true, includeValues: false },
    });
    const matches = resp.matches ?? [];
    res.json({ query: q, results: matches });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
