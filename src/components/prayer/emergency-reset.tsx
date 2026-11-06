"use client"

import { useState } from "react"
import { KeyRoundIcon, LoaderCircleIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { TvLink } from "@/components/prayer/phone-pairing"
import { TV_LINK_KEY } from "@/lib/layar-config"

/**
 * On a connected TV, for when every main manager's phone is lost: the emergency PIN removes all phones,
 * so the next phone to scan this TV's QR code becomes the main manager. Schedule and settings stay.
 */
export function EmergencyReset({ onReset }: { onReset: () => void }) {
  const [open, setOpen] = useState(false)
  const [pin, setPin] = useState("")
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setProblem(null)
    try {
      const link = JSON.parse(localStorage.getItem(TV_LINK_KEY) ?? "null") as TvLink | null
      const res = await fetch("/api/layar/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${link?.tvKey ?? ""}` },
        body: JSON.stringify({ pin }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setProblem(body.error ?? "Reset gagal.")
        return
      }
      setOpen(false)
      setPin("")
      toast.success("Semua HP dilepas", { description: "Pindai QR di layar ini untuk menjadi pengelola utama yang baru." })
      onReset()
    } catch {
      setProblem("Tidak ada koneksi internet.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="mt-2 border-t border-white/10 pt-4 text-center">
        <p className="text-sm text-white/60">HP pengelola utama hilang semua?</p>
        <Button variant="ghost" className="mt-1 gap-2 text-amber-200 hover:bg-white/10 hover:text-amber-100" onClick={() => setOpen(true)}>
          <KeyRoundIcon /> Reset dengan PIN darurat
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-white/10 bg-[#0b1f1c] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset dengan PIN darurat</DialogTitle>
            <DialogDescription className="text-white/60">
              Semua HP dilepas dari layar ini. Jadwal dan pengaturan tetap. Setelah itu, HP pertama yang memindai QR menjadi
              pengelola utama.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
            className="space-y-3"
          >
            <Input
              value={pin}
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              autoFocus
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="PIN 6 angka"
              aria-label="PIN darurat"
              className="h-12 border-white/20 bg-white/5 text-center font-mono text-2xl tracking-[0.4em] text-white dark:bg-white/5"
            />
            {problem && <p className="text-sm text-red-300">{problem}</p>}
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={() => setOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={busy || pin.length !== 6}>
                {busy && <LoaderCircleIcon className="animate-spin" />} Reset
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
