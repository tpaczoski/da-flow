#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Poziomy opcji SPX → US500, krzywa GEX, Signals, VIX1D.

Źródła (lokalne archiwum, bez logowania):
  options_archive/SPX_CHAIN/<P>/chain_dte*.json  (okno 24 strike'ów, ~115 pkt)
  options_archive/SPX_0DTE/<D>/*.csv             (gdy jest – do 16.11)
  gamma_delta/archiwum/<D>/linia_zera.csv, topy.csv
  data/US500.json, data/VIX.json

VIX1D: publiczny Yahoo chart API ^VIX1D (jak ^GSPC przy CTA), z cache.
Ściany, flip, max GEX, max pain, RR 25Δ liczone WYŁĄCZNIE w oknie 24 strike'ów.
Gdy brak łańcucha (święto) – status brak_lancucha, bez starych liczb.

Użycie: python3 build_opt_levels.py [--site DIR] [--no-yahoo] [--date YYYY-MM-DD]
Hook: budżet 10 s, nie wypycha na live.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import time
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

W = ZoneInfo("Europe/Warsaw")
ET = ZoneInfo("America/New_York")
UTC = ZoneInfo("UTC")

HERE = Path(__file__).resolve().parent
RAP = Path(os.environ.get("RAPORTY_DATA_ROOT", "/workspace/raporty"))
CHAIN = RAP / "options_archive" / "SPX_CHAIN"
ODTE = RAP / "options_archive" / "SPX_0DTE"
GD = RAP / "gamma_delta" / "archiwum"

YAHOO_VIX1D = "https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX1D?interval=1d&range=1y"
YAHOO_VIX = "https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=1y"


def now_waw() -> datetime:
    return datetime.now(W)


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tmp.replace(path)


def chain_files(day: str) -> dict[int, Path]:
    d = CHAIN / day
    out = {}
    if not d.is_dir():
        return out
    for f in d.glob("chain_dte*.json"):
        m = re.search(r"dte(\d+)\.json$", f.name)
        if m:
            out[int(m.group(1))] = f
    return out


def prev_chain_day(D: str) -> str | None:
    days = sorted(p.name for p in CHAIN.iterdir() if re.fullmatch(r"\d{4}-\d{2}-\d{2}", p.name) and p.name < D)
    return days[-1] if days else None


def load_strikes(path: Path) -> tuple[dict, list[dict]]:
    J = json.loads(path.read_text(encoding="utf-8"))
    rows = []
    for l in J.get("optionStrikeLevels") or []:
        p, c = l.get("putOption") or {}, l.get("callOption") or {}
        try:
            k = float(l["strike"])
        except (KeyError, TypeError, ValueError):
            continue

        def mid(o):
            try:
                b, a = float(o.get("bidPrice") or 0), float(o.get("askPrice") or 0)
            except (TypeError, ValueError):
                return None
            if a <= 0 and b <= 0:
                return None
            if a <= 0:
                return b
            if b < 0:
                return a
            return (b + a) / 2

        rows.append({
            "k": k,
            "c_oi": int(c.get("oi") or 0),
            "p_oi": int(p.get("oi") or 0),
            "c_vol": int(c.get("volume") or 0),
            "p_vol": int(p.get("volume") or 0),
            "c_gex": float(c.get("gex") or 0),
            "p_gex": float(p.get("gex") or 0),
            "c_delta": _f(c.get("delta")),
            "p_delta": _f(p.get("delta")),
            "c_iv": _f(c.get("iv")),
            "p_iv": _f(p.get("iv")),
            "cm": mid(c),
            "pm": mid(p),
        })
    rows.sort(key=lambda r: r["k"])
    return J, rows


def _f(v):
    try:
        if v is None or v == "":
            return None
        x = float(v)
        return x if math.isfinite(x) else None
    except (TypeError, ValueError):
        return None


def parity_spot(rows: list[dict]) -> float | None:
    near = [r for r in rows if r["cm"] is not None and r["pm"] is not None]
    if len(near) < 3:
        return None
    est = [r["k"] + r["cm"] - r["pm"] for r in near]
    s0 = sorted(est)[len(est) // 2]
    close = sorted(near, key=lambda r: abs(r["k"] - s0))[:6]
    v = sorted(r["k"] + r["cm"] - r["pm"] for r in close)
    return (v[(len(v) - 1) // 2] + v[len(v) // 2]) / 2


def interp_straddle(rows, spot):
    good = [r for r in rows if r["cm"] is not None and r["pm"] is not None]
    if not good:
        return None, None, None
    lo = [r for r in good if r["k"] <= spot]
    hi = [r for r in good if r["k"] >= spot]
    if not lo or not hi:
        return None, None, None
    a, b = lo[-1], hi[0]
    def iv(r):
        xs = [x for x in (r["c_iv"], r["p_iv"]) if x]
        return sum(xs) / len(xs) if xs else None
    if a["k"] == b["k"]:
        return a["pm"] + a["cm"], iv(a), (a["k"], b["k"])
    w = (spot - a["k"]) / (b["k"] - a["k"])
    st = (a["pm"] + a["cm"]) + w * ((b["pm"] + b["cm"]) - (a["pm"] + a["cm"]))
    ia, ib = iv(a), iv(b)
    ivm = None if ia is None or ib is None else ia + w * (ib - ia)
    return st, ivm, (a["k"], b["k"])


def max_pain(rows) -> tuple[float | None, bool]:
    if not rows:
        return None, False
    ks = [r["k"] for r in rows]
    best, best_v = None, None
    for K in ks:
        s = 0.0
        for r in rows:
            # standard / analiza_struktura: call ITM gdy expiry S=K > strike, put ITM gdy S=K < strike
            s += r["c_oi"] * max(0.0, K - r["k"])
            s += r["p_oi"] * max(0.0, r["k"] - K)
        if best_v is None or s < best_v:
            best, best_v = K, s
    edge = best is not None and (best == ks[0] or best == ks[-1])
    return best, edge


def flip_zero(rows, spot=None) -> tuple[float | None, bool]:
    """Przecięcie znaku net GEX w oknie. Bierzemy przecięcia o wystarczającej sile,
    preferując klasyczne (ujemny GEX poniżej, dodatni powyżej) najbliżej spotu.
    Słabe blipy (np. net ≈ 0,002) są odrzucane."""
    pts = [(r["k"], r["c_gex"] - r["p_gex"]) for r in rows]
    if len(pts) < 2:
        return None, False
    crosses = []  # (k, strength, classic)
    for (k0, v0), (k1, v1) in zip(pts, pts[1:]):
        if v0 == 0 and v1 != 0:
            crosses.append((k0, abs(v1), v1 > 0))
        elif v0 * v1 < 0:
            k = k0 + (k1 - k0) * abs(v0) / (abs(v0) + abs(v1))
            crosses.append((k, abs(v0) + abs(v1), v0 < 0 < v1))
    if not crosses:
        return None, False
    scale = max((abs(v) for _, v in pts), default=1e-9) or 1e-9
    min_str = max(0.5, 0.15 * scale)
    strong = [c for c in crosses if c[1] >= min_str]
    classic = [c for c in strong if c[2]]
    pool = classic or strong
    if not pool:
        return None, False
    ref = spot if spot is not None else 0.5 * (pts[0][0] + pts[-1][0])
    k = min(pool, key=lambda x: abs(x[0] - ref))[0]
    edge = k <= pts[0][0] + 1e-9 or k >= pts[-1][0] - 1e-9
    return k, edge


def rr25(rows) -> dict:
    """RR 25Δ = IV put 25Δ − IV call 25Δ (punkty procentowe). Poza oknem, gdy brak delty ~0,25."""
    puts, calls = [], []
    for r in rows:
        if r["p_delta"] is not None and r["p_iv"]:
            puts.append((abs(abs(r["p_delta"]) - 0.25), r))
        if r["c_delta"] is not None and r["c_iv"]:
            calls.append((abs(abs(r["c_delta"]) - 0.25), r))
    if not puts or not calls:
        return {"status": "poza_oknem", "rr25": None, "note": "brak IV/delty do 25Δ w oknie 24 strike'ów"}
    dp, rp = min(puts, key=lambda x: x[0])
    dc, rc = min(calls, key=lambda x: x[0])
    ks = [r["k"] for r in rows]
    put_edge = rp["k"] in (ks[0], ks[-1])
    call_edge = rc["k"] in (ks[0], ks[-1])
    if dp > 0.07 or dc > 0.07 or (put_edge and dp > 0.03) or (call_edge and dc > 0.03):
        return {
            "status": "poza_oknem",
            "rr25": None,
            "put_delta": rp["p_delta"],
            "call_delta": rc["c_delta"],
            "put_k": rp["k"],
            "call_k": rc["k"],
            "note": "25Δ leży poza oknem ~115 pkt albo najbliższy strike jest na krawędzi okna",
        }
    rr = (rp["p_iv"] - rc["c_iv"]) * 100.0  # IV w łańcuchu jest ułamkiem (0.23 = 23%)
    return {
        "status": "ok",
        "rr25": round(rr, 2),
        "put_k": rp["k"],
        "call_k": rc["k"],
        "put_delta": round(rp["p_delta"], 3),
        "call_delta": round(rc["c_delta"], 3),
        "put_iv": round(rp["p_iv"] * 100, 2),
        "call_iv": round(rc["c_iv"] * 100, 2),
        "note": "RR 25Δ = IV put − IV call, tylko w oknie 24 strike'ów",
    }


def levels_from_rows(rows, spot, basis) -> dict:
    """Poziomy w punktach US500 (SPX + basis, basis = US500 − SPX). Flagi krawędzi okna."""
    if not rows:
        return {}
    ks = [r["k"] for r in rows]
    kmin, kmax = ks[0], ks[-1]
    width = kmax - kmin
    # Ściany jak w analiza_struktura: call = max OI call na strike'ach >= spot (opór),
    # put = max OI put na strike'ach <= spot (wsparcie). Globalne max w całym oknie
    # bywa po „niewłaściwej” stronie (ITM) i nie jest wtedy ścianą.
    above = [r for r in rows if r["k"] >= spot]
    below = [r for r in rows if r["k"] <= spot]
    cw_all = max(rows, key=lambda r: r["c_oi"])
    pw_all = max(rows, key=lambda r: r["p_oi"])
    cw = max(above, key=lambda r: r["c_oi"]) if above else cw_all
    pw = max(below, key=lambda r: r["p_oi"]) if below else pw_all
    # max / min net GEX (dealer: +call, −put)
    nets = [(r["k"], r["c_gex"] - r["p_gex"], r["c_gex"] + r["p_gex"]) for r in rows]
    gmax_k, gmax_v, _ = max(nets, key=lambda x: x[1])
    gmin_k, gmin_v, _ = min(nets, key=lambda x: x[1])
    # "max GEX" jak w raporcie godzinowym: największa łączna |ekspozycja| (suma raw)
    gabs_k, _, gabs_sum = max(nets, key=lambda x: abs(x[2]))
    flip, flip_edge = flip_zero(rows, spot)
    pain, pain_edge = max_pain(rows)
    tot_c = sum(r["c_gex"] for r in rows)
    tot_p = sum(r["p_gex"] for r in rows)
    net = tot_c - tot_p
    coi, poi = sum(r["c_oi"] for r in rows), sum(r["p_oi"] for r in rows)
    cvo, pvo = sum(r["c_vol"] for r in rows), sum(r["p_vol"] for r in rows)
    to_us = lambda k: None if k is None else round(k + basis, 1)

    def edge(k):
        return k is not None and (abs(k - kmin) < 1e-9 or abs(k - kmax) < 1e-9)

    gexk = [[round(r["k"], 1), round(r["c_gex"] - r["p_gex"], 4), round(r["c_gex"], 4), round(r["p_gex"], 4)] for r in rows]
    gexk_us = [[to_us(r["k"]), round(r["c_gex"] - r["p_gex"], 4)] for r in rows]
    return {
        "window_spx": [kmin, kmax],
        "window_us": [to_us(kmin), to_us(kmax)],
        "window_width": width,
        "cw": to_us(cw["k"]),
        "cw_spx": cw["k"],
        "cw_oi": cw["c_oi"],
        "cw_edge": edge(cw["k"]),
        "cw_global_spx": cw_all["k"],
        "cw_global_oi": cw_all["c_oi"],
        "cw_unusual": cw_all["k"] != cw["k"],
        "pw": to_us(pw["k"]),
        "pw_spx": pw["k"],
        "pw_oi": pw["p_oi"],
        "pw_edge": edge(pw["k"]),
        "pw_global_spx": pw_all["k"],
        "pw_global_oi": pw_all["p_oi"],
        "pw_unusual": pw_all["k"] != pw["k"],
        "flip": to_us(flip),
        "flip_spx": None if flip is None else round(flip, 2),
        "flip_edge": flip_edge or (flip is None),
        "flip_missing": flip is None,
        "gmax": to_us(gmax_k),
        "gmax_spx": gmax_k,
        "gmax_edge": edge(gmax_k),
        "gmin": to_us(gmin_k),
        "gmin_spx": gmin_k,
        "gmin_edge": edge(gmin_k),
        "gabs": to_us(gabs_k),
        "mp": to_us(pain),
        "mp_spx": pain,
        "mp_edge": pain_edge,
        "gex_net": round(net, 3),
        "gex_call": round(tot_c, 3),
        "gex_put": round(tot_p, 3),
        "pcr_oi": None if coi <= 0 else round(poi / coi, 2),
        "pcr_vol": None if cvo <= 0 else round(pvo / cvo, 2),
        "oi": [coi, poi],
        "vol": [cvo, pvo],
        "gexk": gexk,
        "gexk_us": gexk_us,
        "skew": rr25(rows),
        "n_strikes": len(rows),
    }


def us500_at(store_day: dict, t_pl: datetime) -> tuple[float | None, str]:
    if not store_day:
        return None, "brak sesji US500"
    hm = lambda x: x.hour * 60 + x.minute
    want = (hm(t_pl) - 1) % 1440
    best = None
    for b in (store_day.get("m1") or []):
        if not b or b[4] is None:
            continue
        mm = int(b[0][:2]) * 60 + int(b[0][3:5])
        d = (want - mm) % 1440
        if d <= 4 and (best is None or d < best[0]):
            best = (d, b)
    if best:
        return float(best[1][4]), f"M1 {best[1][0]} PL"
    want5 = (hm(t_pl) - 5) % 1440
    for b in (store_day.get("boxes") or []):
        if b and b[4] is not None and int(b[0][:2]) * 60 + int(b[0][3:5]) == want5:
            return float(b[4]), f"M5 {b[0]} PL"
    # last RTH / last box
    boxes = [b for b in (store_day.get("boxes") or []) if b and b[4] is not None]
    if boxes:
        b = boxes[-1]
        return float(b[4]), f"ostatnia M5 {b[0]} PL (przybliżenie)"
    return None, "brak świecy US500"


def last_us500(store_day: dict) -> float | None:
    boxes = [b for b in (store_day.get("boxes") or []) if b and b[4] is not None]
    if not boxes:
        return None
    rth = [b for b in boxes if (len(b) > 9 and b[9])]
    return float((rth or boxes)[-1][4])


def parse_ts(ts: str) -> datetime | None:
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except Exception:
        return None


def tte_label(exp: date, asof: datetime | None) -> tuple[str | None, int | None]:
    close = datetime.combine(exp, datetime.min.time(), ET).replace(hour=16)
    if asof is None:
        asof = datetime.now(ET)
    if asof.tzinfo is None:
        asof = asof.replace(tzinfo=UTC)
    asof = asof.astimezone(ET)
    sec = (close - asof).total_seconds()
    if sec <= 0:
        return "wygasło", 0
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    return f"{h} h {m:02d} min do 16:00 ET {exp.strftime('%-d.%m')}", int(sec)


def load_0dte_csv(day: str) -> list[dict]:
    d = ODTE / day
    if not d.is_dir():
        return []
    out = []
    for f in sorted(d.glob("*.csv")):
        m = re.fullmatch(r"(\d{2})(\d{2})\.csv", f.name)
        if not m:
            continue
        t = f"{m.group(1)}:{m.group(2)}"
        rows = []
        try:
            import csv
            with f.open() as fh:
                rd = csv.DictReader(fh)
                for r in rd:
                    try:
                        rows.append({
                            "k": float(r["strike"]),
                            "c_oi": int(float(r.get("call_oi") or 0)),
                            "p_oi": int(float(r.get("put_oi") or 0)),
                            "c_vol": int(float(r.get("call_vol") or 0)),
                            "p_vol": int(float(r.get("put_vol") or 0)),
                            "c_gex": float(r.get("call_gex") or 0),
                            "p_gex": float(r.get("put_gex") or 0),
                            "c_delta": None, "p_delta": None, "c_iv": None, "p_iv": None,
                            "cm": None, "pm": None,
                        })
                    except (KeyError, TypeError, ValueError):
                        continue
        except Exception:
            continue
        rows.sort(key=lambda r: r["k"])
        if rows:
            out.append({"t": t, "rows": rows, "src": f"SPX_0DTE/{day}/{f.name}"})
    return out


def load_gd_steps(day: str, basis: float) -> dict[str, dict]:
    zpath, tpath = GD / day / "linia_zera.csv", GD / day / "topy.csv"
    out = {}
    try:
        import csv
        if zpath.is_file():
            with zpath.open() as fh:
                for r in csv.DictReader(fh):
                    t = (r.get("czas_pl") or "")[:5]
                    if not t:
                        continue
                    rec = out.setdefault(t, {"t": t})
                    try:
                        rec["zero"] = round(float(r["zero_poziom"]) + basis, 1)
                    except (TypeError, ValueError, KeyError):
                        pass
        if tpath.is_file():
            with tpath.open() as fh:
                for r in csv.DictReader(fh):
                    t = (r.get("czas_pl") or "")[:5]
                    if not t:
                        continue
                    rec = out.setdefault(t, {"t": t})
                    for k in ("tc1", "tp1"):
                        try:
                            if r.get(k) not in (None, ""):
                                rec[k] = round(float(r[k]) + basis, 1)
                        except (TypeError, ValueError):
                            pass
    except Exception:
        return out
    return out


def fetch_yahoo_series(url: str, cache: Path, no_net: bool) -> tuple[dict[str, float], str]:
    raw = None
    note = ""
    if cache.is_file():
        mt = datetime.fromtimestamp(cache.stat().st_mtime, W)
        if mt.date() == now_waw().date():
            raw = cache.read_bytes()
            note = f"Yahoo (cache z dzisiaj, {cache.name})"
    if raw is None and not no_net:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 DA-Flow-preview"})
            with urllib.request.urlopen(req, timeout=8) as r:
                raw = r.read()
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_bytes(raw)
            note = f"Yahoo public chart API (pobrane teraz, bez logowania)"
        except Exception as e:
            if cache.is_file():
                raw = cache.read_bytes()
                note = f"Yahoo z cache ({cache.name}); pobranie nieudane: {type(e).__name__}"
            else:
                return {}, f"brak danych Yahoo: {type(e).__name__}"
    elif raw is None and cache.is_file():
        raw = cache.read_bytes()
        note = f"Yahoo z cache ({cache.name}), bez sieci"
    if raw is None:
        return {}, note or "brak Yahoo"
    try:
        obj = json.loads(raw.decode("utf-8"))
        res = obj["chart"]["result"][0]
        ts, close = res["timestamp"], res["indicators"]["quote"][0]["close"]
        out = {}
        for t, c in zip(ts, close):
            if c is None:
                continue
            d = datetime.fromtimestamp(t, timezone.utc).astimezone(ET).date().isoformat()
            out[d] = float(c)
        return out, note
    except Exception as e:
        return {}, f"nieczytelna odpowiedź Yahoo: {type(e).__name__}"


def vix_from_json(vix_json: dict, day: str) -> float | None:
    s = vix_json.get(day) if vix_json else None
    if not s:
        return None
    boxes = [b for b in (s.get("boxes") or []) if b and len(b) > 4 and b[4] is not None]
    rth = [b for b in boxes if len(b) > 9 and b[9]]
    src = rth or boxes
    return None if not src else float(src[-1][4])


def regime_of(vix1d: float | None, vix: float | None) -> dict:
    if vix1d is None or vix is None or vix <= 0:
        return {"ratio": None, "structure": None, "regime": "brak", "note": "brak pary VIX1D i VIX z tej samej sesji"}
    ratio = vix1d / vix
    if vix1d > vix * 1.02:
        struct = "backwardation"
    elif vix1d < vix * 0.98:
        struct = "contango"
    else:
        struct = "płaska"
    if ratio >= 1.15:
        reg = "spięcie (VIX1D wyraźnie nad VIX)"
    elif ratio <= 0.85:
        reg = "spokój (VIX1D wyraźnie pod VIX)"
    else:
        reg = "zrównoważony"
    return {"ratio": round(ratio, 3), "structure": struct, "regime": reg,
            "note": "contango: VIX1D < VIX (krzywa w górę); backwardation: VIX1D > VIX"}


def build_session(D: str, store: dict) -> dict:
    P = prev_chain_day(D)
    if not P:
        return {"status": "brak_lancucha", "reason": f"brak katalogu łańcucha SPX przed sesją {D}", "opt": None, "em": None, "opt0": None}
    fs = chain_files(P)
    dP, dD = date.fromisoformat(P), date.fromisoformat(D)
    nD = (dD - dP).days
    if nD not in fs:
        return {
            "status": "brak_lancucha",
            "reason": f"łańcuch z zamknięcia {P} nie ma wygasania {D} (dte{nD}); są: {sorted(fs)} – typowo święto / brak sesji kasowej",
            "chain_prev": P,
            "opt": None, "em": None, "opt0": None,
        }
    path = fs[nD]
    J, rows = load_strikes(path)
    if not rows:
        return {"status": "brak_lancucha", "reason": f"pusty łańcuch {P} dte{nD}", "opt": None, "em": None, "opt0": None}
    ts = parse_ts(J.get("timestamp") or "")
    # Spot SPX: parytet z 0DTE tylko gdy zrzut jest JESZCZE w sesji kasowej (przed 16:00 ET).
    # Zrzuty o 17:00 ET (archiwum) są po wygaśnięciu 0DTE – kwotowania szerokie/stare,
    # parytet zniekształca bazę US500−SPX o kilka punktów. Wtedy liczymy parytet z serii dte nD.
    spot, spot_src = None, ""
    close_p = datetime.combine(dP, datetime.min.time(), ET).replace(hour=16)
    ts_et = ts.astimezone(ET) if ts is not None else None
    if 0 in fs and ts_et is not None and ts_et < close_p:
        spot = parity_spot(load_strikes(fs[0])[1])
        spot_src = "parytet put-call 0DTE (zrzut w sesji kasowej)"
    if spot is None:
        spot = parity_spot(rows)
        spot_src = f"parytet put-call dte{nD}" + (" — 0DTE po wygaśnięciu, pominięty" if 0 in fs else "")
    if spot is None:
        return {"status": "brak_lancucha", "reason": f"brak spotu SPX z parytetu ({P})", "opt": None, "em": None, "opt0": None}
    us, us_src = us500_at(store.get(P) or {}, ts.astimezone(W) if ts else datetime.combine(dP, datetime.min.time(), ET).astimezone(W).replace(hour=23))
    if us is None:
        us = last_us500(store.get(P) or {})
        us_src = us_src + " / ostatnie zamknięcie sesji P" if us else us_src
    if us is None:
        return {"status": "brak_lancucha", "reason": us_src, "opt": None, "em": None, "opt0": None}
    basis = us - spot  # US500 − SPX
    st, iv, ks = interp_straddle(rows, spot)
    if st is None:
        return {"status": "brak_lancucha", "reason": "brak straddle ATM w oknie", "opt": None, "em": None, "opt0": None}
    lv = levels_from_rows(rows, spot, basis)
    em = round(st, 1)
    F = round(us, 1)
    exp = dD
    tte, tte_s = tte_label(exp, ts)
    window_note = (
        f"okno 24 strike'ów SPX {lv['window_spx'][0]:.0f}–{lv['window_spx'][1]:.0f} "
        f"(~{lv['window_width']:.0f} pkt). Ściany, flip, max GEX i max pain liczone tylko w tym oknie."
    )
    opt = {
        "snap": (ts.astimezone(ET).strftime("%Y-%m-%d %H:%M ET") if ts else P),
        "em": em,
        "F": F,
        "emH": round(F + em, 1),
        "emL": round(F - em, 1),
        "cw": lv["cw"],
        "pw": lv["pw"],
        "flip": lv["flip"],
        "gmin": lv["gmin"],
        "gmax": lv["gmax"],
        "mp": lv["mp"],
        "gex": lv["gex_net"],
        "baza": round(basis, 2),
        "window": True,
        "window_note": window_note,
        "cw_edge": lv["cw_edge"],
        "pw_edge": lv["pw_edge"],
        "mp_edge": lv["mp_edge"],
        "flip_missing": lv["flip_missing"],
        "src": f"SPX_CHAIN/{P}/chain_dte{nD}.json",
    }
    # profil jak w em.prof: [strike, vol call, vol put, OI call, OI put]
    _, raw_rows = load_strikes(path)
    prof = [[r["k"], r["c_vol"], r["p_vol"], r["c_oi"], r["p_oi"]] for r in raw_rows]
    em_obj = {
        "src": f"SPX · łańcuch ttechou (archiwum SPX_CHAIN, okno 24 strike'ów – poziomy liczone w oknie)",
        "asof": ts.astimezone(W).strftime("%d.%m.%Y %H:%M") if ts else P,
        "spx": round(spot, 2),
        "ref": F,
        "basis": round(basis, 2),
        "ref_src": f"{spot_src} + baza US500 − SPX z {us_src}",
        "prices": "bid/ask z łańcucha ttechou (zrzut po zamknięciu poprzedniej sesji)",
        "rows": [{
            "dte": nD,
            "lab": f"z zamknięcia {dP.strftime('%-d.%m')}",
            "exp": dD.strftime("%-d.%m"),
            "asof": ts.astimezone(W).strftime("%d.%m %H:%M") if ts else P,
            "hrs": nD * 24,
            "spx": round(spot, 2),
            "straddle": round(st, 2),
            "iv": None if iv is None else round(iv, 4),
            "em": em,
            "em_iv": None if iv is None else round(spot * iv * math.sqrt(nD / 365.0), 1),
            "pct": round(100 * em / spot, 2) if spot else None,
            "ref": F,
            "lo": round(F - em, 1),
            "hi": round(F + em, 1),
            "src": f"SPX_CHAIN/{P}/chain_dte{nD}.json",
        }],
        "ctx": {
            "atm_iv": None if iv is None else round(iv * 100, 2),
            "exp": dD.strftime("%-d.%m"),
            "strikes": [lv["window_spx"][0], lv["window_spx"][1]],
            "gex": lv["gex_net"],
            "flip": lv["flip_spx"],
            "call_wall": lv["cw_spx"],
            "put_wall": lv["pw_spx"],
            "rr25": (lv["skew"] or {}).get("rr25"),
            "pcr_oi": lv["pcr_oi"],
            "pcr_vol": lv["pcr_vol"],
            "window": True,
        },
        "prof": prof,
        "gexk": lv["gexk"],
    }

    # opt0: pre z 1DTE + kroki z SPX_0DTE i/lub gamma×delta
    pre = {
        "src": f"{nD} DTE z zamknięcia {dP.strftime('%-d.%m')} (wygasa {dD.strftime('%-d.%m')}), okno 24 strike'ów",
        "F": F, "em": em, "emH": opt["emH"], "emL": opt["emL"],
        "cw": lv["cw"], "pw": lv["pw"], "gmax": lv["gmax"], "gmin": lv["gmin"],
        "mp": lv["mp"], "flip": lv["flip"],
    }
    steps = []
    # intra-day 0DTE csv (do 16.11)
    for snap in load_0dte_csv(D):
        lv0 = levels_from_rows(snap["rows"], spot, basis)
        st0 = {"t": snap["t"], "S": None, "em": None, "emH": None, "emL": None,
               "cw": lv0["cw"], "pw": lv0["pw"], "gmax": lv0["gmax"], "mp": lv0["mp"], "flip": lv0["flip"],
               "src": snap["src"]}
        steps.append(st0)
    # gamma×delta zero / topy – dopisz lub utwórz kroki co 15 min (albo każdą minutę zredukowaną)
    gd = load_gd_steps(D, basis)
    if gd:
        # attach to nearest step or add 15-min samples
        def hm(t):
            return int(t[:2]) * 60 + int(t[3:5])
        if steps:
            for st0 in steps:
                # nearest gd minute
                cand = min(gd, key=lambda t: abs(hm(t) - hm(st0["t"]))) if gd else None
                if cand and abs(hm(cand) - hm(st0["t"])) <= 5:
                    st0.update({k: gd[cand][k] for k in ("zero", "tc1", "tp1") if k in gd[cand]})
        else:
            # sample :00/:15/:30/:45 and last
            times = sorted(gd)
            pick = [t for t in times if t[3:5] in ("00", "15", "30", "45")]
            if times and times[-1] not in pick:
                pick.append(times[-1])
            for t in pick:
                rec = {"t": t, "S": None, "src": f"gamma_delta/archiwum/{D}"}
                rec.update({k: gd[t][k] for k in ("zero", "tc1", "tp1") if k in gd[t]})
                steps.append(rec)
    opt0 = {
        "basis": round(basis, 2),
        "pre": pre,
        "steps": steps,
        "note": (
            "SPX → US500 bazą US500 − SPX. Przed sesją: EM = straddle ATM z łańcucha 1 DTE (okno 24 strike'ów). "
            "Od otwarcia: zrzuty 0 DTE (gdy są w archiwum) oraz linia zera i topy gamma×delta (model gd-v1), jeśli są. "
            "Opis, nie sygnał."
        ),
    }

    # EOD 0DTE chain of session D (after close) – only as extra curve, not look-ahead for pre levels
    eod_curve = None
    fsD = chain_files(D)
    if 0 in fsD:
        Je, re0 = load_strikes(fsD[0])
        if re0:
            spote = parity_spot(re0) or spot
            use = last_us500(store.get(D) or {})
            be = (use - spote) if use is not None else basis
            lve = levels_from_rows(re0, spote, be)
            eod_curve = {
                "src": f"SPX_CHAIN/{D}/chain_dte0.json",
                "asof": Je.get("timestamp"),
                "dte": 0,
                "window_spx": lve["window_spx"],
                "gexk_us": lve["gexk_us"],
                "note": "krzywa 0 DTE z zamknięcia tej sesji (po faktach, nie do decyzji w trakcie dnia)",
            }

    signals = {
        "spot": round(last_us500(store.get(D) or {}) or F, 1),
        "spot_src": "ostatnia świeca sesji US500" if store.get(D) else "środek EM z poprzedniego zamknięcia",
        "em": em,
        "emH": opt["emH"],
        "emL": opt["emL"],
        "max_pain": lv["mp"],
        "max_pain_edge": lv["mp_edge"],
        "flip": lv["flip"],
        "flip_missing": lv["flip_missing"],
        "call_wall": lv["cw"],
        "call_wall_edge": lv["cw_edge"],
        "call_wall_note": (
            f"K≥spot · ITM max {lv['cw_global_spx']:.0f}"
            if lv.get("cw_unusual") else "ściana OI, K≥spot"
        ),
        "call_wall_tip": (
            f"ściana = max OI call przy K≥spot. W całym oknie max OI call jest ITM przy {lv['cw_global_spx']+basis:.1f} (SPX {lv['cw_global_spx']:.0f}, OI {lv['cw_global_oi']})."
            if lv.get("cw_unusual") else "max OI call przy strike'ach ≥ spot"
        ),
        "put_wall": lv["pw"],
        "put_wall_edge": lv["pw_edge"],
        "put_wall_note": (
            f"K≤spot · ITM max {lv['pw_global_spx']:.0f}"
            if lv.get("pw_unusual") else "ściana OI, K≤spot"
        ),
        "put_wall_tip": (
            f"ściana = max OI put przy K≤spot. W całym oknie max OI put jest ITM przy {lv['pw_global_spx']+basis:.1f} (SPX {lv['pw_global_spx']:.0f}, OI {lv['pw_global_oi']})."
            if lv.get("pw_unusual") else "max OI put przy strike'ach ≤ spot"
        ),
        "pcr_oi": lv["pcr_oi"],
        "pcr_vol": lv["pcr_vol"],
        "tte": tte,
        "exp": dD.isoformat(),
        "asof": opt["snap"],
        "window_note": window_note,
        "skew": lv["skew"],
    }
    gex_curve = {
        "src": f"SPX_CHAIN/{P}/chain_dte{nD}.json",
        "asof": J.get("timestamp"),
        "dte": nD,
        "lab": f"1 DTE z zamknięcia {dP.strftime('%-d.%m')} (wygasa {dD.strftime('%-d.%m')})",
        "window_spx": lv["window_spx"],
        "window_us": lv["window_us"],
        "gexk_us": lv["gexk_us"],
        "units": "net GEX = gex call − gex put (jednostki dostawcy łańcucha, tylko okno 24 strike'ów)",
        "note": window_note,
        "eod_0dte": eod_curve,
    }
    return {
        "status": "ok",
        "chain_prev": P,
        "chain_file": f"SPX_CHAIN/{P}/chain_dte{nD}.json",
        "opt": opt,
        "em": em_obj,
        "opt0": opt0,
        "signals": signals,
        "gex_curve": gex_curve,
        "skew": lv["skew"],
        "levels": {k: lv[k] for k in lv if k not in ("gexk", "gexk_us")},
    }


def build_opt_hist(store: dict, sessions: dict) -> dict:
    out = []
    for D, rec in sessions.items():
        if rec.get("status") != "ok" or not rec.get("em"):
            continue
        em = rec["em"]
        ctx = em.get("ctx") or {}
        row0 = (em.get("rows") or [{}])[0]
        out.append({
            "sess": rec.get("chain_prev"),
            "asof": rec.get("chain_prev"),
            "src": "łańcuch ttechou (okno 24 strike'ów, poziomy liczone w oknie)",
            "spx": em.get("spx"),
            "basis": em.get("basis"),
            "exps": [{
                "exp": rec["signals"]["exp"],
                "days": row0.get("dte"),
                "straddle": row0.get("straddle"),
                "atm_iv": ctx.get("atm_iv"),
                "oi": em.get("ctx") and rec["opt"] and rec.get("levels", {}).get("oi"),
                "pcr_oi": ctx.get("pcr_oi"),
                "gex": ctx.get("gex"),
                "flip": ctx.get("flip"),
                "call_wall": ctx.get("call_wall"),
                "put_wall": ctx.get("put_wall"),
                "rr25": ctx.get("rr25"),
                "partial": True,
                "window": True,
            }],
        })
    return {
        "gen": now_waw().strftime("%Y-%m-%d"),
        "units": "GEX: jednostki dostawcy łańcucha / okno 24 strike'ów; poziomy w punktach SPX (US500 = SPX + basis)",
        "s": out,
    }


def main():
    t0 = time.time()
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", default=str(HERE))
    ap.add_argument("--no-yahoo", action="store_true")
    ap.add_argument("--date", help="przelicz tylko tę sesję (plus brak_lancucha dla dni bez łańcucha)")
    ap.add_argument("--no-patch-us500", action="store_true")
    a = ap.parse_args()
    site = Path(a.site)
    us_path = site / "data" / "US500.json"
    out_path = site / "data" / "US500_opt.json"
    hist_path = site / "data" / "opt_hist.json"
    vix_path = site / "data" / "VIX.json"
    cache1 = site / "data" / "vix1d_yahoo_cache.json"
    cachev = site / "data" / "vix_yahoo_cache.json"

    store = json.loads(us_path.read_text(encoding="utf-8")) if us_path.is_file() else {}
    vixj = json.loads(vix_path.read_text(encoding="utf-8")) if vix_path.is_file() else {}

    days = sorted(store)
    if a.date:
        days = [d for d in days if d >= a.date]  # still mark later holidays
        if a.date not in days and a.date not in store:
            days = [a.date] + days

    vix1d_s, n1 = fetch_yahoo_series(YAHOO_VIX1D, cache1, a.no_yahoo)
    vix_yh, nv = fetch_yahoo_series(YAHOO_VIX, cachev, a.no_yahoo)

    sessions = {}
    n_ok = n_miss = 0
    for D in days:
        rec = build_session(D, store)
        # VIX term for this session
        v1 = vix1d_s.get(D)
        vx_da = vix_from_json(vixj, D)
        # do pary z Yahoo VIX1D bierzemy Yahoo ^VIX (ten sam close CBOE); DA VIX tylko jako zapas
        vx = vix_yh.get(D)
        vx_src = "Yahoo ^VIX" if vx is not None else None
        if vx is None and vx_da is not None:
            vx, vx_src = vx_da, "data/VIX.json"
        rec["vix_term"] = {
            "vix": None if vx is None else round(vx, 2),
            "vix_src": vx_src,
            "vix_da": None if vx_da is None else round(vx_da, 2),
            "vix1d": None if v1 is None else round(v1, 2),
            "vix1d_src": None if v1 is None else n1,
            "vix1d_asof": D if v1 is not None else (max(vix1d_s) if vix1d_s else None),
            **regime_of(v1, vx),
        }
        if rec.get("status") == "ok" and rec.get("signals"):
            rec["signals"]["vix_term"] = rec["vix_term"]
            rec["signals"]["skew"] = rec.get("skew")
        sessions[D] = rec
        if rec.get("status") == "ok":
            n_ok += 1
        else:
            n_miss += 1

    payload = {
        "gen": now_waw().isoformat(timespec="seconds"),
        "window_note": "łańcuch ttechou: okno 24 strike'ów (~115 pkt); ściany, flip, max GEX, max pain i RR 25Δ tylko w tym oknie",
        "units": "poziomy w US500 (SPX + baza US500−SPX); GEX w jednostkach dostawcy łańcucha",
        "vix1d": {
            "src": n1,
            "from": min(vix1d_s) if vix1d_s else None,
            "to": max(vix1d_s) if vix1d_s else None,
            "n": len(vix1d_s),
            "last": None if not vix1d_s else {"d": max(vix1d_s), "v": round(vix1d_s[max(vix1d_s)], 2)},
        },
        "vix_yahoo": {"src": nv, "to": max(vix_yh) if vix_yh else None, "n": len(vix_yh)},
        "sessions": sessions,
    }
    write_json(out_path, payload)

    # opt_hist for the week-window UI (partial, flagged)
    try:
        write_json(hist_path, build_opt_hist(store, sessions))
    except Exception as e:
        print(f"opt_hist: pominięto ({e})", file=sys.stderr)

    patched = 0
    if not a.no_patch_us500 and store:
        for D, rec in sessions.items():
            if D not in store:
                continue
            if rec.get("status") != "ok":
                # do not leave stale opt/em/opt0 from a previous session
                continue
            if rec.get("opt"):
                store[D]["opt"] = rec["opt"]
            if rec.get("em"):
                store[D]["em"] = rec["em"]
            if rec.get("opt0"):
                store[D]["opt0"] = rec["opt0"]
            patched += 1
        write_json(us_path, store)

    dt = time.time() - t0
    print(f"US500_opt.json: {n_ok} sesji ok, {n_miss} bez łańcucha, patch US500={patched}, {dt:.2f} s")
    # short per-day hint for the example and holiday
    for d in ("2026-11-25", "2026-11-26"):
        r = sessions.get(d)
        if not r:
            continue
        if r["status"] != "ok":
            print(f"  {d}: BRAK ŁAŃCUCHA – {r.get('reason')}")
        else:
            s = r["signals"]
            print(f"  {d}: EM ±{s['em']}  pain {s['max_pain']}  flip {s['flip']}  cw {s['call_wall']}  pw {s['put_wall']}  "
                  f"P/C {s['pcr_oi']}  TTE {s['tte']}  skew {s['skew'].get('status')}  "
                  f"VIX1D {r['vix_term'].get('vix1d')} / VIX {r['vix_term'].get('vix')} {r['vix_term'].get('structure')}")


if __name__ == "__main__":
    main()
