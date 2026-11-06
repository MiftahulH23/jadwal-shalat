// Moving the background photo between a device and the server. Client only.

import { fitForUpload } from "@/lib/background"
import { MAX_PHOTO_UPLOAD, photoUrl } from "@/lib/layar-config"

/** Sends a new photo (or removes it, for null). Returns the photo's path on the server, or null. */
export async function sendPhoto(key: string, photo: Blob | null): Promise<string | null> {
  const body = photo && (await fitForUpload(photo, MAX_PHOTO_UPLOAD))
  const res = await fetch("/api/layar/foto", {
    method: body ? "PUT" : "DELETE",
    headers: { Authorization: `Bearer ${key}`, ...(body && { "Content-Type": "image/jpeg" }) },
    body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? "Foto gagal dikirim.")
  return data.photo ?? null
}

/** Downloads a photo from the server, refusing anything that is not a JPEG of a sensible size. */
export async function downloadPhoto(path: string) {
  const res = await fetch(photoUrl(path))
  if (!res.ok) throw new Error(`Photo download failed: ${res.status}`)
  const blob = await res.blob()
  if (blob.size > MAX_PHOTO_UPLOAD || !blob.type.startsWith("image/jpeg")) throw new Error("Not a photo")
  return blob
}
