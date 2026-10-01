// Nagrywa ~60-sekundowe demo aplikacji w pionie (9:16) z napisami — do TikToka / Reelsów.
// Wymaga działającej aplikacji (najlepiej produkcyjnej: `npx next build && npx next start -p 3100`)
// i danych demo (`npm run demo:seed`). Zakłada tymczasowe konto „Zosia”, a po nagraniu je usuwa.
// Nagrywamy ciągłymi zrzutami w gęstości 2× (ostry tekst), a ffmpeg skleja je w MP4 1080 px.
// ffmpeg: zmienna FFMPEG albo pakiet ffmpeg-static (npm i -g ffmpeg-static).
// Uruchom: npm run demo:video   (plik: demo/beexchange-demo.mp4)
import { mkdirSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const APP = process.env.DEMO_APP_URL ?? "http://localhost:3100";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const admin = createClient(URL_, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const OUT = "demo";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const inst = async (name) => (await admin.from("institutions").select("id").eq("name", name).limit(1).single()).data.id;
const userId = async (email) => (await admin.auth.admin.listUsers({ perPage: 500 })).data.users.find((u) => u.email === email)?.id;

// ---------- konto demo ----------
const email = `zosia@demo.beexchange.local`;
const old = await userId(email);
if (old) await admin.auth.admin.deleteUser(old);
const password = randomBytes(18).toString("base64url");
const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Zosia Kowalska" } });
if (error) throw error;
const zosia = created.user.id;
const [PW, POLIMI] = await Promise.all([inst("Warsaw University of Technology"), inst("Politecnico di Milano")]);
await admin
  .from("profiles")
  .update({
    onboarded: true,
    status: "going",
    home_institution_id: PW,
    exchange_institution_id: POLIMI,
    semester: "2027S",
    field_of_study: "Data Science",
    study_year: "bachelor:3",
    passions: ["travel", "coffee", "running"],
    languages: ["pl:native", "en:C1", "it:A2"],
    bio: "Lecę na PoliMi w lutym! Szukam pokoju i ludzi do zwiedzania.",
    open_to_questions: true,
    looking_for_housing: true,
  })
  .eq("id", zosia);
await admin.from("profile_homes").insert({ user_id: zosia, institution_id: PW, field_of_study: "Data Science", study: "bachelor:3", position: 0 });
await admin.from("exchanges").insert({ user_id: zosia, institution_id: POLIMI, semester: "2027S", status: "going" });

// Sesja jak w aplikacji (ciasteczka @supabase/ssr)
const jar = new Map();
const ssr = createServerClient(URL_, PUB, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
await ssr.auth.signInWithPassword({ email, password });

const giulia = await userId("giulia@demo.beexchange.local");
const marta = await userId("marta@demo.beexchange.local");
if (!giulia || !marta) throw new Error("Brak danych demo — uruchom najpierw: npm run demo:seed");

// ---------- nagrywanie ----------
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: false,
  locale: "pl-PL",
  timezoneId: "Europe/Warsaw",
});
await ctx.addCookies([...jar, ["lang", "pl"]].map(([name, value]) => ({ name, value, domain: new URL(APP).hostname, path: "/", sameSite: "Lax" })));

// Napisy i kółko w miejscu tapnięcia — wstrzykiwane do każdej strony
await ctx.addInitScript(() => {
  const css = `
    #demo-cap{position:fixed;left:14px;right:14px;top:74px;z-index:99999;pointer-events:none;
      background:#17140f;color:#ffc52e;border-radius:20px;padding:14px 16px;text-align:center;
      font:800 21px/1.2 var(--font-bricolage),system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25);
      transition:opacity .35s, transform .35s}
    #demo-cap small{display:block;margin-top:5px;color:#fff7e2;font:600 14px/1.3 var(--font-onest),system-ui,sans-serif}
    #demo-cap.hide{opacity:0;transform:translateY(-8px)}
    #demo-card{position:fixed;inset:0;z-index:100000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;
      background:#ffc52e;color:#17140f;text-align:center;padding:32px;font:800 34px/1.1 var(--font-bricolage),system-ui,sans-serif;
      transition:opacity .4s}
    #demo-card small{font:600 17px/1.35 var(--font-onest),system-ui,sans-serif;max-width:300px}
    #demo-card .big{font-size:64px}
    .demo-tap{position:fixed;z-index:100001;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;
      background:rgba(23,20,15,.25);border:3px solid #17140f;pointer-events:none;animation:demo-tap .6s ease-out forwards}
    @keyframes demo-tap{from{transform:scale(.4);opacity:1}to{transform:scale(1.4);opacity:0}}`;
  const add = () => {
    if (document.getElementById("demo-style")) return;
    const s = document.createElement("style");
    s.id = "demo-style";
    s.textContent = css;
    document.head.appendChild(s);
  };
  document.addEventListener("DOMContentLoaded", add);
  document.addEventListener(
    "click",
    (e) => {
      const d = document.createElement("div");
      d.className = "demo-tap";
      d.style.left = `${e.clientX}px`;
      d.style.top = `${e.clientY}px`;
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 700);
    },
    true,
  );
  window.__cap = (text, sub) => {
    add();
    let el = document.getElementById("demo-cap");
    if (!el) {
      el = document.createElement("div");
      el.id = "demo-cap";
      document.body.appendChild(el);
    }
    el.innerHTML = text + (sub ? `<small>${sub}</small>` : "");
    el.classList.remove("hide");
  };
  window.__card = (big, text, sub) => {
    add();
    document.getElementById("demo-card")?.remove();
    const el = document.createElement("div");
    el.id = "demo-card";
    el.innerHTML = `<div class="big">${big}</div><div>${text}</div>${sub ? `<small>${sub}</small>` : ""}`;
    document.body.appendChild(el);
  };
  window.__uncard = () => {
    const el = document.getElementById("demo-card");
    if (el) {
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 400);
    }
  };
});

const page = await ctx.newPage();
let caption = ["", ""];
const cap = async (text, sub) => {
  caption = [text, sub ?? ""];
  await page.evaluate(([a, b]) => window.__cap(a, b), caption);
};
// Przejście na stronę z napisem od razu; po chwili ponownie (React po wczytaniu strony mógł go usunąć)
const go = async (path, text, sub) => {
  await page.goto(APP + path, { waitUntil: "domcontentloaded" });
  if (text) await cap(text, sub);
  await page.waitForLoadState("load");
  await sleep(250);
  if (caption[0]) await page.evaluate(([a, b]) => window.__cap(a, b), caption);
};
const scroll = async (y, ms = 1400) => {
  await page.evaluate(
    ([y, ms]) =>
      new Promise((done) => {
        const from = window.scrollY;
        const t0 = performance.now();
        const step = (now) => {
          const k = Math.min(1, (now - t0) / ms);
          window.scrollTo(0, from + y * (1 - Math.cos(Math.PI * k)) / 2);
          if (k < 1) requestAnimationFrame(step);
          else done();
        };
        requestAnimationFrame(step);
      }),
    [y, ms],
  );
  await sleep(250);
};

// ---------- zapis klatek ----------
const FRAMES = `${OUT}/frames`;
if (existsSync(FRAMES)) rmSync(FRAMES, { recursive: true });
mkdirSync(FRAMES, { recursive: true });
const stamps = [];
let recording = false;
let t0 = 0;
const recorder = (async () => {
  while (!recording) await sleep(20);
  t0 = Date.now();
  while (recording) {
    try {
      const buf = await page.screenshot({ type: "jpeg", quality: 88, caret: "initial" });
      writeFileSync(`${FRAMES}/${String(stamps.length).padStart(5, "0")}.jpg`, buf);
      stamps.push(Date.now() - t0);
    } catch {
      await sleep(30); // w trakcie przejścia między stronami
    }
  }
})();

// 1. Hak (0–3 s): plansza jest od pierwszej klatki
await go("/swarm");
await page.evaluate(() => window.__card("🤔", "Zastanawiasz się, czy jechać na Erasmusa?", "Albo już jedziesz i nie wiesz, od czego zacząć?"));
await sleep(300);
recording = true;
await sleep(3000);
await page.evaluate(() => window.__uncard());

// 2. Rój (4–12 s)
await cap("🐝 Twój rój", "Polacy i cała ekipa, która jedzie tam, gdzie Ty");
await sleep(1800);
await scroll(520, 2000);
await scroll(560, 2000);

// 3. Ludzie: ci, którzy są tam teraz (12–18 s)
await go(`/people?ex=${POLIMI}`, "🔍 Szukasz informacji?", "Zapytaj tych, którzy są tam TERAZ 📍");
await sleep(900);
await page.getByRole("button", { name: /Tam teraz/ }).click();
await sleep(500);
await page.getByRole("button", { name: "Szukaj", exact: true }).click();
await page.waitForURL(/seg=abroad/);
await sleep(600);
await cap("🔍 Szukasz informacji?", "Zapytaj tych, którzy są tam TERAZ 📍");
await scroll(560, 1800);

// 4. Pomoc z papierami (18–24 s)
await go(`/u/${marta}`, "📋 Papiery cię przerażają?", "Ludzie z Twojej uczelni pomogą z learning agreement");
await sleep(1600);
await scroll(380, 1800);

// 5. Buddy (24–30 s)
await go(`/u/${giulia}`, "🧸 Buddy na miejscu", "Lokalny student pokaże Ci miasto i uczelnię");
await sleep(1500);
await scroll(700, 1100);
await page.getByRole("button", { name: "Poproś o buddy" }).click();
await sleep(1600);

// 6. Mieszkania (30–41 s)
await go("/housing", "🏠 Szukasz mieszkania?", "Pokoje od osób, które kończą wymianę");
await sleep(1400);
await scroll(640, 1900);
await scroll(640, 1700);
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
await sleep(700);
await page.getByRole("link", { name: /Współlokatorzy/ }).click();
await page.waitForURL(/tab=flatmates/);
await cap("🏠 …albo znajdź współlokatora", "Szukajcie razem!");
await sleep(2000);

// 7. Oszustwa: sprawdzenie na miejscu (41–51 s)
await page.getByRole("link", { name: /Sprawdzenie/ }).click();
await page.waitForURL(/tab=check/);
await cap("🕵️ Boisz się oszustw?", "Ktoś na miejscu obejrzy mieszkanie za Ciebie");
await sleep(1300);
await scroll(330, 900);
await page.locator(".panel", { hasText: "Ola Mazur" }).getByRole("button", { name: "Poproś o sprawdzenie" }).click();
await sleep(400);
await page.getByLabel(/Link do ogłoszenia/).pressSequentially("Via Pascoli 12, oglądanie w czwartek 18:00 🙏", { delay: 35 });
await sleep(500);
await page.getByRole("button", { name: "Wyślij prośbę" }).click();
await sleep(1700);

// 8. Wydarzenia (51–56 s)
await go("/events", "🍹 Poznaj ekipę przed wyjazdem", "Wydarzenia w Twoim mieście");
await sleep(1800);
await scroll(500, 1800);

// 9. Po powrocie: spotkania absolwentów w Warszawie
await go("/events?cc=PL&city=Warsaw", "👑 Tęsknisz za Erasmusem?", "Spotkaj alumni w swoim mieście, np. w Warszawie");
await sleep(2200);
await scroll(420, 1800);

// 10. Koniec
await page.evaluate(() => window.__card("🐝", "BeeXchange", "Exchange together.<br/>Darmowa apka dla studentów wymian · beexchange.vercel.app"));
await sleep(3500);
recording = false;
await recorder;
await ctx.close();
await browser.close();

// ---------- klatki → MP4 (zmienna długość klatek wg prawdziwych czasów) ----------
const name = (i) => `${String(i).padStart(5, "0")}.jpg`;
const list = stamps.map((t, i) => `file '${name(i)}'\nduration ${(((stamps[i + 1] ?? t + 100) - t) / 1000).toFixed(3)}`).join("\n");
writeFileSync(`${FRAMES}/list.txt`, `${list}\nfile '${name(stamps.length - 1)}'\n`);
const ffmpeg = process.env.FFMPEG ?? (() => { try { return createRequire(import.meta.url)("ffmpeg-static"); } catch { return null; } })();
const target = `${OUT}/beexchange-demo.mp4`;
console.log(`Klatek: ${stamps.length}, ${(stamps.at(-1) / 1000).toFixed(1)} s, ok. ${(stamps.length / (stamps.at(-1) / 1000)).toFixed(1)} kl./s`);
if (ffmpeg) {
  execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", `${FRAMES}/list.txt`, "-vf", "scale=1080:-2:flags=lanczos,fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-movflags", "+faststart", target]);
  rmSync(FRAMES, { recursive: true });
} else {
  console.log(`Brak ffmpeg — klatki zostały w ${FRAMES}. Ustaw FFMPEG=ścieżka i sklej list.txt.`);
}

// Sprzątanie: konto demo i wszystko, co utworzyło (prośby, wiadomości) — kaskadowo
await admin.auth.admin.deleteUser(zosia);
console.log(`✅ Nagranie: ${target}`);
