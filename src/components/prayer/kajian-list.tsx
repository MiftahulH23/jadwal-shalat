"use client"

import { BookOpenIcon, ClockIcon, UserIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { isKajianToday, kajianDayLabel, sortKajian, type Kajian } from "@/lib/settings"

/** Pengajian schedule for the main page; today's sessions first and highlighted. */
export function KajianList({ kajian, weekday }: { kajian: Kajian[]; weekday: number }) {
  const sorted = sortKajian(kajian, weekday)
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {sorted.map((k, i) => {
        const today = isKajianToday(k, weekday)
        // A lone last item (1, 3 … entries) spans both columns instead of leaving a gap.
        const wide = sorted.length % 2 === 1 && i === sorted.length - 1
        return (
          <div
            key={k.id}
            className={cn(
              "flex gap-3 rounded-2xl border bg-card p-4 shadow-sm backdrop-blur",
              wide && "sm:col-span-2",
              today && "border-gold/50 ring-2 ring-gold/30"
            )}
          >
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-xl",
                today ? "bg-gold/15 text-gold" : "bg-primary/10 text-primary"
              )}
            >
              <BookOpenIcon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{k.title || "Kajian"}</p>
                {today && <Badge className="shrink-0 bg-gold text-gold-foreground">Hari ini</Badge>}
              </div>
              {k.ustadz && (
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <UserIcon className="size-3.5 shrink-0" /> <span className="truncate">{k.ustadz}</span>
                </p>
              )}
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <ClockIcon className="size-3.5 shrink-0" />
                {kajianDayLabel(k.day)}
                {k.time && `, ${k.time}`}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
