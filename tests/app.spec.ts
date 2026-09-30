import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import sharp from "sharp";
import { admin, cleanup, contextFor, inst, makeBot, setProfile, type Bot } from "./helpers";

// Scenariusz jak u prawdziwych ludzi: Ania przechodzi onboarding w przeglądarce,
// Bartek jedzie tą samą trasą, a Celina (absolwentka) chce być buddy.
test.describe.serial("BeeXchange w przeglądarce (telefon 390×844)", () => {
  let ania: Bot, bartek: Bot, celina: Bot;
  let A: BrowserContext, B: BrowserContext, C: BrowserContext;
  let a: Page, b: Page, c: Page;
  let SGH: number, BOC: number;

  test.beforeAll(async ({ browser, baseURL }) => {
    await cleanup();
    [SGH, BOC] = await Promise.all([inst("SGH Warsaw School of Economics"), inst("Bocconi University")]);
    ania = await makeBot("ania", "Ania Testowa");
    bartek = await makeBot("bartek", "Bartek Testowy");
    celina = await makeBot("celina", "Celina Testowa");
    await setProfile(bartek, { home: SGH, ex: BOC, semester: "2026W", status: "going" });
    await setProfile(celina, { home: SGH, ex: BOC, semester: "2025W", status: "been", buddy: true });
    [A, B, C] = await Promise.all([contextFor(browser, ania, baseURL!), contextFor(browser, bartek, baseURL!), contextFor(browser, celina, baseURL!)]);
    [a, b, c] = await Promise.all([A.newPage(), B.newPage(), C.newPage()]);
  });

  test.afterAll(async () => {
    await Promise.all([A?.close(), B?.close(), C?.close()]);
    await cleanup();
  });

  const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/screens/${name}.png`, fullPage: true });
  const noSideScroll = async (page: Page) => {
    const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(sw, "strona nie powinna przewijać się w bok").toBeLessThanOrEqual(iw + 1);
  };

  test("Onboarding krok po kroku ze zdjęciem, pasjami i językami", async () => {
    await a.goto("/roj");
    await expect(a).toHaveURL(/\/onboarding/);
    await a.getByRole("button", { name: "Jadę na wymianę" }).click();
    await a.getByRole("button", { name: "Dalej" }).click();

    // Uczelnia w Polsce
    await a.getByRole("textbox", { name: "Uczelnia, skrót albo miasto" }).fill("sgh");
    await a.getByRole("button", { name: /Szkoła Główna Handlowa/ }).first().click();
    await a.getByRole("button", { name: "Licencjat" }).click();
    await a.getByRole("button", { name: "3", exact: true }).click();
    await a.getByPlaceholder("np. Finanse i rachunkowość").fill("Finanse i rachunkowość");
    await shot(a, "01-onboarding-uczelnia");
    await a.getByRole("button", { name: "Dalej" }).click();

    // Wymiana
    await a.getByRole("textbox", { name: "Uczelnia, skrót albo miasto" }).fill("bocconi");
    await a.getByRole("button", { name: /Bocconi/ }).first().click();
    await a.getByRole("button", { name: "zima 2026/27" }).click();
    await shot(a, "02-onboarding-wymiana");
    await a.getByRole("button", { name: "Dalej" }).click();

    // Ty: zdjęcie, pasje, języki
    const png = await sharp({ create: { width: 300, height: 400, channels: 3, background: "#e0a200" } }).png().toBuffer();
    await a.locator('input[type="file"]').setInputFiles({ name: "zdjecie.png", mimeType: "image/png", buffer: png });
    await expect(a.locator('img[src*="/avatars/"]')).toBeVisible();
    await a.getByRole("button", { name: /Kawa/ }).click();
    await a.getByRole("button", { name: /Podróże/ }).click();
    await a.getByRole("combobox", { name: "Dodaj język" }).selectOption({ label: "Włoski" });
    await a.getByRole("combobox", { name: "Poziom" }).selectOption("B1");
    await a.getByRole("button", { name: "Dodaj język" }).click();
    await expect(a.getByText("Włoski")).toBeVisible();
    await a.getByLabel("O mnie").fill("Szukam współlokatora w Mediolanie!");
    await noSideScroll(a);
    await shot(a, "03-onboarding-ty");
    await a.getByRole("button", { name: "Pokaż mój rój" }).click();

    await expect(a).toHaveURL(/\/roj/);
    await expect(a.getByText("Najlepsze dopasowanie")).toBeVisible();
    await expect(a.getByRole("heading", { name: /SGH → Bocconi/ })).toBeVisible();
    await noSideScroll(a);
    await shot(a, "04-roj");

    const { data } = await admin.from("profiles").select("avatar_url, passions, languages, study_year").eq("id", ania.id).single();
    expect(data?.avatar_url).toContain("/avatars/");
    expect(data?.passions).toEqual(expect.arrayContaining(["coffee", "travel"]));
    expect(data?.languages).toContain("it:B1");
    expect(data?.study_year).toBe("bachelor:3");
  });

  test("Grupa i czat na żywo między dwiema osobami", async () => {
    await a.getByRole("button", { name: /Dołącz/ }).first().click();
    await expect(a).toHaveURL(/\/grupy\/\d+/);
    const groupUrl = a.url();

    await b.goto(groupUrl);
    await b.getByRole("button", { name: "Dołącz", exact: true }).click();
    await expect(b.getByPlaceholder("Napisz do grupy…")).toBeVisible();
    await b.waitForTimeout(2500); // czas na podłączenie czatu na żywo

    await a.getByPlaceholder("Napisz do grupy…").fill("Cześć! Szukamy razem mieszkania?");
    await a.getByRole("button", { name: "Wyślij" }).click();
    await expect(a.getByText("Cześć! Szukamy razem mieszkania?")).toBeVisible();
    await expect(b.getByText("Cześć! Szukamy razem mieszkania?")).toBeVisible({ timeout: 10_000 });
    await noSideScroll(a);
    await shot(a, "05-czat-grupy");
  });

  test("Licznik nieprzeczytanych i wiadomość prywatna", async () => {
    const { data: conv } = await bartek.db.rpc("get_or_create_conversation", { other_user: ania.id });
    await bartek.db.from("messages").insert({ conversation_id: conv, sender_id: bartek.id, body: "Hej Ania, masz już mieszkanie?" });

    await a.goto("/roj");
    const chats = a.getByRole("navigation").last().getByRole("link", { name: /Czaty/ });
    await expect(chats).toContainText("1");
    await chats.click();
    await expect(a.getByText("Hej Ania, masz już mieszkanie?")).toBeVisible();
    await shot(a, "06-czaty");
    await a.getByText("Hej Ania, masz już mieszkanie?").click();
    await expect(a).toHaveURL(/\/wiadomosci\//);
    await a.getByPlaceholder("Napisz do grupy…").fill("Jeszcze nie, szukajmy razem!");
    await a.getByRole("button", { name: "Wyślij" }).click();
    await expect(a.getByText("Jeszcze nie, szukajmy razem!")).toBeVisible();
    await a.goto("/roj");
    await expect(a.getByRole("navigation").last().getByRole("link", { name: /Czaty/ })).not.toContainText(/\d/);
  });

  test("Prośba o buddy i akceptacja", async () => {
    await a.goto(`/u/${celina.id}`);
    await expect(a.getByText("Macie wspólne")).toBeVisible();
    await shot(a, "07-profil-osoby");
    await a.getByRole("button", { name: "Poproś o buddy" }).click();
    await expect(a.getByText("Prośba wysłana")).toBeVisible();

    await c.goto("/czaty");
    await expect(c.getByText("prosi, żebyś był/a buddy")).toBeVisible();
    await c.getByRole("button", { name: "Akceptuj" }).click();
    await expect(c).toHaveURL(/\/wiadomosci\//);
  });

  test("Filtry ludzi: kraj i miasto (polskie nazwy)", async () => {
    await a.goto("/ludzie");
    await a.getByRole("button", { name: "Filtry" }).click();
    await a.getByLabel("Kraj").selectOption({ label: "Włochy" });
    await a.getByLabel("Miasto").selectOption({ label: "Mediolan" });
    await a.getByRole("button", { name: /Tylko z mojej uczelni/ }).click();
    await shot(a, "08-filtry");
    await a.getByRole("button", { name: "Pokaż wyniki" }).click();
    await expect(a).toHaveURL(/cc=IT/);
    await expect(a).toHaveURL(/city=Milan/);
    await expect(a.getByRole("button", { name: /Mediolan/ })).toBeVisible();
    await expect(a.getByRole("link", { name: "Bartek Testowy" })).toBeVisible();
    await noSideScroll(a);
    await shot(a, "09-ludzie");
  });

  test("Tworzenie wydarzenia (godzina w strefie użytkownika) i „Idę”", async () => {
    await a.goto("/wydarzenia/nowe");
    await a.getByLabel("Nazwa").fill("Testowe aperitivo");
    await a.getByLabel("Kiedy").fill("2026-12-12T19:30");
    await a.getByLabel("Miasto").fill("Mediolan");
    await a.getByLabel("Kraj").selectOption("IT");
    await a.getByRole("button", { name: "Opublikuj wydarzenie" }).click();
    await expect(a).toHaveURL(/\/wydarzenia$/);
    const card = a.locator("article", { hasText: "Testowe aperitivo" });
    await expect(card).toContainText("19:30");
    await expect(card).toContainText("12");
    await card.getByRole("button", { name: "Idę", exact: true }).click();
    await expect(a.locator("article", { hasText: "Testowe aperitivo" }).getByRole("button", { name: "Idę ✓" })).toBeVisible();
    await shot(a, "10-wydarzenia");
  });

  test("Odkrywanie grup: zakładanie brakującej grupy (Madryt)", async () => {
    await a.goto("/grupy?tab=city&cc=ES&city=Madrid&sem=2027S");
    await a.getByRole("button", { name: "Utwórz grupę i dołącz" }).click();
    await expect(a).toHaveURL(/\/grupy\/\d+/);
    await expect(a.getByText("Madryt")).toBeVisible();
    await shot(a, "11-nowa-grupa");
  });

  test("Profil: dodanie drugiej wymiany", async () => {
    await a.goto("/profil");
    await a.getByRole("button", { name: "Dodaj wymianę" }).click();
    await a.getByRole("button", { name: "Byłem/am" }).last().click();
    await a.getByRole("textbox", { name: "Uczelnia, skrót albo miasto" }).fill("polimi");
    await a.getByRole("button", { name: /Politecnico di Milano/ }).first().click();
    await a.getByRole("button", { name: "lato 2025/26" }).last().click();
    await a.getByRole("button", { name: "Zapisz profil" }).click();
    await expect(a.getByRole("button", { name: /Zapisano/ })).toBeVisible();
    await a.goto(`/u/${ania.id}`);
    await expect(a.getByText("Politecnico di Milano").first()).toBeVisible();
    await expect(a.getByText(/Bocconi/).first()).toBeVisible();
    await shot(a, "12-moj-profil");
  });

  test("Przełączenie na angielski", async () => {
    await a.goto("/roj");
    await a.getByRole("button", { name: "en", exact: true }).click();
    await expect(a.getByRole("heading", { name: "Your swarm" })).toBeVisible();
    await expect(a.getByText("Milan").first()).toBeVisible();
    await shot(a, "13-english");
    await a.getByRole("button", { name: "pl", exact: true }).click();
    await expect(a.getByRole("heading", { name: "Twój rój" })).toBeVisible();
  });

  test("Zrzuty ekranów i brak przewijania w bok", async () => {
    for (const [path, name] of [
      ["/ludzie", "20-ludzie"],
      ["/grupy", "21-odkrywaj"],
      ["/wydarzenia", "22-wydarzenia"],
      ["/czaty", "23-czaty"],
      ["/profil", "24-profil"],
      ["/regulamin", "25-regulamin"],
    ] as const) {
      await a.goto(path);
      await noSideScroll(a);
      await shot(a, name);
    }
  });

  test("Usunięcie konta", async () => {
    await a.goto("/profil");
    await a.getByRole("button", { name: "Usuń konto" }).click();
    const confirm = a.getByRole("button", { name: "Usuń konto na zawsze" });
    await expect(confirm).toBeDisabled();
    await a.getByLabel(/Wpisz USUŃ/).fill("USUŃ");
    await confirm.click();
    await expect(a).toHaveURL(/deleted=1/);
    await expect(a.getByText("Twoje konto i wszystkie dane zostały usunięte")).toBeVisible();
    const { data } = await admin.auth.admin.getUserById(ania.id);
    expect(data.user).toBeNull();
    const { data: files } = await admin.storage.from("avatars").list(ania.id);
    expect(files ?? []).toHaveLength(0);
  });
});
