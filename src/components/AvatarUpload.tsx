"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";

// Zmniejsza zdjęcie do kwadratu 512×512 (JPEG), żeby oszczędzać miejsce i transfer
async function toSquareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 512, 512);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.86));
}

export function AvatarUpload({
  locale,
  userId,
  name,
  url,
  onChange,
  size = 118,
}: {
  locale: Locale;
  userId: string;
  name: string;
  url: string | null;
  onChange: (url: string) => void;
  size?: number;
}) {
  const t = dictionaries[locale];
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setError("");
    if (file.size > 8 * 1024 * 1024) {
      setError(t.profile.photoTooBig);
      return;
    }
    setBusy(true);
    try {
      const blob = await toSquareJpeg(file);
      const supabase = createClient();
      const path = `${userId}/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (error) throw error;
      onChange(supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl);
    } catch {
      setError(t.profile.photoTooBig);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <div className="h-full w-full overflow-hidden rounded-2xl border-[3px] border-ink bg-ink-soft">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={name} className="h-full w-full object-cover" />
          ) : (
            <svg viewBox="0 0 118 118" className="h-full w-full" aria-hidden="true">
              <circle cx="59" cy="48" r="22" fill="#FFC52E" />
              <path d="M16 118c4-26 21-40 43-40s39 14 43 40z" fill="#FFC52E" />
            </svg>
          )}
        </div>
        <button
          type="button"
          onClick={() => input.current?.click()}
          aria-label={t.profile.changePhoto}
          className="absolute -right-1.5 -bottom-1.5 flex h-11 w-11 items-center justify-center rounded-2xl border-[3px] border-cream bg-honey"
        >
          {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent" /> : <Camera size={20} strokeWidth={2.3} />}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
