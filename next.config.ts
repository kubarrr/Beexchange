import type { NextConfig } from "next";

// Wersja prosta: wszystkie podstrony pełnej aplikacji (także stare polskie adresy) prowadzą do wyszukiwarki
const OLD_ROUTES = [
  "/swarm", "/people", "/housing/:path*", "/events/:path*", "/chats", "/messages/:path*", "/groups/:path*", "/profile", "/onboarding", "/u/:id",
  "/roj", "/ludzie", "/mieszkania/:path*", "/wydarzenia/:path*", "/czaty", "/wiadomosci/:path*", "/grupy/:path*", "/profil",
  "/regulamin", "/prywatnosc",
];

const nextConfig: NextConfig = {
  async redirects() {
    return OLD_ROUTES.map((source) => ({
      source,
      destination: source === "/regulamin" ? "/terms" : source === "/prywatnosc" ? "/privacy" : source === "/profile" || source === "/profil" ? "/me" : "/",
      permanent: false,
    }));
  },
};

export default nextConfig;
