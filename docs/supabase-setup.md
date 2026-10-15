# Supabase koppelen — stap voor stap

Eenmalig, ongeveer 20 minuten. Tot stap 6 klaar is, blijft de live site gewoon uit de markdown in `src/content/` bouwen.

## 1. Project aanmaken

1. Ga naar [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. Naam: `builder-basement`. Regio: **West EU (Ireland)** of **Central EU (Frankfurt)**.
3. Kies een sterk databasewachtwoord en bewaar het in je wachtwoordmanager. Je hebt het verder niet nodig voor de site.

## 2. Schema installeren

1. Open in het project **SQL Editor** → **New query**.
2. Plak de inhoud van `supabase/migrations/0001_init.sql` en klik **Run**.
3. Controle: onder **Table Editor** staan nu `categories`, `projects`, `tools`, `photos` en `project_tools`, en onder **Storage** de bucket `media`.

## 3. Jezelf admin maken

1. **Authentication** → **Sign In / Providers** → zet **Allow new users to sign up** uit. Alleen jij hoeft in te loggen.
2. **Authentication** → **Users** → **Add user** → **Create new user**. Vul je e-mail en een wachtwoord in en vink **Auto Confirm User** aan.
3. Geef dat account beheerrechten in de **SQL Editor** (vervang het e-mailadres):

   ```sql
   update auth.users
   set raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'
   where email = 'jouw@email.nl';
   ```

## 4. Sleutels in Netlify zetten

Onder **Project Settings → API** in Supabase staan de **Project URL** en de **anon public** key. Zet ze in Netlify onder **Site configuration → Environment variables**:

| Variabele | Waarde |
| --- | --- |
| `PUBLIC_SUPABASE_URL` | de Project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | de anon public key |
| `NETLIFY_BUILD_HOOK_URL` | zie stap 5 |

De anon key mag publiek zijn: de beveiliging zit in de database (Row Level Security). De **service_role** key hoort **nooit** in Netlify of in git.

## 5. Build hook voor de knop "Site publiceren"

1. Netlify → **Site configuration → Build & deploy → Build hooks** → **Add build hook**. Naam: `Admin publiceren`, branch: `main`.
2. Kopieer de URL en zet die als `NETLIFY_BUILD_HOOK_URL` (stap 4).

## 6. Content overzetten

Lokaal, in de repo:

```bash
npm install
# eerst kijken wat er gebeurt:
node scripts/migrate-content.mjs --dry-run
# dan echt (service_role key staat onder Project Settings → API):
SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-content.mjs
```

Het script zet de 4 projecten en 3 tools in de database, verkleint de foto's tot WebP (van ~2 MB naar ~100 kB) en uploadt ze naar `media`. Je kunt het veilig opnieuw draaien: bestaande items worden bijgewerkt.

## 7. Live zetten

1. Merge de pull request naar `main`. Netlify bouwt nu vanuit Supabase.
2. Ga naar `builderbasement.com/admin`, log in, en controleer de projecten.
3. Na wijzigingen: klik **Site publiceren**. Na ongeveer een minuut is de site bijgewerkt.

## Goed om te weten

- **Gratis Supabase-projecten worden gepauzeerd** na een week zonder activiteit. De site blijft dan gewoon werken (het is statische HTML), maar de admin en nieuwe builds niet tot je het project in het dashboard weer aanzet.
- **Terugvallen op markdown**: haal `PUBLIC_SUPABASE_URL` weg uit Netlify en bouw opnieuw. De markdown in `src/content/` blijft voorlopig in de repo staan als reserve.
