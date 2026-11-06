import { isKey, parseLayarSnapshot } from "@/lib/layar-data"
import { fail, handle, readJson, rpc, withinLimit } from "@/lib/supabase-server"

type Row = { isi: unknown; terhubung: boolean; nama: string | null; punya_pengelola: boolean; penuh: boolean }

/**
 * Phone, after scanning: what the QR code is for, without using it up. Body: { pair }.
 * Answers { connected, name, snapshot }, or 410 when the QR code is no longer valid.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson(request, 2_000)
    if (!body || !isKey(body.pair)) return fail(400, "Permintaan tidak valid.")
    if (!(await withinLimit(request, "lihat", 60))) return fail(429, "Terlalu banyak percobaan. Coba lagi nanti.")

    const [row] = await rpc<Row>("layar_lihat_qr", { p_pair: body.pair })
    if (!row) return fail(410, "QR ini sudah tidak berlaku.")
    return Response.json(
      {
        connected: row.terhubung,
        name: row.nama,
        hasManager: row.punya_pengelola,
        full: row.penuh,
        snapshot: parseLayarSnapshot(row.isi),
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  })
}
