import { connection } from "next/server"

import { isKey, parseLayarData } from "@/lib/layar-data"
import { bearer, deletePhoto, fail, handle, readJson, rpc, withinLimit } from "@/lib/supabase-server"

type Row = {
  peran: "tv" | "admin" | "editor" | "pending"
  versi: number | null
  foto: string | null
  isi: unknown
  diubah: string | null
  tv_terlihat: string | null
  ada_pin: boolean | null
}

const noStore = { "Cache-Control": "no-store" }

async function info(key: string) {
  const [row] = await rpc<Row>("layar_info", { p_key: key })
  return (
    row && {
      role: row.peran,
      version: row.versi,
      data: parseLayarData(row.isi),
      photo: row.foto,
      updatedAt: row.diubah,
      tvSeenAt: row.tv_terlihat,
      hasPin: row.ada_pin,
    }
  )
}

/** Phone: its mosque's current data. Key in "Authorization: Bearer …". 401 when the key is not valid (any more). */
export async function GET(request: Request) {
  await connection()
  return handle(async () => {
    const key = bearer(request)
    if (!isKey(key)) return fail(401, "Link ini tidak valid.")
    if (!(await withinLimit(request, "data", 300))) return fail(429, "Terlalu banyak permintaan. Coba lagi nanti.")
    const current = await info(key)
    if (!current) return fail(401, "Akses link ini sudah dicabut atau datanya sudah dihapus.")
    return Response.json(current, { headers: noStore })
  })
}

/**
 * Main manager: deletes the mosque from the server, photo included. TVs carry on with the settings they
 * have; every phone link stops working.
 */
export async function DELETE(request: Request) {
  return handle(async () => {
    const key = bearer(request)
    if (!isKey(key)) return fail(401, "Link ini tidak valid.")
    if (!(await withinLimit(request, "hapus", 10))) return fail(429, "Terlalu sering. Coba lagi nanti.")
    const [row] = await rpc<{ foto: string | null }>("layar_hapus", { p_key: key })
    if (!row) return fail(403, "Hanya pengelola utama yang bisa menghapus data masjid.")
    if (row.foto) await deletePhoto(row.foto)
    return Response.json({ ok: true }, { headers: noStore })
  })
}

/**
 * Phone or TV: saves new data. Body: { data, baseVersion, force? }. Answers { version }; 409 with the
 * current data when someone saved in between (send force: true to overwrite it); 401 for an unknown key.
 */
export async function PUT(request: Request) {
  return handle(async () => {
    const key = bearer(request)
    if (!isKey(key)) return fail(401, "Link ini tidak valid.")
    const body = await readJson(request)
    const data = body && parseLayarData(body.data)
    if (!body || !data || !Number.isInteger(body.baseVersion)) return fail(400, "Data tidak lengkap.")
    if (!(await withinLimit(request, "simpan", 120))) return fail(429, "Terlalu sering menyimpan. Coba lagi nanti.")

    const [row] = await rpc<{ status: "ok" | "conflict" | "invalid"; versi: number | null }>("layar_simpan", {
      p_key: key,
      p_data: data,
      p_base_version: body.baseVersion,
      p_force: body.force === true,
    })
    if (row?.status === "ok") return Response.json({ version: row.versi }, { headers: noStore })
    if (row?.status === "conflict") {
      return Response.json(
        { error: "Ada perubahan baru dari pengurus lain.", current: await info(key) },
        { status: 409, headers: noStore }
      )
    }
    return fail(401, "Akses link ini sudah dicabut atau datanya sudah dihapus.")
  })
}
