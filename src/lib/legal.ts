// Dane do regulaminu i polityki prywatności. Zmień je tutaj, np. po założeniu firmy.
export const LEGAL = {
  service: "BeeXchange",
  operator: "Jakub Rymarski",
  email: "beeexchangeapp@gmail.com",
  // Region bazy danych Supabase: sprawdź w Supabase → Project Settings → General → Region
  dataRegion: { pl: "Unia Europejska", en: "European Union" },
  effective: "1 października 2026",
  effectiveEn: "1 October 2026",
  minAge: 16,
};

export type LegalSection = { title: string; body: (string | string[])[] };

const L = LEGAL;

export const PRIVACY: Record<"pl" | "en", { title: string; updated: string; sections: LegalSection[] }> = {
  pl: {
    title: "Polityka prywatności",
    updated: `Obowiązuje od ${L.effective}`,
    sections: [
      {
        title: "1. Administrator danych",
        body: [
          `Administratorem Twoich danych osobowych jest ${L.operator}, prowadzący serwis ${L.service} („my”). Kontakt we wszystkich sprawach dotyczących danych: ${L.email}.`,
        ],
      },
      {
        title: "2. Jakie dane zbieramy",
        body: [
          [
            "Dane konta: adres e-mail (służy do logowania; nie pokazujemy go innym użytkownikom). Przy logowaniu przez Google otrzymujemy od Google Twój adres e-mail, imię i nazwisko oraz zdjęcie profilowe.",
            "Dane wpisu, które sam(a) podajesz: imię lub ksywka, uczelnia macierzysta, linki lub numer do kontaktu (Instagram, Facebook, WhatsApp) oraz wpisy: dokąd jedziesz, gdzie jesteś lub byłeś/aś i na jakiej uczelni możesz pomóc (uczelnia i opcjonalnie semestr).",
            "Nie zbieramy zdjęć, wiadomości ani innych treści — kontakt odbywa się poza serwisem, przez podane przez Ciebie konta.",
            "Dane techniczne: adres IP, informacje o przeglądarce i urządzeniu oraz czas zdarzeń zapisywane w logach naszych dostawców w celu zapewnienia bezpieczeństwa i działania serwisu.",
          ],
        ],
      },
      {
        title: "3. Cele i podstawy prawne",
        body: [
          [
            "Założenie i prowadzenie konta oraz pokazywanie Twojego wpisu w wyszukiwarce osób z wymiany: art. 6 ust. 1 lit. b RODO.",
            "Wysyłanie e-maili niezbędnych do działania konta (link do logowania, potwierdzenie adresu): art. 6 ust. 1 lit. b RODO.",
            "Bezpieczeństwo, zapobieganie nadużyciom, moderacja zgłoszonych treści oraz ustalanie i obrona roszczeń: art. 6 ust. 1 lit. f RODO (nasz prawnie uzasadniony interes).",
            "Wypełnianie obowiązków prawnych, np. odpowiadanie na żądania uprawnionych organów: art. 6 ust. 1 lit. c RODO.",
          ],
          "Nie stosujemy automatycznego podejmowania decyzji ani profilowania. Wyszukiwarka pokazuje wpisy pasujące do wybranego kraju, miasta i uczelni.",
          "Podanie adresu e-mail jest niezbędne do założenia konta. Pozostałe dane są dobrowolne, ale bez nich dopasowania będą mniej trafne.",
        ],
      },
      {
        title: "4. Kto widzi Twoje dane",
        body: [
          [
            "Twój wpis (imię lub ksywka, kontakty, uczelnie i semestry) widzą wyłącznie zalogowani użytkownicy serwisu. Niezalogowani widzą tylko liczbę osób, bez żadnych danych. Uczelnię macierzystą pokazujemy tylko w zakładce „Twój buddy”.",
            "Linki do Instagrama i Facebooka oraz numer WhatsApp podajesz dobrowolnie; prowadzą do usług tych firm, na których zasady prywatności nie mamy wpływu.",
            "Twojego adresu e-mail nie pokazujemy innym użytkownikom.",
          ],
          "Dane powierzamy dostawcom, którzy przetwarzają je w naszym imieniu:",
          [
            `Supabase Inc.: baza danych i logowanie (serwery w regionie: ${L.dataRegion.pl}).`,
            "Vercel Inc.: hosting aplikacji internetowej.",
            "Google LLC: logowanie przez Google i wysyłka e-maili z serwisu.",
          ],
          "Vercel i Google mogą przetwarzać dane w USA. Transfer odbywa się na podstawie decyzji Komisji Europejskiej o odpowiednim stopniu ochrony (EU-US Data Privacy Framework) lub standardowych klauzul umownych. Nie sprzedajemy Twoich danych i nie przekazujemy ich reklamodawcom.",
        ],
      },
      {
        title: "5. Jak długo przechowujemy dane",
        body: [
          "Dane konta i wpisu przechowujemy do czasu usunięcia konta. Po usunięciu konta natychmiast usuwamy wpis, kontakty i uczelnie. Kopie zapasowe i logi techniczne dostawców mogą je zawierać jeszcze do 30 dni, po czym są nadpisywane.",
          "Zgłoszenia naruszeń możemy przechowywać do roku od ich rozpatrzenia, jeśli jest to potrzebne do ochrony innych użytkowników lub obrony roszczeń.",
        ],
      },
      {
        title: "6. Twoje prawa",
        body: [
          [
            "dostęp do danych i otrzymanie ich kopii,",
            "sprostowanie danych (zmienisz je sam(a) w „Mój wpis”),",
            "usunięcie danych (przycisk „Usuń moje dane” w „Mój wpis”),",
            "ograniczenie przetwarzania,",
            "przenoszenie danych,",
            "sprzeciw wobec przetwarzania opartego na prawnie uzasadnionym interesie,",
            "skarga do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa).",
          ],
          `Aby skorzystać z praw, napisz na ${L.email}. Odpowiemy w ciągu miesiąca.`,
        ],
      },
      {
        title: "7. Pliki cookies",
        body: [
          "Używamy wyłącznie niezbędnych plików cookies: do utrzymania zalogowania (sesja) i zapamiętania wybranego języka. Nie używamy cookies reklamowych ani analitycznych, dlatego nie prosimy o zgodę na cookies. Możesz je usunąć w ustawieniach przeglądarki, ale wtedy zostaniesz wylogowany(-a).",
        ],
      },
      {
        title: "8. Wiek",
        body: [`Serwis jest przeznaczony dla osób, które ukończyły ${L.minAge} lat.`],
      },
      {
        title: "9. Zmiany polityki",
        body: ["O istotnych zmianach poinformujemy w serwisie lub e-mailem z wyprzedzeniem. Aktualna wersja jest zawsze dostępna na tej stronie."],
      },
    ],
  },
  en: {
    title: "Privacy policy",
    updated: `Effective from ${L.effectiveEn}`,
    sections: [
      { title: "1. Data controller", body: [`The controller of your personal data is ${L.operator}, operating ${L.service} ("we"). Contact for all data matters: ${L.email}.`] },
      {
        title: "2. Data we collect",
        body: [
          [
            "Account data: email address (used to log in; never shown to other users). When you sign in with Google, we receive your email address, name and profile picture from Google.",
            "Listing data you provide: name or nickname, home university, contact links or number (Instagram, Facebook, WhatsApp) and entries: where you are going, where you are or have been and where you can help (university and optional semester).",
            "We do not collect photos, messages or other content — people contact each other outside the service, through the accounts you provide.",
            "Technical data: IP address, browser and device information and timestamps stored in our providers' logs for security and operation.",
          ],
        ],
      },
      {
        title: "3. Purposes and legal bases",
        body: [
          [
            "Creating and running your account and showing your listing in the exchange people search: Art. 6(1)(b) GDPR.",
            "Emails necessary for your account (login link, email confirmation): Art. 6(1)(b) GDPR.",
            "Security, abuse prevention, moderation of reported content and legal claims: Art. 6(1)(f) GDPR (legitimate interest).",
            "Legal obligations, e.g. requests from authorities: Art. 6(1)(c) GDPR.",
          ],
          "We do not use automated decision-making or profiling. The search shows listings matching the chosen country, city and university.",
          "Your email is required to create an account. Other data is optional, but without it matching will be less accurate.",
        ],
      },
      {
        title: "4. Who can see your data",
        body: [
          [
            "Your listing (name or nickname, contacts, universities and semesters) is visible only to signed-in users. Visitors who are not signed in see only the number of people, without any data. Your home university is shown only under “Your buddy”.",
            "Instagram and Facebook links and your WhatsApp number are provided voluntarily; they lead to those companies' services, whose privacy rules we do not control.",
            "Your email address is never shown to other users.",
          ],
          "We use processors acting on our behalf:",
          [
            `Supabase Inc.: database and authentication (servers in: ${L.dataRegion.en}).`,
            "Vercel Inc.: web hosting.",
            "Google LLC: Sign in with Google and sending emails.",
          ],
          "Vercel and Google may process data in the USA based on the EU-US Data Privacy Framework adequacy decision or standard contractual clauses. We do not sell your data or share it with advertisers.",
        ],
      },
      {
        title: "5. Retention",
        body: [
          "We keep account and listing data until you delete your account. On deletion we immediately remove your listing, contacts and universities. Provider backups and technical logs may contain them for up to 30 days before being overwritten.",
          "Abuse reports may be kept for up to one year after review where needed to protect other users or defend legal claims.",
        ],
      },
      {
        title: "6. Your rights",
        body: [
          [
            "access to your data and a copy of it,",
            "rectification (you can change your data yourself in “My listing”),",
            "erasure (the “Delete my data” button in “My listing”),",
            "restriction of processing,",
            "data portability,",
            "objection to processing based on legitimate interest,",
            "complaint to the supervisory authority (in Poland: President of the Personal Data Protection Office, ul. Stawki 2, 00-193 Warszawa).",
          ],
          `To exercise your rights, email ${L.email}. We will reply within one month.`,
        ],
      },
      {
        title: "7. Cookies",
        body: [
          "We only use strictly necessary cookies: to keep you logged in (session) and to remember your language. We do not use advertising or analytics cookies, so no cookie consent is needed. You can delete them in your browser settings, which will log you out.",
        ],
      },
      { title: "8. Age", body: [`The service is intended for people aged ${L.minAge} or older.`] },
      { title: "9. Changes", body: ["We will announce material changes in the service or by email in advance. The current version is always available on this page."] },
    ],
  },
};

export const TERMS: Record<"pl" | "en", { title: string; updated: string; sections: LegalSection[] }> = {
  pl: {
    title: "Regulamin",
    updated: `Obowiązuje od ${L.effective}`,
    sections: [
      {
        title: "§1. Postanowienia ogólne",
        body: [
          `Regulamin określa zasady korzystania z serwisu internetowego ${L.service} („Serwis”). Usługodawcą jest ${L.operator}, kontakt: ${L.email} („Usługodawca”).`,
          "Regulamin jest regulaminem w rozumieniu ustawy o świadczeniu usług drogą elektroniczną. Zakładając konto, akceptujesz Regulamin i Politykę prywatności.",
          `${L.service} jest niezależnym projektem i nie jest powiązany z programem Erasmus+, Komisją Europejską, Erasmus Student Network ani z żadną uczelnią.`,
        ],
      },
      {
        title: "§2. Usługi",
        body: [
          "Serwis umożliwia bezpłatnie:",
          [
            "założenie konta i prowadzenie wpisu (imię lub ksywka, uczelnia macierzysta, kontakty, wymiany),",
            "wyszukiwanie osób, które jadą na wymianę, są lub były na wymianie albo mogą pomóc na danej uczelni,",
            "dodawanie brakujących uczelni do bazy.",
          ],
          "Umowa o świadczenie usług zostaje zawarta na czas nieokreślony z chwilą założenia konta. Możesz ją rozwiązać w każdej chwili, usuwając dane w „Mój wpis”.",
        ],
      },
      {
        title: "§3. Wymagania techniczne",
        body: [
          "Do korzystania z Serwisu potrzebujesz urządzenia z dostępem do internetu, aktualnej przeglądarki (np. Chrome, Firefox, Safari, Edge) z włączonym JavaScriptem i plikami cookies oraz aktywnego adresu e-mail.",
        ],
      },
      {
        title: "§4. Konto",
        body: [
          [
            `Konto może założyć osoba, która ukończyła ${L.minAge} lat.`,
            "Podajesz prawdziwe dane i nie podszywasz się pod inne osoby. Jedna osoba może mieć jedno konto.",
            "Dbasz o bezpieczeństwo swojej skrzynki e-mail, bo służy ona do logowania.",
          ],
        ],
      },
      {
        title: "§5. Zasady korzystania",
        body: [
          "Zabronione jest w szczególności:",
          [
            "publikowanie treści bezprawnych, obraźliwych, nawołujących do nienawiści lub dyskryminacji oraz nękanie innych użytkowników,",
            "spam oraz reklama bez zgody Usługodawcy,",
            "oszustwa, w tym wyłudzanie płatności (np. zaliczek za mieszkania) i pieniędzy,",
            "udostępnianie cudzych danych osobowych bez zgody,",
            "podszywanie się pod inne osoby, uczelnie lub organizacje,",
            "przesyłanie złośliwego oprogramowania, automatyczne pobieranie danych (scraping) i obchodzenie zabezpieczeń Serwisu.",
          ],
        ],
      },
      {
        title: "§6. Treści użytkowników i kontakty",
        body: [
          "Odpowiadasz za treści, które publikujesz. Udzielasz Usługodawcy nieodpłatnej, niewyłącznej licencji na ich przechowywanie i wyświetlanie w Serwisie na czas, w którym się w nim znajdują.",
          "Usługodawca nie weryfikuje informacji podawanych przez użytkowników ani kont w serwisach społecznościowych, do których prowadzą wpisy. Kontakt i spotkania to ustalenia między użytkownikami. Na spotkania chodź z rozwagą i nigdy nie wpłacaj pieniędzy nieznajomym (np. zaliczek za mieszkanie) bez sprawdzenia.",
        ],
      },
      {
        title: "§7. Zgłoszenia i moderacja",
        body: [
          `Nielegalne lub naruszające Regulamin treści możesz zgłosić przyciskiem „Zgłoś” albo e-mailem na ${L.email}.`,
          "Usługodawca może usunąć treść naruszającą prawo lub Regulamin, a przy poważnych lub powtarzających się naruszeniach zablokować lub usunąć konto. O decyzji i jej powodach informujemy użytkownika e-mailem, chyba że nie pozwala na to prawo. Od decyzji możesz się odwołać, pisząc na adres kontaktowy.",
        ],
      },
      {
        title: "§8. Odpowiedzialność",
        body: [
          "Dokładamy starań, aby Serwis działał bez przerw, ale mogą występować przerwy techniczne i błędy. Informacje o uczelniach pochodzą z otwartego rejestru ROR i mają charakter orientacyjny.",
          "Usługodawca nie odpowiada za treści użytkowników ani za skutki ustaleń i spotkań między nimi, z zastrzeżeniem odpowiedzialności wynikającej z bezwzględnie obowiązujących przepisów.",
        ],
      },
      {
        title: "§9. Reklamacje",
        body: [`Reklamacje dotyczące działania Serwisu wysyłaj na ${L.email}, opisując problem. Odpowiemy w ciągu 14 dni.`],
      },
      {
        title: "§10. Zmiany Regulaminu i postanowienia końcowe",
        body: [
          "O zmianach Regulaminu poinformujemy w Serwisie lub e-mailem co najmniej 7 dni przed ich wejściem w życie. Jeśli nie akceptujesz zmian, możesz usunąć konto.",
          "W sprawach nieuregulowanych stosuje się prawo polskie. Konsument może skorzystać z pozasądowych sposobów rozwiązywania sporów, np. pomocy miejskiego lub powiatowego rzecznika konsumentów. Postanowienia Regulaminu nie ograniczają praw konsumentów wynikających z przepisów prawa.",
        ],
      },
    ],
  },
  en: {
    title: "Terms of service",
    updated: `Effective from ${L.effectiveEn}`,
    sections: [
      {
        title: "§1. General",
        body: [
          `These Terms govern the use of the ${L.service} website (the “Service”). The provider is ${L.operator}, contact: ${L.email} (the “Provider”).`,
          "By creating an account you accept these Terms and the Privacy policy.",
          `${L.service} is an independent project and is not affiliated with the Erasmus+ programme, the European Commission, the Erasmus Student Network or any university.`,
        ],
      },
      {
        title: "§2. Services",
        body: [
          "The Service lets you, free of charge:",
          [
            "create an account and a listing (name or nickname, home university, contacts, exchanges),",
            "search for people going on exchange, there now or before, or able to help at a given university,",
            "add missing universities to the database.",
          ],
          "The agreement is concluded for an indefinite period when you create an account. You can terminate it at any time by deleting your data in “My listing”.",
        ],
      },
      { title: "§3. Technical requirements", body: ["You need an internet-connected device, an up-to-date browser (e.g. Chrome, Firefox, Safari, Edge) with JavaScript and cookies enabled, and an active email address."] },
      {
        title: "§4. Account",
        body: [[`You must be at least ${L.minAge} years old.`, "Provide true information and do not impersonate others. One person may have one account.", "Keep your email inbox secure, as it is used to log in."]],
      },
      {
        title: "§5. Rules",
        body: [
          "It is prohibited in particular to:",
          [
            "post unlawful, offensive, hateful or discriminatory content, or harass other users,",
            "send spam or advertising without the Provider's consent,",
            "commit fraud, including soliciting payments (e.g. housing deposits) or money,",
            "share other people's personal data without consent,",
            "impersonate other people, universities or organisations,",
            "upload malware, scrape data or circumvent the Service's security.",
          ],
        ],
      },
      {
        title: "§6. User content and contacts",
        body: [
          "You are responsible for the content you post. You grant the Provider a free, non-exclusive licence to store and display it in the Service for as long as it remains there.",
          "The Provider does not verify information provided by users or the social media accounts that listings link to. Contact and meetups are arrangements between users. Meet with care and never send money to strangers (e.g. housing deposits) without checking.",
        ],
      },
      {
        title: "§7. Reports and moderation",
        body: [
          `You can report unlawful or rule-breaking content with the “Report” button or by email to ${L.email}.`,
          "The Provider may remove content that breaks the law or these Terms and, for serious or repeated violations, block or delete the account. We inform the user of the decision and its reasons by email unless the law prevents it. You can appeal by writing to the contact address.",
        ],
      },
      {
        title: "§8. Liability",
        body: [
          "We strive to keep the Service running, but technical interruptions and errors may occur. University information comes from the open ROR registry and is indicative only.",
          "The Provider is not liable for user content or the consequences of arrangements and meetings between users, except where mandatory law provides otherwise.",
        ],
      },
      { title: "§9. Complaints", body: [`Send complaints about the Service to ${L.email}, describing the problem. We will reply within 14 days.`] },
      {
        title: "§10. Changes and final provisions",
        body: [
          "We will announce changes to these Terms in the Service or by email at least 7 days before they take effect. If you do not accept them, you can delete your account.",
          "Polish law applies. Consumers may use out-of-court dispute resolution, e.g. a municipal consumer ombudsman. These Terms do not limit consumer rights under mandatory law.",
        ],
      },
    ],
  },
};
