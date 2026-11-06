import { randomUUID } from "node:crypto"

import { MAX_PHOTO_UPLOAD } from "@/lib/layar-config"
import { isKey } from "@/lib/layar-data"
import { bearer, deletePhoto, fail, handle, rpc, uploadPhoto, withinLimit } from "@/lib/supabase-server"

type Info = { peran: string }

/** JPEG files start with FF D8 FF. Checked on the bytes themselves, not on what the sender claims. */
const isJpeg = (bytes: Uint8Array) => bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff

async function allowed(key: string) {
  const [row] = await rpc<Info>("layar_info", { p_key: key })
  return Boolean(row && row.peran !== "pending")
}

/**
 * Phone or TV: replaces the mosque's background photo. Key in "Authorization: Bearer …", body the JPEG
 * itself. Answers { photo } (its path). The old file is deleted.
 */
export async function PUT(request: Request) {
  return handle(async () => {
    const key = bearer(request)
    if (!isKey(key)) return fail(401, "Link ini tidak valid.")
    const size = Number(request.headers.get("content-length") ?? 0)
    if (size > MAX_PHOTO_UPLOAD) return fail(413, "Foto terlalu besar.")
    if (!(await withinLimit(request, "foto", 20))) return fail(429, "Terlalu sering mengganti foto. Coba lagi nanti.")
    if (!(await allowed(key))) return fail(401, "Akses link ini sudah dicabut.")

    const bytes = new Uint8Array(await request.arrayBuffer())
    if (bytes.length > MAX_PHOTO_UPLOAD) return fail(413, "Foto terlalu besar.")
    if (!isJpeg(bytes)) return fail(415, "Foto harus berformat JPEG.")

    // A random name: the photo can be read by anyone who has its address, so it must not be guessable.
    const path = `${randomUUID()}.jpg`
    await uploadPhoto(path, bytes)
    const [row] = await rpc<{ foto_lama: string | null }>("layar_set_foto", { p_key: key, p_path: path })
    if (!row) {
      await deletePhoto(path)
      return fail(401, "Akses link ini sudah dicabut.")
    }
    if (row.foto_lama) await deletePhoto(row.foto_lama)
    return Response.json({ photo: path }, { headers: { "Cache-Control": "no-store" } })
  })
}

/** Phone or TV: removes the background photo. */
export async function DELETE(request: Request) {
  return handle(async () => {
    const key = bearer(request)
    if (!isKey(key)) return fail(401, "Link ini tidak valid.")
    if (!(await withinLimit(request, "foto", 20))) return fail(429, "Terlalu sering mengganti foto. Coba lagi nanti.")
    const [row] = await rpc<{ foto_lama: string | null }>("layar_set_foto", { p_key: key, p_path: null })
    if (!row) return fail(401, "Akses link ini sudah dicabut.")
    if (row.foto_lama) await deletePhoto(row.foto_lama)
    return Response.json({ photo: null }, { headers: { "Cache-Control": "no-store" } })
  })
}
