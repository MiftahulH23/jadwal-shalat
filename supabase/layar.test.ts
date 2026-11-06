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

type Phone = { id: string; peran: string; label: string | null; saya: boolean }
const daftar = (key: string) => as<Phone>("service_role", "select * from layar_daftar_hp($1)", [key])
const undang = async (admin: string, key: string, label = "Pengurus") =>
  (await as<{ s: string }>("service_role", "select layar_undang($1, $2, $3) as s", [admin, key, label]))[0].s
const aturHp = async (admin: string, id: string, aksi: string) =>
  (await as<{ s: string }>("service_role", "select layar_atur_hp($1, $2, $3) as s", [admin, id, aksi]))[0].s
const info = async (key: string) =>
  (await as<{ peran: string; isi: unknown; versi: number | null; ada_pin: boolean | null }>("service_role", "select * from layar_info($1)", [key]))[0]
const setPin = async (admin: string, pin: string) => (await as<{ ok: boolean }>("service_role", "select layar_set_pin($1, $2) as ok", [admin, pin]))[0].ok
const reset = async (tv: string, pin: string) => (await as<{ s: string }>("service_role", "select layar_reset($1, $2) as s", [tv, pin]))[0].s
/** Scans the TV's QR code with a new phone; returns the role it gets. */
const scanTv = async (tv: string, phone: string, label = "HP baru") => {
  const pair = `qr-${++seq}`
  await as("service_role", `select layar_buat_qr($1, $2, null, ${FUTURE})`, [pair, tv])
  const [row] = await as<{ peran: string }>("service_role", "select * from layar_klaim($1, $2, null, $3)", [pair, phone, label])
  return row?.peran
}

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
    ["layar_daftar_hp", "'a'"],
    ["layar_undang", "'a', 'b', 'c'"],
    ["layar_atur_hp", "'a', 'b', 'cabut'"],
    ["layar_set_pin", "'a', '123456'"],
    ["layar_reset", "'a', '123456'"],
    ["layar_riwayat", "'a'"],
    ["layar_pulihkan", "'a', 1"],
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

  it("manages only its own phones", async () => {
    const a = await newMosque()
    const b = await newMosque()
    const bPhones = await daftar(b.phone)
    expect(await aturHp(a.phone, bPhones[0].id, "cabut")).toBe("ditolak")
    expect(await cek(b.phone)).toHaveLength(1)
    expect(await daftar(a.phone)).toHaveLength(1)
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
  it("make the phone wait for the main manager, ignoring any data sent", async () => {
    const a = await newMosque()
    await as("service_role", `select layar_buat_qr('tambah-hp', $1, null, ${FUTURE})`, [a.tv])
    const [view] = await as<{ terhubung: boolean; nama: string; punya_pengelola: boolean }>("service_role", "select * from layar_lihat_qr('tambah-hp')")
    expect(view).toMatchObject({ terhubung: true, nama: "Masjid A", punya_pengelola: true, penuh: false })
    const [row] = await as<{ display: string; peran: string }>("service_role", "select * from layar_klaim('tambah-hp', 'hp-baru', $1)", [
      JSON.stringify({ ...DATA, settings: { mosqueName: "Palsu" } }),
    ])
    expect(row).toMatchObject({ display: a.id, peran: "pending" })
    expect(await ambil("hp-baru")).toEqual([])
    expect((await ambil(a.phone))[0].isi.settings.mosqueName).toBe("Masjid A")
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
    expect(view).toEqual({ isi: DATA, terhubung: false, nama: null, punya_pengelola: false, penuh: false })
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

describe("main manager", () => {
  it("is the phone that set up the mosque", async () => {
    const a = await newMosque()
    expect((await info(a.phone)).peran).toBe("admin")
    expect(await daftar(a.phone)).toMatchObject([{ peran: "admin", saya: true }])
  })

  it("invites up to two more phones: three in all", async () => {
    const a = await newMosque()
    expect(await undang(a.phone, "undang-1")).toBe("ok")
    expect(await undang(a.phone, "undang-2")).toBe("ok")
    expect(await undang(a.phone, "undang-3")).toBe("penuh")
    expect((await info("undang-1")).peran).toBe("editor")
    expect(await info("undang-3")).toBeUndefined()
  })

  it("is the only one who can invite, list or remove phones", async () => {
    const a = await newMosque()
    await undang(a.phone, "biasa")
    expect(await undang("biasa", "teman")).toBe("ditolak")
    expect(await daftar("biasa")).toEqual([])
    const adminId = (await daftar(a.phone)).find((p) => p.saya)!.id
    expect(await aturHp("biasa", adminId, "cabut")).toBe("ditolak")
    expect(await aturHp(a.tv, adminId, "cabut")).toBe("ditolak")
  })

  it("removes a phone, which then can do nothing", async () => {
    const a = await newMosque()
    await undang(a.phone, "dicabut")
    const id = (await daftar(a.phone)).find((p) => !p.saya)!.id
    expect(await aturHp(a.phone, id, "cabut")).toBe("ok")
    expect(await info("dicabut")).toBeUndefined()
    expect((await simpan("dicabut", "x", 1)).status).toBe("invalid")
    expect(await cek(a.tv)).toHaveLength(1)
  })

  it("cannot remove or demote itself, so a mosque always keeps one", async () => {
    const a = await newMosque()
    const self = (await daftar(a.phone))[0].id
    expect(await aturHp(a.phone, self, "cabut")).toBe("ditolak")
    expect(await aturHp(a.phone, self, "jadikan_pengurus")).toBe("ditolak")
  })

  it("can make a backup main manager", async () => {
    const a = await newMosque()
    await undang(a.phone, "cadangan")
    const id = (await daftar(a.phone)).find((p) => !p.saya)!.id
    expect(await aturHp(a.phone, id, "jadikan_admin")).toBe("ok")
    expect((await info("cadangan")).peran).toBe("admin")
    expect(await undang("cadangan", "lagi")).toBe("ok")
  })

  it("is not a role a TV or an unknown key can get", async () => {
    expect(await daftar("salah")).toEqual([])
    expect(await undang("salah", "x")).toBe("ditolak")
  })

  it("alone can delete the mosque", async () => {
    const a = await newMosque()
    await undang(a.phone, "bukan-admin")
    expect(await as("service_role", "select * from layar_hapus('bukan-admin')")).toEqual([])
    expect(await as("service_role", "select * from layar_hapus($1)", [a.tv])).toEqual([])
    expect(await cek(a.tv)).toHaveLength(1)
  })
})

describe("phones that scanned the TV", () => {
  it("wait for approval and see nothing meanwhile", async () => {
    const a = await newMosque()
    expect(await scanTv(a.tv, "menunggu")).toBe("pending")
    expect(await info("menunggu")).toMatchObject({ peran: "pending", isi: null, versi: null })
    expect((await simpan("menunggu", "x", 1)).status).toBe("invalid")
    expect(await cek("menunggu")).toEqual([])
    expect(await as("service_role", "select * from layar_set_foto('menunggu', 'x.jpg')")).toEqual([])
  })

  it("can work once approved", async () => {
    const a = await newMosque()
    await scanTv(a.tv, "disetujui")
    const pending = (await daftar(a.phone)).find((p) => p.peran === "pending")!
    expect(pending.label).toBe("HP baru")
    expect(await aturHp(a.phone, pending.id, "setujui")).toBe("ok")
    expect((await info("disetujui")).peran).toBe("editor")
    expect((await simpan("disetujui", "Oleh pengurus", 1)).status).toBe("ok")
  })

  it("are not approved past three phones", async () => {
    const a = await newMosque()
    await undang(a.phone, "isi-1")
    await undang(a.phone, "isi-2")
    await scanTv(a.tv, "kelebihan")
    const pending = (await daftar(a.phone)).find((p) => p.peran === "pending")!
    expect(await aturHp(a.phone, pending.id, "setujui")).toBe("penuh")
  })

  it("wait one at a time: a newer scan replaces the older request", async () => {
    const a = await newMosque()
    await scanTv(a.tv, "iseng-1")
    await scanTv(a.tv, "iseng-2")
    const pending = (await daftar(a.phone)).filter((p) => p.peran === "pending")
    expect(pending).toHaveLength(1)
    expect(await info("iseng-1")).toBeUndefined()
  })

  it("can be turned away", async () => {
    const a = await newMosque()
    await scanTv(a.tv, "ditolak")
    const pending = (await daftar(a.phone)).find((p) => p.peran === "pending")!
    expect(await aturHp(a.phone, pending.id, "cabut")).toBe("ok")
    expect(await info("ditolak")).toBeUndefined()
  })
})

describe("emergency reset from the TV", () => {
  it("needs a PIN of six digits", async () => {
    const a = await newMosque()
    expect((await info(a.phone)).ada_pin).toBe(false)
    expect(await setPin(a.phone, "12345")).toBe(false)
    expect(await setPin(a.phone, "abcdef")).toBe(false)
    expect(await setPin(a.phone, "123456")).toBe(true)
    expect((await info(a.phone)).ada_pin).toBe(true)
  })

  it("can only be set by a main manager", async () => {
    const a = await newMosque()
    await undang(a.phone, "pengurus-pin")
    expect(await setPin("pengurus-pin", "123456")).toBe(false)
    expect((await info("pengurus-pin")).ada_pin).toBeNull()
  })

  it("is impossible without a PIN", async () => {
    const a = await newMosque()
    expect(await reset(a.tv, "000000")).toBe("tanpa_pin")
  })

  it("only works from the TV", async () => {
    const a = await newMosque()
    await setPin(a.phone, "123456")
    expect(await reset(a.phone, "123456")).toBe("ditolak")
  })

  it("removes every phone, keeps the data, and lets the next scan become main manager", async () => {
    const a = await newMosque()
    await simpan(a.phone, "Data tetap", 1)
    await undang(a.phone, "ikut-hilang")
    await setPin(a.phone, "246810")
    expect(await reset(a.tv, "246810")).toBe("ok")
    expect(await info(a.phone)).toBeUndefined()
    expect(await info("ikut-hilang")).toBeUndefined()
    expect((await ambil(a.tv))[0].isi.settings.mosqueName).toBe("Data tetap")
    expect(await scanTv(a.tv, "pengelola-baru")).toBe("admin")
    expect(await scanTv(a.tv, "berikutnya")).toBe("pending")
  })

  it("uses the PIN up, so the new main manager chooses another", async () => {
    const a = await newMosque()
    await setPin(a.phone, "135790")
    await reset(a.tv, "135790")
    expect(await reset(a.tv, "135790")).toBe("tanpa_pin")
  })

  it("locks for an hour after five wrong tries", async () => {
    const a = await newMosque()
    await setPin(a.phone, "112233")
    for (let i = 0; i < 4; i++) expect(await reset(a.tv, "000000")).toBe("salah")
    expect(await reset(a.tv, "000000")).toBe("terkunci")
    expect(await reset(a.tv, "112233")).toBe("terkunci")
    expect((await info(a.phone)).peran).toBe("admin")
  })

  it("keeps the PIN itself secret", async () => {
    const a = await newMosque()
    await setPin(a.phone, "987654")
    const { rows } = await db.query("select * from layar.displays where id = $1", [a.id])
    expect(JSON.stringify(rows)).not.toContain("987654")
  })
})

describe("phones connected before managers existed", () => {
  it("become main manager (first) and managers (the others)", async () => {
    const local = new PGlite()
    await local.exec(SUPABASE_STANDIN)
    const files = readdirSync(MIGRATIONS).sort()
    const later = files.findIndex((f) => f.includes("pengelola"))
    for (const f of files.slice(0, later)) await local.exec(readFileSync(resolve(MIGRATIONS, f), "utf8"))
    // Separate statements, so the two phones get different times, as they would in real life.
    await local.exec("select layar_buat_qr('m1', 'tv-m', null, now() + interval '5 minutes')")
    await local.exec(`select layar_klaim('m1', 'hp-pertama', '{"settings":{},"city":{"id":"1301","lokasi":"KOTA JAKARTA"}}')`)
    await local.exec("select layar_buat_qr('m2', 'tv-m', null, now() + interval '5 minutes')")
    await local.exec("select layar_klaim('m2', 'hp-kedua', null)")
    for (const f of files.slice(later)) await local.exec(readFileSync(resolve(MIGRATIONS, f), "utf8"))
    const roles = await local.query<{ role: string }>(
      "select role from layar.keys where role <> 'tv' order by created_at"
    )
    expect(roles.rows.map((r) => r.role)).toEqual(["admin", "editor"])
    await local.close()
  })
})

describe("keys of TVs that are gone", () => {
  const lastSeen = async (tv: string) =>
    (await db.query<{ last_seen_at: Date }>("select last_seen_at from layar.keys where key_hash = sha256(convert_to($1, 'UTF8'))", [tv])).rows[0]
      ?.last_seen_at

  it("note when the TV last checked in, at most once an hour", async () => {
    const a = await newMosque()
    await db.query("update layar.keys set last_seen_at = now() - interval '2 hours' where key_hash = sha256(convert_to($1, 'UTF8'))", [a.tv])
    await cek(a.tv)
    expect(Date.now() - (await lastSeen(a.tv))!.getTime()).toBeLessThan(60_000)
  })

  it("are removed after 60 days without checking in, when a QR code is made", async () => {
    const a = await newMosque()
    const b = await newMosque()
    await db.query("update layar.keys set last_seen_at = now() - interval '61 days' where key_hash = sha256(convert_to($1, 'UTF8'))", [a.tv])
    await db.query("update layar.keys set last_seen_at = now() - interval '59 days' where key_hash = sha256(convert_to($1, 'UTF8'))", [b.tv])
    await as("service_role", `select layar_buat_qr('bersih', 'tv-bersih', null, ${FUTURE})`)
    expect(await cek(a.tv)).toEqual([])
    expect(await cek(b.tv)).toHaveLength(1)
    // The mosque and its phones stay; the TV is just scanned again.
    expect((await info(a.phone)).peran).toBe("admin")
  })

  it("leave phones alone, however long they were away", async () => {
    const a = await newMosque()
    await db.query("update layar.keys set last_seen_at = now() - interval '400 days' where role = 'admin'")
    await as("service_role", `select layar_buat_qr('bersih-2', 'tv-bersih-2', null, ${FUTURE})`)
    expect((await info(a.phone)).peran).toBe("admin")
  })
})

describe("history", () => {
  type Revision = { versi: number; isi: { settings: { mosqueName: string } }; terkini: boolean }
  const riwayat = (key: string) => as<Revision>("service_role", "select * from layar_riwayat($1)", [key])
  const pulihkan = async (key: string, version: number) =>
    (await as<{ v: number | null }>("service_role", "select layar_pulihkan($1, $2) as v", [key, version]))[0].v

  it("lists the last five versions, newest first, marking the current one", async () => {
    const a = await newMosque()
    for (let v = 1; v <= 6; v++) await simpan(a.phone, `Versi ${v + 1}`, v)
    const list = await riwayat(a.phone)
    expect(list.map((r) => r.versi)).toEqual([7, 6, 5, 4, 3])
    expect(list[0]).toMatchObject({ terkini: true, isi: { settings: { mosqueName: "Versi 7" } } })
    expect(list.slice(1).every((r) => !r.terkini)).toBe(true)
  })

  it("brings an old version back as a new one, which the TV sees", async () => {
    const a = await newMosque()
    await simpan(a.phone, "Dirusak", 1)
    expect(await pulihkan(a.phone, 1)).toBe(3)
    expect((await ambil(a.tv))[0]).toMatchObject({ versi: 3, isi: { settings: { mosqueName: "Masjid A" } } })
    expect((await riwayat(a.phone)).map((r) => r.versi)).toEqual([3, 2, 1])
  })

  it("is for main managers only", async () => {
    const a = await newMosque()
    await undang(a.phone, "pengurus-riwayat")
    expect(await riwayat("pengurus-riwayat")).toEqual([])
    expect(await pulihkan("pengurus-riwayat", 1)).toBeNull()
    expect(await riwayat(a.tv)).toEqual([])
    expect(await pulihkan(a.tv, 1)).toBeNull()
  })

  it("cannot reach another mosque's versions", async () => {
    const a = await newMosque()
    const b = await newMosque({ ...DATA, settings: { mosqueName: "Masjid B" } })
    await simpan(b.phone, "B diubah", 1)
    expect(await pulihkan(a.phone, 2)).toBeNull()
    expect((await ambil(b.tv))[0].isi.settings.mosqueName).toBe("B diubah")
  })

  it("refuses a version that is not kept", async () => {
    const a = await newMosque()
    expect(await pulihkan(a.phone, 99)).toBeNull()
    expect((await cek(a.tv))[0].versi).toBe(1)
  })
})
