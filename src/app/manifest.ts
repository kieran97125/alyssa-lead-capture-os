import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Alyssa Growth OS",
    short_name: "Growth OS",
    description: "多品牌營銷、Lead、預約及客戶營運系統。",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#fbf7f5",
    theme_color: "#5a2348",
    icons: [
      {
        src: "/icons/growth-os-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/growth-os-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/growth-os-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
