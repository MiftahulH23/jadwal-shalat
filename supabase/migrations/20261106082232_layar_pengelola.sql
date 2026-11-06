-- Managers instead of a shared link: the first phone is the main manager (admin), who invites up to two
-- other phones, approves phones that scanned the TV, and can remove any of them. A TV cannot cut phones
-- off any more: it stands in a public place. If every admin phone is lost, the TV can be reset with a
-- PIN chosen by an admin. See docs/RANCANGAN-ATUR-DARI-HP.md.

-- ---------------------------------------------------------------------------
-- Roles: tv, admin (main manager), editor (manager), pending (scanned the TV, waits for an admin)
-- ---------------------------------------------------------------------------

do $$
declare
  c text;
begin
  for c in
    select con.conname from pg_constraint con
    where con.conrelid = 'layar.keys'::regclass and con.contype = 'c'
  loop
    execute format('alter table layar.keys drop constraint %I', c);
  end loop;
end $$;

-- Phones connected so far: the first one of each mosque becomes its main manager.
update layar.keys k set role = case
    when k.key_hash = (
      select k2.key_hash from layar.keys k2
      where k2.display_id = k.display_id and k2.role = 'phone'
      order by k2.created_at, k2.key_hash limit 1
    ) then 'admin'
    else 'editor'
  end
  where k.role = 'phone';

alter table layar.keys add constraint keys_role_check check (role in ('tv', 'admin', 'editor', 'pending'));
alter table layar.keys add column label text check (char_length(label) <= 40);
-- When a TV key last checked in (at most once an hour), so keys of TVs that are gone can be removed.
alter table layar.keys add column last_seen_at timestamptz not null default now();

alter table layar.displays
  add column pin_hash bytea,
  add column pin_salt text,
  add column pin_attempts integer not null default 0,
  add column pin_locked_until timestamptz;

/** Phones that can manage a mosque: at most this many, the main manager included. */
create function layar.max_phones() returns integer language sql immutable as $$ select 3 $$;

/** The mosque and role of a key. */
create function layar.lookup(p_key text, out display_id uuid, out role text)
language sql stable set search_path = ''
as $$ select k.display_id, k.role from layar.keys k where k.key_hash = layar.hash(p_key) $$;

create function layar.phone_count(p_display uuid) returns integer
language sql stable set search_path = ''
as $$ select count(*)::integer from layar.keys k where k.display_id = p_display and k.role in ('admin', 'editor') $$;

-- ---------------------------------------------------------------------------
-- Pending phones see and change nothing
-- ---------------------------------------------------------------------------

create or replace function public.layar_cek(p_key text)
returns table (versi integer, foto text, menunggu_qr boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_display uuid;
  v_role text;
begin
  select l.display_id, l.role into v_display, v_role from layar.lookup(p_key) l;
  if v_display is null or v_role = 'pending' then
    return;
  end if;
  if v_role = 'tv' then
    update layar.displays d set tv_seen_at = now()
      where d.id = v_display and (d.tv_seen_at is null or d.tv_seen_at < now() - interval '1 hour');
    update layar.keys k set last_seen_at = now()
      where k.key_hash = layar.hash(p_key) and k.last_seen_at < now() - interval '1 hour';
  end if;
  return query
    select d.version, d.photo_path,
      exists (select 1 from layar.pairings p where p.tv_key_hash = layar.hash(p_key) and p.expires_at > now())
    from layar.displays d where d.id = v_display;
end $$;

/**
 * Housekeeping, run whenever a QR code is made, so no scheduled job is needed: expired QR codes, old
 * rate-limit counts, and keys of TVs that have not checked in for 60 days (a closed private window, a
 * replaced TV). A TV that comes back after that shows its schedule as before and is simply scanned again.
 */
create function layar.bersihkan() returns void
language sql set search_path = ''
as $$
  delete from layar.pairings p where p.expires_at < now();
  delete from layar.rate_limits r where r.window_start < now() - interval '1 day';
  delete from layar.keys k where k.role = 'tv' and k.last_seen_at < now() - interval '60 days';
$$;

create or replace function public.layar_buat_qr(p_pair text, p_tv_key text, p_snapshot jsonb, p_expires_at timestamptz)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform layar.bersihkan();
  insert into layar.pairings (pair_hash, tv_key_hash, snapshot, expires_at)
    values (layar.hash(p_pair), layar.hash(p_tv_key), p_snapshot, p_expires_at);
end $$;

create or replace function public.layar_ambil(p_key text)
returns table (versi integer, foto text, isi jsonb)
language sql stable security definer set search_path = ''
as $$
  select d.version, d.photo_path, d.data
  from layar.keys k join layar.displays d on d.id = k.display_id
  where k.key_hash = layar.hash(p_key) and k.role <> 'pending'
$$;

drop function public.layar_info(text);

/** Everything a phone's page needs. A pending phone only learns that it is pending. */
create function public.layar_info(p_key text)
returns table (peran text, versi integer, foto text, isi jsonb, diubah timestamptz, tv_terlihat timestamptz, ada_pin boolean)
language sql stable security definer set search_path = ''
as $$
  select k.role,
    case when k.role = 'pending' then null else d.version end,
    case when k.role = 'pending' then null else d.photo_path end,
    case when k.role = 'pending' then null else d.data end,
    case when k.role = 'pending' then null else d.updated_at end,
    case when k.role = 'pending' then null else d.tv_seen_at end,
    case when k.role = 'admin' then d.pin_hash is not null else null end
  from layar.keys k join layar.displays d on d.id = k.display_id
  where k.key_hash = layar.hash(p_key)
$$;

create or replace function public.layar_simpan(p_key text, p_data jsonb, p_base_version integer, p_force boolean default false)
returns table (status text, versi integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_display uuid;
  v_role text;
  v_version integer;
begin
  select l.display_id, l.role into v_display, v_role from layar.lookup(p_key) l;
  if v_display is null or v_role = 'pending' then
    return query select 'invalid'::text, null::integer;
    return;
  end if;

  -- The row lock makes two saves at the same moment take turns, so one of them sees the conflict.
  select d.version into v_version from layar.displays d where d.id = v_display for update;
  if v_version <> p_base_version and not p_force then
    return query select 'conflict'::text, v_version;
    return;
  end if;

  v_version := v_version + 1;
  update layar.displays d set data = p_data, version = v_version, updated_at = now() where d.id = v_display;
  insert into layar.revisions (display_id, version, data) values (v_display, v_version, p_data);
  delete from layar.revisions r where r.display_id = v_display and r.version <= v_version - 5;
  return query select 'ok'::text, v_version;
end $$;

create or replace function public.layar_set_foto(p_key text, p_path text)
returns table (foto_lama text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_display uuid;
  v_role text;
  v_old text;
begin
  select l.display_id, l.role into v_display, v_role from layar.lookup(p_key) l;
  if v_display is null or v_role = 'pending' then
    return;
  end if;
  select d.photo_path into v_old from layar.displays d where d.id = v_display for update;
  update layar.displays d set photo_path = p_path, updated_at = now() where d.id = v_display;
  return query select v_old;
end $$;

/** Removes the mosque's data. Main managers only. Returns the photo path to delete. */
create or replace function public.layar_hapus(p_key text)
returns table (foto text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_display uuid;
  v_role text;
  v_photo text;
begin
  select l.display_id, l.role into v_display, v_role from layar.lookup(p_key) l;
  if v_display is null or v_role <> 'admin' then
    return;
  end if;
  delete from layar.displays d where d.id = v_display returning d.photo_path into v_photo;
  return query select v_photo;
end $$;

-- A TV no longer cuts phones off: it stands where anyone can reach it.
drop function public.layar_putuskan(text);

-- ---------------------------------------------------------------------------
-- QR codes
-- ---------------------------------------------------------------------------

drop function public.layar_lihat_qr(text);

/**
 * What the phone shows after scanning, without using up the QR code. No row = not valid (any more).
 * terhubung: the TV already belongs to a mosque, named nama. punya_pengelola: that mosque has a main
 * manager, so a phone scanning it has to wait for approval; without one (after a reset), it becomes one.
 */
create function public.layar_lihat_qr(p_pair text)
returns table (isi jsonb, terhubung boolean, nama text, punya_pengelola boolean, penuh boolean)
language sql stable security definer set search_path = ''
as $$
  select p.snapshot, d.id is not null, d.data -> 'settings' ->> 'mosqueName',
    exists (select 1 from layar.keys a where a.display_id = d.id and a.role = 'admin'),
    d.id is not null and layar.phone_count(d.id) >= layar.max_phones()
  from layar.pairings p
  left join layar.keys k on k.key_hash = p.tv_key_hash and k.role = 'tv'
  left join layar.displays d on d.id = k.display_id
  where p.pair_hash = layar.hash(p_pair) and p.expires_at > now()
$$;

drop function public.layar_klaim(text, text, jsonb);

/**
 * Uses a QR code. In order:
 * - the TV is already connected: the phone asks to join (pending). If the mosque has no main manager
 *   (after a reset with the PIN), it becomes the main manager instead;
 * - p_data is null: the TV joins the mosque of a manager's phone (a second or replacement TV);
 * - otherwise: a new mosque with p_data, and this phone is its main manager.
 * peran: the phone's role afterwards. No row when the QR code or the phone's key is not valid.
 */
create function public.layar_klaim(p_pair text, p_phone_key text, p_data jsonb, p_label text default null)
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

  delete from layar.pairings p where p.pair_hash = layar.hash(p_pair) and p.expires_at > now();
  if not found then
    return;
  end if;

  if v_tv_display is not null then
    v_display := v_tv_display;
    if v_phone_display = v_display then
      v_role := v_phone_role; -- Already in: nothing changes.
    else
      v_role := case
        when exists (select 1 from layar.keys a where a.display_id = v_display and a.role = 'admin') then 'pending'
        else 'admin'
      end;
      -- One phone waits at a time, so the QR code cannot be used to pile up requests.
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

-- ---------------------------------------------------------------------------
-- Main manager: phones, invitations, PIN
-- ---------------------------------------------------------------------------

/** The phones of the caller's mosque. Main managers only. id: what layar_atur_hp takes. */
create function public.layar_daftar_hp(p_admin_key text)
returns table (id text, peran text, label text, ditambahkan timestamptz, saya boolean)
language sql stable security definer set search_path = ''
as $$
  select encode(k.key_hash, 'hex'), k.role, k.label, k.created_at, k.key_hash = layar.hash(p_admin_key)
  from layar.keys k
  where k.role <> 'tv'
    and k.display_id = (select l.display_id from layar.lookup(p_admin_key) l where l.role = 'admin')
  order by k.role = 'pending' desc, k.created_at
$$;

/**
 * Adds a manager's phone with a key the inviting phone made; the link holding it goes to that person.
 * status: 'ok', 'penuh' (already three phones) or 'ditolak' (not a main manager).
 */
create function public.layar_undang(p_admin_key text, p_new_key text, p_label text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_display uuid;
begin
  select l.display_id into v_display from layar.lookup(p_admin_key) l where l.role = 'admin';
  if v_display is null then
    return 'ditolak';
  end if;
  perform 1 from layar.displays d where d.id = v_display for update;
  if layar.phone_count(v_display) >= layar.max_phones() then
    return 'penuh';
  end if;
  insert into layar.keys (key_hash, display_id, role, label)
    values (layar.hash(p_new_key), v_display, 'editor', nullif(left(trim(coalesce(p_label, '')), 40), ''));
  return 'ok';
end $$;

/**
 * A main manager acts on another phone of the mosque: 'setujui' (approve a pending phone), 'cabut'
 * (remove), 'jadikan_admin' (make it a main manager too, e.g. as a backup) or 'jadikan_pengurus'.
 * Never on itself, so a mosque always keeps a main manager. status: 'ok', 'penuh' or 'ditolak'.
 */
create function public.layar_atur_hp(p_admin_key text, p_id text, p_aksi text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_display uuid;
  v_self bytea := layar.hash(p_admin_key);
  v_target bytea;
  v_role text;
begin
  select l.display_id into v_display from layar.lookup(p_admin_key) l where l.role = 'admin';
  if v_display is null or p_id !~ '^[0-9a-f]{64}$' then
    return 'ditolak';
  end if;
  v_target := decode(p_id, 'hex');
  perform 1 from layar.displays d where d.id = v_display for update;
  select k.role into v_role from layar.keys k
    where k.key_hash = v_target and k.display_id = v_display and k.role <> 'tv' and k.key_hash <> v_self;
  if v_role is null then
    return 'ditolak';
  end if;

  if p_aksi = 'cabut' then
    delete from layar.keys k where k.key_hash = v_target;
  elsif p_aksi = 'setujui' and v_role = 'pending' then
    if layar.phone_count(v_display) >= layar.max_phones() then
      return 'penuh';
    end if;
    update layar.keys k set role = 'editor' where k.key_hash = v_target;
  elsif p_aksi = 'jadikan_admin' and v_role = 'editor' then
    update layar.keys k set role = 'admin' where k.key_hash = v_target;
  elsif p_aksi = 'jadikan_pengurus' and v_role = 'admin' then
    update layar.keys k set role = 'editor' where k.key_hash = v_target;
  else
    return 'ditolak';
  end if;
  return 'ok';
end $$;

/** Sets the emergency PIN (6 digits). Main managers only. Stored salted and hashed. */
create function public.layar_set_pin(p_admin_key text, p_pin text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_display uuid;
  v_salt text := gen_random_uuid()::text;
begin
  select l.display_id into v_display from layar.lookup(p_admin_key) l where l.role = 'admin';
  if v_display is null or p_pin !~ '^[0-9]{6}$' then
    return false;
  end if;
  update layar.displays d
    set pin_salt = v_salt, pin_hash = layar.hash(v_salt || p_pin), pin_attempts = 0, pin_locked_until = null
    where d.id = v_display;
  return true;
end $$;

/**
 * From the TV, when every main manager's phone is lost: with the right PIN, every phone is removed and
 * the next phone to scan the TV becomes the main manager. The data stays. The PIN is used up, so the new
 * main manager chooses a new one. Five wrong tries lock it for an hour.
 * status: 'ok', 'salah', 'terkunci', 'tanpa_pin' or 'ditolak'.
 */
create function public.layar_reset(p_tv_key text, p_pin text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_display uuid;
  v_row record;
begin
  select l.display_id into v_display from layar.lookup(p_tv_key) l where l.role = 'tv';
  if v_display is null then
    return 'ditolak';
  end if;
  select d.pin_hash, d.pin_salt, d.pin_attempts, d.pin_locked_until into v_row
    from layar.displays d where d.id = v_display for update;
  if v_row.pin_hash is null then
    return 'tanpa_pin';
  end if;
  if v_row.pin_locked_until is not null and v_row.pin_locked_until > now() then
    return 'terkunci';
  end if;
  if layar.hash(v_row.pin_salt || coalesce(p_pin, '')) <> v_row.pin_hash then
    if v_row.pin_attempts + 1 >= 5 then
      update layar.displays d set pin_attempts = 0, pin_locked_until = now() + interval '1 hour' where d.id = v_display;
      return 'terkunci';
    end if;
    update layar.displays d set pin_attempts = v_row.pin_attempts + 1 where d.id = v_display;
    return 'salah';
  end if;

  delete from layar.keys k where k.display_id = v_display and k.role in ('admin', 'editor', 'pending');
  update layar.displays d
    set pin_hash = null, pin_salt = null, pin_attempts = 0, pin_locked_until = null
    where d.id = v_display;
  return 'ok';
end $$;

-- ---------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname like 'layar\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

revoke all on all functions in schema layar from public, anon, authenticated;
grant execute on function public.layar_cek(text) to anon;
grant execute on function public.layar_ambil(text) to anon;
