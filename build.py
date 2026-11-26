"""DA Flow v1 – budowa strony: head.html + body.html + dane US500 (osadzone) + app.js → footprint_us500.html.
Pozostałe instrumenty (data/<INST>.json), kalendarz (data/makro.json), archiwum opcji (data/opt_hist.json) i okno opcji DN (opcje_dn.html)
są wczytywane obok strony – przy publikacji trzeba je dołączyć jako pliki."""
import os
h = open('head.html', encoding='utf-8').read(); bd = open('body.html', encoding='utf-8').read(); s = open('app.js', encoding='utf-8').read(); d = open('data/US500.json', encoding='utf-8').read()
dc = open('data/dclose.json', encoding='utf-8').read() if os.path.exists('data/dclose.json') else '{}'
cta = open('data/US500_cta.json', encoding='utf-8').read() if os.path.exists('data/US500_cta.json') else '{}'   # v1.7 zamknięcia dzienne do MA10/MA20 (tools/daily_closes.py)
page = h + bd + '<script id="data" type="application/json">' + d + '</script>\n<script id="dclose" type="application/json">' + dc + '</script>\n<script id="cta" type="application/json">' + cta + '</script>\n<script>\n' + s + '</script>\n'
open('footprint_us500.html', 'w', encoding='utf-8').write(page)
# v1.9 wersja publiczna: tryb Nauka zablokowany (przełącznik ukryty, warstwy laboratoryjne wyłączone)
open('footprint_nauka.html', 'w', encoding='utf-8').write(page.replace('<title>DA Flow v1</title>', '<title>DA Flow Nauka</title>', 1).replace('<script>\n' + s, "<script>window.DAF_LOCK='nauka';</script>\n<script>\n" + s, 1))
SRV = os.environ.get('DAF_PREVIEW', '/tmp/claude-0/-home-claude/81d71ab1-4ef8-511a-85f5-831c70716c72/scratchpad/fpsrv')   # lokalny podgląd (opcjonalnie)
if os.path.isdir(SRV): open(os.path.join(SRV, 'index.html'), 'w', encoding='utf-8').write('<!doctype html><html><head><meta charset="utf-8"></head><body>' + h + bd + '<script id="data" type="application/json">' + d + '</script>\n<script>\n' + s + '</script></body></html>')
print('ok')
