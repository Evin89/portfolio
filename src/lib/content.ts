import { getCollection, type CollectionEntry } from 'astro:content';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export type Project = CollectionEntry<'projecten'> & { nr: string };
export type Tool = CollectionEntry<'tools'> & { pos: string };

/** Projectcategorieën in vaste volgorde, zoals in de legenda. */
export const PROJECT_CATEGORIES = ['CNC & Houtbewerking', 'Tabletop', '3D Printen'] as const;

/**
 * Alle projecten, nieuwste eerst. Elk project krijgt een onderdeelnummer (BB-001, BB-002, …)
 * op volgorde van datum; bij gelijke datum beslist de slug.
 */
export async function getProjects(): Promise<Project[]> {
  const all = await getCollection('projecten');
  const chrono = [...all].sort(
    (a, b) => a.data.date.getTime() - b.data.date.getTime() || a.id.localeCompare(b.id),
  );
  const numbered = chrono.map((p, i) => ({ ...p, nr: `BB-${String(i + 1).padStart(3, '0')}` }));
  return numbered.reverse();
}

/** Alle tools in stuklijst-volgorde, met positie T-01, T-02, … */
export async function getTools(): Promise<Tool[]> {
  const all = await getCollection('tools');
  const sorted = [...all].sort(
    (a, b) =>
      (a.data.order ?? 999) - (b.data.order ?? 999) || a.data.name.localeCompare(b.data.name),
  );
  return sorted.map((t, i) => ({ ...t, pos: `T-${String(i + 1).padStart(2, '0')}` }));
}

/** Geeft het pad terug als het bestand in public/ bestaat, anders undefined. */
export function existingImage(src?: string): string | undefined {
  if (!src) return undefined;
  if (/^https?:\/\//.test(src)) return src;
  return existsSync(join(process.cwd(), 'public', src)) ? src : undefined;
}

export function formatMonth(date: Date): string {
  return date.toLocaleDateString('nl-NL', { year: 'numeric', month: 'long' });
}

export function formatShort(date: Date): string {
  return date.toLocaleDateString('nl-NL', { year: 'numeric', month: 'short' }).replace('.', '');
}
