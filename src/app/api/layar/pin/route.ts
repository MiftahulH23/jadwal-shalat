import { isKey } from "@/lib/layar-data"
import { bearer, fail, handle, readJson, rpc, withinLimit } from "@/lib/supabase-server"

/** Main manager: sets the emergency PIN used to reset the TV. Body: { pin } (6 digits). */
export async function PUT(request: Request) {
  return handle(async () => {
    const key = bearer(request)
    const body = await readJson(request, 500)
    if (!isKey(key) || typeof body?.pin !== "string" || !/^\d{6}$/.test(body.pin)) return fail(400, "PIN harus 6 angka.")
    if (!(await withinLimit(request, "pin", 10))) return fail(429, "Terlalu sering. Coba lagi nanti.")
    const [ok] = await rpc<boolean>("layar_set_pin", { p_admin_key: key, p_pin: body.pin })
    if (!ok) return fail(403, "Hanya pengelola utama yang bisa membuat PIN.")
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } })
  })
}
