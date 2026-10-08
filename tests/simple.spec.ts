import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { admin, cleanup, contextFor, inst, makeBot, type Bot } from "./helpers";

// Wersja prosta: wyszukiwarka (3 zakładki) + „Mój wpis”. Telefon 390×844.
test.describe.serial("BeeXchange (wersja prosta)", () => {
  let ania: Bot, ola: Bot;
  let A: BrowserContext, guest: BrowserContext;
  let a: Page, g: Page;
  let PW: number;

  test.beforeAll(async ({ browser, baseURL }) => {
    await cleanup();
    PW = await inst("Warsaw University of Technology");
    const POLIMI = await inst("Politecnico di Milano");
    ania = await makeBot("ania", "Ania Testowa");
    ola = await makeBot("ola", "Ola Testowa");
    // Ola: była na PoliMi i pomaga na PW
    await admin.from("simple_people").insert({ user_id: ola.id, display_name: "Ola Testowa", home_institution_id: PW, instagram: "ola.testowa" });
    await admin.from("simple_entries").insert([
      { user_id: ola.id, kind: "been", institution_id: POLIMI, semester: "2026W" },
      { user_id: ola.id, kind: "helper", institution_id: PW },
    ]);
    A = await contextFor(browser, ania, baseURL!);
    guest = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "pl-PL" });
    await guest.addCookies([{ name: "lang", value: "pl", domain: "localhost", path: "/", sameSite: "Lax" }]);
    [a, g] = await Promise.all([A.newPage(), guest.newPage()]);
  });

  test.afterAll(async () => {
    await Promise.all([A?.close(), guest?.close()]);
    await cleanup();
  });

  const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/screens/${name}.png`, fullPage: true });
  const noSideScroll = async (page: Page) => {
    const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(sw, "strona nie powinna przewijać się w bok").toBeLessThanOrEqual(iw + 1);
  };

  test("Niezalogowany: wyszukiwanie pokazuje tylko liczbę osób", async () => {
    await g.goto("/");
    await g.getByRole("link", { name: "Są lub byli" }).click();
    await g.getByLabel("Kraj").selectOption({ label: "Włochy" });
    await expect(g.getByLabel("Miasto").locator("option", { hasText: "Mediolan" })).toHaveCount(1);
    await g.getByLabel("Miasto").selectOption({ label: "Mediolan" });
    await g.getByRole("button", { name: "Szukaj" }).click();
    await expect(g).toHaveURL(/tab=been/);
    await expect(g).toHaveURL(/cc=IT/);
    await expect(g.getByText(/Znaleźliśmy/)).toBeVisible();
    await expect(g.getByRole("link", { name: "Zaloguj się przez Google" })).toBeVisible();
    await expect(g.getByText("Ola Testowa")).toHaveCount(0);
    await noSideScroll(g);
    await shot(g, "s1-niezalogowany");
  });

  test("Mój wpis: imię, uczelnia, kontakt i wymiana", async () => {
    await a.goto("/me");
    await expect(a.getByRole("heading", { name: "Twój wpis" })).toBeVisible();
    await a.getByLabel("Imię lub ksywka").fill("Ania T.");
    await a.getByRole("textbox", { name: "Uczelnia, skrót albo miasto" }).first().fill("sgh");
    await a.getByRole("button", { name: /Szkoła Główna Handlowa/ }).first().click();
    await a.getByLabel("Instagram").fill("https://instagram.com/ania.test/");
    // wpis: jadę na Bocconi, lato 2026/27
    await a.getByRole("textbox", { name: "Uczelnia, skrót albo miasto" }).first().fill("bocconi");
    await a.getByRole("button", { name: /Bocconi/ }).first().click();
    await a.getByLabel("Semestr").selectOption({ label: "lato 2026/27" });
    await a.getByRole("button", { name: /Szukam mieszkania/ }).click();
    await noSideScroll(a);
    await shot(a, "s2-moj-wpis");
    await a.getByRole("button", { name: "Zapisz" }).click();
    await expect(a.getByRole("button", { name: /Zapisano/ })).toBeVisible();
    const { data } = await admin.from("simple_people").select("display_name, instagram").eq("user_id", ania.id).single();
    expect(data).toEqual({ display_name: "Ania T.", instagram: "ania.test" });
    const { data: entry } = await admin.from("simple_entries").select("kind, semester").eq("user_id", ania.id).single();
    expect(entry).toEqual({ kind: "going", semester: "2027S" });
  });

  test("Zalogowana: widzi siebie w „Jadą” z działającym linkiem", async () => {
    await a.goto("/?tab=going&cc=IT&city=Milan");
    const card = a.locator("article", { hasText: "Ania T." });
    await expect(card).toContainText("lato 2026/27");
    await expect(card.getByRole("link", { name: "Instagram" })).toHaveAttribute("href", "https://instagram.com/ania.test");
    await expect(card).not.toContainText("Studiuje na");
    await expect(card).toContainText("🏠 szuka mieszkania");
    await shot(a, "s3-jada");
  });

  test("Pomogą Ci: widać uczelnię macierzystą", async () => {
    await a.goto("/?tab=helper&cc=PL&city=Warsaw");
    const card = a.locator("article", { hasText: "Ola Testowa" });
    await expect(card).toContainText("Studiuje na Politechnika Warszawska");
    await expect(card.getByRole("link", { name: "Instagram" })).toHaveAttribute("href", "https://instagram.com/ola.testowa");
    await noSideScroll(a);
    await shot(a, "s4-pomoga");
  });

  test("Wersja angielska", async () => {
    await a.getByRole("button", { name: "en", exact: true }).click();
    await expect(a.getByRole("heading", { name: "Find exchange people" })).toBeVisible();
    await expect(a.getByRole("link", { name: "Can help you" })).toBeVisible();
    await a.getByRole("button", { name: "pl", exact: true }).click();
  });
});
