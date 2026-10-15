# Builder Basement

Maker-portfolio van Evin Wijninga op [builderbasement.com](https://builderbasement.com): 3D printen, CNC, houtbewerking en miniaturen.

## Tech stack

- **Framework:** Astro 6, statisch (`output: static`)
- **Content:** Astro content collections (markdown + frontmatter, gevalideerd met een schema)
- **Styling:** pure CSS met custom properties in `src/styles/global.css`, design "Kelder"
- **Fonts:** DM Serif Display, Outfit en DM Mono, self-hosted via `@fontsource`
- **CMS:** Decap CMS op `/admin` met Netlify Identity (wordt later vervangen door een eigen admin op Supabase)
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
├── lib/content.ts         ← ophalen, sorteren, onderdeelnummers (BB-001…) en posities (T-01…)
├── components/            ← Nav, Footer (titelblok), ProjectCard, Figure, TitleBlock (stempelveld), ToolTable
├── layouts/Base.astro
├── pages/                 ← home, projecten, tools, over, contact
└── styles/global.css      ← tokens, centimeterraster, tegels
public/
├── admin/                 ← Decap CMS
└── images/                ← alle foto's, verwezen als /images/<naam>
```

## Een project toevoegen

Via `/admin`, of met een nieuw bestand in `src/content/projecten/`. De bestandsnaam is gelijk aan de slug.

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
