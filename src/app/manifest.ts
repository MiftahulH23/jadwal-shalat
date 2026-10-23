import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jadwal Shalat",
    short_name: "Jadwal Shalat",
    description: "Jadwal shalat, hitung mundur adzan & iqamah, dan layar masjid. Tetap berjalan saat offline.",
    start_url: "/",
    display: "standalone",
    background_color: "#04110f",
    theme_color: "#047857",
    lang: "id",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
