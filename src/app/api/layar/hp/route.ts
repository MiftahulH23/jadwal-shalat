import { connection } from "next/server"

import { isKey } from "@/lib/layar-data"
import { bearer, fail, handle, readJson, rpc, withinLimit } from "@/lib/supabase-server"

const noStore = { "Cache-Control": "no-store" }
type Phone = { id: string; peran: "admin" | "editor" | "pending"; label: string | null; ditambahkan: string; saya: boolean }

const ACTIONS = ["setujui", "cabut", "jadikan_admin", "jadikan_pengurus"] as const

/** Main manager: the phones of the mosque. Key in "Authorization: Bearer …". */
export async function GET(request: Request) {
  await connection()
  return handle(async () => {
    const key = bearer(request)
    if (!isKey(key)) return fail(401, "Link ini tidak valid.")
    if (!(await withinLimit(request, "hp", 200))) return fail(429, "Terlalu banyak permintaan. Coba lagi nanti.")
    const phones = await rpc<Phone>("layar_daftar_hp", { p_admin_key: key })
    return Response.json(
      phones.map((p) => ({ id: p.id, role: p.peran, label: p.label, addedAt: p.ditambahkan, self: p.saya })),
      { headers: noStore }
    )
  })
}

/** Main manager: invites a manager's phone. Body: { newKey, label }. The new key was made on this phone. */
export async function POST(request: Request) {
  return handle(async () => {
    const key = bearer(request)
    const body = await readJson(request, 2_000)
    if (!isKey(key) || !body || !isKey(body.newKey)) return fail(400, "Permintaan tidak valid.")
    if (!(await withinLimit(request, "undang", 20))) return fail(429, "Terlalu sering mengundang. Coba lagi nanti.")
    const label = typeof body.label === "string" ? body.label : ""
    const [status] = await rpc<string>("layar_undang", { p_admin_key: key, p_new_key: body.newKey, p_label: label })
    if (status === "penuh") return fail(409, "Sudah 3 HP. Cabut salah satu dulu untuk mengundang yang baru.")
    if (status !== "ok") return fail(403, "Hanya pengelola utama yang bisa mengundang.")
    return Response.json({ ok: true }, { headers: noStore })
  })
}

/** Main manager: acts on another phone. Body: { id, action }. */
export async function PATCH(request: Request) {
  return handle(async () => {
    const key = bearer(request)
    const body = await readJson(request, 2_000)
    const action = body?.action as (typeof ACTIONS)[number]
    if (!isKey(key) || !body || typeof body.id !== "string" || !ACTIONS.includes(action)) return fail(400, "Permintaan tidak valid.")
    if (!(await withinLimit(request, "atur-hp", 60))) return fail(429, "Terlalu sering. Coba lagi nanti.")
    const [status] = await rpc<string>("layar_atur_hp", { p_admin_key: key, p_id: body.id, p_aksi: action })
    if (status === "penuh") return fail(409, "Sudah 3 HP. Cabut salah satu dulu.")
    if (status !== "ok") return fail(403, "Tidak bisa dilakukan.")
    return Response.json({ ok: true }, { headers: noStore })
  })
}
