#!/usr/bin/env bash
# Kopiuje data/<INST>.json z najnowszej paczki DA_Flow_all_*.zip do strony i wypycha na GitHub.
# Nie nadpisuje makro.json, opt_hist.json ani dclose.json (build_all_pack ich nie utrzymuje).
# Nie podmienia footprint_us500.html (zostałaby utracona poprawka v1.9 i link do widoku na żywo).
set -euo pipefail
SITE="$(cd "$(dirname "$0")" && pwd)"
cd "$SITE"

INSTS="US500 US100 US30 RTY SPY QQQ GOLD DE40 FR40 EU50 UK100 J225 HK50 CN50 VIX EURUSD DXY GBPUSD USDJPY USDCHF USDCAD AUDUSD NZDUSD EURGBP EURCHF GBPJPY AUDJPY AUDCAD GBPCAD NZDJPY EURPLN USDPLN USDHKD OIL_CRUDE SILVER NATURALGAS COPPER BTCUSD ETHUSD"

find_zip() {
  if [[ "${1-}" != "" ]]; then
    if [[ -f "$1" ]]; then echo "$1"; return 0; fi
    echo "push_daily: nie znaleziono pliku: $1" >&2
    return 1
  fi
  local cands=()
  local d
  for d in \
      /workspace/raporty/da_flow_fx/out \
      /workspace/raporty/da_flow_fx \
      /home/box/agent-data/agents/6a24bd74-2328-4b41-9be0-ec6bf4eb2443/attachments/da_flow_fx
  do
    [[ -d "$d" ]] || continue
    local f
    # najnowszy DA_Flow_all_*.zip (po dacie pliku)
    f="$(ls -1t "$d"/DA_Flow_all_*.zip 2>/dev/null | head -1 || true)"
    [[ -n "$f" ]] && cands+=("$f")
  done
  if [[ ${#cands[@]} -eq 0 ]]; then
    echo "push_daily: nie znaleziono DA_Flow_all_*.zip" >&2
    return 1
  fi
  ls -1t "${cands[@]}" | head -1
}

ZIP="$(find_zip "${1-}")"
echo "push_daily: źródło $ZIP"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
unzip -q -o "$ZIP" "data/*.json" -d "$TMP" || {
  echo "push_daily: w ZIP-ie nie ma data/*.json" >&2
  exit 1
}

copied=0
skipped=()
for inst in $INSTS; do
  src="$TMP/data/${inst}.json"
  if [[ -f "$src" ]]; then
    mkdir -p "$SITE/data"
    cp -f "$src" "$SITE/data/${inst}.json"
    copied=$((copied + 1))
  else
    skipped+=("$inst")
  fi
done

# straż: nigdy nie brać tych trzech z paczki dziennej (nawet gdyby się pojawiły)
for keep in makro.json opt_hist.json dclose.json; do
  if [[ -f "$TMP/data/$keep" ]]; then
    echo "push_daily: pomijam $keep z paczki (zostaje wersja v1.9 na stronie)"
  fi
done

echo "push_daily: skopiowano $copied instrumentów"
if [[ ${#skipped[@]} -gt 0 ]]; then
  echo "push_daily: brak w paczce: ${skipped[*]}"
fi

if [[ ! -d "$SITE/.git" ]]; then
  echo "push_daily: brak repozytorium git, pomijam push"
  exit 0
fi

git add data/*.json
# nie wystawiaj plików pomocniczych, nawet jeśli zmieniły się przypadkiem
git reset -q -- data/makro.json data/opt_hist.json data/dclose.json 2>/dev/null || true

if git diff --cached --quiet -- data/; then
  echo "push_daily: bez zmian w data/ instrumentów, pomijam push"
  exit 0
fi

git config user.name >/dev/null 2>&1 || git config user.name "DA Flow"
git config user.email >/dev/null 2>&1 || git config user.email "tpaczoski@users.noreply.github.com"

# data sesji z nazwy ZIP-a, jeśli się da
name="$(basename "$ZIP")"
session=""
if [[ "$name" =~ DA_Flow_all_([0-9]{4}-[0-9]{2}-[0-9]{2}) ]]; then
  session="${BASH_REMATCH[1]}"
fi
msg="dane DA Flow ${session:-$(date +%F)}"
git commit -m "$msg"

if [[ -z "${GITHUB_DAFLOW_TOKEN:-}" ]]; then
  echo "push_daily: brak GITHUB_DAFLOW_TOKEN – commit jest lokalny, nie wypchnięto" >&2
  exit 1
fi

ASK="$(mktemp)"
trap 'rm -rf "$TMP" "$ASK"' EXIT
cat > "$ASK" << 'EOF'
#!/bin/sh
case "$1" in
  *Username*) echo x-access-token ;;
  *) printf %s "$GITHUB_DAFLOW_TOKEN" ;;
esac
EOF
chmod 700 "$ASK"
export GIT_ASKPASS="$ASK" GIT_TERMINAL_PROMPT=0 GCM_INTERACTIVE=never
if ! git push "https://x-access-token@github.com/tpaczoski/da-flow.git" HEAD:main; then
  echo "push_daily: git push nie powiódł się" >&2
  exit 1
fi
echo "push_daily: wypchnięto ($msg)"
