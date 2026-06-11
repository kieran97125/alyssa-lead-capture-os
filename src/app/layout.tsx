import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alyssa Lead Capture OS",
  description: "Alyssa attribution-ready lead capture and source snapshot layer.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant-HK">
      <body>{children}</body>
    </html>
  );
}
