// Runs the real migration on a real Postgres (PGlite), with Supabase's roles recreated, and checks
// what each role can actually do. The stand-ins below are the only parts that differ from Supabase.

import { readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

import { PGlite } from "@electric-sql/pglite"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

const MIGRATIONS = resolve(import.meta.dirname, "migrations")

// Supabase's default privileges: new functions and tables in `public` are open to these roles.
const SUPABASE_STANDIN = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  create function public.rls_auto_enable() returns event_trigger language plpgsql as $$ begin end $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
`

let db: PGlite
const FUTURE = "now() + interval '15 minutes'"
const DATA = { settings: { mosqueName: "Masjid A" }, city: { id: "1301", lokasi: "KOTA JAKARTA" } }
let seq = 0

async function as<T = Record<string, unknown>>(role: string, sql: string, params: unknown[] = []) {
  await db.exec(`set role ${role}`)
  try {
    return (await db.query<T>(sql, params)).rows
  } finally {
    await db.exec("reset role")
  }
}

const denied = (role: string, sql: string, params: unknown[] = []) =>
  expect(as(role, sql, params)).rejects.toThrow(/permission denied/)

/** Pairs a new mosque; returns its keys. */
async function newMosque(data: unknown = DATA) {
  const n = ++seq
  const keys = { pair: `pair-${n}`, tv: `tv-${n}`, phone: `phone-${n}` }
  await as("service_role", `select layar_buat_qr($1, $2, null, ${FUTURE})`, [keys.pair, keys.tv])
  const [row] = await as<{ display: string }>("service_role", "select * from layar_klaim($1, $2, $3)", [keys.pair, keys.phone, JSON.stringify(data)])
  return { ...keys, id: row.display }
}

const cek = (key: string) => as<{ versi: number; foto: string | null; menunggu_qr: boolean }>("anon", "select * from layar_cek($1)", [key])
const ambil = (key: string) => as<{ versi: number; isi: typeof DATA }>("anon", "select * from layar_ambil($1)", [key])
const simpan = async (key: string, name: string, base: number, force = false) =>
  (
    await as<{ status: string; versi: number | null }>("service_role", "select * from layar_simpan($1, $2, $3, $4)", [
      key,
      JSON.stringify({ ...DATA, settings: { mosqueName: name } }),
      base,
      force,
    ])
  )[0]

beforeAll(async () => {
  db = new PGlite()
  await db.exec(SUPABASE_STANDIN)
  for (const file of readdirSync(MIGRATIONS).sort()) await db.exec(readFileSync(resolve(MIGRATIONS, file), "utf8"))
})
afterAll(() => db.close())
beforeEach(() => db.exec("reset role"))

describe("what the public key can reach", () => {
  it.each(["displays", "keys", "pairings", "revisions", "rate_limits"])("cannot read or write layar.%s", async (table) => {
    await denied("anon", `select * from layar.${table}`)
    await denied("anon", `delete from layar.${table}`)
  })

  it.each([
    ["layar_buat_qr", "'a', 'b', null, now()"],
    ["layar_lihat_qr", "'a'"],
    ["layar_klaim", "'a', 'b', '{}'"],
    ["layar_info", "'a'"],
    ["layar_simpan", "'a', '{}', 1"],
    ["layar_set_foto", "'a', 'b'"],
    ["layar_putuskan", "'a'"],
    ["layar_hapus", "'a'"],
    ["layar_batas", "'a', 'b', 1"],
  ])("cannot call %s", async (fn, args) => {
    await denied("anon", `select ${fn}(${args})`)
    await denied("authenticated", `select ${fn}(${args})`)
  })

  it("cannot call the internal hash function", async () => {
    await denied("anon", "select layar.hash('a')")
  })

  it("gets nothing with a wrong key", async () => {
    await newMosque()
    expect(await cek("salah")).toEqual([])
    expect(await ambil("salah")).toEqual([])
  })

  it("can only use the two read functions when signed in as well", async () => {
    await denied("authenticated", "select * from layar_cek('a')")
    await denied("authenticated", "select * from layar_ambil('a')")
  })
})

describe("one mosque cannot touch another", () => {
  it("reads only its own data", async () => {
    const a = await newMosque()
    const b = await newMosque({ ...DATA, settings: { mosqueName: "Masjid B" } })
    expect((await ambil(a.tv))[0].isi.settings.mosqueName).toBe("Masjid A")
    expect((await ambil(b.tv))[0].isi.settings.mosqueName).toBe("Masjid B")
  })

  it("saves only to its own data", async () => {
    const a = await newMosque()
    const b = await newMosque({ ...DATA, settings: { mosqueName: "Masjid B" } })
    await simpan(a.phone, "Diubah", 1)
    expect((await ambil(b.tv))[0].isi.settings.mosqueName).toBe("Masjid B")
    expect((await ambil(b.tv))[0].versi).toBe(1)
  })

  it("cuts off only its own phones", async () => {
    const a = await newMosque()
    const b = await newMosque()
    await as("service_role", "select layar_putuskan($1)", [a.tv])
    expect(await cek(a.phone)).toEqual([])
    expect(await cek(b.phone)).toHaveLength(1)
  })
})

describe("nothing secret is stored", () => {
  it("keeps only hashes of keys and QR tokens", async () => {
    const a = await newMosque()
    await as("service_role", `select layar_buat_qr('qr-rahasia', 'tv-rahasia', null, ${FUTURE})`)
    const all = JSON.stringify([
      ...(await db.query("select * from layar.keys")).rows,
      ...(await db.query("select * from layar.pairings")).rows,
    ])
    for (const secret of [a.tv, a.phone, "qr-rahasia", "tv-rahasia"]) expect(all).not.toContain(secret)
  })
})

describe("QR codes", () => {
  it("can be viewed without being used up, showing the TV's data", async () => {
    await as("service_role", `select layar_buat_qr('lihat', 'tv-lihat', $1, ${FUTURE})`, [JSON.stringify(DATA)])
    const view = () => as<{ isi: typeof DATA }>("service_role", "select * from layar_lihat_qr('lihat')")
    expect((await view())[0].isi).toEqual(DATA)
    expect(await view()).toHaveLength(1)
  })

  it("work only once", async () => {
    await as("service_role", `select layar_buat_qr('sekali', 'tv-a', null, ${FUTURE})`)
    const claim = (phone: string) =>
      as("service_role", "select * from layar_klaim('sekali', $1, $2)", [phone, JSON.stringify(DATA)])
    expect(await claim("hp-pertama")).toHaveLength(1)
    expect(await claim("hp-kedua")).toEqual([])
    expect(await cek("hp-kedua")).toEqual([])
  })

  it("stop working once expired", async () => {
    await as("service_role", "select layar_buat_qr('lama', 'tv-lama', null, now() - interval '1 second')")
    expect(await as("service_role", "select * from layar_lihat_qr('lama')")).toEqual([])
    expect(await as("service_role", "select * from layar_klaim('lama', 'hp', $1)", [JSON.stringify(DATA)])).toEqual([])
    expect(await cek("tv-lama")).toEqual([])
  })

  it("let the TV see it is connected, with the key it made itself", async () => {
    const a = await newMosque()
    expect(await cek(a.tv)).toEqual([{ versi: 1, foto: null, menunggu_qr: false }])
  })

  it("connect a second TV to an existing mosque, keeping its data", async () => {
    const a = await newMosque()
    await simpan(a.phone, "Tetap", 1)
    await as("service_role", `select layar_buat_qr('tv2', 'tv-kedua', $1, ${FUTURE})`, [JSON.stringify({ lain: true })])
    await as("service_role", "select * from layar_klaim('tv2', $1, null)", [a.phone])
    expect((await ambil("tv-kedua"))[0].isi.settings.mosqueName).toBe("Tetap")
  })

  it("keep the QR code valid when a phone with a wrong key tries to connect", async () => {
    await as("service_role", `select layar_buat_qr('aman', 'tv-aman', null, ${FUTURE})`)
    expect(await as("service_role", "select * from layar_klaim('aman', 'hp-palsu', null)")).toEqual([])
    expect(await as("service_role", "select * from layar_lihat_qr('aman')")).toHaveLength(1)
  })
})

describe("saving", () => {
  it("raises the version the TV checks", async () => {
    const a = await newMosque()
    expect(await simpan(a.phone, "Baru", 1)).toEqual({ status: "ok", versi: 2 })
    expect((await cek(a.tv))[0].versi).toBe(2)
    expect((await ambil(a.tv))[0].isi.settings.mosqueName).toBe("Baru")
  })

  it("refuses a save based on old data, unless forced", async () => {
    const a = await newMosque()
    await simpan(a.phone, "Pertama", 1)
    expect(await simpan(a.tv, "Kedua", 1)).toEqual({ status: "conflict", versi: 2 })
    expect((await ambil(a.tv))[0].isi.settings.mosqueName).toBe("Pertama")
    expect(await simpan(a.tv, "Kedua", 1, true)).toEqual({ status: "ok", versi: 3 })
  })

  it("rejects an unknown key", async () => {
    expect(await simpan("salah", "x", 1)).toEqual({ status: "invalid", versi: null })
  })

  it("rejects data that is too large", async () => {
    const a = await newMosque()
    await expect(simpan(a.phone, "x".repeat(70_000), 1)).rejects.toThrow(/check constraint/)
    expect((await cek(a.tv))[0].versi).toBe(1)
  })

  it("keeps only the last five versions", async () => {
    const a = await newMosque()
    for (let v = 1; v <= 8; v++) await simpan(a.phone, `v${v}`, v)
    const { rows } = await db.query<{ version: number }>("select version from layar.revisions where display_id = $1 order by version", [a.id])
    expect(rows.map((r) => r.version)).toEqual([5, 6, 7, 8, 9])
  })
})

describe("cutting off phones", () => {
  it("is allowed for a TV and leaves the TV connected", async () => {
    const a = await newMosque()
    expect(await as("service_role", "select layar_putuskan($1) as n", [a.tv])).toEqual([{ n: 1 }])
    expect(await cek(a.phone)).toEqual([])
    expect(await cek(a.tv)).toHaveLength(1)
    expect((await simpan(a.phone, "x", 1)).status).toBe("invalid")
  })

  it("is refused for a phone, so a leaked link cannot lock others out", async () => {
    const a = await newMosque()
    expect(await as("service_role", "select layar_putuskan($1) as n", [a.phone])).toEqual([{ n: null }])
    expect(await cek(a.phone)).toHaveLength(1)
  })
})

describe("deleting a mosque", () => {
  it("removes its data and keys, and returns the photo to delete", async () => {
    const a = await newMosque()
    await as("service_role", "select * from layar_set_foto($1, 'abc.jpg')", [a.phone])
    expect(await as("service_role", "select * from layar_hapus($1)", [a.phone])).toEqual([{ foto: "abc.jpg" }])
    expect(await cek(a.tv)).toEqual([])
    const left = await db.query("select 1 from layar.revisions where display_id = $1", [a.id])
    expect(left.rows).toEqual([])
  })
})

describe("photo", () => {
  it("shows up in the TV's check, and returns the old path to delete", async () => {
    const a = await newMosque()
    expect(await as("service_role", "select * from layar_set_foto($1, 'satu.jpg')", [a.phone])).toEqual([{ foto_lama: null }])
    expect((await cek(a.tv))[0].foto).toBe("satu.jpg")
    expect(await as("service_role", "select * from layar_set_foto($1, 'dua.jpg')", [a.tv])).toEqual([{ foto_lama: "satu.jpg" }])
  })

  it("does nothing with an unknown key", async () => {
    expect(await as("service_role", "select * from layar_set_foto('salah', 'x.jpg')")).toEqual([])
  })
})

describe("TV last seen", () => {
  const seen = async (id: string) =>
    (await db.query<{ tv_seen_at: Date | null }>("select tv_seen_at from layar.displays where id = $1", [id])).rows[0].tv_seen_at

  it("is set by the TV's check, not a phone's", async () => {
    const a = await newMosque()
    await cek(a.phone)
    expect(await seen(a.id)).toBeNull()
    await cek(a.tv)
    expect(await seen(a.id)).not.toBeNull()
  })

  it("is written at most once an hour", async () => {
    const a = await newMosque()
    await db.query("update layar.displays set tv_seen_at = now() - interval '30 minutes' where id = $1", [a.id])
    const before = await seen(a.id)
    await cek(a.tv)
    expect(await seen(a.id)).toEqual(before)
    await db.query("update layar.displays set tv_seen_at = now() - interval '2 hours' where id = $1", [a.id])
    const old = await seen(a.id)
    await cek(a.tv)
    expect((await seen(a.id))!.getTime()).toBeGreaterThan(old!.getTime())
  })
})

describe("rate limit", () => {
  it("allows up to the maximum per IP and action", async () => {
    const hit = async (ip: string, action: string) =>
      (await as<{ ok: boolean }>("service_role", "select layar_batas($1, $2, 2) as ok", [Buffer.from(ip), action]))[0].ok
    expect(await hit("ip-1", "qr")).toBe(true)
    expect(await hit("ip-1", "qr")).toBe(true)
    expect(await hit("ip-1", "qr")).toBe(false)
    expect(await hit("ip-2", "qr")).toBe(true)
    expect(await hit("ip-1", "foto")).toBe(true)
  })
})

describe("photo bucket", () => {
  it("is limited to small JPEG files", async () => {
    const { rows } = await db.query("select public, file_size_limit::text as limit, allowed_mime_types from storage.buckets where id = 'layar-foto'")
    expect(rows).toEqual([{ public: true, limit: "4194304", allowed_mime_types: ["image/jpeg"] }])
  })
})

describe("QR codes from a TV that is already connected", () => {
  it("add a new phone to that TV's mosque, ignoring any data sent", async () => {
    const a = await newMosque()
    await as("service_role", `select layar_buat_qr('tambah-hp', $1, null, ${FUTURE})`, [a.tv])
    const [view] = await as<{ terhubung: boolean; nama: string }>("service_role", "select * from layar_lihat_qr('tambah-hp')")
    expect(view).toMatchObject({ terhubung: true, nama: "Masjid A" })
    const [row] = await as<{ display: string }>("service_role", "select * from layar_klaim('tambah-hp', 'hp-baru', $1)", [
      JSON.stringify({ ...DATA, settings: { mosqueName: "Palsu" } }),
    ])
    expect(row.display).toBe(a.id)
    expect((await ambil("hp-baru"))[0].isi.settings.mosqueName).toBe("Masjid A")
    expect((await ambil(a.phone))[0].versi).toBe(1)
  })

  it("tell the TV while its QR code waits, and when it has been used", async () => {
    const a = await newMosque()
    await as("service_role", `select layar_buat_qr('tunggu', $1, null, ${FUTURE})`, [a.tv])
    expect((await cek(a.tv))[0].menunggu_qr).toBe(true)
    await as("service_role", "select * from layar_klaim('tunggu', 'hp-tunggu', null)")
    expect((await cek(a.tv))[0].menunggu_qr).toBe(false)
  })

  it("do not count as waiting once expired", async () => {
    const a = await newMosque()
    await as("service_role", "select layar_buat_qr('basi', $1, null, now() - interval '1 second')", [a.tv])
    expect((await cek(a.tv))[0].menunggu_qr).toBe(false)
  })

  it("let a phone that already belongs to the mosque scan again without harm", async () => {
    const a = await newMosque()
    await as("service_role", `select layar_buat_qr('ulang', $1, null, ${FUTURE})`, [a.tv])
    expect(await as("service_role", "select * from layar_klaim('ulang', $1, null)", [a.phone])).toHaveLength(1)
    const { rows } = await db.query("select count(*)::int as n from layar.keys where display_id = $1", [a.id])
    expect(rows).toEqual([{ n: 2 }])
  })
})

describe("QR codes from a new TV", () => {
  it("say the TV is not connected yet, and carry its current data", async () => {
    await as("service_role", `select layar_buat_qr('baru', 'tv-baru-x', $1, ${FUTURE})`, [JSON.stringify(DATA)])
    const [view] = await as<{ isi: typeof DATA; terhubung: boolean; nama: string | null }>("service_role", "select * from layar_lihat_qr('baru')")
    expect(view).toEqual({ isi: DATA, terhubung: false, nama: null })
  })

  it("need data or a known phone key", async () => {
    await as("service_role", `select layar_buat_qr('kosong', 'tv-kosong', null, ${FUTURE})`)
    expect(await as("service_role", "select * from layar_klaim('kosong', 'hp-asing', null)")).toEqual([])
    expect(await as("service_role", "select * from layar_lihat_qr('kosong')")).toHaveLength(1)
  })

  it("are invisible to the TV until used: a TV key alone shows nothing", async () => {
    await as("service_role", `select layar_buat_qr('diam', 'tv-diam', null, ${FUTURE})`)
    expect(await cek("tv-diam")).toEqual([])
  })
})
