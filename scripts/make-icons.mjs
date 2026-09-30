// Generuje ikony aplikacji (PWA, iPhone) z logo BeeXchange. Uruchom: node scripts/make-icons.mjs
import sharp from "sharp";

const bee = (scale, cx, cy) => `
  <g transform="translate(${cx} ${cy}) scale(${scale}) rotate(-16)">
    <ellipse cx="-4" cy="-10" rx="7" ry="11" fill="#FFFFFF" stroke="#17140F" stroke-width="2.4" transform="rotate(-32 -4 -10)"/>
    <ellipse cx="0" cy="0" rx="14" ry="9" fill="#FFF7E2" stroke="#17140F" stroke-width="2.6"/>
    <path d="M-5 -8.5 V8.5 M3 -8.8 V8.8" stroke="#17140F" stroke-width="3.6"/>
    <circle cx="14" cy="-1" r="5.6" fill="#17140F"/>
  </g>`;

// Zwykła ikona: pszczoła z przerywaną trasą lotu na żółtym tle
const icon = (size, padding = 0) => {
  const s = size / 64;
  const inner = 1 - padding * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="#FFC52E"/>
    <g transform="translate(${size * padding} ${size * padding}) scale(${inner})">
      <path d="M${10 * s} ${50 * s} Q ${16 * s} ${36 * s} ${26 * s} ${36 * s}" fill="none" stroke="#17140F" stroke-width="${2 * s}" stroke-dasharray="${3 * s} ${4 * s}" stroke-linecap="round"/>
      ${bee(s * 1.05, 36 * s, 30 * s)}
    </g>
  </svg>`;
};

const out = [
  ["public/icons/icon-192.png", icon(192, 0.06)],
  ["public/icons/icon-512.png", icon(512, 0.06)],
  // „maskable”: Android przycina ikonę do koła lub zaokrąglonego kwadratu, więc logo ma margines
  ["public/icons/maskable-512.png", icon(512, 0.18)],
  ["src/app/apple-icon.png", icon(180, 0.08)],
];
for (const [file, svg] of out) {
  await sharp(Buffer.from(svg)).png().toFile(file);
  console.log("✓", file);
}
