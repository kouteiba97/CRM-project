import type { MetadataRoute } from "next";

/** Installable app (Add to Home screen / Install app): opens full-screen on the dashboard. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Apex CRM",
    short_name: "Apex CRM",
    description: "Clients, sales, projects, invoices and payments — in English, French and Arabic.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f3f7f8",
    theme_color: "#1f7a6d",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
