import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const projecten = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/projecten',
    generateId: ({ data, entry }) => (data.slug as string) ?? entry.replace(/\.md$/, ''),
  }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    category: z.enum(['3D Printen', 'CNC & Houtbewerking', 'Tabletop']),
    description: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    image: z.string().optional(),
    gallery: z.array(z.string()).default([]),
    machine: z.string().optional(),
    tools: z.array(reference('tools')).default([]),
    dimensions: z
      .object({ width: z.number(), depth: z.number(), height: z.number().optional() })
      .optional(),
  }),
});

const tools = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/tools',
    generateId: ({ data, entry }) => (data.slug as string) ?? entry.replace(/\.md$/, ''),
  }),
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    category: z.enum(['3D Printen', 'CNC', 'Houtbewerking', 'Resin']),
    description: z.string(),
    order: z.number().int().optional(),
    tags: z.array(z.string()).default([]),
    image: z.string().optional(),
  }),
});

export const collections = { projecten, tools };
