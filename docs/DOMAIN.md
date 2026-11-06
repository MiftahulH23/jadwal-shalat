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

Ditentukan dari provinsi (`zoneForRegion`), bukan zona perangkat: WIT = Papua, Maluku. WITA = Bali, Nusa Tenggara, Sulawesi, Gorontalo, Kalimantan Selatan/Timur/Utara. Sisanya WIB.

## Sumber jam

Jam perangkat bisa meleset (laptop pemilik pernah tertinggal 24 detik), padahal adzan dan iqamah mengikutinya. Karena itu kode browser memakai `correctedNow()` dari `lib/clock.ts`, **jangan `Date.now()` langsung**. Selisih dengan jam server (`/api/waktu`) diukur saat halaman dibuka, tiap 30 menit, saat tab kembali aktif, dan saat internet kembali. Selisihnya disimpan, jadi tetap dipakai saat offline. Kalau belum pernah berhasil sinkron, jam perangkat dipakai apa adanya.

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
- Browser memblokir suara sampai ada klik atau tombol ditekan (`unlockAudioOnGesture`). Selama diblokir dan ikon bel menyala, layar TV menampilkan "Suara belum aktif. Klik sekali untuk mengaktifkan" di bawah nama masjid, lalu berbunyi bip pendek saat berhasil aktif. Pesan ini tertutup oleh layar shalat, Jumat, dan malam.
- Tombol simulasi tersembunyi, dinyalakan lewat Pengaturan > Layar.

## Hari Jumat

Dzuhur hari Jumat menjadi "Jumat" (الجمعة).
- Jeda adzan ke iqamah = durasi khutbah (default 30 menit).
- Layar TV: satu layar penuh **"Ibadah Shalat Jumat sedang berlangsung"** dari adzan sampai shalat selesai. Jangan memakai teks "Khutbah Jumat sedang berlangsung".
- Pop-up: "Telah masuk waktu shalat Jumat". Pop-up iqamah Jumat tidak muncul di TV.
- Khatib dan imam: jadwal per tanggal, kolom kosong memakai nama bawaan.

## Layar TV

- Penyiapan awal: `/layar` meminta kota dulu kalau belum ada kota tersimpan dan nama masjid masih kosong (`needsLayarSetup`). Selama itu jadwal, pop-up, dan bip belum berjalan, supaya waktu kota bawaan tidak pernah tampil. Nama masjid boleh dikosongkan. Layar yang sudah punya nama masjid tidak pernah ditanya, supaya TV yang sedang dipakai tidak tertutup setelah dimuat ulang. Kota bisa diganti kapan saja dari kontrol di layar.
- Kontrol di layar muncul saat mouse bergerak atau tombol ditekan, di lajur teks berjalan: kiri Keluar dan lokasi, kanan suara, Atur dari HP, Pengaturan, layar penuh. Ukurannya mengikuti tinggi layar.
- Sinkron dengan HP (hanya TV yang terhubung): TV mengecek versi tiap 5 menit (±30 detik), saat tab aktif lagi, saat internet kembali, dan saat ada yang menekan tombol atau menggerakkan mouse di TV (paling sering tiap 15 detik). Halaman HP memperbarui status tiap menit; "TV terakhir terhubung" dicatat server paling sering sekali sejam, jadi di bawah satu jam ditulis "dalam 1 jam terakhir". Perubahan di TV terkirim 3 detik kemudian. Kalau HP dan TV sama-sama berubah, data HP yang dipakai dan TV memberi tahu. Perubahan dari HP ditahan selama Pengaturan atau QR terbuka di TV. Dari HP, mengganti lokasi, koreksi, iqamah, atau durasi khutbah meminta konfirmasi dulu.
- Peran HP: HP yang menyiapkan masjid menjadi pengelola utama. Pengelola utama mengundang pengurus (link per orang), menyetujui HP yang memindai QR TV, mencabut HP, menunjuk pengelola cadangan, dan membuat PIN darurat. Paling banyak 3 HP per masjid, pengelola utama termasuk; HP yang menunggu persetujuan tidak dihitung, tidak melihat data, dan hanya ada satu dalam satu waktu. TV tidak bisa memutus HP karena berada di tempat umum. Kalau semua HP pengelola utama hilang: di TV, Atur dari HP > Reset dengan PIN darurat melepas semua HP (data tetap), lalu HP pertama yang memindai menjadi pengelola utama. PIN sekali pakai; 5 kali salah dikunci 1 jam. Kunci TV yang 60 hari tidak mengecek dihapus otomatis saat ada QR baru dibuat.
- Atur dari HP: layar penyiapan dan tombol "Atur dari HP" di kontrol TV menampilkan QR. QR sekali pakai, berlaku 15 menit, tetap sama setelah dimuat ulang, diperbarui otomatis paling lama 1 jam lalu berhenti. Memindai QR dari TV yang sudah terhubung menambah HP pengurus; dari TV baru membuat masjid baru atau memakai masjid yang sudah ada di HP itu.
- Setelah iqamah: layar "Shalat X sedang berlangsung" selama `prayingMinutes`.
- Slide (Kas, Petugas, Pengajian; yang kosong dilewati): 30 detik hitung mundur, lalu 12 detik per slide. Dihitung dari jam, `now % siklus`. Hanya saat fase `waiting` dan shalat berikutnya lebih dari 15 menit lagi.
- Layar redup malam: dari Isya + X menit sampai Subuh − Y menit. Saat Ramadhan menyala paling lambat 150 menit sebelum Subuh. Gerakan mouse atau tombol keyboard/remote menyalakan 1 menit dan memunculkan kontrol di layar.
- Teks berjalan: kalimat dipisah `;`, pembatas ✦.
- Alamat kosong = lokasi otomatis.
- Foto latar (opsional, satu foto, hanya di `/layar`): dikecilkan di browser menjadi JPEG, cukup untuk menutup layar Full HD. Tingkat gelap 40–90%, default 60%. Bagian yang tampil diatur dengan menggeser foto di pratinjau (`x`, `y` berupa persen `background-position`). Pratinjau berasio 16:9, jadi pada TV dengan rasio lain potongannya bisa sedikit berbeda. Layar shalat dan Jumat memakai foto yang jauh lebih gelap (85%) sebagai latar tertutup penuh, supaya hitung mundur di belakangnya tidak tembus. Layar redup malam tetap hitam penuh.
- Foto hanya tersimpan di browser perangkat itu. Ikut di file cadangan, tidak di kode `JS1-`. Memulihkan cadangan tanpa foto tidak menghapus foto yang ada.
- Ukuran bagian tengah memakai satuan `cqh` (`main` adalah size container), bukan `vh`. Hitung mundur mengecil untuk setiap baris tambahan.

## Ramadhan

Mode otomatis memakai kalender Umm al-Qura, yang bisa berbeda dari ketetapan pemerintah, karena itu ada pilihan paksa aktif/nonaktif.

## Offline

- Unduh 62 hari sekaligus. API hanya dihubungi saat pertama kali, ganti lokasi, bulan berganti, atau sisa data kurang dari 8 hari.
- Gagal: pakai data tersimpan, tampilkan tanda Offline, coba lagi tiap 2 menit dan saat internet kembali.
- Data habis: mode GPS dihitung lokal; mode kota menampilkan error.
