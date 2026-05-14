#!/usr/bin/env node
// scripts/build_index.js
// Combine repo corpus (search/corpus.json) and web corpus (search/web_corpus.json)
// and build an elasticlunr index at search/index.json

const fs = require('fs');
const path = require('path');
const elasticlunr = require('elasticlunr');

const ROOT = process.cwd();
const CORPUS_PATH = path.join(ROOT, 'search', 'corpus.json');
const WEB_PATH = path.join(ROOT, 'search', 'web_corpus.json');
const OUT_PATH = path.join(ROOT, 'search', 'index.json');
const COMBINED_PATH = path.join(ROOT, 'search', 'combined_corpus.json');

function loadJson(p) {
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const repoCorpus = loadJson(CORPUS_PATH);
const webCorpus = loadJson(WEB_PATH);

const files = [];
if (repoCorpus && Array.isArray(repoCorpus.files)) {
  for (const f of repoCorpus.files) files.push({ id: `repo:${f.path}`, path: f.path, content: f.content || '' });
}
if (webCorpus && Array.isArray(webCorpus.pages)) {
  for (const p of webCorpus.pages) files.push({ id: `web:${p.url}`, path: p.url, content: p.text || '' });
}

console.log(`Indexing ${files.length} documents`);

const idx = elasticlunr(function () {
  this.setRef('id');
  this.addField('content');
  this.addField('path');
});

for (const f of files) {
  idx.addDoc({ id: f.id, content: f.content, path: f.path });
}

const serialized = { index: idx.toJSON(), generated_at: new Date().toISOString() };
fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(serialized, null, 2), 'utf8');
fs.writeFileSync(COMBINED_PATH, JSON.stringify({ generated_at: new Date().toISOString(), docs: files }, null, 2), 'utf8');
console.log('Wrote', OUT_PATH, 'and', COMBINED_PATH);
