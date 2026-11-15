#!/usr/bin/env python3
"""Scal świece M1 z flex/latest do magazynu sesji i wypchnij live/US500_live.json."""
from __future__ import annotations

import fcntl
import json
import os
import stat
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

W = ZoneInfo("Europe/Warsaw")
SITE = Path(__file__).resolve().parent
STORE = Path("/workspace/raporty/flex_live/store")
LOCK = Path("/workspace/raporty/flex_live/.update_live.lock")
LIVE = SITE / "live" / "US500_live.json"
REPO = "https://github.com/tpaczoski/da-flow.git"
REMOTE = "https://x-access-token@github.com/tpaczoski/da-flow.git"


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
        dt = dt.replace(tzinfo=ZoneInfo("UTC"))
    dt = dt.astimezone(ZoneInfo("UTC")).replace(second=0, microsecond=0)
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


def git_push_live(now_local: datetime) -> None:
    """Commit i push tylko live/US500_live.json. Pomija, gdy brak zmian albo brak repo."""
    if not (SITE / ".git").is_dir():
        print("update_live: brak repozytorium git, pomijam push")
        return
    # status tylko tego pliku
    def run(args, **kw):
        r = subprocess.run(args, cwd=SITE, capture_output=True, text=True, **kw)
        if r.returncode != 0:
            out = redact((r.stdout or "") + (r.stderr or "")).strip()
            err(f"git {' '.join(args[1:])} nie powiódł się: {out or r.returncode}")
        return r

    # lokalna tożsamość, jeśli nieustawiona
    def cfg(key):
        r = subprocess.run(["git", "config", "--get", key], cwd=SITE, capture_output=True, text=True)
        return r.stdout.strip() if r.returncode == 0 else ""

    if not cfg("user.name"):
        run(["git", "config", "user.name", "DA Flow"])
    if not cfg("user.email"):
        run(["git", "config", "user.email", "tpaczoski@users.noreply.github.com"])

    run(["git", "add", "live/US500_live.json"])
    diff = subprocess.run(
        ["git", "diff", "--cached", "--quiet", "--", "live/US500_live.json"],
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
            b'#!/bin/sh\n'
            b'case "$1" in\n'
            b'  *Username*) echo x-access-token ;;\n'
            b'  *) printf %s "$GITHUB_DAFLOW_TOKEN" ;;\n'
            b'esac\n',
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
            updated = datetime.now(ZoneInfo("UTC")).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
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
        if old == new:
            print(f"update_live: live/US500_live.json bez zmian ({len(bars)} świec, sesja {live_d})")
            # i tak nic do commit – git_push_live sam to wykryje, ale skip szybciej
            print("update_live: bez zmian, pomijam push")
            return

        tmp = LIVE.with_suffix(".json.tmp")
        tmp.write_text(new, encoding="utf-8")
        tmp.replace(LIVE)
        last = bars[-1]
        print(
            f"update_live: zapisano {LIVE.relative_to(SITE)} "
            f"(sesja {live_d}, {len(bars)} świec, ostatnia {last['t']}, close {last['c']})"
        )
        git_push_live(now)
    finally:
        lock.close()


if __name__ == "__main__":
    main()
