"use client"

import { useRef, useState } from "react"
import { CheckIcon, ClipboardPasteIcon, CopyIcon, DownloadIcon, UploadIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { parseBackup, toBackupCode, toBackupJson, type Backup } from "@/lib/backup"
import { download } from "@/lib/export"
import { prettyCity } from "@/lib/prayer"

type Props = {
  /** Current state on this device, as it would be backed up. */
  current: Backup
  /** The form has changes that were not saved yet (they are included in the backup). */
  unsaved?: boolean
  onRestore: (backup: ReturnType<typeof parseBackup>) => void
}

export function BackupPanel({ current, unsaved, onRestore }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [code, setCode] = useState("")
  const [copied, setCopied] = useState(false)

  const exportFile = () => {
    const date = new Date().toISOString().slice(0, 10)
    download(new Blob([toBackupJson(current)], { type: "application/json" }), `pengaturan-jadwal-shalat-${date}.json`)
    toast.success("File cadangan diunduh")
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(toBackupCode(current))
      setCopied(true)
      setTimeout(() => setCopied(false), 2_000)
      toast.success("Kode cadangan disalin", { description: "Tempel di perangkat lain lewat tab Cadangan." })
    } catch {
      toast.error("Tidak bisa menyalin otomatis. Izinkan akses clipboard di browser.")
    }
  }

  const restore = (text: string) => {
    try {
      const backup = parseBackup(text)
      onRestore(backup)
      setCode("")
      toast.success("Pengaturan berhasil dipulihkan", {
        description: backup.city ? `Lokasi: ${prettyCity(backup.city.lokasi)}` : undefined,
      })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const importFile = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 100_000) {
      toast.error("File terlalu besar untuk sebuah cadangan pengaturan.")
      return
    }
    restore(await file.text())
    if (fileRef.current) fileRef.current.value = ""
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Simpan pengaturan, kota, dan status suara sebagai cadangan, atau salin ke perangkat lain (misalnya TV
        masjid). Tetap tanpa akun atau database.
      </p>

      <section className="space-y-2">
        <p className="text-sm font-medium">Buat cadangan</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" className="gap-2" onClick={exportFile}>
            <DownloadIcon /> Unduh file
          </Button>
          <Button variant="outline" className="gap-2" onClick={copyCode}>
            {copied ? <CheckIcon className="text-primary" /> : <CopyIcon />} Salin kode
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Berisi semua pengaturan (iqamah, koreksi, Ramadhan, Jumat, petugas, pengajian, kas, layar & alamat),
          kota, dan status suara.
          {unsaved && <span className="text-gold"> Termasuk perubahan yang belum Anda simpan.</span>}
        </p>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-medium">Pulihkan</p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void importFile(e.target.files?.[0])}
        />
        <Button variant="outline" className="w-full gap-2" onClick={() => fileRef.current?.click()}>
          <UploadIcon /> Pilih file cadangan (.json)
        </Button>
        <Textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          rows={3}
          placeholder="…atau tempel kode cadangan di sini (diawali JS1-)"
          className="max-h-40 resize-none overflow-y-auto font-mono text-xs wrap-anywhere"
        />
        <Button className="w-full gap-2" disabled={!code.trim()} onClick={() => restore(code)}>
          <ClipboardPasteIcon /> Pulihkan dari kode
        </Button>
        <p className="text-xs text-muted-foreground">Memulihkan akan menimpa pengaturan di perangkat ini.</p>
      </section>
    </div>
  )
}
