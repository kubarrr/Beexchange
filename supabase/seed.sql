-- BeErasmus: dane startowe (koszty orientacyjne, do weryfikacji przez społeczność)
-- Uruchom po 0001_init.sql

insert into public.cities (slug, name, country, country_flag, avg_rent, avg_monthly_cost, description, tips) values
('mediolan', 'Mediolan', 'Włochy', '🇮🇹', 750, 1250,
 'Stolica mody i biznesu, najdroższe miasto Erasmusa we Włoszech. Świetnie skomunikowane (metro, pociągi do całych Włoch), dużo studentów z zagranicy i mnóstwo aperitivo.',
 'Mieszkania znikają błyskawicznie — zacznij szukać 2–3 miesiące przed wyjazdem.
Popularne dzielnice: Città Studi (blisko Polimi), Navigli, Porta Romana, NoLo, Lambrate.
Nigdy nie płać kaucji przed obejrzeniem mieszkania (choćby na wideo) i podpisaniem umowy.
Bilet miesięczny ATM dla studentów do 27 lat jest dużo tańszy — wyrób go od razu.
Codice fiscale załatwisz w Agenzia delle Entrate — potrzebny do umowy najmu i SIM.'),
('rzym', 'Rzym', 'Włochy', '🇮🇹', 550, 1050,
 'Wieczne miasto z największą uczelnią w Europie (Sapienza). Zabytki na każdym kroku, tańsze niż Mediolan, ale komunikacja potrafi zawieść.',
 'Dzielnice studenckie: San Lorenzo (blisko Sapienzy), Pigneto, Trastevere (drożej).
Komunikacja miejska bywa zawodna — licz dojazd z zapasem.'),
('bolonia', 'Bolonia', 'Włochy', '🇮🇹', 500, 950,
 'Najstarszy uniwersytet świata i najbardziej studenckie miasto we Włoszech. Świetne jedzenie, wszędzie blisko pieszo lub rowerem.',
 'Rynek pokoi jest bardzo ciasny na początku semestru — szukaj wcześnie.
Centrum (zona universitaria) da się obejść pieszo.'),
('turyn', 'Turyn', 'Włochy', '🇮🇹', 450, 900,
 'Eleganckie, spokojniejsze i tańsze niż Mediolan. Silny Politechnik, blisko Alp.',
 'Dzielnice: San Salvario, Crocetta (blisko Polito), Vanchiglia.'),
('florencja', 'Florencja', 'Włochy', '🇮🇹', 550, 1000,
 'Kolebka renesansu, małe i piękne miasto pełne turystów i studentów sztuki.',
 'Czynsze w centrum są wysokie przez turystykę — rozważ Campo di Marte lub Novoli.'),
('padwa', 'Padwa', 'Włochy', '🇮🇹', 450, 850,
 'Kameralne miasto uniwersyteckie 30 minut od Wenecji. Tanio, rowerowo i bardzo studencko.',
 'Rower to podstawowy środek transportu. Do Wenecji pociągiem regionalnym za kilka euro.'),
('barcelona', 'Barcelona', 'Hiszpania', '🇪🇸', 600, 1100,
 'Plaża, Gaudí i imprezy. Jeden z najpopularniejszych kierunków Erasmusa w Europie.',
 'Uważaj na oszustwa mieszkaniowe i kieszonkowców (szczególnie metro i Las Ramblas).
Dzielnice: Gràcia, Eixample, Poble-sec, Sant Antoni.'),
('madryt', 'Madryt', 'Hiszpania', '🇪🇸', 550, 1050,
 'Stolica Hiszpanii — tętniące życiem miasto z mnóstwem uczelni i świetną komunikacją.',
 'Abono Joven (do 26 lat) — bardzo tani bilet miesięczny na całą komunikację.
Dzielnice: Malasaña, Lavapiés, Moncloa (blisko kampusów).'),
('walencja', 'Walencja', 'Hiszpania', '🇪🇸', 400, 800,
 'Plaża, paella i niższe koszty niż w Barcelonie i Madrycie. Idealne na pierwszy Erasmus.',
 'Dzielnice: Benimaclet (studencka), Ruzafa, El Carmen.'),
('lizbona', 'Lizbona', 'Portugalia', '🇵🇹', 600, 1050,
 'Słoneczna, pagórkowata i coraz droższa. Świetna atmosfera i ocean pod nosem.',
 'Czynsze mocno wzrosły — szukaj wcześnie i uważaj na ogłoszenia bez możliwości obejrzenia.'),
('porto', 'Porto', 'Portugalia', '🇵🇹', 450, 850,
 'Klimatyczne miasto nad rzeką Douro, tańsze i spokojniejsze niż Lizbona.',
 'Dzielnice: Bonfim, Cedofeita, okolice Asprela (kampus).');

insert into public.universities (slug, city_id, name, short_name, website, description) values
('politecnico-di-milano', (select id from public.cities where slug='mediolan'), 'Politecnico di Milano', 'Polimi', 'https://www.polimi.it', 'Najlepsza uczelnia techniczna we Włoszech: inżynieria, architektura, design.'),
('bocconi', (select id from public.cities where slug='mediolan'), 'Università Bocconi', 'Bocconi', 'https://www.unibocconi.it', 'Prestiżowa uczelnia ekonomiczna i biznesowa.'),
('unimi', (select id from public.cities where slug='mediolan'), 'Università degli Studi di Milano', 'Statale', 'https://www.unimi.it', 'Duży uniwersytet publiczny: prawo, medycyna, nauki humanistyczne i ścisłe.'),
('bicocca', (select id from public.cities where slug='mediolan'), 'Università di Milano-Bicocca', 'Bicocca', 'https://www.unimib.it', 'Nowoczesny kampus na północy miasta.'),
('cattolica', (select id from public.cities where slug='mediolan'), 'Università Cattolica del Sacro Cuore', 'Cattolica', 'https://www.unicatt.it', 'Prywatny uniwersytet: ekonomia, prawo, komunikacja.'),
('sapienza', (select id from public.cities where slug='rzym'), 'Sapienza Università di Roma', 'Sapienza', 'https://www.uniroma1.it', 'Największy uniwersytet w Europie.'),
('roma-tre', (select id from public.cities where slug='rzym'), 'Università Roma Tre', 'Roma Tre', 'https://www.uniroma3.it', ''),
('luiss', (select id from public.cities where slug='rzym'), 'LUISS Guido Carli', 'LUISS', 'https://www.luiss.it', 'Prywatna uczelnia: ekonomia, prawo, nauki polityczne.'),
('unibo', (select id from public.cities where slug='bolonia'), 'Università di Bologna', 'UniBo', 'https://www.unibo.it', 'Najstarszy uniwersytet świata (1088).'),
('polito', (select id from public.cities where slug='turyn'), 'Politecnico di Torino', 'Polito', 'https://www.polito.it', 'Silna uczelnia techniczna, dużo kursów po angielsku.'),
('unito', (select id from public.cities where slug='turyn'), 'Università di Torino', 'UniTo', 'https://www.unito.it', ''),
('unifi', (select id from public.cities where slug='florencja'), 'Università degli Studi di Firenze', 'UniFi', 'https://www.unifi.it', ''),
('unipd', (select id from public.cities where slug='padwa'), 'Università degli Studi di Padova', 'UniPd', 'https://www.unipd.it', 'Jeden z najstarszych uniwersytetów w Europie.'),
('ub', (select id from public.cities where slug='barcelona'), 'Universitat de Barcelona', 'UB', 'https://www.ub.edu', ''),
('upc', (select id from public.cities where slug='barcelona'), 'Universitat Politècnica de Catalunya', 'UPC', 'https://www.upc.edu', ''),
('upf', (select id from public.cities where slug='barcelona'), 'Universitat Pompeu Fabra', 'UPF', 'https://www.upf.edu', ''),
('uab', (select id from public.cities where slug='barcelona'), 'Universitat Autònoma de Barcelona', 'UAB', 'https://www.uab.cat', 'Kampus poza miastem (Bellaterra).'),
('ucm', (select id from public.cities where slug='madryt'), 'Universidad Complutense de Madrid', 'UCM', 'https://www.ucm.es', ''),
('upm', (select id from public.cities where slug='madryt'), 'Universidad Politécnica de Madrid', 'UPM', 'https://www.upm.es', ''),
('uc3m', (select id from public.cities where slug='madryt'), 'Universidad Carlos III de Madrid', 'UC3M', 'https://www.uc3m.es', ''),
('uv', (select id from public.cities where slug='walencja'), 'Universitat de València', 'UV', 'https://www.uv.es', ''),
('upv', (select id from public.cities where slug='walencja'), 'Universitat Politècnica de València', 'UPV', 'https://www.upv.es', ''),
('ulisboa', (select id from public.cities where slug='lizbona'), 'Universidade de Lisboa', 'ULisboa', 'https://www.ulisboa.pt', ''),
('nova', (select id from public.cities where slug='lizbona'), 'Universidade NOVA de Lisboa', 'NOVA', 'https://www.unl.pt', ''),
('uporto', (select id from public.cities where slug='porto'), 'Universidade do Porto', 'U.Porto', 'https://www.up.pt', '');
