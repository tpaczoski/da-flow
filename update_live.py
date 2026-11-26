#!/usr/bin/env python3
"""Scal świece M1 z flex/latest do magazynu sesji i wypchnij live/US500_live.json
oraz bieżący dzień w formacie głównego widoku (live/US500_day.json)."""
from __future__ import annotations

import fcntl
import json
import math
import os
import stat
import subprocess
import sys
import time
import tempfile
import zipfile
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

W = ZoneInfo("Europe/Warsaw")
ET = ZoneInfo("America/New_York")
UTC = ZoneInfo("UTC")
SITE = Path(__file__).resolve().parent
STORE = Path("/workspace/raporty/flex_live/store")
LOCK = Path("/workspace/raporty/flex_live/.update_live.lock")
LIVE = SITE / "live" / "US500_live.json"
DAY_LIVE = SITE / "live" / "US500_day.json"
US500_JSON = SITE / "data" / "US500.json"
HVN_JSON = SITE / "data" / "US500_hvn_lvn.json"
HVN_BUILD = SITE / "build_hvn_lvn_json.py"
HVN_MAX_SEC = 10
HVN_MIN_AGE = 3600  # raz na godzinę
REPO = "https://github.com/tpaczoski/da-flow.git"
REMOTE = "https://x-access-token@github.com/tpaczoski/da-flow.git"
PACK_DIRS = [
    Path("/workspace/raporty/da_flow_fx/out"),
    Path("/workspace/raporty/da_flow_fx"),
    Path("/home/box/agent-data/agents/6a24bd74-2328-4b41-9be0-ec6bf4eb2443/attachments/da_flow_fx"),
]


def err(msg: str, code: int = 1) -> None:
    print(f"update_live: {msg}", file=sys.stderr)
    raise SystemExit(code)


def session_date(dt: datetime) -> str:
    local = dt.astimezone(W)
    if local.hour >= 23:
        return (local.date() + timedelta(days=1)).isoformat()
    return local.date().isoformat()


def minute_key(order_by: str) -> str:
    s = order_by.strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    dt = dt.astimezone(UTC).replace(second=0, microsecond=0)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_bar(b: dict) -> dict | None:
    if not b or not b.get("orderBy"):
        return None
    pdm = b.get("priceDeltaToVolumeMap") or {}
    lv = []
    for p, v in pdm.items():
        try:
            price = float(p)
        except (TypeError, ValueError):
            continue
        v = v or {}
        bid = int(v.get("volumeBid") or 0)
        ask = int(v.get("volumeAsk") or 0)
        if bid or ask:
            lv.append([price, bid, ask])
    lv.sort(key=lambda x: x[0])
    try:
        o, h, l, c = float(b["open"]), float(b["high"]), float(b["low"]), float(b["close"])
    except (KeyError, TypeError, ValueError):
        return None
    t = minute_key(b["orderBy"])
    return {"t": t, "o": o, "h": h, "l": l, "c": c, "lv": lv}


def extract_flex(raw):
    """Zwraca (j, source_t, http_status) albo rzuca SystemExit."""
    if raw is None or raw == "" or raw == {}:
        err("puste dane wejściowe")
    if not isinstance(raw, dict):
        err("nieprawidłowy JSON (oczekiwany obiekt)")

    if "r" in raw and isinstance(raw["r"], list):
        flex = None
        for item in raw["r"]:
            if not isinstance(item, dict):
                continue
            url = str(item.get("url") or "")
            if "flex" in url:
                flex = item
                break
        if flex is None:
            err("brak wpisu flex w pliku")
        st = flex.get("st")
        try:
            st_i = int(st) if st is not None else None
        except (TypeError, ValueError):
            st_i = None
        if st_i == 401:
            err("flex/latest zwrócił 401 (brak sesji / niezalogowano)", 1)
        if st_i is not None and st_i != 200:
            err(f"flex/latest zwrócił HTTP {st_i}", 1)
        j = flex.get("j")
        if not j:
            body = flex.get("b") or ""
            if "401" in str(body):
                err("flex/latest zwrócił 401 (brak sesji / niezalogowano)", 1)
            err("puste dane wejściowe (brak treści flex)", 1)
        return j, raw.get("t"), st_i

    if "todayVolumeData" in raw:
        return raw, raw.get("t") or raw.get("updated_at"), 200

    err("nieprawidłowy format (brak r[].url z flex ani todayVolumeData)")


def compact_bars(bar_map: dict) -> list:
    bars = [bar_map[k] for k in sorted(bar_map)]
    for b in bars:
        b["lv"] = [[p, bi, a] for p, bi, a in b["lv"]]
    return bars



def maybe_refresh_hvn_lvn(now_local: datetime) -> bool:
    """Odśwież data/US500_hvn_lvn.json najwyżej raz na godzinę (budżet 10 s).

    Zwraca True, gdy plik na dysku zmienił się w tym przebiegu.
    Błąd lub przekroczenie czasu nie przerywa odświeżenia live.
    """
    if not HVN_BUILD.is_file():
        print("update_live: brak build_hvn_lvn_json.py, pomijam HVN/LVN")
        return False
    if HVN_JSON.is_file():
        age = time.time() - HVN_JSON.stat().st_mtime
        if age < HVN_MIN_AGE:
            print(f"update_live: HVN/LVN świeże ({int(age)} s), pomijam przebudowę")
            return False
    before = HVN_JSON.read_bytes() if HVN_JSON.is_file() else b""
    try:
        r = subprocess.run(
            [sys.executable, str(HVN_BUILD)],
            cwd=str(SITE),
            capture_output=True,
            text=True,
            timeout=HVN_MAX_SEC,
        )
    except subprocess.TimeoutExpired:
        print("update_live: budowa HVN/LVN przekroczyła 10 s – pomijam, live bez zmian w tym pliku")
        return False
    except Exception as e:
        print(f"update_live: budowa HVN/LVN nie wystartowała ({e})")
        return False
    tail = redact(((r.stdout or "") + (r.stderr or "")).strip().splitlines()[-1] if ((r.stdout or "") + (r.stderr or "")).strip() else "")
    if r.returncode != 0:
        print(f"update_live: budowa HVN/LVN nie powiodła się (exit {r.returncode}): {tail}")
        return False
    after = HVN_JSON.read_bytes() if HVN_JSON.is_file() else b""
    changed = after != before
    print("update_live: HVN/LVN " + ("zaktualizowane" if changed else "przebudowane, bez zmian w pliku") + (f" ({tail})" if tail else ""))
    return changed


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    tmp.replace(path)


def acquire_lock():
    LOCK.parent.mkdir(parents=True, exist_ok=True)
    fh = open(LOCK, "a+")
    try:
        fcntl.flock(fh.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        fh.close()
        err("inne odświeżenie już trwa (lock)")
    return fh


def redact(s: str) -> str:
    tok = os.environ.get("GITHUB_DAFLOW_TOKEN") or ""
    if tok and tok in s:
        s = s.replace(tok, "***")
    return s


def git_push_live(now_local: datetime, paths: list[str] | None = None) -> None:
    """Commit i push plików live (US500_live.json i ewentualnie US500_day.json)."""
    if not (SITE / ".git").is_dir():
        print("update_live: brak repozytorium git, pomijam push")
        return
    rels = paths or ["live/US500_live.json"]

    def run(args, **kw):
        r = subprocess.run(args, cwd=SITE, capture_output=True, text=True, **kw)
        if r.returncode != 0:
            out = redact((r.stdout or "") + (r.stderr or "")).strip()
            err(f"git {' '.join(args[1:])} nie powiódł się: {out or r.returncode}")
        return r

    def cfg(key):
        r = subprocess.run(["git", "config", "--get", key], cwd=SITE, capture_output=True, text=True)
        return r.stdout.strip() if r.returncode == 0 else ""

    if not cfg("user.name"):
        run(["git", "config", "user.name", "DA Flow"])
    if not cfg("user.email"):
        run(["git", "config", "user.email", "tpaczoski@users.noreply.github.com"])

    run(["git", "add", *rels])
    diff = subprocess.run(
        ["git", "diff", "--cached", "--quiet", "--", *rels],
        cwd=SITE,
    )
    if diff.returncode == 0:
        print("update_live: bez zmian, pomijam push")
        return

    msg = f"live US500 {now_local:%H:%M}"
    run(["git", "commit", "-m", msg])

    tok = os.environ.get("GITHUB_DAFLOW_TOKEN")
    if not tok:
        err("brak GITHUB_DAFLOW_TOKEN – zapisano plik, ale nie można wypchnąć")

    fd, ask = tempfile.mkstemp(prefix="daf-askpass-", suffix=".sh")
    try:
        os.write(
            fd,
            b"#!/bin/sh\n"
            b'case "$1" in\n'
            b"  *Username*) echo x-access-token ;;\n"
            b'  *) printf %s "$GITHUB_DAFLOW_TOKEN" ;;\n'
            b"esac\n",
        )
        os.close(fd)
        os.chmod(ask, stat.S_IRWXU)
        env = os.environ.copy()
        env["GIT_ASKPASS"] = ask
        env["GIT_TERMINAL_PROMPT"] = "0"
        env["GCM_INTERACTIVE"] = "never"
        r = subprocess.run(
            ["git", "push", REMOTE, "HEAD:main"],
            cwd=SITE,
            capture_output=True,
            text=True,
            env=env,
        )
        if r.returncode != 0:
            out = redact((r.stdout or "") + (r.stderr or "")).strip()
            err(f"git push nie powiódł się: {out or r.returncode}")
        print(f"update_live: wypchnięto ({msg})")
    finally:
        try:
            os.unlink(ask)
        except OSError:
            pass


# --- dzień w toku dla głównego widoku DA Flow ---------------------------------

def _pl_dt(session: str, hhmm: str) -> datetime:
    h, m = map(int, hhmm.split(":"))
    d = date.fromisoformat(session)
    if h >= 20:
        d = d - timedelta(days=1)
    return datetime(d.year, d.month, d.day, h, m, tzinfo=W)


def _etslot(session: str, hhmm: str, fl: str = "5min") -> str:
    t = _pl_dt(session, hhmm).astimezone(ET)
    if fl == "60min":
        t = t.replace(minute=0, second=0, microsecond=0)
    else:
        t = t.replace(minute=t.minute - t.minute % 5, second=0, microsecond=0)
    return t.strftime("%H:%M")


def _is_rth(session: str, hhmm: str) -> int:
    t = _pl_dt(session, hhmm).astimezone(ET)
    return int(570 <= t.hour * 60 + t.minute < 960)


def _sess_min(hhmm: str) -> int:
    h, m = map(int, hhmm.split(":"))
    return (h * 60 + m - 23 * 60) % 1440


def _va(prof: dict, pct: float = 0.7):
    if not prof:
        return (None, None, None)
    ps = sorted(prof)
    v = [float(prof[p]) for p in ps]
    i = max(range(len(v)), key=lambda k: v[k])
    lo = hi = i
    tot = sum(v)
    acc = v[i]
    while acc < pct * tot and (lo > 0 or hi < len(ps) - 1):
        up = v[hi + 1] if hi < len(ps) - 1 else -1
        dn = v[lo - 1] if lo > 0 else -1
        if up >= dn:
            hi += 1
            acc += up
        else:
            lo -= 1
            acc += dn
    return ps[hi], ps[i], ps[lo]


def _official_today(day: str):
    """Wpis dnia z data/US500.json, jeśli jest."""
    if not US500_JSON.is_file():
        return None, {}
    try:
        data = json.loads(US500_JSON.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None, {}
    if not isinstance(data, dict):
        return None, {}
    return data.get(day), data


def _seed_from_pack(day: str):
    cands = []
    for d in PACK_DIRS:
        if not d.is_dir():
            continue
        cands.extend(d.glob(f"DA_Flow_all_{day}_*.zip"))
        cands.extend(d.glob(f"DA_Flow_all_{day}.zip"))
    if not cands:
        return None
    zpath = max(cands, key=lambda p: p.stat().st_mtime)
    try:
        with zipfile.ZipFile(zpath) as z:
            if "data/US500.json" not in z.namelist():
                return None
            data = json.loads(z.read("data/US500.json"))
    except (OSError, zipfile.BadZipFile, json.JSONDecodeError):
        return None
    ses = data.get(day) if isinstance(data, dict) else None
    if not ses or not ses.get("boxes"):
        return None
    return ses


def _prev_avgs(us500: dict, today: str):
    days = sorted(
        d
        for d, v in us500.items()
        if isinstance(v, dict) and d < today and v.get("boxes") and not v.get("niepelna")
    )[-5:]
    sl5, sl60 = defaultdict(list), defaultdict(list)
    for d in days:
        ses = us500[d]
        by = defaultdict(lambda: [0, 0])
        for c in ses.get("cells") or []:
            by[c[0]][0] += int(c[2] or 0)
            by[c[0]][1] += int(c[3] or 0)
        hour_tot = defaultdict(float)
        for i, b in enumerate(ses["boxes"]):
            vol = by[i][0] + by[i][1]
            sl5[_etslot(d, b[0], "5min")].append(vol)
            hour_tot[_etslot(d, b[0], "60min")] += vol
        for hh, tot in hour_tot.items():
            sl60[hh].append(tot)
    if len(days) < 3:
        return {}, {}
    p5 = {k: (sum(v) / len(v)) for k, v in sl5.items() if v}
    p60 = {k: (sum(v) / len(v)) for k, v in sl60.items() if v}
    return p5, p60


def _group_m1_complete(bars: list):
    """Kompletne świece 5 min z M1 (t = początek minuty UTC) → (start PL, [(t, bar), ...])."""
    groups = defaultdict(list)
    for b in bars:
        t = datetime.fromisoformat(b["t"].replace("Z", "+00:00")).astimezone(W)
        h = t.replace(minute=t.minute - t.minute % 5, second=0, microsecond=0)
        groups[h].append((t, b))
    out = []
    for h in sorted(groups):
        items = sorted(groups[h], key=lambda x: x[0])
        minutes = {t.replace(second=0, microsecond=0) for t, _ in items}
        need = {h + timedelta(minutes=i) for i in range(5)}
        if need.issubset(minutes):
            out.append((h, items))
    return out


def _pick_seed(day: str, official, sidecar):
    """Baza wczesnej sesji: oficjalny dzień (gdy jest), inaczej sidecar, inaczej paczka ZIP."""
    # sfinalizowany dzień z push_daily – nie nadpisujemy
    if official and official.get("boxes") and not official.get("niepelna"):
        return official, "final"
    cands = []
    for label, ses in (("official", official), ("sidecar", sidecar), ("pack", _seed_from_pack(day))):
        if ses and ses.get("boxes"):
            cands.append((len(ses["boxes"]), _sess_min(ses["boxes"][-1][0]), label, ses))
    if not cands:
        return None, "none"
    cands.sort()
    return cands[-1][3], cands[-1][2]


def build_today_day(day: str, m1_bars: list, updated: str, now_local: datetime) -> dict | None:
    """Zbuduj wpis dnia w formacie data/US500.json (sesja w toku, bez duplikatu po push_daily)."""
    official, us500 = _official_today(day)
    sidecar = None
    if DAY_LIVE.is_file():
        try:
            raw = json.loads(DAY_LIVE.read_text(encoding="utf-8"))
            if isinstance(raw, dict) and raw.get("session") == day and raw.get("boxes"):
                sidecar = raw
        except json.JSONDecodeError:
            sidecar = None

    seed, src_kind = _pick_seed(day, official, sidecar)
    if src_kind == "final":
        print(f"update_live: dzień {day} jest już sfinalizowany w data/US500.json – pomijam sidecar")
        return None

    p5, p60 = _prev_avgs(us500 or {}, day)
    boxes, cells = [], []
    cum: dict = defaultdict(float)
    last_seed = -1
    if seed and seed.get("boxes"):
        boxes = [list(b) for b in seed["boxes"]]
        cells = [list(c) for c in seed.get("cells") or []]
        for c in cells:
            cum[c[1]] += int(c[2] or 0) + int(c[3] or 0)
        last_seed = _sess_min(boxes[-1][0])

    added = 0
    for h, items in _group_m1_complete(m1_bars):
        hhmm = h.strftime("%H:%M")
        if _sess_min(hhmm) <= last_seed:
            continue
        o = items[0][1]["o"]
        hi = max(b["h"] for _, b in items)
        lo = min(b["l"] for _, b in items)
        c = items[-1][1]["c"]
        lv: dict = defaultdict(lambda: [0, 0])
        for _, b in items:
            for p, bi, ak in b.get("lv") or []:
                n = int(math.floor(float(p) / 1.0 + 1e-6))
                lv[n][0] += int(bi or 0)
                lv[n][1] += int(ak or 0)
        lv = {n: v for n, v in lv.items() if v[0] or v[1]}
        vol = sum(v[0] + v[1] for v in lv.values())
        for n, v in lv.items():
            cum[n] += v[0] + v[1]
        vah, poc, val = _va({k: v for k, v in cum.items() if v > 0})
        s5 = _etslot(day, hhmm, "5min")
        x = round(vol / p5[s5], 2) if s5 in p5 and p5[s5] else None
        et = h.astimezone(ET)
        bi = len(boxes)
        boxes.append([
            hhmm,
            round(float(o), 2),
            round(float(hi), 2),
            round(float(lo), 2),
            round(float(c), 2),
            None if vah is None else float(vah),
            None if poc is None else float(poc),
            None if val is None else float(val),
            x,
            _is_rth(day, hhmm),
            0,
            h.strftime("%H"),
            et.strftime("%H"),
            None,
            None,
            0,
        ])
        for n in sorted(lv):
            cells.append([bi, int(n) if float(n).is_integer() else n, int(lv[n][0]), int(lv[n][1])])
        added += 1

    if not boxes:
        return None

    sl60: dict = defaultdict(float)
    by: dict = defaultdict(lambda: [0, 0])
    for c in cells:
        by[c[0]][0] += int(c[2] or 0)
        by[c[0]][1] += int(c[3] or 0)
    for i, b in enumerate(boxes):
        sl60[_etslot(day, b[0], "60min")] += by[i][0] + by[i][1]
    hx = {}
    for hh, v in sl60.items():
        if hh in p60 and p60[hh]:
            hx[hh] = round(float(v / p60[hh]), 2)

    last = boxes[-1][0]
    src_base = (seed.get("src") if seed else None) or "flex (rekonstrukcja) + live M1"
    if "· SESJA NIEPEŁNA" in src_base:
        src_base = src_base.split("· SESJA NIEPEŁNA")[0].rstrip()
    src = f"{src_base} · SESJA NIEPEŁNA (odczyt {now_local:%H:%M} PL, ostatnia świeca {last})"
    vix_open = seed.get("vix_open") if seed else None
    vix = bool(seed.get("vix")) if seed else False
    if vix_open is None:
        vix_open = next((b[14] for b in boxes if b[9] and b[14] is not None), None)

    print(
        f"update_live: dzień w toku {day}: {len(boxes)} świec M5 "
        f"(+{added} z magazynu M1, baza {src_kind}), ostatnia {last}"
    )
    try:
        from vix_series import fill_today
        nv, nt = fill_today({"boxes": boxes, "vix_open": vix_open, "vix": vix}, day)
        # fill_today mutates boxes; odczytaj vix_open jeśli się pojawił
        if vix_open is None:
            vix_open = next((b[14] for b in boxes if b[9] and len(b) > 14 and b[14] is not None), None)
        vix = vix or nv > 0
        print(f"update_live: VIX na dniu {day}: {nv}/{nt} świec z VIX")
    except Exception as e:
        print(f"update_live: VIX nie uzupełniony ({e})")
    return {
        "ticker": "US500",
        "session": day,
        "updated_at": updated,
        "src": src,
        "boxes": boxes,
        "cells": cells,
        "h1x": hx,
        "vix_open": vix_open,
        "vix": vix,
        "m1": None,
        "niepelna": True,
    }


def _day_payload(obj: dict) -> tuple:
    """Część, która ma znaczenie na wykresie (bez znacznika czasu odczytu)."""
    boxes = obj.get("boxes") or []
    nv = sum(1 for b in boxes if len(b) > 14 and b[14] is not None)
    last_v = boxes[-1][14] if boxes and len(boxes[-1]) > 14 else None
    return (
        obj.get("session"),
        obj.get("niepelna"),
        len(boxes),
        (boxes[-1][0], boxes[-1][4]) if boxes else None,
        obj.get("h1x"),
        len(obj.get("cells") or []),
        nv,
        last_v,
    )


def write_today_day(day: str, m1_bars: list, updated: str, now_local: datetime) -> bool:
    """Zapisz live/US500_day.json. Zwraca True, gdy świece/profil się zmieniły."""
    obj = build_today_day(day, m1_bars, updated, now_local)
    if obj is None:
        return False
    prev = None
    if DAY_LIVE.is_file():
        try:
            prev = json.loads(DAY_LIVE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            prev = None
    if prev and _day_payload(prev) == _day_payload(obj):
        print(f"update_live: live/US500_day.json bez zmian ({len(obj['boxes'])} świec M5, sesja {day})")
        return False
    new = json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n"
    DAY_LIVE.parent.mkdir(parents=True, exist_ok=True)
    tmp = DAY_LIVE.with_suffix(".json.tmp")
    tmp.write_text(new, encoding="utf-8")
    tmp.replace(DAY_LIVE)
    last = obj["boxes"][-1]
    print(
        f"update_live: zapisano {DAY_LIVE.relative_to(SITE)} "
        f"(sesja {day}, {len(obj['boxes'])} świec M5, ostatnia {last[0]}, close {last[4]})"
    )
    return True


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] in ("-h", "--help"):
        err("użycie: python3 update_live.py <plik.json>", 2)
    src = Path(sys.argv[1])
    if not src.is_file():
        err(f"nie znaleziono pliku: {src}")
    if src.stat().st_size == 0:
        err("puste dane wejściowe (plik ma 0 bajtów)")

    lock = acquire_lock()
    try:
        try:
            raw = json.loads(src.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            err(f"nieprawidłowy JSON: {e}")

        j, source_t, _st = extract_flex(raw)
        tvd = j.get("todayVolumeData") if isinstance(j, dict) else None
        if not tvd:
            err("puste dane wejściowe (brak świec M1)")

        bars_in = []
        for b in tvd:
            pb = parse_bar(b)
            if pb:
                bars_in.append(pb)
        if not bars_in:
            err("puste dane wejściowe (brak świec M1 do odczytania)")

        # zaktualizuj magazyny sesji (deduplikacja po minucie; późniejszy odczyt wygrywa)
        by_session: dict[str, list] = {}
        for b in bars_in:
            dt = datetime.fromisoformat(b["t"].replace("Z", "+00:00"))
            d = session_date(dt)
            by_session.setdefault(d, []).append(b)

        STORE.mkdir(parents=True, exist_ok=True)
        stores = {}
        for d, new_bars in by_session.items():
            sp = STORE / f"US500_{d}.json"
            if sp.is_file() and sp.stat().st_size:
                try:
                    store = json.loads(sp.read_text(encoding="utf-8"))
                except json.JSONDecodeError:
                    store = {"ticker": "US500", "session": d, "bars": {}}
            else:
                store = {"ticker": "US500", "session": d, "bars": {}}
            bar_map = store.get("bars") or {}
            if isinstance(bar_map, list):
                bar_map = {x["t"]: x for x in bar_map if isinstance(x, dict) and x.get("t")}
            for b in new_bars:
                bar_map[b["t"]] = b  # later fetch wins
            store["ticker"] = "US500"
            store["session"] = d
            store["bars"] = bar_map
            write_json(sp, store)
            stores[d] = store
            print(f"update_live: sesja {d}: {len(bar_map)} świec M1 (magazyn {sp})")

        now = datetime.now(W)
        current = session_date(now)
        # live: bieżąca sesja PL, jeśli ma dane; inaczej sesja najnowszej świecy
        if current in stores:
            live_d = current
        else:
            # może bieżąca sesja już była w magazynie, a ten odczyt dotyczy tylko starszej
            cur_path = STORE / f"US500_{current}.json"
            if cur_path.is_file():
                try:
                    stores[current] = json.loads(cur_path.read_text(encoding="utf-8"))
                    live_d = current
                except json.JSONDecodeError:
                    live_d = max(stores)
            else:
                live_d = max(stores)

        store = stores[live_d]
        bar_map = store["bars"]
        if isinstance(bar_map, list):
            bar_map = {x["t"]: x for x in bar_map}
        bars = compact_bars(bar_map)
        if source_t:
            updated = source_t
        else:
            updated = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
        # ujednolić ending
        if isinstance(updated, str) and updated.endswith("+00:00"):
            updated = updated[:-6] + "Z"

        live_obj = {
            "ticker": "US500",
            "session": live_d,
            "updated_at": updated,
            "bars": bars,
        }
        old = LIVE.read_text(encoding="utf-8") if LIVE.is_file() else None
        new = json.dumps(live_obj, ensure_ascii=False, separators=(",", ":")) + "\n"
        LIVE.parent.mkdir(parents=True, exist_ok=True)
        live_changed = old != new
        if not live_changed:
            print(f"update_live: live/US500_live.json bez zmian ({len(bars)} świec, sesja {live_d})")
        else:
            tmp = LIVE.with_suffix(".json.tmp")
            tmp.write_text(new, encoding="utf-8")
            tmp.replace(LIVE)
            last = bars[-1]
            print(
                f"update_live: zapisano {LIVE.relative_to(SITE)} "
                f"(sesja {live_d}, {len(bars)} świec, ostatnia {last['t']}, close {last['c']})"
            )

        day_changed = write_today_day(live_d, bars, updated, now)
        hvn_changed = maybe_refresh_hvn_lvn(now)
        rels = []
        if live_changed:
            rels.append("live/US500_live.json")
        if day_changed:
            rels.append("live/US500_day.json")
        if hvn_changed:
            rels.append("data/US500_hvn_lvn.json")
        if not rels:
            print("update_live: bez zmian, pomijam push")
            return
        git_push_live(now, rels)
    finally:
        lock.close()


if __name__ == "__main__":
    main()
