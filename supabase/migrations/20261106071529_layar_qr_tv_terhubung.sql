-- A QR code from a TV that is already connected adds a phone to that TV's mosque, and the TV can
-- tell when its QR code has been used. The TV keeps one key for good, also across QR codes.

drop function public.layar_cek(text);

/**
 * The version check a TV makes every few minutes. Empty when the key is not (or not yet) connected.
 * menunggu_qr: this key has a QR code that is still waiting to be scanned.
 */
create function public.layar_cek(p_key text)
returns table (versi integer, foto text, menunggu_qr boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_display uuid;
  v_role text;
begin
  select k.display_id, k.role into v_display, v_role from layar.keys k where k.key_hash = layar.hash(p_key);
  if v_display is null then
    return;
  end if;
  if v_role = 'tv' then
    update layar.displays d set tv_seen_at = now()
      where d.id = v_display and (d.tv_seen_at is null or d.tv_seen_at < now() - interval '1 hour');
  end if;
  return query
    select d.version, d.photo_path,
      exists (select 1 from layar.pairings p where p.tv_key_hash = layar.hash(p_key) and p.expires_at > now())
    from layar.displays d where d.id = v_display;
end $$;

drop function public.layar_lihat_qr(text);

/**
 * What the phone shows after scanning, without using up the QR code. No row = not valid (any more).
 * terhubung: the TV already belongs to a mosque, named nama; scanning then adds the phone to it.
 */
create function public.layar_lihat_qr(p_pair text)
returns table (isi jsonb, terhubung boolean, nama text)
language sql stable security definer set search_path = ''
as $$
  select p.snapshot, d.id is not null, d.data -> 'settings' ->> 'mosqueName'
  from layar.pairings p
  left join layar.keys k on k.key_hash = p.tv_key_hash and k.role = 'tv'
  left join layar.displays d on d.id = k.display_id
  where p.pair_hash = layar.hash(p_pair) and p.expires_at > now()
$$;

/**
 * Uses a QR code. In order:
 * - the TV is already connected: the phone joins that mosque (p_data is ignored);
 * - p_data is null: the TV joins the mosque of the phone holding p_phone_key;
 * - otherwise: a new mosque with p_data, edited by p_phone_key.
 * Returns no row when the QR code is no longer valid or the phone's key is not. Deleting first
 * makes it strictly one-time.
 */
create or replace function public.layar_klaim(p_pair text, p_phone_key text, p_data jsonb)
returns table (display uuid, versi integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_tv_hash bytea;
  v_tv_display uuid;
  v_phone_display uuid;
  v_display uuid;
begin
  select p.tv_key_hash, k.display_id into v_tv_hash, v_tv_display
    from layar.pairings p
    left join layar.keys k on k.key_hash = p.tv_key_hash and k.role = 'tv'
    where p.pair_hash = layar.hash(p_pair) and p.expires_at > now();
  if v_tv_hash is null then
    return;
  end if;

  select k.display_id into v_phone_display from layar.keys k
    where k.key_hash = layar.hash(p_phone_key) and k.role = 'phone';
  if v_tv_display is null and p_data is null and v_phone_display is null then
    return;
  end if;

  delete from layar.pairings p where p.pair_hash = layar.hash(p_pair) and p.expires_at > now();
  if not found then
    return;
  end if;

  if v_tv_display is not null then
    v_display := v_tv_display;
    insert into layar.keys (key_hash, display_id, role)
      values (layar.hash(p_phone_key), v_display, 'phone')
      on conflict (key_hash) do nothing;
  elsif p_data is null then
    v_display := v_phone_display;
    insert into layar.keys (key_hash, display_id, role) values (v_tv_hash, v_display, 'tv');
  else
    insert into layar.displays (data) values (p_data) returning id into v_display;
    insert into layar.keys (key_hash, display_id, role) values (layar.hash(p_phone_key), v_display, 'phone');
    insert into layar.revisions (display_id, version, data) values (v_display, 1, p_data);
    insert into layar.keys (key_hash, display_id, role) values (v_tv_hash, v_display, 'tv');
  end if;

  return query select d.id, d.version from layar.displays d where d.id = v_display;
end $$;

revoke all on function public.layar_cek(text) from public, anon, authenticated;
revoke all on function public.layar_lihat_qr(text) from public, anon, authenticated;
revoke all on function public.layar_klaim(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.layar_cek(text) to anon, service_role;
grant execute on function public.layar_lihat_qr(text) to service_role;
grant execute on function public.layar_klaim(text, text, jsonb) to service_role;
