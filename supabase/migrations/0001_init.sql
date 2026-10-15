-- Builder Basement — initieel schema (spec §6)
-- Uitvoeren in de Supabase SQL-editor, of met `supabase db push`.

-- ─────────────────────────────────────────────────────────────
-- Hulpfuncties
-- ─────────────────────────────────────────────────────────────

-- Admin = een ingelogde gebruiker met app_metadata.role = 'admin'.
-- app_metadata kan alleen server-side (SQL of service role) gezet worden, niet door de gebruiker zelf.
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Tabellen
-- ─────────────────────────────────────────────────────────────

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('project', 'tool')),
  name        text not null,
  slug        text not null,
  sort_order  int  not null default 0,
  unique (kind, slug)
);

create table public.projects (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title           text not null,
  category_id     uuid not null references public.categories (id) on delete restrict,
  description     text not null default '',
  body            text not null default '',
  date            date not null default current_date,
  tags            text[] not null default '{}',
  machine         text,
  dimensions      jsonb check (dimensions is null or (dimensions ? 'width' and dimensions ? 'depth')),
  cover_photo_id  uuid,
  published       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.tools (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name            text not null,
  category_id     uuid not null references public.categories (id) on delete restrict,
  description     text not null default '',
  body            text not null default '',
  tags            text[] not null default '{}',
  sort_order      int not null default 0,
  cover_photo_id  uuid,
  published       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.photos (
  id            uuid primary key default gen_random_uuid(),
  storage_path  text not null unique,
  alt           text not null check (length(trim(alt)) > 0),
  caption       text,
  width         int,
  height        int,
  project_id    uuid references public.projects (id) on delete cascade,
  tool_id       uuid references public.tools (id) on delete cascade,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  -- precies één eigenaar
  check ((project_id is null) <> (tool_id is null))
);

alter table public.projects
  add constraint projects_cover_photo_fk foreign key (cover_photo_id) references public.photos (id) on delete set null;
alter table public.tools
  add constraint tools_cover_photo_fk foreign key (cover_photo_id) references public.photos (id) on delete set null;

create table public.project_tools (
  project_id  uuid not null references public.projects (id) on delete cascade,
  tool_id     uuid not null references public.tools (id) on delete cascade,
  primary key (project_id, tool_id)
);

create index photos_project_idx on public.photos (project_id, sort_order);
create index photos_tool_idx on public.photos (tool_id, sort_order);
create index projects_date_idx on public.projects (date desc);

create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger tools_updated_at before update on public.tools
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Row Level Security (spec §6.3)
-- Bezoekers lezen alleen gepubliceerde content; de admin mag alles.
-- ─────────────────────────────────────────────────────────────

alter table public.categories    enable row level security;
alter table public.projects      enable row level security;
alter table public.tools         enable row level security;
alter table public.photos        enable row level security;
alter table public.project_tools enable row level security;

create policy "categories: iedereen leest" on public.categories
  for select using (true);
create policy "categories: admin schrijft" on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

create policy "projects: gepubliceerd of admin" on public.projects
  for select using (published or public.is_admin());
create policy "projects: admin schrijft" on public.projects
  for all using (public.is_admin()) with check (public.is_admin());

create policy "tools: gepubliceerd of admin" on public.tools
  for select using (published or public.is_admin());
create policy "tools: admin schrijft" on public.tools
  for all using (public.is_admin()) with check (public.is_admin());

create policy "photos: zichtbaar als eigenaar gepubliceerd is" on public.photos
  for select using (
    public.is_admin()
    or exists (select 1 from public.projects p where p.id = project_id and p.published)
    or exists (select 1 from public.tools t where t.id = tool_id and t.published)
  );
create policy "photos: admin schrijft" on public.photos
  for all using (public.is_admin()) with check (public.is_admin());

create policy "project_tools: zichtbaar als project gepubliceerd is" on public.project_tools
  for select using (
    public.is_admin()
    or exists (select 1 from public.projects p where p.id = project_id and p.published)
  );
create policy "project_tools: admin schrijft" on public.project_tools
  for all using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- Storage: bucket "media" (spec §6.2) — publiek leesbaar, alleen admin schrijft
-- ─────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

create policy "media: admin uploadt" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and public.is_admin());
create policy "media: admin wijzigt" on storage.objects
  for update to authenticated using (bucket_id = 'media' and public.is_admin());
create policy "media: admin verwijdert" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- Startcategorieën (zelfde als de huidige site)
-- ─────────────────────────────────────────────────────────────

insert into public.categories (kind, name, slug, sort_order) values
  ('project', 'CNC & Houtbewerking', 'cnc-houtbewerking', 1),
  ('project', 'Tabletop',            'tabletop',          2),
  ('project', '3D Printen',          '3d-printen',        3),
  ('tool',    '3D Printen',          '3d-printen',        1),
  ('tool',    'CNC',                 'cnc',               2),
  ('tool',    'Houtbewerking',       'houtbewerking',     3),
  ('tool',    'Resin',               'resin',             4);
