import { isKey } from "@/lib/layar-data"
import { bearer, fail, handle, readJson, rpc, withinLimit } from "@/lib/supabase-server"

const MESSAGES: Record<string, [number, string]> = {
  salah: [403, "PIN salah."],
  terkunci: [423, "Terlalu banyak percobaan. Coba lagi 1 jam lagi."],
  tanpa_pin: [409, "Masjid ini belum punya PIN darurat. PIN dibuat oleh pengelola utama di HP."],
  ditolak: [401, "Layar ini tidak terhubung ke HP."],
}

/**
 * TV, when every main manager's phone is lost: removes all phones with the emergency PIN, so the next
 * phone to scan the TV becomes the main manager. TV key in "Authorization: Bearer …"; body: { pin }.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const key = bearer(request)
    const body = await readJson(request, 500)
    if (!isKey(key) || typeof body?.pin !== "string" || !/^\d{6}$/.test(body.pin)) return fail(400, "PIN harus 6 angka.")
    if (!(await withinLimit(request, "reset", 10))) return fail(429, "Terlalu banyak percobaan. Coba lagi nanti.")
    const [status] = await rpc<string>("layar_reset", { p_tv_key: key, p_pin: body.pin })
    if (status === "ok") return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } })
    const [code, message] = MESSAGES[status] ?? [503, "Server sedang bermasalah."]
    return fail(code, message)
  })
}
