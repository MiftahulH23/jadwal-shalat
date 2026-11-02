# Arsitektur

## Halaman dan API

| Rute | Isi | Komponen utama |
|---|---|---|
| `/` | Jadwal sepekan, hitung mundur, pop-up, Ramadhan, pengajian | `prayer-dashboard.tsx` |
| `/layar` | Layar TV masjid | `mosque-display.tsx` |
| `/bulanan` | Jadwal sebulan, cetak, PDF, CSV (masih butuh internet) | `monthly-schedule.tsx` |
| `/api/kota` | Daftar kota | `lib/myquran.ts` |
| `/api/waktu` | Jam server, untuk koreksi jam perangkat | `lib/clock.ts` |
| `/api/jadwal/[id]?hari=&lat=&lng=` | Jadwal 1–62 hari | `lib/myquran.ts` |
| `/api/jadwal/[id]/bulan?tahun=&bulan=&lat=&lng=` | Jadwal sebulan | `lib/myquran.ts` |

## Alur data

```
API myQuran (Kemenag) -> lib/myquran.ts (cache server) -> /api/jadwal
  -> hooks/use-schedule.ts (cache localStorage 62 hari, lib/offline.ts)
  -> koreksi waktu (lib/settings.ts) -> potongan 7 hari mulai hari ini
  -> getPrayerPhase (lib/prayer.ts) -> UI, pop-up, bip
```

Mode GPS memakai `lib/astronomy.ts` untuk menghitung jadwal dari koordinat, dengan zona dan tanggal dari data kota Kemenag.

## Peta file (`src/`)

**`lib/`** (logika tanpa React)
- `prayer.ts`: tipe, zona waktu, `getPrayerPhase`, `isJumat`, label, `locationLabel`
- `settings.ts`: tipe `Settings`, default, `normalizeSettings`, koreksi, Ramadhan, kas, helper kajian
- `clock.ts`: `correctedNow()`, jam perangkat yang dikoreksi ke jam server
- `astronomy.ts`: hitung waktu dari koordinat
- `myquran.ts`: fetch API di server (`server-only`, `use cache`), elevasi Open-Meteo
- `offline.ts`: simpan dan baca jadwal, aturan refresh bulanan
- `ramadan.ts`, `beep.ts`, `export.ts` (PDF/CSV), `backup.ts` (kode `JS1-`/file), `format.ts`

**`hooks/`**
- `use-schedule.ts`: kota, pengaturan, jadwal, status offline
- `use-persisted-state.ts`: localStorage lewat `useSyncExternalStore`, `useHydrated`
- `use-adzan-alerts.ts`: pop-up adzan/iqamah dan simulasi
- `use-jumat-simulation.ts`, `use-phase-beeps.ts`, `use-now.ts`

**`components/prayer/`**
- Halaman: `prayer-dashboard`, `mosque-display`, `monthly-schedule`
- Hero dan daftar: `countdown-hero`, `day-times`, `week-table`, `ramadan-card`, `kajian-list`
- Layar TV: `tv-slides`, `ibadah-jumat-screen`
- Pop-up: `adzan-modal`, `simulation-panel`
- Pengaturan: `settings-dialog` (tab), `settings-sections` (isi tab), `settings-fields` (Stepper, Row, Field, RupiahInput), `backup-panel`, `city-picker`
- Lain: `offline-notice`, `theme-toggle`

**`components/ui/`**: hasil generate shadcn, hindari mengubahnya. **`public/sw.js`**: service worker, aktif hanya di build produksi.

## Menambah pengaturan baru

1. `lib/settings.ts`: tambah di tipe `Settings`, `DEFAULT_SETTINGS`, dan `normalizeSettings` (data lama harus tetap aman).
2. UI di `settings-sections.tsx`, pasang di tab pada `settings-dialog.tsx`.
3. Cadangan ikut otomatis. Perbarui keterangan isi cadangan di `backup-panel.tsx` kalau menambah kategori baru.

## Kunci localStorage

`jadwal-shalat:city`, `:sound` (default hidup), `:settings`, `:cache`, `:clock-offset`
