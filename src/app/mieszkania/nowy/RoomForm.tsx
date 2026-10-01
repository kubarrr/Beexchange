"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, X } from "lucide-react";
import { createRoom } from "@/app/actions/bx";
import { PhotoCropper } from "@/components/PhotoCropper";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";
import { CURRENCIES, currencyFor } from "@/lib/places";
import { createClient } from "@/lib/supabase/client";

type Place = { cc: string; city: string; label: string };

export function RoomForm({ locale, userId, places, initial }: { locale: Locale; userId: string; places: Place[]; initial: string }) {
  const t = dictionaries[locale];
  const router = useRouter();
  const [place, setPlace] = useState(initial || (places[0] ? `${places[0].cc}:${places[0].city}` : ""));
  const cc = place.split(":")[0];
  const [currency, setCurrency] = useState(currencyFor(cc));
  const [kind, setKind] = useState<"room" | "shared" | "flat">("room");
  const [photos, setPhotos] = useState<string[]>([]);
  const [crop, setCrop] = useState<ImageBitmap | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  async function upload(blob: Blob) {
    setCrop(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const path = `${userId}/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("rooms").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      setPhotos((p) => [...p, supabase.storage.from("rooms").getPublicUrl(path).data.publicUrl]);
    } catch {
      setError(t.profile.photoTooBig);
    } finally {
      setBusy(false);
    }
  }

  function submit(fd: FormData) {
    setError("");
    const [country_code, ...rest] = place.split(":");
    start(async () => {
      const res = await createRoom({
        country_code,
        city: rest.join(":"),
        kind,
        title: String(fd.get("title") ?? ""),
        description: String(fd.get("description") ?? ""),
        price: Number(fd.get("price")),
        currency,
        available_from: String(fd.get("available_from") ?? ""),
        available_to: String(fd.get("available_to") ?? ""),
        area: String(fd.get("area") ?? ""),
        photos,
      });
      if (!res.ok) return setError(res.error);
      router.push(`/mieszkania?cc=${country_code}&city=${encodeURIComponent(rest.join(":"))}&tab=rooms`);
    });
  }

  if (!places.length) return <p className="rounded-2xl bg-sand p-4 text-sm">{t.housing.noCities}</p>;

  return (
    <form action={submit} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="label-caps">{t.housing.fCity}</span>
        <select
          className="field"
          value={place}
          onChange={(e) => {
            setPlace(e.target.value);
            setCurrency(currencyFor(e.target.value.split(":")[0]));
          }}
        >
          {places.map((p) => (
            <option key={`${p.cc}:${p.city}`} value={`${p.cc}:${p.city}`}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="space-y-2">
        <legend className="label-caps">{t.housing.fKind}</legend>
        <div className="flex flex-wrap gap-2">
          {(["room", "shared", "flat"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`chip ${kind === k ? "chip-on" : ""}`}>
              {t.housing.kinds[k]}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block space-y-1.5">
        <span className="label-caps">{t.housing.fTitle}</span>
        <input name="title" required minLength={3} maxLength={120} placeholder={t.housing.fTitlePh} className="field" />
      </label>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <label className="block space-y-1.5">
          <span className="label-caps">{t.housing.fPrice}</span>
          <input name="price" type="number" inputMode="numeric" required min={0} max={100000} className="field" />
        </label>
        <label className="block space-y-1.5">
          <span className="label-caps">{t.housing.fCurrency}</span>
          <select className="field" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1.5">
          <span className="label-caps">{t.housing.fFrom}</span>
          <input name="available_from" type="date" required className="field" />
        </label>
        <label className="block space-y-1.5">
          <span className="label-caps">{t.housing.fTo}</span>
          <input name="available_to" type="date" className="field" />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="label-caps">{t.housing.fArea}</span>
        <input name="area" maxLength={120} placeholder={t.housing.fAreaPh} className="field" />
      </label>

      <div className="space-y-1.5">
        <span className="label-caps">{t.housing.fPhotos}</span>
        <div className="grid grid-cols-2 gap-2">
          {photos.map((src) => (
            <div key={src} className="relative overflow-hidden rounded-2xl border-2 border-ink">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="aspect-[4/3] w-full object-cover" />
              <button type="button" aria-label={t.events.fPhotoRemove} onClick={() => setPhotos((p) => p.filter((x) => x !== src))} className="absolute top-1.5 right-1.5 flex h-9 w-9 items-center justify-center rounded-xl bg-cream">
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
          ))}
          {photos.length < 4 && (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-line bg-white text-sm font-semibold hover:border-ink"
            >
              {busy ? <span className="h-6 w-6 animate-spin rounded-full border-2 border-ink border-t-transparent" /> : <ImagePlus size={24} />}
              {t.events.fPhotoAdd}
            </button>
          )}
        </div>
        <p className="text-xs text-muted">{t.housing.fPhotosHint}</p>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          aria-label={t.events.fPhotoAdd}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            if (f.size > 8 * 1024 * 1024) return setError(t.profile.photoTooBig);
            try {
              setCrop(await createImageBitmap(f));
            } catch {
              setError(t.profile.photoTooBig);
            }
          }}
        />
        {crop && <PhotoCropper locale={locale} bitmap={crop} aspect={4 / 3} outWidth={1200} onCancel={() => setCrop(null)} onDone={upload} />}
      </div>

      <label className="block space-y-1.5">
        <span className="label-caps">{t.housing.fDesc}</span>
        <textarea name="description" rows={5} maxLength={3000} placeholder={t.housing.fDescPh} className="field py-3" />
      </label>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={pending || busy} className="btn-primary min-h-14 w-full text-lg">
        {t.housing.fSubmit}
      </button>
    </form>
  );
}
