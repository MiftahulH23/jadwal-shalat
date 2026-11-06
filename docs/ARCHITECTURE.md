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
| `/atur` | Mengatur layar TV dari HP (`#p=` QR, `#k=` link HP) | `atur-page.tsx` |
| `/api/layar/sambung`, `qr`, `klaim`, `data`, `hp`, `pin`, `reset`, `foto` | Atur dari HP, ke Supabase dengan kunci rahasia | `lib/supabase-server.ts` |

## Atur dari HP (Supabase)

Rancangan dan aturannya: `docs/RANCANGAN-ATUR-DARI-HP.md`. Fitur pilihan; TV yang tidak dihubungkan tidak memanggil Supabase.

- Database: `supabase/migrations/`, diuji di `supabase/layar.test.ts` (PGlite). Tabel di skema `layar` yang tidak terbuka lewat API.
- TV membaca langsung ke Supabase dengan kunci publishable (`lib/layar-public.ts`, hanya `layar_cek` dan `layar_ambil`). Menulis selalu lewat `/api/layar/*`.
- Kunci rahasia: `SUPABASE_SECRET_KEY` di `.env.local` dan Vercel. `LAYAR_SYNC_ENABLED=false` menutup QR dan masjid baru.
- Alamat proyek dan kunci publishable ada di `lib/layar-config.ts`.

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
- `tv.ts`: keputusan layar TV: penyiapan awal, layar shalat, slide, layar malam
- `layar-data.ts` (data bersama, kunci, link), `layar-pairing.ts` (kapan QR dipakai ulang atau diperbarui), `layar-sync.ts` (tarik atau kirim, konfirmasi perubahan waktu), `layar-public.ts`, `layar-photo.ts` (kirim dan unduh foto), `layar-config.ts`, `supabase-server.ts` (khusus server)
- `clock.ts`: `correctedNow()`, jam perangkat yang dikoreksi ke jam server
- `astronomy.ts`: hitung waktu dari koordinat
- `myquran.ts`: fetch API di server (`server-only`, `use cache`), elevasi Open-Meteo
- `offline.ts`: simpan dan baca jadwal, aturan refresh bulanan
- `background.ts`: foto latar TV: kompresi di browser, simpan di IndexedDB, konversi untuk cadangan
- `ramadan.ts`, `beep.ts`, `export.ts` (PDF/CSV), `backup.ts` (kode `JS1-`/file), `format.ts`

**`hooks/`**
- `use-schedule.ts`: kota, pengaturan, jadwal, status offline
- `use-persisted-state.ts`: localStorage lewat `useSyncExternalStore`, `useHydrated`
- `use-adzan-alerts.ts`: pop-up adzan/iqamah dan simulasi
- `use-background-photo.ts`: URL foto latar, ikut berubah saat foto diganti
- `use-audio-blocked.ts`: apakah browser masih menahan suara
- `use-layar-sync.ts`: TV yang terhubung ke HP: cek tiap 5 menit, ambil perubahan dari HP, kirim perubahan dari TV
- `use-jumat-simulation.ts`, `use-phase-beeps.ts`, `use-now.ts`

**`components/prayer/`**
- Halaman: `prayer-dashboard`, `mosque-display`, `monthly-schedule`
- Hero dan daftar: `countdown-hero`, `day-times`, `week-table`, `ramadan-card`, `kajian-list`
- Layar TV: `layar-setup` (penyiapan awal), `phone-pairing` (QR), `tv-slides`, `ibadah-jumat-screen`
- HP: `atur-page`, `managers-card` (pengelola utama: daftar HP, undangan, PIN)
- TV: `emergency-reset` (reset dengan PIN darurat)
- Pop-up: `adzan-modal`, `simulation-panel`
- Pengaturan: `settings-dialog` (jendela), `settings-tabs` (tab, dipakai juga di `/atur`), `settings-sections` (isi tab), `settings-fields` (Stepper, Row, Field, RupiahInput), `backup-panel`, `city-picker`
- Lain: `offline-notice`, `theme-toggle`

**Tes**: `lib/*.test.ts` (Vitest), data contoh di `lib/test-week.ts`.

**`components/ui/`**: hasil generate shadcn, hindari mengubahnya. **`public/sw.js`**: service worker, aktif hanya di build produksi.

## Menambah pengaturan baru

1. `lib/settings.ts`: tambah di tipe `Settings`, `DEFAULT_SETTINGS`, dan `normalizeSettings` (data lama harus tetap aman).
2. UI di `settings-sections.tsx`, pasang di tab pada `settings-dialog.tsx`.
3. Cadangan ikut otomatis. Perbarui keterangan isi cadangan di `backup-panel.tsx` kalau menambah kategori baru.

## Kunci localStorage

`jadwal-shalat:city`, `:sound` (default hidup), `:settings`, `:cache`, `:clock-offset`. Atur dari HP: `:layar` (kunci TV, tetap selamanya), `:layar-qr` (QR yang sedang tampil), `:atur` (daftar masjid di HP)

## IndexedDB

Database `jadwal-shalat`, store `images`, kunci `background`: foto latar TV. Tingkat gelap dan posisi gesernya ada di `Settings.background`.
