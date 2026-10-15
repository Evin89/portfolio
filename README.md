# Builder Basement

Maker-portfolio van Evin Wijninga op [builderbasement.com](https://builderbasement.com): 3D printen, CNC, houtbewerking en miniaturen.

## Tech stack

- **Framework:** Astro 6, statisch (`output: static`)
- **Content:** Supabase (Postgres + Storage) als `PUBLIC_SUPABASE_URL` en `PUBLIC_SUPABASE_ANON_KEY` gezet zijn; anders de markdown in `src/content/` (content collections met schema)
- **Styling:** pure CSS met custom properties in `src/styles/global.css`, design "Kelder"
- **Fonts:** DM Serif Display, Outfit en DM Mono, self-hosted via `@fontsource`
- **Beheer:** eigen admin op `/admin` (Supabase Auth); de knop "Site publiceren" start via een Netlify Function een nieuwe build
- **Hosting:** Netlify, bouwt automatisch bij elke push naar `main`

## Snel starten

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # bouwt naar dist/
npm run preview   # bekijk de build
```

## Projectstructuur

```
src/
├── content.config.ts      ← schema's voor projecten en tools
├── content/
│   ├── projecten/*.md     ← één bestand per project
│   └── tools/*.md         ← één bestand per machine
├── lib/content.ts         ← haalt content uit Supabase of markdown, nummert (BB-001…, T-01…)
├── admin/app.ts           ← de beheer-app op /admin
├── components/            ← Nav, Footer (titelblok), ProjectCard, Figure, TitleBlock (stempelveld), ToolTable
├── layouts/Base.astro
├── pages/                 ← home, projecten, tools, over, contact
└── styles/global.css      ← tokens, centimeterraster, tegels
public/images/             ← foto's voor de markdown-fallback
supabase/migrations/       ← databaseschema, RLS en storage
scripts/migrate-content.mjs ← eenmalige migratie markdown → Supabase
netlify/functions/         ← rebuild-functie voor "Site publiceren"
```

## Supabase

Zie [docs/supabase-setup.md](docs/supabase-setup.md) voor het koppelen van een nieuw project. Kopieer `.env.example` naar `.env` om lokaal tegen Supabase te bouwen.

## Een project toevoegen

Met Supabase: via `/admin`. Zonder Supabase: met een nieuw bestand in `src/content/projecten/`. De bestandsnaam is gelijk aan de slug.

```markdown
---
title: "Naam van het project"
slug: "naam-van-het-project"
category: "CNC & Houtbewerking"   # of: 3D Printen, Tabletop
description: "Korte omschrijving (1-2 zinnen)"
date: "2026-10-01"
tags: ["Hout", "Router"]
image: "/images/mijn-project.jpg"    # optioneel, wordt vierkant bijgesneden
gallery: ["/images/detail.jpg"]      # optioneel, extra foto's
machine: "Makita RTC 0700"           # optioneel, vrije tekst in het stempelveld
tools: ["bambu-p1s"]                 # optioneel, slugs uit src/content/tools
dimensions: { width: 600, depth: 400 } # optioneel, toont maatlijnen in mm
---

## Over dit project

Tekst in markdown. Elke `##`-kop krijgt automatisch een nummer (01, 02, …).
```

Onderdeelnummers (BB-001, BB-002, …) worden automatisch toegekend op volgorde van datum. Een fout in de frontmatter (bijvoorbeeld een onbekende categorie) laat de build stoppen met een duidelijke melding.

## Een tool toevoegen

Nieuw bestand in `src/content/tools/` met `name`, `slug`, `category` (3D Printen, CNC, Houtbewerking of Resin), `description` en optioneel `order` (positie in de stuklijst), `tags` en `image`.

## Contactformulier

Het formulier gebruikt Netlify Forms. Berichten verschijnen in het Netlify-dashboard onder **Forms**; daar kun je ook e-mailnotificaties aanzetten.
