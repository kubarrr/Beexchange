// Zdjęcia miast z Wikimedia Commons (zdjęcie miasta z Wikidaty, właściwość P18) do Storage „places”
// i tabeli place_photos, razem z autorem i licencją do podpisu pod zdjęciem.
// Przyjmujemy tylko licencje pozwalające na użycie komercyjne: CC0, domena publiczna, CC BY, CC BY-SA.
// Uruchom: npm run import:places            (miasta z bazy + popularne kierunki Erasmusa)
//          npm run import:places -- --force (pobierz ponownie także te, które już są)
//          npm run import:places -- --only=Amsterdam,Poznan
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const FORCE = process.argv.includes("--force");
// --only=Amsterdam,Poznan: pobierz ponownie tylko te miasta
const ONLY = (process.argv.find((a) => a.startsWith("--only="))?.slice(7) ?? "").split(",").filter(Boolean);
// Wikimedia wymaga opisowego User-Agenta z kontaktem
const UA = "BeeXchange/1.0 (https://beexchange.vercel.app; beeexchangeapp@gmail.com)";

// Popularne miasta wymian (nazwy jak w rejestrze uczelni ROR)
const POPULAR = [
  ["IT", "Milan"], ["IT", "Rome"], ["IT", "Bologna"], ["IT", "Turin"], ["IT", "Florence"], ["IT", "Padua"],
  ["ES", "Barcelona"], ["ES", "Madrid"], ["ES", "Valencia"], ["ES", "Seville"], ["ES", "Granada"],
  ["PT", "Lisbon"], ["PT", "Porto"], ["FR", "Paris"], ["FR", "Lyon"], ["DE", "Berlin"], ["DE", "Munich"],
  ["AT", "Vienna"], ["CZ", "Prague"], ["NL", "Amsterdam"], ["NL", "Rotterdam"], ["BE", "Brussels"], ["BE", "Leuven"],
  ["DK", "Copenhagen"], ["SE", "Stockholm"], ["FI", "Helsinki"], ["NO", "Oslo"], ["IE", "Dublin"], ["HU", "Budapest"],
  ["GR", "Athens"], ["TR", "Istanbul"], ["CH", "Zurich"], ["SI", "Ljubljana"], ["HR", "Zagreb"], ["EE", "Tallinn"],
  ["LV", "Riga"], ["LT", "Vilnius"], ["PL", "Warsaw"], ["PL", "Krakow"], ["PL", "Wroclaw"], ["PL", "Gdansk"], ["PL", "Poznan"], ["PL", "Lodz"],
];

async function citiesInUse() {
  const out = new Map(POPULAR.map(([cc, city]) => [`${cc}:${city}`, { cc, city }]));
  const add = (cc, city) => cc && city && out.set(`${cc}:${city}`, { cc, city });
  for (const table of ["exchanges", "profile_homes"]) {
    const { data } = await admin.from(table).select("institutions(city, country_code)").limit(5000);
    for (const r of data ?? []) add(r.institutions?.country_code, r.institutions?.city);
  }
  const { data: ev } = await admin.from("events").select("city, country_code").not("city", "is", null);
  for (const r of ev ?? []) add(r.country_code, r.city);
  // Grupy „Alumni · miasto” mają kraj wymiany i miasto absolwentów — to nie jest jedno miejsce
  const { data: gr } = await admin.from("groups").select("city, country_code, kind").not("city", "is", null).neq("kind", "alumni_local");
  for (const r of gr ?? []) add(r.country_code, r.city);
  return [...out.values()];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Wikidata bywa przeciążona (504) — ponawiamy z rosnącą przerwą, każde zapytanie maks. 25 s
const getJson = async (url, tries = 3) => {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(25_000) });
      if (res.ok) return res.json();
      if (i >= tries || res.status < 500) throw new Error(`HTTP ${res.status} ${url.slice(0, 60)}`);
    } catch (e) {
      if (i >= tries) throw e;
    }
    await sleep(2000 * i);
  }
};

// Niektóre miasta mają w Wikidacie jako państwo „królestwo”, a nie kraj z kodem ISO
const EXTRA_COUNTRY = { NL: ["Q29999"], DK: ["Q756617"], GB: ["Q174193"] };
const countryIds = new Map();
async function countryQ(cc) {
  if (!countryIds.has(cc)) {
    const json = await getJson(`https://www.wikidata.org/w/api.php?action=query&list=search&format=json&srlimit=1&srsearch=${encodeURIComponent(`haswbstatement:P297=${cc}`)}`);
    countryIds.set(cc, [json.query.search[0]?.title, ...(EXTRA_COUNTRY[cc] ?? [])].filter(Boolean));
  }
  return countryIds.get(cc);
}

const norm = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ł/gi, "l").toLowerCase().trim();
// Zdjęcia satelitarne, mapy i herby nie nadają się na zdjęcie miasta
const NOT_A_PHOTO = /sentinel|satellite|copernicus|landsat|\bmap\b|locator|location|flag|coat[_ ]of[_ ]arms|herb|wappen|\.svg$/i;

// Miasto o dokładnie tej nazwie w danym kraju (najludniejsze, jeśli jest kilka): zdjęcie z Wikidaty (P18),
// a gdy go brak albo to np. zdjęcie satelitarne, zdjęcie z hasła w angielskiej Wikipedii
async function wikidataImage(cc, city) {
  const allowed = await countryQ(cc);
  const found = await getJson(`https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&limit=10&search=${encodeURIComponent(city)}`);
  const ids = found.search.filter((r) => [r.label, r.match?.text].some((x) => x && norm(x) === norm(city))).map((r) => r.id);
  if (!ids.length) return null;
  const { entities } = await getJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims|sitelinks&sitefilter=enwiki&ids=${ids.join("|")}`);
  const val = (claims, p) => (claims[p] ?? []).map((c) => c.mainsnak?.datavalue?.value).filter(Boolean);
  const place = ids
    .map((id) => entities[id])
    .filter((e) => e && val(e.claims ?? {}, "P17").some((v) => allowed.includes(v.id)))
    .map((e) => ({ img: val(e.claims, "P18")[0], wiki: e.sitelinks?.enwiki?.title, pop: Math.max(0, ...val(e.claims, "P1082").map((v) => Number(v.amount) || 0)) }))
    .sort((a, b) => b.pop - a.pop)[0];
  if (!place) return null;
  if (place.img && !NOT_A_PHOTO.test(place.img)) return place.img;
  if (!place.wiki) return null;
  const json = await getJson(`https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=name&format=json&titles=${encodeURIComponent(place.wiki)}`);
  const lead = Object.values(json.query.pages)[0]?.pageimage;
  return lead && !NOT_A_PHOTO.test(lead) ? lead.replace(/_/g, " ") : null;
}

const stripHtml = (html) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, " ").trim();
// „Attribution” to licencja Commons wymagająca tylko podania autora
const LICENSE_OK = (l) => /^(cc0|public domain|pd|attribution$|cc by(-sa)? [\d.]+)/i.test(l) && !/nc|nd/i.test(l);

async function commonsInfo(file) {
  const json = await getJson(
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=1400&titles=${encodeURIComponent(`File:${file}`)}`,
  );
  const info = Object.values(json.query.pages)[0]?.imageinfo?.[0];
  if (!info) return null;
  const meta = info.extmetadata ?? {};
  return {
    mime: info.mime,
    thumb: info.thumburl ?? info.url,
    source: info.descriptionurl,
    license: meta.LicenseShortName?.value ?? "",
    author: stripHtml(meta.Artist?.value ?? "").slice(0, 120) || "Wikimedia Commons",
  };
}

const slug = (s) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/Ł/g, "L").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const { data: existing, error: exErr } = await admin.from("place_photos").select("country_code, city");
if (exErr) {
  console.error(`❌ Brak tabeli place_photos — uruchom najpierw migrację 0008_photos.sql (${exErr.message})`);
  process.exit(1);
}
const have = new Set((existing ?? []).map((r) => `${r.country_code}:${r.city}`));
const cities = (await citiesInUse()).filter((c) => (ONLY.length ? ONLY.includes(c.city) : FORCE || !have.has(`${c.cc}:${c.city}`)));
console.log(`Miast do pobrania: ${cities.length}`);

let ok = 0;
for (const { cc, city } of cities) {
  try {
    const file = await wikidataImage(cc, city);
    if (!file) {
      console.log(`·  ${cc} ${city}: brak zdjęcia w Wikidacie`);
      continue;
    }
    const info = await commonsInfo(file);
    if (!info || !/jpeg|png/.test(info.mime)) {
      console.log(`·  ${cc} ${city}: zdjęcie nie jest fotografią (${info?.mime})`);
      continue;
    }
    if (!LICENSE_OK(info.license)) {
      console.log(`·  ${cc} ${city}: pomijam licencję „${info.license}”`);
      continue;
    }
    const res = await fetch(info.thumb, { headers: { "user-agent": UA } });
    if (!res.ok) throw new Error(`pobieranie HTTP ${res.status}`);
    // Tylko zmniejszamy (bez kadrowania i przeróbek), żeby strona ładowała się szybko
    const jpg = await sharp(Buffer.from(await res.arrayBuffer())).rotate().resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
    const path = `${cc}/${slug(city)}.jpg`;
    const up = await admin.storage.from("places").upload(path, jpg, { contentType: "image/jpeg", upsert: true });
    if (up.error) throw up.error;
    const url = `${admin.storage.from("places").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
    const { error } = await admin.from("place_photos").upsert({ country_code: cc, city, url, author: info.author, license: info.license, source_url: info.source });
    if (error) throw error;
    ok++;
    console.log(`✓  ${cc} ${city}: ${info.author} · ${info.license}`);
  } catch (e) {
    console.log(`❌ ${cc} ${city}: ${e.message}`);
  }
  await sleep(400);
}
console.log(`Gotowe: ${ok} nowych zdjęć.`);
