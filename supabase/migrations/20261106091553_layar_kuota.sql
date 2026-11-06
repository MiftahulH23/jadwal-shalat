-- Staying within the free plan (owner's requirement), and not keeping data longer than needed:
-- - at most 500 mosques, so 500 TVs checking every 5 minutes stay under 5 GB of egress a month;
-- - photos of at most 1.5 MB, so 500 of them fit in the 1 GB of storage;
-- - a mosque nobody used for 12 months is deleted (its photo by the server route, from the paths returned).

/** Mosques the free plan can carry. */
create function layar.max_displays() returns integer language sql immutable set search_path = '' as $$ select 500 $$;

update storage.buckets set file_size_limit = 1572864 where id = 'layar-foto';

drop function public.layar_buat_qr(text, text, jsonb, timestamptz);
drop function layar.bersihkan();

/**
 * Housekeeping, run whenever a QR code is made, so no scheduled job is needed: expired QR codes, old
 * rate-limit counts, keys of TVs that have not checked in for 60 days, and mosques neither a TV nor a
 * phone touched for 12 months. Returns the photos of those mosques, for the caller to delete.
 */
create function layar.bersihkan() returns setof text
language plpgsql set search_path = ''
as $$
begin
  delete from layar.pairings p where p.expires_at < now();
  delete from layar.rate_limits r where r.window_start < now() - interval '1 day';
  delete from layar.keys k where k.role = 'tv' and k.last_seen_at < now() - interval '60 days';
  return query
    delete from layar.displays d
    where greatest(d.created_at, d.updated_at, coalesce(d.tv_seen_at, d.created_at)) < now() - interval '12 months'
    returning d.photo_path;
end $$;

/** Opens a QR code. Returns photos of mosques removed by the housekeeping, to delete from storage. */
create function public.layar_buat_qr(p_pair text, p_tv_key text, p_snapshot jsonb, p_expires_at timestamptz)
returns setof text
language plpgsql security definer set search_path = ''
as $$
begin
  return query select f from layar.bersihkan() f where f is not null;
  insert into layar.pairings (pair_hash, tv_key_hash, snapshot, expires_at)
    values (layar.hash(p_pair), layar.hash(p_tv_key), p_snapshot, p_expires_at);
end $$;

/**
 * Uses a QR code (see the previous version for the rules). New: a new mosque is refused with
 * peran 'penuh' once the free plan's limit of mosques is reached; the QR code stays valid then.
 */
create or replace function public.layar_klaim(p_pair text, p_phone_key text, p_data jsonb, p_label text default null)
returns table (display uuid, versi integer, peran text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_tv_hash bytea;
  v_tv_display uuid;
  v_phone_display uuid;
  v_phone_role text;
  v_display uuid;
  v_role text;
  v_label text := nullif(left(trim(coalesce(p_label, '')), 40), '');
begin
  select p.tv_key_hash, k.display_id into v_tv_hash, v_tv_display
    from layar.pairings p
    left join layar.keys k on k.key_hash = p.tv_key_hash and k.role = 'tv'
    where p.pair_hash = layar.hash(p_pair) and p.expires_at > now();
  if v_tv_hash is null then
    return;
  end if;

  select l.display_id, l.role into v_phone_display, v_phone_role from layar.lookup(p_phone_key) l;
  if v_tv_display is null and p_data is null and (v_phone_display is null or v_phone_role not in ('admin', 'editor')) then
    return;
  end if;
  if v_tv_display is null and p_data is not null and (select count(*) from layar.displays) >= layar.max_displays() then
    return query select null::uuid, null::integer, 'penuh'::text;
    return;
  end if;

  delete from layar.pairings p where p.pair_hash = layar.hash(p_pair) and p.expires_at > now();
  if not found then
    return;
  end if;

  if v_tv_display is not null then
    v_display := v_tv_display;
    if v_phone_display = v_display then
      v_role := v_phone_role;
    else
      v_role := case
        when exists (select 1 from layar.keys a where a.display_id = v_display and a.role = 'admin') then 'pending'
        else 'admin'
      end;
      if v_role = 'pending' then
        delete from layar.keys k where k.display_id = v_display and k.role = 'pending';
      end if;
      insert into layar.keys (key_hash, display_id, role, label) values (layar.hash(p_phone_key), v_display, v_role, v_label);
    end if;
  elsif p_data is null then
    v_display := v_phone_display;
    v_role := v_phone_role;
    insert into layar.keys (key_hash, display_id, role) values (v_tv_hash, v_display, 'tv');
  else
    v_role := 'admin';
    insert into layar.displays (data) values (p_data) returning id into v_display;
    insert into layar.keys (key_hash, display_id, role, label) values (layar.hash(p_phone_key), v_display, 'admin', v_label);
    insert into layar.revisions (display_id, version, data) values (v_display, 1, p_data);
    insert into layar.keys (key_hash, display_id, role) values (v_tv_hash, v_display, 'tv');
  end if;

  return query select d.id, d.version, v_role from layar.displays d where d.id = v_display;
end $$;

revoke all on function public.layar_buat_qr(text, text, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.layar_klaim(text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.layar_buat_qr(text, text, jsonb, timestamptz) to service_role;
grant execute on function public.layar_klaim(text, text, jsonb, text) to service_role;
revoke all on all functions in schema layar from public, anon, authenticated;
