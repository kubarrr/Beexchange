"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { PhotoCropper } from "@/components/PhotoCropper";
import { createClient } from "@/lib/supabase/client";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";

// Zdjęcie wydarzenia 16:9: wybór, kadrowanie i wysyłka do Storage; adres trafia do formularza w polu cover_url
export function EventPhoto({ locale, userId }: { locale: Locale; userId: string }) {
  const t = dictionaries[locale];
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [crop, setCrop] = useState<ImageBitmap | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pick(file: File) {
    setError("");
    if (file.size > 8 * 1024 * 1024) return setError(t.profile.photoTooBig);
    try {
      setCrop(await createImageBitmap(file));
    } catch {
      setError(t.profile.photoTooBig);
    }
  }

  async function upload(blob: Blob) {
    setCrop(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const path = `${userId}/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("events").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      setUrl(supabase.storage.from("events").getPublicUrl(path).data.publicUrl);
    } catch {
      setError(t.profile.photoTooBig);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <span className="label-caps">{t.events.fPhoto}</span>
      <input type="hidden" name="cover_url" value={url} />
      {url ? (
        <div className="relative overflow-hidden rounded-2xl border-[3px] border-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="aspect-video w-full object-cover" />
          <button type="button" onClick={() => setUrl("")} aria-label={t.events.fPhotoRemove} className="absolute top-2 right-2 flex h-10 w-10 items-center justify-center rounded-xl bg-cream">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-white font-semibold hover:border-ink"
        >
          {busy ? <span className="h-6 w-6 animate-spin rounded-full border-2 border-ink border-t-transparent" /> : <ImagePlus size={28} />}
          {t.events.fPhotoAdd}
        </button>
      )}
      <p className="text-xs text-muted">{t.events.fPhotoHint}</p>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label={t.events.fPhotoAdd}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f);
          e.target.value = "";
        }}
      />
      {crop && <PhotoCropper locale={locale} bitmap={crop} aspect={16 / 9} outWidth={1200} onCancel={() => setCrop(null)} onDone={upload} />}
    </div>
  );
}
