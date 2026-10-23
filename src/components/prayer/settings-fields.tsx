"use client"

import { MinusIcon, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/** − value + control for small whole numbers (minutes). */
export function Stepper({
  value,
  onChange,
  min,
  max,
  suffix,
  signed,
  step = 1,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  suffix: string
  signed?: boolean
  step?: number
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)))
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button variant="outline" size="icon" className="size-8 rounded-full" onClick={() => set(value - step)} disabled={value <= min} aria-label="Kurangi">
        <MinusIcon />
      </Button>
      <span
        className={cn(
          "w-20 text-center font-mono text-sm tabular-nums",
          signed && value > 0 && "text-primary",
          signed && value < 0 && "text-gold"
        )}
      >
        {signed && value > 0 ? "+" : ""}
        {value} {suffix}
      </span>
      <Button variant="outline" size="icon" className="size-8 rounded-full" onClick={() => set(value + step)} disabled={value >= max} aria-label="Tambah">
        <PlusIcon />
      </Button>
    </div>
  )
}

/** A bordered row: label (and hint) on the left, a control on the right. */
export function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card/60 px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

/** Labelled form field. */
export function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}

/** Rupiah amount typed as plain digits, shown with thousand separators. */
export function RupiahInput({
  value,
  onChange,
  allowNegative,
  ...props
}: {
  value: number
  onChange: (v: number) => void
  allowNegative?: boolean
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
      <Input
        {...props}
        inputMode="numeric"
        className="pl-9 font-mono tabular-nums"
        value={value ? value.toLocaleString("id-ID") : ""}
        placeholder="0"
        onChange={(e) => {
          const negative = allowNegative && e.target.value.trim().startsWith("-")
          const digits = Number(e.target.value.replace(/\D/g, "").slice(0, 13))
          onChange(negative ? -digits : digits)
        }}
      />
    </div>
  )
}
