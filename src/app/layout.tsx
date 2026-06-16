import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LaunchHub",
  description: "Campaign Launch OS for lead capture, campaign pages, and source attribution.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant-HK" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
