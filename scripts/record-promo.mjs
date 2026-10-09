// Nagrywa pionowy (9:16) filmik promocyjny BeErasm z napisami — do Reelsów / TikToka.
//   node scripts/record-promo.mjs en   → PoliMi → Barcelona, po angielsku (demo/beerasm-promo-en.mp4)
//   node scripts/record-promo.mjs pl   → SGH → Bocconi, po polsku      (demo/beerasm-promo-pl.mp4)
// Wymaga: danych `node scripts/seed-promo.mjs` i aplikacji (najlepiej produkcyjnej: `npx next build && npx next start -p 3100`).
// Zakłada tymczasowe konto widza, a po nagraniu je usuwa. ffmpeg: zmienna FFMPEG albo pakiet ffmpeg-static.
import { mkdirSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const LANG = process.argv[2] === "pl" ? "pl" : "en";
const APP = process.env.DEMO_APP_URL ?? "http://localhost:3100";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const admin = createClient(URL_, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const OUT = "demo";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const inst = async (name) => (await admin.from("institutions").select("id").eq("name", name).limit(1).single()).data.id;

// ---------- scenariusz ----------
const S = {
  en: {
    viewer: { key: "viewer-en", name: "Giulia", home: "Politecnico di Milano", to: "Universitat Politècnica de Catalunya", instagram: "giulia.promo" },
    tabs: { been: /There now/, helper: /Your buddy/, home: /At your university/ },
    intro: ["🤔", "Thinking about going on exchange — or already going?", ["✈️ Find people to go with", "🏠🤝 Find a flat together", "🎓 Meet people at your exchange uni"]],
    intro2: ["🧸", "Already been on Erasmus?", ["Help younger students from your uni", "Be a buddy for students coming from abroad"]],
    goingCap: ["✈️ Your crew is already here", "Giulia: PoliMi → Barcelona. We search her exchange uni straight from her profile"],
    fromCc: "IT",
    fromCap: ["🌍 Who's going from Italy?", "Filter by home country — see where they study"],
    housingCap: ["🏠🤝 Looking for a flat?", "See who's looking too — find flatmates"],
    beenCap: ["📍 Ask people who are there now", "…or who've already been 🏛️"],
    buddyCap: ["🧸 A local buddy in Barcelona", "UPC students who help you settle in"],
    homeCap: ["🐝 Buddies at your home uni", "They've been on exchange — see where and when"],
    contactCap: ["💬 One tap to say hi", "Instagram, WhatsApp or Facebook"],
    meCap: ["✍️ Add yourself in a minute", "Name, exchange, one contact — done"],
    meBuddyCap: ["🧸 Been on exchange?", "Turn on buddy and help students coming to your uni"],
    outro: ["🐝", "BeErasm", "Find people flying where you're going<br/><b>beerasm.vercel.app</b>"],
  },
  pl: {
    viewer: { key: "viewer-pl", name: "Zosia", home: "SGH Warsaw School of Economics", to: "Bocconi University", instagram: "zosia.promo" },
    tabs: { been: /Są lub byli/, helper: /Twój buddy/, home: /Na Twojej uczelni/ },
    intro: ["🤔", "Myślisz o wymianie — albo już jedziesz?", ["✈️ Znajdź ludzi, z którymi pojedziesz", "🏠🤝 Szukajcie mieszkania razem", "🎓 Poznaj osoby z uczelni, na którą jedziesz"]],
    intro2: ["🧸", "Byłeś/aś już na Erasmusie?", ["Pomóż młodszym kolegom ze swojej uczelni", "Zostań buddy dla osób z zagranicy"]],
    goingCap: ["✈️ Twoja ekipa już tu jest", "Zosia: SGH → Bocconi. Szukamy od razu jej uczelni wymiany z profilu"],
    fromCc: "PL",
    fromCap: ["🌍 Kto jedzie z Polski?", "Filtruj po kraju — widać, gdzie studiują"],
    housingCap: ["🏠🤝 Szukasz mieszkania?", "Zobacz, kto też szuka — znajdź współlokatorów"],
    beenCap: ["📍 Zapytaj tych, którzy są tam teraz", "…albo już tam byli 🏛️"],
    buddyCap: ["🧸 Lokalny buddy w Mediolanie", "Studenci Bocconi pomogą Ci się odnaleźć"],
    homeCap: ["🐝 Buddy na Twojej uczelni", "Byli na wymianie — widać gdzie i kiedy"],
    contactCap: ["💬 Jedno kliknięcie i piszesz", "Instagram, WhatsApp albo Facebook"],
    meCap: ["✍️ Dodaj się w minutę", "Imię, wymiana, jeden kontakt — gotowe"],
    meBuddyCap: ["🧸 Byłeś/aś na wymianie?", "Włącz buddy i pomagaj tym, którzy przyjeżdżają"],
    outro: ["🐝", "BeErasm", "Znajdź ludzi, którzy lecą tam, gdzie Ty<br/><b>beerasm.vercel.app</b>"],
  },
}[LANG];

// ---------- konto widza ----------
const email = `${S.viewer.key}@promo.beexchange.local`;
const found = (await admin.auth.admin.listUsers({ perPage: 1000 })).data.users.find((u) => u.email === email);
if (found) await admin.auth.admin.deleteUser(found.id);
const password = randomBytes(18).toString("base64url");
const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: S.viewer.name, locale: LANG } });
if (error) throw error;
const viewer = created.user.id;
const [HOME, TO] = await Promise.all([inst(S.viewer.home), inst(S.viewer.to)]);
await admin.from("simple_people").insert({ user_id: viewer, display_name: S.viewer.name, home_institution_id: HOME, instagram: S.viewer.instagram, looking_for_housing: true, is_buddy: false });
await admin.from("simple_entries").insert({ user_id: viewer, kind: "going", institution_id: TO, semester: "2027S" });

// Sesja jak w aplikacji (ciasteczka @supabase/ssr)
const jar = new Map();
const ssr = createServerClient(URL_, PUB, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
await ssr.auth.signInWithPassword({ email, password });

// ---------- przeglądarka ----------
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: false,
  locale: LANG === "pl" ? "pl-PL" : "en-GB",
  timezoneId: "Europe/Warsaw",
});
await ctx.addCookies([...jar, ["lang", LANG]].map(([name, value]) => ({ name, value, domain: new URL(APP).hostname, path: "/", sameSite: "Lax" })));

// Napisy, plansze i kółko w miejscu tapnięcia — wstrzykiwane do każdej strony
await ctx.addInitScript(() => {
  const css = `
    #demo-cap{position:fixed;left:14px;right:14px;top:132px;z-index:99999;pointer-events:none;
      background:#17140f;color:#ffc52e;border-radius:20px;padding:14px 16px;text-align:center;
      font:800 21px/1.2 var(--font-bricolage),system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25);
      transition:opacity .35s, transform .35s}
    #demo-cap small{display:block;margin-top:5px;color:#fff7e2;font:600 14px/1.3 var(--font-onest),system-ui,sans-serif}
    #demo-cap.hide{opacity:0;transform:translateY(-8px)}
    #demo-card{position:fixed;inset:0;z-index:100000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;
      background:#ffc52e;color:#17140f;text-align:center;padding:32px;font:800 36px/1.1 var(--font-bricolage),system-ui,sans-serif;
      transition:opacity .4s}
    #demo-card small{font:600 17px/1.4 var(--font-onest),system-ui,sans-serif;max-width:310px}
    #demo-card .big{font-size:72px}
    #demo-card ul{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:12px;
      font:700 19px/1.3 var(--font-onest),system-ui,sans-serif;max-width:320px}
    #demo-card li{background:#17140f;color:#ffc52e;border-radius:16px;padding:12px 16px;opacity:0;transform:translateY(10px);animation:demo-in .5s ease-out forwards}
    @keyframes demo-in{to{opacity:1;transform:none}}
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
  window.__tap = (x, y) => {
    add();
    const d = document.createElement("div");
    d.className = "demo-tap";
    d.style.left = `${x}px`;
    d.style.top = `${y}px`;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 700);
  };
  document.addEventListener(
    "click",
    (e) => {
      window.__tap(e.clientX, e.clientY);
      // linki do Instagrama itp. nie otwierają nowej karty w nagraniu
      if (e.target.closest?.('a[target="_blank"]')) e.preventDefault();
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
  window.__hideCap = () => document.getElementById("demo-cap")?.classList.add("hide");
  // sub: tekst albo lista punktów (pojawiają się co `step` ms)
  window.__card = (big, text, sub, step = 900) => {
    add();
    document.getElementById("demo-card")?.remove();
    const el = document.createElement("div");
    el.id = "demo-card";
    const rest = Array.isArray(sub)
      ? `<ul>${sub.map((x, i) => `<li style="animation-delay:${600 + i * step}ms">${x}</li>`).join("")}</ul>`
      : sub
        ? `<small>${sub}</small>`
        : "";
    el.innerHTML = `<div class="big">${big}</div><div>${text}</div>${rest}`;
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
const cap = async ([text, sub]) => {
  caption = [text, sub ?? ""];
  await page.evaluate(([a, b]) => window.__cap(a, b), caption);
};
const recap = () => (caption[0] ? page.evaluate(([a, b]) => window.__cap(a, b), caption) : null);
const hideCap = async () => {
  caption = ["", ""];
  await page.evaluate(() => window.__hideCap());
};
// Po nawigacji React mógł usunąć napis — przywracamy
const settle = async () => {
  await page.waitForLoadState("load");
  await sleep(250);
  await recap();
};
const go = async (path, c) => {
  await page.goto(APP + path, { waitUntil: "domcontentloaded" });
  if (c) await cap(c);
  await settle();
};
const scroll = async (y, ms = 1400) => {
  await page.evaluate(
    ([y, ms]) =>
      new Promise((done) => {
        const from = window.scrollY;
        const t0 = performance.now();
        const step = (now) => {
          const k = Math.min(1, (now - t0) / ms);
          window.scrollTo(0, from + (y * (1 - Math.cos(Math.PI * k))) / 2);
          if (k < 1) requestAnimationFrame(step);
          else done();
        };
        requestAnimationFrame(step);
      }),
    [y, ms],
  );
  await sleep(250);
};
const toTop = async () => scroll(-(await page.evaluate(() => window.scrollY)), 700);
// Kółko tapnięcia nad elementem bez klikania (np. przy <select>)
const tap = async (loc) => {
  const b = await loc.boundingBox();
  if (b) await page.evaluate(([x, y]) => window.__tap(x, y), [b.x + b.width / 2, b.y + b.height / 2]);
  await sleep(350);
};
// Pozycja elementu względem okna → przewinięcie tak, żeby był ok. 300 px od góry (pod napisem)
const scrollTo = async (loc, offset = 300, ms = 1000) => {
  const b = await loc.boundingBox();
  if (b) await scroll(b.y - offset, ms);
};

// ---------- zapis klatek ----------
const FRAMES = `${OUT}/frames-${LANG}`;
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

const T = S.tabs;
const card = (c) => page.evaluate(([a, b, d]) => window.__card(a, b, d), c);
// 1. Plansze: dla jadących, potem dla tych, którzy już byli
await go("/?tab=going");
await card(S.intro);
await sleep(300);
recording = true;
await sleep(5600);
await card(S.intro2);
await sleep(4600);
await page.evaluate(() => window.__uncard());
await sleep(500);

// 2. Jadą — od razu uczelnia wymiany z profilu
await cap(S.goingCap);
await sleep(2000);
await scrollTo(page.locator("article").first(), 330, 1600);
await sleep(1800);

// 3b. Skąd jadą: kraj uczelni macierzystej
await cap(S.fromCap);
const fromSelect = page.locator("form select").nth(3);
await scrollTo(fromSelect, 420, 1400);
await sleep(700);
await tap(fromSelect);
await fromSelect.selectOption(S.fromCc);
await sleep(900);
await page.getByRole("button", { name: LANG === "pl" ? "Szukaj" : "Search", exact: true }).click();
await page.waitForURL(/from=/);
await settle();
await sleep(500);
await scrollTo(page.locator("article").first(), 330, 1400);
await sleep(2000);

// 4. Mieszkanie
await cap(S.housingCap);
await sleep(2600);

// 5. Są lub byli
await toTop();
await page.getByRole("link", { name: T.been }).click();
await page.waitForURL(/tab=been/);
await cap(S.beenCap);
await settle();
await sleep(800);
await scrollTo(page.locator("article").first(), 330, 1600);
await sleep(1800);
await scroll(360, 2200);
await sleep(1000);

// 6. Twój buddy na uczelni wymiany
await toTop();
await page.getByRole("link", { name: T.helper }).click();
await page.waitForURL(/tab=helper/);
await cap(S.buddyCap);
await settle();
await sleep(800);
await scrollTo(page.locator("article").first(), 330, 1600);
await sleep(2200);

// 7. Kontakt
await cap(S.contactCap);
await sleep(900);
await page.locator("article").first().getByRole("link", { name: /Instagram|WhatsApp|Facebook/ }).first().click();
await sleep(1300);
await page.locator("article").nth(1).getByRole("link", { name: /WhatsApp|Facebook|Instagram/ }).first().click();
await sleep(1800);

// 8. Buddy na uczelni macierzystej — z tym, gdzie byli na wymianie
await toTop();
await page.getByRole("link", { name: T.home }).click();
await page.waitForURL(/mode=home/);
await cap(S.homeCap);
await settle();
await sleep(800);
await scrollTo(page.locator("article").first(), 330, 1600);
await sleep(2800);

// 9. Mój profil
await go("/me", S.meCap);
await sleep(2400);
await scroll(380, 2400);
await sleep(900);
const buddyToggle = page.getByRole("button", { name: LANG === "pl" ? /Jestem buddy/ : /I'm a buddy/ });
await scrollTo(buddyToggle, 420, 1600);
await cap(S.meBuddyCap);
await sleep(900);
await buddyToggle.click();
await sleep(2600);

// 10. Koniec
await card(S.outro);
await sleep(4200);
recording = false;
await recorder;
await ctx.close();
await browser.close();

// ---------- klatki → MP4 (zmienna długość klatek wg prawdziwych czasów) ----------
const name = (i) => `${String(i).padStart(5, "0")}.jpg`;
const list = stamps.map((t, i) => `file '${name(i)}'\nduration ${(((stamps[i + 1] ?? t + 100) - t) / 1000).toFixed(3)}`).join("\n");
writeFileSync(`${FRAMES}/list.txt`, `${list}\nfile '${name(stamps.length - 1)}'\n`);
const ffmpeg = process.env.FFMPEG ?? (() => { try { return createRequire(import.meta.url)("ffmpeg-static"); } catch { return null; } })();
const target = `${OUT}/beerasm-promo-${LANG}.mp4`;
console.log(`Klatek: ${stamps.length}, ${(stamps.at(-1) / 1000).toFixed(1)} s, ok. ${(stamps.length / (stamps.at(-1) / 1000)).toFixed(1)} kl./s`);
if (ffmpeg) {
  execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", `${FRAMES}/list.txt`, "-vf", "scale=1080:-2:flags=lanczos,fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-movflags", "+faststart", target]);
  rmSync(FRAMES, { recursive: true });
} else {
  console.log(`Brak ffmpeg — klatki zostały w ${FRAMES}. Ustaw FFMPEG=ścieżka i sklej list.txt.`);
}

await admin.auth.admin.deleteUser(viewer);
console.log(`✅ Nagranie: ${target}`);
