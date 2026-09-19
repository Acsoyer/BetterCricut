-- Apply after projects.sql base table exists. Safe to run more than once.
begin;
alter table public.projects add column if not exists thumbnail text;
alter table public.projects add column if not exists byte_size bigint not null default 0;
alter table public.projects add column if not exists layer_count integer not null default 0;
alter table public.projects add column if not exists is_autosave boolean not null default false;
-- Backfill existing records before the storage quota trigger evaluates metadata.
do $$
begin
  if exists (select 1 from pg_trigger where tgrelid = 'public.projects'::regclass and tgname = 'projects_enforce_limits') then
    alter table public.projects disable trigger projects_enforce_limits;
  end if;
end $$;
update public.projects
set byte_size = case when byte_size = 0 then octet_length(data::text) else byte_size end,
    layer_count = case when layer_count = 0 and jsonb_typeof(data->'layers') = 'array' then jsonb_array_length(data->'layers') else layer_count end,
    thumbnail = coalesce(thumbnail, data->>'thumbnail'),
    is_autosave = is_autosave or name like 'Autosave - %'
where byte_size = 0 or layer_count = 0 or thumbnail is null or (not is_autosave and name like 'Autosave - %');
do $$
begin
  if exists (select 1 from pg_trigger where tgrelid = 'public.projects'::regclass and tgname = 'projects_enforce_limits') then
    alter table public.projects enable trigger projects_enforce_limits;
  end if;
end $$;
create index if not exists projects_user_autosave_idx on public.projects (user_id, is_autosave, updated_at desc);
commit;
notify pgrst, 'reload schema';
