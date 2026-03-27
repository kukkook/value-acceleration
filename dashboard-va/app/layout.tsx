import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TMMA VA KPI Dashboard",
  description: "Next.js + Tailwind rebuild of the TMMA VA KPI dashboard mockup."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
