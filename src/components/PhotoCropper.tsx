"use client";

import { useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";

const VIEW_W = 280; // szerokość okna kadrowania w px
const MAX_ZOOM = 4;

type Pos = { zoom: number; x: number; y: number };

// Kadrowanie zdjęcia: przesuwanie palcem/myszką, przybliżanie suwakiem, dwoma palcami lub kółkiem.
// aspect = szerokość / wysokość (1 dla zdjęcia profilowego, 16/9 dla wydarzenia)
export function PhotoCropper({
  locale,
  bitmap,
  onCancel,
  onDone,
  aspect = 1,
  outWidth = 512,
}: {
  locale: Locale;
  bitmap: ImageBitmap;
  onCancel: () => void;
  onDone: (blob: Blob) => void;
  aspect?: number;
  outWidth?: number;
}) {
  const t = dictionaries[locale];
  const VIEW_H = Math.round(VIEW_W / aspect);
  const base = Math.max(VIEW_W / bitmap.width, VIEW_H / bitmap.height); // skala, przy której zdjęcie dokładnie wypełnia okno
  const [pos, setPos] = useState<Pos>({ zoom: 1, x: 0, y: 0 });
  const canvas = useRef<HTMLCanvasElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  // Zdjęcie zawsze zakrywa całe okno — przesunięcie ograniczamy do nadmiaru
  const clamp = (p: Pos): Pos => {
    const zoom = Math.min(MAX_ZOOM, Math.max(1, p.zoom));
    const maxX = (bitmap.width * base * zoom - VIEW_W) / 2;
    const maxY = (bitmap.height * base * zoom - VIEW_H) / 2;
    return { zoom, x: Math.min(maxX, Math.max(-maxX, p.x)), y: Math.min(maxY, Math.max(-maxY, p.y)) };
  };
  const update = (fn: (p: Pos) => Pos) => setPos((p) => clamp(fn(p)));

  // Wycinany prostokąt w pikselach oryginału
  const source = (p: Pos) => {
    const scale = base * p.zoom;
    const sw = VIEW_W / scale;
    const sh = VIEW_H / scale;
    return { sx: bitmap.width / 2 - p.x / scale - sw / 2, sy: bitmap.height / 2 - p.y / scale - sh / 2, sw, sh };
  };

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const { sx, sy, sw, sh } = source(pos);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, c.width, c.height);
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const distance = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) pinch.current = { dist: distance(), zoom: pos.zoom };
  }
  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const { dist, zoom } = pinch.current;
      update((p) => ({ ...p, zoom: zoom * (distance() / dist) }));
    } else if (pointers.current.size === 1) {
      update((p) => ({ ...p, x: p.x + e.clientX - prev.x, y: p.y + e.clientY - prev.y }));
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }

  function save() {
    const out = document.createElement("canvas");
    out.width = outWidth;
    out.height = Math.round(outWidth / aspect);
    const { sx, sy, sw, sh } = source(pos);
    out.getContext("2d")!.drawImage(bitmap, sx, sy, sw, sh, 0, 0, out.width, out.height);
    out.toBlob((b) => b && onDone(b), "image/jpeg", 0.86);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={t.profile.cropTitle} className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4">
      <div className="w-full max-w-sm space-y-4 rounded-[28px] bg-cream p-5">
        <div>
          <h2 className="display text-xl">{t.profile.cropTitle}</h2>
          <p className="text-[13px] text-muted">{t.profile.cropHint}</p>
        </div>
        <canvas
          ref={canvas}
          width={VIEW_W * 2}
          height={VIEW_H * 2}
          style={{ width: VIEW_W, height: VIEW_H }}
          className="mx-auto block cursor-grab touch-none rounded-2xl border-[3px] border-ink bg-ink-soft active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={(e) => update((p) => ({ ...p, zoom: p.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08) }))}
        />
        <label className="flex items-center gap-3">
          <ZoomOut size={18} className="shrink-0" aria-hidden="true" />
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={pos.zoom}
            aria-label={t.profile.zoom}
            onChange={(e) => update((p) => ({ ...p, zoom: Number(e.target.value) }))}
            className="w-full accent-ink"
          />
          <ZoomIn size={18} className="shrink-0" aria-hidden="true" />
        </label>
        <div className="flex gap-2.5">
          <button type="button" onClick={onCancel} className="btn-outline min-h-12 flex-1">
            {t.common.cancel}
          </button>
          <button type="button" onClick={save} className="btn-primary min-h-12 flex-1">
            {t.common.save}
          </button>
        </div>
      </div>
    </div>
  );
}
