// What the mosque display (/layar) should show at a given moment. No React, so it can be tested.

import { addDays, toEpoch, type City, type PrayerPhase, type WeekSchedule } from "@/lib/prayer"
import type { Settings } from "@/lib/settings"

const COUNTDOWN_MS = 30_000
const SLIDE_MS = 12_000
/** Info slides stop this long before the next adzan, so the countdown stays in view. */
const ROTATE_MIN_MS = 15 * 60_000
/** In Ramadan the screen wakes at least this long before Subuh, for sahur. */
const RAMADAN_WAKE_MIN = 150

/**
 * A new display must not silently show the default city's times. A display that already has a
 * mosque name is in use, so it keeps running: a setup screen would hide its times after a reload.
 */
export function needsLayarSetup(storedCity: City | null, settings: Pick<Settings, "mosqueName">) {
  return storedCity === null && !settings.mosqueName.trim()
}

/** The prayer in progress: after its iqamah, for `prayingMinutes`. */
export function prayingNow(phase: PrayerPhase, now: number, prayingMinutes: number) {
  return phase.kind === "waiting" && phase.prev && now - phase.start < prayingMinutes * 60_000 ? phase.prev : null
}

/**
 * The info slide to show, if any. Timed off the clock, so screens stay in sync. Slides only
 * rotate while the next prayer is still more than 15 minutes away.
 */
export function currentSlide<T>(slides: T[], phase: PrayerPhase, now: number, praying: boolean): T | null {
  const canRotate = phase.kind === "waiting" && phase.end - now > ROTATE_MIN_MS && !praying
  if (!canRotate || !slides.length) return null
  const t = now % (COUNTDOWN_MS + SLIDE_MS * slides.length)
  return t >= COUNTDOWN_MS ? slides[Math.floor((t - COUNTDOWN_MS) / SLIDE_MS)] : null
}

/** Night: from some time after Isya until some time before Subuh (earlier in Ramadan, for sahur). */
export function isNightTime(
  week: WeekSchedule,
  phase: PrayerPhase,
  now: number,
  night: Settings["night"],
  ramadan: boolean
) {
  if (!night.enabled || phase.kind !== "waiting" || phase.key !== "subuh") return false
  // Just after midnight the schedule starts today, so yesterday's Isya is estimated from today's.
  const subuhDay = week.days.find((d) => d.date === phase.date)
  const isyaAt =
    phase.prev?.key === "isya"
      ? phase.prev.at
      : subuhDay
        ? toEpoch(addDays(phase.date, -1), subuhDay.isya, week.utcOffset)
        : null
  if (isyaAt === null) return false
  const wakeBeforeSubuh = ramadan ? Math.max(night.beforeSubuh, RAMADAN_WAKE_MIN) : night.beforeSubuh
  return now >= isyaAt + night.afterIsya * 60_000 && now < phase.end - wakeBeforeSubuh * 60_000
}
