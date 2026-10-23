import { getCities } from "@/lib/myquran"

export async function GET() {
  try {
    return Response.json(await getCities())
  } catch (error) {
    console.error(error)
    return Response.json({ error: "Gagal memuat daftar kota" }, { status: 502 })
  }
}
