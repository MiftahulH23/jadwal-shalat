"use client"

import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { formatScheduleDate } from "@/lib/format"
import { isFriday, PRAYER_KEYS, TIME_KEYS, TIME_LABELS, type DaySchedule } from "@/lib/prayer"

type Props = {
  days: DaySchedule[]
  today: string
  selected: string
  onSelect: (date: string) => void
}

export function WeekTable({ days, today, selected, onSelect }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm backdrop-blur">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/60 hover:bg-muted/60">
            <TableHead className="sticky left-0 z-10 min-w-36 bg-muted pl-4">Hari</TableHead>
            {TIME_KEYS.map((key) => (
              <TableHead
                key={key}
                className={cn(
                  "text-center",
                  (PRAYER_KEYS as readonly string[]).includes(key) ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {TIME_LABELS[key]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {days.map((day) => {
            const isToday = day.date === today
            const isSelected = day.date === selected
            return (
              <TableRow
                key={day.date}
                onClick={() => onSelect(day.date)}
                data-state={isSelected ? "selected" : undefined}
                className={cn(
                  "cursor-pointer transition-colors",
                  isSelected && "bg-primary/8 hover:bg-primary/12 data-[state=selected]:bg-primary/10"
                )}
              >
                <TableCell
                  className={cn(
                    "sticky left-0 z-10 bg-card pl-4 font-medium",
                    isSelected && "border-l-4 border-l-primary"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className="leading-tight">
                      <p>{formatScheduleDate(day.date, { weekday: "long" })}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatScheduleDate(day.date, { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    {isToday && <Badge className="ml-auto">Hari ini</Badge>}
                    {!isToday && isFriday(day.date) && (
                      <Badge variant="secondary" className="ml-auto">
                        Jumat
                      </Badge>
                    )}
                  </div>
                </TableCell>
                {TIME_KEYS.map((key) => (
                  <TableCell
                    key={key}
                    className={cn(
                      "text-center font-mono tabular-nums",
                      (PRAYER_KEYS as readonly string[]).includes(key)
                        ? "font-semibold"
                        : "text-muted-foreground"
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
  )
}
