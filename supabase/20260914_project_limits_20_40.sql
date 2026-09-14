-- v1.00: 20 regular projects and 40 MB total storage per user.
-- The save that first crosses the storage ceiling is retained; subsequent
-- saves are blocked until the user deletes data or makes a project smaller.
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

  if tg_op = 'INSERT' and not new.is_autosave and project_total >= 20 then
    raise exception 'PROJECT_LIMIT_REACHED';
  end if;

  if tg_op = 'UPDATE' then previous_bytes := old.byte_size; end if;
  if total_bytes + previous_bytes > 41943040
     and not (tg_op = 'UPDATE' and new.byte_size < previous_bytes) then
    raise exception 'STORAGE_LIMIT_ALREADY_EXCEEDED';
  end if;
  return new;
end $$;
