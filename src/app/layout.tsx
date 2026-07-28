import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alyssa Growth OS",
  description:
    "Marketing Command Center for multi-brand growth, lead operations and campaign execution.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant-HK" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
