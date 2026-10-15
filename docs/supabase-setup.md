# Supabase — stand van zaken en beheer

## Wat er al staat (15 oktober 2026)

- **Project:** `BuilderBasementPortfolio` (`xytffvzptkeffmbmfric`, regio eu-west-1), in de organisatie "Mordheim Manager".
- **Schema:** `supabase/migrations/0001_init.sql` is uitgevoerd. Er zijn tabellen, RLS-regels en de bucket `media`, zonder beveiligingsmeldingen van de Supabase-adviseur.
- **Content:** de 4 projecten en 3 tools uit `src/content/` staan in de database. Er staan 5 foto's als WebP in `media`, met beschrijvende alt-teksten. De Swillpot heeft geen foto, net als in de markdown.
- **Admin-account:** `e.d.wijninga@gmail.com` met de rol `admin`. Wijzig het tijdelijke wachtwoord via **Wachtwoord** in `/admin`.
- **Netlify:** de project-URL en de publieke sleutel staan in `netlify.toml`, dus builds lezen automatisch uit Supabase.

## Nog te doen (handmatig)

1. **Build hook voor "Site publiceren"**: Netlify → **Site configuration → Build & deploy → Build hooks** → **Add build hook** (naam `Admin publiceren`, branch `main`). Zet de URL als omgevingsvariabele `NETLIFY_BUILD_HOOK_URL` onder **Site configuration → Environment variables**.
2. **Registratie uitzetten**: Supabase → **Authentication → Sign In / Providers** → zet **Allow new users to sign up** uit. Zonder admin-rol kan een nieuw account niets wijzigen, maar zo blijft de gebruikerslijst schoon.
3. **Site URL**: Supabase → **Authentication → URL Configuration** → zet de **Site URL** op `https://builderbasement.com` en voeg `https://builderbasement.com/admin/` toe aan de **Redirect URLs**. Dat is nodig voor e-mails zoals "wachtwoord vergeten".
4. **Opruimen**: verwijder de GitHub-branch `tmp/migratie-fotos` en, in Supabase onder **Edge Functions**, de uitgeschakelde functie `migratie`. Beide waren alleen voor de eenmalige migratie.

## Een nieuw project opzetten (voor later of een kopie)

1. Maak een nieuw project aan op [supabase.com/dashboard](https://supabase.com/dashboard).
2. Voer `supabase/migrations/0001_init.sql` uit in de **SQL Editor**.
3. Maak een gebruiker aan onder **Authentication → Users** en geef die beheerrechten:

   ```sql
   update auth.users
   set raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'
   where email = 'jouw@email.nl';
   ```

4. Zet de content over met `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/migrate-content.mjs`. Probeer eerst `--dry-run`. De service role key gebruik je alleen lokaal: nooit in Netlify of in git.
5. Pas `PUBLIC_SUPABASE_URL` en `PUBLIC_SUPABASE_ANON_KEY` aan in `netlify.toml`.

## Goed om te weten

- **Gratis projecten worden gepauzeerd** na ongeveer een week zonder activiteit. De site blijft gewoon werken, want het is statische HTML. De admin en nieuwe builds werken pas weer als je het project in het dashboard herstart.
- **Terug naar markdown**: haal de twee `PUBLIC_SUPABASE_*`-regels uit `netlify.toml`. De markdown in `src/content/` blijft als reserve in de repo staan.
