// Fixed schedules for the tests. Expected instants are written with `wib()` and friends instead
// of the app's own toEpoch, so a bug there cannot hide itself.

import type { DaySchedule, WeekSchedule } from "@/lib/prayer"

export const at = (date: string, time: string, offset: "+07:00" | "+08:00" | "+09:00" = "+07:00") =>
  new Date(`${date}T${time.length === 5 ? `${time}:00` : time}${offset}`).getTime()

export const wib = (date: string, time: string) => at(date, time)

export function makeDay(date: string): DaySchedule {
  return {
    date,
    tanggal: date,
    imsak: "04:20",
    subuh: "04:30",
    terbit: "05:45",
    dhuha: "06:15",
    dzuhur: "12:00",
    ashar: "15:00",
    maghrib: "18:00",
    isya: "19:00",
  }
}

export function makeWeek(dates: string[], zone: Partial<Pick<WeekSchedule, "utcOffset" | "zone">> = {}): WeekSchedule {
  return {
    id: "1301",
    lokasi: "KOTA JAKARTA",
    daerah: "DKI JAKARTA",
    utcOffset: 7,
    zone: "WIB",
    source: "kemenag",
    days: dates.map(makeDay),
    ...zone,
  }
}
