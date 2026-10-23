import { toEpoch, type WeekSchedule } from "@/lib/prayer"

export type RamadanState = {
  imsak: { at: number; time: string }
  berbuka: { at: number; time: string }
  /** fasting = between imsak and maghrib today; berbuka = after maghrib; sahur = before imsak. */
  stage: "sahur" | "fasting" | "berbuka"
  /** 0..1 progress of today's fast (only meaningful while fasting). */
  progress: number
}

/** Next imsak and next maghrib (iftar) relative to `now`, plus today's fasting progress. */
export function getRamadanState(week: WeekSchedule, now: number, today: string): RamadanState | null {
  const idx = week.days.findIndex((d) => d.date === today)
  const day = week.days[idx]
  if (!day) return null
  const tomorrow = week.days[idx + 1]

  const imsakToday = toEpoch(day.date, day.imsak, week.utcOffset)
  const maghribToday = toEpoch(day.date, day.maghrib, week.utcOffset)
  const stage = now < imsakToday ? "sahur" : now < maghribToday ? "fasting" : "berbuka"

  const imsak =
    stage === "sahur" || !tomorrow
      ? { at: imsakToday, time: day.imsak }
      : { at: toEpoch(tomorrow.date, tomorrow.imsak, week.utcOffset), time: tomorrow.imsak }
  const berbuka =
    stage !== "berbuka" || !tomorrow
      ? { at: maghribToday, time: day.maghrib }
      : { at: toEpoch(tomorrow.date, tomorrow.maghrib, week.utcOffset), time: tomorrow.maghrib }

  const progress = stage === "fasting" ? (now - imsakToday) / (maghribToday - imsakToday) : stage === "berbuka" ? 1 : 0
  return { imsak, berbuka, stage, progress }
}
