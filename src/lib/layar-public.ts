// The TV's direct calls to Supabase with the publishable key: no Vercel function is used.

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/layar-config"

async function call<T>(fn: "layar_cek" | "layar_ambil", key: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_key: key }),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`${fn} failed: ${res.status}`)
  return res.json()
}

/** Null when the key is not (or no longer) connected to a mosque. Throws on network errors. */
export async function checkLayar(key: string) {
  const [row] = await call<{ versi: number; foto: string | null; menunggu_qr: boolean }>("layar_cek", key)
  return row ? { version: row.versi, photo: row.foto, qrWaiting: row.menunggu_qr } : null
}

export async function fetchLayar(key: string) {
  const [row] = await call<{ versi: number; foto: string | null; isi: unknown }>("layar_ambil", key)
  return row ? { version: row.versi, photo: row.foto, data: row.isi } : null
}
