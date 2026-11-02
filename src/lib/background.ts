// Background photo of the mosque display. Too big for localStorage, so it lives in
// IndexedDB, in this browser only; it is never uploaded.

const DB_NAME = "jadwal-shalat"
const STORE = "images"
const KEY = "background"
const CHANNEL = "jadwal-shalat:background"

/** Smallest size that still covers a Full HD screen. */
const COVER_WIDTH = 1920
const COVER_HEIGHT = 1080
/** Longest side kept, so panoramas stay small enough to store and draw. */
const MAX_SIDE = 3840
const JPEG_QUALITY = 0.8
const MAX_INPUT_BYTES = 40_000_000
/** Limit for a photo inside a backup file, as base64 text. */
export const MAX_PHOTO_DATA_URL = 20_000_000

function run(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest) {
  return new Promise<unknown>((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1)
    open.onupgradeneeded = () => open.result.createObjectStore(STORE)
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      const tx = db.transaction(STORE, mode)
      const request = action(tx.objectStore(STORE))
      tx.oncomplete = () => {
        db.close()
        resolve(request.result)
      }
      tx.onerror = tx.onabort = () => {
        db.close()
        reject(tx.error)
      }
    }
  })
}

export async function loadBackground() {
  return ((await run("readonly", (store) => store.get(KEY))) as Blob | undefined) ?? null
}

/** Stores the photo, or removes it when given null, and updates every open display. */
export async function saveBackground(photo: Blob | null) {
  await run("readwrite", (store) => (photo ? store.put(photo, KEY) : store.delete(KEY)))
  // Asks the browser not to clear the photo when storage runs low; it may refuse.
  if (photo) void navigator.storage?.persist?.().catch(() => {})
  const channel = new BroadcastChannel(CHANNEL)
  channel.postMessage("changed")
  channel.close()
}

/** Calls back whenever the stored photo changes, in this tab or another one. */
export function subscribeBackground(onChange: () => void) {
  const channel = new BroadcastChannel(CHANNEL)
  channel.onmessage = onChange
  return () => channel.close()
}

/** Shrinks a chosen photo to JPEG. An <img> applies the rotation stored by phone cameras. */
export async function compressPhoto(file: File) {
  if (file.size > MAX_INPUT_BYTES) throw new Error("Ukuran foto terlalu besar (maksimal 40 MB).")

  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode().catch(() => {
      throw new Error("Foto tidak bisa dibaca. Gunakan file JPG atau PNG.")
    })

    const { naturalWidth: w, naturalHeight: h } = image
    const scale = Math.min(1, Math.max(COVER_WIDTH / w, COVER_HEIGHT / h), MAX_SIDE / Math.max(w, h))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(w * scale)
    canvas.height = Math.round(h * scale)
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Foto gagal diproses di browser ini.")
    // JPEG has no transparency; see-through parts of a PNG become black, like the overlay.
    context.fillStyle = "#000"
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY))
    if (!blob) throw new Error("Foto gagal diproses di browser ini.")
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** Only raster images, so a backup file can't bring in an SVG or other active content. */
export function isPhotoDataUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= MAX_PHOTO_DATA_URL &&
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
  )
}

export function dataUrlToBlob(dataUrl: string) {
  const [header, base64] = dataUrl.split(",")
  const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0))
  return new Blob([bytes], { type: header.slice(5, header.indexOf(";")) })
}
