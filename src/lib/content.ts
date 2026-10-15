/**
 * Eén plek waar de site zijn content vandaan haalt.
 *
 * - Zijn PUBLIC_SUPABASE_URL en PUBLIC_SUPABASE_ANON_KEY gezet, dan komt alles uit Supabase
 *   (alleen gepubliceerde items; RLS regelt dat).
 * - Anders valt de site terug op de markdown in src/content/ — handig lokaal en tot de migratie klaar is.
 *
 * Pagina's werken alleen met de genormaliseerde types hieronder en weten niet waar de data vandaan komt.
 */
import { getCollection } from 'astro:content';
import { createClient } from '@supabase/supabase-js';
import { marked } from 'marked';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface Img {
  src: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface Dimensions {
  width: number;
  depth: number;
  height?: number;
}

export interface Project {
  id: string; // = slug
  nr: string; // BB-001
  title: string;
  category: string;
  description: string;
  date: Date;
  tags: string[];
  image?: Img;
  gallery: Img[];
  machine?: string;
  tools: { id: string; name: string }[];
  dimensions?: Dimensions;
  body: string; // markdown
}

export interface Tool {
  id: string; // = slug
  pos: string; // T-01
  name: string;
  category: string;
  description: string;
  tags: string[];
  image?: Img;
  body: string; // markdown
}

/** Projectcategorieën in vaste volgorde, zoals in de legenda (fallback als Supabase niet gebruikt wordt). */
export const PROJECT_CATEGORIES = ['CNC & Houtbewerking', 'Tabletop', '3D Printen'];

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
export const usingSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);

// ─── Nummering ─────────────────────────────────────────────

type Unnumbered<T> = Omit<T, 'nr' | 'pos'>;

function numberProjects(list: Unnumbered<Project>[]): Project[] {
  const chrono = [...list].sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));
  return chrono.map((p, i) => ({ ...p, nr: `BB-${String(i + 1).padStart(3, '0')}` })).reverse();
}

function numberTools(list: (Unnumbered<Tool> & { order?: number })[]): Tool[] {
  const sorted = [...list].sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name));
  return sorted.map(({ order: _o, ...t }, i) => ({ ...t, pos: `T-${String(i + 1).padStart(2, '0')}` }));
}

// ─── Bron 1: Supabase ──────────────────────────────────────

function publicUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/media/${path}`;
}

interface PhotoRow {
  id: string;
  storage_path: string;
  alt: string;
  width: number | null;
  height: number | null;
  sort_order: number;
}

function splitPhotos(photos: PhotoRow[] | null, coverId: string | null) {
  const sorted = [...(photos ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const toImg = (p: PhotoRow): Img => ({
    src: publicUrl(p.storage_path),
    alt: p.alt,
    width: p.width ?? undefined,
    height: p.height ?? undefined,
  });
  const cover = sorted.find((p) => p.id === coverId) ?? sorted[0];
  return { image: cover ? toImg(cover) : undefined, gallery: sorted.filter((p) => p !== cover).map(toImg) };
}

async function fromSupabase() {
  const db = createClient(SUPABASE_URL!, SUPABASE_KEY!, { auth: { persistSession: false } });
  const photoCols = 'id, storage_path, alt, width, height, sort_order';

  const [projects, tools, categories] = await Promise.all([
    db
      .from('projects')
      .select(
        `slug, title, description, body, date, tags, machine, dimensions, cover_photo_id,
         category:categories(name), photos!photos_project_id_fkey(${photoCols}), project_tools(tool:tools(slug, name))`,
      )
      .eq('published', true),
    db
      .from('tools')
      .select(`slug, name, description, body, tags, sort_order, cover_photo_id, category:categories(name), photos!photos_tool_id_fkey(${photoCols})`)
      .eq('published', true),
    db.from('categories').select('name, sort_order').eq('kind', 'project').order('sort_order'),
  ]);

  for (const r of [projects, tools, categories]) {
    if (r.error) throw new Error(`Supabase: ${r.error.message}`);
  }

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

  const projectList = (projects.data ?? []).map((p: any): Unnumbered<Project> => {
    const { image, gallery } = splitPhotos(p.photos, p.cover_photo_id);
    return {
      id: p.slug,
      title: p.title,
      category: one<{ name: string }>(p.category)?.name ?? '',
      description: p.description,
      date: new Date(p.date),
      tags: p.tags ?? [],
      image,
      gallery,
      machine: p.machine ?? undefined,
      tools: (p.project_tools ?? [])
        .map((pt: any) => one<{ slug: string; name: string }>(pt.tool))
        .filter(Boolean)
        .map((t: any) => ({ id: t.slug, name: t.name })),
      dimensions: p.dimensions ?? undefined,
      body: p.body ?? '',
    };
  });

  const toolList = (tools.data ?? []).map((t: any) => {
    const { image } = splitPhotos(t.photos, t.cover_photo_id);
    return {
      id: t.slug,
      name: t.name,
      category: one<{ name: string }>(t.category)?.name ?? '',
      description: t.description,
      tags: t.tags ?? [],
      image,
      body: t.body ?? '',
      order: t.sort_order,
    };
  });

  return {
    projects: numberProjects(projectList),
    tools: numberTools(toolList),
    categories: (categories.data ?? []).map((c) => c.name as string),
  };
}

// ─── Bron 2: markdown (fallback) ──────────────────────────

function localImg(src: string | undefined, alt: string): Img | undefined {
  if (!src) return undefined;
  if (/^https?:\/\//.test(src)) return { src, alt };
  return existsSync(join(process.cwd(), 'public', src)) ? { src, alt } : undefined;
}

async function fromMarkdown() {
  const [projects, tools] = await Promise.all([getCollection('projecten'), getCollection('tools')]);
  const toolNames = new Map(tools.map((t) => [t.id, t.data.name]));

  const projectList = projects.map((p): Unnumbered<Project> => ({
    id: p.id,
    title: p.data.title,
    category: p.data.category,
    description: p.data.description,
    date: p.data.date,
    tags: p.data.tags,
    image: localImg(p.data.image, p.data.title),
    gallery: p.data.gallery
      .map((g, i) => localImg(g, `${p.data.title}, detail ${i + 1}`))
      .filter((g): g is Img => Boolean(g)),
    machine: p.data.machine,
    tools: p.data.tools.map((ref) => ({ id: ref.id, name: toolNames.get(ref.id) ?? ref.id })),
    dimensions: p.data.dimensions,
    body: p.body ?? '',
  }));

  const toolList = tools.map((t) => ({
    id: t.id,
    name: t.data.name,
    category: t.data.category,
    description: t.data.description,
    tags: t.data.tags,
    image: localImg(t.data.image, t.data.name),
    body: t.body ?? '',
    order: t.data.order,
  }));

  return { projects: numberProjects(projectList), tools: numberTools(toolList), categories: PROJECT_CATEGORIES };
}

// ─── Publieke API (één keer ophalen per build) ────────────

let cache: ReturnType<typeof fromMarkdown> | undefined;
function load() {
  cache ??= usingSupabase ? fromSupabase() : fromMarkdown();
  return cache;
}

/** Alle gepubliceerde projecten, nieuwste eerst, met onderdeelnummer. */
export async function getProjects(): Promise<Project[]> {
  return (await load()).projects;
}

/** Alle tools in stuklijst-volgorde, met positie. */
export async function getTools(): Promise<Tool[]> {
  return (await load()).tools;
}

/** Projectcategorieën in legenda-volgorde. */
export async function getProjectCategories(): Promise<string[]> {
  return (await load()).categories;
}

export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false, gfm: true }) as string;
}

export function formatMonth(date: Date): string {
  return date.toLocaleDateString('nl-NL', { year: 'numeric', month: 'long' });
}

export function formatShort(date: Date): string {
  return date.toLocaleDateString('nl-NL', { year: 'numeric', month: 'short' }).replace('.', '');
}
