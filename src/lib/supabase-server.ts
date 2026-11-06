// Server-side calls to Supabase with the secret key. Never import this from client code.

import "server-only"

import { createHmac } from "node:crypto"

import { PHOTO_BUCKET, SUPABASE_URL } from "@/lib/layar-config"

export class LayarUnavailable extends Error {}

function secretKey() {
  const key = process.env.SUPABASE_SECRET_KEY
  if (!key) throw new LayarUnavailable("SUPABASE_SECRET_KEY is not set")
  return key
}

/** Emergency switch: LAYAR_SYNC_ENABLED=false stops new QR codes and mosques, without touching schedules. */
export const syncEnabled = () => process.env.LAYAR_SYNC_ENABLED !== "false"

/** Calls a database function. Returns its rows. */
export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T[]> {
  const key = secretKey()
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Supabase ${fn} failed: ${res.status} ${text}`)
  // Functions returning void answer with an empty body.
  if (!text) return []
  const body = JSON.parse(text)
  return Array.isArray(body) ? body : [body]
}

/** Stores a background photo in the public bucket. Kept long by browsers and the CDN: a name is never reused. */
export async function uploadPhoto(path: string, bytes: Uint8Array) {
  const key = secretKey()
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${PHOTO_BUCKET}/${path}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "image/jpeg", "cache-control": "max-age=31536000" },
    body: bytes as BodyInit,
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Photo upload failed: ${res.status} ${await res.text()}`)
}

/** Deletes a photo. Failing to is not worth failing the request for: an orphan file costs little. */
export async function deletePhoto(path: string) {
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${PHOTO_BUCKET}/${path}`, {
      method: "DELETE",
      headers: { apikey: secretKey() },
      cache: "no-store",
    })
    if (!res.ok) console.error(`Photo delete failed: ${res.status} ${await res.text()}`)
  } catch (error) {
    console.error(error)
  }
}

/**
 * Counts one use of an action for the caller's IP address in this hour; false once max is passed.
 * The address is hashed with the secret key, so the database never holds the address itself.
 */
export async function withinLimit(request: Request, action: string, max: number) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "local"
  const hash = createHmac("sha256", secretKey()).update(ip).digest("hex")
  const [allowed] = await rpc<boolean>("layar_batas", { p_ip_hash: `\\x${hash}`, p_action: action, p_max: max })
  return allowed === true
}

/** The usual JSON error responses of the /api/layar routes. */
export const fail = (status: number, message: string) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } })

/** Turns unexpected errors into a 503 the pages can explain, and logs them. */
export async function handle(run: () => Promise<Response>) {
  try {
    return await run()
  } catch (error) {
    if (error instanceof LayarUnavailable) return fail(503, "Fitur atur dari HP belum aktif di server ini.")
    console.error(error)
    return fail(503, "Server sedang bermasalah. Coba lagi sebentar lagi.")
  }
}

/** Reads a JSON body, or null when it is not JSON (or too big). */
export async function readJson(request: Request, maxBytes = 70_000): Promise<Record<string, unknown> | null> {
  const text = await request.text()
  if (text.length > maxBytes) return null
  try {
    const body = JSON.parse(text)
    return body && typeof body === "object" && !Array.isArray(body) ? body : null
  } catch {
    return null
  }
}

/** The key in "Authorization: Bearer …". */
export const bearer = (request: Request) => request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? ""
