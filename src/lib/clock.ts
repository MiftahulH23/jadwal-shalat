// Device clocks drift (a laptop can easily be many seconds off), which would make adzan
// and iqamah countdowns late. All client time goes through correctedNow(), which applies
// the difference to the server clock. The difference is stored, so it also works offline.

const STORAGE_KEY = "jadwal-shalat:clock-offset"
const RESYNC_MS = 30 * 60_000
const SAMPLES = 3
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

async function sample() {
  const startedAt = performance.now()
  const deviceTime = Date.now()
  const res = await fetch("/api/waktu", { cache: "no-store" })
  if (!res.ok) throw new Error(`Clock sync failed: ${res.status}`)
  const { now } = (await res.json()) as { now: number }
  const roundTrip = performance.now() - startedAt
  // Assume the server read its clock halfway through the round trip.
  return { roundTrip, offset: now - (deviceTime + roundTrip / 2) }
}

async function syncClock() {
  try {
    const samples = []
    for (let i = 0; i < SAMPLES; i++) samples.push(await sample())
    // The fastest round trip is the least skewed by network delays and cold starts.
    const best = samples.reduce((a, b) => (b.roundTrip < a.roundTrip ? b : a))
    if (best.roundTrip > MAX_ROUND_TRIP_MS) return
    offset = Math.round(best.offset)
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
