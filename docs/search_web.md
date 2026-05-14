# Web + Repo Search (how-to)

This repository now includes tools to let an AI agent (or you) search both the repository source files and arbitrary websites. The approach is:

- Extract repo text into search/corpus.json (already present via scripts/extract_corpus.js).
- Optionally crawl websites and extract page text into search/web_corpus.json using scripts/crawl_sites.js.
- Combine repo + web corpora and build an ElasticLunr index at search/index.json.
- Use scripts/search_index.js to query the combined index.

Quick start

1. Install dependencies:

   npm install

2. Generate the repo corpus:

   node scripts/extract_corpus.js

3. (Optional) Create a file search/crawl_urls.txt listing one seed URL per line, or pass seed URLs as command-line arguments. Example:

   echo "https://example.com" > search/crawl_urls.txt

   Then run the crawler (it will follow links up to depth 1 by default):

   node scripts/crawl_sites.js

   Or pass URLs directly:

   node scripts/crawl_sites.js https://example.com https://wikipedia.org

4. Build the combined index:

   node scripts/build_index.js

5. Search:

   node scripts/search_index.js "your query"

Notes and safety

- The crawler is basic and follows links; be considerate when crawling external sites. Do not set seeds that cause heavy scraping. The crawler is capped at 200 pages by default.
- Running the crawler on many sites may require more robust politeness (robots.txt, delays) — this tool is intentionally simple so you can customize it.
- For better semantic search across the web, consider creating embeddings (OpenAI/Cohere/etc.) and storing them in a vector DB (e.g., Pinecone, Weaviate). I can add an embeddings pipeline if you want — you'll need an API key.

Integrating with an AI agent

- If your agent is running locally, make sure it reads search/index.json and/or search/combined_corpus.json and uses that to find candidate documents.
- If your agent expects embeddings, I can add a script to call an embeddings provider and save vectors for nearest-neighbor search.

Want me to also add:

- A script to create embeddings with OpenAI and store them in a simple SQLite vector table or JSON file; or
- A GitHub Action that runs the extractor and indexer on push (I intentionally omitted automatic crawling in CI for safety).

Tell me which additional piece you want next and I will add it and commit it to the repo.