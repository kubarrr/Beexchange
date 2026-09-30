import { defineConfig } from "@playwright/test";

// Testy w prawdziwej przeglądarce. Wymagają działającego `npm run dev` i danych w .env.local.
// Uruchom: npm run test:browser   (zrzuty ekranu: test-results/screens)
export default defineConfig({
  testDir: "tests",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.TEST_APP_URL ?? "http://localhost:3000",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "pl-PL",
    timezoneId: "Europe/Warsaw",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
