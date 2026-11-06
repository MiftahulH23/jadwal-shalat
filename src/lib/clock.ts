// Device clocks drift (a laptop can easily be many seconds off), which would make adzan
// and iqamah countdowns late. All client time goes through correctedNow(), which applies
// the difference to the server clock. The difference is stored, so it also works offline.
//
// The server clock is read from the Date header of a small static file, served by Vercel's CDN.
// That costs no function invocation (the free plan allows a million a month, which TVs checking every
// half hour would use up), only a few hundred bytes of transfer. The header has whole seconds, so
// several requests at different moments within a second narrow the offset down (see offsetFromDates).

const STORAGE_KEY = "jadwal-shalat:clock-offset"
const RESYNC_MS = 30 * 60_000
/** A static file; the service worker leaves it alone, so an offline copy can never pass for the time. */
export const CLOCK_URL = "/waktu.txt"
const SAMPLES = 4
/** Spreads the requests over a second, so the moments the header's seconds tick over get caught. */
const SAMPLE_GAP_MS = 330
/** Slower round trips are too uncertain to correct by. */
const MAX_ROUND_TRIP_MS = 3_000

let offset: number | null = null
let started = false

function currentOffset() {
  if (offset !== null) return offset
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY))
    offset = Number.isFinite(stored) ? stored : 0
  } catch {
    offset = 0
  }
  return offset
}

/** Current time in ms, corrected to the server clock. Client only. */
export function correctedNow() {
  return Date.now() + currentOffset()
}

/** One reading: device time when the request left and the answer came, and the server's whole second. */
export type DateSample = { sentAt: number; receivedAt: number; serverSecond: number }

/**
 * The offset (server − device, in ms) the samples agree on. The server's clock read some time between
 * sending and receiving, and showed a whole second, so each sample bounds the offset to
 * [serverSecond − receivedAt, serverSecond + 1000 − sentAt]. The bounds of all samples together are
 * narrower than any one of them; the middle of what is left is the estimate. Null without usable samples.
 */
export function offsetFromDates(samples: DateSample[]): number | null {
  const usable = samples.filter((s) => s.receivedAt - s.sentAt <= MAX_ROUND_TRIP_MS)
  if (!usable.length) return null
  let low = -Infinity
  let high = Infinity
  for (const s of usable) {
    low = Math.max(low, s.serverSecond - s.receivedAt)
    high = Math.min(high, s.serverSecond + 1000 - s.sentAt)
  }
  if (low <= high) return Math.round((low + high) / 2)
  // The samples disagree (e.g. the server changed in between): trust the quickest one alone.
  const best = usable.reduce((a, b) => (b.receivedAt - b.sentAt < a.receivedAt - a.sentAt ? b : a))
  return Math.round(best.serverSecond + 500 - (best.sentAt + best.receivedAt) / 2)
}

async function sample(): Promise<DateSample> {
  // Device time is measured with performance.now(), which keeps steady even if the clock is changed meanwhile.
  const sentAt = Date.now()
  const start = performance.now()
  const res = await fetch(CLOCK_URL, { method: "HEAD", cache: "no-store" })
  const receivedAt = sentAt + (performance.now() - start)
  const serverSecond = Date.parse(res.headers.get("date") ?? "")
  if (!res.ok || !Number.isFinite(serverSecond)) throw new Error(`Clock sync failed: ${res.status}`)
  return { sentAt, receivedAt, serverSecond }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function syncClock() {
  try {
    const samples: DateSample[] = []
    for (let i = 0; i < SAMPLES; i++) {
      if (i) await wait(SAMPLE_GAP_MS)
      samples.push(await sample())
    }
    const next = offsetFromDates(samples)
    if (next === null) return
    offset = next
    localStorage.setItem(STORAGE_KEY, String(offset))
  } catch {
    // Offline or storage blocked: keep the last known offset.
  }
}

/** Starts keeping the clock in sync: now, periodically, and when coming back. Safe to call repeatedly. */
export function startClockSync() {
  if (started) return
  started = true
  void syncClock()
  setInterval(() => void syncClock(), RESYNC_MS)
  window.addEventListener("online", () => void syncClock())
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncClock()
  })
}
