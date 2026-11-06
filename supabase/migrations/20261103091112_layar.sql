-- Managing the mosque display from a phone. See docs/RANCANGAN-ATUR-DARI-HP.md.
--
-- Tables live in a schema the API does not expose; everything goes through functions.
-- layar_cek and layar_ambil are the only functions the public (publishable) key can call.
-- Only hashes of keys are stored, so a leaked database gives no edit access.

create schema layar;
revoke all on schema layar from public, anon, authenticated;

create table layar.displays (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null check (octet_length(data::text) <= 65536), -- { settings, city }
  version integer not null default 1,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  tv_seen_at timestamptz -- updated at most once an hour
);

create table layar.keys (
  key_hash bytea primary key,
  display_id uuid not null references layar.displays on delete cascade,
  role text not null check (role in ('tv', 'phone')),
  created_at timestamptz not null default now()
);
create index on layar.keys (display_id);

-- One row per QR code shown on a TV. Used once, then deleted.
create table layar.pairings (
  pair_hash bytea primary key,
  tv_key_hash bytea not null,
  snapshot jsonb check (octet_length(snapshot::text) <= 65536), -- the TV's current data, if any
  expires_at timestamptz not null
);

-- The last few versions per mosque, to undo mistakes or misuse.
create table layar.revisions (
  display_id uuid not null references layar.displays on delete cascade,
  version integer not null,
  data jsonb not null,
  saved_at timestamptz not null default now(),
  primary key (display_id, version)
);

create table layar.rate_limits (
  ip_hash bytea not null,
  action text not null,
  window_start timestamptz not null,
  count integer not null default 1,
  primary key (ip_hash, action, window_start)
);

-- A second line of defence: without policies, no role except the owner can touch these rows.
alter table layar.displays enable row level security;
alter table layar.keys enable row level security;
alter table layar.pairings enable row level security;
alter table layar.revisions enable row level security;
alter table layar.rate_limits enable row level security;

create function layar.hash(p_text text) returns bytea
language sql immutable set search_path = ''
as $$ select pg_catalog.sha256(pg_catalog.convert_to(p_text, 'UTF8')) $$;

-- ---------------------------------------------------------------------------
-- Called by the TV with the publishable key
-- ---------------------------------------------------------------------------

/** The version check a TV makes every few minutes. Empty when the key is not valid (any more). */
create function public.layar_cek(p_key text)
returns table (versi integer, foto text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_display uuid;
begin
  select k.display_id into v_display from layar.keys k where k.key_hash = layar.hash(p_key);
  if v_display is null then
    return;
  end if;
  update layar.displays d set tv_seen_at = now()
    where d.id = v_display
      and (select k.role from layar.keys k where k.key_hash = layar.hash(p_key)) = 'tv'
      and (d.tv_seen_at is null or d.tv_seen_at < now() - interval '1 hour');
  return query select d.version, d.photo_path from layar.displays d where d.id = v_display;
end $$;

create function public.layar_ambil(p_key text)
returns table (versi integer, foto text, isi jsonb)
language sql stable security definer set search_path = ''
as $$
  select d.version, d.photo_path, d.data
  from layar.keys k join layar.displays d on d.id = k.display_id
  where k.key_hash = layar.hash(p_key)
$$;

-- ---------------------------------------------------------------------------
-- Called by the server routes with the secret key
-- ---------------------------------------------------------------------------

/** Opens a QR code. Also clears out expired ones, so no scheduled job is needed. */
create function public.layar_buat_qr(p_pair text, p_tv_key text, p_snapshot jsonb, p_expires_at timestamptz)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from layar.pairings p where p.expires_at < now();
  delete from layar.rate_limits r where r.window_start < now() - interval '1 day';
  insert into layar.pairings (pair_hash, tv_key_hash, snapshot, expires_at)
    values (layar.hash(p_pair), layar.hash(p_tv_key), p_snapshot, p_expires_at);
end $$;

/** What the phone shows after scanning, without using up the QR code. No row = not valid (any more). */
create function public.layar_lihat_qr(p_pair text)
returns table (isi jsonb)
language sql stable security definer set search_path = ''
as $$
  select p.snapshot from layar.pairings p
  where p.pair_hash = layar.hash(p_pair) and p.expires_at > now()
$$;

/**
 * Uses a QR code: for a new mosque with p_data and p_phone_key, or to connect the TV to the
 * mosque of the phone holding p_phone_key when p_data is null. Returns no row when the QR
 * code is no longer valid or the phone's key is not. Deleting first makes it strictly one-time.
 */
create function public.layar_klaim(p_pair text, p_phone_key text, p_data jsonb)
returns table (display uuid, versi integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_tv_hash bytea;
  v_display uuid;
begin
  if p_data is null then
    select k.display_id into v_display from layar.keys k
      where k.key_hash = layar.hash(p_phone_key) and k.role = 'phone';
    if v_display is null then
      return;
    end if;
  end if;

  delete from layar.pairings p
    where p.pair_hash = layar.hash(p_pair) and p.expires_at > now()
    returning p.tv_key_hash into v_tv_hash;
  if v_tv_hash is null then
    return;
  end if;

  if v_display is null then
    insert into layar.displays (data) values (p_data) returning id into v_display;
    insert into layar.keys (key_hash, display_id, role) values (layar.hash(p_phone_key), v_display, 'phone');
    insert into layar.revisions (display_id, version, data) values (v_display, 1, p_data);
  end if;
  insert into layar.keys (key_hash, display_id, role) values (v_tv_hash, v_display, 'tv');

  return query select d.id, d.version from layar.displays d where d.id = v_display;
end $$;

/** Everything a settings page needs. */
create function public.layar_info(p_key text)
returns table (peran text, versi integer, foto text, isi jsonb, diubah timestamptz, tv_terlihat timestamptz)
language sql stable security definer set search_path = ''
as $$
  select k.role, d.version, d.photo_path, d.data, d.updated_at, d.tv_seen_at
  from layar.keys k join layar.displays d on d.id = k.display_id
  where k.key_hash = layar.hash(p_key)
$$;

/**
 * Saves new data. status: 'ok', 'conflict' (someone saved in between; p_force overrides it)
 * or 'invalid' (unknown key). Keeps the last five versions.
 */
create function public.layar_simpan(p_key text, p_data jsonb, p_base_version integer, p_force boolean default false)
returns table (status text, versi integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_display uuid;
  v_version integer;
begin
  select k.display_id into v_display from layar.keys k where k.key_hash = layar.hash(p_key);
  if v_display is null then
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

/** Sets the photo. Returns the previous path, so the route can delete that file. No row = unknown key. */
create function public.layar_set_foto(p_key text, p_path text)
returns table (foto_lama text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_display uuid;
  v_old text;
begin
  select k.display_id into v_display from layar.keys k where k.key_hash = layar.hash(p_key);
  if v_display is null then
    return;
  end if;
  select d.photo_path into v_old from layar.displays d where d.id = v_display for update;
  update layar.displays d set photo_path = p_path, updated_at = now() where d.id = v_display;
  return query select v_old;
end $$;

/** Cuts off every phone. TV keys only: a leaked phone link must not be able to lock others out. */
create function public.layar_putuskan(p_tv_key text)
returns integer -- phones removed; null when this is not a TV key
language plpgsql security definer set search_path = ''
as $$
declare
  v_display uuid;
  v_count integer;
begin
  select k.display_id into v_display from layar.keys k
    where k.key_hash = layar.hash(p_tv_key) and k.role = 'tv';
  if v_display is null then
    return null;
  end if;
  delete from layar.keys k where k.display_id = v_display and k.role = 'phone';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

/** Removes the mosque's data. Returns the photo path to delete. No row = unknown key. */
create function public.layar_hapus(p_key text)
returns table (foto text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_display uuid;
  v_photo text;
begin
  select k.display_id into v_display from layar.keys k where k.key_hash = layar.hash(p_key);
  if v_display is null then
    return;
  end if;
  delete from layar.displays d where d.id = v_display returning d.photo_path into v_photo;
  return query select v_photo;
end $$;

/** Counts one use of an action in this hour. False once p_max is passed. */
create function public.layar_batas(p_ip_hash bytea, p_action text, p_max integer)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into layar.rate_limits as r (ip_hash, action, window_start)
    values (p_ip_hash, p_action, date_trunc('hour', now()))
    on conflict (ip_hash, action, window_start) do update set count = r.count + 1
    returning r.count into v_count;
  return v_count <= p_max;
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

-- ---------------------------------------------------------------------------
-- Photos: public to read by their random name; no policies, so only the secret key can write or list.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('layar-foto', 'layar-foto', true, 4194304, array['image/jpeg']);
