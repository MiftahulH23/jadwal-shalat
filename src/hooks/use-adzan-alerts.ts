"use client"

import { useCallback, useState } from "react"

import type { AdzanAlert } from "@/components/prayer/adzan-modal"
import { playBeeps, stopBeeps } from "@/lib/beep"
import { formatClock, ZONE_TIMEZONES } from "@/lib/format"
import { isFriday, isJumat, locationLabel, prayerLabel, type City, type PrayerKey, type PrayerPhase, type WeekSchedule } from "@/lib/prayer"
import type { Settings } from "@/lib/settings"

type Options = {
  week: WeekSchedule | null
  now: number | null
  phase: PrayerPhase | null
  city: City
  locationKey: string
  settings: Settings
  /** Bell toggle: simulations beep only when it is on. */
  soundOn: boolean
  /** Shown as the pop-up location instead of the automatic one (mosque address). */
  locationOverride?: string
  /** Skip the live Jumat iqamah pop-up (the mosque display shows "Ibadah Shalat Jumat" instead). */
  quietJumatIqamah?: boolean
}

/**
 * Big pop-ups for adzan and iqamah: shown during the first minute of each event
 * (so they also appear if the page was opened just after), until dismissed.
 * Also offers `simulate` to preview either pop-up on demand.
 */
export function useAdzanAlerts({ week, now, phase, city, locationKey, settings, soundOn, quietJumatIqamah, locationOverride }: Options) {
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [preview, setPreview] = useState<AdzanAlert | null>(null)

  const tz = week ? ZONE_TIMEZONES[week.zone] : "Asia/Jakarta"
  const location = locationOverride || (week ? locationLabel(city, week) : "")
  const timeOf = (key: PrayerKey, date: string) => week?.days.find((d) => d.date === date)?.[key] ?? ""
  const jumatOf = (key: PrayerKey, date: string) =>
    isJumat(key, date) ? { khatib: settings.jumat.khatib, imam: settings.jumat.imam } : undefined

  // Adzan just happened: we're in the iqamah countdown of that prayer.
  // Iqamah just happened: we're waiting for the next prayer, right after `prev`'s iqamah.
  const event =
    phase?.kind === "iqamah"
      ? { kind: "adzan" as const, key: phase.key, date: phase.date }
      : phase?.prev
        ? { kind: "iqamah" as const, key: phase.prev.key, date: phase.prev.date }
        : null
  const eventId = event && `${locationKey}|${event.kind}|${event.key}|${event.date}`
  const quiet = quietJumatIqamah && event?.kind === "iqamah" && isJumat(event.key, event.date)

  const live: AdzanAlert | null =
    phase && week && now && event && !quiet && eventId !== dismissed && now - phase.start < 60_000
      ? event.kind === "adzan"
        ? {
            ...event,
            time: timeOf(event.key, event.date),
            zone: week.zone,
            location,
            iqamahAt: phase.end,
            jumat: jumatOf(event.key, event.date),
          }
        : {
            ...event,
            time: formatClock(phase.start, tz).slice(0, 5),
            zone: week.zone,
            location,
            next: { name: prayerLabel(phase.key, phase.date), time: timeOf(phase.key, phase.date) },
            jumat: jumatOf(event.key, event.date),
          }
      : null

  const close = useCallback(() => {
    stopBeeps()
    setPreview(null)
    if (eventId) setDismissed(eventId)
  }, [eventId])

  /** Previews a pop-up; with `jumat`, as if this week's Friday prayer were starting. */
  const simulate = (kind: AdzanAlert["kind"], options: { jumat?: boolean } = {}) => {
    if (!phase || !week || !now) return
    // The 7-day window always contains a Friday.
    const friday = options.jumat ? week.days.find((d) => isFriday(d.date))?.date : undefined
    const key: PrayerKey = friday ? "dzuhur" : phase.key
    const date = friday ?? phase.date
    const jumat = jumatOf(key, date)
    const base = { key, date, zone: week.zone, location, jumat }
    const wait = jumat ? settings.jumat.khutbahMinutes : settings.iqamah[key]
    const time = formatClock(now, tz).slice(0, 5)
    // After Jumat comes Ashar; otherwise the upcoming prayer follows the simulated one.
    const next = friday
      ? { name: prayerLabel("ashar", date), time: timeOf("ashar", date) }
      : { name: prayerLabel(phase.key, phase.date), time: timeOf(phase.key, phase.date) }
    setPreview(
      kind === "adzan" ? { ...base, kind, time, iqamahAt: now + wait * 60_000 } : { ...base, kind, time, next }
    )
    if (soundOn) playBeeps(kind)
  }

  return { alert: preview ?? live, close, simulate }
}
