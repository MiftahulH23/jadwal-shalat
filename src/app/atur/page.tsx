import type { Metadata } from "next"

import { AturPage } from "@/components/prayer/atur-page"

export const metadata: Metadata = {
  title: "Atur Layar Masjid · Jadwal Shalat",
  description: "Mengatur layar TV masjid dari HP.",
  // Links to this page carry secret keys; it is never meant to be found by search engines.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

export default function Page() {
  return <AturPage />
}
