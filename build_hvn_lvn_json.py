#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""US500 – odbudowa data/US500_hvn_lvn.json do okna DA Flow.

Okno: ostatnie 3 tygodnie (21 dni kalendarzowych do bieżącej sesji włącznie).
Definicje HVN/LVN i mitygacji – identyczne z
/workspace/raporty/heatmap_hvn_lvn/build_heatmap.py
(profil dzienny wygładzony Gaussem σ=2, mitygacja = pierwszy powrót
po oddaleniu ≥15 pkt, tolerancja ±1,5 pkt).

Użycie: python3 build_hvn_lvn_json.py
Ścieżki danych i biblioteki można nadpisać zmiennymi:
  HVN_LIB, HVN_OUT, FLEX, STORE, M1_HIST
"""
from __future__ import annotations

import json
import os
import sys
import traceback
from datetime import date, datetime, timedelta
from pathlib import Path

SITE = Path(__file__).resolve().parent
OUT_DEFAULT = SITE / "data" / "US500_hvn_lvn.json"
LIB_DEFAULT = Path("/workspace/raporty/heatmap_hvn_lvn")


def _iso(t) -> str | None:
    if t is None:
        return None
    try:
        if getattr(t, "tzinfo", None) is None:
            from datetime import timezone
            t = t.replace(tzinfo=timezone.utc)
        from zoneinfo import ZoneInfo
        t = t.astimezone(ZoneInfo("Europe/Warsaw"))
        return t.isoformat(timespec="seconds")
    except Exception:
        return str(t)


def _session_today():
    from zoneinfo import ZoneInfo
    now = datetime.now(ZoneInfo("Europe/Warsaw"))
    d = now.date()
    if now.hour >= 23:
        d = d + timedelta(days=1)
    return now, d


def main() -> int:
    lib = Path(os.environ.get("HVN_LIB") or LIB_DEFAULT)
    out = Path(os.environ.get("HVN_OUT") or OUT_DEFAULT)
    if not (lib / "build_heatmap.py").is_file():
        print(f"build_hvn_lvn_json: brak {lib / 'build_heatmap.py'}", file=sys.stderr)
        return 2

    sys.path.insert(0, str(lib))
    import build_heatmap as H  # noqa: E402

    now, date_to = _session_today()
    date_from = date_to - timedelta(days=21)
    H.DATE_FROM = date_from
    H.DATE_TO = date_to
    if os.environ.get("FLEX"):
        H.FLEX = os.environ["FLEX"]
    if os.environ.get("STORE"):
        H.STORE = os.environ["STORE"]
    if os.environ.get("M1_HIST"):
        H.M1_HIST = os.environ["M1_HIST"]

    H.log(f"Okno  {date_from.isoformat()} … {date_to.isoformat()}  (stan {now:%Y-%m-%d %H:%M %Z})")

    hours = H.load_hourly_from_vap()
    hours = H.fill_missing_hours_from_store(hours)
    hours, last_store_ts = H.supplement_current_hour(hours)
    if not hours:
        print("build_hvn_lvn_json: brak godzin VAP/store w oknie", file=sys.stderr)
        return 3

    # jeśli bieżąca sesja nie ma VAP, dociągnij pełne godziny ze store
    have_sess = {h["session"] for h in hours}
    if date_to not in have_sess:
        profiles = H._store_hourly_profiles(date_to)
        start = datetime(date_to.year, date_to.month, date_to.day, tzinfo=H.WAW).astimezone(H.UTC) - timedelta(hours=1)
        end = datetime(date_to.year, date_to.month, date_to.day, 22, 0, tzinfo=H.WAW).astimezone(H.UTC)
        added = 0
        have_ts = {h["ts"] for h in hours}
        for t, rec in profiles.items():
            if t in have_ts or not (start <= t < end):
                continue
            vol = float(sum(rec["prof"].values()))
            if vol <= 0:
                continue
            hours.append(dict(
                ts=t, ts_waw=t.astimezone(H.WAW), session=date_to,
                prof=dict(rec["prof"]), vol=vol, source="store", partial=False,
            ))
            added += 1
        if added:
            hours.sort(key=lambda x: x["ts"])
            H.log(f"  dociągnięto {added} godzin sesji {date_to} ze store (brak VAP)")

    m1 = H.load_m1()
    h1 = H.h1_from_m1(m1)
    last_ts = m1.t.max()
    last_ts = last_ts.to_pydatetime() if hasattr(last_ts, "to_pydatetime") else last_ts
    if last_ts.tzinfo is None:
        last_ts = last_ts.replace(tzinfo=H.UTC)
    last_price = float(m1.sort_values("t").iloc[-1].C)
    if last_store_ts and last_store_ts > last_ts:
        last_ts = last_store_ts

    dailies = H.daily_profiles(hours)
    levels = H.detect_levels(dailies)
    levels = H.mitigate(levels, h1, last_ts)

    # macierz rzadka + profil 3 tyg.
    all_p = set()
    for h in hours:
        all_p.update(int(p) for p in h["prof"])
    pmin, pmax = (min(all_p), max(all_p)) if all_p else (0, 0)
    tot = {}
    for h in hours:
        for p, v in h["prof"].items():
            k = int(p)
            tot[k] = tot.get(k, 0.0) + float(v)
    finite = list(tot.values())
    vmax = 0.0
    if finite:
        import numpy as np
        vmax = float(np.quantile(finite, 0.98))

    h1map = {}
    for row in h1.itertuples(index=False):
        ts = row.ts
        if getattr(ts, "tzinfo", None) is None:
            ts = ts.replace(tzinfo=H.UTC)
        h1map[ts] = row

    hours_out = []
    cols = []
    h1_out = []
    for h in hours:
        tw = h["ts_waw"]
        hours_out.append({
            "t": _iso(h["ts"]),
            "s": h["session"].isoformat() if hasattr(h["session"], "isoformat") else str(h["session"]),
            "lab": tw.strftime("%d.%m %H:%M"),
            "hh": tw.hour,
        })
        pairs = []
        for p, v in h["prof"].items():
            if v and v > 0:
                pairs.append([int(p), round(float(v), 1)])
        pairs.sort()
        cols.append(pairs)
        row = h1map.get(h["ts"])
        if row is None:
            h1_out.append(None)
        else:
            h1_out.append([
                round(float(row.O), 2),
                round(float(row.H), 2),
                round(float(row.L), 2),
                round(float(row.C), 2),
            ])

    profile = [[int(p), round(v, 1)] for p, v in sorted(tot.items()) if v > 0]

    def pack_lv(lv):
        ses = lv["sesja"]
        ses_s = ses.isoformat() if hasattr(ses, "isoformat") else str(ses)
        ft = lv.get("form_ts")
        mt = lv.get("mit_ts")
        form_pl = ""
        if ft is not None:
            tw = ft.astimezone(H.WAW) if getattr(ft, "tzinfo", None) else ft
            form_pl = tw.strftime("%d.%m.%Y %H:%M")
        return {
            "typ": lv["typ"],
            "cena": int(lv["cena"]) if float(lv["cena"]).is_integer() else round(float(lv["cena"]), 1),
            "sesja": ses_s,
            "form_ts": _iso(ft),
            "form_pl": form_pl,
            "vol": round(float(lv["vol"]), 1),
            "poc": bool(lv.get("is_poc")),
            "status": lv["status"],
            "mit_ts": _iso(mt),
            "reakcja": lv.get("reakcja") or "",
            "strona": lv.get("strona") or "",
            "dist": round(float(lv["cena"]) - last_price, 1),
        }

    levels_out = [pack_lv(lv) for lv in levels]
    open_lv = [x for x in levels_out if x["status"] in ("otwarte", "w_grze")]
    open_lv.sort(key=lambda x: (abs(x["dist"]), x["cena"]))

    # profil wartości jeszcze niezmitygowanych = wolumen 3 tyg. na cenach otwartych poziomów
    open_prices = {x["cena"] for x in open_lv}
    profile_open = [[p, v] for p, v in profile if p in open_prices]

    counts = {
        "hvn": sum(1 for x in levels_out if x["typ"] == "HVN"),
        "lvn": sum(1 for x in levels_out if x["typ"] == "LVN"),
        "zmitygowany": sum(1 for x in levels_out if x["status"] == "zmitygowany"),
        "otwarte": sum(1 for x in levels_out if x["status"] == "otwarte"),
        "w_grze": sum(1 for x in levels_out if x["status"] == "w_grze"),
        "niezmitygowane": len(open_lv),
        "niezmitygowane_hvn": sum(1 for x in open_lv if x["typ"] == "HVN"),
        "niezmitygowane_lvn": sum(1 for x in open_lv if x["typ"] == "LVN"),
        "godzin": len(hours_out),
    }

    obj = {
        "instrument": "US500",
        "tz": "Europe/Warsaw",
        "asof": _iso(now),
        "from": date_from.isoformat(),
        "to": date_to.isoformat(),
        "last_price": round(float(last_price), 1),
        "last_ts": _iso(last_ts),
        "defs": {
            "bin": float(H.BIN),
            "smooth_sigma": float(H.SMOOTH_SIGMA),
            "hvn_prom": float(H.HVN_PROM),
            "hvn_height": float(H.HVN_HEIGHT),
            "hvn_dist": int(H.HVN_DIST),
            "hvn_max": int(H.HVN_MAX),
            "lvn_frac": float(H.LVN_FRAC),
            "leave": float(H.LEAVE_DIST),
            "touch": float(H.TOUCH_BUF),
            "mitigation": "pierwszy powrót po oddaleniu ≥15 pkt (tolerancja ±1,5 pkt)",
        },
        "counts": counts,
        "pmin": int(pmin),
        "pmax": int(pmax),
        "vmax": round(vmax, 1),
        "hours": hours_out,
        "cols": cols,
        "h1": h1_out,
        "levels": levels_out,
        "open": open_lv,
        "profile": profile,
        "profile_open": profile_open,
    }

    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(out.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    tmp.replace(out)
    size = out.stat().st_size
    H.log(
        f"Zapisano {out}  ({size} B, {counts['godzin']} godz., "
        f"niezmitygowane HVN={counts['niezmitygowane_hvn']} "
        f"LVN={counts['niezmitygowane_lvn']}, "
        f"cena {last_price:.1f} @ {last_ts.astimezone(H.WAW):%d.%m %H:%M %Z})"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception:
        traceback.print_exc()
        raise SystemExit(1)
