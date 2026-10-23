"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileDownIcon,
  FileSpreadsheetIcon,
  LoaderCircleIcon,
  PrinterIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CityPicker } from "@/components/prayer/city-picker"
import { ThemeToggle } from "@/components/prayer/theme-toggle"
import { useNow } from "@/hooks/use-now"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { CITY_KEY, DEFAULT_CITY, placeQuery, useSettings } from "@/hooks/use-schedule"
import { downloadCsv, downloadPdf } from "@/lib/export"
import { formatScheduleDate, hijriForDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  dateAtOffset,
  isFriday,
  PRAYER_KEYS,
  prettyCity,
  TIME_KEYS,
  TIME_LABELS,
  type City,
  type WeekSchedule,
} from "@/lib/prayer"
import { applyCorrections } from "@/lib/settings"

const monthLabel = (ym: string) => formatScheduleDate(`${ym}-01`, { month: "long", year: "numeric" })

function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}

export function MonthlySchedule() {
  const now = useNow()
  const [city, setCity, cityReady] = usePersistedState<City>(CITY_KEY, DEFAULT_CITY)
  const [settings] = useSettings()
  const [pickedMonth, setPickedMonth] = useState<string | null>(null)
  const [result, setResult] = useState<{ key: string; data?: WeekSchedule; error?: string } | null>(null)
  const [exporting, setExporting] = useState(false)

  // Default to the current month (WIB is close enough for picking a month).
  const today = now ? dateAtOffset(now, 7) : null
  const ym = pickedMonth ?? today?.slice(0, 7) ?? null
  const query = placeQuery(city)
  const requestKey = ym ? `${city.id}|${query}|${ym}` : null

  useEffect(() => {
    if (!cityReady || !ym || !requestKey) return
    const controller = new AbortController()
    const [y, m] = ym.split("-")
    fetch(`/api/jadwal/${city.id}/bulan?tahun=${y}&bulan=${Number(m)}${query ? `&${query}` : ""}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Gagal memuat jadwal")
        setResult({ key: requestKey, data: data as WeekSchedule })
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") setResult({ key: requestKey, error: err.message })
      })
    return () => controller.abort()
  }, [city.id, query, ym, requestKey, cityReady])

  const current = result?.key === requestKey ? result : null
  const schedule = useMemo(
    () => (current?.data ? applyCorrections(current.data, settings.corrections) : null),
    [current, settings.corrections]
  )

  const placeLabel = city.place?.kecamatan ? `Kec. ${city.place.kecamatan}` : undefined
  const fileBase = schedule && ym ? `jadwal-shalat-${schedule.lokasi.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${ym}` : ""
  const exportInput = schedule && ym ? { schedule, monthLabel: monthLabel(ym), placeLabel, fileBase } : null

  const exportPdf = async () => {
    if (!exportInput) return
    setExporting(true)
    try {
      await downloadPdf(exportInput)
    } catch {
      toast.error("Gagal membuat PDF")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-h-dvh bg-background print:min-h-0">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Button variant="ghost" className="gap-2 rounded-full" render={<Link href="/" />} nativeButton={false}>
            <ArrowLeftIcon /> <span className="hidden sm:inline">Kembali</span>
          </Button>
          <div className="flex items-center gap-2">
            <CityPicker value={city} onChange={setCity} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 print:max-w-none print:space-y-3 print:p-0">
        {/* Title (also the printed header) */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-wide text-primary uppercase print:text-[10pt]">Jadwal Shalat Bulanan</p>
            <h1 className="text-3xl font-bold tracking-tight print:text-[18pt]">{ym ? monthLabel(ym) : "…"}</h1>
            {schedule && (
              <p className="text-sm text-muted-foreground print:text-[10pt]">
                {placeLabel ? `${placeLabel}, ` : ""}
                {prettyCity(schedule.lokasi)}, {prettyCity(schedule.daerah)} ({schedule.zone})
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <div className="flex items-center rounded-full border bg-card p-1">
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="Bulan sebelumnya" onClick={() => ym && setPickedMonth(shiftMonth(ym, -1))}>
                <ChevronLeftIcon />
              </Button>
              <Button variant="ghost" size="sm" className="rounded-full px-3" onClick={() => setPickedMonth(null)}>
                Bulan ini
              </Button>
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="Bulan berikutnya" onClick={() => ym && setPickedMonth(shiftMonth(ym, 1))}>
                <ChevronRightIcon />
              </Button>
            </div>
            <Button variant="outline" className="gap-2 rounded-full" disabled={!schedule} onClick={() => window.print()}>
              <PrinterIcon /> Cetak
            </Button>
            <Button className="gap-2 rounded-full" disabled={!schedule || exporting} onClick={exportPdf}>
              {exporting ? <LoaderCircleIcon className="animate-spin" /> : <FileDownIcon />} PDF
            </Button>
            <Button
              variant="outline"
              className="gap-2 rounded-full"
              disabled={!exportInput}
              onClick={() => exportInput && downloadCsv(exportInput)}
            >
              <FileSpreadsheetIcon /> CSV
            </Button>
          </div>
        </div>

        {current?.error ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-destructive/30 bg-destructive/5 p-10 text-center">
            <TriangleAlertIcon className="size-10 text-destructive" />
            <p className="font-semibold">Jadwal tidak dapat dimuat</p>
            <p className="text-sm text-muted-foreground">{current.error}</p>
          </div>
        ) : !schedule ? (
          <Skeleton className="h-[40rem] rounded-2xl" />
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm print:rounded-none print:border-0 print:shadow-none">
            <Table className="print:text-[9pt]">
              <TableHeader>
                <TableRow className="bg-primary/10 hover:bg-primary/10 print:bg-transparent">
                  <TableHead className="pl-4 print:h-7 print:pl-1">Tanggal</TableHead>
                  <TableHead className="print:h-7">Hijriah</TableHead>
                  {TIME_KEYS.map((key) => (
                    <TableHead
                      key={key}
                      className={cn(
                        "text-center print:h-7",
                        (PRAYER_KEYS as readonly string[]).includes(key) ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {TIME_LABELS[key]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedule.days.map((day) => {
                  const isToday = day.date === today
                  const friday = isFriday(day.date)
                  return (
                    <TableRow
                      key={day.date}
                      className={cn(
                        friday && "bg-gold/8 print:bg-transparent print:font-semibold",
                        isToday && "bg-primary/10 font-semibold print:bg-transparent"
                      )}
                    >
                      <TableCell className={cn("pl-4 print:py-0.5 print:pl-1", isToday && "border-l-4 border-l-primary print:border-l-0")}>
                        {formatScheduleDate(day.date, { weekday: "short", day: "2-digit" })}
                        {isToday && <span className="ml-2 text-xs text-primary print:hidden">Hari ini</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground print:py-0.5">
                        {hijriForDate(day.date, { day: "numeric", month: "short" })}
                      </TableCell>
                      {TIME_KEYS.map((key) => (
                        <TableCell
                          key={key}
                          className={cn(
                            "text-center font-mono tabular-nums print:py-0.5",
                            (PRAYER_KEYS as readonly string[]).includes(key) ? "font-semibold" : "text-muted-foreground"
                          )}
                        >
                          {day[key]}
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {schedule && (
          <p className="text-xs text-muted-foreground print:text-[8pt]">
            {schedule.source === "koordinat"
              ? "Dihitung dari titik GPS dengan parameter Kemenag RI."
              : "Sumber: Kemenag RI melalui API myQuran."}{" "}
            Baris berwarna/tebal menandai hari Jumat.
            {TIME_KEYS.some((k) => settings.corrections[k]) && " Sudah termasuk koreksi waktu dari Pengaturan."}
          </p>
        )}
      </main>
    </div>
  )
}
