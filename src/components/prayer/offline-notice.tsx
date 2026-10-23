"use client"

import { WifiOffIcon } from "lucide-react"

import type { OfflineStatus } from "@/hooks/use-schedule"
import { cn } from "@/lib/utils"

function describe(status: OfflineStatus) {
  if (status.calculated) return "jadwal dihitung dari titik lokasi (metode Kemenag)"
  if (!status.savedAt) return "memakai jadwal tersimpan"
  const saved = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(status.savedAt)
  return `memakai jadwal tersimpan (diunduh ${saved})`
}

/** Tells the user the schedule is shown from the device, not live. */
export function OfflineNotice({ status, variant = "page" }: { status: OfflineStatus; variant?: "page" | "tv" }) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-2",
        variant === "page"
          ? "rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm"
          : "rounded-full bg-amber-400/15 px-[1vw] py-[0.4vh] text-[min(1.3vw,2.2vh)] text-amber-100"
      )}
    >
      <WifiOffIcon className={cn("shrink-0 text-gold", variant === "tv" && "size-[1.1em] text-amber-300")} />
      <span>
        <span className="font-semibold">Offline</span> · {describe(status)}. Akan diperbarui otomatis saat internet
        kembali.
      </span>
    </div>
  )
}
