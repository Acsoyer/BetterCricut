create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Untitled Project',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.projects enable row level security;
drop policy if exists "Users can view their own projects" on public.projects;
drop policy if exists "Users can create their own projects" on public.projects;
drop policy if exists "Users can update their own projects" on public.projects;
drop policy if exists "Users can delete their own projects" on public.projects;
create policy "Users can view their own projects" on public.projects for select using (auth.uid() = user_id);
create policy "Users can create their own projects" on public.projects for insert with check (auth.uid() = user_id);
create policy "Users can update their own projects" on public.projects for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own projects" on public.projects for delete using (auth.uid() = user_id);
create index if not exists projects_user_updated_idx on public.projects (user_id, updated_at desc);

-- Lightweight project index fields. The editor lists these without downloading
-- the complete canvas JSON or original image assets.
alter table public.projects add column if not exists thumbnail text;
alter table public.projects add column if not exists byte_size bigint not null default 0;
alter table public.projects add column if not exists layer_count integer not null default 0;
alter table public.projects add column if not exists is_autosave boolean not null default false;
update public.projects set
  thumbnail = coalesce(thumbnail, data->>'thumbnail'),
  byte_size = case when byte_size = 0 then octet_length(data::text) else byte_size end,
  layer_count = case when layer_count = 0 then coalesce(jsonb_array_length(coalesce(data->'layers','[]'::jsonb)),0) else layer_count end;
create index if not exists projects_user_autosave_idx on public.projects (user_id, is_autosave, updated_at desc);

-- Enforce account limits at the database boundary as well as in the UI.
create or replace function public.enforce_project_limits() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  total_bytes bigint;
  project_total integer;
  previous_bytes bigint := 0;
begin
  select coalesce(sum(byte_size), 0), count(*) filter (where not is_autosave)
    into total_bytes, project_total
    from public.projects
    where user_id = new.user_id and id <> coalesce(new.id, gen_random_uuid());
  if tg_op = 'INSERT' and not new.is_autosave and project_total >= 10 then
    raise exception 'PROJECT_LIMIT_REACHED';
  end if;
  if tg_op = 'UPDATE' then previous_bytes := old.byte_size; end if;
  if total_bytes + previous_bytes > 20971520 and not (tg_op = 'UPDATE' and new.byte_size < previous_bytes) then
    raise exception 'STORAGE_LIMIT_ALREADY_EXCEEDED';
  end if;
  return new;
end $$;
drop trigger if exists projects_enforce_limits on public.projects;
create trigger projects_enforce_limits before insert or update on public.projects
for each row execute function public.enforce_project_limits();
