# Sesje rynków w DA Flow – noc / sesja kasowa / po sesji

Stan: 16.11.2026 (DA Flow v1.9, 39 rynków z paczki 13.11). Czas: polski (CET / CEST).

## 1. Doba DA i trzy części dnia

- **Doba DA** – dla wszystkich rynków od 23:00 do 22:55 czasu polskiego (17:00 czasu nowojorskiego). Świeca od 23:00 należy do sesji D+1.
- **Sesja kasowa (RTH)** – godziny głównej giełdy danego rynku. W danych pole `rth` (`boxes[i][9] = 1`), ustawiane przez eksport DA osobno dla każdego rynku i z uwzględnieniem zmiany czasu.
- **Noc** – od zamknięcia poprzedniej sesji kasowej do otwarcia bieżącej, **także przez granicę doby DA**. To świece doby D-1 po sesji kasowej plus świece doby D przed otwarciem.
- **Po sesji** – świece doby D po zamknięciu sesji kasowej. Następnego dnia stają się początkiem nocy.

Przed 16.11 noc liczyliśmy tylko ze świec doby DA przed otwarciem. Dla rynków azjatyckich dawało to 1–2 godziny, np. J225 23:00–01:00, zamiast całego okresu od zamknięcia Tokio.

## 2. Plan sesji (czas polski, zima: od 01.11.2026)

| Grupa | Rynki | Sesja kasowa | Noc | Uwagi |
|---|---|---|---|---|
| Indeksy USA | US500, US100, US30, RTY, VIX | 15:30–22:00 | 22:00 D-1 → 15:30 | |
| Złoto | GOLD | 14:20–19:30 | 19:30 D-1 → 14:20 | godziny parkietu COMEX |
| Indeksy Europa | DE40, FR40, EU50, UK100 | 09:00–17:30 | 17:30 D-1 → 09:00 | UK100: LSE 08:00–16:30 czasu Londynu |
| Japonia | J225 | 01:00–07:30 | 07:30 D-1 → 01:00 | przerwa obiadowa Tokio 03:30–04:30 (CFD notuje, w danych liczona do sesji) |
| Hongkong | HK50 | 02:30–09:00 | 09:00 D-1 → 02:30 | przerwa 05:00–06:00 (w danych liczona do sesji) |
| Chiny | CN50 | 02:00–09:30 | 09:30 D-1 → 02:00 | |
| Waluty | 18 par FX (z USDHKD) i DXY | 09:00–18:00 | 18:00 D-1 → 09:00 | godziny Londynu 08:00–17:00 |
| Ropa, gaz | OIL_CRUDE, NATURALGAS | 15:00–20:30 | 20:30 D-1 → 15:00 | godziny parkietu NYMEX |
| Srebro | SILVER | 14:25–19:25 | 19:25 D-1 → 14:25 | COMEX |
| Miedź | COPPER | 14:10–19:00 | 19:00 D-1 → 14:10 | COMEX |
| Krypto | BTCUSD, ETHUSD | 15:30–22:00 | 22:00 D-1 → 15:30 | handel 24/7; jako sesję kasową dane przyjmują sesję USA |
| ETF | SPY, QQQ | 15:30–22:00 | – | tylko sesja kasowa, 9 sesji do 29.10 |

## 3. Zmiana czasu

USA i Europa zmieniają czas w różne dni: wiosną różnica wynosi 2–3 tygodnie, jesienią tydzień. Japonia, Hongkong i Chiny nie zmieniają czasu wcale.

Godziny w czasie polskim przesuwają się wtedy o godzinę. Przykład z danych: US500 26–30.10.2026 miał sesję 14:30–21:00, bo Europa była już na czasie zimowym, a USA jeszcze nie. J225 do 23.10 miał 02:00–08:30, od 26.10 ma 01:00–07:30.

DA Flow niczego tu nie liczy sam: bierze `rth` z danych, a eksport DA ustawia godziny poprawnie.

## 4. Co korzysta z nowej definicji nocy (od 16.11)

- **ONH / ONL (noc)** na wykresie, poziomy odniesienia.
- **Wybicia ONH / ONL** w historii zdarzeń.
- **Profil „Noc”** po prawej (dawniej „Przed sesją”): świece D-1 po sesji + doba do otwarcia. W odtwarzaniu ucięte do świecy w widoku.

Funkcja w kodzie: `nightOf(DATA, day)` w `app.js`.

## 5. Co zostaje po staremu (świadomie)

- **Reguła R3 i stan dnia** (dwa profile: POC sesji vs VA przed sesją) oraz **„przed sesją” w oknie statusu VA i zgodności** liczą VA ze świec doby DA przed otwarciem. To definicje zamrożonych testów; zmiana wymaga ponownego testu.
- **Testy laboratorium oparte na nocy** (zakres nocny z agresją, range przedsesyjny) liczono starą definicją. Dla J225, HK50 i CN50 noc miała 1–2 h, więc te wyniki dla rynków azjatyckich są nieporównywalne. Do ponownego przeliczenia nową definicją.
- **VA 24 h, pierwsze 90 min sesji, PDH/PDL, IB, oczekiwany zakres godziny** – bez zmian: liczone względem sesji kasowej albo w oknie kroczącym, działają na każdym rynku.

## 6. Do zrobienia przy kodowaniu (z Michałem)

1. Plan sesji jako dane, a nie tylko pole `rth`: noc / sesja kasowa / przerwa / po sesji dla każdego rynku, z kalendarzem zmian czasu, np. dla łącznika Rithmic / IBKR, gdzie pola `rth` nie ma.
2. Opcjonalnie przerwa obiadowa J225 i HK50 jako osobny odcinek (dziś w sesji).
3. Przeliczenie testów nocnych na wszystkich rynkach nową definicją.
4. Decyzja, czy R3 / stan dnia przejść na nową noc (nowy test, nowa data zamrożenia).
