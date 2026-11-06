import { QR_MINUTES } from "@/lib/layar-config"
import { isKey, parseLayarSnapshot } from "@/lib/layar-data"
import { fail, handle, readJson, rpc, syncEnabled, withinLimit } from "@/lib/supabase-server"

/** TV: opens a QR code. Body: { pair, tvKey, snapshot? }. Answers { expiresAt }. */
export async function POST(request: Request) {
  return handle(async () => {
    if (!syncEnabled()) return fail(503, "Atur dari HP sedang ditutup sementara.")
    const body = await readJson(request)
    if (!body || !isKey(body.pair) || !isKey(body.tvKey)) return fail(400, "Permintaan tidak valid.")
    const snapshot = body.snapshot == null ? null : parseLayarSnapshot(body.snapshot)
    if (body.snapshot != null && !snapshot) return fail(400, "Data TV tidak valid.")
    if (!(await withinLimit(request, "qr", 10))) return fail(429, "Terlalu sering membuat QR. Coba lagi nanti.")

    const expiresAt = Date.now() + QR_MINUTES * 60_000
    await rpc("layar_buat_qr", {
      p_pair: body.pair,
      p_tv_key: body.tvKey,
      p_snapshot: snapshot,
      p_expires_at: new Date(expiresAt).toISOString(),
    })
    return Response.json({ expiresAt }, { headers: { "Cache-Control": "no-store" } })
  })
}
