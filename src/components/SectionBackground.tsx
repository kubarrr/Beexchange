"use client";

import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";

// Ruchome tła zakładek: delikatne, wolne i zawsze za treścią (nie da się ich kliknąć).
// Przy „ogranicz ruch” w systemie animacje stoją (globals.css).
type Variant = "hive" | "meadow" | "honeycomb" | "flowers" | null;

function variantFor(path: string): Variant {
  if (path.startsWith("/swarm") || path === "/groups") return "hive";
  if (path.startsWith("/people") || path.startsWith("/u/")) return "meadow";
  if (path.startsWith("/housing")) return "honeycomb";
  if (path.startsWith("/events")) return "flowers";
  return null;
}

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
        <span
          key={i}
          className={`bee-flight ${f.rtl ? "bee-rtl" : ""}`}
          style={{ top: `${f.y}%`, animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s` } as CSSProperties}
        >
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
  const r = 22;
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
            <polygon key={i} points={hex(x, y)} fill="none" stroke="#e0a200" strokeOpacity="0.4" strokeWidth="2" />
          ))}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hex-cells)" />
    </svg>
  );
}

function Grass({ flowers = false }: { flowers?: boolean }) {
  const blooms = [
    { x: 6, y: 78, c: "#f7a8c8" },
    { x: 15, y: 88, c: "#ffffff" },
    { x: 24, y: 82, c: "#c9a7f2" },
    { x: 33, y: 91, c: "#ffb070" },
    { x: 42, y: 80, c: "#ff8a8a" },
    { x: 51, y: 89, c: "#ffffff" },
    { x: 60, y: 83, c: "#f7a8c8" },
    { x: 69, y: 92, c: "#c9a7f2" },
    { x: 78, y: 79, c: "#ffb070" },
    { x: 87, y: 88, c: "#ff8a8a" },
    { x: 95, y: 81, c: "#ffffff" },
    { x: 10, y: 66, c: "#c9a7f2" },
    { x: 47, y: 70, c: "#f7a8c8" },
    { x: 82, y: 68, c: "#ffffff" },
  ];
  return (
    <>
      <svg className="absolute inset-x-0 bottom-0 h-[38%] w-full" viewBox="0 0 400 160" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 70 Q50 40 100 62 T200 58 T300 64 T400 52 V160 H0Z" fill="#cfe6b0" />
        <path d="M0 100 Q60 78 120 96 T240 92 T400 86 V160 H0Z" fill="#b8da93" />
      </svg>
      {flowers &&
        blooms.map((b, i) => (
          <svg
            key={i}
            className="flower-sway absolute"
            style={{ left: `${b.x}%`, top: `${b.y}%`, animationDelay: `${(i % 5) * 0.8}s` }}
            width="26"
            height="40"
            viewBox="0 0 26 40"
            aria-hidden="true"
          >
            <path d="M13 16 V40" stroke="#6fa04a" strokeWidth="2" />
            {[0, 72, 144, 216, 288].map((a) => (
              <ellipse key={a} cx="13" cy="7" rx="4" ry="6.5" fill={b.c} stroke="#17140f" strokeOpacity="0.15" transform={`rotate(${a} 13 13)`} />
            ))}
            <circle cx="13" cy="13" r="3.6" fill="#ffc52e" />
          </svg>
        ))}
    </>
  );
}

export function SectionBackground() {
  const variant = variantFor(usePathname());
  if (!variant) return null;
  return (
    <div aria-hidden="true" className="section-bg pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {variant === "hive" && (
        <>
          <div className="absolute inset-0 bg-[#fff4cf]" />
          <HexCells />
          <Bees
            flights={[
              { y: 14, dur: 34, delay: -4 },
              { y: 31, dur: 41, delay: -20, rtl: true, size: 18 },
              { y: 48, dur: 29, delay: -11 },
              { y: 63, dur: 46, delay: -30, rtl: true },
              { y: 77, dur: 37, delay: -2, size: 18 },
              { y: 88, dur: 52, delay: -26, rtl: true, size: 26 },
            ]}
          />
        </>
      )}
      {variant === "meadow" && (
        <>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,#f6faec_0%,#e6f2d3_70%,#d5eabd_100%)]" />
          <Grass />
          <Bees
            flights={[
              { y: 18, dur: 38, delay: -6 },
              { y: 39, dur: 45, delay: -24, rtl: true, size: 18 },
              { y: 57, dur: 33, delay: -14 },
              { y: 72, dur: 50, delay: -33, rtl: true },
            ]}
          />
        </>
      )}
      {variant === "honeycomb" && (
        <>
          <div className="absolute inset-0 bg-[#fff4cf]" />
          <HexCells />
        </>
      )}
      {variant === "flowers" && (
        <>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,#f8fbef_0%,#eaf4da_65%,#d5eabd_100%)]" />
          <Grass flowers />
          <Bees
            flights={[
              { y: 10, dur: 31, delay: -3 },
              { y: 22, dur: 44, delay: -19, rtl: true, size: 18 },
              { y: 35, dur: 27, delay: -9 },
              { y: 46, dur: 49, delay: -28, rtl: true },
              { y: 58, dur: 36, delay: -15, size: 18 },
              { y: 68, dur: 40, delay: -34, rtl: true, size: 26 },
              { y: 76, dur: 30, delay: -21 },
              { y: 84, dur: 55, delay: -40, rtl: true, size: 18 },
            ]}
          />
          <span className="bear-walk absolute bottom-[7%] text-[34px]" style={{ animationDelay: "-12s" }}>
            🐻
          </span>
          <span className="bear-walk bear-rtl absolute bottom-[16%] text-[28px]" style={{ animationDelay: "-48s" }}>
            <span className="inline-block -scale-x-100">🐻</span>
          </span>
          <span className="absolute right-[8%] bottom-[22%] text-[26px] opacity-90">🍯</span>
        </>
      )}
    </div>
  );
}
