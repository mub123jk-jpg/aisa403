#!/usr/bin/env node
// scripts/search_index.js
// Query search/index.json (elasticlunr) and show hits across repo + web corpus

const fs = require('fs');
const path = require('path');
const elasticlunr = require('elasticlunr');

const q = process.argv.slice(2).join(' ').trim();
if (!q) {
  console.error('Usage: node scripts/search_index.js "query"');
  process.exit(1);
}
const ROOT = process.cwd();
const INDEX_PATH = path.join(ROOT, 'search', 'index.json');
const COMBINED_PATH = path.join(ROOT, 'search', 'combined_corpus.json');

if (!fs.existsSync(INDEX_PATH) || !fs.existsSync(COMBINED_PATH)) {
  console.error('Missing index or corpus. Run: node scripts/extract_corpus.js && node scripts/crawl_sites.js (optional) && node scripts/build_index.js');
  process.exit(1);
}

const idxRaw = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
const combined = JSON.parse(fs.readFileSync(COMBINED_PATH, 'utf8'));
const idx = elasticlunr.Index.load(idxRaw.index);
const results = idx.search(q, { expand: true });

if (!results.length) {
  console.log('No results');
  process.exit(0);
}

for (const hit of results.slice(0, 30)) {
  const doc = combined.docs.find(d => d.id === hit.ref);
  console.log('---');
  console.log(doc.path, `(score=${hit.score.toFixed(3)})`);
  const snippet = (doc.content || '').slice(0, 400).replace(/\s+/g, ' ');
  console.log(snippet);
}
console.log('---');
console.log(`Found ${results.length} hits`);
