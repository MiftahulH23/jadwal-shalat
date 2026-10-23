import type { Metadata } from "next";

import { MosqueDisplay } from "@/components/prayer/mosque-display";

export const metadata: Metadata = {
  title: "Layar Masjid · Jadwal Shalat",
  description: "Tampilan layar penuh jadwal shalat, hitung mundur adzan dan iqamah untuk TV masjid.",
};

export default function MosqueDisplayPage() {
  return <MosqueDisplay />;
}
