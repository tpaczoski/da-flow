# DA Flow v1 (stan zamrożony 08.11.2026)

DA Flow to strona do analizy intraday z order flow i profilu wolumenu, oparta na eksportach Delta Analyzera (DA). Działa na 14 instrumentach: US500, US100, US30, RTY, SPY, GOLD, DE40, FR40, EU50, UK100, J225, HK50, CN50 i VIX. Pokazuje analizę, nie rekomendacje. Elementy mają status z testów z grupą kontrolną.

Prototyp: https://claude.ai/artifact/U3kvrSe5CiPA43no3ZRWAw (wersja 95 = v1).

## Pliki

| Plik | Rola |
|---|---|
| `head.html` | `<head>`: tytuł, tokeny kolorów (jasny i ciemny), cały CSS |
| `body.html` | Nagłówek, panel ustawień (Zestaw, Wykres, Świeca, Przepływ, Poziomy, Profile, Widok), pływające okna, wykres, legenda i opis |
| `app.js` | Cała logika strony: wczytanie danych, render wykresu, profili, poziomów i okien, historia zdarzeń, odtwarzanie |
| `build.py` | Składa `footprint_us500.html` = head + body + osadzone `data/US500.json` + app.js |
| `export.py` | Eksport z danych DA do `data/<INST>.json`. Uruchomienie: `python3 export.py US500`, osobno dla każdego instrumentu |
| `tools/em_merge.py` | Dokleja do `data/US500.json` pole `em` (EM, kontekst GEX, profil strike'ów) z danych dnia DN. Uruchamiać **po** `export.py US500` |
| `tools/makro.py` | Kalendarz makro: `data/makro.json`, czas polski, źródła BLS, BEA, Fed, EBC, BoE, BoJ, ISM. Docelowo plik dostarcza zespół danych |
| `tools/opt_hist_export.py` | Archiwum zrzutów łańcucha SPX z DN: `data/opt_hist.json` (okno zakresu tygodnia) |
| `tools/build_opcje_dn.py` | Strona `opcje_dn.html` z oknem opcji z DN 1.9.2 (kod DN bez zmian, osadzony w ramce) |
| `data/*.json` | Dane: 14 instrumentów, `makro.json`, `opt_hist.json` |
| `footprint_us500.html` | Zbudowana strona |
| `opcje_dn.html` | Zbudowane okno opcji DN |
| `research/*.py` | Testy statusów (opis niżej) |

### Kolejność budowy

```
python3 export.py <INST>                                     # każdy instrument
python3 tools/em_merge.py                                    # po eksporcie US500
python3 tools/makro.py                                       # kalendarz
python3 tools/opt_hist_export.py                             # archiwum opcji (wymaga intraday_v1/data/opcje_hist)
python3 /home/claude/intraday_v1/tools/build_mid.py --export # dane DN mid term (optd)
python3 tools/build_opcje_dn.py                              # okno opcji DN
python3 build.py                                             # strona
```

Publikacja: strona `footprint_us500.html` oraz pliki obok niej: `data/<INST>.json` (13 instrumentów poza US500), `data/makro.json`, `data/opt_hist.json` i `opcje_dn.html`.

Zależności od repozytorium DN (`/home/claude/intraday_v1`):
- `engine/core/fp5.load_flex`, `tools/flex_m1` (eksport);
- `data/footprint_5m`, `data/m1`, `data/rdzen/rdzen_dziennik.csv` (poziomy opcji);
- `out/data_*.json` (EM i OI);
- `data/opcje_hist`;
- szablon `template/raport_godzinowy_v1_3.template.html` (okno opcji).

## Format danych `data/<INST>.json`

Klucz to data sesji RRRR-MM-DD. Sesja DA trwa od ok. 23:00 dnia poprzedniego. Czas polski.

- `boxes[i]`: świeca M5 jako `[t 'HH:MM', O, H, L, C, VAH, POC, VAL (VA dzienna z końca świecy), x (wolumen / średnia 5 sesji tej pory), rth (0/1), approx, hPL, hET, vix_start, vix_end, vix_approx]`
- `cells`: `[i świecy, cena, bid, ask]` (footprint)
- `h1x`: krotność wolumenu H1
- `vix_open`, `vix`: dane VIX
- `m1`: świece M1 DA, jeśli są
- `src`: źródło danych
- `opt`: poziomy z rdzenia DN, tylko US500: `snap`, `em`, `F`, `emH`, `emL`, `cw`, `pw`, `flip`, `gmin`, `gex`, `baza`
- `em`: łańcuch SPX z DN, tylko US500, dni ze zrzutem: `rows` (EM 1–7 DTE), `ctx` (GEX, ściany, flip, IV, RR/BF, P/C), `prof` `[strike, wol. call, wol. put, OI call, OI put]`, `gexk`, `basis`

## Funkcje (definicje)

**Wykres.**
- Interwały: M1, M5, M15, M30, H1 oraz świece wolumenowe V1000, V2000, V5000.
- Zakres: sesja kasowa albo cała doba.
- Krok ceny: stały lub auto.
- Odtwarzanie świeca po świecy. Wszystkie okna, profile i historia liczą tylko świece do bieżącej.
- Hash URL: `#inst=&day=&t=`.
- Zestawy ustawień: Czysty, Intraday, Pełny, Własne.

**Świeca.** Delta, bid × ask, wolumen. Imbalans diagonalny 3:1, min. 20 kontraktów.

**Przepływ.**
- **Strefy imbalansów:** co najmniej 3 imbalanse na kolejnych poziomach. Strefy nakładające się w kolejnych świecach są łączone, z licznikiem świec.
- **Strefy z poprzednich sesji.**
- **Niedokończone aukcje (UA).**
- **Wyczerpanie (W) i absorpcja (A):** czerwone na szczycie, zielone na dołku.
- **DVMZ:** wolumen ≥ 1,8 × średnia i zakres ≤ 0,6 ATR(20). Kółko nad świecą spadkową na czerwono, pod wzrostową na zielono.
- **Dywergencje:** Δ, CVD, wol, z potwierdzeniem VIX.
- **HVN / LVN:** z profilu narastającego.
- **TPO max / min.**

**Poziomy.**
- VA dzienna;
- VWAP: sesja, doba albo kotwica, z pasmami ±1σ i ±2σ;
- PDH, PDL, PDC, ONH, ONL, IB z rozszerzeniami;
- naked POC, VAH, VAL z 5 sesji;
- opcje DN (EM, środek EM, ściany, flip, najgłębszy GEX; tylko US500);
- ATR5 z paskiem zużycia;
- VA kroczące 60–240 min.

**Waga poziomu.** Liczba różnych grup poziomów w odległości ± max(2 kroki, 4% ATR5). Grupy: D-1, noc, IB, naked, opcje, VA. Waga ≥ 2 to pogrubiona linia z gwiazdkami ★★ albo ★★★.

**Profile.**
- Przed sesją, sesja kasowa, cała doba, D-1 doba, D-1 sesja, 5 sesji, ostatnie 60–240 min, profil zaznaczenia.
- Drzewo bid × ask, z opcjonalnym wolumenem obok.
- Pod profilami: OHLC oraz zgodność z VIX (przed sesją, sesja kasowa, cała doba, ostatnie 60–240 min, zaznaczenie; tylko US500).
- GEX i ściany z opcji na profilu „cała doba”.

**Okna** (pływające, przesuwane, zapamiętują pozycję; kliknięte okno wychodzi na wierzch):
1. **Status VA.**
   - Wiersze: Last 60–240, przed sesją, sesja kasowa, Daily, D-1 doba, D-1 sesja kasowa, 5 Daily.
   - Kolory: pod VAL czerwony, w VA niebieski, nad VAH zielony.
   - Względem POC: sell albo buy. Migracja wobec poprzedniego odczytu.
   - Pasek zgodności horyzontów −100…+100: 9 okien, ±1 za położenie i ±0,5 za migrację.
   - Mapa poziomów względem ceny z celownikiem, przełącznik „dziś” lub „+ D-1 i 5 Daily”.
2. **Cena, delta i wolumen 10 dni:** OHLC, delta, delta skumulowana i wolumen z 10 sesji.
3. **Intraday:** świece 15, 30 lub 60 min z 5 min, z OHLC, deltą, CVD i wolumenem.
4. **Historia zdarzeń.**
   - Typy: wybicie poziomu, VA dzienna, VWAP, naked, opcje, strefy, strefy D-n, dywergencje, W/A, DVMZ, zmiana znaku acc Δ, HVN/LVN, UA, sesja, makro.
   - Potwierdzenie w interwałach 5′, 15′, 30′ i 60′: delta w stronę wybicia ≥ 10% wolumenu i wolumen ≥ 1,2 × średnia 5 sesji. ✔ w co najmniej 3 interwałach = potwierdzone.
   - Informacja „co dalej”: powrót w ciągu 6 świec (fałszywe), utrzymane albo w toku.
   - Gwiazdki wagi i filtr „tylko ważne”.
5. **Kalendarz makro:** linie na wykresie i reakcja rynku 5′, 30′, 60′ w punktach i ATR.
6. **Zgodność rynków:** grupa regionu, liderzy innych regionów, VIX odwrotnie, GOLD bez oceny. Zmiana od otwarcia sesji kasowej i od początku doby, 30′, 60′, delta doby, VA.
7. **Opcje SPX jak w DN 1.9.2:** ramka z `opcje_dn.html`. Zakładki: EM, profil strike'ów, mapa tygodnia, struktura terminowa, skew, P/C, delta wolumenu, zmiany OI.
8. **Zakres na najbliższy tydzień z opcji (1–5 DTE):**
   - stożek EM z ostatniego zrzutu;
   - migracja wobec wybranego wcześniejszego zrzutu, liczona jako ruch na 1 dzień (EM/√DTE);
   - GEX = 0 (gamma flip) każdej serii;
   - zamknięcia przy wygaśnięciu, w zakresie albo poza.

## Statusy z testów (14 rynków, dane 5 min, sesje 15.10–06.11.2026)

| Element | Wynik | Status |
|---|---|---|
| QM (US500, M5 z M1) | +0,72R wobec losowych wejść, przedział 90%: +0,44 do +1,01 | obserwacja (zamrożone 08.11, wyniki poza próbką od 09.11) |
| Strefy imbalansów nakładające się | ≈ +1 pp wobec losowej strefy tej samej szerokości | bez przewagi (sama informacja) |
| Fazy Wyckoffa intraday | −0,02R wobec −0,01R w grupie kontrolnej | bez przewagi |
| Zgodność horyzontów VA (pasek) | po zgodności ≥ ±20 cena cofa się o ok. 0,33 ATR w 60 min | opis, „test: brak kontynuacji” |
| Potwierdzenie wybić (5/15/30/60) | utrzymane 47% wobec 39% bez potwierdzenia; w sesjach +5 pp (przedział 90%: 0 do +10) | obserwacja |
| Wyjście z VA dziennej z potwierdzeniem | 51% wobec 37%, ruch +0,46 wobec −0,12 ATR (n 178 / 984) | obserwacja, najlepszy kandydat |
| POC dzienny, VWAP i pasma | brak różnicy | bez przewagi |
| Naked POC/VA, pierwszy test | 75% wobec 70% dla losowych nietkniętych poziomów (w parach sesja–rynek +11 pp) | obserwacja (najwyraźniej D-1) |
| Opcje DN (przejścia poziomów) | 4 dni z łańcuchem | zbieranie danych |
| Odwrócone strefy imbalansów (v1.3, test 11.11, 12 rynków, n 8649) | trzyma 65,6% wobec 66,8% dla losowego przedziału; z deltą retestu w stronę odwrócenia +0,9 pp (90%: −0,5 do +2,3) | bez przewagi (✕Δ – obserwacja) |
| DVMZ, waga poziomów, VIX pod profilami, zgodność rynków, makro, acc Δ | nie testowane | opis |

Skrypty w katalogu `research/`:
- `zgodnosc_test.py`;
- `wybicia_test.py` (poziomy, VA, POC, VWAP, opcje);
- `naked_test.py`;
- `imb_nakladanie.py`.

QM i fazy są w repozytorium DN: `research/qm`, `research/fazy`.

## Ograniczenia v1

- **Dane offline:** strona działa na eksportach. Zasilanie na żywo to zadanie dla zespołu danych.
- **Krótka historia:** 9–13 sesji na instrument (US500 i GOLD więcej). Archiwum opcji ma 7 zrzutów.
- **VIX w eksporcie:** bywa zgrubny w obrębie godziny i często kończy się przed końcem sesji.
- **Ręcznie wpisany kalendarz makro:** październik–listopad 2026. Godzina decyzji BoJ jest orientacyjna.
- **OI calli 06.11:** w eksporcie Barchart prawie zerowe.
- **Okno DN w ramce:** panel „Wolumen DA” jest pusty (brak footprintu H1 z DN). Przycisk „linie na wykresie” jest ukryty.
- **Wydajność:** przy wszystkich warstwach render jest odczuwalny. Do sprawdzenia przy 40+ instrumentach.

## Zmiany po v1

- v1.1: uwięzieni traderzy (UT).
- v1.2: footprint wielu interwałów, dziennik zdarzeń poza próbą, wygaszanie stref bez ★★.
- v1.3 (11.11.2026): odwrócone strefy imbalansów (ODW, przełącznik w „Przepływ”, typ w historii zdarzeń; test `intraday_v1/research/imb_flip`); okno „Profile sesji” (5 poprzednich sesji + wybrana, noc/sesja kasowa, VA, POC, delta, nPOC do 20 sesji wstecz, ✓ = zmitygowany); sesje US500 09–11.11 dołożone `tools/add_day.py`.

## v1.4 (14.11.2026) – znacznik stanu w nagłówku
- Obok tytułu: **SYGNAŁ / ZABLOKOWANY / CZEKAJ** – ta sama logika co etap Filtr w specyfikacji bota. Sygnałem są tylko reguły v0:
  R1 = pierwsze zamknięcie nad PDH (long) / pod PDL (short) w sesji kasowej; R2 = absorpcja przy poziomie ★★. Liczone na ostatniej świecy w widoku i poprzedniej (w odtwarzaniu – na bieżącej).
- Blokady: makro wysokiej wagi ± 15 min, ATR zużyty > 100% (gdy ATR z ≥ 3 sesji), ostatnie 30 min sesji DA.
- Szare flagi braków: odtwarzanie, dane sesji niepełne (do HH:MM), brak zrzutu opcji (US500), kalendarz makro w trakcie wczytywania.
- Poprawka: skok odtwarzania do godziny (`S.rpT`) szuka dokładnej świecy – wcześniej dni sprzed zmiany czasu przesuwały się o kilka świec.
- Zależy od warstw włączonych na wykresie (wyłączona warstwa wybić = R1 niewidoczne). Analiza rynku, nie rekomendacja.

## v1.5 (14.11.2026) – stan dwóch profili i R3
- W znaczniku: **dzień: RÓWNOWAGA / NAD / POD** = POC sesji kasowej (do świecy i−1) względem VA sprzed sesji; liczone od 2. godziny sesji.
- **R3** = odbicie od krawędzi VA sesji (high ≥ VAH sesji i zamknięcie z powrotem w VA nad POC → short; lustrzanie long) tylko w RÓWNOWADZE, szerokość VA ≥ 0,10 ATR 5D; cel POC sesji.
  Status: obserwacja (research/dwa_profile: DA Flow +0,30 R vs losowe, n 68; M1 US500 +0,25, n 33, przedział obejmuje zero, działało w X–XI).
- R1 oznaczone „niepotwierdzone” (M1 US500 24.08–13.11 poza próbą: ok. −0,2 R, n 21/35). Sygnały opisane jako „SYGNAŁ – OBSERWACJA”: żadna reguła nie ma potwierdzonej przewagi.

## v1.6 (14.11.2026) – opcje w czasie (1 DTE przed sesją, 0 DTE od otwarcia)
- `tools/opt_0dte.py <sesja> [katalog eksportu]` → `DATA[sesja].opt0`: przed sesją kasową poziomy z łańcucha N DTE z zamknięcia poprzedniej sesji
  (EM = straddle ATM, środek z parytetu, ściany calli/putów z OI, max GEX); od otwarcia zrzuty 0 DTE co 15 min: pasmo ±1σ do zamknięcia (IV ATM × √czasu do końca),
  ściany z OI (w pasie 24 strike'ów wokół ceny), najaktywniejszy call/put z wolumenu narastającego, linia zera i topy gamma×delta (model gd-v1), jeśli są.
- Rysowane odcinkami w czasie (warstwa „opcje (DN)”), pionowa linia „0 DTE od 15:30”. Baza US500 − SPX = mediana ze zrzutów dnia (zrzut o t ≈ zamknięcie świecy t−5); bez zrzutów 0 DTE baza −2,5.
- Policzone dla sesji US500 16.10–13.11 z eksportu z 14.11 (1 DTE tam, gdzie jest łańcuch z poprzedniego dnia). Status: zbieranie danych / opis.
