"use client"

import { useEffect, useRef, useState } from "react"
import { RotateCcwIcon, Settings2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { BackupPanel } from "@/components/prayer/backup-panel"
import { BackgroundSection, type PhotoChange } from "@/components/prayer/settings-sections"
import { SettingsTabs } from "@/components/prayer/settings-tabs"
import { saveBackground } from "@/lib/background"
import { cn } from "@/lib/utils"
import { locationLabel } from "@/lib/prayer"
import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from "@/lib/settings"
import type { Backup, parseBackup } from "@/lib/backup"

type Props = {
  settings: Settings
  onSave: (settings: Settings) => void
  /** Current city and sound state, included in backups. */
  backup: Omit<Backup, "settings">
  /** Applies a restored backup (city and sound are optional in older backups). */
  onRestore: (backup: ReturnType<typeof parseBackup>) => void
  /** Whether today counts as Ramadan, shown next to the "auto" option. */
  ramadanNow: boolean
  /** Today in the city (YYYY-MM-DD), to list the coming Fridays. */
  today: string
  /** Told when the dialog opens and closes, e.g. to hold back changes from a phone meanwhile. */
  onOpenChange?: (open: boolean) => void
  /** A new photo (or none) was saved on this device. */
  onPhotoSaved?: (photo: Blob | null) => void
  /** Replaces the note under the photo, e.g. on a TV whose photo also goes to its phones. */
  photoNote?: string
  /** Look of the button: a round icon (home page), or icon and label (TV control bar). */
  trigger?: "icon" | "tv"
  triggerClassName?: string
}

export function SettingsDialog({
  settings,
  onSave,
  ramadanNow,
  backup,
  onRestore,
  today,
  onOpenChange,
  onPhotoSaved,
  photoNote,
  trigger = "icon",
  triggerClassName,
}: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(settings)
  const [photoChange, setPhotoChange] = useState<PhotoChange>(undefined)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const saveButton = useRef<HTMLButtonElement>(null)

  // Normalized first: an empty new pengajian, for example, is not worth a warning.
  const settingsChanged = JSON.stringify(normalizeSettings(draft)) !== JSON.stringify(settings)
  const unsaved = open && (settingsChanged || photoChange !== undefined)

  // Reloading or closing the tab can't show our own warning, only the browser's.
  useEffect(() => {
    if (!unsaved) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [unsaved])

  const changePhoto = (next: PhotoChange) => {
    if (photoChange) URL.revokeObjectURL(photoChange.url)
    setPhotoChange(next)
  }

  /** Closes for real; a photo that was chosen but not saved is dropped. */
  const close = () => {
    changePhoto(undefined)
    setConfirmOpen(false)
    setOpen(false)
    onOpenChange?.(false)
  }

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraft(settings)
      setOpen(true)
      onOpenChange?.(true)
    } else if (unsaved) {
      setConfirmOpen(true)
    } else {
      close()
    }
  }

  const save = async () => {
    setConfirmOpen(false)
    if (photoChange !== undefined) {
      try {
        await saveBackground(photoChange?.blob ?? null)
      } catch {
        toast.error("Foto gagal disimpan. Pastikan browser tidak dalam mode penyamaran.")
        return
      }
      onPhotoSaved?.(photoChange?.blob ?? null)
    }
    onSave(draft)
    close()
    toast.success("Pengaturan disimpan di perangkat ini")
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger === "tv" ? (
        <DialogTrigger render={<Button variant="ghost" className={triggerClassName} aria-label="Pengaturan" />}>
          <Settings2Icon /> Pengaturan
        </DialogTrigger>
      ) : (
        <Tooltip>
          <TooltipTrigger
            render={
              <DialogTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    className={cn("size-10 rounded-full bg-card/60 backdrop-blur", triggerClassName)}
                    aria-label="Pengaturan"
                  />
                }
              />
            }
          >
            <Settings2Icon />
          </TooltipTrigger>
          <TooltipContent>Pengaturan</TooltipContent>
        </Tooltip>
      )}

      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-x-hidden overflow-y-auto sm:max-w-xl [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>Pengaturan</DialogTitle>
          <DialogDescription>Disimpan di browser perangkat ini, tanpa akun atau database.</DialogDescription>
        </DialogHeader>

        <SettingsTabs
          draft={draft}
          setDraft={setDraft}
          ramadanNow={ramadanNow}
          today={today}
          locationFallback={locationLabel(backup.city)}
          photo={<BackgroundSection draft={draft} setDraft={setDraft} change={photoChange} onChange={changePhoto} note={photoNote} />}
          simulation
          backup={
            <BackupPanel
              // Back up what the form shows, including changes not saved yet.
              current={{ ...backup, settings: draft }}
              unsaved={settingsChanged}
              onRestore={(restored) => {
                onRestore(restored)
                setDraft(restored.settings)
                close()
              }}
            />
          }
        />

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" className="gap-2" onClick={() => setDraft(DEFAULT_SETTINGS)}>
            <RotateCcwIcon /> Kembalikan default
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Batal
            </Button>
            <Button onClick={() => void save()}>Simpan</Button>
          </div>
        </DialogFooter>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          {/* Focus starts on Simpan, so pressing Enter by habit keeps the changes. */}
          <DialogContent className="sm:max-w-md" showCloseButton={false} initialFocus={saveButton}>
            <DialogHeader>
              <DialogTitle>Simpan perubahan?</DialogTitle>
              <DialogDescription>
                Ada pengaturan yang belum disimpan. Kalau tidak disimpan, perubahan tersebut akan hilang.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={close}>
                Jangan simpan
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmOpen(false)}>
                  Lanjut mengatur
                </Button>
                <Button ref={saveButton} className="flex-1" onClick={() => void save()}>
                  Simpan
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}
