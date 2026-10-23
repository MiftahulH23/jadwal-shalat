"use client"

import { AnimatePresence, motion } from "motion/react"

import { cn } from "@/lib/utils"

type Props = {
  show: boolean
  /** Current local time, "HH:mm". */
  clock: string
  /** Expected iqamah time while the khutbah is running, "HH:mm". */
  iqamahTime?: string
  /** "Khatib: … · Imam: …", empty when not set. */
  people: string
  /** Marks a simulation; clicking anywhere then closes the screen. */
  preview?: boolean
  onClose?: () => void
  className?: string
}

/** Full-screen notice shown on Friday from the Jumat adzan until the prayer ends. */
export function IbadahJumatScreen({ show, clock, iqamahTime, people, preview, onClose, className }: Props) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className={cn("grid place-items-center bg-[#020a08] px-[6vw] text-center text-white", className)}
          onClick={() => preview && onClose?.()}
          role="status"
        >
          {preview && (
            <span className="absolute top-[3vh] right-[3vw] rounded-full bg-amber-400/15 px-3 py-1 text-[max(0.75rem,min(1.3vw,2.2vh))] text-amber-200">
              Simulasi · klik untuk menutup
            </span>
          )}
          <div className="bg-geometric-light pointer-events-none absolute inset-0 opacity-[0.03]" />
          <div className="relative">
            <p className="font-arabic text-[max(2rem,min(4.5vw,7.5vh))] text-amber-100/80" lang="ar">
              الْجُمُعَةُ
            </p>
            <p className="text-[max(1.75rem,min(4.5vw,7.5vh))] leading-tight font-bold text-white/90">
              Ibadah Shalat Jumat sedang berlangsung
            </p>
            <p className="mt-[2vh] text-[max(1rem,min(2.2vw,3.8vh))] text-white/60">
              Mohon tidak berbicara selama khutbah dan senyapkan telepon genggam
            </p>
            {people && (
              <p className="mt-[3vh] text-[max(1rem,min(2.2vw,3.8vh))] font-medium text-amber-100/90">{people}</p>
            )}
            <p className="mx-auto mt-[4vh] max-w-[min(60rem,85vw)] text-[max(0.85rem,min(1.6vw,2.8vh))] leading-relaxed text-white/40 italic">
              &ldquo;Apabila engkau berkata kepada temanmu &lsquo;diamlah&rsquo; pada hari Jumat ketika imam sedang
              berkhutbah, maka sungguh engkau telah berbuat sia-sia.&rdquo; (HR. Bukhari dan Muslim)
            </p>
            <p className="mt-[4vh] font-mono text-[max(1.1rem,min(2.4vw,4vh))] text-white/35 tabular-nums">
              {clock}
              {iqamahTime && ` · perkiraan iqamah ${iqamahTime}`}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** "Khatib: … · Imam: …" from the Jumat settings (empty if neither is set). */
export function jumatPeople(jumat: { khatib: string; imam: string }) {
  return [jumat.khatib && `Khatib: ${jumat.khatib}`, jumat.imam && `Imam: ${jumat.imam}`].filter(Boolean).join("   ·   ")
}
