# DA Flow na GitHub Pages

Publiczna kopia panelu **DA Flow v1.9** (konto [tpaczoski/da-flow](https://github.com/tpaczoski/da-flow)).
Czas na stronie: polski (**Europe/Warsaw**, oznaczenie PL).

* Panel: [footprint_us500.html](footprint_us500.html) (albo [index.html](index.html))
* US500 na żywo: [live_us500.html](live_us500.html) — profil sesji (POC, VAH, VAL 70 %) oraz footprint M5 / M15 / H1, odświeżany co 60 s z `live/US500_live.json`

`out/` i wyjścia `tools/` nie są publikowane. Źródła panelu (`app.js`, `head.html`, `body.html`, `build.py`) zostają w repozytorium, żeby po zmianie złożyć stronę ponownie: `python3 build.py`.

## Aktualizacja US500 na żywo co 5 minut

Dane minutowe (prawdziwy bid/ask) pochodzą z zalogowanej karty ttechou, z `flex/latest`. Endpoint wymaga sesji; skrypt tylko scala i wypycha gotowy plik.

### (a) W zalogowanej karcie ttechou (computerUse)

Wklej i uruchom w konsoli przeglądarki na stronie ttechou (albo w tej samej origin). Plik trafi do `/home/box/Downloads/` jako `flex_US500_<YYYYMMDD_HHMM>.json` (czas PL):

```javascript
(async () => {
  const url = 'https://ttechou.com/24h/api/volume-profile/flex/latest?customConfig=US500&isBacktest=false';
  const r = await fetch(url, { credentials: 'include' });
  const st = r.status;
  const text = await r.text();
  let j = null, b = null;
  if (st === 200) {
    try { j = JSON.parse(text); } catch (e) { b = text; }
  } else {
    b = text;
  }
  const payload = { t: new Date().toISOString(), r: [{ url, st, b, j }] };
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date()).map(x => [x.type, x.value]));
  const name = `flex_US500_${p.year}${p.month}${p.day}_${p.hour}${p.minute}.json`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: 'application/json' }));
  a.download = name;
  a.click();
})();
```

Otoczka `{ t, r: [{ url, st, b, j }] }` jest taka sama jak w przykładowym odczycie. Wejście z HTTP 401 albo puste M1 kończy skrypt kodem ≠ 0.

### (b) Złożenie i push

```bash
cd /workspace/raporty/da_flow_site
python3 update_live.py /home/box/Downloads/flex_US500_YYYYMMDD_HHMM.json
```

Skrypt scala nowe świece M1 do `/workspace/raporty/flex_live/store/US500_<D>.json` (sesja D zaczyna się o 23:00 PL dnia poprzedniego; ta sama minuta — późniejszy odczyt wygrywa), zapisuje cały dotychczasowy dzień do `live/US500_live.json` i gdy plik się zmieni, robi `git commit -m "live US500 HH:MM"` oraz wypycha **tylko** ten plik. Wymaga `GITHUB_DAFLOW_TOKEN` w środowisku (nie wpisuj tokena do plików ani do czatu).

## Dzienna paczka data/ (po buildzie 23:00)

Instrumenty w `data/*.json` mają ten sam układ co wynik `build_all_pack.py` (sesja: `boxes`, `cells`, `h1x`, `m1`, `src`, `vix`, `vix_open`; przy US500 także przenoszone `opt` / `em`). Dlatego wolno podmieniać **tylko pliki instrumentów**.

`build_all_pack.py` **nie** produkuje i **nie** aktualizuje `data/dclose.json`, `data/opt_hist.json` ani `data/makro.json`. Nie nadpisuj ich paczką. Ponadto v1.9 czyta pole `opt0` (zrzuty 0 DTE) — builder go nie zapisuje i przy nadpisaniu sesji go nie przenosi; gdy pojawi się w US500, trzeba je zachować osobno (jak `opt`/`em`).

```bash
cd /workspace/raporty/da_flow_site
./push_daily.sh
# albo wskaż ZIP wprost:
./push_daily.sh /workspace/raporty/da_flow_fx/out/DA_Flow_all_2026-11-16.zip
```

Skrypt bierze najnowszy `DA_Flow_all_*.zip` z `out/`, kopiuje `data/<INST>.json` 39 rynków, zostawia `makro.json` / `opt_hist.json` / `dclose.json` w spokoju i wypycha commit `dane DA Flow RRRR-MM-DD`. Strony HTML nie rusza.
