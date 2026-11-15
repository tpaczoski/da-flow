import sys, glob, json, numpy as np, pandas as pd
sys.path[:0] = ['/home/claude/intraday_v1/engine', '/home/claude/intraday_v1/engine/core', '/home/claude/intraday_v1/tools']
from fp5 import load_flex
import flex_m1
INST = sys.argv[1] if len(sys.argv) > 1 else 'US500'
BASE = {'US500': 1, 'US100': 2.5, 'US30': 2.5, 'RTY': 0.5, 'SPY': 0.25, 'GOLD': 0.5, 'DE40': 2.5, 'FR40': 1, 'EU50': 1, 'UK100': 2.5, 'J225': 10, 'HK50': 5, 'CN50': 10, 'VIX': 0.25}.get(INST, 1)
D = '/home/claude/intraday_v1/data/'; days = sorted(f.split('flex_')[1][:10] for f in glob.glob(D + f'footprint_5m/{INST}/flex_*.csv'))
# sesja kasowa (RTH) wg giełdy instrumentu: strefa, początek, koniec (minuty od północy czasu lokalnego)
RTHS = {'US500': ('America/New_York', 570, 960), 'US100': ('America/New_York', 570, 960), 'US30': ('America/New_York', 570, 960), 'RTY': ('America/New_York', 570, 960),
        'SPY': ('America/New_York', 570, 960), 'VIX': ('America/New_York', 570, 960), 'GOLD': ('America/New_York', 500, 810),
        'DE40': ('Europe/Berlin', 540, 1050), 'FR40': ('Europe/Paris', 540, 1050), 'EU50': ('Europe/Berlin', 540, 1050), 'UK100': ('Europe/London', 480, 990),
        'J225': ('Asia/Tokyo', 540, 930), 'HK50': ('Asia/Hong_Kong', 570, 960), 'CN50': ('Asia/Singapore', 540, 995)}
RTZ, R0, R1 = RTHS.get(INST, ('America/New_York', 570, 960))
def is_rth(ts_pl):
    t = pd.Timestamp(ts_pl).tz_localize('Europe/Warsaw').tz_convert(RTZ); m = t.hour * 60 + t.minute; return int(R0 <= m < R1)
PL, ET = 'Europe/Warsaw', 'America/New_York'
RAW = {}
for d in days:
    c, k = load_flex(D + f'footprint_5m/{INST}/flex_{d}.csv'); k = k.sort_values('t')
    real = [f for f in glob.glob(D + f'm1/{INST}/*{d}*.csv') if not f.endswith(('_flex.csv', '_h1.csv'))]
    m = pd.read_csv(real[0]) if real else flex_m1.build(INST, d); src = 'M1 DA' if real else 'flex (rekonstrukcja)'
    if 'approx' not in m: m['approx'] = 0
    m.index = pd.to_datetime(m.timestamp).dt.tz_localize('UTC').dt.tz_convert(PL).dt.tz_localize(None)
    if real:
        ok = ((m.index >= k.t.min() - pd.Timedelta(hours=1)) & (m.index <= k.t.max())).sum()
        if ok < 600:
            m = flex_m1.build(INST, d); src = 'flex (rekonstrukcja)'; m.index = pd.to_datetime(m.timestamp).dt.tz_localize('UTC').dt.tz_convert(PL).dt.tz_localize(None)
    for col in ('O', 'H', 'L', 'C', 'today_vah', 'today_poc', 'today_val'): m[col] = pd.to_numeric(m[col], errors='coerce')
    if 'approx' not in m: m['approx'] = 0
    RAW[d] = (c, k, m, src)
def etslot(ts, fl): return pd.Timestamp(ts).tz_localize(PL).tz_convert(ET).floor(fl).strftime('%H:%M')
SL5 = {d: pd.Series({etslot(t - pd.Timedelta(minutes=5), '5min'): v for t, v in zip(RAW[d][1].t, RAW[d][1].vol)}) for d in days}
SL60 = {}
for d in days:
    k = RAW[d][1]; s = pd.Series(k.vol.values, index=[etslot(t - pd.Timedelta(minutes=5), '60min') for t in k.t]); SL60[d] = s.groupby(level=0).sum()
def vix_series(d):
    import os
    if not os.path.exists(D + f'footprint_5m/VIX/flex_{d}.csv'): return None
    try: v = flex_m1.build('VIX', d)
    except Exception: return None
    v.index = pd.to_datetime(v.timestamp).dt.tz_localize('UTC').dt.tz_convert(PL).dt.tz_localize(None); v['C'] = pd.to_numeric(v.C, errors='coerce')
    if 'approx' not in v: v['approx'] = 0
    return v[['C', 'approx']].dropna().sort_index()
def vat(v, ts):
    q = v.loc[ts - pd.Timedelta(minutes=3):ts]
    return (round(float(q.C.iloc[-1]), 2), int(q.approx.iloc[-1])) if len(q) else (None, 0)
OUT = {}
for n_, d in enumerate(days):
    VX = vix_series(d)
    c, k, m, src = RAW[d]; prev = days[max(0, n_ - 5):n_]
    a5 = pd.concat([SL5[p] for p in prev], axis=1).mean(axis=1) if len(prev) >= 3 else None
    a60 = pd.concat([SL60[p] for p in prev], axis=1).mean(axis=1) if len(prev) >= 3 else None
    boxes = []; cells = []
    for t, vol in zip(k.t, k.vol):
        h = t - pd.Timedelta(minutes=5); mm = m[(m.index > h) & (m.index <= t)]
        if not len(mm): continue
        g = c[(c.t == t) & (c.p >= mm.L.min() - .5) & (c.p <= mm.H.max() + .5)]
        if not len(g): continue
        g = g.assign(b=np.floor(g.p / BASE + 1e-9) * BASE).groupby('b').agg(bid=('bid', 'sum'), ask=('ask', 'sum'))
        bi = len(boxes); r = mm.iloc[-1]
        x = float(vol / a5.get(etslot(h, '5min'))) if a5 is not None and etslot(h, '5min') in a5 and a5.get(etslot(h, '5min')) else None
        et = pd.Timestamp(h).tz_localize(PL).tz_convert(ET); mn = et.hour * 60 + et.minute
        boxes.append([h.strftime('%H:%M'), round(float(mm.O.iloc[0]), 2), round(float(mm.H.max()), 2), round(float(mm.L.min()), 2), round(float(mm.C.iloc[-1]), 2),
                      float(r.today_vah) if np.isfinite(r.today_vah) else None, float(r.today_poc) if np.isfinite(r.today_poc) else None, float(r.today_val) if np.isfinite(r.today_val) else None,
                      round(x, 2) if x else None, is_rth(h), int(mm.approx.max()), h.strftime('%H'), et.strftime('%H')]
                     + ([*vat(VX, h)[:1], *vat(VX, t)] if VX is not None else [None, None, 0]))
        for b, rr in g.iterrows(): cells.append([bi, (int(b) if float(b).is_integer() else float(b)), int(rr.bid), int(rr.ask)])
    hx = {}
    if a60 is not None:
        for hh, v in SL60[d].items():
            if hh in a60 and a60[hh]: hx[hh] = round(float(v / a60[hh]), 2)
    vo = next((b[14] for b in boxes if b[9] and b[14] is not None), None)
    m1 = None
    if src == 'M1 DA' and INST in ('US500', 'GOLD'):
        starts = [pd.Timestamp(datetime_) for datetime_ in [pd.Timestamp(f'{d} 00:00')]]
        bstart = [k.t.iloc[j] - pd.Timedelta(minutes=5) for j in range(len(k))]
        t0, t1 = k.t.min() - pd.Timedelta(minutes=5), k.t.max()
        mm = m[(m.index > t0) & (m.index <= t1)].copy(); mm['acc'] = pd.to_numeric(mm.acc_daily, errors='coerce')
        bl = [h.strftime('%Y-%m-%d %H:%M') for h in (k.t - pd.Timedelta(minutes=5))]
        bt = list(k.t - pd.Timedelta(minutes=5)); m1 = []; j = 0
        # indeks świecy M5 (w tablicy boxes) zawierającej minutę – po czasie
        bmap = {b[0]: n for n, b in enumerate(boxes)}
        bstarts = sorted([(pd.Timestamp(f"{d} {b[0]}") if b[0] <= '23:59' else None, n) for n, b in enumerate(boxes)], key=lambda z: z[1])
        for ts, r in mm.iterrows():
            st = ts - pd.Timedelta(minutes=1)
            while j + 1 < len(bt) and bt[j + 1] <= st: j += 1
            bi = bmap.get(bt[j].strftime('%H:%M'), None)
            et = pd.Timestamp(st).tz_localize(PL).tz_convert(ET); mn = et.hour * 60 + et.minute
            vx = vat(VX, ts) if VX is not None else (None, 0)
            m1.append([st.strftime('%H:%M'), r.O, r.H, r.L, r.C, None if pd.isna(r.acc) else int(r.acc), r.today_vah if np.isfinite(r.today_vah) else None, r.today_poc if np.isfinite(r.today_poc) else None,
                       r.today_val if np.isfinite(r.today_val) else None, is_rth(st), bi, vx[0]])
    OUT[d] = dict(src=src, boxes=boxes, cells=cells, h1x=hx, vix_open=vo, vix=VX is not None, m1=m1)
    print(d, src, len(boxes), len(cells), flush=True)
try:
    RZ = pd.read_csv('/home/claude/intraday_v1/data/rdzen/rdzen_dziennik.csv')
    for _, r in RZ.iterrows():
        dd = str(r.sesja)
        if dd in OUT:
            g = lambda k: (None if pd.isna(r.get(k)) else round(float(r.get(k)), 1))
            OUT[dd]['opt'] = dict(snap=str(r.snap_t), em=g('em'), F=g('F_us'), emH=g('EM_gora_us'), emL=g('EM_dol_us'), cw=g('call_wall_us'), pw=g('put_wall_us'), flip=g('flip_us'), gmin=g('gex_min_at_us'), gex=g('gex'), baza=g('baza'))
except Exception as e: print('rdzen:', e)
import os; os.makedirs('/home/claude/fpweb/data', exist_ok=True)
json.dump(OUT, open(f'/home/claude/fpweb/data/{INST}.json', 'w'), separators=(',', ':'))
# po eksporcie US500: python3 tools/em_merge.py (pole em – okno opcji)
