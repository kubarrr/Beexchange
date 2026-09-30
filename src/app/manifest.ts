import type { MetadataRoute } from "next";

// Pozwala zainstalować BeeXchange na telefonie („Dodaj do ekranu głównego”)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BeeXchange: exchange together",
    short_name: "BeeXchange",
    description: "Znajdź ludzi, którzy lecą na wymianę tam, gdzie Ty.",
    start_url: "/roj",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFF7E2",
    theme_color: "#FFC52E",
    lang: "pl",
    categories: ["education", "social"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
