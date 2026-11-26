#!/usr/bin/env python3
"""Szereg VIX (M1 / M5) z flexS JSON, flex CSV i magazynu – do wypełnienia pól vs/ve w US500."""
from __future__ import annotations

import json
import math
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

W = ZoneInfo("Europe/Warsaw")
UTC = ZoneInfo("UTC")
FLEX_DIR = Path("/workspace/raporty/flex_archive/VIX")
DOWNLOADS = Path("/home/box/Downloads")
STORE = Path("/workspace/raporty/flex_live/store")
PACK_DIRS = [
    Path("/workspace/raporty/da_flow_fx/out"),
    Path("/workspace/raporty/da_flow_fx"),
]


def session_date(dt: datetime) -> str:
    local = dt.astimezone(W)
    if local.hour >= 23:
        return (local.date() + timedelta(days=1)).isoformat()
    return local.date().isoformat()


def pl_dt(session: str, hhmm: str) -> datetime:
    h, m = map(int, hhmm.split(":"))
    d = date.fromisoformat(session)
    if h >= 20:
        d = d - timedelta(days=1)
    return datetime(d.year, d.month, d.day, h, m, tzinfo=W)


def minute_key(order_by: str) -> str:
    s = order_by.strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    dt = dt.astimezone(UTC).replace(second=0, microsecond=0)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_flex_bar(b: dict) -> dict | None:
    if not b or not b.get("orderBy"):
        return None
    try:
        o, h, l, c = float(b["open"]), float(b["high"]), float(b["low"]), float(b["close"])
    except (KeyError, TypeError, ValueError):
        return None
    if not all(math.isfinite(x) for x in (o, h, l, c)):
        return None
    return {"t": minute_key(b["orderBy"]), "o": o, "h": h, "l": l, "c": c}


def extract_tvd(raw) -> list:
    if not isinstance(raw, dict):
        return []
    if "todayVolumeData" in raw:
        return raw.get("todayVolumeData") or []
    if "r" in raw and isinstance(raw["r"], list):
        for item in raw["r"]:
            if not isinstance(item, dict):
                continue
            url = str(item.get("url") or "")
            if "flex" not in url:
                continue
            try:
                st = int(item["st"]) if item.get("st") is not None else 200
            except (TypeError, ValueError):
                st = 200
            if st != 200:
                continue
            j = item.get("j") or {}
            if isinstance(j, dict) and j.get("todayVolumeData"):
                return j["todayVolumeData"]
    return []


def bars_from_flexs(raw) -> list:
    out = []
    for b in extract_tvd(raw):
        pb = parse_flex_bar(b)
        if pb:
            out.append(pb)
    return out


def latest_flexs_files(limit: int = 12) -> list[Path]:
    if not DOWNLOADS.is_dir():
        return []
    files = list(DOWNLOADS.glob("flexS_VIX_*.json"))
    files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return files[:limit]


def store_path(day: str) -> Path:
    return STORE / f"VIX_{day}.json"


def load_store(day: str) -> dict:
    p = store_path(day)
    if not p.is_file() or not p.stat().st_size:
        return {"ticker": "VIX", "session": day, "bars": {}}
    try:
        store = json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"ticker": "VIX", "session": day, "bars": {}}
    bars = store.get("bars") or {}
    if isinstance(bars, list):
        bars = {x["t"]: x for x in bars if isinstance(x, dict) and x.get("t")}
    store["bars"] = bars
    store["ticker"] = "VIX"
    store["session"] = day
    return store


def write_store(store: dict) -> None:
    day = store["session"]
    STORE.mkdir(parents=True, exist_ok=True)
    p = store_path(day)
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text(json.dumps(store, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    tmp.replace(p)


def merge_bars_into_store(day: str, bars: list) -> dict:
    store = load_store(day)
    bar_map = store["bars"]
    for b in bars:
        if session_date(datetime.fromisoformat(b["t"].replace("Z", "+00:00"))) != day:
            continue
        bar_map[b["t"]] = b
    store["bars"] = bar_map
    write_store(store)
    return store


def ingest_latest_flexs(day: str | None = None) -> dict[str, int]:
    """Wczytaj najnowsze flexS_VIX z Downloads do magazynu. Zwraca {sesja: liczba świec}."""
    counts: dict[str, int] = {}
    for path in latest_flexs_files():
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        bars = bars_from_flexs(raw)
        by: dict[str, list] = {}
        for b in bars:
            d = session_date(datetime.fromisoformat(b["t"].replace("Z", "+00:00")))
            by.setdefault(d, []).append(b)
        for d, bs in by.items():
            if day and d != day:
                continue
            st = merge_bars_into_store(d, bs)
            counts[d] = len(st["bars"])
    return counts


def vix_at(bar_map: dict, when: datetime, max_age_min: int = 10) -> float | None:
    """Ostatnie zamknięcie VIX o when lub wcześniej, nie starsze niż max_age_min."""
    if not bar_map:
        return None
    key = when.astimezone(UTC).replace(second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")
    if key in bar_map:
        return float(bar_map[key]["c"])
    # szukaj wstecz po posortowanych kluczach
    keys = getattr(vix_at, "_keys", None)
    cache_id = getattr(vix_at, "_id", None)
    if cache_id is not id(bar_map):
        keys = sorted(bar_map)
        vix_at._keys = keys
        vix_at._id = id(bar_map)
    # binary search last key <= when
    lo, hi = 0, len(keys)
    while lo < hi:
        mid = (lo + hi) // 2
        if keys[mid] <= key:
            lo = mid + 1
        else:
            hi = mid
    if lo == 0:
        return None
    prev = keys[lo - 1]
    prev_dt = datetime.fromisoformat(prev.replace("Z", "+00:00"))
    if (when.astimezone(UTC) - prev_dt).total_seconds() > max_age_min * 60:
        return None
    return float(bar_map[prev]["c"])


def series_from_store(day: str) -> dict:
    store = load_store(day)
    return store.get("bars") or {}


def series_from_flex_csv(path: Path) -> list:
    """5-min (lub M1 zrekonstrukowane) z flex CSV – leniwy import flexparse."""
    import sys
    sys.path.insert(0, "/workspace/platformy_review/v_new/lib")
    from flexparse import build_m1  # noqa: WPS433
    v = build_m1(str(path))
    if v is None or not len(v):
        return []
    out = []
    for _, r in v.iterrows():
        ts = r.get("timestamp")
        try:
            t = ts.to_pydatetime() if hasattr(ts, "to_pydatetime") else datetime.fromisoformat(str(ts))
        except Exception:
            continue
        if t.tzinfo is None:
            t = t.replace(tzinfo=W)
        t = t.astimezone(UTC).replace(second=0, microsecond=0)
        try:
            o, h, l, c = float(r.O), float(r.H), float(r.L), float(r.C)
        except (TypeError, ValueError):
            continue
        out.append({"t": t.strftime("%Y-%m-%dT%H:%M:%SZ"), "o": o, "h": h, "l": l, "c": c})
    return out


def series_from_vix_json_day(ses: dict, day: str) -> list:
    bars = []
    for b in ses.get("boxes") or []:
        if not b or b[4] is None:
            continue
        t = pl_dt(day, b[0]).astimezone(UTC)
        bars.append({"t": t.strftime("%Y-%m-%dT%H:%M:%SZ"), "o": float(b[1]), "h": float(b[2]), "l": float(b[3]), "c": float(b[4])})
    return bars


def fill_boxes(ses: dict, bar_map: dict, day: str, overwrite: bool = False) -> tuple[int, int]:
    """Uzupełnij b[13]/b[14] (VIX na początku/końcu świecy). Zwraca (z_VIX, n)."""
    boxes = ses.get("boxes") or []
    n = 0
    for b in boxes:
        while len(b) < 16:
            b.append(None if len(b) < 15 else 0)
        start = pl_dt(day, b[0])
        end = start + timedelta(minutes=5)
        vs = vix_at(bar_map, start)
        ve = vix_at(bar_map, end)
        if vs is not None and (overwrite or b[13] is None):
            b[13] = round(vs, 2)
        if ve is not None and (overwrite or b[14] is None):
            b[14] = round(ve, 2)
        if b[14] is not None or b[13] is not None:
            n += 1
    ses["vix"] = n > 0
    if ses.get("vix_open") is None:
        ses["vix_open"] = next((b[14] for b in boxes if b[9] and b[14] is not None), None)
    return n, len(boxes)


def collect_day_bars(day: str, vix_json_day: dict | None = None) -> dict:
    """Złóż magazyn VIX dla sesji z dostępnych źródeł (flexS, magazyn, flex CSV, VIX.json)."""
    ingest_latest_flexs(day)
    store = load_store(day)
    bar_map = dict(store.get("bars") or {})
    # flex CSV (pełny, potem partial)
    full = FLEX_DIR / f"flex_{day}.csv"
    part = FLEX_DIR / f"flex_{day}_partial.csv"
    for p in (full, part):
        if p.is_file() and p.stat().st_size:
            try:
                for b in series_from_flex_csv(p):
                    bar_map.setdefault(b["t"], b)
            except Exception as e:
                print(f"vix_series: flex CSV {p.name}: {e}")
    if vix_json_day:
        for b in series_from_vix_json_day(vix_json_day, day):
            bar_map.setdefault(b["t"], b)
    if bar_map:
        store["bars"] = bar_map
        write_store(store)
    # zresetuj cache bisekcji
    if hasattr(vix_at, "_id"):
        vix_at._id = None
    return bar_map


def pearson_from_boxes(boxes: list) -> dict:
    xs, ys = [], []
    prev_c = prev_v = None
    for b in boxes:
        v = b[14] if len(b) > 14 and b[14] is not None else (b[13] if len(b) > 13 else None)
        c = b[4]
        if v is None or c is None:
            continue
        if prev_c and prev_v:
            xs.append((c - prev_c) / prev_c)
            ys.append((v - prev_v) / prev_v)
        prev_c, prev_v = c, v
    n = len(xs)
    if n < 5:
        return {"r": None, "n": n}
    mx, my = sum(xs) / n, sum(ys) / n
    num = dx = dy = 0.0
    for a, b in zip(xs, ys):
        a, b = a - mx, b - my
        num += a * b
        dx += a * a
        dy += b * b
    den = math.sqrt(dx * dy)
    r = None if den < 1e-15 else num / den
    # rolling 60 min = ostatnie 12 zwrotów (13 świec)
    r60 = None
    n60 = 0
    if n >= 5:
        x2, y2 = xs[-12:], ys[-12:]
        n60 = len(x2)
        if n60 >= 5:
            mx, my = sum(x2) / n60, sum(y2) / n60
            num = dx = dy = 0.0
            for a, b in zip(x2, y2):
                a, b = a - mx, b - my
                num += a * b
                dx += a * a
                dy += b * b
            den = math.sqrt(dx * dy)
            r60 = None if den < 1e-15 else num / den
    return {"r": r, "n": n, "r60": r60, "n60": n60}


def fill_today(ses: dict, day: str) -> tuple[int, int]:
    """Odśwież VIX na sesji w toku z flexS / magazynu (bez nadpisywania wcześniejszych vs/ve, oprócz luk)."""
    ingest_latest_flexs(day)
    bar_map = series_from_store(day)
    if not bar_map:
        return 0, len(ses.get("boxes") or [])
    if hasattr(vix_at, "_id"):
        vix_at._id = None
    return fill_boxes(ses, bar_map, day, overwrite=False)
