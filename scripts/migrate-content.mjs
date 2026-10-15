#!/usr/bin/env node
/**
 * Eenmalige migratie: markdown uit src/content/ + foto's uit public/images/ → Supabase (spec §6.4).
 *
 * Gebruik (lokaal, NIET in Netlify):
 *   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-content.mjs
 *   Voeg --dry-run toe om alleen te zien wat er zou gebeuren.
 *
 * - Foto's worden verkleind tot max. 1600 px en als WebP opgeslagen in bucket "media".
 * - Bestaande rijen (zelfde slug) worden bijgewerkt, dus het script mag vaker draaien.
 * - Projecten worden gepubliceerd; de service role key omzeilt RLS en blijft alleen op je eigen computer.
 */
import { createClient } from '@supabase/supabase-js';
import matter from 'gray-matter';
import sharp from 'sharp';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

const DRY = process.argv.includes('--dry-run');
const ROOT = new URL('..', import.meta.url).pathname;
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!DRY && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) {
  console.error('Zet SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY, of gebruik --dry-run.');
  process.exit(1);
}

const db = DRY ? null : createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const log = (...a) => console.log(DRY ? '[dry-run]' : '', ...a);

async function must(promise, what) {
  const { data, error } = await promise;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function readCollection(dir) {
  const full = join(ROOT, 'src/content', dir);
  const files = (await readdir(full)).filter((f) => f.endsWith('.md'));
  return Promise.all(
    files.map(async (f) => {
      const { data, content } = matter(await readFile(join(full, f), 'utf8'));
      return { ...data, slug: data.slug ?? basename(f, '.md'), body: content.trim() };
    }),
  );
}

async function categoryMap(kind) {
  if (DRY) return new Map();
  const rows = await must(db.from('categories').select('id, name').eq('kind', kind), `categorieën (${kind})`);
  return new Map(rows.map((r) => [r.name, r.id]));
}

/** Verkleint een foto, uploadt hem en geeft de photo-rij terug. */
async function uploadPhoto(src, owner, folder, alt, sortOrder) {
  const file = join(ROOT, 'public', src);
  if (!existsSync(file)) {
    log(`  ! foto ontbreekt, overgeslagen: ${src}`);
    return null;
  }
  const { data: buf, info } = await sharp(file)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  const path = `${folder}/${basename(src, extname(src))}.webp`;
  log(`  foto ${src} → media/${path} (${Math.round(buf.length / 1024)} kB, ${info.width}×${info.height})`);
  if (DRY) return { id: `dry-${path}` };

  await must(db.storage.from('media').upload(path, buf, { contentType: 'image/webp', upsert: true }), `upload ${path}`);
  const row = {
    storage_path: path,
    alt,
    width: info.width,
    height: info.height,
    sort_order: sortOrder,
    ...owner,
  };
  return must(db.from('photos').upsert(row, { onConflict: 'storage_path' }).select('id').single(), `photo ${path}`);
}

async function migrateTools() {
  const tools = await readCollection('tools');
  const cats = await categoryMap('tool');
  const ids = new Map();
  for (const t of tools) {
    log(`tool ${t.slug}`);
    const row = {
      slug: t.slug,
      name: t.name,
      category_id: cats.get(t.category) ?? null,
      description: t.description ?? '',
      body: t.body,
      tags: t.tags ?? [],
      sort_order: t.order ?? 0,
      published: true,
    };
    if (DRY) { ids.set(t.slug, `dry-${t.slug}`); await maybePhoto(t.image, null, `tools/${t.slug}`, t.name, 0); continue; }
    if (!row.category_id) throw new Error(`Onbekende toolcategorie "${t.category}" bij ${t.slug}`);
    const { id } = await must(db.from('tools').upsert(row, { onConflict: 'slug' }).select('id').single(), `tool ${t.slug}`);
    ids.set(t.slug, id);
    const photo = await maybePhoto(t.image, { tool_id: id }, `tools/${t.slug}`, t.name, 0);
    if (photo) await must(db.from('tools').update({ cover_photo_id: photo.id }).eq('id', id), `cover ${t.slug}`);
  }
  return ids;
}

async function maybePhoto(src, owner, folder, alt, sortOrder) {
  return src ? uploadPhoto(src, owner, folder, alt, sortOrder) : null;
}

async function migrateProjects(toolIds) {
  const projects = await readCollection('projecten');
  const cats = await categoryMap('project');
  for (const p of projects) {
    log(`project ${p.slug}`);
    const date = p.date instanceof Date ? p.date.toISOString().slice(0, 10) : String(p.date);
    const row = {
      slug: p.slug,
      title: p.title,
      category_id: cats.get(p.category) ?? null,
      description: p.description ?? '',
      body: p.body,
      date,
      tags: p.tags ?? [],
      machine: p.machine ?? null,
      dimensions: p.dimensions ?? null,
      published: true,
    };
    const folder = `projects/${p.slug}`;
    if (DRY) {
      await maybePhoto(p.image, null, folder, p.title, 0);
      for (const [i, g] of (p.gallery ?? []).entries()) await maybePhoto(g, null, folder, `${p.title}, detail ${i + 1}`, i + 1);
      continue;
    }
    if (!row.category_id) throw new Error(`Onbekende projectcategorie "${p.category}" bij ${p.slug}`);
    const { id } = await must(db.from('projects').upsert(row, { onConflict: 'slug' }).select('id').single(), `project ${p.slug}`);

    const cover = await maybePhoto(p.image, { project_id: id }, folder, p.title, 0);
    for (const [i, g] of (p.gallery ?? []).entries()) {
      await maybePhoto(g, { project_id: id }, folder, `${p.title}, detail ${i + 1}`, i + 1);
    }
    if (cover) await must(db.from('projects').update({ cover_photo_id: cover.id }).eq('id', id), `cover ${p.slug}`);

    const links = (p.tools ?? []).map((slug) => ({ project_id: id, tool_id: toolIds.get(slug) })).filter((l) => l.tool_id);
    if (links.length) await must(db.from('project_tools').upsert(links), `tools bij ${p.slug}`);
  }
}

const toolIds = await migrateTools();
await migrateProjects(toolIds);
log('Klaar.');
