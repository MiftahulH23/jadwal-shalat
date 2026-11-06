import { connection } from "next/server"

import { isKey, parseLayarData } from "@/lib/layar-data"
import { bearer, fail, handle, readJson, rpc, withinLimit } from "@/lib/supabase-server"

type Row = { versi: number; disimpan: string; isi: unknown; terkini: boolean }

/** Main manager: the last five versions of the settings, newest first. */
export async function GET(request: Request) {
  await connection()
  return handle(async () => {
    const key = bearer(request)
    if (!isKey(key)) return fail(401, "Link ini tidak valid.")
    if (!(await withinLimit(request, "riwayat", 100))) return fail(429, "Terlalu banyak permintaan. Coba lagi nanti.")
    const rows = await rpc<Row>("layar_riwayat", { p_admin_key: key })
    return Response.json(
      rows.map((r) => ({ version: r.versi, savedAt: r.disimpan, current: r.terkini, data: parseLayarData(r.isi) })),
      { headers: { "Cache-Control": "no-store" } }
    )
  })
}

/** Main manager: brings back a kept version as the newest one. Body: { version }. Answers { version }. */
export async function POST(request: Request) {
  return handle(async () => {
    const key = bearer(request)
    const body = await readJson(request, 500)
    if (!isKey(key) || !Number.isInteger(body?.version)) return fail(400, "Permintaan tidak valid.")
    if (!(await withinLimit(request, "pulihkan", 20))) return fail(429, "Terlalu sering. Coba lagi nanti.")
    const [version] = await rpc<number | null>("layar_pulihkan", { p_admin_key: key, p_version: body!.version })
    if (version == null) return fail(403, "Versi ini tidak bisa dikembalikan.")
    return Response.json({ version }, { headers: { "Cache-Control": "no-store" } })
  })
}
