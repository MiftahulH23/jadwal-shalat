-- History: a main manager can see the last five versions of the settings and bring one back, e.g. after
-- a mistake or after a leaked link was misused. Bringing one back saves it as a new version, so the TVs
-- pick it up like any other change and nothing is lost.

/** The kept versions, newest first. Main managers only. */
create function public.layar_riwayat(p_admin_key text)
returns table (versi integer, disimpan timestamptz, isi jsonb, terkini boolean)
language sql stable security definer set search_path = ''
as $$
  select r.version, r.saved_at, r.data, r.version = d.version
  from layar.revisions r
  join layar.displays d on d.id = r.display_id
  where r.display_id = (select l.display_id from layar.lookup(p_admin_key) l where l.role = 'admin')
  order by r.version desc
$$;

/** Brings back a kept version as the newest one. Returns the new version, or null when not allowed. */
create function public.layar_pulihkan(p_admin_key text, p_version integer)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_display uuid;
  v_data jsonb;
  v_version integer;
begin
  select l.display_id into v_display from layar.lookup(p_admin_key) l where l.role = 'admin';
  if v_display is null then
    return null;
  end if;
  select d.version into v_version from layar.displays d where d.id = v_display for update;
  select r.data into v_data from layar.revisions r where r.display_id = v_display and r.version = p_version;
  if v_data is null then
    return null;
  end if;

  v_version := v_version + 1;
  update layar.displays d set data = v_data, version = v_version, updated_at = now() where d.id = v_display;
  insert into layar.revisions (display_id, version, data) values (v_display, v_version, v_data);
  delete from layar.revisions r where r.display_id = v_display and r.version <= v_version - 5;
  return v_version;
end $$;

revoke all on function public.layar_riwayat(text) from public, anon, authenticated;
revoke all on function public.layar_pulihkan(text, integer) from public, anon, authenticated;
grant execute on function public.layar_riwayat(text) to service_role;
grant execute on function public.layar_pulihkan(text, integer) to service_role;
