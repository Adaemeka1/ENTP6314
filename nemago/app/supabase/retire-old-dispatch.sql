-- Removes an OLDER NemaGo dispatch design if one is in the database, so the
-- current design (the other files in this folder) can be installed.
-- Run it FIRST, before schema.sql. Safe to run more than once.
--
-- It is careful:
--   * It only touches tables it recognizes as the old design, by a column the
--     current design never has.
--   * If any of those old tables contains rows, it STOPS with an error and
--     changes nothing, so no real data is ever deleted.
--   * It does not touch profiles or the sign-in accounts.
do $$
declare
  t record;
  f record;
  n bigint;
begin
  for t in
    select * from (values
      ('dispatch_requests', 'general_area'),
      ('drivers', 'license_plate'),
      ('mechanics', 'hourly_rate')
    ) as v(table_name, old_column)
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = t.table_name
        and column_name = t.old_column
    ) then
      execute format('select count(*) from public.%I', t.table_name) into n;
      if n > 0 then
        raise exception
          'The older % table has % rows, so nothing was changed. Do not continue: ask for help first.',
          t.table_name, n;
      end if;
      execute format('drop table public.%I cascade', t.table_name);
    end if;
  end loop;

  -- An older function with the same name but a different parameter name would
  -- block the current one from being installed.
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace s on s.oid = p.pronamespace
    where s.nspname = 'public'
      and p.proname = 'admin_expire_checkout'
      and 'target_intent_id' = any (p.proargnames)
  loop
    execute 'drop function ' || f.signature;
  end loop;
end;
$$;
