#!/usr/bin/env node
// Adds the Opinly analytics pixel + site instrumentation to the <head> of every
// static HTML page. Idempotent: pages that already carry p.js are skipped.
// Run: npm run pixel:inject
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PIXEL_KEY = 'pk-x3Ndgpy8F7LYjLNTRlDHjHEGplgr8y8F0KBFqtR';
const SNIPPET = `<!-- Opinly analytics: public write-only key, safe in HTML -->
<script async src="https://static.opinly.ai/p.js" data-key="${PIXEL_KEY}"></script>
<script defer src="/assets/opinly-events.js"></script>
`;
// viewer/ is the private remote-viewer app (holds a session secret); no third-party script there.
const SKIP_DIRS = new Set(['.git', 'node_modules', '.wrangler', 'src', 'test', 'scripts', '.claude', 'viewer']);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && entry.name.endsWith('.html')) yield full;
  }
}

let changed = 0; let skipped = 0; const noHead = [];
for await (const file of walk(ROOT)) {
  const rel = relative(ROOT, file);
  const html = await readFile(file, 'utf8');
  if (html.includes('static.opinly.ai/p.js')) { skipped += 1; continue; }
  const m = html.match(/<head[^>]*>/i);
  if (!m) { noHead.push(rel); continue; }
  const idx = m.index + m[0].length;
  const out = `${html.slice(0, idx)}\n${SNIPPET}${html.slice(idx)}`;
  await writeFile(file, out);
  changed += 1;
}
console.log(`injected: ${changed}, already present: ${skipped}, no <head>: ${noHead.length}`);
noHead.forEach((f) => console.log(`  skipped (no <head>): ${f}`));
