import { connection, type NextRequest } from "next/server"

import { getMonthSchedule } from "@/lib/myquran"
import { isInIndonesia } from "@/lib/prayer"

/** GET /api/jadwal/:id/bulan?tahun=2026&bulan=10[&lat=&lng=] */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/jadwal/[id]/bulan">) {
  await connection()
  const { id } = await ctx.params
  const params = req.nextUrl.searchParams
  const year = Number(params.get("tahun"))
  const month = Number(params.get("bulan"))

  if (!/^\d{4}$/.test(id)) {
    return Response.json({ error: "ID kota tidak valid" }, { status: 400 })
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
    return Response.json({ error: "Tahun atau bulan tidak valid" }, { status: 400 })
  }

  const hasCoords = params.has("lat") || params.has("lng")
  const lat = Number(params.get("lat"))
  const lng = Number(params.get("lng"))
  if (hasCoords && !(Number.isFinite(lat) && Number.isFinite(lng) && isInIndonesia(lat, lng))) {
    return Response.json({ error: "Koordinat tidak valid atau di luar Indonesia" }, { status: 400 })
  }

  try {
    return Response.json(await getMonthSchedule(id, year, month, hasCoords ? { lat, lng } : undefined))
  } catch (error) {
    console.error(error)
    return Response.json({ error: "Gagal memuat jadwal bulanan" }, { status: 502 })
  }
}
