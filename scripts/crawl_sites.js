#!/usr/bin/env node
// scripts/crawl_sites.js
// Crawl a list of URLs (from args or search/crawl_urls.txt) and save extracted text to search/web_corpus.json

const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'search');
const OUT_FILE = path.join(OUT_DIR, 'web_corpus.json');

const MAX_PAGES = 200; // safety cap
const DEFAULT_DEPTH = 1; // follow links one level by default

function normalizeUrl(u) {
  try {
    return new URL(u).toString();
  } catch {
    return null;
  }
}

async function readSeeds() {
  const args = process.argv.slice(2);
  if (args.length) return args.map(normalizeUrl).filter(Boolean);
  const file = path.join(ROOT, 'search', 'crawl_urls.txt');
  try {
    const txt = await fs.readFile(file, 'utf8');
    return txt.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(normalizeUrl).filter(Boolean);
  } catch (e) {
    return [];
  }
}

function extractText(html) {
  const $ = cheerio.load(html);
  // remove script/style and noscript
  $('script, style, noscript').remove();
  const text = $('body').text();
  // normalize whitespace
  return text.replace(/\s+/g, ' ').trim();
}

async function crawl(seeds, maxPages = MAX_PAGES, maxDepth = DEFAULT_DEPTH) {
  const seen = new Set();
  const q = [];
  for (const s of seeds) q.push({ url: s, depth: 0 });
  const results = [];

  while (q.length && results.length < maxPages) {
    const { url, depth } = q.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    try {
      const res = await fetch(url, { redirect: 'follow', timeout: 15000 });
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('text/html')) continue;
      const html = await res.text();
      const text = extractText(html);
      results.push({ url, text, size: text.length });
      if (depth < maxDepth) {
        const $ = cheerio.load(html);
        const links = $('a[href]').map((i, el) => $(el).attr('href')).get();
        for (const l of links) {
          try {
            const abs = new URL(l, url).toString();
            if (!seen.has(abs)) q.push({ url: abs, depth: depth + 1 });
          } catch (e) {
            // ignore
          }
        }
      }
    } catch (err) {
      // ignore fetch errors per-page
    }
  }

  return results;
}

async function main() {
  const seeds = await readSeeds();
  if (!seeds.length) {
    console.error('No seed URLs provided. Pass URLs as args or create search/crawl_urls.txt');
    process.exit(1);
  }
  console.log('Seeds:', seeds);
  const pages = await crawl(seeds);
  await fs.mkdir(OUT_DIR, { recursive: true });
  const doc = { generated_at: new Date().toISOString(), seeds, pages };
  await fs.writeFile(OUT_FILE, JSON.stringify(doc, null, 2), 'utf8');
  console.log(`Saved ${pages.length} pages to ${OUT_FILE}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
