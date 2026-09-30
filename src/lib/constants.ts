export type Status = "searching" | "going" | "been";

export const STATUS_LABELS: Record<Status, string> = {
  searching: "Szukam kierunku",
  going: "Jadę / jestem na miejscu",
  been: "Byłem/am na Erasmusie",
};

export const STATUS_SHORT: Record<Status, string> = {
  searching: "Szuka",
  going: "Jedzie",
  been: "Był/a",
};

// Semestry od dwóch lat wstecz do roku do przodu, np. "zima 2026/27"
export function semesterOptions(now = new Date()): string[] {
  const year = now.getFullYear();
  const options: string[] = [];
  for (let y = year + 1; y >= year - 3; y--) {
    const label = `${y}/${String(y + 1).slice(2)}`;
    options.push(`lato ${label}`, `zima ${label}`);
  }
  return options;
}

export const RATING_LABELS = {
  rating_university: "Uczelnia",
  rating_city: "Miasto",
  rating_social: "Życie studenckie",
  rating_housing: "Łatwość znalezienia mieszkania",
  rating_exams: "Łatwość zaliczeń",
} as const;

export type ChecklistItem = { key: string; title: string; when: string; details: string };

export const CHECKLIST: { phase: string; items: ChecklistItem[] }[] = [
  {
    phase: "Po zakwalifikowaniu",
    items: [
      { key: "nomination", title: "Nominacja wysłana na uczelnię zagraniczną", when: "zaraz po kwalifikacji", details: "Twoje biuro Erasmusa zgłasza Cię na uczelnię partnerską — sprawdź, czy dostałeś/aś maila z uczelni docelowej." },
      { key: "application", title: "Aplikacja na uczelni zagranicznej", when: "wg terminu uczelni docelowej", details: "Formularz online na uczelni przyjmującej — często z terminem 2–4 miesiące przed semestrem." },
      { key: "olaf", title: "Online Learning Agreement (OLA)", when: "przed wyjazdem", details: "Wybór przedmiotów zatwierdzony przez obie uczelnie. Sprawdź w BeErasmus bazę uznanych przedmiotów!" },
      { key: "grant", title: "Umowa stypendialna podpisana", when: "przed wyjazdem", details: "Umowa z Twoją uczelnią — bez niej nie dostaniesz stypendium." },
      { key: "ols", title: "Test językowy OLS", when: "przed wyjazdem", details: "Obowiązkowy test w Online Language Support (jeśli uczelnia go wymaga)." },
    ],
  },
  {
    phase: "Przygotowanie do wyjazdu",
    items: [
      { key: "housing", title: "Mieszkanie znalezione", when: "2–3 miesiące przed", details: "Zobacz ogłoszenia i zapytaj osoby, które były w Twoim mieście. Nie płać przed obejrzeniem!" },
      { key: "ekuz", title: "Karta EKUZ", when: "miesiąc przed", details: "Europejska Karta Ubezpieczenia Zdrowotnego — bezpłatnie w NFZ." },
      { key: "insurance", title: "Ubezpieczenie NNW i OC", when: "przed wyjazdem", details: "Wiele uczelni wymaga dodatkowego ubezpieczenia." },
      { key: "bank", title: "Karta walutowa / wielowalutowa", when: "przed wyjazdem", details: "Unikniesz przewalutowania przy płatnościach w euro." },
      { key: "travel", title: "Bilet kupiony", when: "przed wyjazdem", details: "" },
    ],
  },
  {
    phase: "Na miejscu",
    items: [
      { key: "arrival", title: "Potwierdzenie przyjazdu (Confirmation of Arrival)", when: "pierwszy tydzień", details: "Podpisane przez uczelnię przyjmującą — wyślij do swojego biura Erasmusa." },
      { key: "tax_id", title: "Lokalny numer podatkowy (np. codice fiscale, NIE)", when: "pierwsze tygodnie", details: "Potrzebny do umowy najmu, SIM, czasem transportu." },
      { key: "transport", title: "Studencki bilet komunikacji", when: "pierwszy tydzień", details: "Zniżki dla studentów bywają ogromne." },
      { key: "la_changes", title: "Zmiany w Learning Agreement", when: "do ~5 tygodni od startu", details: "Jeśli zmieniasz przedmioty, zrób to w terminie." },
    ],
  },
  {
    phase: "Przed powrotem i po powrocie",
    items: [
      { key: "departure", title: "Potwierdzenie pobytu (Confirmation of Stay)", when: "przed wyjazdem do domu", details: "" },
      { key: "tor", title: "Transcript of Records", when: "po sesji", details: "Wykaz ocen z uczelni zagranicznej." },
      { key: "recognition", title: "Uznanie przedmiotów na swojej uczelni", when: "po powrocie", details: "Dodaj swoje przedmioty do bazy BeErasmus — pomożesz następnym!" },
      { key: "report", title: "Raport uczestnika (EU Survey)", when: "po powrocie", details: "" },
      { key: "review", title: "Opinia na BeErasmus", when: "po powrocie", details: "Twoje doświadczenie jest bezcenne dla kolejnych osób." },
    ],
  },
];
