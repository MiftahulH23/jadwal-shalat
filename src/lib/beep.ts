// Digital-clock style beeps ("tit tit tit") synthesised with the Web Audio API.

let ctx: AudioContext | null = null

function getContext() {
  if (typeof window === "undefined") return null
  try {
    ctx ??= new AudioContext()
    if (ctx.state === "suspended") void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/**
 * Browsers only allow audio after a user gesture. Call once on mount: the first
 * click / key / touch anywhere unlocks audio for later automatic beeps.
 */
export function unlockAudioOnGesture() {
  if (typeof window === "undefined") return () => {}
  const unlock = () => {
    getContext()
    cleanup()
  }
  const events = ["pointerdown", "keydown", "touchstart"] as const
  const cleanup = () => events.forEach((e) => window.removeEventListener(e, unlock))
  events.forEach((e) => window.addEventListener(e, unlock, { once: true, passive: true }))
  return cleanup
}

type Beep = [duration: number, gap: number]

const repeat = (group: Beep[], times: number) => Array.from({ length: times }, () => group).flat()

/** [duration, gap] pairs in seconds. Adzan and iqamah last ~5 s, as long as the pop-up. */
const PATTERNS = {
  // tit-tit-tit … ×5 (1.1 s per group)
  adzan: repeat(
    [
      [0.12, 0.08],
      [0.12, 0.08],
      [0.12, 0.58],
    ],
    5
  ),
  // tit-tit-tit-tit … tiiiit ×3 (~1.7 s per group)
  iqamah: repeat(
    [
      [0.1, 0.07],
      [0.1, 0.07],
      [0.1, 0.07],
      [0.1, 0.25],
      [0.7, 0.17],
    ],
    3
  ),
  // Short confirmation when the sound is switched on.
  test: [
    [0.12, 0.08],
    [0.12, 0],
  ],
} satisfies Record<string, Beep[]>

export type BeepPattern = keyof typeof PATTERNS

/** Oscillators of the beeps still playing or scheduled, so they can be cut short. */
let playing: OscillatorNode[] = []

/** Stops any beeps in progress (e.g. when the pop-up is closed early). */
export function stopBeeps() {
  for (const osc of playing) {
    try {
      osc.stop()
    } catch {
      // Already stopped.
    }
  }
  playing = []
}

export function playBeeps(pattern: BeepPattern = "adzan") {
  const ac = getContext()
  if (!ac) return
  stopBeeps()
  let t = ac.currentTime + 0.05
  for (const [duration, gap] of PATTERNS[pattern]) {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = "square"
    osc.frequency.value = 2_200
    // Short ramps avoid clicks while keeping the beep crisp.
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.06, t + 0.005)
    gain.gain.setValueAtTime(0.06, t + duration - 0.01)
    gain.gain.linearRampToValueAtTime(0, t + duration)
    osc.connect(gain).connect(ac.destination)
    osc.start(t)
    osc.stop(t + duration + 0.01)
    osc.onended = () => {
      playing = playing.filter((o) => o !== osc)
    }
    playing.push(osc)
    t += duration + gap
  }
}
