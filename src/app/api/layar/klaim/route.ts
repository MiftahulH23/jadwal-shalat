import { isKey, parseLayarData } from "@/lib/layar-data"
import { fail, handle, readJson, rpc, syncEnabled, withinLimit } from "@/lib/supabase-server"

/**
 * Phone: uses a QR code. Body: { pair, phoneKey, data?, label? }.
 * - data given: a new mosque, with this phone as its main manager;
 * - the TV already belongs to a mosque: the phone asks to join and waits for the main manager;
 * - no data: the TV joins the mosque this phone's key belongs to.
 * Answers { role }, or 410 when the QR code (or the phone's key) is not valid.
 */
export async function POST(request: Request) {
  return handle(async () => {
    if (!syncEnabled()) return fail(503, "Atur dari HP sedang ditutup sementara.")
    const body = await readJson(request)
    if (!body || !isKey(body.pair) || !isKey(body.phoneKey)) return fail(400, "Permintaan tidak valid.")
    const data = body.data == null ? null : parseLayarData(body.data)
    if (body.data != null && !data) return fail(400, "Data tidak lengkap: pilih kota atau kabupaten dulu.")
    if (!(await withinLimit(request, "klaim", 20))) return fail(429, "Terlalu banyak percobaan. Coba lagi nanti.")
    if (data && !(await withinLimit(request, "masjid-baru", 5))) return fail(429, "Terlalu banyak masjid baru. Coba lagi nanti.")

    const label = typeof body.label === "string" ? body.label : null
    const [row] = await rpc<{ display: string; peran: string }>("layar_klaim", {
      p_pair: body.pair,
      p_phone_key: body.phoneKey,
      p_data: data,
      p_label: label,
    })
    if (!row) return fail(410, "QR ini sudah tidak berlaku. Pindai QR yang sedang tampil di TV.")
    return Response.json({ role: row.peran }, { headers: { "Cache-Control": "no-store" } })
  })
}
