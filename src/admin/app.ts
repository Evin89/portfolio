/**
 * Beheer-app voor Builder Basement (spec §7).
 * Eén bestand, geen framework: de schermen worden als HTML-strings opgebouwd,
 * alle tekst uit de database gaat door esc().
 */
import { createClient, type Session } from '@supabase/supabase-js';
import { marked } from 'marked';

const URL_ = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
const app = document.getElementById('app');

// ─── Types ────────────────────────────────────────────────

type Kind = 'projects' | 'tools';

interface Category { id: string; kind: 'project' | 'tool'; name: string; sort_order: number }
interface Photo {
  id: string; storage_path: string; alt: string; caption: string | null;
  width: number | null; height: number | null; sort_order: number;
}
interface Item {
  id?: string; slug: string; category_id: string; description: string; body: string; tags: string[];
  cover_photo_id: string | null; published: boolean; updated_at?: string;
  // projects
  title?: string; date?: string; machine?: string | null; dimensions?: { width: number; depth: number; height?: number } | null;
  // tools
  name?: string; sort_order?: number;
}

// ─── Hulpjes ──────────────────────────────────────────────

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;

function flash(msg: string, err = false) {
  const el = $('#flash');
  el.textContent = msg;
  el.className = err ? 'a-flash err' : 'a-flash';
  if (!err) setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 4000);
}

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** Verkleint een afbeelding in de browser tot max. 1600 px en zet hem om naar WebP. */
async function toWebp(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Omzetten mislukt'))), 'image/webp', 0.82));
  return { blob, width, height };
}

// ─── Start ────────────────────────────────────────────────

if (app && URL_ && KEY) {
  const db = createClient(URL_, KEY);
  const mediaUrl = (path: string) => `${URL_}/storage/v1/object/public/media/${path}`;
  const view = $('#view');
  const loginForm = $<HTMLFormElement>('#login');
  let session: Session | null = null;
  let tab: Kind = 'projects';
  let categories: Category[] = [];
  let allTools: { id: string; name: string }[] = [];

  const isAdmin = (s: Session | null) => s?.user?.app_metadata?.role === 'admin';

  function showChrome(on: boolean) {
    $('.a-tabs').hidden = !on;
    $('.a-actions').hidden = !on;
    loginForm.hidden = on;
    if (!on) view.innerHTML = '';
  }

  async function boot(s: Session | null) {
    session = s;
    if (!s) return showChrome(false);
    if (!isAdmin(s)) {
      showChrome(false);
      flash(`Ingelogd als ${s.user.email}, maar dit account heeft geen beheerrechten.`, true);
      await db.auth.signOut();
      return;
    }
    showChrome(true);
    const cats = await db.from('categories').select('id, kind, name, sort_order').order('sort_order');
    if (cats.error) return flash(cats.error.message, true);
    categories = cats.data as Category[];
    route();
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(loginForm);
    const { data, error } = await db.auth.signInWithPassword({ email: String(fd.get('email')), password: String(fd.get('password')) });
    if (error) return flash('Inloggen mislukt: controleer e-mail en wachtwoord.', true);
    boot(data.session);
  });

  $('#logout').addEventListener('click', async () => {
    await db.auth.signOut();
    location.hash = '';
    boot(null);
  });

  document.querySelectorAll<HTMLButtonElement>('.a-tabs button').forEach((b) =>
    b.addEventListener('click', () => { location.hash = `#/${b.dataset.tab}`; }),
  );

  $('#publish').addEventListener('click', async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    try {
      const res = await fetch('/.netlify/functions/rebuild', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      flash('Build gestart. De site is over ongeveer een minuut bijgewerkt.');
    } catch (err) {
      flash(`Publiceren mislukt: ${(err as Error).message}`, true);
    } finally {
      btn.disabled = false;
    }
  });

  window.addEventListener('hashchange', () => session && route());

  // ─── Router: #/projects, #/projects/new, #/projects/<id> ───

  function route() {
    const [, kind = 'projects', id] = location.hash.split('/');
    if (kind === 'account') return renderAccount();
    tab = kind === 'tools' ? 'tools' : 'projects';
    document.querySelectorAll<HTMLButtonElement>('.a-tabs button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    if (id) renderEditor(tab, id === 'new' ? null : id);
    else renderList(tab);
  }

  // ─── Account: wachtwoord wijzigen ────────────────────────

  function renderAccount() {
    document.querySelectorAll<HTMLButtonElement>('.a-tabs button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
    view.innerHTML = `
      <div class="a-head"><h1>Wachtwoord wijzigen</h1><a href="#/projects" class="hint">← Terug</a></div>
      <form id="pw" class="a-card a-login">
        <p class="hint">Ingelogd als ${esc(session?.user.email)}</p>
        <label>Nieuw wachtwoord <input type="password" name="pw1" autocomplete="new-password" minlength="10" required /></label>
        <label>Herhaal <input type="password" name="pw2" autocomplete="new-password" minlength="10" required /></label>
        <button type="submit" class="a-btn">Opslaan</button>
      </form>`;
    const form = $<HTMLFormElement>('#pw');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const pw = String(fd.get('pw1'));
      if (pw !== String(fd.get('pw2'))) return flash('De wachtwoorden zijn niet gelijk.', true);
      const { error } = await db.auth.updateUser({ password: pw });
      if (error) return flash(`Wijzigen mislukt: ${error.message}`, true);
      form.reset();
      flash('Wachtwoord gewijzigd.');
    });
  }

  // ─── Lijst ───────────────────────────────────────────────

  async function renderList(kind: Kind) {
    const label = kind === 'projects' ? 'Projecten' : 'Tools';
    view.innerHTML = `<p class="hint">Laden…</p>`;
    const cols = kind === 'projects' ? 'id, slug, title, date, published, updated_at, category_id' : 'id, slug, name, sort_order, published, updated_at, category_id';
    const order = kind === 'projects' ? 'date' : 'sort_order';
    const { data, error } = await db.from(kind).select(cols).order(order, { ascending: kind !== 'projects' });
    if (error) return flash(error.message, true);
    const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? '';
    const rows = (data as any[]).map((r) => `
      <tr>
        <td><a href="#/${kind}/${r.id}">${esc(r.title ?? r.name)}</a></td>
        <td>${esc(catName(r.category_id))}</td>
        <td>${kind === 'projects' ? esc(fmtDate(r.date)) : `#${esc(r.sort_order)}`}</td>
        <td><span class="a-status ${r.published ? 'live' : 'draft'}">${r.published ? 'Gepubliceerd' : 'Concept'}</span></td>
        <td class="hint">${esc(fmtDate(r.updated_at))}</td>
      </tr>`).join('');
    view.innerHTML = `
      <div class="a-head">
        <h1>${label}</h1>
        <a class="a-btn" href="#/${kind}/new" style="display:inline-flex;align-items:center">+ Nieuw</a>
      </div>
      <div class="a-card" style="padding:0;overflow-x:auto">
        <table class="a-table">
          <thead><tr><th>${kind === 'projects' ? 'Titel' : 'Naam'}</th><th>Categorie</th><th>${kind === 'projects' ? 'Datum' : 'Volgorde'}</th><th>Status</th><th>Gewijzigd</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="5" class="hint">Nog niets. Begin met “Nieuw”.</td></tr>`}</tbody>
        </table>
      </div>
      <p class="hint" style="margin-top:12px">Wijzigingen staan direct in de database. Klik op “Site publiceren” om ze op builderbasement.com te zetten.</p>`;
  }

  // ─── Editor ──────────────────────────────────────────────

  async function renderEditor(kind: Kind, id: string | null) {
    const isProject = kind === 'projects';
    const catKind = isProject ? 'project' : 'tool';
    let item: Item = {
      slug: '', category_id: categories.find((c) => c.kind === catKind)?.id ?? '', description: '', body: '', tags: [],
      cover_photo_id: null, published: !isProject,
      ...(isProject ? { title: '', date: new Date().toISOString().slice(0, 10), machine: null, dimensions: null } : { name: '', sort_order: 0 }),
    };
    let linked = new Set<string>();

    if (id) {
      const { data, error } = await db.from(kind).select('*').eq('id', id).single();
      if (error) return flash(error.message, true);
      item = data as Item;
      if (isProject) {
        const pt = await db.from('project_tools').select('tool_id').eq('project_id', id);
        linked = new Set((pt.data ?? []).map((r) => r.tool_id));
      }
    }
    if (isProject) {
      const t = await db.from('tools').select('id, name').order('sort_order');
      allTools = (t.data ?? []) as { id: string; name: string }[];
    }

    const catOpts = categories.filter((c) => c.kind === catKind)
      .map((c) => `<option value="${c.id}" ${c.id === item.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
    const title = isProject ? item.title : item.name;

    view.innerHTML = `
      <div class="a-head">
        <h1>${id ? esc(title) : isProject ? 'Nieuw project' : 'Nieuwe tool'}</h1>
        <a href="#/${kind}" class="hint">← Terug naar overzicht</a>
      </div>
      <form id="edit" class="a-card">
        <div class="a-grid">
          <label>${isProject ? 'Titel' : 'Naam'} <input type="text" name="title" value="${esc(title)}" required /></label>
          <label>Slug <input type="text" name="slug" value="${esc(item.slug)}" pattern="[a-z0-9]+(-[a-z0-9]+)*" required />
            <span class="hint">URL: /${isProject ? 'projecten' : 'tools'}/<span id="slug-preview">${esc(item.slug)}</span></span></label>
          <label>Categorie <select name="category_id" required>${catOpts}</select></label>
          ${isProject
            ? `<label>Datum <input type="date" name="date" value="${esc(item.date)}" required /></label>`
            : `<label>Volgorde in stuklijst <input type="number" name="sort_order" value="${esc(item.sort_order ?? 0)}" /></label>`}
          <label class="full">Korte omschrijving <input type="text" name="description" value="${esc(item.description)}" maxlength="240" />
            <span class="hint">1–2 zinnen, voor tegels en zoekmachines</span></label>
          <label>Tags <input type="text" name="tags" value="${esc(item.tags.join(', '))}" /><span class="hint">Komma-gescheiden</span></label>
          ${isProject ? `<label>Machine <input type="text" name="machine" value="${esc(item.machine ?? '')}" /><span class="hint">Vrije tekst in het stempelveld</span></label>` : '<span></span>'}
          ${isProject ? `
          <div class="full">
            <label>Afmetingen in mm (optioneel, voor maatlijnen)</label>
            <div class="a-dims" style="margin-top:6px">
              <input type="number" name="dim_w" placeholder="Breedte" aria-label="Breedte in mm" value="${esc(item.dimensions?.width ?? '')}" />
              <input type="number" name="dim_d" placeholder="Diepte" aria-label="Diepte in mm" value="${esc(item.dimensions?.depth ?? '')}" />
              <input type="number" name="dim_h" placeholder="Hoogte" aria-label="Hoogte in mm" value="${esc(item.dimensions?.height ?? '')}" />
            </div>
          </div>
          <fieldset class="full" style="border:0">
            <legend class="hint" style="margin-bottom:8px">GEBRUIKTE TOOLS</legend>
            <div class="a-checks">${allTools.map((t) => `<label class="inline"><input type="checkbox" name="tools" value="${t.id}" ${linked.has(t.id) ? 'checked' : ''}/> ${esc(t.name)}</label>`).join('') || '<span class="hint">Nog geen tools</span>'}</div>
          </fieldset>` : ''}
          <div class="full">
            <label for="body">Inhoud (markdown)</label>
            <div class="a-md" style="margin-top:6px">
              <textarea id="body" name="body" rows="18">${esc(item.body)}</textarea>
              <div class="a-preview prose" id="preview" aria-label="Voorbeeld"></div>
            </div>
            <span class="hint">Elke ## kop krijgt op de site automatisch een nummer (01, 02, …).</span>
          </div>
          <label class="inline full"><input type="checkbox" name="published" ${item.published ? 'checked' : ''}/> Gepubliceerd (zichtbaar op de site na publiceren)</label>
        </div>
        <div class="a-row">
          <button type="submit" class="a-btn">Opslaan</button>
          ${id && isProject ? `<a class="a-btn ghost" style="display:inline-flex;align-items:center" href="/projecten/${esc(item.slug)}" target="_blank" rel="noopener">Bekijk live ↗</a>` : ''}
        </div>
      </form>

      ${id ? `
      <section class="a-card">
        <h2>Foto's</h2>
        <p class="hint">Foto's worden in de browser verkleind tot max. 1600 px (WebP). Op de site worden ze vierkant bijgesneden vanuit het midden. De omslagfoto komt in de tegel.</p>
        <div class="a-grid" style="margin-top:12px">
          <label>Bestand(en) <input type="file" id="files" accept="image/*" multiple /></label>
          <label>Alt-tekst <input type="text" id="new-alt" placeholder="Wat staat er op de foto?" /><span class="hint">Verplicht; geldt voor alle gekozen bestanden, later per foto aan te passen</span></label>
        </div>
        <div class="a-drop" id="drop">Of sleep foto's hierheen</div>
        <div class="a-photos" id="photos"></div>
      </section>

      <section class="a-card a-danger">
        <h2>Verwijderen</h2>
        <p class="hint">Verwijdert ${isProject ? 'dit project' : 'deze tool'} en alle bijbehorende foto's. Typ de ${isProject ? 'titel' : 'naam'} om te bevestigen.</p>
        <div class="a-row">
          <input type="text" id="confirm" placeholder="${esc(title)}" style="max-width:360px" aria-label="Typ de naam ter bevestiging" />
          <button type="button" class="a-btn danger" id="delete" disabled>Definitief verwijderen</button>
        </div>
      </section>` : ''}`;

    const form = $<HTMLFormElement>('#edit');
    const titleIn = $<HTMLInputElement>('input[name="title"]', form);
    const slugIn = $<HTMLInputElement>('input[name="slug"]', form);
    const bodyIn = $<HTMLTextAreaElement>('#body');
    const preview = $('#preview');
    let slugTouched = Boolean(item.slug);

    const updatePreview = () => { preview.innerHTML = marked.parse(bodyIn.value, { async: false }) as string; };
    updatePreview();
    bodyIn.addEventListener('input', updatePreview);
    titleIn.addEventListener('input', () => {
      if (!slugTouched) slugIn.value = slugify(titleIn.value);
      $('#slug-preview').textContent = slugIn.value;
    });
    slugIn.addEventListener('input', () => { slugTouched = true; $('#slug-preview').textContent = slugIn.value; });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const num = (k: string) => (fd.get(k) ? Number(fd.get(k)) : undefined);
      const row: Record<string, unknown> = {
        slug: String(fd.get('slug')).trim(),
        category_id: fd.get('category_id'),
        description: String(fd.get('description') ?? '').trim(),
        body: bodyIn.value,
        tags: String(fd.get('tags') ?? '').split(',').map((t) => t.trim()).filter(Boolean),
        published: fd.get('published') === 'on',
      };
      if (isProject) {
        row.title = String(fd.get('title')).trim();
        row.date = fd.get('date');
        row.machine = String(fd.get('machine') ?? '').trim() || null;
        const w = num('dim_w'), d = num('dim_d'), h = num('dim_h');
        row.dimensions = w && d ? { width: w, depth: d, ...(h ? { height: h } : {}) } : null;
      } else {
        row.name = String(fd.get('title')).trim();
        row.sort_order = num('sort_order') ?? 0;
      }

      const res = id
        ? await db.from(kind).update(row).eq('id', id).select('id').single()
        : await db.from(kind).insert(row).select('id').single();
      if (res.error) {
        const msg = res.error.code === '23505' ? 'Deze slug bestaat al. Kies een andere.' : res.error.message;
        return flash(`Opslaan mislukt: ${msg}`, true);
      }
      const savedId = (res.data as { id: string }).id;

      if (isProject) {
        const chosen = fd.getAll('tools').map(String);
        await db.from('project_tools').delete().eq('project_id', savedId);
        if (chosen.length) {
          const link = await db.from('project_tools').insert(chosen.map((tool_id) => ({ project_id: savedId, tool_id })));
          if (link.error) return flash(`Tools koppelen mislukt: ${link.error.message}`, true);
        }
      }

      flash('Opgeslagen.');
      if (!id) location.hash = `#/${kind}/${savedId}`;
    });

    if (!id) return;

    // ─── Foto's ────────────────────────────────────────────

    const owner = isProject ? 'project_id' : 'tool_id';
    const folder = `${isProject ? 'projects' : 'tools'}/${id}`;
    let coverId = item.cover_photo_id;
    let photos: Photo[] = [];

    async function loadPhotos() {
      const { data, error } = await db.from('photos').select('*').eq(owner, id).order('sort_order');
      if (error) return flash(error.message, true);
      photos = data as Photo[];
      renderPhotos();
    }

    function renderPhotos() {
      $('#photos').innerHTML = photos.map((p, i) => `
        <div class="a-photo ${p.id === coverId ? 'cover' : ''}" data-id="${p.id}">
          <img src="${esc(mediaUrl(p.storage_path))}" alt="${esc(p.alt)}" loading="lazy" />
          <div class="body">
            <input type="text" class="alt" value="${esc(p.alt)}" aria-label="Alt-tekst" />
            <div class="tools">
              <button type="button" class="a-btn small ghost" data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="Naar voren">←</button>
              <button type="button" class="a-btn small ghost" data-act="down" ${i === photos.length - 1 ? 'disabled' : ''} aria-label="Naar achteren">→</button>
              <button type="button" class="a-btn small ${p.id === coverId ? '' : 'ghost'}" data-act="cover">${p.id === coverId ? 'Omslag' : 'Maak omslag'}</button>
              <button type="button" class="a-btn small danger" data-act="del" aria-label="Foto verwijderen">✕</button>
            </div>
          </div>
        </div>`).join('') || '<p class="hint">Nog geen foto\'s.</p>';
    }

    $('#photos').addEventListener('change', async (e) => {
      const input = e.target as HTMLInputElement;
      if (!input.classList.contains('alt')) return;
      const pid = input.closest<HTMLElement>('.a-photo')!.dataset.id!;
      const alt = input.value.trim();
      if (!alt) return flash('Alt-tekst mag niet leeg zijn.', true);
      const { error } = await db.from('photos').update({ alt }).eq('id', pid);
      if (error) return flash(error.message, true);
      flash('Alt-tekst opgeslagen.');
    });

    $('#photos').addEventListener('click', async (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
      if (!btn) return;
      const pid = btn.closest<HTMLElement>('.a-photo')!.dataset.id!;
      const i = photos.findIndex((p) => p.id === pid);
      const act = btn.dataset.act;

      if (act === 'cover') {
        const { error } = await db.from(kind).update({ cover_photo_id: pid }).eq('id', id);
        if (error) return flash(error.message, true);
        coverId = pid;
        renderPhotos();
      } else if (act === 'up' || act === 'down') {
        const j = act === 'up' ? i - 1 : i + 1;
        [photos[i], photos[j]] = [photos[j], photos[i]];
        await Promise.all(photos.map((p, k) => db.from('photos').update({ sort_order: k }).eq('id', p.id)));
        renderPhotos();
      } else if (act === 'del') {
        const p = photos[i];
        const rm = await db.storage.from('media').remove([p.storage_path]);
        if (rm.error) return flash(rm.error.message, true);
        const { error } = await db.from('photos').delete().eq('id', pid);
        if (error) return flash(error.message, true);
        if (coverId === pid) coverId = null;
        await loadPhotos();
        flash('Foto verwijderd.');
      }
    });

    async function upload(files: FileList | File[]) {
      const alt = $<HTMLInputElement>('#new-alt').value.trim();
      if (!alt) return flash('Vul eerst een alt-tekst in: wat staat er op de foto?', true);
      const list = [...files].filter((f) => f.type.startsWith('image/'));
      for (const [n, file] of list.entries()) {
        flash(`Uploaden ${n + 1}/${list.length}…`);
        try {
          const { blob, width, height } = await toWebp(file);
          const path = `${folder}/${crypto.randomUUID()}.webp`;
          const up = await db.storage.from('media').upload(path, blob, { contentType: 'image/webp' });
          if (up.error) throw up.error;
          const ins = await db.from('photos')
            .insert({ storage_path: path, alt, width, height, sort_order: photos.length + n, [owner]: id })
            .select('id').single();
          if (ins.error) throw ins.error;
          if (!coverId) {
            coverId = (ins.data as { id: string }).id;
            await db.from(kind).update({ cover_photo_id: coverId }).eq('id', id);
          }
        } catch (err) {
          flash(`Upload van ${file.name} mislukt: ${(err as Error).message}`, true);
        }
      }
      $<HTMLInputElement>('#files').value = '';
      await loadPhotos();
      flash(`${list.length} foto${list.length === 1 ? '' : "'s"} toegevoegd.`);
    }

    $<HTMLInputElement>('#files').addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files?.length) upload(files);
    });
    const drop = $('#drop');
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('over');
      if (e.dataTransfer?.files.length) upload(e.dataTransfer.files);
    });

    // ─── Verwijderen (bevestigen door de naam te typen) ──

    const confirmIn = $<HTMLInputElement>('#confirm');
    const delBtn = $<HTMLButtonElement>('#delete');
    confirmIn.addEventListener('input', () => { delBtn.disabled = confirmIn.value.trim() !== String(title).trim(); });
    delBtn.addEventListener('click', async () => {
      const paths = photos.map((p) => p.storage_path);
      if (paths.length) {
        const rm = await db.storage.from('media').remove(paths);
        if (rm.error) return flash(rm.error.message, true);
      }
      const { error } = await db.from(kind).delete().eq('id', id);
      if (error) return flash(error.message, true);
      flash('Verwijderd.');
      location.hash = `#/${kind}`;
    });

    loadPhotos();
  }

  db.auth.getSession().then(({ data }) => boot(data.session));
}
