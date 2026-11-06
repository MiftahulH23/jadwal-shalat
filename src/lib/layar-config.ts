// Managing the mosque display from a phone (docs/RANCANGAN-ATUR-DARI-HP.md): shared settings.

/** The Supabase project. The publishable key is meant to be public: it can only call layar_cek and layar_ambil. */
export const SUPABASE_URL = "https://gmyosnvjqinmlupbzydi.supabase.co"
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ybg_oIIlw21D0NvuAcNOWA_Jp8GpoJ3"

/** How long a QR code on the TV stays valid. */
export const QR_MINUTES = 15
/** On the first-run screen, QR codes are renewed for this long, then the TV stops calling the server. */
export const QR_RENEW_FOR_MS = 60 * 60_000
/** How often the TV checks whether its QR code was scanned, while it is shown. */
export const QR_POLL_MS = 5_000

/** localStorage keys. */
export const TV_LINK_KEY = "jadwal-shalat:layar"
export const TV_QR_KEY = "jadwal-shalat:layar-qr"
export const PHONE_LINKS_KEY = "jadwal-shalat:atur"
