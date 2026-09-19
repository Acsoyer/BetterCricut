-- Apply once before enabling NEXT_PUBLIC_PROJECT_FILE_STORAGE=true.
-- Existing inline project records remain readable and migrate on their next save.
begin;
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-assets', 'project-assets', false, 41943040)
on conflict (id) do nothing;

-- Short-lived upload claims protect reused old files during another tab's save.
create table if not exists public.project_asset_claims (
  path text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);
alter table public.project_asset_claims enable row level security;
drop policy if exists "Project claims read own" on public.project_asset_claims;
drop policy if exists "Project claims insert own" on public.project_asset_claims;
drop policy if exists "Project claims update own" on public.project_asset_claims;
drop policy if exists "Project claims delete own" on public.project_asset_claims;
create policy "Project claims read own" on public.project_asset_claims for select to authenticated using (user_id = auth.uid());
create policy "Project claims insert own" on public.project_asset_claims for insert to authenticated
with check (user_id = auth.uid() and split_part(path, '/', 1) = auth.uid()::text and expires_at <= now() + interval '61 minutes');
create policy "Project claims update own" on public.project_asset_claims for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid() and split_part(path, '/', 1) = auth.uid()::text and expires_at <= now() + interval '61 minutes');
create policy "Project claims delete own" on public.project_asset_claims for delete to authenticated using (user_id = auth.uid());

drop policy if exists "Project files read own" on storage.objects;
drop policy if exists "Project files upload own" on storage.objects;
drop policy if exists "Project files delete unreferenced own" on storage.objects;
create policy "Project files read own" on storage.objects for select to authenticated
using (bucket_id = 'project-assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Project files upload own" on storage.objects for insert to authenticated
with check (bucket_id = 'project-assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Project files delete unreferenced own" on storage.objects for delete to authenticated
using (
  bucket_id = 'project-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
  and created_at < now() - interval '24 hours'
  and not exists (select 1 from public.project_asset_claims c where c.path = storage.objects.name and c.expires_at > now())
  and not exists (
    select 1 from public.projects p,
      lateral jsonb_each_text(coalesce(p.data->'assets', '{}'::jsonb)) a
    where p.user_id = auth.uid() and a.value = 'storage://' || storage.objects.name
  )
);

-- Check the proposed total, while permitting name-only updates and shrinking
-- pre-existing over-quota projects. Serialize saves from different browser tabs.
create or replace function public.enforce_project_limits() returns trigger
language plpgsql security definer set search_path = public as $$
declare total_bytes bigint; project_total integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  select coalesce(sum(byte_size), 0), count(*) filter (where not is_autosave)
    into total_bytes, project_total from public.projects
    where user_id = new.user_id and id <> new.id;
  if not new.is_autosave and project_total >= 20 then
    raise exception 'PROJECT_LIMIT_REACHED';
  end if;
  if total_bytes + new.byte_size > 41943040 then
    if tg_op = 'INSERT' then raise exception 'STORAGE_LIMIT_ALREADY_EXCEEDED'; end if;
    if new.byte_size > old.byte_size then raise exception 'STORAGE_LIMIT_ALREADY_EXCEEDED'; end if;
  end if;
  return new;
end $$;
commit;
