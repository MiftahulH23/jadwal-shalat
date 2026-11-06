# Jadwal Shalat

Website jadwal shalat Indonesia + layar TV masjid. Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind 4, shadcn/ui (Base UI, bukan Radix). Pengaturan di localStorage per browser dan per alamat website. Satu-satunya database: Supabase (paket gratis) untuk fitur pilihan Atur dari HP.

- Produksi: https://jadwal-shalat-omega.vercel.app (auto-deploy dari `main`)
- Repo: https://github.com/MiftahulH23/jadwal-shalat

## Aturan kerja

- Balas pengguna dalam Bahasa Indonesia. Teks UI berbahasa Indonesia; komentar kode dan nama variabel berbahasa Inggris.
- Commit hanya kalau diminta, tanpa `Co-Authored-By` dan tanpa `Claude-Session`. Pengguna yang melakukan push.
- Jangan menambah database, akun, atau backend penyimpanan lain tanpa persetujuan. Supabase hanya untuk Atur dari HP dan hanya paket gratis.
- Salah hitung waktu shalat adalah kesalahan paling fatal: perubahan logika waktu wajib dicek terhadap `docs/DOMAIN.md`.
- Setelah mengubah kode: `npm run check`. Untuk perubahan tampilan, buktikan dengan `npm run shot` (lihat `docs/VERIFY.md`).

## Baca sesuai tugas (jangan semuanya)

| Tugas | Baca |
|---|---|
| Mencari file atau alur data | `docs/ARCHITECTURE.md` |
| Waktu shalat, iqamah, Jumat, Ramadhan, layar TV, offline | `docs/DOMAIN.md` |
| Menguji, screenshot, jebakan lingkungan Windows | `docs/VERIFY.md` |
| Alasan sebuah keputusan, sebelum mengubah perilaku | `docs/DECISIONS.md` |
| Rencana berikutnya | `docs/ROADMAP.md` |

Perbarui dokumen terkait dalam perubahan yang sama kalau perilaku atau struktur berubah. Tandai item `docs/ROADMAP.md` yang selesai.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
