import type { Metadata } from "next";

import { MonthlySchedule } from "@/components/prayer/monthly-schedule";

export const metadata: Metadata = {
  title: "Jadwal Shalat Bulanan",
  description: "Jadwal shalat sebulan penuh, bisa dicetak atau diunduh sebagai PDF dan CSV.",
};

export default function MonthlyPage() {
  return <MonthlySchedule />;
}
