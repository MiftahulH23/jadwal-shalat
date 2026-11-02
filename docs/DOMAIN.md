# Aturan domain

## Sumber waktu

- Mode kota: jadwal resmi Kemenag lewat API myQuran. Waktunya lokal di kota tersebut.
- Mode GPS: dihitung dari koordinat (`lib/astronomy.ts`). Selisih terhadap Kemenag ±1 menit; terbit di daerah tinggi bisa 2 menit.

| Waktu | Rumus (`astronomy.ts`) | Pembulatan |
|---|---|---|
| Imsak | Subuh − 10 menit | - |
| Subuh | matahari −20°, +2 menit | ke atas |
| Terbit | ufuk, −2 menit | ke bawah |
| Dhuha | matahari +4,5°, +2 menit | ke atas |
| Dzuhur | transit, +3 menit | ke atas |
| Ashar | bayangan Syafi'i, +2 menit | ke atas |
| Maghrib | ufuk, +2 menit | ke atas |
| Isya | matahari −18°, +2 menit | ke atas |

Ufuk = −(0,8333° + 0,0347° × √ketinggian meter). Tanpa data ketinggian (offline tanpa cache), Maghrib di daerah tinggi bisa ±4 menit lebih awal.

## Zona waktu

Ditentukan dari provinsi (`zoneForRegion`), bukan zona perangkat: WIT = Papua, Maluku. WITA = Bali, Nusa Tenggara, Sulawesi, Gorontalo, Kalimantan Selatan/Timur/Utara. Sisanya WIB. Hitung mundur memakai jam perangkat; belum ada koreksi kalau jam itu salah.

## Fase hitung mundur (`getPrayerPhase`)

Hanya 5 shalat wajib. Setiap saat ada satu fase:
- `waiting`: menuju adzan shalat berikutnya. `prev` berisi shalat sebelumnya.
- `iqamah`: adzan sudah masuk, menuju iqamah.

Setelah Isya, target berikutnya Subuh besok. Jeda iqamah per shalat diatur pengguna (default 10 menit, 0 boleh).

## Koreksi waktu

Pengaturan ±30 menit per waktu, diterapkan ke semua tampilan termasuk cetak, PDF, dan CSV.

## Pop-up dan suara

- Pop-up adzan dan iqamah muncul pada menit pertama kejadian (juga kalau halaman baru dibuka), tertutup otomatis 5 detik, jeda saat kursor di atasnya.
- Tinggi pop-up diukur lalu zoom dibatasi supaya selalu muat layar, tanpa scrollbar.
- Bip ±5 detik, berhenti saat pop-up ditutup, mengikuti ikon bel, termasuk saat simulasi. Tidak memakai suara adzan: masjid sudah punya muadzin.
- Browser memblokir suara sampai ada klik pertama (`unlockAudioOnGesture`).
- Tombol simulasi tersembunyi, dinyalakan lewat Pengaturan > Layar.

## Hari Jumat

Dzuhur hari Jumat menjadi "Jumat" (الجمعة).
- Jeda adzan ke iqamah = durasi khutbah (default 30 menit).
- Layar TV: satu layar penuh **"Ibadah Shalat Jumat sedang berlangsung"** dari adzan sampai shalat selesai. Jangan memakai teks "Khutbah Jumat sedang berlangsung".
- Pop-up: "Telah masuk waktu shalat Jumat". Pop-up iqamah Jumat tidak muncul di TV.
- Khatib dan imam: jadwal per tanggal, kolom kosong memakai nama bawaan.

## Layar TV

- Setelah iqamah: layar "Shalat X sedang berlangsung" selama `prayingMinutes`.
- Slide (Kas, Petugas, Pengajian; yang kosong dilewati): 30 detik hitung mundur, lalu 12 detik per slide. Dihitung dari jam, `now % siklus`. Hanya saat fase `waiting` dan shalat berikutnya lebih dari 15 menit lagi.
- Layar redup malam: dari Isya + X menit sampai Subuh − Y menit. Saat Ramadhan menyala paling lambat 150 menit sebelum Subuh. Gerakan mouse menyalakan 1 menit.
- Teks berjalan: kalimat dipisah `;`, pembatas ✦.
- Alamat kosong = lokasi otomatis.
- Ukuran bagian tengah memakai satuan `cqh` (`main` adalah size container), bukan `vh`. Hitung mundur mengecil untuk setiap baris tambahan.

## Ramadhan

Mode otomatis memakai kalender Umm al-Qura, yang bisa berbeda dari ketetapan pemerintah, karena itu ada pilihan paksa aktif/nonaktif.

## Offline

- Unduh 62 hari sekaligus. API hanya dihubungi saat pertama kali, ganti lokasi, bulan berganti, atau sisa data kurang dari 8 hari.
- Gagal: pakai data tersimpan, tampilkan tanda Offline, coba lagi tiap 2 menit dan saat internet kembali.
- Data habis: mode GPS dihitung lokal; mode kota menampilkan error.
