import type { CSSProperties } from "react";

// Tło wersji prostej: duże plastry miodu na żółtym tle i latające pszczółki.
// Delikatne i wolne, zawsze za treścią; przy „ogranicz ruch” w systemie stoi (globals.css).
function Bee({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 30 24" aria-hidden="true">
      <g className="bee-wings">
        <ellipse cx="12" cy="6" rx="6" ry="4.5" fill="#fff" fillOpacity="0.85" stroke="#17140f" strokeOpacity="0.35" />
        <ellipse cx="18" cy="5.5" rx="5" ry="4" fill="#fff" fillOpacity="0.85" stroke="#17140f" strokeOpacity="0.35" />
      </g>
      <ellipse cx="15" cy="15" rx="10" ry="7" fill="#ffc52e" stroke="#17140f" strokeWidth="1.5" />
      <path d="M12 8.6v12.8M17 8.4v13.2" stroke="#17140f" strokeWidth="2.4" />
      <circle cx="23.5" cy="13.5" r="1.3" fill="#17140f" />
      <path d="M5 15l-2.5 1" stroke="#17140f" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// Tor lotu pszczoły: wysokość (% ekranu), czas przelotu, opóźnienie, kierunek, wielkość
type Flight = { y: number; dur: number; delay: number; rtl?: boolean; size?: number };
function Bees({ flights }: { flights: Flight[] }) {
  return (
    <>
      {flights.map((f, i) => (
        <span key={i} className={`bee-flight ${f.rtl ? "bee-rtl" : ""}`} style={{ top: `${f.y}%`, animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s` } as CSSProperties}>
          <span className="bee-bob" style={{ animationDelay: `${i * 0.7}s` }}>
            <span className={f.rtl ? "inline-block -scale-x-100" : "inline-block"}>
              <Bee size={f.size} />
            </span>
          </span>
        </span>
      ))}
    </>
  );
}

// Same sześciokąty jak w plastrze miodu (bez dodatkowych linii), jeden kolor
function HexCells() {
  // Duże komórki (ok. 3 na ekranie telefonu), bardzo jasne krawędzie, żeby nie konkurowały z tekstem
  const r = 175;
  const w = Math.sqrt(3) * r;
  const hex = (cx: number, cy: number) =>
    [-90, -30, 30, 90, 150, 210].map((a) => `${(cx + r * Math.cos((a * Math.PI) / 180)).toFixed(2)},${(cy + r * Math.sin((a * Math.PI) / 180)).toFixed(2)}`).join(" ");
  const centers = [
    [0, 0],
    [w, 0],
    [w / 2, 1.5 * r],
    [0, 3 * r],
    [w, 3 * r],
  ];
  return (
    <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <pattern id="hex-cells" width={w} height={3 * r} patternUnits="userSpaceOnUse">
          {centers.map(([x, y], i) => (
            <polygon key={i} points={hex(x, y)} fill="none" stroke="#e0a200" strokeOpacity="0.16" strokeWidth="5" strokeLinejoin="round" />
          ))}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hex-cells)" />
    </svg>
  );
}

export function HiveBackground() {
  return (
    <div aria-hidden="true" className="section-bg pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[#ffefb0]" />
      <HexCells />
      <Bees
        flights={[
          { y: 12, dur: 34, delay: -4 },
          { y: 26, dur: 41, delay: -20, rtl: true, size: 18 },
          { y: 40, dur: 29, delay: -11 },
          { y: 55, dur: 46, delay: -30, rtl: true },
          { y: 68, dur: 37, delay: -2, size: 18 },
          { y: 82, dur: 52, delay: -26, rtl: true, size: 26 },
        ]}
      />
    </div>
  );
}
