import type { NextConfig } from "next";

// Stare polskie adresy (np. z linków w mailach i zakładek) prowadzą do nowych, angielskich
const OLD_ROUTES: [string, string][] = [
  ["/roj", "/swarm"],
  ["/ludzie", "/people"],
  ["/mieszkania/nowy", "/housing/new"],
  ["/mieszkania", "/housing"],
  ["/wydarzenia/nowe", "/events/new"],
  ["/wydarzenia", "/events"],
  ["/czaty", "/chats"],
  ["/wiadomosci/:id", "/messages/:id"],
  ["/grupy/:id", "/groups/:id"],
  ["/grupy", "/groups"],
  ["/profil", "/profile"],
  ["/regulamin", "/terms"],
  ["/prywatnosc", "/privacy"],
];

const nextConfig: NextConfig = {
  async redirects() {
    return OLD_ROUTES.map(([source, destination]) => ({ source, destination, permanent: true }));
  },
};

export default nextConfig;
