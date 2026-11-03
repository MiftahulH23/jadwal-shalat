# Keputusan

Keputusan pemilik proyek dan alasannya. Jangan membaliknya tanpa bertanya.

| Keputusan | Alasan |
|---|---|
| Tanpa database dan akun | Keinginan pemilik. Pengaturan per perangkat; dipindahkan lewat kode/file cadangan. Akibatnya TV tidak bisa diatur dari HP |
| Pilihan manual sampai kota; "Gunakan lokasi saya" sampai kecamatan | Kemenag hanya menyediakan data per kota |
| API cukup sekali sebulan | Masjid bisa saja hanya online di awal bulan |
| Bip "tit-tit-tit", bukan lonceng atau suara adzan | Masjid sudah punya muadzin |
| Bip simulasi mengikuti ikon bel | Permintaan eksplisit pemilik |
| Teks "Ibadah Shalat Jumat sedang berlangsung" | Pilihan kata pemilik, satu layar dari khutbah sampai shalat selesai |
| Pop-up dan bunyi 5 detik | Permintaan pemilik |
| Panel simulasi tersembunyi secara default | Situs sudah publik; hanya untuk pengurus |
| Pengajian tunggal atau item ganjil terakhir selebar penuh | Permintaan pemilik |
| Baris tanggal harian 7 kolom selebar penuh | Permintaan pemilik |
| Kode dihitung sendiri (`astronomy.ts`), bukan library `adhan` | Butuh koreksi ketinggian dan parameter Kemenag; library tidak menyediakannya |
| Jam dikoreksi otomatis ke jam server | Laptop pemilik tertinggal beberapa detik dari HP; adzan ikut terlambat |
| Foto latar disimpan di browser (IndexedDB), bukan diunggah | Tetap tanpa database dan biaya, bisa offline. Akibatnya dipasang per perangkat |
| Penyiapan awal `/layar` tidak bisa dilewati tanpa memilih kota, tetapi tidak muncul kalau nama masjid sudah ada | Waktu kota lain di layar masjid adalah kesalahan paling fatal, sedangkan TV yang sedang dipakai tidak boleh tertutup setelah dimuat ulang |
| Foto hanya di `/layar`, layar shalat dan Jumat lebih gelap, layar malam tetap hitam | Pilihan pemilik: jamaah di HP tidak terganggu dan tidak mengganggu kekhusyukan |
| Pengaturan tetap memakai tombol Simpan, dengan peringatan saat menutup yang punya tombol Simpan | Pemilik sering lupa menyimpan dan memilih ini daripada simpan otomatis |
| Slide dihitung dari jam, bukan timer | Beberapa layar tetap serempak dan tidak perlu state |

## Preferensi kerja pemilik

- Melaporkan masalah tampilan lewat screenshot, sering pada layar 1763×844.
- Memilih commit tanpa atribusi Claude; melakukan push sendiri.
- Node 22.23.2+ (disarankan 24 LTS).

## Keamanan dependensi

`npm audit --omit=dev` harus bersih. Peringatan `braces` hanya di alat pengembangan dan belum ada versi perbaikan. Jangan menjalankan `npm audit fix --force`: itu menurunkan shadcn.
