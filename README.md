# 🐝 BeeXchange: exchange together

Aplikacja łącząca studentów przed wymianą, w trakcie i po niej: dopasowuje ludzi do małych grup (ta sama uczelnia, semestr, miasto), pokazuje absolwentów i buddy'ch, a do tego wydarzenia i czat na żywo. Interfejs PL/EN.

**Stos:** Next.js 16 + Tailwind CSS 4 + Supabase (Postgres, Auth, Realtime, Storage) · ikony `lucide-react` · flagi `country-flag-icons` (SVG w `public/flags`) · baza uczelni z rejestru [ROR](https://ror.org) (CC0).

## Funkcje

| Ekran | Ścieżka | Co robi |
|---|---|---|
| Start | `/` | Strona dla niezalogowanych |
| Onboarding | `/onboarding` | 4 kroki: etap → uczelnia macierzysta → wymiana i semestr → zdjęcie, pasje, języki |
| Rój | `/roj` | Dopasowane grupy (trasa, semestr, absolwenci, miasto) + buddy do poproszenia |
| Grupa | `/grupy/[id]` | Czat grupowy na żywo, lista członków |
| Ludzie | `/ludzie` | Wyszukiwarka z panelem filtrów (Jadą/Byli, uczelnia, semestr, kierunek, pasja, z mojej uczelni, buddy) |
| Profil osoby | `/u/[id]` | „Macie wspólne”, Napisz, Poproś o buddy |
| Wydarzenia | `/wydarzenia` | Dla Ciebie / W Polsce / Za granicą / Online, „Idę”, tworzenie |
| Czaty | `/czaty` | Prośby o buddy, grupy, wiadomości 1:1 (`/wiadomosci/[id]`) |
| Profil | `/profil` | Edycja: zdjęcie, studia, wymiana, pasje, języki, kontakt |

Grupy powstają same, gdy ktoś do nich dołączy, i są widoczne, gdy pasuje do nich co najmniej jedna inna osoba. Logika jest w SQL: `group_suggestions()` i `join_group()` w `supabase/migrations/0002_beexchange.sql`.

Starsze moduły (destynacje, opinie, przedmioty, pytania, mieszkania, checklista) są ukryte w menu, ale kod i trasy zostały.

## Uruchomienie

### 1. Baza (Supabase → SQL Editor)
Uruchom po kolei:
1. `supabase/migrations/0001_init.sql` (jeśli jeszcze nie)
2. `supabase/seed.sql` (jeśli jeszcze nie; dane starszych modułów)
3. `supabase/migrations/0002_beexchange.sql`
4. `supabase/migrations/0003_multi_exchange.sql`
5. `supabase/migrations/0004_groups_unread_account.sql`

### 2. Import uczelni (ok. 6 tys. z Europy)
1. Supabase → Project Settings → API Keys → skopiuj klucz **secret**.
2. Wklej go do `.env.local` jako `SUPABASE_SECRET_KEY=...` (nigdzie więcej!).
3. `npm run import:institutions`

Aktualizacja listy z najnowszego zrzutu ROR: `python scripts/fetch-ror.py`, potem ponownie import. Uczelnie dodane przez użytkowników mają `status = 'pending'`. Zatwierdzasz je w Table Editor (`institutions`), zmieniając status na `approved`.

### 3. (Opcjonalnie) dane testowe
`supabase/dev-demo-data.sql` dodaje 9 fikcyjnych osób, grupę z rozmową i wydarzenia. **Przed startem usuń je** plikiem `supabase/dev-demo-cleanup.sql`.

### 4. Logowanie
Supabase → Authentication → URL Configuration: Site URL `http://localhost:3000`, Redirect URL `http://localhost:3000/auth/callback` (na produkcji także Twoja domena). Do maili z linkiem podepnij własny SMTP (np. Resend).

### 5. Start
```bash
npm install
npm run dev
```

## Testy i dane pokazowe

| Polecenie | Co robi |
|---|---|
| `npm run test:e2e` | Test bazy i ekranów na botach (ok. 140 sprawdzeń, także wersja angielska); sprząta po sobie |
| `npm run test:browser` | Testy w prawdziwej przeglądarce (Playwright, ekran telefonu): onboarding, czat na żywo, buddy, filtry, wydarzenia, usuwanie konta. Zrzuty w `test-results/screens` |
| `npm run test:load` | Test obciążenia: 5000 fikcyjnych osób, pomiary czasu, sprzątanie (`-- 1000` inna liczba, `-- --clear` tylko sprzątanie) |
| `npm run demo:seed` | Dane pokazowe wokół Twojego konta (`-- --clear` usuwa) |

Testy wymagają działającego `npm run dev` i klucza `SUPABASE_SECRET_KEY` w `.env.local`. Przed pierwszym `test:browser`: `npx playwright install chromium`.

## Wdrożenie
Vercel (plan Pro przy użytku komercyjnym): zmienne `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`. Klucza secret **nie** dodawaj.

## Struktura
```
src/app/actions/bx.ts     akcje: profil, uczelnie, grupy, buddy, wydarzenia
src/app/actions/locale.ts przełącznik PL/EN
src/lib/i18n/             słowniki PL/EN
src/lib/domain.ts         uczelnie, semestry (kody 2026W / 2027S), kraje
src/lib/groups.ts         nazwy i opisy grup
src/components/           Logo, nawigacja, InstitutionPicker, ProfileForm, AvatarUpload, bx (wspólne UI)
scripts/                  pobieranie (ROR) i import uczelni
supabase/                 migracje, dane startowe i testowe
```
