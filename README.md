# Evin.makes — Portfolio

Persoonlijke maker portfolio gebouwd met [Astro](https://astro.build).

## Tech stack

- **Framework**: Astro 4.x (statisch, geen JS tenzij nodig)
- **Styling**: Pure CSS met custom properties, geen framework
- **Fonts**: DM Serif Display + DM Mono + Outfit (Google Fonts)
- **Hosting**: Netlify of Vercel (gratis tier voldoende)

## Snel starten

```bash
# 1. Installeer dependencies
npm install

# 2. Start dev server
npm run dev
# → http://localhost:4321

# 3. Build voor productie
npm run build

# 4. Preview de build
npm run preview
```

## Projectstructuur

```
src/
├── components/
│   ├── Nav.astro          ← Navigatiebalk
│   ├── Footer.astro       ← Footer
│   └── ProjectCard.astro  ← Projectkaart component
├── layouts/
│   └── Base.astro         ← HTML boilerplate + nav + footer
├── pages/
│   ├── index.astro        ← Homepage
│   ├── projecten/
│   │   ├── index.astro    ← Projectenoverzicht (met filter)
│   │   └── *.md           ← Elk project = één markdown bestand
│   ├── over/
│   │   └── index.astro    ← Over-mij pagina
│   └── contact/
│       └── index.astro    ← Contactpagina
└── styles/
    └── global.css         ← Design tokens + utility classes
```

## Een nieuw project toevoegen

Maak een nieuw `.md` bestand aan in `src/pages/projecten/`:

```markdown
---
title: "Naam van het project"
slug: "url-vriendelijke-naam"
category: "3D Printen"          # of: CNC & Houtbewerking, Tabletop
description: "Korte omschrijving (1-2 zinnen)"
date: "2025-03-01"
tags: ["PLA", "Bambu", "Fusion 360"]
image: "/images/mijn-project.jpg"   # optioneel
---

## Markdown inhoud hier

Vertel over het project, het proces, materialen, etc.
```

Categorieën voor de filter:
- `3D Printen`
- `CNC & Houtbewerking`
- `Tabletop`

## Afbeeldingen

Zet foto's in de `public/images/` map en verwijs ernaar als `/images/bestandsnaam.jpg`.

## Hosten op Netlify (gratis)

1. Push naar GitHub
2. Ga naar [netlify.com](https://netlify.com) → New site from Git
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Klaar! Gratis SSL en custom domein mogelijk.

## Contactformulier activeren

In `src/pages/contact/index.astro`, vervang de simulatie door Formspree:

1. Maak een gratis account op [formspree.io](https://formspree.io)
2. Maak een nieuw formulier aan, kopieer jouw form ID
3. Uncomment de fetch code en vul je ID in

## Aanpassen

Alle kleuren en fonts zijn CSS variables in `src/styles/global.css`.
Jouw naam/URL aanpassen: zoek op `evin` en `Evin.makes`.
