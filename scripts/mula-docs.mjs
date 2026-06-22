#!/usr/bin/env node
/**
 * mula-docs.mjs — CLI for fetching, caching, and injecting library docs
 * Fork from Context7 (Upstash, MIT). Adapted for OpenClaw.
 *
 * Usage:
 *   node mula-docs.mjs search "next.js"
 *   node mula-docs.mjs fetch "/vercel/next.js" "middleware auth"
 *   node mula-docs.mjs inject "/vercel/next.js" "middleware auth"
 *   node mula-docs.mjs cache list
 *   node mula-docs.mjs cache clear "/vercel/next.js"
 *   node mula-docs.mjs cache clear --all
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';

// --- Config ---
const API_BASE = 'https://context7.com/api';
const CACHE_DIR = join(homedir(), '.openclaw', 'workspace', 'docs-cache');
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_MB = 50;
const API_KEY = process.env.CONTEXT7_API_KEY || '';

// --- Helpers ---
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

function libraryToFolder(libraryId) {
  return libraryId.replace(/^\//, '').replace(/\//g, '--').toLowerCase();
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return null; }
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}

function headers() {
  const h = { 'Content-Type': 'application/json' };
  if (API_KEY) h['CONTEXT7_API_KEY'] = API_KEY;
  return h;
}

function isExpired(expiresAt) {
  return new Date(expiresAt) < new Date();
}

// --- API ---
async function searchLibrary(query) {
  const url = `${API_BASE}/v2/libs/search?query=${encodeURIComponent(query)}&libraryName=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    if (res.status === 429) throw new Error('Rate limited. Wait 1h or use CONTEXT7_API_KEY.');
    throw new Error(`Search failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return data.results || [];
}

async function fetchContext(libraryId, query) {
  const url = `${API_BASE}/v2/context?query=${encodeURIComponent(query)}&libraryId=${encodeURIComponent(libraryId)}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    if (res.status === 429) throw new Error('Rate limited. Wait 1h or use CONTEXT7_API_KEY.');
    if (res.status === 404) throw new Error(`Library "${libraryId}" not found. Try search first.`);
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

// --- Cache ---
function getCachePath(libraryId, query) {
  const folder = join(CACHE_DIR, libraryToFolder(libraryId));
  const file = slugify(query) + '.md';
  return { folder, file, full: join(folder, file), meta: join(folder, '_meta.json') };
}

function readCache(libraryId, query, force = false) {
  const { full, meta } = getCachePath(libraryId, query);
  if (!existsSync(full)) return null;

  const metaData = readJson(meta);
  const querySlug = slugify(query);
  const queryMeta = metaData?.queries?.[querySlug];

  if (force) return null; // Force refetch

  if (queryMeta && !isExpired(queryMeta.expiresAt)) {
    return { content: readFileSync(full, 'utf-8'), stale: false };
  }

  // Stale but exists — return with warning
  if (existsSync(full)) {
    return { content: readFileSync(full, 'utf-8'), stale: true };
  }

  return null;
}

function writeCache(libraryId, query, content) {
  const { folder, file, full, meta } = getCachePath(libraryId, query);
  ensureDir(folder);
  writeFileSync(full, content, 'utf-8');

  // Update meta
  const metaData = readJson(meta) || { libraryId, queries: {} };
  metaData.queries[slugify(query)] = {
    fetchedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + DEFAULT_TTL_MS).toISOString(),
    sizeBytes: Buffer.byteLength(content),
    source: 'context7-api'
  };
  writeJson(meta, metaData);
}

// --- Commands ---
async function cmdSearch(query) {
  console.log(`Searching: "${query}"...\n`);
  const results = await searchLibrary(query);
  if (!results.length) {
    console.log('No libraries found. Try different keywords.');
    return;
  }
  results.slice(0, 10).forEach((r, i) => {
    console.log(`${i + 1}. ${r.name || r.id}`);
    console.log(`   ID: ${r.id}`);
    if (r.version) console.log(`   Version: ${r.version}`);
    if (r.totalSnippets) console.log(`   Snippets: ${r.totalSnippets}`);
    console.log();
  });
}

async function cmdFetch(libraryId, query, force = false) {
  // Check cache first
  const cached = readCache(libraryId, query, force);
  if (cached && !cached.stale) {
    console.log(`[cache hit] Docs from cache (not expired)`);
    console.log(cached.content);
    return;
  }

  console.log(`Fetching docs: ${libraryId} — "${query}"...`);
  try {
    const content = await fetchContext(libraryId, query);
    if (!content || content.trim().length < 50) {
      console.log('Empty or minimal docs returned. Try a more specific query.');
      return;
    }
    writeCache(libraryId, query, content);
    console.log(`[cached] ${Buffer.byteLength(content)} bytes saved.`);
    console.log(content);
  } catch (err) {
    if (cached?.stale) {
      console.log(`[stale cache] Fetch failed, using stale docs: ${err.message}`);
      console.log(cached.content);
    } else {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  }
}

function cmdInject(libraryId, query) {
  const cached = readCache(libraryId, query);
  if (!cached) {
    console.error(`No cached docs for "${libraryId}" query "${query}". Run fetch first.`);
    process.exit(1);
  }
  const staleNote = cached.stale ? ' [stale — consider refetching]' : '';
  const meta = readJson(getCachePath(libraryId, query).meta);
  const queryMeta = meta?.queries?.[slugify(query)];
  const date = queryMeta?.fetchedAt?.split('T')[0] || 'unknown';

  console.log(`## Reference Documentation: ${libraryId}${staleNote}`);
  console.log(`Source: Context7 (cached ${date})`);
  console.log('---');
  console.log(cached.content);
  console.log('---');
  console.log('Use the documentation above as reference when coding. Prefer APIs and patterns from these docs over training data.');
}

function cmdCacheList() {
  ensureDir(CACHE_DIR);
  const folders = readdirSync(CACHE_DIR).filter(f => statSync(join(CACHE_DIR, f)).isDirectory());
  if (!folders.length) {
    console.log('Cache empty.');
    return;
  }
  let totalSize = 0;
  let totalQueries = 0;
  folders.forEach(f => {
    const meta = readJson(join(CACHE_DIR, f, '_meta.json'));
    const queries = Object.keys(meta?.queries || {});
    const size = queries.reduce((s, q) => s + (meta.queries[q]?.sizeBytes || 0), 0);
    totalSize += size;
    totalQueries += queries.length;
    const expiresIn = queries.map(q => {
      const exp = new Date(meta.queries[q]?.expiresAt);
      const h = Math.round((exp - Date.now()) / 3600000);
      return h > 0 ? `${h}h` : 'expired';
    }).join(', ');
    console.log(`${f}: ${queries.length} queries, ${(size / 1024).toFixed(1)}KB, expires: ${expiresIn}`);
  });
  console.log(`\nTotal: ${folders.length} libraries, ${totalQueries} queries, ${(totalSize / 1024).toFixed(1)}KB`);
}

function cmdCacheClear(target) {
  if (target === '--all') {
    if (existsSync(CACHE_DIR)) rmSync(CACHE_DIR, { recursive: true });
    console.log('Cache cleared.');
    return;
  }
  const folder = join(CACHE_DIR, libraryToFolder(target));
  if (existsSync(folder)) {
    rmSync(folder, { recursive: true });
    console.log(`Cleared cache for ${target}`);
  } else {
    console.log(`No cache for ${target}`);
  }
}

// --- Main ---
const [,, cmd, ...args] = process.argv;

try {
  switch (cmd) {
    case 'search':
      if (!args[0]) { console.error('Usage: mula-docs search "library name"'); process.exit(1); }
      await cmdSearch(args.join(' '));
      break;
    case 'fetch':
      if (!args[0] || !args[1]) { console.error('Usage: mula-docs fetch "/owner/repo" "query"'); process.exit(1); }
      await cmdFetch(args[0], args.slice(1).filter(a => a !== '--force').join(' '), args.includes('--force'));
      break;
    case 'inject':
      if (!args[0] || !args[1]) { console.error('Usage: mula-docs inject "/owner/repo" "query"'); process.exit(1); }
      cmdInject(args[0], args.slice(1).join(' '));
      break;
    case 'cache':
      if (args[0] === 'list') cmdCacheList();
      else if (args[0] === 'clear') cmdCacheClear(args[1] || '--all');
      else console.error('Usage: mula-docs cache [list|clear]');
      break;
    default:
      console.log('mula-docs — Live Documentation Fetching for OpenClaw');
      console.log('Commands: search, fetch, inject, cache');
      console.log('Run: node mula-docs.mjs search "next.js"');
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
