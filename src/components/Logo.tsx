// Logo BeErasm (wariant B: pszczoła na przerywanej trasie lotu)

export function BeeMark({ size = 40, body = "#FFC52E" }: { size?: number; body?: string }) {
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 74 60" aria-hidden="true">
      <g transform="translate(36 34) rotate(-16)">
        <ellipse cx="-4" cy="-10" rx="7" ry="11" fill="#FFFFFF" stroke="#17140F" strokeWidth="2.4" transform="rotate(-32 -4 -10)" />
        <ellipse cx="0" cy="0" rx="14" ry="9" fill={body} stroke="#17140F" strokeWidth="2.6" />
        <path d="M-5 -8.5 V8.5 M3 -8.8 V8.8" stroke="#17140F" strokeWidth="3.6" />
        <circle cx="14" cy="-1" r="5.6" fill="#17140F" />
      </g>
    </svg>
  );
}

export function Wordmark({ className = "text-[22px]" }: { className?: string }) {
  return (
    <span className={`display whitespace-nowrap ${className}`}>
      <span className="mr-px rounded-md bg-honey px-1.5">Be</span>Erasm
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={`flex items-center gap-1 ${className ?? ""}`}>
      <BeeMark size={38} />
      <Wordmark />
    </span>
  );
}

// Duża wersja z trasą lotu (strona startowa, logowanie)
export function LogoHero() {
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 400 84" className="h-auto w-full max-w-[340px]" aria-hidden="true">
        <path d="M10 74 C 90 74, 150 20, 250 44 S 330 40, 344 30" fill="none" stroke="#17140F" strokeWidth="2.6" strokeDasharray="6 7" strokeLinecap="round" />
        <g transform="translate(368 26) rotate(-16)">
          <ellipse cx="-4" cy="-10" rx="7" ry="11" fill="#FFFFFF" stroke="#17140F" strokeWidth="2.4" transform="rotate(-32 -4 -10)" />
          <ellipse cx="0" cy="0" rx="14" ry="9" fill="#FFF7E2" stroke="#17140F" strokeWidth="2.6" />
          <path d="M-5 -8.5 V8.5 M3 -8.8 V8.8" stroke="#17140F" strokeWidth="3.6" />
          <circle cx="14" cy="-1" r="5.6" fill="#17140F" />
        </g>
      </svg>
    </div>
  );
}
