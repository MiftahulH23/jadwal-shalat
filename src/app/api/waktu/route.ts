import { connection } from "next/server"

/** The server clock, used to correct clocks of devices that drifted. See lib/clock.ts. */
export async function GET() {
  await connection()
  return Response.json({ now: Date.now() }, { headers: { "Cache-Control": "no-store" } })
}
