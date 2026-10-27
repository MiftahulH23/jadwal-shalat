"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { BellRingIcon, FlaskConicalIcon, LandmarkIcon, MoonStarIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  onSimulate: (kind: "adzan" | "iqamah", options?: { jumat?: boolean }) => void
}

/** Floating panel to preview the adzan / iqamah / Jumat pop-ups (enabled in Pengaturan > Layar). */
export function SimulationPanel({ onSimulate }: Props) {
  const [open, setOpen] = useState(true)

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:right-6 sm:bottom-6">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="w-64 origin-bottom-right rounded-2xl border bg-popover/95 p-3 shadow-xl backdrop-blur-xl"
          >
            <p className="px-1 text-sm font-semibold">Simulasi pop-up</p>
            <p className="mb-3 px-1 text-xs text-muted-foreground">
              Tampilkan pop-up tanpa menunggu waktu shalat.
            </p>
            <div className="grid gap-2">
              <Button
                onClick={() => onSimulate("adzan")}
                className="h-10 justify-start gap-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500"
              >
                <MoonStarIcon /> Masuk waktu shalat
              </Button>
              <Button
                onClick={() => onSimulate("iqamah")}
                className="h-10 justify-start gap-2 rounded-xl bg-amber-500 text-emerald-950 hover:bg-amber-400"
              >
                <BellRingIcon /> Masuk waktu iqamah
              </Button>
              <Button
                onClick={() => onSimulate("adzan", { jumat: true })}
                className="h-10 justify-start gap-2 rounded-xl bg-teal-800 text-white hover:bg-teal-700"
              >
                <LandmarkIcon /> Masuk waktu shalat Jumat
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        size="icon"
        variant="outline"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Tutup panel simulasi" : "Buka panel simulasi"}
        aria-expanded={open}
        className={cn(
          "size-12 rounded-full bg-card/80 shadow-lg backdrop-blur-xl transition-transform hover:scale-105",
          open && "border-primary/40 text-primary"
        )}
      >
        {open ? <XIcon className="size-5" /> : <FlaskConicalIcon className="size-5" />}
      </Button>
    </div>
  )
}
