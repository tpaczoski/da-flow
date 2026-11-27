#!/usr/bin/env python3
"""Budowa data/US500_cta.json — proxy presji CTA / vol-control dla okna DA Flow (podgląd).

Źródła zamknięć:
  - US500: M1/DA na boxie (tabela_decyzyjna, eksport M1, dclose, US500.json, flex live)
  - jeśli lokalnie < 200 sesji: publiczne dzienne ^GSPC (Yahoo Finance chart API, bez logowania).
    Stooq /q/d/l/ zwraca barierę JS (POW), dlatego nie CSV ze stooq.
    Historia przed pierwszym dniem US500 (i luki) = poziomy US500 przeskalowane
    ze stóp zwrotu ^GSPC (splice w pierwszym wspólnym dniu).

VIX: wyłącznie nasze dane (VIX.json, flex_live/store, pole ve przy świecach US500).
Delta: footprint DA (cells / lv), ask − bid, ostatnie 15 sesji.

To proxy z ceny i przepływu — nie dane o pozycjach funduszy i nie liczby z raportów banków.
"""
from __future__ import annotations

import json
import math
import sys
import urllib.request
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

SITE = Path(__file__).resolve().parent
OUT = SITE / "data" / "US500_cta.json"
CACHE_GSPC = SITE / "data" / "gspc_yahoo_cache.json"
YAHOO_GSPC = "https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1d&range=2y"
TZ = ZoneInfo("Europe/Warsaw")
TARGET_VOL = 0.10
EXPO_CAP = 1.5
SMA_NS = (20, 50, 100, 200)
RV_NS = (20, 60)
FLOW_N = 15
ANN = math.sqrt(252)

TABELA_M1 = Path("/workspace/raporty/tabela_decyzyjna/dane/m1/US500")
M1_HIST = Path("/workspace/raporty/forward_test_DA/data/US500_m1_hist.pkl")
DCLOSE = SITE / "data" / "dclose.json"
US500_JSON = SITE / "data" / "US500.json"
LIVE_DAY = SITE / "live" / "US500_day.json"
# live folder is copied from original site
FLEX_STORE = Path("/workspace/raporty/flex_live/store")
VIX_JSON = SITE / "data" / "VIX.json"


def now_waw() -> datetime:
    return datetime.now(TZ)


def session_of(ts: datetime) -> date:
    local = ts.astimezone(TZ)
    d = local.date()
    if local.hour >= 23:
        d = d + timedelta(days=1)
    return d


def sess_min(clock) -> int:
    """Minuty od początku sesji DA (~23:00), żeby 23:55 było *wcześniej* niż 17:30."""
    if clock is None:
        return -1
    s = str(clock).strip()
    # ISO → zegar warszawski
    if "T" in s:
        t = parse_ts(s)
        if not t:
            return -1
        h, m = t.hour, t.minute
    else:
        try:
            hh, mm = s.split(":")[:2]
            h, m = int(hh), int(mm)
        except Exception:
            return -1
    return (h * 60 + m - 23 * 60 + 1440) % 1440


def parse_ts(val) -> datetime | None:
    if val is None:
        return None
    if isinstance(val, datetime):
        t = val
        return t.replace(tzinfo=TZ) if t.tzinfo is None else t.astimezone(TZ)
    s = str(val).strip()
    if not s:
        return None
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        t = datetime.fromisoformat(s)
    except ValueError:
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M:%S"):
            try:
                t = datetime.strptime(s[:19], fmt)
                break
            except ValueError:
                t = None
        if t is None:
            return None
    if t.tzinfo is None:
        t = t.replace(tzinfo=TZ)
    return t.astimezone(TZ)


def _put(series: dict, day: str, close: float, src: str, ts=None, overwrite: bool = False):
    if close is None or not math.isfinite(close):
        return
    rec = series.get(day)
    if rec is None or overwrite:
        series[day] = {"c": float(close), "src": src, "ts": ts}
        return
    # keep the later timestamp (true session close if we get a later bar)
    old_ts = rec.get("ts")
    if ts and (not old_ts or ts >= old_ts):
        rec["c"] = float(close)
        rec["src"] = src
        rec["ts"] = ts


def load_tabela(series: dict) -> None:
    if not TABELA_M1.is_dir():
        return
    import csv
    for p in sorted(TABELA_M1.glob("*.csv")):
        day = p.stem
        last = None
        last_ts = None
        with p.open(encoding="utf-8", newline="") as f:
            r = csv.DictReader(f)
            for row in r:
                ts = parse_ts(row.get("timestamp") or row.get("time"))
                try:
                    c = float(row.get("C") or row.get("c") or row.get("price"))
                except (TypeError, ValueError):
                    continue
                last, last_ts = c, ts
        if last is not None:
            _put(series, day, last, "US500 M1 tabela_decyzyjna", last_ts, overwrite=True)


def load_dclose(series: dict) -> None:
    if not DCLOSE.is_file():
        return
    obj = json.loads(DCLOSE.read_text(encoding="utf-8"))
    block = obj.get("US500") or {}
    for d, c in block.items():
        if d not in series:
            _put(series, d, float(c), "US500 dclose.json")


def load_us500_json(series: dict, deltas: dict) -> None:
    if not US500_JSON.is_file():
        return
    data = json.loads(US500_JSON.read_text(encoding="utf-8"))
    for day, D in data.items():
        boxes = D.get("boxes") or []
        if not boxes:
            continue
        last = boxes[-1]
        # last clock HH:MM of DA day; treat as Warsaw clock
        ts = None
        try:
            hh, mm = map(int, str(last[0]).split(":")[:2])
            base = date.fromisoformat(day)
            # 23:xx belongs to session day but is previous calendar evening
            cal = base - timedelta(days=1) if hh >= 23 else base
            ts = datetime.combine(cal, time(hh, mm), TZ)
        except Exception:
            ts = None
        _put(series, day, float(last[4]), "US500.json DA Flow", ts, overwrite=True)
        cells = D.get("cells") or []
        if cells:
            dlt = vol = 0.0
            for row in cells:
                if len(row) < 4:
                    continue
                _, _, bd, ak = row[:4]
                bd = bd or 0
                ak = ak or 0
                dlt += ak - bd
                vol += ak + bd
            deltas[day] = {"delta": dlt, "vol": vol, "src": "US500.json cells", "niepelna": bool(D.get("niepelna"))}


def load_live_day(series: dict, deltas: dict, vix_pts: dict) -> None:
    for path, src in (
        (LIVE_DAY, "live/US500_day.json"),
        (Path("/workspace/raporty/da_flow_site/live/US500_day.json"), "live/US500_day.json"),
    ):
        if not path.is_file():
            continue
        D = json.loads(path.read_text(encoding="utf-8"))
        day = D.get("session")
        boxes = D.get("boxes") or []
        if not day or not boxes:
            continue
        last = boxes[-1]
        ts = None
        try:
            hh, mm = map(int, str(last[0]).split(":")[:2])
            base = date.fromisoformat(day)
            cal = base - timedelta(days=1) if hh >= 23 else base
            ts = datetime.combine(cal, time(hh, mm), TZ)
        except Exception:
            ts = None
        _put(series, day, float(last[4]), src, ts, overwrite=True)
        cells = D.get("cells") or []
        if cells:
            dlt = vol = 0.0
            for row in cells:
                if len(row) < 4:
                    continue
                _, _, bd, ak = row[:4]
                bd = bd or 0
                ak = ak or 0
                dlt += ak - bd
                vol += ak + bd
            # prefer richer cell set
            old = deltas.get(day)
            if old is None or (vol >= (old.get("vol") or 0)):
                deltas[day] = {"delta": dlt, "vol": vol, "src": src + " cells", "niepelna": bool(D.get("niepelna"))}
        for b in boxes:
            ve = b[14] if len(b) > 14 else None
            vs = b[13] if len(b) > 13 else None
            val = ve if ve is not None else vs
            if val is None:
                continue
            t = b[0]
            rec = vix_pts.get(day)
            if rec is None or sess_min(t) >= sess_min(rec.get("t")):
                vix_pts[day] = {"v": float(val), "t": t, "src": src + " ve/vs"}


def load_m1_hist(series: dict) -> None:
    if not M1_HIST.is_file():
        return
    try:
        import pickle
        import pandas as pd  # noqa: F401
        obj = pickle.load(open(M1_HIST, "rb"))
    except Exception as e:
        print("build_cta: m1_hist pominięty:", e)
        return
    if obj is None or len(obj) == 0:
        return
    if "sday" in obj.columns and "C" in obj.columns:
        for sday, g in obj.groupby("sday", sort=True):
            d = str(sday)[:10]
            last = g.iloc[-1]
            ts = parse_ts(last["timestamp"]) if "timestamp" in g.columns else None
            if d not in series:
                _put(series, d, float(last["C"]), "US500 m1_hist.pkl", ts)


def load_flex_today(series: dict, deltas: dict, vix_pts: dict) -> None:
    today = session_of(now_waw()).isoformat()
    p = FLEX_STORE / f"US500_{today}.json"
    # also try yesterday file if after midnight before 23:00 — already handled by session_of
    if not p.is_file():
        files = sorted(FLEX_STORE.glob("US500_2026-*.json"))
        p = files[-1] if files else None
    if p and p.is_file():
        obj = json.loads(p.read_text(encoding="utf-8"))
        day = obj.get("session") or today
        bars = obj.get("bars") or []
        if isinstance(bars, dict):
            bars = list(bars.values())
        bars = [b for b in bars if b.get("c") is not None]
        bars.sort(key=lambda b: b.get("t") or "")
        if bars:
            last = bars[-1]
            ts = parse_ts(last.get("t"))
            _put(series, day, float(last["c"]), f"flex_live {p.name}", ts, overwrite=True)
            dlt = vol = 0.0
            n_lv = 0
            for b in bars:
                for row in b.get("lv") or []:
                    if len(row) < 3:
                        continue
                    bd, ak = row[1] or 0, row[2] or 0
                    dlt += ak - bd
                    vol += ak + bd
                    n_lv += 1
            if n_lv:
                old = deltas.get(day)
                if old is None or vol >= (old.get("vol") or 0):
                    deltas[day] = {"delta": dlt, "vol": vol, "src": f"flex_live {p.name} lv", "niepelna": True}

    # VIX flex all days
    for vp in sorted(FLEX_STORE.glob("VIX_20*.json")):
        try:
            obj = json.loads(vp.read_text(encoding="utf-8"))
        except Exception:
            continue
        day = obj.get("session") or vp.stem.split("_", 1)[-1]
        bars = obj.get("bars") or []
        if isinstance(bars, dict):
            bars = list(bars.values())
        bars = [b for b in bars if b.get("c") is not None]
        if not bars:
            continue
        bars.sort(key=lambda b: b.get("t") or "")
        last = bars[-1]
        rec = vix_pts.get(day)
        ts = last.get("t") or ""
        if rec is None or sess_min(ts) >= sess_min(rec.get("t")):
            vix_pts[day] = {"v": float(last["c"]), "t": ts, "src": vp.name}


def load_vix_json(vix_pts: dict) -> None:
    if not VIX_JSON.is_file():
        return
    data = json.loads(VIX_JSON.read_text(encoding="utf-8"))
    for day, D in data.items():
        boxes = D.get("boxes") or []
        last_c = last_t = None
        for b in boxes:
            if b[4] is None:
                continue
            last_c, last_t = float(b[4]), b[0]
        if last_c is None:
            continue
        rec = vix_pts.get(day)
        if rec is None or sess_min(last_t) >= sess_min(rec.get("t")):
            vix_pts[day] = {"v": last_c, "t": last_t, "src": "data/VIX.json"}


def fetch_gspc() -> tuple[dict[str, float], str]:
    note = ""
    raw = None
    # cache z tej samej doby (Warsaw) — żeby hook godzinowy w 10 s nie czekał na sieć
    if CACHE_GSPC.is_file():
        mt = datetime.fromtimestamp(CACHE_GSPC.stat().st_mtime, TZ)
        if mt.date() == now_waw().date():
            raw = CACHE_GSPC.read_bytes()
            note = "Yahoo Finance ^GSPC z cache z dzisiaj (public chart API, bez logowania)"
            obj = json.loads(raw.decode("utf-8"))
            res = obj["chart"]["result"][0]
            ts, close = res["timestamp"], res["indicators"]["quote"][0]["close"]
            out = {}
            for t, c in zip(ts, close):
                if c is None:
                    continue
                d = datetime.fromtimestamp(t, timezone.utc).astimezone(ZoneInfo("America/New_York")).date().isoformat()
                out[d] = float(c)
            return out, note
    try:
        req = urllib.request.Request(YAHOO_GSPC, headers={"User-Agent": "Mozilla/5.0 DA-Flow-preview"})
        with urllib.request.urlopen(req, timeout=8) as r:
            raw = r.read()
        CACHE_GSPC.parent.mkdir(parents=True, exist_ok=True)
        CACHE_GSPC.write_bytes(raw)
        note = "Yahoo Finance public chart API ^GSPC (pobrane teraz, bez logowania)"
    except Exception as e:
        if CACHE_GSPC.is_file():
            raw = CACHE_GSPC.read_bytes()
            note = f"Yahoo Finance ^GSPC z cache ({CACHE_GSPC.name}); pobranie nieudane: {type(e).__name__}"
        else:
            raise SystemExit(f"brak ^GSPC: {e}")
    obj = json.loads(raw.decode("utf-8"))
    res = obj["chart"]["result"][0]
    ts = res["timestamp"]
    close = res["indicators"]["quote"][0]["close"]
    out = {}
    for t, c in zip(ts, close):
        if c is None:
            continue
        # data sesji kasowej USA: znacznik Yahoo jest w UTC, data = dzień w America/New_York
        d = datetime.fromtimestamp(t, timezone.utc).astimezone(ZoneInfo("America/New_York")).date().isoformat()
        out[d] = float(c)
    return out, note


def sma(vals: list[float], n: int) -> float | None:
    if len(vals) < n:
        return None
    return sum(vals[-n:]) / n


def rv_ann(closes: list[float], n: int) -> float | None:
    if len(closes) < n + 1:
        return None
    rets = []
    w = closes[-(n + 1):]
    for a, b in zip(w, w[1:]):
        if a > 0 and b > 0:
            rets.append(math.log(b / a))
    if len(rets) < max(5, n // 2):
        return None
    mu = sum(rets) / len(rets)
    var = sum((x - mu) ** 2 for x in rets) / (len(rets) - 1)
    return math.sqrt(var) * ANN


def fmt_pl(d: str) -> str:
    y, m, day = d.split("-")
    return f"{day}.{m}.{y}"


def build() -> dict:
    series: dict = {}
    deltas: dict = {}
    vix_pts: dict = {}

    load_dclose(series)
    load_m1_hist(series)
    load_tabela(series)  # prefer richer local M1
    load_us500_json(series, deltas)
    load_live_day(series, deltas, vix_pts)
    load_flex_today(series, deltas, vix_pts)
    load_vix_json(vix_pts)

    local_days = sorted(series)
    local_n = len(local_days)
    local_from = local_days[0] if local_days else None
    local_to = local_days[-1] if local_days else None

    gspc, gspc_note = fetch_gspc()
    gspc_days = sorted(gspc)

    # splice: scale GSPC to US500 at first local overlap day
    splice_day = None
    for d in local_days:
        if d in gspc:
            splice_day = d
            break
    if splice_day is None:
        raise SystemExit("brak wspólnego dnia US500 i ^GSPC do splice")
    scale = series[splice_day]["c"] / gspc[splice_day]
    gaps_filled = []
    pre_filled = []
    for d in gspc_days:
        if d in series:
            continue
        if d < local_from:
            _put(series, d, gspc[d] * scale, "US500←^GSPC splice", overwrite=False)
            pre_filled.append(d)
        elif d <= local_to:
            _put(series, d, gspc[d] * scale, "US500←^GSPC luka", overwrite=False)
            gaps_filled.append(d)
        # po ostatnim dniu lokalnym nie dokładamy samego GSPC (nie ma jeszcze dziś / inna sesja)

    days = sorted(series)
    # drop weekend accidents
    days = [d for d in days if date.fromisoformat(d).weekday() < 5]
    closes = [series[d]["c"] for d in days]

    rows = []
    sma_hist = {n: [] for n in SMA_NS}
    for i, d in enumerate(days):
        sl = closes[: i + 1]
        rec = {
            "d": d,
            "c": round(closes[i], 4),
            "src": series[d]["src"],
        }
        for n in SMA_NS:
            v = sma(sl, n)
            rec[f"sma{n}"] = None if v is None else round(v, 4)
        for n in RV_NS:
            v = rv_ann(sl, n)
            rec[f"rv{n}"] = None if v is None else round(v, 6)
        vx = vix_pts.get(d)
        rec["vix"] = None if not vx else round(vx["v"], 4)
        if rec["rv20"]:
            expo = TARGET_VOL / rec["rv20"]
            rec["exposure"] = round(min(EXPO_CAP, max(0.0, expo)), 4)
        else:
            rec["exposure"] = None
        rows.append(rec)

    last = rows[-1]
    price = last["c"]
    last_day = last["d"]
    last_ts = series[last_day].get("ts")
    # niepełna: brak zamknięcia po 22:00 PL albo znacznik źródła
    niepelna = False
    if last_ts:
        if last_ts.timetz() and last_ts.hour * 60 + last_ts.minute < 22 * 60:
            niepelna = True
    if "flex" in (last["src"] or "") or "live" in (last["src"] or ""):
        # flex of the current session is typically still running / last bar not official close
        if last_ts and last_ts.date() == now_waw().date() and (now_waw().hour < 23):
            # after 22:00 still maybe ETH; mark incomplete until 22:55
            if not last_ts or last_ts.hour < 22 or (last_ts.hour == 22 and last_ts.minute < 50):
                niepelna = True

    # trend
    sma_tbl = {}
    signs = []
    flips = []
    n_avail = 0
    for n in SMA_NS:
        v = last.get(f"sma{n}")
        if v is None:
            sma_tbl[str(n)] = {"value": None, "dist_pts": None, "dist_pct": None, "sign": None, "ok": False}
            continue
        n_avail += 1
        dist = price - v
        sign = 1 if dist > 0 else (-1 if dist < 0 else 0)
        signs.append(sign)
        sma_tbl[str(n)] = {
            "value": round(v, 2),
            "dist_pts": round(dist, 2),
            "dist_pct": round(100.0 * dist / v, 3),
            "sign": sign,
            "ok": True,
        }
        flips.append({
            "n": n,
            "price": round(v, 2),
            "side": "powyżej" if sign > 0 else ("poniżej" if sign < 0 else "na średniej"),
            "dist_pts": round(dist, 2),
            "d_signal": None,  # filled after T known
        })
    T = (sum(signs) / len(signs)) if signs else None

    # d_signal if that SMA is crossed (that component flips by 2/n_avail)
    step = (2 / n_avail) if n_avail else 0
    for fl, s in zip(flips, signs):
        # crossing against current side flips this sign
        fl["d_signal"] = round(-s * step, 4)
        fl["signal_after"] = round(max(-1, min(1, (T or 0) - s * step)), 4)

    nearest = None
    if flips:
        nearest = min(flips, key=lambda x: abs(x["dist_pts"]))

    # vol
    rv20 = last.get("rv20")
    rv60 = last.get("rv60")
    expo = last.get("exposure")
    expo_5d = None
    if len(rows) >= 6:
        expo_5d = rows[-6].get("exposure")
    chg5 = None if expo is None or expo_5d is None else round(expo - expo_5d, 4)
    vix_now = last.get("vix")
    vix_meta = vix_pts.get(last_day) or {}
    # if today's vix missing, use last available
    vix_day = last_day
    if vix_now is None:
        for rec in reversed(rows):
            if rec.get("vix") is not None:
                vix_now = rec["vix"]
                vix_day = rec["d"]
                vix_meta = vix_pts.get(vix_day) or {}
                break

    # flow last 15 sessions with delta
    delta_days = [d for d in days if d in deltas]
    flow_days = delta_days[-FLOW_N:]
    flow_rows = []
    cum = 0.0
    prev_c = None
    # previous close: from full series
    close_map = {r["d"]: r["c"] for r in rows}
    day_index = {d: i for i, d in enumerate(days)}
    d_up = d_dn = 0.0
    n_up = n_dn = n_flat = 0
    for d in flow_days:
        c = close_map.get(d)
        # prev trading day close
        i = day_index.get(d)
        prev = close_map.get(days[i - 1]) if i and i > 0 else None
        chg = None if c is None or prev is None else c - prev
        sign = 0 if chg is None or chg == 0 else (1 if chg > 0 else -1)
        dd = deltas[d]
        cum += dd["delta"]
        if sign > 0:
            d_up += dd["delta"]
            n_up += 1
        elif sign < 0:
            d_dn += dd["delta"]
            n_dn += 1
        else:
            n_flat += 1
        flow_rows.append({
            "d": d,
            "d_pl": fmt_pl(d),
            "c": None if c is None else round(c, 2),
            "chg": None if chg is None else round(chg, 2),
            "sign": sign,
            "delta": round(dd["delta"], 1),
            "vol": round(dd["vol"], 1),
            "cum": round(cum, 1),
            "src": dd.get("src"),
            "niepelna": bool(dd.get("niepelna")),
        })
    ratio = None
    if d_up != 0:
        ratio = round(d_dn / d_up, 3)
    elif d_dn != 0:
        ratio = float("inf")

    # summary from 1+2 only
    # vol leg: 5D exposure change scaled so 0.10 (10 pp target / typowa duża zmiana) = ±1
    vol_leg = None
    if chg5 is not None:
        vol_leg = max(-1.0, min(1.0, chg5 / 0.10))
    combined = None
    parts = []
    if T is not None:
        parts.append(T)
    if vol_leg is not None:
        parts.append(vol_leg)
    if parts:
        combined = sum(parts) / len(parts)
    if combined is None:
        label = "Brak wystarczających danych"
    elif combined >= 0.15:
        label = "Bliżej kupowania"
    elif combined <= -0.15:
        label = "Bliżej sprzedawania"
    else:
        label = "Bez wyraźnej przewagi (blisko neutralnego)"

    vix_days = sorted(vix_pts)
    asof = now_waw()
    chart_rows = rows[-260:]  # ok. rok + zapas na SMA200

    disclaimer = (
        "To jest proxy liczone z zamknięć US500, zrealizowanej zmienności, naszego VIX i delty footprintu. "
        "Nie są to dane o pozycjach funduszy CTA ani vol-control i nie pochodzą z raportów banków. "
        "Sygnał trendu = średnia arytmetyczna znaków (cena − SMA 20/50/100/200), skala −1…+1. "
        "Ekspozycja vol-control = min(1,5, max(0, 10% / RV20)). "
        "Podsumowanie „bliżej kupowania/sprzedawania” łączy tylko trend i zmianę ekspozycji 5D — nie liczby o przepływach funduszy."
    )

    obj = {
        "asof": asof.isoformat(timespec="seconds"),
        "asof_pl": asof.strftime("%d.%m.%Y %H:%M"),
        "session": last_day,
        "sesja_niepelna": bool(niepelna),
        "price": round(price, 2),
        "price_ts": last_ts.isoformat(timespec="seconds") if last_ts else None,
        "price_ts_pl": last_ts.strftime("%d.%m.%Y %H:%M") if last_ts else None,
        "sources": {
            "us500_local": {
                "from": local_from,
                "to": local_to,
                "n": local_n,
                "opis": "Zamknięcia sesji US500 (ostatnia świeca doby DA, czas Europe/Warsaw). M1 tabela_decyzyjna, US500.json, flex live, dclose.",
            },
            "gspc_public": {
                "from": gspc_days[0] if gspc_days else None,
                "to": gspc_days[-1] if gspc_days else None,
                "n": len(gspc_days),
                "opis": gspc_note,
                "splice_day": splice_day,
                "splice_scale": round(scale, 6),
                "stooq": "Stooq /q/d/l/ zwrócił barierę JS (POW), bez CSV — użyto publicznego API Yahoo ^GSPC, bez logowania.",
            },
            "gaps_filled_from_gspc": gaps_filled,
            "pre_history_from_gspc_n": len(pre_filled),
            "vix": {
                "from": vix_days[0] if vix_days else None,
                "to": vix_days[-1] if vix_days else None,
                "n": len(vix_days),
                "opis": "Tylko nasze dane VIX (data/VIX.json, flex_live/store, ve/vs przy US500). Brak uzupełniania z Yahoo/^VIX.",
            },
            "delta": {
                "from": flow_days[0] if flow_days else None,
                "to": flow_days[-1] if flow_days else None,
                "n": len(flow_days),
                "opis": "Delta dzienna = suma (ask − bid) z komórek footprintu / lv flex, cała doba DA.",
            },
        },
        "trend": {
            "sma": sma_tbl,
            "signal": None if T is None else round(T, 4),
            "signal_n": n_avail,
            "weights": "równa średnia znaków dostępnych SMA",
            "flips": flips,
            "nearest_flip": nearest,
        },
        "vol": {
            "rv20": rv20,
            "rv20_pct": None if rv20 is None else round(rv20 * 100, 2),
            "rv60": rv60,
            "rv60_pct": None if rv60 is None else round(rv60 * 100, 2),
            "vix": vix_now,
            "vix_session": vix_day,
            "vix_asof": vix_meta.get("t"),
            "vix_src": vix_meta.get("src"),
            "exposure": expo,
            "exposure_5d": expo_5d,
            "exposure_chg_5d": chg5,
            "target_vol": TARGET_VOL,
            "cap": [0, EXPO_CAP],
            "formula": "exposure = clip(0.10 / RV20, 0, 1.5); spadający RV20 → rosnąca ekspozycja docelowa",
        },
        "flow": {
            "n": len(flow_rows),
            "days": flow_rows,
            "cum_delta": None if not flow_rows else flow_rows[-1]["cum"],
            "delta_up": round(d_up, 1),
            "delta_down": round(d_dn, 1),
            "n_up": n_up,
            "n_down": n_dn,
            "n_flat": n_flat,
            "ratio_down_vs_up": ratio if ratio != float("inf") else None,
            "ratio_note": "suma delty na sesjach spadkowych (zamknięcie < poprzednie) / suma delty na wzrostowych",
        },
        "summary": {
            "label": label,
            "combined": None if combined is None else round(combined, 4),
            "from_trend": None if T is None else round(T, 4),
            "from_vol": None if vol_leg is None else round(vol_leg, 4),
            "disclaimer": disclaimer,
        },
        "series": chart_rows,
    }
    obj["summary"]["vs"] = attach_pressure_history(chart_rows, bool(niepelna))
    return obj



def session_pressure(row: dict, expo_5d):
    """Presja combined dla jednej sesji — ten sam wzór co podsumowanie okna."""
    c = row.get("c")
    signs = []
    for n in SMA_NS:
        v = row.get(f"sma{n}")
        if c is None or v is None:
            continue
        signs.append(1 if c > v else (-1 if c < v else 0))
    T = (sum(signs) / len(signs)) if signs else None
    expo = row.get("exposure")
    chg5 = None if expo is None or expo_5d is None else expo - expo_5d
    vol_leg = None if chg5 is None else max(-1.0, min(1.0, chg5 / 0.10))
    parts = [x for x in (T, vol_leg) if x is not None]
    combined = sum(parts) / len(parts) if parts else None
    if combined is None:
        label = "Brak wystarczających danych"
    elif combined >= 0.15:
        label = "Bliżej kupowania"
    elif combined <= -0.15:
        label = "Bliżej sprzedawania"
    else:
        label = "Bez wyraźnej przewagi (blisko neutralnego)"
    return {
        "from_trend": None if T is None else round(T, 4),
        "from_vol": None if vol_leg is None else round(vol_leg, 4),
        "combined": None if combined is None else round(combined, 4),
        "exposure_chg_5d": None if chg5 is None else round(chg5, 4),
        "label": label,
    }


def attach_pressure_history(rows: list, niepelna: bool) -> dict:
    """Historia presji z tej samej serii SMA / ekspozycji (bez wymyślania wartości).

    Δ vs D-1 = combined dziś − combined poprzedniej sesji.
    Δ vs śr. 5 sesji = combined dziś − średnia z 5 sesji przed dniem bieżącym
    (zawsze bez dziś, także po zamknięciu). Dodatnia Δ = presja bliżej kupowania
    niż odniesienie.
    """
    hist = []
    for i, row in enumerate(rows):
        expo_5d = rows[i - 5].get("exposure") if i >= 5 else None
        pr = session_pressure(row, expo_5d)
        row["from_trend"] = pr["from_trend"]
        row["from_vol"] = pr["from_vol"]
        row["combined"] = pr["combined"]
        rec = {
            "d": row.get("d"),
            "d_pl": fmt_pl(row.get("d")),
            "combined": pr["combined"],
            "from_trend": pr["from_trend"],
            "from_vol": pr["from_vol"],
            "label": pr["label"],
        }
        hist.append(rec)

    today = hist[-1] if hist else None
    d1 = hist[-2] if len(hist) >= 2 else None
    prev5 = [h for h in hist[:-1] if h.get("combined") is not None][-5:]
    avg5 = (sum(h["combined"] for h in prev5) / len(prev5)) if prev5 else None
    today_c = today["combined"] if today else None

    def delta(ref):
        if today_c is None or ref is None:
            return None
        return round(today_c - ref, 4)

    vs_d1 = None
    if d1 and d1.get("combined") is not None:
        vs_d1 = {
            "d": d1["d"],
            "d_pl": d1["d_pl"],
            "combined": d1["combined"],
            "delta": delta(d1["combined"]),
        }
    vs_avg5 = None
    if avg5 is not None:
        vs_avg5 = {
            "n": len(prev5),
            "from": prev5[0]["d"],
            "to": prev5[-1]["d"],
            "from_pl": prev5[0]["d_pl"],
            "to_pl": prev5[-1]["d_pl"],
            "avg": round(avg5, 4),
            "delta": delta(avg5),
        }

    sessions = hist[-10:]
    if sessions and niepelna:
        sessions[-1] = dict(sessions[-1], niepelna=True)

    return {
        "today_incomplete": bool(niepelna),
        "d1": vs_d1,
        "avg5": vs_avg5,
        "sessions": sessions,
        "n_hist": sum(1 for h in hist if h.get("combined") is not None),
        "note": (
            "Presja = combined (średnia nogi trendu i nogi vol-control, skala −1…+1), "
            "ten sam wzór co linia podsumowania. "
            "Δ vs D−1 = presja dziś − presja poprzedniej sesji. "
            "Δ vs śr. 5 sesji = presja dziś − średnia z 5 poprzednich sesji (bez dnia bieżącego). "
            "Dodatnia Δ oznacza presję bliżej kupowania niż odniesienie."
        ),
    }


def write_obj(obj: dict, path: Path = OUT) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    tmp.replace(path)
    return path


def main() -> int:
    obj = build()
    p = write_obj(obj)
    tr, vo, sm = obj["trend"], obj["vol"], obj["summary"]
    src = obj["sources"]
    print(f"CTA JSON: {p}  {p.stat().st_size} B")
    print(f"sesja {obj['session']}  cena {obj['price']}  {'niepełna' if obj['sesja_niepelna'] else 'zamknięta'}  stan {obj['asof_pl']} PL")
    print(f"US500 lokalnie {src['us500_local']['n']} sesji {src['us500_local']['from']}–{src['us500_local']['to']}; "
          f"^GSPC {src['gspc_public']['n']} {src['gspc_public']['from']}–{src['gspc_public']['to']}; "
          f"luki {len(src['gaps_filled_from_gspc'])}  pre {src['pre_history_from_gspc_n']}")
    for n, row in tr["sma"].items():
        if not row["ok"]:
            print(f"  SMA{n}: brak")
            continue
        print(f"  SMA{n}: {row['value']}  dist {row['dist_pts']:+.2f} pkt ({row['dist_pct']:+.2f}%)  sign {row['sign']:+d}")
    print(f"  sygnał trendu {tr['signal']}  najbliższy flip SMA{tr['nearest_flip']['n'] if tr['nearest_flip'] else '–'} @ {tr['nearest_flip']['price'] if tr['nearest_flip'] else '–'}")
    print(f"  RV20 {vo['rv20_pct']}%  RV60 {vo['rv60_pct']}%  VIX {vo['vix']} ({vo['vix_src']}, sesja {vo['vix_session']})  "
          f"ekspozycja {vo['exposure']}  Δ5D {vo['exposure_chg_5d']}")
    fl = obj["flow"]
    print(f"  flow n={fl['n']} cumΔ {fl['cum_delta']}  Δup {fl['delta_up']} ({fl['n_up']})  Δdn {fl['delta_down']} ({fl['n_down']})  dn/up {fl['ratio_down_vs_up']}")
    print(f"  PODSUMOWANIE: {sm['label']}  combined={sm['combined']} (trend {sm['from_trend']} + vol {sm['from_vol']})")
    vs = sm.get("vs") or {}
    d1, a5 = vs.get("d1") or {}, vs.get("avg5") or {}
    print(f"  VS D-1 {d1.get('d_pl')} comb={d1.get('combined')} Δ={d1.get('delta')}; "
          f"śr. {a5.get('n')} sesji {a5.get('from_pl')}–{a5.get('to_pl')} avg={a5.get('avg')} Δ={a5.get('delta')}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
