// scripts/extract_corpus.js
// Walk the repository and build a simple JSON corpus used for fast local/agent search.
// Usage: node scripts/extract_corpus.js

const fs = require('fs').promises;
const path = require('path');

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'search');
const OUT_FILE = path.join(OUT_DIR, 'corpus.json');

const MAX_FILE_CHARS = 20000; // truncate very large files
const ALLOWED_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.md', '.mdx', '.json', '.toml', '.yaml', '.yml', '.css', '.html']);
const IGNORE_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'out', 'coverage', 'search', '.github']);

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const ent of entries) {
    if (IGNORE_DIRS.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      files.push(...await walk(full));
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase();
      if (ALLOWED_EXT.has(ext)) {
        files.push(full);
      }
    }
  }
  return files;
}

async function build() {
  console.log('Scanning repo for files...');
  const files = await walk(ROOT);
  console.log(`Found ${files.length} candidate files`);

  const corpus = [];
  for (const f of files) {
    try {
      const rel = path.relative(ROOT, f).replace(/\\/g, '/');
      const raw = await fs.readFile(f, 'utf8');
      const content = raw.length > MAX_FILE_CHARS ? raw.slice(0, MAX_FILE_CHARS) + '\n\n...[truncated]' : raw;
      // save a small metadata object
      corpus.push({ path: rel, content, size: content.length });
    } catch (err) {
      // ignore unreadable files
    }
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify({ generated_at: new Date().toISOString(), files: corpus }, null, 2), 'utf8');
  console.log(`Wrote corpus with ${corpus.length} files to ${OUT_FILE}`);
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
