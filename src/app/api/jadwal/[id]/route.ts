import { connection, type NextRequest } from "next/server"

import { getWeekSchedule, getWeekScheduleAt, MAX_DAYS } from "@/lib/myquran"
import { isInIndonesia } from "@/lib/prayer"

/** GET /api/jadwal/:id[?hari=7][&lat=&lng=] */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/jadwal/[id]">) {
  await connection()
  const { id } = await ctx.params
  if (!/^\d{4}$/.test(id)) {
    return Response.json({ error: "ID kota tidak valid" }, { status: 400 })
  }

  const params = req.nextUrl.searchParams
  const days = params.has("hari") ? Number(params.get("hari")) : 7
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
    return Response.json({ error: `Jumlah hari harus 1–${MAX_DAYS}` }, { status: 400 })
  }

  // Optional ?lat=&lng= switches to a schedule calculated for that exact point.
  const hasCoords = params.has("lat") || params.has("lng")
  const lat = Number(params.get("lat"))
  const lng = Number(params.get("lng"))
  if (hasCoords && !(Number.isFinite(lat) && Number.isFinite(lng) && isInIndonesia(lat, lng))) {
    return Response.json({ error: "Koordinat tidak valid atau di luar Indonesia" }, { status: 400 })
  }

  try {
    return Response.json(hasCoords ? await getWeekScheduleAt(id, lat, lng, days) : await getWeekSchedule(id, days))
  } catch (error) {
    console.error(error)
    return Response.json({ error: "Gagal memuat jadwal shalat" }, { status: 502 })
  }
}
