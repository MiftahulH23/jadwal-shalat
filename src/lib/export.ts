// Client-side downloads of a monthly schedule (no server or database involved).

import { formatScheduleDate, hijriForDate } from "@/lib/format"
import { isFriday, prettyCity, TIME_KEYS, TIME_LABELS, type WeekSchedule } from "@/lib/prayer"

type ExportInput = {
  schedule: WeekSchedule
  /** e.g. "Oktober 2026" */
  monthLabel: string
  /** Extra line under the title, e.g. "Kec. Sumur Bandung". */
  placeLabel?: string
  fileBase: string
}

const HEAD = ["Tanggal", "Hijriah", ...TIME_KEYS.map((k) => TIME_LABELS[k])]

function rows(schedule: WeekSchedule) {
  return schedule.days.map((d) => [
    formatScheduleDate(d.date, { weekday: "short", day: "2-digit", month: "short" }),
    hijriForDate(d.date, { day: "numeric", month: "long" }),
    ...TIME_KEYS.map((k) => d[k]),
  ])
}

function sourceNote(schedule: WeekSchedule) {
  return schedule.source === "koordinat"
    ? "Dihitung dari titik GPS dengan parameter Kemenag RI"
    : "Sumber: Kemenag RI melalui API myQuran"
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

/** Semicolon-separated with BOM, so Excel in Indonesian locale opens it correctly. */
export function downloadCsv({ schedule, fileBase }: ExportInput) {
  const escape = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const lines = [HEAD, ...rows(schedule)].map((r) => r.map(escape).join(";"))
  download(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), `${fileBase}.csv`)
}

export async function downloadPdf({ schedule, monthLabel, placeLabel, fileBase }: ExportInput) {
  // Loaded on demand to keep the main bundle small.
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")])
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const emerald: [number, number, number] = [4, 120, 87]

  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.setTextColor(...emerald)
  doc.text(`Jadwal Shalat ${monthLabel}`, pageWidth / 2, 16, { align: "center" })

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(60)
  const location = [placeLabel, prettyCity(schedule.lokasi), prettyCity(schedule.daerah)].filter(Boolean).join(", ")
  doc.text(`${location} (${schedule.zone})`, pageWidth / 2, 22, { align: "center" })

  const fridayRows = new Set(schedule.days.flatMap((d, i) => (isFriday(d.date) ? [i] : [])))

  autoTable(doc, {
    startY: 27,
    head: [HEAD],
    body: rows(schedule),
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 1.6, halign: "center", lineColor: [220, 228, 224] },
    headStyles: { fillColor: emerald, textColor: 255, fontStyle: "bold" },
    columnStyles: { 0: { halign: "left" }, 1: { halign: "left", textColor: [110, 110, 110] } },
    didParseCell: (data) => {
      if (data.section === "body" && fridayRows.has(data.row.index)) {
        data.cell.styles.fillColor = [236, 248, 241]
        data.cell.styles.fontStyle = "bold"
      }
    },
  })

  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFontSize(8)
  doc.setTextColor(120)
  doc.text(`${sourceNote(schedule)}. Baris tebal = hari Jumat.`, 14, pageHeight - 10)

  download(doc.output("blob"), `${fileBase}.pdf`)
}
