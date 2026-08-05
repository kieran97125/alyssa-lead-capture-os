import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alyssa Growth OS",
  description:
    "Alyssa 多品牌營銷、Lead、預約及客戶營運系統。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant-HK" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
