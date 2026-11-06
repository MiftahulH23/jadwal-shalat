import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

export const metadata: Metadata = {
  title: "Privasi · Jadwal Shalat",
  description: "Data apa yang disimpan Jadwal Shalat, di mana, dan cara menghapusnya.",
}

const REPO = "https://github.com/MiftahulH23/jadwal-shalat"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground [&_strong]:text-foreground">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-8 px-4 py-10">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Halaman utama
      </Link>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Privasi</h1>
        <p className="text-sm text-muted-foreground">
          Jadwal Shalat bisa dipakai tanpa akun. Halaman ini menjelaskan data apa yang disimpan, di mana, dan cara
          menghapusnya.
        </p>
      </div>

      <Section title="Tanpa fitur Atur dari HP">
        <p>
          Semua pengaturan (kota, iqamah, koreksi, petugas, kas, pengajian, foto latar) disimpan{" "}
          <strong>hanya di browser perangkat Anda</strong> dan tidak dikirim ke server kami. Menghapus data browser
          berarti menghapus pengaturan itu.
        </p>
        <p>Untuk menampilkan jadwal, website ini memakai layanan berikut:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>API myQuran</strong> (jadwal resmi Kemenag): menerima kota yang dipilih.
          </li>
          <li>
            <strong>Open-Meteo</strong>: kalau Anda memakai lokasi GPS, menerima titik lokasi yang dibulatkan sampai
            sekitar 100 meter, untuk mengetahui ketinggian tempat supaya waktu terbit dan maghrib lebih tepat.
          </li>
          <li>
            <strong>BigDataCloud</strong>: menerima titik lokasi saat Anda menekan &quot;Gunakan lokasi saya&quot;,
            untuk mengetahui nama kota dan kecamatan.
          </li>
        </ul>
        <p>
          Waktu shalat untuk titik GPS dihitung di server kami. Titik itu dibulatkan, tidak dicatat di database, dan
          hanya tersimpan sementara di cache server supaya jadwal cepat dimuat.
        </p>
      </Section>

      <Section title="Dengan fitur Atur dari HP">
        <p>
          Fitur ini pilihan. Kalau sebuah layar masjid dihubungkan ke HP, data masjid itu disimpan di server (layanan{" "}
          <strong>Supabase</strong>) supaya bisa diubah dari HP:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Kota atau titik lokasi masjid, nama dan alamat masjid, teks berjalan.</li>
          <li>Jadwal iqamah, koreksi waktu, dan pengaturan layar.</li>
          <li>Nama khatib, imam, muadzin, dan ustadz pengajian yang diisi pengurus.</li>
          <li>Laporan kas yang diisi pengurus.</li>
          <li>Foto latar layar, kalau dipasang.</li>
          <li>Nama yang diisi pengurus untuk HP-nya, misalnya &quot;Pak Ahmad&quot;.</li>
          <li>5 versi pengaturan terakhir, untuk fitur riwayat.</li>
          <li>Kapan TV terakhir terhubung, dicatat paling sering sekali sejam.</li>
        </ul>
        <p>
          Kunci akses HP dan TV <strong>tidak disimpan</strong>, hanya sidik digitalnya (hash), sehingga data di server
          tidak bisa dipakai untuk masuk. Untuk membatasi penyalahgunaan, alamat IP disimpan dalam bentuk hash selama
          paling lama sehari.
        </p>
      </Section>

      <Section title="Siapa yang bisa melihat">
        <ul className="list-disc space-y-1 pl-5">
          <li>HP pengurus yang terhubung dan TV masjid itu sendiri.</li>
          <li>
            Foto latar tersimpan di alamat acak yang tidak bisa ditebak. Siapa pun yang memegang alamat itu bisa
            melihat fotonya, sama seperti siapa pun yang melihat layar di masjid.
          </li>
          <li>
            Pengelola website ini secara teknis bisa membuka database. Data tidak dijual, tidak dipakai untuk iklan,
            dan tidak diberikan kepada pihak lain.
          </li>
        </ul>
      </Section>

      <Section title="Menghapus data">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Pengelola utama bisa menghapus semua data masjid dari server kapan saja: di halaman Atur dari HP, pilih{" "}
            <strong>Hapus data masjid</strong>. Foto dan riwayat ikut terhapus.
          </li>
          <li>Masjid yang 12 bulan tidak dibuka dari TV maupun HP dihapus otomatis, beserta fotonya.</li>
          <li>Sambungan TV yang 60 hari tidak aktif, misalnya TV yang sudah diganti, dilepas otomatis.</li>
          <li>Foto yang dihapus bisa masih tersimpan sebentar di cache jaringan pengiriman (CDN) sebelum hilang.</li>
        </ul>
      </Section>

      <Section title="Pertanyaan">
        <p>
          Ada pertanyaan atau ingin datanya dihapus? Sampaikan lewat{" "}
          <a href={`${REPO}/issues`} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
            halaman GitHub proyek ini
          </a>
          .
        </p>
      </Section>
    </main>
  )
}
