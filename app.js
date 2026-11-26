// DA Flow v1 (08.11.2026) – logika strony; budowa: python3 build.py → footprint_us500.html
let DATA = JSON.parse(document.getElementById('data').textContent);
// instrumenty DA Flow: krok bazowy (dokładnie reprezentowalny w liczbach binarnych) i miejsca po przecinku
const INSTS = {US500: [1, 1], US100: [2.5, 1], US30: [2.5, 0], RTY: [0.5, 1], SPY: [0.25, 2], GOLD: [0.5, 1], DE40: [2.5, 1], FR40: [1, 1], EU50: [1, 0], UK100: [2.5, 1], J225: [10, 0], HK50: [5, 0], CN50: [10, 0], VIX: [0.25, 2], EURUSD: [0.0001, 5], DXY: [0.01, 3], GBPUSD: [0.0001, 5], USDJPY: [0.01, 3], USDCHF: [0.0001, 5], USDCAD: [0.0001, 5], AUDUSD: [0.0001, 5], NZDUSD: [0.0001, 5], EURGBP: [0.0001, 5], EURCHF: [0.0001, 5], GBPJPY: [0.01, 3], AUDJPY: [0.01, 3], AUDCAD: [0.0001, 5], GBPCAD: [0.0001, 5], NZDJPY: [0.01, 3], EURPLN: [0.0005, 4], USDPLN: [0.0005, 4], USDHKD: [0.0001, 4], OIL_CRUDE: [0.05, 3], SILVER: [0.05, 3], NATURALGAS: [0.001, 4], COPPER: [0.001, 4], BTCUSD: [25, 2], ETHUSD: [1.25, 2], QQQ: [0.25, 2]};
/* FX (paczka 13.11) */ const Q = v => Math.round(v * 1e9) / 1e9, PXF = v => (+v).toFixed(Math.max(1, DEC));
let INST = 'US500', TK = 1, DEC = 1;
const CACHE = {US500: DATA};
let MAKRO = null, MAKRO_ST = 0;   // kalendarz makro (data/makro.json), wczytywany przy pierwszym użyciu
const mkLoad = () => { if (MAKRO_ST) return; MAKRO_ST = 1; fetch('data/makro.json').then(r => r.json()).then(j => { MAKRO = j; render(true); }).catch(() => { MAKRO = {ev: [], err: 1}; render(true); }); };
let OPH = null, OPH_ST = 0; const ohLoad = () => { if (OPH_ST) return; OPH_ST = 1; fetch('data/opt_hist.json').then(r => r.json()).then(j => { OPH = j; render(true); }).catch(() => { OPH = {s: []}; render(true); }); };
const LOADING = {};   // inne rynki do okna zgodności
const needInst = n => { if (CACHE[n] || LOADING[n]) return; LOADING[n] = 1; fetch(`data/${n}.json`).then(r => r.json()).then(j => { CACHE[n] = j; render(true); }).catch(() => { CACHE[n] = {}; render(true); }); };
const mmS = t => { const [h, m] = t.split(':').map(Number); return (h * 60 + m - 23 * 60 + 1440) % 1440; };   // minuty od początku sesji DA (ok. 23:00)
// motyw: System / Jasny / Ciemny (atrybut data-theme na <html>)
(function () {
  let th = 'system'; try { th = localStorage.getItem('fp-us500-theme') || 'system'; } catch (e) {}
  const apply = v => { if (v === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', v);
    document.querySelectorAll('#theme button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v))); };
  apply(th);
  document.querySelectorAll('#theme button').forEach(b => b.onclick = () => { try { localStorage.setItem('fp-us500-theme', b.dataset.v); } catch (e) {} apply(b.dataset.v); });
})();
const $ = id => document.getElementById(id);
const S = {day: null, tf: 'M5', rng: 'rth', bin: 1, va: true, z: true, nodes: true, div: true, cz: true, dp: false, ua: true, tv: false, vw: 'rth', vwA: null, ref: true, naked: true, opt: true, atr: true, st: false, ea: true, rp: false, rpN: 12, sel: null, cell: {ba: true, v: true, d: true}, pf: {pre: false, rth: false, day: true}};
let FIRST_VISIT = true;
try { const raw = localStorage.getItem('fp-us500'); if (raw) FIRST_VISIT = false; const s = JSON.parse(raw || '{}'); Object.assign(S, s); } catch (e) {}
if (/(?:^|[?&])hvn=1(?:&|$)/.test(location.search)) S.hvw = true;
var HVN = null, HVN_ST = 0;
if (!S.pf || typeof S.pf !== 'object') S.pf = {pre: false, rth: false, day: true};
if (!S.cell || typeof S.cell !== 'object') S.cell = {ba: true, v: true, d: true};
for (const k of ['ba', 'v', 'd']) $('cell_' + k).onchange = e => { S.cell[k] = e.target.checked; save(); render(true); };
const _tfv = S.tf;
seg('vwm', 'vw');
$('showREF').onchange = e => { S.ref = e.target.checked; save(); render(true); };
$('showNK').onchange = e => { S.naked = e.target.checked; save(); render(true); };
$('showOPT').onchange = e => { S.opt = e.target.checked; save(); render(true); };
$('showATR').onchange = e => { S.atr = e.target.checked; save(); render(true); };
$('showST').onchange = e => { S.st = e.target.checked; save(); render(true); };
$('showSUM').onchange = e => { S.sumOn = e.target.checked; save(); $('sum').hidden = !S.sumOn; };
$('showLEG').onchange = e => { S.legOn = e.target.checked; save(); $('legBox').hidden = !S.legOn; };
$('ctrlBox').addEventListener('toggle', () => { S.ctrlOpen = $('ctrlBox').open; save(); });
if (S.ctrlOpen === false) $('ctrlBox').open = false;
$('showEA').onchange = e => { S.ea = e.target.checked; save(); render(true); };
$('showUT').onchange = e => { S.trap = e.target.checked; save(); render(true); };
$('showZF').onchange = e => { S.zf = e.target.checked; save(); render(true); };
$('showOB').onchange = e => { S.ob = e.target.checked; save(); render(true); };
document.querySelectorAll('#mode button').forEach(b => b.onclick = () => { if (window.DAF_LOCK) return; const v = b.dataset.v; if (v === S.mode) return;
  if (v === 'nauka') { S.labSave = Object.fromEntries(LABK.map(k => [k, S[k]])); } else if (S.labSave) { Object.assign(S, S.labSave); }
  S.mode = v; save(); render(true); });
$('showVP').onchange = e => { S.vp = e.target.checked; save(); render(true); };
$('showHR').onchange = e => { S.hr = e.target.checked; save(); render(true); };
$('showFVG').onchange = e => { S.fvg = e.target.checked; save(); render(true); };
$('showEW').onchange = e => { S.ew = e.target.checked; save(); render(true); };
$('pfTree').onchange = e => { S.tree = e.target.checked; save(); render(true); };
$('showVAW').onchange = e => { S.vaw = e.target.checked; save(); render(true); };
$('vaWinX').onclick = () => { S.vaw = false; save(); render(true); };
$('showDLW').onchange = e => { S.dlw = e.target.checked; save(); render(true); };
$('showPSW').onchange = e => { S.psw = e.target.checked; save(); render(true); };
$('psWinX').onclick = () => { S.psw = false; save(); render(true); };
$('dlWinX').onclick = () => { S.dlw = false; save(); render(true); };
$('showKRW').onchange = e => { S.krw = e.target.checked; save(); render(true); };
$('krWinX').onclick = () => { S.krw = false; save(); render(true); };
$('showHVW').onchange = e => { S.hvw = e.target.checked; save(); render(true); };
$('hvWinX').onclick = () => { S.hvw = false; save(); render(true); };
$('showLNW').onchange = e => { S.lnw = e.target.checked; save(); render(true); };
$('lnWinX').onclick = () => { S.lnw = false; save(); render(true); };
$('showMKW').onchange = e => { S.mkw = e.target.checked; save(); render(true); };
$('mkWinX').onclick = () => { S.mkw = false; save(); render(true); };
$('showZGW').onchange = e => { S.zgw = e.target.checked; save(); render(true); };
$('zgWinX').onclick = () => { S.zgw = false; save(); render(true); };
$('showOPW').onchange = e => { S.opw = e.target.checked; save(); render(true); };
$('opWinX').onclick = () => { S.opw = false; save(); render(true); };
$('showOMW').onchange = e => { S.omw = e.target.checked; save(); render(true); };
$('omWinX').onclick = () => { S.omw = false; save(); render(true); };
$('showEVW').onchange = e => { S.evw = e.target.checked; save(); render(true); };
$('evWinX').onclick = () => { S.evw = false; save(); render(true); };
$('showINW').onchange = e => { S.inw = e.target.checked; save(); render(true); };
$('inWinX').onclick = () => { S.inw = false; save(); render(true); };
$('showMTW').onchange = e => { S.mtw = e.target.checked; save(); render(true); };
$('mtWinX').onclick = () => { S.mtw = false; save(); render(true); };
$('showDJW').onchange = e => { S.djw = e.target.checked; save(); render(true); };
$('djWinX').onclick = () => { S.djw = false; save(); render(true); };
const dragWin = (wid, hid, xid, key) => { // przeciąganie pływających okien (status VA, delta 10 dni)
  const w = $(wid), h = $(hid); let d = null;
  const place = () => { if (S[key]) { const x = Math.min(Math.max(0, S[key].x), innerWidth - 120), y_ = Math.min(Math.max(0, S[key].y), innerHeight - 40); w.style.left = x + 'px'; w.style.top = y_ + 'px'; w.style.right = 'auto'; } };
  place(); addEventListener('resize', place);
  w.addEventListener('pointerdown', () => { w.style.zIndex = ++dragWin.z; }, true);   // kliknięte okno na wierzch
  h.addEventListener('pointerdown', e => { if (e.target.id === xid) return; const r = w.getBoundingClientRect(); d = {dx: e.clientX - r.left, dy: e.clientY - r.top}; h.setPointerCapture(e.pointerId); });
  h.addEventListener('pointermove', e => { if (!d) return; S[key] = {x: e.clientX - d.dx, y: e.clientY - d.dy}; place(); });
  h.addEventListener('pointerup', () => { if (d) { d = null; save(); } });
};
dragWin.z = 30; dragWin('vaWin', 'vaWinH', 'vaWinX', 'vawPos'); dragWin('dlWin', 'dlWinH', 'dlWinX', 'dlwPos'); dragWin('psWin', 'psWinH', 'psWinX', 'pswPos'); dragWin('cdWin', 'cdWinH', 'cdWinX', 'cdwPos'); dragWin('inWin', 'inWinH', 'inWinX', 'inwPos'); dragWin('evWin', 'evWinH', 'evWinX', 'evwPos'); dragWin('mkWin', 'mkWinH', 'mkWinX', 'mkwPos'); dragWin('opWin', 'opWinH', 'opWinX', 'opwPos'); dragWin('omWin', 'omWinH', 'omWinX', 'omwPos'); dragWin('zgWin', 'zgWinH', 'zgWinX', 'zgwPos'); dragWin('mtWin', 'mtWinH', 'mtWinX', 'mtwPos'); dragWin('djWin', 'djWinH', 'djWinX', 'djwPos'); dragWin('lnWin', 'lnWinH', 'lnWinX', 'lnwPos'); dragWin('krWin', 'krWinH', 'krWinX', 'krwPos'); dragWin('hvWin', 'hvWinH', 'hvWinX', 'hvwPos');
$('pfTreeV').onchange = e => { S.treeV = e.target.checked; save(); render(true); };
// odtwarzanie (replay)
let RPN_MAX = 0, RP_T = null;
const rpSet = n => { S.rpN = Math.max(1, Math.min(n, RPN_MAX || n)); save(); render(true); const w = $('wrap'); w.scrollLeft = Math.max(0, S.rpN * LAST.CW - w.clientWidth + 400); };
$('rpOn').onclick = () => { S.rp = !S.rp; if (S.rp) S.rpN = 6; clearInterval(RP_T); RP_T = null; save(); render(); };
$('rpFirst').onclick = () => rpSet(1); $('rpPrev').onclick = () => rpSet(S.rpN - 1); $('rpNext').onclick = () => rpSet(S.rpN + 1); $('rpLast').onclick = () => rpSet(RPN_MAX);
$('rpPlay').onclick = () => { if (RP_T) { clearInterval(RP_T); RP_T = null; $('rpPlay').textContent = '▶ odtwarzaj'; return; }
  $('rpPlay').textContent = '⏸ pauza'; RP_T = setInterval(() => { if (S.rpN >= RPN_MAX) { clearInterval(RP_T); RP_T = null; $('rpPlay').textContent = '▶ odtwarzaj'; return; } rpSet(S.rpN + 1); }, Number($('rpSpeed').value)); };
addEventListener('keydown', e => { if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
  if (S.rp && e.key === 'ArrowRight') { rpSet(S.rpN + 1); e.preventDefault(); } if (S.rp && e.key === 'ArrowLeft') { rpSet(S.rpN - 1); e.preventDefault(); }
  if (e.key === 'Escape' && S.sel) { S.sel = null; save(); render(true); } });
let LAST = {cols: [], CW: 1}, LASTP = [], XHN = 0;   // LASTP: profile po prawej (offset, dane poziomów) – dla celownika na profilach
// krzyż kursora, pomiar i zaznaczenie (Shift + przeciągnij)
let DRAG = null;
const xy = e => { const r = $('fp').getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
const pAt = yy => LAST.hi - (yy - LAST.HEAD) / LAST.RH * LAST.bin;
function cross(e) {
  const [x, yy] = xy(e), L = LAST, i = Math.max(0, Math.min(Math.floor(x / L.CW), L.cols.length - 1)), c = L.cols[i], p = pAt(yy), ink = css('--ink'), pan = css('--panel'), va = css('--vwap');
  if (!c || yy < L.HEAD || yy > L.HEAD + L.H) { clearCross(); return; }
  let g = `<rect x="${i * L.CW}" y="${L.HEAD}" width="${L.CW}" height="${L.H}" fill="${ink}" opacity=".05"/><line x1="0" x2="${L.W}" y1="${yy}" y2="${yy}" stroke="${ink}" stroke-width=".8" stroke-dasharray="3 3"/><line x1="${x}" x2="${x}" y1="${L.HEAD}" y2="${L.HEAD + L.H}" stroke="${ink}" stroke-width=".6" stroke-dasharray="3 3"/>`;
  if (DRAG) { const x0 = Math.min(DRAG.x, x), y0 = Math.min(DRAG.y, yy), i0 = Math.min(DRAG.i, i), i1 = Math.max(DRAG.i, i), dp = p - DRAG.p, cs = L.cols.slice(i0, i1 + 1);
    const sd = cs.reduce((a, q) => a + q.d, 0), sv = cs.reduce((a, q) => a + q.v, 0);
    g += `<rect x="${i0 * L.CW}" y="${y0}" width="${(i1 - i0 + 1) * L.CW}" height="${Math.abs(yy - DRAG.y)}" fill="${va}" opacity=".10" stroke="${va}" stroke-width="1.2"/>`;
    g += `<g><rect x="${x + 10}" y="${yy + 8}" width="200" height="46" rx="4" fill="${pan}" stroke="${va}"/><text x="${x + 18}" y="${yy + 24}" font-size="10.5" font-weight="700" fill="${dp >= 0 ? css('--buy') : css('--sell')}">${dp >= 0 ? '+' : ''}${PXF(dp)} pkt · ${i1 - i0 + 1} świec</text><text x="${x + 18}" y="${yy + 40}" font-size="10" fill="${ink}">Δ ${sd > 0 ? '+' : ''}${sd} · wol ${sv} · puść, by dodać profil</text></g>`; }
  $('xh').innerHTML = g;
  $('xha').innerHTML = `<rect x="2" y="${yy - 8}" width="60" height="16" rx="3" fill="${va}"/><text x="32" y="${yy + 3.5}" text-anchor="middle" font-size="10" font-weight="700" fill="${pan}">${PXF(p)}</text>`;
  $('xhf').innerHTML = `<rect x="${i * L.CW + 2}" y="1" width="${L.CW - 4}" height="18" rx="3" fill="${va}" opacity=".9"/><text x="${i * L.CW + L.CW / 2}" y="14" text-anchor="middle" font-size="10.5" font-weight="700" fill="${pan}">${c.t}${c.t2 && c.t2 !== c.t ? '–' + c.t2 : ''}</text>`;
}
function clearCross() { for (const id of ['xh', 'xha', 'xhf', 'xhp']) { const g = document.getElementById(id); if (g) g.innerHTML = ''; } }
$('fp').addEventListener('mousemove', cross);
// v1.3 celownik na profilach po prawej (sesja kasowa, cała doba, D-1, ostatnie N min…): poziom ceny pod kursorem, linia także na wykresie i oś,
// a w profilu pod kursorem – wolumen, delta, bid × ask poziomu i położenie względem VA / POC tego profilu
function crossP(e) {
  const r = $('prof').getBoundingClientRect(), x = e.clientX - r.left, yy = e.clientY - r.top, L = LAST, ink = css('--ink'), pan = css('--panel'), va = css('--vwap');
  if (!L.cols.length || yy < L.HEAD || yy > L.HEAD + L.H) { clearCross(); return; }
  const p = pAt(yy), tw = Number($('prof').getAttribute('width') || 0), seg = LASTP.find(q => x >= q.off && x < q.off + 300);
  $('xh').innerHTML = `<line x1="0" x2="${L.W}" y1="${yy}" y2="${yy}" stroke="${ink}" stroke-width=".8" stroke-dasharray="3 3"/>`;
  $('xha').innerHTML = `<rect x="2" y="${yy - 8}" width="60" height="16" rx="3" fill="${va}"/><text x="32" y="${yy + 3.5}" text-anchor="middle" font-size="10" font-weight="700" fill="${pan}">${PXF(p)}</text>`;
  let g = `<line x1="0" x2="${tw}" y1="${yy}" y2="${yy}" stroke="${ink}" stroke-width=".8" stroke-dasharray="3 3"/>`;
  if (seg) { const b = L.bin, k = Q(Math.floor(p / b + 1e-9) * b), z = seg.prof.get(k) || {v: 0, d: 0, bid: 0, ask: 0}, f1 = v => (+v).toFixed(DEC).replace('.', ',');
    const pos = k >= seg.vah ? 'nad VA' : k < seg.val ? 'pod VA' : k === seg.poc ? 'POC' : 'w VA', dP = p - (seg.poc + b / 2);
    const l1 = `${f1(p)} · poziom ${f1(k)}${b > TK ? '–' + f1(k + b) : ''}`, l2 = `wol ${fmt(z.v)} (${seg.pmax ? Math.round(z.v / seg.pmax * 100) : 0}% POC) · Δ ${fmt(z.d, 1)}`, l3 = `bid × ask ${fmt(z.bid)} × ${fmt(z.ask)}`, l4 = `${pos} · od POC ${dP >= 0 ? '+' : ''}${PXF(dP).replace('.', ',')} pkt`;
    const bw = 210, bx = Math.min(seg.off + 6, tw - bw - 4), by = yy + 72 > L.HEAD + L.H ? yy - 70 : yy + 8;
    g += `<rect x="${seg.off}" y="${yy - L.RH / 2}" width="300" height="${L.RH}" fill="${va}" opacity=".10"/>`
      + `<rect x="${bx}" y="${by}" width="${bw}" height="62" rx="4" fill="${pan}" stroke="${va}"/>`
      + `<text x="${bx + 8}" y="${by + 14}" font-size="10" fill="${css('--mut')}">${seg.title}</text>`
      + `<text x="${bx + 8}" y="${by + 28}" font-size="11" font-weight="700" fill="${ink}">${l1}</text>`
      + `<text x="${bx + 8}" y="${by + 42}" font-size="10" fill="${z.d > 0 ? css('--buy') : z.d < 0 ? css('--sell') : ink}">${l2}</text>`
      + `<text x="${bx + 8}" y="${by + 56}" font-size="10" fill="${ink}">${l3} · ${l4}</text>`; }
  $('xhp').innerHTML = g;
}
$('prof').addEventListener('mousemove', crossP);
$('prof').addEventListener('mouseleave', clearCross);
$('fp').addEventListener('mousemove', () => { const g = document.getElementById('xhp'); if (g) g.innerHTML = ''; });

$('fp').addEventListener('mouseleave', () => { if (!DRAG) clearCross(); });
$('fp').addEventListener('mousedown', e => { if (!e.shiftKey || S.tf === 'M1') return; const [x, yy] = xy(e); DRAG = {x, y: yy, i: Math.floor(x / LAST.CW), p: pAt(yy)}; e.preventDefault(); });
addEventListener('mouseup', e => { if (!DRAG) return; const [x] = xy(e), L = LAST, i = Math.max(0, Math.min(Math.floor(x / L.CW), L.cols.length - 1)), i0 = Math.min(DRAG.i, i), i1 = Math.max(DRAG.i, i); DRAG = null;
  const c0 = L.cols[i0], c1 = L.cols[i1]; if (!c0 || !c1) return; S.sel = {day: S.day, a: c0.parts ? c0.parts[0].idx : (c0.idx ?? c0.last), b: c1.last}; save(); render(true); });
document.addEventListener('click', e => { if (e.target && e.target.id === 'selClr') { S.sel = null; save(); render(true); } });
$('fp').addEventListener('click', e => { if (S.vw === 'anchor' || e.shiftKey || S.tf === 'M1') return; const r = $('fp').getBoundingClientRect(), i = Math.floor((e.clientX - r.left) / LAST.CW), c = LAST.cols[i]; if (!c) return;
  S.cd = (S.cd && S.cd.day === S.day && S.cd.tf === S.tf && S.cd.t === c.t) ? null : {day: S.day, tf: S.tf, t: c.t}; save(); render(true); });
$('cdWinX').onclick = () => { S.cd = null; save(); render(true); };
$('fp').addEventListener('click', e => { if (S.vw !== 'anchor' || e.shiftKey) return; const r = $('fp').getBoundingClientRect(), i = Math.floor((e.clientX - r.left) / LAST.CW), c = LAST.cols[i]; if (!c) return;
  S.vwA = {day: S.day, idx: c.parts ? c.parts[0].idx : (c.idx ?? c.last)}; save(); render(true); });
const PFK = ['c5', 'd1', 'd1r', 'pre', 'rth', 'day', 'p60', 'p90', 'p120', 'p180', 'p240', 'l60', 'l90', 'l120', 'l180', 'l240'];   // l* = kroczące VA z ostatnich N min (linie na wykresie)
const days = Object.keys(DATA).sort();
if (!S.day || !DATA[S.day]) S.day = days[days.length - 1];
function fillDays() { const ds = Object.keys(DATA).sort(); if (!DATA[S.day]) S.day = ds[ds.length - 1]; $('day').innerHTML = ds.map(d => `<option value="${d}">${d.slice(8)}.${d.slice(5, 7)}.${d.slice(0, 4)}</option>`).join(''); $('day').value = S.day; }
function binLabels() { $('bin').querySelectorAll('button').forEach(b => { if (b.dataset.v !== 'auto') { const v = Number(b.dataset.v) * TK; b.textContent = (+v.toFixed(DEC + 1)) + (b.dataset.v === '1' ? ' pkt' : ''); } }); }
async function setInst(name) {
  INST = name; [TK, DEC] = INSTS[name] || [1, 1]; $('inst').value = name;
  if (!CACHE[name]) { $('sum').textContent = `Wczytywanie ${name}…`; try { const r = await fetch(`data/${name}.json`); CACHE[name] = await r.json(); } catch (e) { $('sum').textContent = `Nie udało się wczytać danych ${name}.`; return; } }
  DATA = CACHE[name]; fillDays(); binLabels(); save(); render();
}
$('inst').onchange = e => { S.inst = e.target.value; S.sel = null; S.vwA = null; setInst(S.inst); };
$('day').innerHTML = days.map(d => `<option value="${d}">${d.slice(8)}.${d.slice(5, 7)}.${d.slice(0, 4)}</option>`).join('');
// gotowe zestawy ustawień; każda ręczna zmiana przełącznika = „Własne”
const PRESETS = {
  clean: {label: 'świece, imbalanse, VA, profil doby', set: {z: true, cz: false, ua: false, ea: false, trap: false, zf: false, ew: false, div: false, nodes: false, tv: false, va: true, vw: 'off', ref: false, naked: false, opt: false, atr: false, dp: false, st: false, tree: false, sumOn: false, legOn: false, cell: {ba: true, v: true, d: true}, pf: {day: true}}},
  intra: {label: '+ VWAP, poziomy, opcje, ATR, HVN/LVN, DVMZ, aukcje, panel delty', set: {z: true, cz: true, ua: true, ea: false, trap: true, zf: false, ew: true, div: false, nodes: true, tv: false, va: true, vw: 'rth', ref: true, naked: true, opt: true, atr: true, dp: true, st: false, tree: false, sumOn: true, legOn: true, cell: {ba: true, v: true, d: true}, pf: {day: true, rth: true}}},
  full: {label: 'wszystko: także dywergencje, W/A, TPO, statystyki świec, profile D-1 i 5 sesji, VA kroczące 60', set: {z: true, cz: true, ua: true, ea: true, trap: true, zf: true, ew: true, div: true, nodes: true, tv: true, va: true, vw: 'rth', ref: true, naked: true, opt: true, atr: true, dp: true, st: true, tree: false, sumOn: true, legOn: true, cell: {ba: true, v: true, d: true}, pf: {day: true, rth: true, pre: true, d1: true, c5: true, l60: true}}}};
let APPLYING = false;
if (FIRST_VISIT) { const st = JSON.parse(JSON.stringify(PRESETS.intra.set)); const pf = {}; for (const k of PFK) pf[k] = !!st.pf[k]; delete st.pf; Object.assign(S, st, {pf, preset: 'intra'}); }
function markPreset() { const p = S.preset || 'custom'; document.querySelectorAll('#preset button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.p === p))); const el = document.getElementById('presetInfo'); if (el) el.textContent = PRESETS[p] ? PRESETS[p].label : 'ustawienia zmienione ręcznie'; }
function applyPreset(p) { const P = PRESETS[p]; if (!P) return; APPLYING = true; const st = JSON.parse(JSON.stringify(P.set)); const pf = {}; for (const k of PFK) pf[k] = !!(st.pf && st.pf[k]); delete st.pf; Object.assign(S, st, {pf, preset: p}); save(); render(true); markPreset(); APPLYING = false; }
document.querySelectorAll('#preset button[data-p]').forEach(b => b.onclick = () => { if (b.dataset.p !== 'custom') applyPreset(b.dataset.p); });
document.getElementById('ctrlBox').addEventListener('change', e => { if (!APPLYING && e.target.type === 'checkbox') { S.preset = 'custom'; markPreset(); } }, true);
document.getElementById('ctrlBox').addEventListener('click', e => { if (!APPLYING && e.target.closest('#vwm button')) { S.preset = 'custom'; markPreset(); } }, true);
function save() { try { localStorage.setItem('fp-us500', JSON.stringify(S)); } catch (e) {} }
function seg(id, key, conv) {
  const el = $(id);
  el.querySelectorAll('button').forEach(b => b.onclick = () => { S[key] = conv ? conv(b.dataset.v) : b.dataset.v; save(); render(); });
}
seg('tf', 'tf'); seg('rng', 'rng'); seg('bin', 'bin', v => v === 'auto' ? 'auto' : Number(v));
let BIN = 1;
function atr5(day) {                 // średni true range sesji kasowej z 5 poprzednich sesji w danych
  const ds = Object.keys(DATA).sort(), j = ds.indexOf(day);
  const hl = dk => { const P = DATA[dk], b = P.boxes.filter(x => x[9]); if (!b.length) return null; const m1 = (P.m1 || []).filter(r => r[9]); return {H: Math.max(...b.map(x => x[2])), L: Math.min(...b.map(x => x[3])), C: m1.length ? m1[m1.length - 1][4] : b[b.length - 1][4]}; };
  const trs = []; for (let q = Math.max(1, j - 5); q < j; q++) { const a = hl(ds[q]), p = hl(ds[q - 1]); if (a) trs.push(p ? Math.max(a.H - a.L, Math.abs(a.H - p.C), Math.abs(a.L - p.C)) : a.H - a.L); }
  return trs.length >= 3 ? {atr: trs.reduce((a, b) => a + b, 0) / trs.length, n: trs.length} : null;
}
function extraLevels(rthOnly) {        // EM i ATR bieżącego dnia – żeby zmieściły się na wykresie i profilu
  const D = DATA[S.day], out = [];
  if (S.opt && D.opt) for (const v of [D.opt.emH, D.opt.emL]) if (v != null) out.push(v);
  if (S.atr) { const a = atr5(S.day), b = D.boxes.filter(x => x[9]); if (a && b.length) { const hh = Math.max(...b.map(x => x[2])), ll = Math.min(...b.map(x => x[3])); out.push(ll + a.atr, hh - a.atr); } }
  return out;
}
function autoBin() {                  // najmniejszy „okrągły” krok, przy którym cały zakres dnia (i D-1, gdy włączony) mieści się w oknie wykresu
  const D = DATA[S.day]; let lo = Math.min(...D.boxes.map(b => b[3]), ...extraLevels()), hi = Math.max(...D.boxes.map(b => b[2]), ...extraLevels());
  if (S.pf.d1 || S.pf.d1r) { const ds = Object.keys(DATA).sort(), j = ds.indexOf(S.day); if (j > 0) for (const b of DATA[ds[j - 1]].boxes) if (S.pf.d1 || b[9]) { lo = Math.min(lo, b[3]); hi = Math.max(hi, b[2]); } }
  const avail = Math.max(200, $('wrap').clientHeight - 50 - 8 - 62 - 34);
  for (const m of [1, 2, 3, 4, 5, 10, 15, 20, 25, 50, 100]) { const b = m * TK; if ((hi - lo) / b * 15 + 2 * 15 <= avail) return b; }
  return 100 * TK;
}
$('day').onchange = e => { S.day = e.target.value; save(); render(); };
$('showVA').onchange = e => { S.va = e.target.checked; save(); render(true); };
$('showZ').onchange = e => { S.z = e.target.checked; save(); render(true); };
$('zDim').onchange = e => { S.zDim = e.target.checked; save(); render(true); };
$('showN').onchange = e => { S.nodes = e.target.checked; save(); render(true); };
$('showD').onchange = e => { S.div = e.target.checked; save(); render(true); };
$('showCZ').onchange = e => { S.cz = e.target.checked; save(); render(true); };
$('showDP').onchange = e => { S.dp = e.target.checked; save(); render(true); };
$('showVX').onchange = e => { S.vx = e.target.checked; save(); render(true); };
$('vxInv').onchange = e => { S.vxInv = e.target.checked; save(); render(true); };
$('showUA').onchange = e => { S.ua = e.target.checked; save(); render(true); };
$('showTV').onchange = e => { S.tv = e.target.checked; save(); render(true); };
for (const k of PFK) $('pf_' + k).onchange = e => { S.pf[k] = e.target.checked; save(); render(true); };
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const fmt = (v, sgn) => (sgn && v > 0 ? '+' : '') + Math.round(v).toLocaleString('pl-PL').replace(/ /g, ' ');

function columns(day = S.day, tf = S.tf, rng = S.rng) {
  const D = DATA[day], B = D.boxes, bin = BIN;
  if (tf === 'M1') {
    if (!D.m1 || !D.m1.length) return [];
    let pv = null;
    const cs = D.m1.map(r => { const c = {t: r[0], O: r[1], H: r[2], L: r[3], C: r[4], acc: r[5], d: 0, v: 0, vmax: 0, pocK: null, vah: r[6], poc: r[7], val: r[8], rth: r[9], last: r[10] ?? 0, vs: pv, ve: r[11], vap: 0, ap: 0, x: null, lv: new Map(), steps: [[r[6], r[7], r[8]]], m1: true}; if (r[11] != null) pv = r[11]; return c; });
    return rng === 'rth' ? cs.filter(c => c.rth) : cs;
  }
  const lv = B.map(() => new Map());
  for (const [i, p, bid, ask] of D.cells) {
    const k = Q(Math.floor(p / bin + 1e-9) * bin), m = lv[i], c = m.get(k) || {bid: 0, ask: 0};
    c.bid += bid; c.ask += ask; m.set(k, c);
  }
  const box = B.map((b, i) => ({t: b[0], O: b[1], H: b[2], L: b[3], C: b[4], vah: b[5], poc: b[6], val: b[7], x: b[8], rth: b[9], ap: b[10], hpl: b[11], het: b[12], vs: b[13], ve: b[14], vap: b[15], lv: lv[i], steps: [[b[5], b[6], b[7]]], idx: i, last: i}));
  if (tf[0] === 'V') {                 // świece wolumenowe: kolejne boksy M5 sklejane, aż suma wolumenu ≥ N (zamknięcie na końcu boksu M5)
    const N = Number(tf.slice(1)), src = rng === 'rth' ? box.filter(b => b.rth) : box, out = []; let cur = null, cv = 0;
    for (const b of src) {
      let bv = 0; for (const z of b.lv.values()) bv += z.bid + z.ask;
      if (!cur) { cur = {t: b.t, t2: b.t, O: b.O, H: b.H, L: b.L, C: b.C, hpl: b.hpl, het: b.het, vs: b.vs, ve: b.ve, vap: 0, rth: b.rth, ap: 0, lv: new Map(), steps: [], parts: [], x: null, last: b.idx}; cv = 0; out.push(cur); }
      cur.H = Math.max(cur.H, b.H); cur.L = Math.min(cur.L, b.L); cur.C = b.C; cur.t2 = b.t; cur.rth |= b.rth; cur.ap |= b.ap; cur.vah = b.vah; cur.poc = b.poc; cur.val = b.val; cur.last = b.idx;
      if (cur.vs == null) cur.vs = b.vs; if (b.ve != null) { cur.ve = b.ve; cur.vap = b.vap; }
      cur.steps.push([b.vah, b.poc, b.val]); cur.parts.push(b);
      for (const [k, c] of b.lv) { const z = cur.lv.get(k) || {bid: 0, ask: 0}; z.bid += c.bid; z.ask += c.ask; cur.lv.set(k, z); }
      cv += bv; if (cv >= N) cur = null;
    }
    for (const c of out) { let v = 0, a = 0, ok = true; for (const b of c.parts) { let bv = 0; for (const z of b.lv.values()) bv += z.bid + z.ask; if (!b.x) { ok = false; break; } v += bv; a += bv / b.x; } c.x = ok && a > 0 ? v / a : null; }
    let acc = 0;
    for (const c of out) { c.d = 0; c.v = 0; c.vmax = 0; c.pocK = null; for (const [k, z] of c.lv) { z.d = z.ask - z.bid; z.v = z.ask + z.bid; c.d += z.d; c.v += z.v; if (z.v > c.vmax) { c.vmax = z.v; c.pocK = k; } } acc += c.d; c.acc = acc; }
    if (rng === 'rth') { let a0 = 0; for (const b of box) { if (b.rth) break; for (const z of b.lv.values()) a0 += z.ask - z.bid; } for (const c of out) c.acc += a0; }
    return out;
  }
  let cols;
  if (tf === 'M5') cols = box;
  else {
    const N = {M15: 15, M30: 30, H1: 60}[tf];
    const key = b => { const m = Math.floor(Number(b.t.slice(3)) / N) * N; return b.t.slice(0, 2) + ':' + String(N === 60 ? 0 : m).padStart(2, '0'); };
    cols = []; let cur = null;
    for (const b of box) {
      const kk = key(b);
      if (!cur || cur.t !== kk) { cur = {t: kk, O: b.O, H: b.H, L: b.L, C: b.C, hpl: b.hpl, het: b.het, vs: b.vs, ve: b.ve, vap: 0, rth: 0, ap: 0, lv: new Map(), steps: [], parts: [], x: N === 60 ? (D.h1x[b.het + ':00'] ?? null) : null}; cols.push(cur); }
      cur.H = Math.max(cur.H, b.H); cur.L = Math.min(cur.L, b.L); cur.C = b.C; if (cur.vs == null) cur.vs = b.vs; if (b.ve != null) { cur.ve = b.ve; cur.vap = b.vap; } cur.rth |= b.rth; cur.ap |= b.ap; cur.vah = b.vah; cur.poc = b.poc; cur.val = b.val;
      cur.steps.push([b.vah, b.poc, b.val]); cur.parts.push(b); cur.last = b.idx;
      for (const [k, c] of b.lv) { const z = cur.lv.get(k) || {bid: 0, ask: 0}; z.bid += c.bid; z.ask += c.ask; cur.lv.set(k, z); }
    }
    if (N < 60) for (const c of cols) {           // krotność średniej: suma wolumenu / suma średnich świec M5 tej grupy
      let v = 0, a = 0, ok = true;
      for (const b of c.parts) { let bv = 0; for (const z of b.lv.values()) bv += z.bid + z.ask; if (b.x == null || !b.x) { ok = false; break; } v += bv; a += bv / b.x; }
      c.x = ok && a > 0 ? v / a : null;
    }
  }
  let acc = 0;
  for (const c of cols) {
    c.d = 0; c.v = 0; c.vmax = 0; c.pocK = null;
    for (const [k, z] of c.lv) { z.d = z.ask - z.bid; z.v = z.ask + z.bid; c.d += z.d; c.v += z.v; if (z.v > c.vmax) { c.vmax = z.v; c.pocK = k; } }
    acc += c.d; c.acc = acc;
  }
  return rng === 'rth' ? cols.filter(c => c.rth) : cols;
}

function nodes(prof, bin) {            // HVN = istotne szczyty wygładzonego profilu (≥ 20% najwyższego, wystają ≥ 10% ponad sąsiednie dołki), LVN = najniższy punkt między dwoma sąsiednimi HVN
  const ks = [...prof.keys()]; if (ks.length < 5) return {hvn: [], lvn: []};
  const k0 = Math.min(...ks), k1 = Math.max(...ks), n = Math.round((k1 - k0) / bin) + 1, v = new Array(n).fill(0);
  for (const [k, x] of prof) v[Math.round((k - k0) / bin)] = x;
  const R = bin <= TK ? 1 : 0, sm = v.map((_, i) => { let a = 0, w = 0; for (let j = -R; j <= R; j++) { const q = i + j; if (q < 0 || q >= n) continue; const ww = R + 1 - Math.abs(j); a += v[q] * ww; w += ww; } return a / w; });
  const mx = Math.max(...sm), W = bin <= TK ? 2 : 1, cand = [];
  for (let i = 0; i < n; i++) { if (sm[i] < .2 * mx) continue; let top = true; for (let j = Math.max(0, i - W); j <= Math.min(n - 1, i + W); j++) if (sm[j] > sm[i] || (sm[j] === sm[i] && j < i)) { top = false; break; } if (top) cand.push(i); }
  // istotność szczytu: o ile wystaje ponad najgłębszy dołek na drodze do wyższego szczytu (≥ 10% najwyższego poziomu)
  const pk = cand.filter(i => { let L = sm[i], R = sm[i], l = i, r = i;
    while (l > 0 && sm[l - 1] <= sm[i]) { l--; L = Math.min(L, sm[l]); } while (r < n - 1 && sm[r + 1] <= sm[i]) { r++; R = Math.min(R, sm[r]); }
    const base = Math.max(l > 0 ? L : 0, r < n - 1 ? R : 0); return sm[i] - base >= .08 * mx; });
  const lv = [];
  for (let a = 0; a + 1 < pk.length; a++) { let m = pk[a]; for (let i = pk[a]; i <= pk[a + 1]; i++) if (sm[i] < sm[m]) m = i; lv.push(m); }
  // strefy: HVN = poziomy wokół szczytu z wolumenem ≥ 80% szczytu (nie dalej niż do LVN); LVN = poziomy wokół dołka z wolumenem ≤ dołek + 25% różnicy do niższego sąsiedniego szczytu
  const edge = (i0, ok, lim0, lim1) => { let l = i0, r = i0; while (l - 1 >= lim0 && ok(l - 1)) l--; while (r + 1 <= lim1 && ok(r + 1)) r++; return [k0 + l * bin, k0 + (r + 1) * bin]; };
  const hz = pk.map((p, j) => edge(p, i => sm[i] >= .8 * sm[p], j > 0 ? lv[j - 1] + 1 : 0, j < lv.length ? lv[j] - 1 : n - 1));
  const lz = lv.map((m, j) => { const t = sm[m] + .25 * (Math.min(sm[pk[j]], sm[pk[j + 1]]) - sm[m]); return edge(m, i => sm[i] <= t, pk[j] + 1, pk[j + 1] - 1); });
  return {hvn: hz, lvn: lz};
}
function devNodes(bin) {               // węzły profilu narastającego od początku pliku dnia – stan po każdej świecy M5
  const D = DATA[S.day], per = D.boxes.map(() => []), prof = new Map(), out = [];
  for (const [i, p, bid, ask] of D.cells) per[i].push([Q(Math.floor(p / bin + 1e-9) * bin), bid + ask]);
  for (const cells of per) { for (const [k, v] of cells) prof.set(k, (prof.get(k) || 0) + v); out.push(nodes(prof, bin)); }
  return out;
}
function vixState(c) {               // ✓ = US500 i VIX w przeciwne strony, ✗ = w tę samą, · = brak wyraźnego ruchu
  if (c.vs == null || c.ve == null) return null;
  const dv = c.ve - c.vs, du = c.C - c.O;
  return {dv, s: Math.abs(dv) < .03 || Math.abs(du) < .5 ? 0 : (Math.sign(dv) !== Math.sign(du) ? 1 : -1)};
}
function boxLv(i) { const D = DATA[S.day]; if (!D._lv) { D._lv = D.boxes.map(() => ({})); for (const [bi, p, bid, ask] of D.cells) { const z = D._lv[bi][p] || (D._lv[bi][p] = [0, 0]); z[0] += bid; z[1] += ask; } } return D._lv[i]; }
function rollVA(cols, n, bin) {       // VA 70% i POC z ostatnich n minut (świece M5) na końcu każdej kolumny
  const D = DATA[S.day], per = D.boxes.map(() => []);
  for (const [i, p, bid, ask] of D.cells) per[i].push([Q(Math.floor(p / bin + 1e-9) * bin), bid + ask]);
  const w = Math.round(n / 5), memo = new Map();
  return cols.map(c => {
    const L = c.last; if (memo.has(L)) return memo.get(L);
    const m = new Map(); for (let i = Math.max(0, L - w + 1); i <= L; i++) for (const [k, v] of per[i]) m.set(k, (m.get(k) || 0) + v);
    const ks = [...m.keys()].sort((a, b) => a - b); if (!ks.length) { memo.set(L, null); return null; }
    const vs = ks.map(k => m.get(k)), tot = vs.reduce((a, b) => a + b, 0); let pi = vs.indexOf(Math.max(...vs)), a0 = pi, a1 = pi, acc = vs[pi];
    while (acc < .7 * tot && (a0 > 0 || a1 < ks.length - 1)) { const up = a1 < ks.length - 1 ? vs[a1 + 1] : -1, dn = a0 > 0 ? vs[a0 - 1] : -1; if (up >= dn) acc += vs[++a1]; else acc += vs[--a0]; }
    const r = {vah: ks[a1] + bin, poc: ks[pi] + bin / 2, val: ks[a0]}; memo.set(L, r); return r;
  });
}
function carriedZones(bin, nback = 5) {   // strefy imbalansów z poprzednich sesji, których cena później nie dotknęła (do początku bieżącej sesji)
  const ds = Object.keys(DATA).sort(), j = ds.indexOf(S.day), out = [], tf = S.tf === 'M1' ? 'M5' : S.tf;
  for (let q = Math.max(0, j - nback); q < j; q++) {
    const day = ds[q], cs = columns(day, tf, 'all');
    cs.forEach((c, i) => imbalances(c, bin).zones.forEach(z => {
      let hit = false;
      for (let k = i + 1; k < cs.length && !hit; k++) if (cs[k].L <= z.hi && cs[k].H >= z.lo) hit = true;
      for (let r = q + 1; r < j && !hit; r++) for (const b of DATA[ds[r]].boxes) if (b[3] <= z.hi && b[2] >= z.lo) { hit = true; break; }
      if (!hit) out.push({...z, day, t: c.t, back: j - q});
    }));
  }
  return out;
}
function divergences(cols) {          // dywergencje ceny z deltą, CVD i wolumenem
  const out = cols.map(() => []);
  cols.forEach((c, i) => {
    const p3 = cols.slice(Math.max(0, i - 3), i), p12 = cols.slice(Math.max(0, i - 12), i);
    if (p3.length < 3) return;
    const hi3 = Math.max(...p3.map(x => x.H)), lo3 = Math.min(...p3.map(x => x.L));
    if (c.H > hi3 && c.d < 0) out[i].push({side: -1, t: 'Δ'});
    if (c.L < lo3 && c.d > 0) out[i].push({side: 1, t: 'Δ'});
    if (p12.length >= 6) {
      const jh = p12.reduce((a, x, j) => x.H > p12[a].H ? j : a, 0), jl = p12.reduce((a, x, j) => x.L < p12[a].L ? j : a, 0), ph = p12[jh], pl = p12[jl];
      if (c.H > ph.H && jh < p12.length - 1) { if (c.acc < ph.acc) out[i].push({side: -1, t: 'CVD'}); if (c.v < .7 * ph.v) out[i].push({side: -1, t: 'wol'}); }
      if (c.L < pl.L && jl < p12.length - 1) { if (c.acc > pl.acc) out[i].push({side: 1, t: 'CVD'}); if (c.v < .7 * pl.v) out[i].push({side: 1, t: 'wol'}); }
    }
  });
  return out;
}
function imbalances(c, bin) {
  const buy = new Set(), sell = new Set();
  for (const [k, z] of c.lv) {
    const below = c.lv.get(Q(k - bin)), above = c.lv.get(Q(k + bin));
    if (below && z.ask >= 3 * Math.max(below.bid, 1) && z.ask >= 20) buy.add(k);
    if (above && z.bid >= 3 * Math.max(above.ask, 1) && z.bid >= 20) sell.add(k);
  }
  const zones = [];
  for (const [set, side] of [[buy, 1], [sell, -1]]) {
    const ks = [...set].sort((a, b) => a - b); let run = [];
    for (const k of ks.concat([null])) {
      if (k !== null && (!run.length || k - run[run.length - 1] === bin)) { run.push(k); continue; }
      if (run.length >= 3) zones.push({lo: run[0], hi: run[run.length - 1] + bin, side, n: run.length});
      run = k !== null ? [k] : [];
    }
  }
  return {buy, sell, zones};
}

const LABK = ['ea', 'trap', 'zf', 'ob', 'fvg', 'vp', 'div', 'djw', 'evw', 'zgw'];   // v1.9 warstwy tylko w trybie Laboratorium
function applyMode() { const L = window.DAF_LOCK; if (L) S.mode = L; if (!S.mode) S.mode = 'lab';
  document.body.classList.toggle('nauka', S.mode === 'nauka'); const m = document.getElementById('mode');
  if (m) { m.hidden = !!L; m.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === S.mode))); }
  if (S.mode === 'nauka') for (const k of LABK) S[k] = false; }
// v1.9 celownik w oknach: każdy wykres okna z atrybutem data-xh dostaje pionową i poziomą linię pod kursorem, wartość na osi Y (data-v0 przy dolnej
// krawędzi y1, data-v1 przy górnej y0) i etykietę X (data-xl: lista etykiet kolumn 'c' / punktów 'p'; data-xa…xb: oś X jako wartość). Pion przechodzi przez
// wszystkie wykresy okna z tym samym data-xg (np. OHLC, delta, CVD, wolumen) – jeden moment widać na wszystkich panelach naraz.
const xhA = o => Object.entries(o).filter(([, v]) => v != null && v === v).map(([k, v]) => ` data-${k}="${String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`).join('') + ' data-xh="1"';
const xhF = (v, f) => { if (f === 'n') { const a = Math.abs(v), sg = v > 0 ? '+' : v < 0 ? '−' : ''; return sg + (a >= 1e6 ? (a / 1e6).toFixed(2) + ' mln' : a >= 1e4 ? (a / 1e3).toFixed(1) + ' tys.' : Math.round(a)); }
  if (f === 'v') return String(Math.round(v)); if (f === 'n2') return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2).replace('.', ',') + '%'; return (+v).toFixed(DEC); };
let XH_ON = [];
const xhOff = () => { for (const g of XH_ON) g.remove(); XH_ON = []; };
document.addEventListener('mousemove', e => {
  const sv = e.target.closest && e.target.closest('svg[data-xh]'); xhOff(); if (!sv) return;
  const D = sv.dataset, ctm = sv.getScreenCTM(); if (!ctm) return;
  const pt = sv.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const P = pt.matrixTransform(ctm.inverse());
  const x0 = +D.x0, x1 = +D.x1, y0 = +D.y0, y1 = +D.y1; if (P.x < x0 - 2 || P.x > x1 + 2 || P.y < y0 - 2 || P.y > y1 + 2) return;
  let X = Math.max(x0, Math.min(x1, P.x)), lab = null; const Y = Math.max(y0, Math.min(y1, P.y));
  const L = D.xl ? D.xl.split('|') : null;
  if (L && L.length) { const n = L.length;
    if (D.xm === 'p') { const st = n > 1 ? (x1 - x0) / (n - 1) : 0, i = st ? Math.round((X - x0) / st) : 0; X = x0 + i * st; lab = L[i]; }
    else { const cw = (x1 - x0) / n, i = Math.max(0, Math.min(n - 1, Math.floor((X - x0) / cw))); X = x0 + cw * (i + .5); lab = L[i]; } }
  else if (D.xa != null) lab = xhF(+D.xa + (X - x0) / (x1 - x0) * (+D.xb - +D.xa), D.xf || 'p');
  const NS = 'http://www.w3.org/2000/svg', win = sv.closest('.vawin') || document, grp = D.xg ? [...win.querySelectorAll(`svg[data-xh][data-xg="${D.xg}"]`)] : [sv];
  const mk = (par, html) => { const g = document.createElementNS(NS, 'g'); g.setAttribute('pointer-events', 'none'); g.innerHTML = html; par.appendChild(g); XH_ON.push(g); };
  const lw = sv.viewBox.baseVal.width || x1;
  for (const s2 of grp) { const d2 = s2.dataset; mk(s2, `<line x1="${X}" x2="${X}" y1="${+d2.y0 - 4}" y2="${+d2.y1 + 2}" stroke="var(--ewr)" stroke-width="1"/>`); }
  let h = `<line x1="${x0}" x2="${x1}" y1="${Y}" y2="${Y}" stroke="var(--ewr)" stroke-width="1" stroke-dasharray="3 2" opacity=".8"/>`;
  if (D.v0 != null && D.v1 != null) { const v = +D.v0 + (y1 - Y) / ((y1 - y0) || 1) * (+D.v1 - +D.v0), t = xhF(v, D.f || 'p'), w = t.length * 6.6 + 10, side = D.ys === 'l' ? 'l' : 'r';
    const bx = side === 'l' ? Math.max(0, x0 - w - 2) : Math.min(lw - w, x1 + 2);
    h += `<rect x="${bx}" y="${Y - 8}" width="${w}" height="16" rx="3" fill="var(--ewr)"/><text x="${bx + w / 2}" y="${Y + 4}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#fff" font-family="var(--mono, monospace)">${t}</text>`; }
  mk(sv, h);
  if (lab != null) { const tg = grp[grp.length - 1], d2 = tg.dataset, w = String(lab).length * 6.4 + 10, bx = Math.max(+d2.x0 - 20, Math.min((tg.viewBox.baseVal.width || +d2.x1) - w, X - w / 2)), yb = +d2.y1 + 2;
    mk(tg, `<rect x="${bx}" y="${yb}" width="${w}" height="15" rx="3" fill="var(--ewr)"/><text x="${bx + w / 2}" y="${yb + 11}" text-anchor="middle" font-size="10" font-weight="700" fill="#fff" font-family="var(--mono, monospace)">${lab}</text>`); }
});
// v1.9 sesje rynków: noc = od zamknięcia poprzedniej sesji kasowej do otwarcia bieżącej, także przez granicę doby DA (23:00).
// US500 22:00 D-1 → 15:30, DAX 17:30 D-1 → 09:00, J225 07:30 D-1 → 01:00 (wcześniej noc = tylko świece doby DA przed sesją, dla J225 2 godziny).
// Godziny sesji kasowej z pola rth w danych (plan sesji: docs/sesje_rynkow.md). Zwraca {boxes, cells, from, n0} – świece D-1 po sesji + świece doby przed sesją.
function nightOf(DT, day) {
  const ds = Object.keys(DT).sort(), j = ds.indexOf(day), D0 = DT[day]; if (!D0) return null;
  const fr = D0.boxes.findIndex(b => b && b[9]); if (fr < 0) return null;
  const boxes = [], cells = []; let from = null, n0 = 0;
  const P = j > 0 ? DT[ds[j - 1]] : null;
  if (P) { const B = P.boxes, lr = B.length - 1 - [...B].reverse().findIndex(b => b && b[9]);
    if (lr < B.length && B.some(b => b && b[9])) { const map = new Map();
      for (let i = lr + 1; i < B.length; i++) if (B[i]) { map.set(i, boxes.length); boxes.push(B[i]); }
      for (const c of P.cells) if (map.has(c[0])) cells.push([map.get(c[0]), c[1], c[2], c[3]]);
      if (boxes.length) from = B[lr + 1] ? B[lr + 1][0] : null; } }
  n0 = boxes.length; const map = new Map();
  for (let i = 0; i < fr; i++) if (D0.boxes[i]) { map.set(i, boxes.length); boxes.push(D0.boxes[i]); }
  for (const c of D0.cells) if (map.has(c[0])) cells.push([map.get(c[0]), c[1], c[2], c[3]]);
  if (from == null && boxes.length) from = boxes[0][0];
  return boxes.length ? {boxes, cells, from, n0, prev: n0 > 0} : null;
}
function render(keep) {
  applyMode();
  document.querySelectorAll('.seg:not(#theme)').forEach(s => s.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v == S[{tf: 'tf', rng: 'rng', bin: 'bin', vwm: 'vw'}[s.id]]))));
  $('showREF').checked = S.ref !== false; $('showNK').checked = S.naked !== false; $('showOPT').checked = S.opt !== false; $('showATR').checked = S.atr !== false; $('showST').checked = !!S.st; $('showSUM').checked = S.sumOn !== false; $('sum').hidden = S.sumOn === false; $('showLEG').checked = S.legOn !== false; $('legBox').hidden = S.legOn === false; $('showEA').checked = S.ea !== false; $('showUT').checked = S.trap !== false; $('showZF').checked = !!S.zf; $('showOB').checked = S.ob !== false; $('showVP').checked = S.vp !== false; $('showHR').checked = S.hr !== false; $('showFVG').checked = !!S.fvg; $('showEW').checked = S.ew !== false; $('pfTree').checked = !!S.tree; $('showVAW').checked = !!S.vaw; $('showDLW').checked = !!S.dlw; $('showLNW').checked = !!S.lnw; $('showKRW').checked = !!S.krw; $('showHVW').checked = !!S.hvw; $('showPSW').checked = !!S.psw; $('showINW').checked = !!S.inw; $('showMTW').checked = !!S.mtw; $('showDJW').checked = !!S.djw; $('showEVW').checked = !!S.evw; $('showMKW').checked = !!S.mkw; $('showOPW').checked = !!S.opw; $('showOMW').checked = !!S.omw; $('showZGW').checked = !!S.zgw; $('pfTreeV').checked = !!S.treeV; $('pfTreeV').disabled = !S.tree; $('pfTreeV').parentNode.style.opacity = S.tree ? 1 : .45;
  drawHvnWin();
  markPreset();
  $('rpBar').hidden = !S.rp; $('rpOn').setAttribute('aria-pressed', String(!!S.rp)); $('rpOn').textContent = S.rp ? '■ zakończ odtwarzanie' : '▶ Odtwarzanie';
  $('day').value = S.day; $('showVA').checked = S.va; $('showZ').checked = S.z; $('zDim').checked = S.zDim !== false; $('showN').checked = S.nodes !== false; $('showD').checked = S.div !== false; $('showCZ').checked = S.cz !== false; $('showDP').checked = !!S.dp; $('showVX').checked = S.vx !== false; $('vxInv').checked = S.vxInv !== false; $('showUA').checked = S.ua !== false; $('showTV').checked = !!S.tv; for (const k of ['ba', 'v', 'd']) $('cell_' + k).checked = S.cell[k] !== false; for (const k of PFK) $('pf_' + k).checked = !!S.pf[k];
  BIN = S.bin === 'auto' ? autoBin() : S.bin * TK;
  $('ctrlInfo').innerHTML = `<b>${INST}</b> · ${S.day.slice(8)}.${S.day.slice(5, 7)}.${S.day.slice(0, 4)} <span id="clk"></span> <span id="liveSt"></span> <span id="lastPx"></span> <b>${S.tf}</b> <b>${S.rng === 'rth' ? 'sesja kasowa' : 'cała doba'}</b> <b>krok ${S.bin === 'auto' ? 'auto (' + BIN + ' pkt)' : BIN + ' pkt'}</b>${S.rp ? ' <b>odtwarzanie</b>' : ''} <span id="atrBarBox"></span>`;
  const D = DATA[S.day], bin = BIN; let cols = columns();
  const ACCB = []; { let a = 0; for (let i = 0; i < D.boxes.length; i++) { for (const z of Object.values(boxLv(i))) a += z[1] - z[0]; ACCB.push(a); } }
  RPN_MAX = cols.length;
  if (S.rp && S.rpT) { const ix = cols.findIndex(c => String(c.t || '').slice(0, 5) === S.rpT), k = ix >= 0 ? ix + 1 : cols.filter(c => c.t && mmS(String(c.t).slice(0, 5)) <= mmS(S.rpT)).length; S.rpN = Math.max(1, k); delete S.rpT; }
  if (S.rp) { S.rpN = Math.max(1, Math.min(S.rpN || 1, cols.length)); cols = cols.slice(0, S.rpN); $('rpInfo').textContent = `świeca ${S.rpN} / ${RPN_MAX} · ${cols[cols.length - 1]?.t || ''}`; }
  const RL = S.rp && cols.length ? cols[cols.length - 1].last : Infinity;
  $('src').textContent = `źródło cen i VA: ${D.src}`;
  if (!cols.length) { $('fp').innerHTML = ''; $('axis').innerHTML = ''; $('sum').textContent = S.tf === 'M1' ? 'M1: brak eksportu M1 z DA dla tej sesji (są dla 26–30.10). Wybierz inną sesję albo interwał.' : 'Brak świec w wybranym zakresie.'; ['hdr', 'ftr', 'prof', 'corner', 'bcorner', 'pcorner', 'pbcorner'].forEach(id => $(id).innerHTML = ''); return; }
  const C = {buy: css('--buy'), sell: css('--sell'), va: css('--va'), poc: css('--poc'), hot: css('--hot'), hotbg: css('--hotbg'), hvn: css('--hvn'), ua: css('--ua'), ex: css('--ex'), ab: css('--ab'), tvt: css('--tvt'), tvv: css('--tvv'), lvn: css('--lvn'), vix: css('--vix'), vwap: css('--vwap'), atr: css('--atr'), opt: css('--opt'), ref: css('--ref'), ib: css('--ib'), r60: css('--r60'), r90: css('--r90'), r120: css('--r120'), r180: css('--r180'), r240: css('--r240'), ink: css('--ink'), mut: css('--mut'), line: css('--line'), bar: css('--bar')};
  // szerokość kolumny wg tego, co pokazują komórki (cyfry ~6,1 px w czcionce 10 px)
  const CH = 6.1; let nd = 1, nb = 1, na = 1, nv = 1;
  for (const c of cols) for (const z of c.lv.values()) { nd = Math.max(nd, String(z.ask - z.bid).length + (z.ask - z.bid > 0 ? 1 : 0)); nb = Math.max(nb, String(z.bid).length); na = Math.max(na, String(z.ask).length); nv = Math.max(nv, String(z.bid + z.ask).length); }
  const LD = S.cell.d ? Math.ceil(nd * CH + 8) : 0, LBA = S.cell.ba ? Math.ceil((nb + na) * CH + 22) : 0, LV = S.cell.v ? Math.ceil(nv * CH + 12) : 0;
  const XD = 13, XBA = XD + LD, XV = XBA + LBA, CWc = Math.max(64, XV + LV + 6);
  const M1 = S.tf === 'M1', CW = M1 ? 14 : CWc, NARROW = CW < 120, RH = 15, HEAD = 10, HH = S.st && !M1 ? 106 : 50, FOOT = 8, FH = 62;
  let lo = Infinity, hi = -Infinity;
  for (const c of cols) for (const k of c.lv.keys()) { lo = Math.min(lo, k); hi = Math.max(hi, k + bin); }
  if (S.tf === 'M1') for (const c of cols) { lo = Math.min(lo, Q(Math.floor(c.L / bin + 1e-9) * bin)); hi = Math.max(hi, Q(Math.ceil(c.H / bin - 1e-9) * bin)); }
  if (!S.rp) for (const v of extraLevels()) { lo = Math.min(lo, Q(Math.floor(v / bin + 1e-9) * bin)); hi = Math.max(hi, Q(Math.ceil(v / bin - 1e-9) * bin)); }
  if (S.bin === 'auto' && !S.rp) for (const b of D.boxes) { lo = Math.min(lo, Q(Math.floor(b[3] / bin + 1e-9) * bin)); hi = Math.max(hi, Q(Math.ceil(b[2] / bin - 1e-9) * bin)); }
  if (S.pf.d1 || S.pf.d1r) { const ds = Object.keys(DATA).sort(), j = ds.indexOf(S.day);      // zakres cen D-1, żeby profil D-1 był cały widoczny
    if (j > 0) for (const b of DATA[ds[j - 1]].boxes) if (S.pf.d1 || b[9]) { lo = Math.min(lo, Q(Math.floor(b[3] / bin + 1e-9) * bin)); hi = Math.max(hi, Q(Math.ceil(b[2] / bin - 1e-9) * bin)); } }
  if (S.hr !== false && !M1) { const q = hrCalc(D, cols); if (q) for (const v of [q.pmx, q.pmn, q.nx, q.nn]) if (Number.isFinite(v)) { lo = Math.min(lo, Q(Math.floor(v / bin + 1e-9) * bin)); hi = Math.max(hi, Q(Math.ceil(v / bin - 1e-9) * bin)); } }
  lo -= bin; hi += bin;
  const H = Math.round((hi - lo) / bin * RH), W = cols.length * CW + 20 + ([60, 90, 120, 180, 240].some(n => S.pf['l' + n]) || S.vw !== 'off' ? 90 : 0) + (S.hr !== false && !M1 ? 150 : 0);
  const y = p => HEAD + (hi - p) / bin * RH;
  let dmax = 1; const ds = [];
  for (const c of cols) for (const z of c.lv.values()) ds.push(Math.abs(z.d));
  ds.push(1); ds.sort((a, b) => a - b); dmax = Math.max(1, ds[Math.floor(ds.length * .98)] || 1);
  const o = [], oh = [], on = [], ou = [], ov = [], of = [];
  // grid
  const step = bin * (S.tf === 'M5' ? 2 : 2);
  for (let p = Math.ceil(lo / step) * step; p <= hi; p += step) o.push(`<line x1="0" x2="${W}" y1="${y(p)}" y2="${y(p)}" stroke="${C.line}" stroke-width=".6"/>`);
  const imb = cols.map(c => imbalances(c, bin));
  // VA band under cells
  if (S.va) {
    cols.forEach((c, i) => {
      const n = c.steps.length, w = (M1 ? CW : CW - 8) / n;
      c.steps.forEach(([vah, poc, val], j) => {
        if (vah == null || val == null) return;
        const x0 = i * CW + (M1 ? 0 : 4) + j * w;
        ou.push(`<rect x="${x0}" y="${y(vah + TK)}" width="${w + .5}" height="${y(val) - y(vah + TK)}" fill="${C.va}" opacity=".12"/>`);
      });
    });
  }
  const accPts = [];
  cols.forEach((c, i) => {
    const x0 = i * CW, hot = c.x != null && c.x >= 1.5;
    if (M1) {
      const col = c.C >= c.O ? C.buy : C.sell, q15 = Number(c.t.slice(3)) % 15 === 0;
      if (q15) { o.push(`<line x1="${x0}" x2="${x0}" y1="0" y2="${HEAD + H + FOOT}" stroke="${C.line}"/>`); of.push(`<line x1="${x0}" x2="${x0}" y1="0" y2="${FH}" stroke="${C.line}"/><text x="${x0 + 3}" y="15" font-size="11" fill="${C.ink}">${c.t}</text>`); oh.push(`<line x1="${x0}" x2="${x0}" y1="0" y2="${HH + 8}" stroke="${C.line}"/>`); }
      o.push(`<g><title>${c.t}  O ${c.O} H ${c.H} L ${c.L} C ${c.C}${c.acc != null ? '  acc Δ ' + c.acc : ''}</title><line x1="${x0 + CW / 2}" x2="${x0 + CW / 2}" y1="${y(c.H)}" y2="${y(c.L)}" stroke="${col}" stroke-width="1.6"/><rect x="${x0 + 2}" y="${y(Math.max(c.O, c.C))}" width="${CW - 4}" height="${Math.max(Math.abs(y(c.O) - y(c.C)), 2)}" fill="${col}" rx="1"/></g>`);
      if (c.acc != null) accPts.push([x0 + CW / 2, c.acc, c.t]);
      const vs_ = vixState(c);
      if (vs_) { const VO = DATA[S.day].vix_open ?? (cols.find(q => q.vs != null) || {}).vs;
        of.push(`<g><title>${c.t} VIX ${c.vs.toFixed(2)} → ${c.ve.toFixed(2)}; ${vs_.s > 0 ? 'potwierdzenie' : vs_.s < 0 ? 'rozbieżność' : 'brak wyraźnego ruchu'}</title><rect x="${x0 + 1}" y="24" width="${CW - 2}" height="10" fill="${c.ve > VO ? C.sell : C.buy}" opacity=".15"/><rect x="${x0 + 2}" y="40" width="${CW - 4}" height="10" rx="2" fill="${vs_.s > 0 ? C.buy : vs_.s < 0 ? C.sell : C.bar}" opacity="${vs_.s ? .9 : .4}"/></g>`);
        if (q15) of.push(`<text x="${x0 + 3}" y="33" font-size="9.5" fill="${C.vix}">${c.ve.toFixed(2)}</text>`); }
      return;
    }
    if (hot) { oh.push(`<rect x="${x0 + 2}" y="4" width="${CW - 4}" height="${HH}" fill="${C.hotbg}" stroke="${C.hot}" stroke-width="1.5"/>`); }
    // nagłówek
    oh.push(`<text x="${x0 + CW / 2}" y="16" text-anchor="middle" font-size="10.5" fill="${hot ? C.hot : C.mut}" font-weight="${hot ? 600 : 400}">${NARROW ? '' : 'wol '}${fmt(c.v)}${c.x != null ? ` ${NARROW ? '' : '· '}×${c.x.toFixed(1).replace('.', ',')}` : ''}</text>`);
    oh.push(`<text x="${x0 + CW / 2}" y="31" text-anchor="middle" font-size="11.5" font-weight="600" fill="${c.d >= 0 ? C.buy : C.sell}">${NARROW ? '' : 'Δ '}${fmt(c.d, 1)}</text>`);
    oh.push(`<text x="${x0 + CW / 2}" y="45" text-anchor="middle" font-size="10" fill="${c.acc >= 0 ? C.buy : C.sell}" font-weight="600">${NARROW ? '' : 'acc '}${fmt(c.acc, 1)}</text>`);
    if (S.st) {
      let bs = 0, as = 0; for (const z of c.lv.values()) { bs += z.bid; as += z.ask; }
      const dp = c.v ? c.d / c.v * 100 : 0; let run = 0, mn = 0, mx = 0;
      if (c.parts && c.parts.length > 1) for (const b of c.parts) { for (const z of b.lv.values()) run += z.ask - z.bid; mn = Math.min(mn, run); mx = Math.max(mx, run); }
      const dur = c.parts ? (() => { const t0 = c.parts[0].t, t1 = c.parts[c.parts.length - 1].t, m = (Number(t1.slice(0, 2)) * 60 + Number(t1.slice(3)) - Number(t0.slice(0, 2)) * 60 - Number(t0.slice(3)) + 1440) % 1440 + 5; return m; })() : 5;
      oh.push(`<text x="${x0 + CW / 2}" y="60" text-anchor="middle" font-size="9.5" font-weight="600" fill="${dp >= 0 ? C.buy : C.sell}">${NARROW ? '' : 'Δ% '}${dp > 0 ? '+' : ''}${dp.toFixed(0)}%</text>`);
      oh.push(`<text x="${x0 + CW / 2}" y="73" text-anchor="middle" font-size="9.5" fill="${C.ink}"><tspan fill="${C.sell}">${fmt(bs)}</tspan> × <tspan fill="${C.buy}">${fmt(as)}</tspan></text>`);
      oh.push(`<text x="${x0 + CW / 2}" y="86" text-anchor="middle" font-size="9" fill="${C.mut}">${c.parts && c.parts.length > 1 ? `${NARROW ? '' : 'Δ min/max '}<tspan fill="${C.sell}">${fmt(mn, 1)}</tspan>/<tspan fill="${C.buy}">${fmt(mx, 1)}</tspan>` : 'Δ min/max –'}</text>`);
      oh.push(`<text x="${x0 + CW / 2}" y="99" text-anchor="middle" font-size="9" fill="${C.mut}">${NARROW ? '' : 'czas '}${dur} min</text>`);
    }
    const {buy, sell} = imb[i];
    for (const [k, z] of [...c.lv].sort((a, b) => b[0] - a[0])) {
      const yy = y(k + bin), a = Math.min(Math.abs(z.d) / dmax, 1) * .5, ym = yy + RH / 2 + 3.5;
      o.push(`<g><title>${k}${bin > 1 ? '–' + (k + bin) : ''}: bid ${z.bid}, ask ${z.ask}, Δ ${z.d > 0 ? '+' : ''}${z.d}, wol ${z.v}</title>`);
      o.push(`<rect x="${x0 + 10}" y="${yy + .5}" width="${CW - 16}" height="${RH - 1}" fill="${z.d >= 0 ? C.buy : C.sell}" opacity="${a.toFixed(3)}"/>`);
      const bw = (LV - 2) * z.v / c.vmax;
      if (S.cell.v) o.push(`<rect x="${x0 + XV + LV - bw}" y="${yy + 2}" width="${bw}" height="${RH - 4}" fill="${C.bar}" opacity=".35"/>`);
      if (S.cell.d) o.push(`<text x="${x0 + XD}" y="${ym}" font-size="10" font-weight="600" fill="${z.d > 0 ? C.buy : z.d < 0 ? C.sell : C.mut}">${z.d > 0 ? '+' : ''}${z.d}</text>`);
      if (S.cell.ba) o.push(`<text x="${x0 + XBA + nb * CH + 4}" y="${ym}" font-size="10" text-anchor="end" fill="${sell.has(k) ? C.sell : C.ink}" font-weight="${sell.has(k) ? 700 : 400}">${z.bid}</text>`);
      if (S.cell.ba) o.push(`<text x="${x0 + XBA + nb * CH + 10}" y="${ym}" font-size="9" text-anchor="middle" fill="${C.mut}">×</text>`);
      if (S.cell.ba) o.push(`<text x="${x0 + XBA + nb * CH + 16}" y="${ym}" font-size="10" fill="${buy.has(k) ? C.buy : C.ink}" font-weight="${buy.has(k) ? 700 : 400}">${z.ask}</text>`);
      if (S.cell.v) o.push(`<text x="${x0 + XV + LV - 2}" y="${ym}" font-size="10" text-anchor="end" fill="${C.ink}">${z.v}</text>`);
      o.push('</g>');
    }
    if (c.pocK != null) o.push(`<rect x="${x0 + 8}" y="${y(c.pocK + bin)}" width="${CW - 12}" height="${RH}" fill="none" stroke="${C.ink}" stroke-width="1.3"/>`);
    const col = c.C >= c.O ? C.buy : C.sell;
    o.push(`<line x1="${x0 + 5}" x2="${x0 + 5}" y1="${y(c.H)}" y2="${y(c.L)}" stroke="${col}" stroke-width="2"/><rect x="${x0 + 1}" y="${y(Math.max(c.O, c.C))}" width="8" height="${Math.max(Math.abs(y(c.O) - y(c.C)), 2)}" fill="${col}" rx="1"/>`);
    of.push(`<line x1="${x0}" x2="${x0}" y1="0" y2="${FH}" stroke="${C.line}"/><text x="${x0 + CW / 2}" y="15" text-anchor="middle" font-size="${c.t2 && c.t2 !== c.t ? 10 : 11}" fill="${C.ink}">${c.t}${c.t2 && c.t2 !== c.t ? '–' + c.t2 : ''}${c.ap ? '*' : ''}</text>`);
    const vs_ = vixState(c), VO = DATA[S.day].vix_open ?? (cols.find(q => q.vs != null) || {}).vs;
    if (vs_) {
      const yb = 23, reg = c.ve > VO;
      of.push(`<g><title>VIX ${c.vs.toFixed(2)} → ${c.ve.toFixed(2)} (${vs_.dv > 0 ? '+' : ''}${vs_.dv.toFixed(2)})${c.vap ? ', zamknięcie przybliżone' : ''}; ${reg ? 'nad' : 'pod'} otwarciem ${VO.toFixed(2)} – ${reg ? 'risk-off' : 'risk-on'}; ${vs_.s > 0 ? 'potwierdzenie' : vs_.s < 0 ? 'rozbieżność' : 'brak wyraźnego ruchu'}</title>`);
      of.push(`<rect x="${x0 + 6}" y="${yb}" width="${CW - 12}" height="32" rx="3" fill="${reg ? C.sell : C.buy}" opacity=".12"/>`);
      of.push(`<text x="${x0 + CW / 2}" y="${yb + 12}" text-anchor="middle" font-size="10" fill="${C.vix}">${NARROW ? '' : 'VIX ' + c.ve.toFixed(2) + ' ('}${vs_.dv > 0 ? '+' : ''}${vs_.dv.toFixed(2)}${NARROW ? '' : ')'}${c.vap ? '*' : ''}</text>`);
      of.push(`<rect x="${x0 + CW / 2 - (NARROW ? 14 : 22)}" y="${yb + 16}" width="${NARROW ? 28 : 44}" height="13" rx="3" fill="${vs_.s > 0 ? C.buy : vs_.s < 0 ? C.sell : C.bar}" opacity="${vs_.s ? .9 : .5}"/><text x="${x0 + CW / 2}" y="${yb + 26}" text-anchor="middle" font-size="9.5" font-weight="700" fill="${css('--panel')}">${vs_.s > 0 ? (NARROW ? '✓' : '✓ potw.') : vs_.s < 0 ? (NARROW ? '✗' : '✗ rozb.') : '·'}</text></g>`);
    }
    o.push(`<line x1="${x0}" x2="${x0}" y1="0" y2="${HEAD + H + FOOT}" stroke="${C.line}" stroke-width="${S.tf !== 'M5' || c.t.slice(3) < '05' ? 1 : .4}"/>`);
  });
  if (M1 && accPts.length) {
    const a0 = Math.min(...accPts.map(p => p[1])), a1 = Math.max(...accPts.map(p => p[1])), ya = v => 8 + (a1 - v) / Math.max(a1 - a0, 1) * (HH - 12);
    oh.push(`<path d="${accPts.map((p, j) => (j ? 'L' : 'M') + p[0] + ',' + ya(p[1])).join('')}" fill="none" stroke="${C.poc}" stroke-width="1.6"/>`);
    accPts.forEach(p => { if (Number(p[2].slice(3)) % 15 === 0) oh.push(`<text x="${p[0] + 2}" y="${HH + 4}" font-size="9" fill="${p[1] >= 0 ? C.buy : C.sell}" font-weight="600">${fmt(p[1], 1)}</text>`); });
    oh.push(`<text x="4" y="12" font-size="9.5" fill="${C.mut}">acc Δ (DA): ${fmt(a0, 1)} … ${fmt(a1, 1)}</text>`);
  }
  // VA / POC lines
  if (S.va) {
    for (const [idx, color, w, off] of [[0, C.va, 1.6, TK], [2, C.va, 1.6, 0], [1, C.poc, 2.6, TK / 2]]) {
      let d = '';
      cols.forEach((c, i) => {
        const n = c.steps.length, sw = CW / n;
        c.steps.forEach((s, j) => { if (s[idx] == null) return; const yy = y(s[idx] + off); const xa = i * CW + j * sw; d += `${d ? 'L' : 'M'}${xa},${yy}H${xa + sw}`; });
      });
      ov.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}"/>`);
    }
  }
  // kroczące VA z ostatnich N minut
  const RV = [60, 90, 120, 180, 240].filter(n => S.pf['l' + n]);
  for (const n of RV) {
    const R = rollVA(cols, n, bin), col = C['r' + n];
    // ciągłe linie schodkowe (łączone pionowo między świecami) + wypełniony kanał VAH–VAL
    const seg = []; let cur = [];
    R.forEach((r, i) => { if (r) cur.push([i, r]); else if (cur.length) { seg.push(cur); cur = []; } }); if (cur.length) seg.push(cur);
    for (const sg of seg) {
      const st = k => sg.map(([i, r], j) => `${j ? 'L' : 'M'}${i * CW},${y(r[k])}H${(i + 1) * CW}`).join('');
      const bk = sg.slice().reverse().map(([i, r]) => `L${(i + 1) * CW},${y(r.val)}H${i * CW}`).join('');
      ou.push(`<path d="${st('vah')}${bk}Z" fill="${col}" opacity=".09"/>`);
      ov.push(`<path d="${st('vah')}" fill="none" stroke="${col}" stroke-width="1.6"/><path d="${st('val')}" fill="none" stroke="${col}" stroke-width="1.6"/><path d="${st('poc')}" fill="none" stroke="${col}" stroke-width="3" opacity=".9"/>`);
    }
    const last = R[R.length - 1];
    if (last) for (const [v, lab] of [[last.vah, 'VAH'], [last.poc, 'POC'], [last.val, 'VAL']]) ov.push(`<text x="${cols.length * CW + 2}" y="${y(v) + 3.5}" font-size="9.5" font-weight="700" fill="${col}" paint-order="stroke" stroke="${css('--panel')}" stroke-width="3">${n}' ${lab} ${v}</text>`);
  }
  // HVN / LVN profilu narastającego – stan na końcu każdej kolumny
  let DNN = null;
  if (S.nodes) {
    const DN = devNodes(bin); DNN = DN;
    cols.forEach((c, i) => { const nd = DN[c.last], x0 = i * CW;
      for (const [a, b] of nd.hvn) on.push(`<rect x="${x0}" y="${y(b)}" width="${CW}" height="${y(a) - y(b)}" fill="${C.hvn}" opacity=".16"/><line x1="${x0}" x2="${x0 + CW}" y1="${y(b)}" y2="${y(b)}" stroke="${C.hvn}" stroke-width="1.2"/><line x1="${x0}" x2="${x0 + CW}" y1="${y(a)}" y2="${y(a)}" stroke="${C.hvn}" stroke-width="1.2"/>`);
      for (const [a, b] of nd.lvn) on.push(`<rect x="${x0}" y="${y(b)}" width="${CW}" height="${y(a) - y(b)}" fill="url(#lvnh)" opacity=".9"/><line x1="${x0}" x2="${x0 + CW}" y1="${y(b)}" y2="${y(b)}" stroke="${C.lvn}" stroke-width="1" stroke-dasharray="4 3"/><line x1="${x0}" x2="${x0 + CW}" y1="${y(a)}" y2="${y(a)}" stroke="${C.lvn}" stroke-width="1" stroke-dasharray="4 3"/>`);
    });
  }
  // historia zdarzeń: zbierana z warstw rysowanych na wykresie (okno „Historia zdarzeń”)
  const EV = [], ev = (i, typ, side, txt, lvl) => { if (i != null && cols[i]) EV.push({i, t: cols[i].t, typ, side, txt, lvl}); };
  // dywergencje
  let ndiv = 0;
  if (S.div && !M1) divergences(cols).forEach((ds, i) => {
    for (const side of [-1, 1]) {
      const g = ds.filter(d => d.side === side); if (!g.length) continue; ndiv++;
      const c = cols[i], x = i * CW + 5, col = side < 0 ? C.sell : C.buy, yy = side < 0 ? y(c.H) - 6 : y(c.L) + 6, vx = c.vs != null && c.ve != null ? c.ve - c.vs : null, vok = vx != null && (side < 0 ? vx >= .03 : vx <= -.03), lab = g.map(d => d.t).join(' · ') + (vok ? ' · VIX ✓' : '');
      const tri = side < 0 ? `${x - 6},${yy - 9} ${x + 6},${yy - 9} ${x},${yy}` : `${x - 6},${yy + 9} ${x + 6},${yy + 9} ${x},${yy}`;
      ev(i, 'Dywergencja', -side, `${side < 0 ? 'niedźwiedzia' : 'byka'} (${g.map(d => d.t).join(', ')})${vok ? ', VIX potwierdza' : ''} przy ${side < 0 ? 'szczycie ' + c.H : 'dołku ' + c.L}`);
      o.push(`<g><title>${side < 0 ? 'Dywergencja niedźwiedzia' : 'Dywergencja byka'}: ${g.map(d => ({'Δ': 'nowy ' + (side < 0 ? 'szczyt' : 'dołek') + ' 3 świec przy delcie ' + (side < 0 ? 'ujemnej' : 'dodatniej'), 'CVD': 'nowy ' + (side < 0 ? 'szczyt' : 'dołek') + ' 12 świec, acc Δ ' + (side < 0 ? 'niżej' : 'wyżej') + ' niż przy poprzednim', 'wol': 'nowy ' + (side < 0 ? 'szczyt' : 'dołek') + ' 12 świec przy wolumenie < 70% świecy poprzedniego'}[d.t])).join('; ')}${vok ? '; VIX potwierdza: ' + (side < 0 ? 'rośnie' : 'spada') + ' (' + (vx > 0 ? '+' : '') + vx.toFixed(2) + ')' : (vx != null ? '; VIX nie potwierdza (' + (vx > 0 ? '+' : '') + vx.toFixed(2) + ')' : '; brak VIX')}</title>`);
      o.push(`<polygon points="${tri}" fill="${col}"/><text x="${x + 9}" y="${side < 0 ? yy - 2 : yy + 9}" font-size="10" font-weight="700" fill="${col}" paint-order="stroke" stroke="${css('--panel')}" stroke-width="3">${lab}</text></g>`);
    }
  });
  // strefy z poprzednich sesji, nieruszone do dziś – od lewej krawędzi do pierwszego testu
  let ncz = 0, ncz_out = 0;
  const fIdx = cols[0].parts ? cols[0].parts[0].idx : (cols[0].idx ?? cols[0].last);
  if (S.cz) for (const z of carriedZones(bin)) {
    if (D.boxes.slice(0, fIdx).some(b => b[3] <= z.hi && b[2] >= z.lo)) continue;   // ruszona dziś przed pierwszą świecą widoku (np. w nocy)
    if (z.hi < lo || z.lo > hi) { ncz_out++; continue; } ncz++;
    let hit = null, brk = null;
    for (let j = 0; j < cols.length; j++) { if (hit == null && cols[j].L <= z.hi && cols[j].H >= z.lo) hit = j; if (z.side > 0 ? cols[j].L < z.lo : cols[j].H > z.hi) { brk = j; break; } }
    { const nm = `${z.side > 0 ? 'kupna' : 'sprzedaży'} D-${z.back} ${z.day.slice(8)}.${z.day.slice(5, 7)} ${z.t} ×${z.n} ${z.lo}–${z.hi}`;
      if (hit != null) ev(hit, 'Strefa z poprzednich sesji', z.side, `pierwszy test strefy ${nm}`, [z.lo, z.hi]);
      if (brk != null) ev(brk, 'Strefa z poprzednich sesji', -z.side, `przebita strefa ${nm}`, [z.lo, z.hi]); }
    const col = z.side > 0 ? C.buy : C.sell, end = brk != null ? brk * CW + CW / 2 : W, gr = C.mut;
    o.push(`<g><title>Strefa z ${z.day} ${z.t}: ${z.side > 0 ? 'kupno' : 'sprzedaż'} ×${z.n} ${z.lo}–${z.hi}; nieruszona do początku wykresu${hit != null ? ', pierwszy test ' + cols[hit].t : ', dziś nietestowana'}${brk != null ? ', przebita ' + cols[brk].t + ' – po sesji znika' : ''}</title><rect x="0" y="${y(z.hi)}" width="${end}" height="${y(z.lo) - y(z.hi)}" fill="${col}" opacity=".10" stroke="${col}" stroke-width="1.4" stroke-dasharray="7 4"/>`);
    o.push(`<text x="4" y="${z.side > 0 ? y(z.lo) + 11 : y(z.hi) - 3}" font-size="10" font-weight="700" fill="${col}" paint-order="stroke" stroke="${css('--panel')}" stroke-width="3">D-${z.back} ${z.day.slice(8)}.${z.day.slice(5, 7)} ${z.t} ${z.side > 0 ? 'kupno' : 'sprzedaż'} ×${z.n} ${z.lo}–${z.hi}${hit != null ? ' → test ' + cols[hit].t : ''}</text></g>`);
  }
  LAST = {cols, CW, lo, hi, bin, RH, HEAD, H, W};
  const LEV = [], olab = [], WLAB = new Set();                          // poziomy poziome: [cena, kolor, styl, etykieta, strona etykiety]
  const firstR_ = D.boxes.findIndex(b => b[9]), rthB = D.boxes.filter(b => b[9]);
  const ds_ = Object.keys(DATA).sort(), jd = ds_.indexOf(S.day), PDk = jd > 0 ? ds_[jd - 1] : null, PDd = PDk ? DATA[PDk] : null;
  const fIdx0 = cols[0].parts ? cols[0].parts[0].idx : (cols[0].idx ?? cols[0].last);
  let gapTxt = '';
  if (S.ref) {
    { const NO = nightOf(DATA, S.day), on = NO ? NO.boxes : []; if (on.length) LEV.push([Math.max(...on.map(b => b[2])), C.ref, '6 3', 'ONH (noc)', 'L'], [Math.min(...on.map(b => b[3])), C.ref, '6 3', 'ONL (noc)', 'L']); }
    if (rthB.length >= 12) { const ib = rthB.slice(0, 12), ibh = Math.max(...ib.map(b => b[2])), ibl = Math.min(...ib.map(b => b[3])), r = ibh - ibl;
      LEV.push([ibh, C.ib, '', 'IBH', 'L'], [ibl, C.ib, '', 'IBL', 'L'], [ibh + r, C.ib, '2 4', 'IBH +1×IB', 'L'], [ibl - r, C.ib, '2 4', 'IBL −1×IB', 'L']); }
    if (PDd) { const pr = PDd.boxes.filter(b => b[9]); if (pr.length) { const m1r = (PDd.m1 || []).filter(r => r[9]), pdc = m1r.length ? m1r[m1r.length - 1][4] : pr[pr.length - 1][4], pdcA = !m1r.length; const lab = `${PDk.slice(8)}.${PDk.slice(5, 7)}`;
      LEV.push([Math.max(...pr.map(b => b[2])), C.ref, '', `PDH ${lab}`, 'L'], [Math.min(...pr.map(b => b[3])), C.ref, '', `PDL ${lab}`, 'L'], [pdc, C.ref, '1 3', `PDC ${lab}${pdcA ? ' ≈' : ''}`, 'L']);
      if (rthB.length) { const g = rthB[0][1] - pdc; gapTxt = `<span>Luka otwarcia: <b style="color:${g >= 0 ? C.buy : C.sell}">${g > 0 ? '+' : ''}${PXF(g)} pkt</b> (otwarcie ${rthB[0][1]} vs PDC ${pdc})</span>`; } } }
  }
  if (S.naked) for (let q = Math.max(0, jd - 5); q < jd; q++) {          // naked POC / VAH / VAL sesji kasowych poprzednich dni
    const P = DATA[ds_[q]], idx = P.boxes.map((b, i) => b[9] ? i : -1).filter(i => i >= 0); if (!idx.length) continue;
    const m = new Map(), S_ = new Set(idx); for (const [i, p, bid, ask] of P.cells) if (S_.has(i)) { const k = Q(Math.floor(p / TK + 1e-9) * TK); m.set(k, (m.get(k) || 0) + bid + ask); }
    const ks = [...m.keys()].sort((a, b) => a - b), vs = ks.map(k => m.get(k)), tot = vs.reduce((a, b) => a + b, 0); let pi = vs.indexOf(Math.max(...vs)), a0 = pi, a1 = pi, ac = vs[pi];
    while (ac < .7 * tot && (a0 > 0 || a1 < ks.length - 1)) { const up = a1 < ks.length - 1 ? vs[a1 + 1] : -1, dn = a0 > 0 ? vs[a0 - 1] : -1; if (up >= dn) ac += vs[++a1]; else ac += vs[--a0]; }
    const lastR = idx[idx.length - 1], lab = `${ds_[q].slice(8)}.${ds_[q].slice(5, 7)}`;
    for (const [lvl, nm] of [[ks[pi] + TK / 2, 'nPOC'], [ks[a1] + TK, 'nVAH'], [ks[a0], 'nVAL']]) {
      const tch = b => b[3] <= lvl && b[2] >= lvl;
      if (P.boxes.slice(lastR + 1).some(tch)) continue;
      let hit = false; for (let r = q + 1; r < jd && !hit; r++) hit = DATA[ds_[r]].boxes.some(tch); if (hit) continue;
      if (D.boxes.slice(0, fIdx0).some(tch)) continue;
      let end = null; for (let j = 0; j < cols.length; j++) if (cols[j].L <= lvl && cols[j].H >= lvl) { end = j; break; }
      LEV.push([lvl, nm === 'nPOC' ? C.poc : C.va, nm === 'nPOC' ? '8 3' : '3 3', `${nm} ${lab}${end != null ? ' → test ' + cols[end].t : ''}`, 'L', end != null ? end * CW + CW / 2 : null]);
    }
  }
  // ATR 5 dni: średni true range sesji kasowej z 5 poprzednich sesji w danych (H−L z uwzględnieniem zamknięcia dnia wcześniej)
  let atrTxt = '', ATRV = null, ATRB = null;
  {   // ATR 5 dni liczony zawsze (pasek w ustawieniach); linie i tekst w podsumowaniu – gdy włączone „ATR 5 dni”
    const rthHL = dk => { const P = DATA[dk], b = P.boxes.filter(x => x[9]); if (!b.length) return null; const m1 = (P.m1 || []).filter(r => r[9]); return {H: Math.max(...b.map(x => x[2])), L: Math.min(...b.map(x => x[3])), C: m1.length ? m1[m1.length - 1][4] : b[b.length - 1][4]}; };
    const trs = []; for (let q = Math.max(1, jd - 5); q < jd; q++) { const a = rthHL(ds_[q]), p = rthHL(ds_[q - 1]); if (a) trs.push(p ? Math.max(a.H - a.L, Math.abs(a.H - p.C), Math.abs(a.L - p.C)) : a.H - a.L); }
    if (trs.length >= 3) {
      const atr = trs.reduce((a, b) => a + b, 0) / trs.length, vis = cols.filter(c => c.rth), hh = vis.length ? Math.max(...vis.map(c => c.H)) : null, ll = vis.length ? Math.min(...vis.map(c => c.L)) : null;
      if (hh != null) { const used = (hh - ll) / atr * 100; ATRB = {atr, used, rng: hh - ll, n: trs.length, hh, ll};
        if (S.atr) {
          LEV.push([ll + atr, C.atr, '', `ATR5 od dołka (${PXF(ll)} + ${PXF(atr)})`, 'R'], [hh - atr, C.atr, '', `ATR5 od szczytu (${PXF(hh)} − ${PXF(atr)})`, 'R']);
          ATRV = {up: ll + atr, dn: hh - atr, atr};
          atrTxt = `<span>ATR 5 dni (sesja kasowa, ${trs.length} sesji): <b>${PXF(atr)} pkt</b> · zakres dziś <b>${PXF(hh - ll)}</b> = <b style="color:${used >= 100 ? C.hot : C.ink}">${used.toFixed(0)}% ATR</b></span>`; }
      } else ATRB = {atr, used: null, n: trs.length};
    } else if (S.atr) atrTxt = '<span>ATR 5 dni: za mało poprzednich sesji w danych</span>';
    // v1.3 typ otwarcia sesji kasowej (Dalton) – reguły jak w research/typ_otwarcia (13.11.2026); A = średni zakres sesji kasowej z ≤ 5 poprzednich sesji
    { const rngs = []; for (let q = Math.max(0, jd - 5); q < jd; q++) { const a = rthHL(ds_[q]); if (a) rngs.push(a.H - a.L); }
      const RB = D.boxes.map((b, i) => [b, i]).filter(([b]) => b && b[9] === 1), lim = Number.isFinite(RL) ? RL : D.boxes.length - 1;
      if (rngs.length >= 3 && RB.length >= 6 && RB[5][1] <= lim) {
        const A = rngs.reduce((a, b) => a + b, 0) / rngs.length, O = RB[0][0][1], f6 = RB.slice(0, 6).map(x => x[0]), f3 = f6.slice(0, 3), C30 = f6[5][4];
        const h30 = Math.max(...f6.map(b => b[2])), l30 = Math.min(...f6.map(b => b[3])), hT = Math.max(...f3.map(b => b[2])), lT = Math.min(...f3.map(b => b[3]));
        const m = C30 - O, sg = m > 0 ? 1 : -1; let t = 'OA';
        if (Math.abs(m) >= .25 * A && (sg > 0 ? l30 >= O - .10 * A : h30 <= O + .10 * A)) t = 'OD';
        else if (Math.abs(m) >= .25 * A && (sg > 0 ? lT <= O - .10 * A : hT >= O + .10 * A)) t = 'OTD';
        else if ((hT >= O + .15 * A && C30 <= O - .05 * A) || (lT <= O - .15 * A && C30 >= O + .05 * A)) t = 'ORR';
        const NM = {OD: 'open drive', OTD: 'open test drive', ORR: 'open rejection-reverse', OA: 'open auction'}, ar = t === 'OA' ? '' : sg > 0 ? ' ▲' : ' ▼';
        const ST = {OD: 'test 13.11 (14 rynków, 111 dni): po OD reszta dnia +0,03 A w stronę otwarcia – tyle co przy każdym mocnym ruchu w 30 min (−0,08 A wobec kontroli); n 25',
                    OTD: 'test 13.11: +0,17 A wobec kontroli, ale n 11 i cały wynik z jednej połowy danych – w szumie',
                    ORR: 'test 13.11: reszta dnia 0,00 A; n 15', OA: 'test 13.11: dzień rotacyjny 65% wobec 57% przy pozostałych otwarciach, zakres 0,88 wobec 1,18 A – opis'}[t];
        atrTxt += `<span title="Typ otwarcia (Dalton) z pierwszych 30 min sesji kasowej; A = ${PXF(A)} pkt (śr. zakres sesji kasowej z ${rngs.length} sesji). ${ST}">Otwarcie: <b style="color:${t === 'OA' ? C.ink : sg > 0 ? C.buy : C.sell}">${t}${ar}</b> (${NM[t]}; 30 min: ${m >= 0 ? '+' : ''}${PXF(m)} pkt = ${(m / A * 100).toFixed(0)}% A) <span class="st ${t === 'OA' ? 'stk' : 'stb'}">${t === 'OA' ? 'opis' : 'bez przewagi'}</span></span>`; } }
  }
  { // v1.9 oczekiwany zakres godziny (research/pory_dnia/atr_godzina.py, test 15.11): prognoza = średnia z (średni zakres tej godziny z 5 poprzednich dni,
    // zakres poprzedniej godziny); US500 M1 41 dób: korelacja z faktycznym +0,67, błąd mediana 28%, faktyczny/prognoza 10./90. percentyl 0,56 / 1,66 – opis, nie sygnał
    const HQ = S.hr !== false ? hrCalc(D, cols) : null;
    if (HQ) {
      const {h, hn, done, eCur, eNext, now} = HQ, f1 = v => v == null ? '–' : PXF(v).replace('.', ',');
      const band = e => e == null ? '' : ` <span class="mutd">(80%: ${f1(.56 * e)}–${f1(1.66 * e)})</span>`;
      if (!M1) { const xR = cols.length * CW + 4, xE = W - 4, cH = css('--vpk') || C.ib, lab = (yy, txt, up) => `<text x="${xE - 2}" y="${yy + (up ? -4 : 12)}" text-anchor="end" font-size="9.5" font-weight="700" fill="${cH}" paint-order="stroke" stroke="${css('--panel')}" stroke-width="3">${txt}</text>`, fp = v => (+v).toFixed(DEC);
        const hc = cols.map((c, k) => String(c.t || '').slice(0, 2) === h ? k : -1).filter(k => k >= 0), x0h = hc.length ? hc[0] * CW : xR;
        if (HQ.pmx != null) { const pmx = HQ.pmx, pmn = HQ.pmn, tp = `Godzina ${h}:00 – oczekiwany zakres ${f1(eCur)} pkt (pasmo 80%: ${f1(.56 * eCur)}–${f1(1.66 * eCur)}). Max ≈ dotychczasowy dołek godziny + oczekiwany zakres, min ≈ dotychczasowy szczyt − oczekiwany zakres; wykorzystano ${now != null ? Math.round(now / eCur * 100) : '–'}%. Mówi o wielkości ruchu, nie o kierunku. Opis, nie sygnał.`;
          o.push(`<g><title>${tp}</title><line x1="${x0h}" x2="${xE}" y1="${y(pmx)}" y2="${y(pmx)}" stroke="${cH}" stroke-width="1.4" stroke-dasharray="7 4"/><line x1="${x0h}" x2="${xE}" y1="${y(pmn)}" y2="${y(pmn)}" stroke="${cH}" stroke-width="1.4" stroke-dasharray="7 4"/>${lab(y(pmx), `${h}:00 max ≈ ${fp(pmx)}`, true)}${lab(y(pmn), `${h}:00 min ≈ ${fp(pmn)}`, false)}</g>`); }
        const cl = HQ.cl; if (HQ.nx != null) { const nx = HQ.nx, nn = HQ.nn, tp = `Następna godzina ${hn}:00 – oczekiwany zakres ${f1(eNext)} pkt (pasmo 80%: ${f1(.56 * eNext)}–${f1(1.66 * eNext)}), rozłożony symetrycznie wokół ostatniego zamknięcia ${fp(cl)}: kierunku nie prognozujemy. Opis, nie sygnał.`;
          o.push(`<g><title>${tp}</title><rect x="${xR}" y="${y(nx)}" width="${Math.max(xE - xR, 0)}" height="${Math.max(2, y(nn) - y(nx))}" fill="${cH}" fill-opacity=".07" stroke="${cH}" stroke-width="1.2" stroke-dasharray="3 3"/>${lab(y(nx), `${hn}:00 max ≈ ${fp(nx)}`, true)}${lab(y(nn), `${hn}:00 min ≈ ${fp(nn)}`, false)}</g>`); } }
      atrTxt += `<span title="Prognoza zakresu godziny = średnia z: średni zakres tej samej godziny z 5 poprzednich dni oraz zakres poprzedniej godziny. Test 15.11 (US500 M1, 41 dób): korelacja z faktycznym zakresem +0,67, mediana błędu 28%; w 80% godzin faktyczny zakres między 0,56× a 1,66× prognozy. Mówi, jak duży będzie ruch, nie czy będzie trend. Opis, nie sygnał.">Zakres godziny: <b>${h}:00</b> do teraz <b>${f1(now)}</b> z oczekiwanych <b>${f1(eCur)} pkt</b>${band(eCur)}${eCur && now != null ? ` = <b style="color:${now >= 1.66 * eCur ? C.hot : C.ink}">${Math.round(now / eCur * 100)}%</b>` : ''} · następna <b>${hn}:00</b>: <b>${f1(eNext)} pkt</b>${band(eNext)} <span class="st stk">opis</span></span>`; } }
  { const el = document.getElementById('atrBarBox');   // pasek wykorzystania ATR 5 dni w linii ustawień (widoczny także po zwinięciu panelu)
    if (el) { if (!ATRB) el.innerHTML = '<span class="atrb mutd">ATR5 –</span>';
      else { const u = ATRB.used, col = u == null ? 'var(--mut)' : u >= 100 ? 'var(--sell)' : u >= 70 ? 'var(--va)' : 'var(--buy)', f1 = v => PXF(v).replace('.', ',');
        el.innerHTML = `<span class="atrb" title="ATR 5 dni z sesji kasowych (${ATRB.n} sesji): ${f1(ATRB.atr)} pkt${u != null ? ` · zakres sesji kasowej w widoku ${f1(ATRB.rng)} pkt (${f1(ATRB.ll)}–${f1(ATRB.hh)}) = ${u.toFixed(0)}% ATR${u >= 100 ? ' – dzienny zakres już przekroczony' : ` · zostało ok. ${f1(ATRB.atr - ATRB.rng)} pkt do pełnego ATR`}` : ' · brak świec sesji kasowej w widoku'}">ATR5 <strong>${f1(ATRB.atr)}</strong> <span class="atrbar"><i style="width:${Math.min(u || 0, 100)}%;background:${col}"></i>${u > 100 ? `<i class="over" style="background:${col}"></i>` : ''}</span> <strong style="color:${col}">${u == null ? '–' : u.toFixed(0) + '%'}</strong></span>`; } } }
  const O_ = DATA[S.day].opt; let optTxt = '';
  if (S.opt) {
    if (O_) { 
      for (const [v, st, lab] of [[O_.emH, '', `EM +${O_.em}`], [O_.emL, '', `EM −${O_.em}`], [O_.F, '1 3', 'środek EM'], [O_.cw, '7 3', 'ściana calli'], [O_.pw, '7 3', 'ściana putów'], [O_.flip, '2 2', 'flip GEX'], [O_.gmin, '4 2 1 2', 'najgłębszy GEX']]) if (v != null) LEV.push([v, C.opt, st, `${lab} ${v.toFixed(0)}`, 'R']);
      // v1.3 linie zabezpieczeń animatorów (tools/hedge_lines.py): ruch o ± EM 1 DTE z każdej ceny startowej; konwencja pozycji jak w GEX (założenie)
      if (O_.asym != null) LEV.push([O_.asym, C.sell, '6 2 1 2', `linia asymetrii ${O_.asym.toFixed(0)} – pod nią spadek o EM dobijany sprzedażą animatorów`, 'R']);
      if (O_.sqz != null) LEV.push([O_.sqz, C.buy, '6 2 1 2', `linia squeeze ${O_.sqz.toFixed(0)} – pod nią wzrost o EM podbijany kupnem animatorów`, 'R']);
      const off = [O_.emH, O_.emL, O_.cw, O_.pw, O_.flip].filter(v => v != null && (v > hi || v < lo)).length;
      optTxt = `<span>Opcje DN (zrzut ${O_.snap}${O_.gex != null ? `, GEX ${O_.gex > 0 ? '+' : ''}${O_.gex} mld $` : ' – EM z łańcucha, bez GEX i ścian'})${off ? `: ${off} poziomów poza zakresem wykresu` : ''}</span>`;
      if (O_.hl) { const h = O_.hl, f2 = v => (v > 0 ? '+' : '') + v.toFixed(1).replace('.', ','), zone = LP_ => O_.asym == null ? '' : LP_ < (O_.sqz ?? -1e9) ? 'pod linią squeeze: spadki dobijane, wzrosty podbijane – ruchy się wydłużają' : LP_ < O_.asym ? 'między liniami: spadki dobijane, wzrosty gaszone' : 'nad linią asymetrii: spadki i wzrosty gaszone (dodatnia gamma)';
        optTxt += `<span title="Ile SPX musieliby kupić (+) / sprzedać (−) animatorzy, gdyby cena przeszła ± EM 1 DTE (${h.m} pkt) od środka ${(h.F + h.base).toFixed(0)}: spadek ${f2(h.f_dn)} mld $, wzrost ${f2(h.f_up)} mld $. Linia asymetrii = cena startowa, pod którą przy spadku animatorzy sprzedają (dobijają); linia squeeze = pod którą przy wzroście kupują (podbijają). Konwencja pozycji jak w GEX (kupione calle, sprzedane puty) – założenie. Status: opis, test na historii Option Edge.">Zabezpieczenia animatorów: asymetria <b style="color:${C.sell}">${O_.asym != null ? O_.asym.toFixed(0) : '–'}</b> · squeeze <b style="color:${C.buy}">${O_.sqz != null ? O_.sqz.toFixed(0) : '–'}</b> · cena ${zone(cols[cols.length - 1].C)} <span class="st stk">opis</span></span>`; } }
    else optTxt = DATA[S.day].opt0 ? '' : INST === 'US500' ? '<span>Opcje DN: brak zrzutu łańcucha SPX dla tej sesji</span>' : '<span>Opcje DN: tylko dla US500</span>';
    // v1.6 opcje w czasie (tools/opt_0dte.py): przed sesją kasową poziomy z łańcucha 1 DTE z zamknięcia poprzedniej sesji, od otwarcia – zrzuty 0 DTE co 15 min
    const O0 = DATA[S.day].opt0;
    if (O0 && cols.length) {
      const xOf = t => { const m = mmS(t), i = cols.findIndex(c => mmS(String(c.t).slice(0, 5)) >= m); return i < 0 ? null : i * CW; };
      const r0b = D.boxes.find(b => b && b[9] === 1), tR = O0.steps.length ? O0.steps[0].t : (r0b ? r0b[0] : null), xR = tR ? (xOf(tR) ?? cols.length * CW) : cols.length * CW;
      const ST0 = {emH: [C.opt, '', 'EM'], emL: [C.opt, '', 'EM'], F: [C.opt, '1 3', 'środek EM'], cw: [C.opt, '7 3', 'ściana calli (OI)'], pw: [C.opt, '7 3', 'ściana putów (OI)'], gmax: [C.opt, '4 2 1 2', 'max GEX'],
        vc: [C.buy, '2 2', 'najaktywniejszy call (wol.)'], vp: [C.sell, '2 2', 'najaktywniejszy put (wol.)'], zero: [C.ink, '6 2', 'linia zera γ×δ'], tc1: [C.buy, '1 2', 'top call γ×δ'], tp1: [C.sell, '1 2', 'top put γ×δ']};
      const seg = (v, x1, x2, key, lab, tip) => { if (v == null || v < lo || v > hi || x2 <= x1) return; const [col, dash] = ST0[key];
        ov.push(`<g><title>${tip}</title><line x1="${x1}" x2="${x2}" y1="${y(v)}" y2="${y(v)}" stroke="${col}" stroke-width="${key === 'zero' ? 1.8 : 1.5}" ${dash ? `stroke-dasharray="${dash}"` : ''} opacity=".9"/></g>`);
        if (lab) ov.push(`<text x="${x1 + 3}" y="${y(v) - 3}" font-size="9" font-weight="700" fill="${col}" paint-order="stroke" stroke="${css('--panel')}" stroke-width="3">${lab}</text>`); };
      const P0 = O0.pre;
      if (P0) for (const k of ['emH', 'emL', 'F', 'cw', 'pw', 'gmax']) seg(P0[k], 0, xR, k, `${ST0[k][2]}${k === 'emH' ? ' +' + P0.em : k === 'emL' ? ' −' + P0.em : ''} ${P0[k] != null ? P0[k].toFixed(0) : ''} · 1 DTE`, `${ST0[k][2]} ${P0[k]} – ${P0.src}`);
      O0.steps.forEach((q, i) => { const x1 = xOf(q.t); if (x1 == null) return; const nx = O0.steps[i + 1], x2 = nx ? (xOf(nx.t) ?? cols.length * CW) : cols.length * CW, pq = O0.steps[i - 1] || {};
        for (const k of ['emH', 'emL', 'cw', 'pw', 'vc', 'vp', 'zero', 'tc1', 'tp1']) { if (q[k] == null) continue;
          const lab = (k === 'emH' || k === 'emL') ? (i === 0 ? `${k === 'emH' ? '+' : '−'}1σ 0 DTE do zamkn.` : '') : (pq[k] !== q[k] ? `${ST0[k][2]} ${q[k].toFixed(0)}` : '');
          seg(q[k], x1, x2, k, lab, `${q.t} PL · 0 DTE: ${ST0[k][2]} ${q[k]}${k === 'emH' || k === 'emL' ? ` (cena SPX→US500 ${q.S} ± ${q.em} – 1σ do zamknięcia z IV ATM)` : ''}`); } });
      if (xR > 0 && xR < cols.length * CW) ov.push(`<line x1="${xR}" x2="${xR}" y1="0" y2="${H}" stroke="${C.opt}" stroke-width="1" stroke-dasharray="2 3" opacity=".7"/><text x="${xR + 3}" y="12" font-size="9.5" font-weight="700" fill="${C.opt}">0 DTE od ${tR}</text>`);
      optTxt += `<span title="${O0.note}">Opcje w czasie: przed sesją 1 DTE (${P0 ? P0.src : '–'}; EM ±${P0 ? P0.em : '–'}), od ${tR} zrzuty 0 DTE co 15 min (${O0.steps.length}) · baza US500 − SPX ${O0.basis}</span>`;
    }
  }
  // waga poziomu = ile poziomów z różnych grup leży blisko (± max(2 kroki, 4% ATR5)): poziomy dnia, naked, opcje, VA dzienna z końca widoku; ATR5 nie liczy się
  const lcN = cols[cols.length - 1], TOLW = Math.max(2 * TK, ATRB && ATRB.atr ? .04 * ATRB.atr : 0);
  const grp = lab => /^n(POC|VAH|VAL)/.test(lab) ? 'naked' : /^(EM|środek|ściana|flip|najgł)/.test(lab) ? 'opcje' : /^IB/.test(lab) ? 'IB' : /^(ON)/.test(lab) ? 'noc' : /^PD/.test(lab) ? 'D-1' : /^VA dz/.test(lab) ? 'VA' : 'inne';
  const POOL = LEV.filter(L => !/^ATR5/.test(L[3])).map(L => ({v: +L[0], lab: L[3].replace(/ → test.*$/, ''), g: grp(L[3])}));
  if (S.va && lcN.vah != null) POOL.push({v: lcN.vah, lab: 'VAH dzienna', g: 'VA'}, {v: lcN.poc, lab: 'POC dzienny', g: 'VA'}, {v: lcN.val, lab: 'VAL dzienna', g: 'VA'});
  const WGT = v => { const nb = POOL.filter(q => Math.abs(q.v - v) <= TOLW); const gs = new Set(nb.map(q => q.g)); return {w: gs.size, nb}; };
  for (const [v, col, dash, lab, side, endX] of LEV) {
    if (v < lo || v > hi) continue; const xe = endX ?? W;
    const wg = /^ATR5/.test(lab) ? {w: 1, nb: []} : WGT(+v), sw = wg.w >= 3 ? 3.4 : wg.w === 2 ? 2.4 : 1.5;
    const wt = wg.w >= 2 ? ` · waga ${wg.w} – zbieżne w ±${TOLW.toFixed(DEC)}: ${wg.nb.map(q => q.lab + ' ' + q.v.toFixed(DEC)).join(', ')}` : '';
    ov.push(`<g><title>${lab}: ${(+v).toFixed(2)}${wt}</title><line x1="0" x2="${xe}" y1="${y(v)}" y2="${y(v)}" stroke="${col}" stroke-width="${sw}" ${dash ? `stroke-dasharray="${dash}"` : ''}/></g>`);
    if (wg.w >= 2) WLAB.add(lab);
    if (endX != null && endX < W) ov.push(`<g><title>${lab}: przebity – po zakończeniu sesji znika</title><line x1="${endX}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="${C.mut}" stroke-width="1" stroke-dasharray="1 4"/><text x="${endX + 4}" y="${y(v) - 3}" font-size="9" font-weight="700" fill="${C.mut}" paint-order="stroke" stroke="${css('--panel')}" stroke-width="3">✕ przebity</text></g>`);
    olab.push(`<text x="${side === 'R' ? 150 : 4}" y="${y(v) - 3}" font-size="${wg.w >= 3 ? 11 : 9.5}" font-weight="${wg.w >= 2 ? 900 : 700}" fill="${col}" paint-order="stroke" stroke="${css('--panel')}" stroke-width="3">${wg.w >= 2 ? '★'.repeat(Math.min(wg.w, 5)) + ' ' : ''}${lab}${wg.w >= 2 ? ` · waga ${wg.w}` : ''}</text>`);
  }
  // VWAP z pasmami ±1σ, ±2σ (z footprintu: cena × wolumen na poziomach)
  let vwTxt = '', VWP = null;
  if (S.vw !== 'off') {
    const n = D.boxes.length, pv = new Float64Array(n), vv = new Float64Array(n), p2 = new Float64Array(n);
    for (const [i, p, bid, ask] of D.cells) { const v = bid + ask; pv[i] += p * v; vv[i] += v; p2[i] += p * p * v; }
    const a = S.vw === 'rth' ? firstR_ : S.vw === 'day' ? 0 : (S.vwA && S.vwA.day === S.day ? S.vwA.idx : null);
    if (a == null || a < 0) vwTxt = S.vw === 'anchor' ? '<span>VWAP: kliknij świecę na wykresie, od której ma się liczyć</span>' : '';
    else {
      let cp = 0, cv = 0, c2 = 0, j = a; const pts = [];
      cols.forEach((c, i) => { while (j <= c.last && j < n) { cp += pv[j]; cv += vv[j]; c2 += p2[j]; j++; } if (c.last < a || cv <= 0) { pts.push(null); return; } const m = cp / cv, sd = Math.sqrt(Math.max(c2 / cv - m * m, 0)); pts.push([m, sd]); });
      const path = f => { let d = '', open = false; pts.forEach((q, i) => { if (!q) { open = false; return; } const yy = y(f(q)); d += `${open ? 'L' : 'M'}${i * CW},${yy}H${(i + 1) * CW}`; open = true; }); return d; };
      for (const [k, w, dash, op] of [[2, 1, '2 3', .6], [1, 1.2, '5 3', .8], [-1, 1.2, '5 3', .8], [-2, 1, '2 3', .6]]) ov.push(`<path d="${path(q => q[0] + k * q[1])}" fill="none" stroke="${C.vwap}" stroke-width="${w}" stroke-dasharray="${dash}" opacity="${op}"/>`);
      ov.push(`<path d="${path(q => q[0])}" fill="none" stroke="${C.vwap}" stroke-width="2.6"/>`);
      VWP = pts; const lq = pts.filter(Boolean).pop();
      if (lq) { for (const [k, lab] of [[0, 'VWAP'], [1, '+1σ'], [-1, '−1σ'], [2, '+2σ'], [-2, '−2σ']]) ov.push(`<text x="${cols.length * CW + 2}" y="${y(lq[0] + k * lq[1]) + 3.5}" font-size="9.5" font-weight="700" fill="${C.vwap}" paint-order="stroke" stroke="${css('--panel')}" stroke-width="3">${lab} ${(lq[0] + k * lq[1]).toFixed(1)}</text>`);
        vwTxt = `<span>VWAP ${S.vw === 'rth' ? 'sesji kasowej' : S.vw === 'day' ? 'doby' : 'od ' + D.boxes[a][0]}: <b>${PXF(lq[0])}</b> (σ ${PXF(lq[1])} pkt)</span>`; }
      if (S.vw === 'anchor') ov.push(`<line x1="${cols.findIndex(c => c.last >= a) * CW}" x2="${cols.findIndex(c => c.last >= a) * CW}" y1="${HEAD}" y2="${HEAD + H}" stroke="${C.vwap}" stroke-width="1.5" stroke-dasharray="3 3"/>`);
    }
  }
  // wyczerpanie i absorpcja na skrajach świecy
  let nW = 0, nA = 0;
  if (S.ea && !M1) cols.forEach((c, i) => {
    const ks = [...c.lv.keys()].sort((a, b) => a - b); if (ks.length < 4 || !c.v) return;
    const top = ks[ks.length - 1], bot = ks[0], rng_ = c.H - c.L || 1, cpos = (c.C - c.L) / rng_, x0 = i * CW;
    const mark = (k, side, typ, txt) => { ev(i, typ === 'W' ? 'Wyczerpanie' : 'Absorpcja', -side, txt.replace(/^(Wyczerpanie|Absorpcja) /, '').replace(` ${c.t}`, '')); const yy = side > 0 ? y(k + bin) - 2 : y(k) + 2, col = side > 0 ? C.sell : C.buy;   // na szczycie (kupujący wyczerpani / wchłonięci) czerwony, na dołku zielony
      o.push(`<g><title>${txt}</title><rect x="${x0 + CW - 20}" y="${side > 0 ? yy - 12 : yy}" width="16" height="12" rx="2" fill="${col}"/><text x="${x0 + CW - 12}" y="${side > 0 ? yy - 3 : yy + 9}" text-anchor="middle" font-size="9" font-weight="700" fill="${css('--panel')}">${typ}</text></g>`); };
    // wyczerpanie: skrajny poziom ma ≤ 5% wolumenu POC świecy, strona agresywna na nim ≤ max(2, 2% POC), a poziom obok ma ≥ 3× więcej wolumenu (urwany handel)
    const zt = c.lv.get(top), zb = c.lv.get(bot);
    const n2t = c.lv.get(ks[ks.length - 2]).v, n2b = c.lv.get(ks[1]).v, lim = Math.max(2, .02 * c.vmax);
    if (zt.v <= .05 * c.vmax && zt.ask <= lim && n2t >= 3 * Math.max(zt.v, 1)) { nW++; mark(top, 1, 'W', `Wyczerpanie kupna na szczycie ${c.t}: poziom ${top}, bid ${zt.bid} × ask ${zt.ask} (POC świecy ${c.vmax})`); }
    if (zb.v <= .05 * c.vmax && zb.bid <= lim && n2b >= 3 * Math.max(zb.v, 1)) { nW++; mark(bot, -1, 'W', `Wyczerpanie sprzedaży na dołku ${c.t}: poziom ${bot}, bid ${zb.bid} × ask ${zb.ask} (POC świecy ${c.vmax})`); }
    // absorpcja: dwa skrajne poziomy mają ≥ 25% wolumenu świecy, delta na nich w stronę skraju (≥ 15% ich wolumenu), a zamknięcie w przeciwnej połowie świecy
    // absorpcja: w górnych (dolnych) 30% zakresu świecy jest ≥ 30% jej wolumenu, delta tam w stronę skraju (≥ 15% wolumenu pasma), a świeca zamyka się w przeciwnej połowie
    const band = up => { let v = 0, d = 0; for (const [k, z] of c.lv) if (up ? k + bin / 2 >= c.L + .7 * rng_ : k + bin / 2 <= c.L + .3 * rng_) { v += z.v; d += z.d; } return {v, d}; };
    const T = band(true), Bm = band(false);
    if (T.v >= .3 * c.v && T.d >= .15 * T.v && cpos < .5) { nA++; mark(top, 1, 'A', `Absorpcja kupna przy szczycie ${c.t}: górne 30% świecy ${fmt(T.v)} kontr. (${Math.round(T.v / c.v * 100)}% wolumenu), Δ ${T.d > 0 ? '+' : ''}${T.d}, zamknięcie w dolnej połowie`); }
    if (Bm.v >= .3 * c.v && Bm.d <= -.15 * Bm.v && cpos > .5) { nA++; mark(bot, -1, 'A', `Absorpcja sprzedaży przy dołku ${c.t}: dolne 30% świecy ${fmt(Bm.v)} kontr. (${Math.round(Bm.v / c.v * 100)}% wolumenu), Δ ${Bm.d}, zamknięcie w górnej połowie`); }
  });
  // uwięzieni traderzy (UT): w świecy i silne kupno przy szczycie – ≥ 2 poziomy w górnych 40% zakresu z ask ≥ 2 × bid i ask ≥ 10,
  // razem ≥ 15% wolumenu świecy – a w ciągu 3 kolejnych świec zamknięcie poniżej całej tej strefy (lustrzanie: sprzedaż przy dołku, zamknięcie nad strefą)
  let nUT = 0;
  if (S.trap !== false && !M1) cols.forEach((c, i) => {
    const ks = [...c.lv.keys()].sort((a, b) => a - b); if (ks.length < 3 || !c.v) return; const rng_ = c.H - c.L || 1;
    for (const side of [1, -1]) {
      const Z = ks.filter(k => { const z = c.lv.get(k), mid = k + bin / 2, inBand = side > 0 ? mid >= c.L + .6 * rng_ : mid <= c.L + .4 * rng_, agg = side > 0 ? z.ask : z.bid, opp = side > 0 ? z.bid : z.ask;
        return inBand && agg >= 10 && agg >= 2 * Math.max(opp, 1); });
      if (Z.length < 2) continue;
      const zlo = Math.min(...Z), zhi = Math.max(...Z) + bin, aggV = Z.reduce((a, k) => a + (side > 0 ? c.lv.get(k).ask : c.lv.get(k).bid), 0);
      if (Z.reduce((a, k) => a + c.lv.get(k).v, 0) < .15 * c.v) continue;
      let j = null; for (let q = i + 1; q <= Math.min(cols.length - 1, i + 3); q++) if (side > 0 ? cols[q].C < zlo : cols[q].C > zhi) { j = q; break; }
      if (j == null) continue;
      nUT++; const who = side > 0 ? 'kupujący' : 'sprzedający', col = side > 0 ? C.sell : C.buy;
      ev(j, 'Uwięzieni traderzy', -side, `uwięzieni ${who}: ${side > 0 ? 'kupno przy szczycie' : 'sprzedaż przy dołku'} świecy ${c.t} (${zlo}–${zhi}, ${side > 0 ? 'ask' : 'bid'} ${fmt(aggV)}), zamknięcie ${cols[j].t} ${side > 0 ? 'poniżej' : 'powyżej'} strefy (${cols[j].C})`, [zlo, zhi]);
      const x0 = i * CW + 2, x1 = j * CW + CW - 2;
      o.push(`<g><title>Uwięzieni ${who} – ${side > 0 ? 'silne kupno przy szczycie' : 'silna sprzedaż przy dołku'} świecy ${c.t}: poziomy ${zlo}–${zhi}, ${side > 0 ? 'ask' : 'bid'} ${fmt(aggV)} (${Math.round(Z.reduce((a, k) => a + c.lv.get(k).v, 0) / c.v * 100)}% wolumenu świecy); świeca ${cols[j].t} zamknęła się ${side > 0 ? 'poniżej' : 'powyżej'} całej strefy (${cols[j].C}). Test na 14 rynkach (2317 przypadków): bez przewagi – opis, nie sygnał.</title><rect x="${x0}" y="${y(zhi)}" width="${x1 - x0}" height="${Math.max(3, y(zlo) - y(zhi))}" fill="${col}" fill-opacity=".1" stroke="${col}" stroke-width="1.5" stroke-dasharray="3 2" rx="2"/><rect x="${x1 - 22}" y="${side > 0 ? y(zhi) - 14 : y(zlo) + 2}" width="22" height="12" rx="2" fill="${col}"/><text x="${x1 - 11}" y="${side > 0 ? y(zhi) - 5 : y(zlo) + 11}" text-anchor="middle" font-size="9" font-weight="700" fill="${css('--panel')}">UT</text></g>`);
    }
  });
  // nieefektywna agresja przy ★★ (v1.2, obserwacja z research/efektywnosc): okno 30 min (6 świec 5 min), delta ≥ 10% wolumenu w jedną stronę, cena w oknie w miejscu lub przeciwnie,
  // a przy cenie zamknięcia (± 0,25 ATR M5) leżą poziomy z ≥ 2 grup: D-1 (PDH/PDL/PDC), noc, IB, D-1 VA, VA dzienna, VWAP sesji kasowej. Definicja jak w teście – liczona zawsze na świecach 5 min.
  let nIA = 0;
  if (!M1 && INST !== 'VIX') { const B = D.boxes, n = B.length, last = Math.min(n - 1, Number.isFinite(RL) ? RL : n - 1), W = 6, dl = new Float64Array(n), vo = new Float64Array(n), pv = new Float64Array(n);
    for (const [i, p, bid, ask] of D.cells) { dl[i] += ask - bid; vo[i] += bid + ask; pv[i] += p * (bid + ask); }
    const rg = B.map(b => b ? b[2] - b[3] : NaN), atrM = B.map((_, i) => { const s = rg.slice(Math.max(0, i - 20), i).filter(Number.isFinite); return s.length >= 6 ? s.reduce((a, x) => a + x, 0) / s.length : NaN; });
    const rth = B.map((b, i) => b && b[9] ? i : -1).filter(i => i >= 0), fr = rth.length ? rth[0] : null, LV = [];
    { const ds = Object.keys(DATA).sort(), j = ds.indexOf(S.day), P = j > 0 ? DATA[ds[j - 1]] : null;
      if (P) { const pr = P.boxes.filter(b => b && b[9]); if (pr.length) LV.push(['D-1', Math.max(...pr.map(b => b[2])), 0], ['D-1', Math.min(...pr.map(b => b[3])), 0], ['D-1', pr[pr.length - 1][4], 0]);
        const S_ = new Set(P.boxes.map((b, i) => b && b[9] ? i : -1).filter(i => i >= 0)), m = new Map();
        for (const [i, p, bd, ak] of P.cells) if (S_.has(i)) { const k = Q(Math.floor(p / TK + 1e-9) * TK); m.set(k, (m.get(k) || 0) + bd + ak); }
        if (m.size) { const ks = [...m.keys()].sort((a, b) => a - b), vs = ks.map(k => m.get(k)), tot = vs.reduce((a, b) => a + b, 0); let pi = vs.indexOf(Math.max(...vs)), a0 = pi, a1 = pi, ac = vs[pi];
          while (ac < .7 * tot && (a0 > 0 || a1 < ks.length - 1)) { const up = a1 < ks.length - 1 ? vs[a1 + 1] : -1, dn = a0 > 0 ? vs[a0 - 1] : -1; if (up >= dn) ac += vs[++a1]; else ac += vs[--a0]; }
          LV.push(['D-1 VA', ks[a1] + TK, 0], ['D-1 VA', ks[pi] + TK / 2, 0], ['D-1 VA', ks[a0], 0]); } } }
    if (fr) { LV.push(['noc', Math.max(...B.slice(0, fr).map(b => b[2])), fr], ['noc', Math.min(...B.slice(0, fr).map(b => b[3])), fr]); }
    if (rth.length >= 12) { const ib = rth.slice(0, 12); LV.push(['IB', Math.max(...ib.map(i => B[i][2])), ib[11] + 1], ['IB', Math.min(...ib.map(i => B[i][3])), ib[11] + 1]); }
    const vw = new Float64Array(n).fill(NaN); if (fr != null) { let a = 0, b = 0; for (let i = fr; i < n; i++) { a += pv[i]; b += vo[i]; vw[i] = b > 0 ? a / b : NaN; } }
    const grpAt = i => { const tol = .25 * atrM[i], x0 = B[i][4], g = new Map(); for (const [nm, x, st] of LV) if (i >= st && Math.abs(x - x0) <= tol) g.set(nm, x);
      for (const x of [B[i][5], B[i][6], B[i][7]]) if (x != null && Math.abs(x - x0) <= tol) g.set('VA dzienna', x);
      if (Number.isFinite(vw[i]) && Math.abs(vw[i] - x0) <= tol) g.set('VWAP', vw[i]); return g; };
    const nxt = {k: -1, s: -1};
    for (let i = W; i <= last; i++) { if (!B[i] || !B[i - W] || !(atrM[i] > 0)) continue; let V = 0, Dl = 0; for (let q = i - W + 1; q <= i; q++) { V += vo[q]; Dl += dl[q]; } if (V <= 0) continue;
      const r = Dl / V, mv = (B[i][4] - B[i - W][4]) / atrM[i], key = r >= .10 && mv <= 0 ? 'k' : r <= -.10 && mv >= 0 ? 's' : null;
      if (!key || i < nxt[key]) continue; nxt[key] = i + W;   // bez nakładania, jak w teście (licznik okien niezależny od wagi)
      const g = grpAt(i); if (g.size < 2) continue;
      const ci = cols.findIndex(c => c.last >= i); if (ci < 0) continue; { const c0 = cols[ci], st = c0.parts && c0.parts.length ? c0.parts[0].idx : c0.idx; if (st != null && st > i) continue; } nIA++;
      ev(ci, 'Nieefektywna agresja', key === 'k' ? -1 : 1, `${key === 'k' ? 'kupno' : 'sprzedaż'} bez ruchu ceny (30 min do ${B[i][0]}): Δ ${fmt(Dl, 1)} = ${(r * 100).toFixed(0)}% wolumenu, cena ${mv >= 0 ? '+' : '−'}${Math.abs(mv).toFixed(2)} ATR M5 · przy ${[...g].map(([k, x]) => k + ' ' + x.toFixed(DEC)).join(', ')} · obserwacja z testu (13 rynków bez VIX, 14 sesji): przy ★★ cena w ciągu 30 min szła średnio +0,57 ATR M5 w stronę przeciwną do delty, 67% trafnych (n = 84); poza poziomami odwrotnie – cena szła za deltą`, B[i][4]); EV[EV.length - 1].fw = g.size; } }
  // niedokończone aukcje: na skrajnym poziomie świecy (high / low) jest wolumen po obu stronach (bid > 0 i ask > 0)
  let nua = 0, nuaOpen = 0;
  if (S.ua && !M1) cols.forEach((c, i) => {
    const ks = [...c.lv.keys()]; if (!ks.length) return;
    const kH = Math.max(...ks), kL = Math.min(...ks);
    for (const [k, side] of [[kH, 1], [kL, -1]]) {
      const z = c.lv.get(k); if (!(z.bid > 0 && z.ask > 0)) continue; nua++;
      let end = cols.length * CW, rep = null;
      for (let j = i + 1; j < cols.length; j++) { const cc = cols[j]; if (side > 0 ? cc.H >= k + bin : cc.L <= k) { const ks2 = [...cc.lv.keys()]; if (side > 0 ? Math.max(...ks2) > k : Math.min(...ks2) < k) { end = j * CW + CW / 2; rep = j; break; } } }
      if (rep == null) nuaOpen++;
      ev(i, 'Niedokończona aukcja', 0, `na ${side > 0 ? 'szczycie' : 'dołku'} ${side > 0 ? k + bin : k}${rep != null ? ` (dokończona ${cols[rep].t})` : ' – otwarta'}`);
      if (rep != null) ev(rep, 'Niedokończona aukcja', 0, `dokończona: cena przeszła ${side > 0 ? k + bin : k} (z ${c.t})`);
      const yy = side > 0 ? y(k + bin) : y(k), col = C.ua, x0 = i * CW;
      o.push(`<g><title>Niedokończona aukcja na ${side > 0 ? 'szczycie' : 'dołku'} świecy ${c.t}: poziom ${k}${bin > 1 ? '–' + (k + bin) : ''}, bid ${z.bid} × ask ${z.ask}${rep != null ? '; dokończona (cena przeszła poziom) ' + cols[rep].t : '; wciąż otwarta'}</title>`);
      o.push(`<rect x="${x0 + 9}" y="${y(k + bin)}" width="${CW - 14}" height="${RH}" fill="none" stroke="${col}" stroke-width="2" stroke-dasharray="2 2"/>`);
      o.push(`<line x1="${x0 + CW - 5}" x2="${end}" y1="${yy}" y2="${yy}" stroke="${col}" stroke-width="${rep == null ? 1.8 : 1.1}" stroke-dasharray="${rep == null ? '6 3' : '2 3'}" opacity="${rep == null ? 1 : .6}"/>`);
      o.push(`<text x="${x0 + CW - 4}" y="${side > 0 ? yy - 3 : yy + 11}" font-size="9.5" font-weight="700" fill="${col}" paint-order="stroke" stroke="${css('--panel')}" stroke-width="3">UA ${side > 0 ? '▲' : '▼'} ${side > 0 ? k + bin : k}${rep == null ? ' (otwarta)' : ''}</text></g>`);
    }
  });
  // duży wolumen przy małym zakresie („wysiłek bez wyniku”): wolumen ≥ 1,8 × średnia tej pory dnia, zakres H–L ≤ 0,6 × ATR z 20 poprzednich świec
  const EW_X = 1.8, EW_R = 0.6; let nE = 0;
  if (S.ew !== false && !M1) cols.forEach((c, i) => {
    if (c.x == null || c.x < EW_X) return;
    const prev = cols.slice(Math.max(0, i - 20), i); if (prev.length < 5) return;
    const atr = prev.reduce((a, q) => a + (q.H - q.L), 0) / prev.length, rg = c.H - c.L;
    if (!(atr > 0) || rg > EW_R * atr) return; nE++;
    let brk = null, dir = 0;
    for (let j = i + 1; j < cols.length; j++) { if (cols[j].C > c.H) { brk = j; dir = 1; break; } if (cols[j].C < c.L) { brk = j; dir = -1; break; } }
    { const dn_ = c.C < c.O || (c.C === c.O && c.d < 0); ev(i, 'DVMZ', dn_ ? -1 : 1, `wolumen ×${c.x.toFixed(1).replace('.', ',')} średniej, zakres ${+(rg).toFixed(2)} pkt (${(rg / atr).toFixed(2).replace('.', ',')} ATR), ${c.L}–${c.H}`);
      if (brk != null) ev(brk, 'DVMZ', dir, `wybicie zakresu DVMZ z ${c.t} ${dir > 0 ? 'w górę (nad ' + c.H + ')' : 'w dół (pod ' + c.L + ')'}`); }
    const x0 = i * CW, end = brk != null ? brk * CW + CW / 2 : W, col = C.ewr || css('--ewr'), f2 = v => v.toFixed(2).replace('.', ',');
    const txt = `DVMZ – duży wolumen, mały zakres ${c.t} (świeca ${c.C < c.O || (c.C === c.O && c.d < 0) ? 'spadkowa' : 'wzrostowa'}): wolumen ×${f2(c.x)} średniej tej pory, zakres ${+(rg).toFixed(2)} pkt = ${f2(rg / atr)} ATR, delta ${c.d > 0 ? '+' : ''}${c.d}` + (brk != null ? ` · pierwsze zamknięcie poza zakresem: ${dir > 0 ? 'w górę' : 'w dół'} ${cols[brk].t}` : ' · zakres jeszcze nie wybity');
    o.push(`<g><title>${txt}</title><rect x="${x0 + CW - 6}" y="${y(c.H)}" width="${Math.max(end - x0 - CW + 6, 0)}" height="${Math.max(2, y(c.L) - y(c.H))}" fill="${col}" opacity=".10"/>`
      + `<line x1="${x0 + CW - 6}" x2="${end}" y1="${y(c.H)}" y2="${y(c.H)}" stroke="${col}" stroke-width="1.2" stroke-dasharray="5 3"/><line x1="${x0 + CW - 6}" x2="${end}" y1="${y(c.L)}" y2="${y(c.L)}" stroke="${col}" stroke-width="1.2" stroke-dasharray="5 3"/>`
      + `<rect x="${x0 + 4}" y="${y(c.H) - 3}" width="${CW - 8}" height="${Math.max(2, y(c.L) - y(c.H)) + 6}" fill="none" stroke="${col}" stroke-width="2" stroke-dasharray="3 2" rx="3"/>`
      + (() => { const dn = c.C < c.O || (c.C === c.O && c.d < 0), cc = dn ? C.sell : C.buy, cx = x0 + CW / 2, cy = dn ? y(c.H) - 16 : y(c.L) + 16;   // spadek: nad świecą na czerwono, wzrost: pod świecą na zielono
          return `<ellipse cx="${cx}" cy="${cy}" rx="21" ry="10" fill="${css('--panel')}" stroke="${cc}" stroke-width="2"/><text x="${cx}" y="${cy + 3.5}" text-anchor="middle" font-size="9.5" font-weight="800" fill="${cc}">DVMZ</text>`; })()
      + (brk != null ? `<text x="${end + 3}" y="${dir > 0 ? y(c.H) - 3 : y(c.L) + 11}" font-size="9.5" font-weight="600" fill="${col}">${dir > 0 ? '▲' : '▼'} ${cols[brk].t}</text>` : '') + `</g>`);
  });
  // zones
  let nz = 0;
  // strefy z kolejnych świec, które nakładają się cenowo (ta sama strona, przerwa ≤ 2 świece), łączymy w jedną – licznik świec to informacja, nie „siła” (test 08.11.2026: bez przewagi nad losową strefą tej samej szerokości)
  const ZG = [];
  if (S.z || S.zf) cols.forEach((c, i) => imb[i].zones.forEach(zn => {
    const g = ZG.find(q => q.side === zn.side && q.last >= i - 2 && q.last < i && zn.lo < q.hi && zn.hi > q.lo) || ZG.find(q => q.side === zn.side && q.last === i && zn.lo < q.hi && zn.hi > q.lo);
    if (g) { g.lo = Math.min(g.lo, zn.lo); g.hi = Math.max(g.hi, zn.hi); if (g.last !== i) { g.boxes.push(i); g.last = i; } g.parts.push({i, lo: zn.lo, hi: zn.hi}); g.n = Math.max(g.n, zn.n); }
    else ZG.push({side: zn.side, lo: zn.lo, hi: zn.hi, n: zn.n, first: i, last: i, boxes: [i], parts: [{i, lo: zn.lo, hi: zn.hi}]});
  }));
  if (S.z) ZG.forEach(zn => {
    nz++;
    let hit = null, brk = null;
    for (let j = zn.last + 1; j < cols.length; j++) { if (hit == null && cols[j].L <= zn.hi && cols[j].H >= zn.lo) hit = j; if (zn.side > 0 ? cols[j].L < zn.lo : cols[j].H > zn.hi) { brk = j; break; } }
    { const nm = zn.side > 0 ? 'kupna' : 'sprzedaży', rg_ = `${zn.lo}–${zn.hi}`;
      ev(zn.first, 'Strefa imbalansów', zn.side, `nowa strefa ${nm} ×${zn.n} ${rg_}${zn.boxes.length > 1 ? ` (połączona z ${zn.boxes.length} świec)` : ''}`, [zn.lo, zn.hi]);
      if (hit != null) ev(hit, 'Strefa imbalansów', zn.side, `pierwszy test strefy ${nm} ${rg_} (z ${cols[zn.first].t})`, [zn.lo, zn.hi]);
      if (brk != null) ev(brk, 'Strefa imbalansów', -zn.side, `przebita strefa ${nm} ${rg_} (z ${cols[zn.first].t})`, [zn.lo, zn.hi]); }
    const col = zn.side > 0 ? C.buy : C.sell, x0 = zn.first * CW, xl = zn.last * CW, end = brk != null ? brk * CW + CW / 2 : W, nb = zn.boxes.length;
    const zg = new Set(POOL.filter(q => q.v >= zn.lo - TOLW && q.v <= zn.hi + TOLW).map(q => q.g)), zw = zg.size, dim = S.zDim !== false && zw < 2;   // waga strefy = różne grupy poziomów przy niej; test 11.11: bez ★★ brak przewagi nad losową strefą
    o.push(`<g opacity="${dim ? .38 : 1}"><rect x="${x0 + CW - 6}" y="${y(zn.hi)}" width="${Math.max(end - x0 - CW + 6, 0)}" height="${y(zn.lo) - y(zn.hi)}" fill="${col}" opacity="${dim ? .08 : .14}" stroke="${col}" stroke-dasharray="4 3" stroke-width="${dim ? .6 : 1}"/>`);
    for (const pt of zn.parts) o.push(`<rect x="${pt.i * CW + 7}" y="${y(pt.hi)}" width="${CW - 12}" height="${y(pt.lo) - y(pt.hi)}" fill="none" stroke="${col}" stroke-width="${dim ? 1.4 : 2.4}" rx="2"/>`);
    const tip = `${zn.side > 0 ? 'Strefa kupna' : 'Strefa sprzedaży'} ${zn.lo}–${zn.hi}${nb > 1 ? ` · połączona z ${nb} świec (${zn.boxes.map(b => cols[b].t).join(', ')})` : ''}${hit != null ? ` · pierwszy test ${cols[hit].t}` : ''} · ${zw >= 2 ? `przy poziomach ${[...zg].join(', ')} (★★): w teście 11.11 utrzymanie ok. 3 pp lepsze niż losowa strefa` : `bez poziomu ★★ w pobliżu${zw ? ' (tylko ' + [...zg].join(', ') + ')' : ''}: w teście 11.11 bez przewagi nad losową strefą tej samej szerokości`}`;
    o.push(`<text x="${xl + CW - 4}" y="${zn.side > 0 ? y(zn.lo) + 11 : y(zn.hi) - 3}" font-size="10" font-weight="600" fill="${col}"><title>${tip}</title>${zw >= 2 ? '★'.repeat(Math.min(zw, 5)) + ' ' : ''}${zn.side > 0 ? 'kupno' : 'sprzedaż'} ×${zn.n}${nb > 1 ? ` · ${nb} ${nb % 10 >= 2 && nb % 10 <= 4 && (nb % 100 < 12 || nb % 100 > 14) ? 'świece' : 'świec'}` : ''} ${zn.lo}–${zn.hi}${hit != null ? ' → test ' + cols[hit].t : ''}</text></g>`);
  });

  // v1.3 odwrócone strefy (research/imb_flip, test 11.11): strefa kupna – pierwsza późniejsza świeca zamyka się PONIŻEJ strefy (złamanie),
  // potem pierwszy powrót ceny do dołu strefy od spodu (retest) – w ujęciu „klasycznym” strefa ma być teraz oporem; lustrzanie strefa sprzedaży.
  // Test (12 rynków, 15.10–11.11, n 8649, kontrola: losowy przedział tej samej szerokości): odwrócenie trzyma 65,6% wobec 66,8% – bez przewagi;
  // z deltą świecy retestu w stronę odwrócenia 71,9% wobec 71,0% (+0,9 pp, w szumie) – obserwacja na nowych sesjach.
  let nZF = 0;
  if (S.zf && !M1) ZG.forEach(zn => {
    const s = zn.side; let j = null, k = null;
    for (let q = zn.last + 1; q < cols.length; q++) if (s > 0 ? cols[q].C < zn.lo : cols[q].C > zn.hi) { j = q; break; }
    if (j == null) return;
    for (let q = j + 1; q < cols.length; q++) if (s > 0 ? cols[q].H >= zn.lo : cols[q].L <= zn.hi) { k = q; break; }
    nZF++; const nm = s > 0 ? 'kupna' : 'sprzedaży', rg_ = `${zn.lo}–${zn.hi}`, col = s > 0 ? C.sell : C.buy, role = s > 0 ? 'opór' : 'wsparcie';
    const dk = k != null ? cols[k].d : null, dOk = dk != null && dk * -s > 0;
    ev(j, 'Odwrócona strefa', -s, `złamana strefa ${nm} ${rg_} (z ${cols[zn.first].t}): zamknięcie ${cols[j].t} ${s > 0 ? 'poniżej' : 'powyżej'} (${cols[j].C}) – w ujęciu klasycznym teraz ${role}`, [zn.lo, zn.hi]);
    if (k != null) ev(k, 'Odwrócona strefa', -s, `retest odwróconej strefy ${nm} ${rg_} od ${s > 0 ? 'dołu' : 'góry'}, Δ świecy ${dk > 0 ? '+' : ''}${dk}${dOk ? ' (w stronę odwrócenia)' : ' (przeciw odwróceniu)'} · test 11.11: bez przewagi; z deltą w stronę odwrócenia +0,9 pp nad kontrolą (w szumie)`, [zn.lo, zn.hi]);
    const x0 = j * CW + 2, x1 = k != null ? k * CW + CW - 2 : W, top = y(zn.hi), h = Math.max(3, y(zn.lo) - y(zn.hi));
    const tip = `Odwrócona strefa ${nm} ${rg_} (powstała ${cols[zn.first].t}): złamana zamknięciem ${cols[j].t} ${s > 0 ? 'poniżej' : 'powyżej'} strefy; ${k != null ? `retest ${cols[k].t} od ${s > 0 ? 'dołu' : 'góry'}, delta świecy retestu ${dk > 0 ? '+' : ''}${dk}` : 'bez retestu (jeszcze)'}. Test 11.11 (12 rynków, 8649 przypadków, kontrola: losowy przedział tej samej szerokości): odwrócenie trzyma 65,6% wobec 66,8% – bez przewagi; z deltą retestu w stronę odwrócenia 71,9% wobec 71,0% – w szumie, obserwacja.`;
    o.push(`<g><title>${tip}</title><rect x="${x0}" y="${top}" width="${Math.max(x1 - x0, 0)}" height="${h}" fill="${col}" fill-opacity=".06" stroke="${col}" stroke-width="1.3" stroke-dasharray="1.5 3"/>`
      + `<text x="${x0 + 2}" y="${s > 0 ? y(zn.lo) + 11 : top - 3}" font-size="9.5" font-weight="700" fill="${col}" paint-order="stroke" stroke="${css('--panel')}" stroke-width="3">ODW ${s > 0 ? '▼' : '▲'} ${rg_}</text>`
      + (k != null ? `<text x="${k * CW + CW / 2}" y="${s > 0 ? top - 4 : y(zn.lo) + 12}" text-anchor="middle" font-size="11" font-weight="800" fill="${col}" paint-order="stroke" stroke="${css('--panel')}" stroke-width="3">${dOk ? '✕Δ' : '✕'}</text>` : '') + `</g>`);
  });
  // v1.8 Order Block i FVG (research/szczyty/ob_fvg_test.py, test 15.11, 13 rynków, 18 dni; reguły zamrożone przed liczeniem) – na świecach interwału wykresu.
  // FVG byczy: świece a, b, c, L[c] > H[a], szerokość ≥ 0,03·A (A = mediana zakresu doby z 5 poprzednich dób); strefa [H[a], L[c]] od zamknięcia c.
  // OB byczy: ostatnia świeca spadkowa j przed impulsem (w ≤ 3 świecach zamknięcie ≥ H[j] + 0,25·A, bez innej spadkowej po drodze); strefa [L[j], O[j]].
  // Lustrzanie niedźwiedzie. Strefa żyje do pierwszego powrotu (dotknięcie bliższej krawędzi); „przebita” = zamknięcie za dalszą krawędzią przed odejściem 0,1·A.
  // Footprint: FVG – ≥ 3 kolejne nierównowagi diagonalne w stronę strefy w świecy b; OB – w świecy j delta przeciw jej kolorowi (absorpcja) lub takie nierównowagi.
  if ((S.ob !== false || S.fvg) && !M1) {
    const dsA = Object.keys(DATA).sort(), jA = dsA.indexOf(S.day), rgA = dsA.slice(Math.max(0, jA - 5), jA).map(k => { const bx = DATA[k].boxes.filter(Boolean); return bx.length ? Math.max(...bx.map(b => b[2])) - Math.min(...bx.map(b => b[3])) : null; }).filter(v => v).sort((a, b) => a - b);
    const A_ = rgA.length >= 3 ? rgA[Math.floor(rgA.length / 2)] : null, est = String(D.src || '').startsWith('M1 (footprint szacowany');
    if (D._stp == null) { const ps = [...new Set(D.cells.map(c => c[1]))].sort((a, b) => a - b), df = []; for (let k = 1; k < ps.length; k++) df.push(+(ps[k] - ps[k - 1]).toFixed(8)); df.sort((a, b) => a - b); D._stp = df.length ? df[Math.floor(df.length / 2)] : TK; }
    const bxs = c => c.parts ? c.parts.map(q => q.idx) : [c.last ?? c.idx].filter(v => v != null);
    const stk = (c, sd) => { if (est) return false; const st = D._stp; for (const e of bxs(c)) { const lv = boxLv(e), ks = Object.keys(lv).map(Number).sort((a, b) => a - b), at = k => { for (const q of ks) if (Math.abs(q - k) < st / 2) return lv[q]; return null; };
        let run = 0; for (const k of ks) { const z = lv[k], nb = at(k - sd * st), ok = !!nb && (sd > 0 ? z[1] >= 2 && z[1] >= 3 * nb[0] : z[0] >= 2 && z[0] >= 3 * nb[1]); run = ok ? run + 1 : 0; if (run >= 3) return true; } } return false; };
    const TFn = S.tf, ZN = [];
    if (A_) {
      if (S.fvg) for (let j = 0; j + 2 < cols.length; j++) for (const sd of [1, -1]) { const a = cols[j], b = cols[j + 1], c = cols[j + 2], lo = sd > 0 ? a.H : c.H, hi = sd > 0 ? c.L : a.L;
        if (hi - lo >= .03 * A_) ZN.push({typ: 'FVG', sd, lo, hi, act: j + 2, src: j + 1, fp: stk(b, sd)}); }
      if (S.ob !== false) for (let j = 0; j + 1 < cols.length; j++) for (const sd of [1, -1]) { const c = cols[j]; if (!(sd > 0 ? c.C < c.O : c.C > c.O)) continue;
        for (let k = j + 1; k <= Math.min(cols.length - 1, j + 3); k++) { const q = cols[k];
          if (sd > 0 ? q.C < q.O : q.C > q.O) break;
          if (sd > 0 ? q.C >= c.H + .25 * A_ : q.C <= c.L - .25 * A_) { const lo = sd > 0 ? c.L : c.O, hi = sd > 0 ? c.O : c.H;
            if (hi - lo >= .03 * A_) ZN.push({typ: 'OB', sd, lo, hi, act: k, src: j, fp: !est && ((sd * (c.d || 0) > 0) || stk(c, sd))}); break; } } }
    }
    const stat = z => z.typ === 'OB' ? (TFn === 'M15' ? 'zbieranie danych – test 15.11 na M15: +0,04R po kosztach vs −0,30R dla losowej strefy w nodze impulsu (n 51, połowy +0,08/−0,11); z footprintem +0,12R (n 32)' : `bez przewagi – test 15.11 na M5: −0,26R vs kontrola −0,31R (n 48)${TFn !== 'M5' ? '; na tym interwale nie testowane' : ''}`)
      : `bez przewagi – test 15.11: M5 −0,20R vs kontrola −0,21R (n 2514), M15 −0,19R vs −0,24R (n 1123), 45–55% przebitych przy pierwszym powrocie; z footprintem M15 +0,10R lepiej, nadal −0,15R${['M5', 'M15'].includes(TFn) ? '' : '; na tym interwale nie testowane'}`;
    for (const z of ZN) { const near = z.sd > 0 ? z.hi : z.lo, far = z.sd > 0 ? z.lo : z.hi; let hit = null, brk = null;
      for (let q = z.act + 1; q < cols.length; q++) if (z.sd > 0 ? cols[q].L <= near : cols[q].H >= near) { hit = q; break; }
      if (hit != null) for (let q = hit; q < Math.min(cols.length, hit + 13); q++) { if (z.sd > 0 ? cols[q].C < far : cols[q].C > far) { brk = q; break; } if (z.sd > 0 ? cols[q].H >= near + .1 * A_ : cols[q].L <= near - .1 * A_) break; }
      const col = z.sd > 0 ? C.buy : C.sell, nm = `${z.typ} ${z.sd > 0 ? '▲ popyt' : '▼ podaż'}`, rg_ = `${(+z.lo).toFixed(DEC)}–${(+z.hi).toFixed(DEC)}`, fpT = z.fp ? ' · footprint ✚' : '';
      ev(z.act, z.typ === 'OB' ? 'Order Block' : 'FVG', z.sd, `nowy ${nm} ${rg_} (świeca ${cols[z.src].t})${fpT}`, [z.lo, z.hi]);
      if (hit != null) ev(hit, z.typ === 'OB' ? 'Order Block' : 'FVG', brk != null ? -z.sd : z.sd, `pierwszy powrót do ${nm} ${rg_} (z ${cols[z.src].t})${fpT} · ${brk != null ? `przebita ${cols[brk].t}` : hit + 12 < cols.length ? 'utrzymana' : 'w toku'}`, [z.lo, z.hi]);
      const x0 = z.act * CW + CW - 4, x1 = hit != null ? hit * CW + CW / 2 : W, top = y(z.hi), h = Math.max(3, y(z.lo) - y(z.hi)), ob = z.typ === 'OB';
      const tip = `${z.typ === 'OB' ? 'Order Block' : 'FVG (luka wartości)'} ${z.sd > 0 ? 'popytu' : 'podaży'} ${rg_} z ${cols[z.src].t}${z.fp ? ' · footprint ✚ (' + (ob ? 'absorpcja lub ułożone nierównowagi w świecy OB' : 'ułożone nierównowagi w świecy impulsu') + ')' : ''}${est ? ' · footprint szacowany – bez oceny' : ''}. ${hit != null ? `Pierwszy powrót ${cols[hit].t}${brk != null ? `, przebita ${cols[brk].t}` : ''}.` : 'Bez powrotu (jeszcze).'} Status: ${stat(z)}. Opis, nie sygnał.`;
      o.push(`<g><title>${tip}</title><rect x="${x0}" y="${top}" width="${Math.max(x1 - x0, 0)}" height="${h}" fill="${col}" fill-opacity="${ob ? .12 : .07}" stroke="${col}" stroke-width="${ob ? 1.6 : 1.1}" stroke-dasharray="${ob ? '' : '4 3'}"/>`
        + `<text x="${x0 + 3}" y="${z.sd > 0 ? y(z.lo) + 11 : top - 3}" font-size="9.5" font-weight="700" fill="${col}" paint-order="stroke" stroke="${css('--panel')}" stroke-width="3">${z.typ}${z.fp ? '✚' : ''} ${z.sd > 0 ? '▲' : '▼'}</text>`
        + (hit != null ? `<text x="${hit * CW + CW / 2}" y="${z.sd > 0 ? y(z.lo) + 12 : top - 4}" text-anchor="middle" font-size="11" font-weight="800" fill="${col}" paint-order="stroke" stroke="${css('--panel')}" stroke-width="3">${brk != null ? '✕' : '◆'}</text>` : '') + `</g>`); }
  }
  // v1.9 sygnały VA → POC (W1 / W2, flaga klatki LVN) i P1 (z agresją) – na świecach 5 min doby, rysowane w kolumnie interwału wykresu
  if (S.vp !== false && !M1) { const A_ = vpA(DATA, S.day), SG = vpDay(D, A_), colOf = bi => cols.findIndex(c => c.parts ? c.parts.some(q => q.idx === bi) : c.idx === bi);
    for (const g of SG) { const ci = colOf(g.j0 === g.i ? g.i : Math.min(g.j0, D.boxes.length - 1)), cx = g.jx != null ? colOf(g.jx) : -1; if (ci < 0) continue;
      if (g.typ === 'P1' && !g.agr) continue;   // P1 bez agresji – bez przewagi, nie pokazujemy
      const nm = g.typ === 'P1' ? `P1 ${g.s > 0 ? 'long' : 'short'} od POC → ${g.s > 0 ? 'VAH' : 'VAL'}` : `${g.typ} ${g.s > 0 ? 'long od VAL' : 'short od VAH'} → POC`, f_ = v => (+v).toFixed(DEC);
      const sp = vpSpread(INST, g.t, g.rth), pk = sp != null ? ` (${(g.res - sp) >= 0 ? '+' : ''}${(g.res - sp).toFixed(1).replace('.', ',')} pkt po spreadzie)` : '';
      const wyn = g.jx != null ? `cel ${cx >= 0 ? cols[cx].t : ''} +${(g.res).toFixed(DEC)}${pk}` : (g.jx == null && D.boxes.length && cols.length && cols.at(-1).last >= D.boxes.length - 2 ? `nietrafiony – koniec doby ${g.res >= 0 ? '+' : ''}${g.res.toFixed(DEC)}${pk}` : 'w toku');
      const flag = (g.typ === 'P1' ? 'agresja ✚' : g.kl ? 'klatka LVN ✔' : 'bez klatki') + (g.o90 ? ' · pierwsze 90 min sesji (W1: duże obsunięcia 2× częstsze)' : '');
      ev(ci, 'VA → POC', g.s, `${nm} · wejście ${f_(g.e)}, cel ${f_(g.tg)} · ${flag} · ${wyn} · MAE ${(g.mae).toFixed(2).replace('.', ',')}·A`, g.e);
      const col = g.kl || g.agr ? css('--vpk') || C.ib : C.mut, x0 = ci * CW + CW / 2, x1 = cx >= 0 ? cx * CW + CW / 2 : W - 4, strong = !!(g.kl || g.agr);
      const tip = `${nm}: wejście ${f_(g.e)} (${g.t}), cel ${f_(g.tg)}; ${flag}; ${wyn}; MAE ${g.mae.toFixed(2)}·A. Test 15.11 (13 rynków, 18 dni): W1 z klatką LVN +0,052·A na transakcję, US500 +8,3 pkt (n 45), najgorsza −18,5 pkt – obserwacja; W1 bez klatki ok. zera; P1 z agresją – zbieranie danych. Bez stopu: nietrafiona = pozycja do hedgu. Opis, nie sygnał.`;
      o.push(`<g opacity="${strong ? 1 : .45}"><title>${tip}</title><line x1="${x0}" x2="${x1}" y1="${y(g.e)}" y2="${y(g.tg)}" stroke="${col}" stroke-width="${strong ? 1.8 : 1.1}" stroke-dasharray="5 3"/>`
        + `<path d="M${x0 - 6},${y(g.e) + (g.s > 0 ? 9 : -9)} L${x0 + 6},${y(g.e) + (g.s > 0 ? 9 : -9)} L${x0},${y(g.e)} Z" fill="${col}" stroke="${css('--panel')}" stroke-width="1"/>`
        + `<text x="${x0 + 8}" y="${y(g.e) + (g.s > 0 ? 16 : -10)}" font-size="9.5" font-weight="700" fill="${col}" paint-order="stroke" stroke="${css('--panel')}" stroke-width="3">${g.typ}${g.kl ? ' ⊡' : g.agr ? ' ✚' : ''}</text>`
        + (cx >= 0 ? `<circle cx="${x1}" cy="${y(g.tg)}" r="3.5" fill="${col}"/>` : '') + `</g>`); } }
  // potwierdzenie wybicia w interwałach 5 / 15 / 30 / 60 min kończących się na świecy wybicia (ze świec M5 i footprintu):
  // delta w stronę wybicia ≥ 10% wolumenu interwału i wolumen ≥ 1,2 × średnia tej pory dnia z 5 sesji (suma średnich świec M5 interwału)
  const BV = new Array(D.boxes.length).fill(0), BD = new Array(D.boxes.length).fill(0);
  for (const c of D.cells) { BV[c[0]] += c[2] + c[3]; BD[c[0]] += c[3] - c[2]; }
  const IVS = [5, 15, 30, 60];
  const confirm = (i, dir) => { const c = cols[i], e = c.parts ? c.parts[c.parts.length - 1].idx : (c.last ?? c.idx);
    if (e == null || c.m1) return '✖ brak danych M5 do oceny';
    const rs = IVS.map(w => { const a = Math.max(0, e - w / 5 + 1); let v = 0, d = 0, av = 0, ok = true;
      for (let k = a; k <= e; k++) { v += BV[k]; d += BD[k]; const x = D.boxes[k] && D.boxes[k][8]; if (x > 0) av += BV[k] / x; else ok = false; }
      const dOk = v > 0 && dir * d >= .1 * v, xr = ok && av > 0 ? v / av : null, vOk = xr != null && xr >= 1.2;
      return {w, d, v, xr, dOk, vOk, k: dOk && vOk ? '✔' : dOk || vOk ? '◐' : '✖'}; });
    const nOk = rs.filter(r => r.k === '✔').length, nAny = rs.filter(r => r.k !== '✖').length;
    const head = nOk >= 3 ? '✔ potwierdzone' : nAny >= 2 ? '◐ częściowo' : '✖ bez potwierdzenia';
    return `${head} – ` + rs.map(r => `${r.w}′ ${r.k} Δ ${r.d > 0 ? '+' : ''}${fmt(r.d)} (${r.v ? Math.round(r.d / r.v * 100) : 0}%) wol ${r.xr != null ? '×' + r.xr.toFixed(1).replace('.', ',') : '–'}`).join(' | '); };
  // agresja przy wybiciu (test 15.11, 13 rynków, 2550 wybić: range nocny w sesji kasowej, knot H1, LVN 60′) – na świecy 5 min, w której pada zamknięcie
  // (ostatnia świeca M5 kolumny), na poziomach flexu w natywnym kroku ceny: M1 = nierównowag diagonalnych ≥ 3:1 (min. 2) w stronę wybicia za poziomem
  // więcej niż przeciwnych; M2 = ≥ 3 kolejne poziomy z nierównowagą diagonalną w stronę wybicia w tej świecy
  if (D._stp == null) { const ps = [...new Set(D.cells.map(c => c[1]))].sort((a, b) => a - b), df = []; for (let k = 1; k < ps.length; k++) df.push(+(ps[k] - ps[k - 1]).toFixed(8)); df.sort((a, b) => a - b); D._stp = df.length ? df[Math.floor(df.length / 2)] : TK; }
  const aggr = (i, lvl, dir) => { const c = cols[i], e = c.parts ? c.parts[c.parts.length - 1].idx : (c.last ?? c.idx);
    if (e == null || c.m1 || String(D.src || '').startsWith('M1 (footprint szacowany')) return null;
    const lv = boxLv(e), st = D._stp, ks = Object.keys(lv).map(Number).sort((a, b) => a - b), at = k => { for (const q of ks) if (Math.abs(q - k) < st / 2) return lv[q]; return null; };
    const im = (k, sd) => { const z = lv[k]; if (sd > 0) { const b = at(k - st); return !!b && z[1] >= 2 && z[1] >= 3 * b[0]; } const a = at(k + st); return !!a && z[0] >= 2 && z[0] >= 3 * a[1]; };
    const bey = ks.filter(k => dir > 0 ? k > lvl : k < lvl), m1 = bey.filter(k => im(k, dir)).length > bey.filter(k => im(k, -dir)).length;
    let run = 0, mx = 0; for (const k of ks) { run = im(k, dir) ? run + 1 : 0; mx = Math.max(mx, run); }
    return {m1, m2: mx >= 3}; };
  const agTxt = a => a == null ? '' : ` · agresja ${a.m1 || a.m2 ? '✚' : '–'} M1 ${a.m1 ? 'tak' : 'nie'} / M2 ${a.m2 ? 'tak' : 'nie'}`;
  const follow = (i, lvl, dir) => { for (let j = i + 1; j <= Math.min(cols.length - 1, i + 6); j++) if (dir > 0 ? cols[j].C < lvl : cols[j].C > lvl) return ` · powrót ${cols[j].t} (fałszywe)`; return cols.length - 1 >= i + 6 ? ' · utrzymane 6 świec' : ' · w toku'; };
  // wybicia poziomów odniesienia (zamknięcie świecy za poziomem): PDH/PDL, ONH/ONL, IBH/IBL, VAH/VAL/POC sesji kasowej D-1
  { const ci = c => c.parts ? c.parts[c.parts.length - 1].idx : (c.last ?? c.idx), L_ = [];
    const NO_ = nightOf(DATA, S.day), on = NO_ ? NO_.boxes : [], sR = cols.findIndex(c => ci(c) >= firstR_ && firstR_ >= 0);
    if (on.length && sR >= 0) L_.push([Math.max(...on.map(b => b[2])), 'ONH', sR], [Math.min(...on.map(b => b[3])), 'ONL', sR]);
    if (rthB.length >= 12) { const ib = rthB.slice(0, 12), sI = cols.findIndex(c => ci(c) > firstR_ + 11); if (sI >= 0) L_.push([Math.max(...ib.map(b => b[2])), 'IBH', sI], [Math.min(...ib.map(b => b[3])), 'IBL', sI]); }
    if (PDd) { const pr = PDd.boxes.filter(b => b[9]), lab = `${PDk.slice(8)}.${PDk.slice(5, 7)}`;
      if (pr.length) { L_.push([Math.max(...pr.map(b => b[2])), `PDH ${lab}`, 0], [Math.min(...pr.map(b => b[3])), `PDL ${lab}`, 0]);
        const S_ = new Set(PDd.boxes.map((b, i) => b[9] ? i : -1).filter(i => i >= 0)), m = new Map(); for (const [i, p, bd, ak] of PDd.cells) if (S_.has(i)) { const k = Q(Math.floor(p / TK + 1e-9) * TK); m.set(k, (m.get(k) || 0) + bd + ak); }
        const ks = [...m.keys()].sort((a, b) => a - b), vs = ks.map(k => m.get(k)), tot = vs.reduce((a, b) => a + b, 0);
        if (ks.length) { let pi = vs.indexOf(Math.max(...vs)), a0 = pi, a1 = pi, ac = vs[pi]; while (ac < .7 * tot && (a0 > 0 || a1 < ks.length - 1)) { const up = a1 < ks.length - 1 ? vs[a1 + 1] : -1, dn = a0 > 0 ? vs[a0 - 1] : -1; if (up >= dn) ac += vs[++a1]; else ac += vs[--a0]; }
          L_.push([ks[a1] + TK, `VAH D-1 kas. ${lab}`, 0], [ks[pi] + TK / 2, `POC D-1 kas. ${lab}`, 0], [ks[a0], `VAL D-1 kas. ${lab}`, 0]); } } }
    for (const [lvl, nm, st] of L_) for (let i = Math.max(1, st); i < cols.length; i++) { const pc = cols[i - 1].C, cc = cols[i].C, fl = v => (+v).toFixed(DEC);
      for (const dir of [1, -1]) if (dir > 0 ? (pc <= lvl && cc > lvl) : (pc >= lvl && cc < lvl)) { const a = aggr(i, lvl, dir);
        ev(i, 'Wybicie poziomu', dir, `wybicie w ${dir > 0 ? 'górę' : 'dół'} ${nm} ${fl(lvl)} (zamkn. ${cc}) · ${confirm(i, dir)}${agTxt(a)}${follow(i, lvl, dir)}`, lvl);
        if (EV.length && EV[EV.length - 1].i === i) EV[EV.length - 1].ag = a ? (a.m1 || a.m2) : null; } } }
  // VWAP i pasma: zamknięcie po drugiej stronie linii (wartość VWAP z końca każdej świecy)
  if (VWP) for (const [k, nm] of [[0, 'VWAP'], [1, '+1σ'], [-1, '−1σ'], [2, '+2σ'], [-2, '−2σ']]) for (let i = 1; i < cols.length; i++) { const a = VWP[i - 1], b = VWP[i]; if (!a || !b) continue;
    const la = a[0] + k * a[1], lb = b[0] + k * b[1], pc = cols[i - 1].C, cc = cols[i].C, lab = k ? `pasmo VWAP ${nm}` : 'VWAP';
    if (pc <= la && cc > lb) ev(i, 'VWAP', 1, `zamknięcie nad ${lab} ${lb.toFixed(DEC)} (${cc}) · ${confirm(i, 1)}${follow(i, lb, 1)}`, lb);
    if (pc >= la && cc < lb) ev(i, 'VWAP', -1, `zamknięcie pod ${lab} ${lb.toFixed(DEC)} (${cc}) · ${confirm(i, -1)}${follow(i, lb, -1)}`, lb); }
  // naked POC / VAH / VAL (pierwszy test) i poziomy z opcji DN (wybicie zamknięciem) – z poziomów na wykresie
  for (const L of LEV) { const [lvl, col_, , lab] = L, fl = (+lvl).toFixed(DEC);
    if (/^n(POC|VAH|VAL)/.test(lab)) { const nm = lab.replace(/ → test.*$/, ''); for (let j = 0; j < cols.length; j++) if (cols[j].L <= lvl && cols[j].H >= lvl) { ev(j, 'Naked POC / VA', cols[j].O > lvl ? 1 : -1, `pierwszy test ${nm} ${fl} (cena przyszła z ${cols[j].O > lvl ? 'góry – możliwe wsparcie' : 'dołu – możliwy opór'})`, lvl); break; } }
    else if (col_ === C.opt) for (let i = 1; i < cols.length; i++) { const pc = cols[i - 1].C, cc = cols[i].C;
      if (pc <= lvl && cc > lvl) ev(i, 'Opcje', 1, `zamknięcie nad ${lab} (${cc}) · ${confirm(i, 1)}${follow(i, lvl, 1)}`, lvl);
      if (pc >= lvl && cc < lvl) ev(i, 'Opcje', -1, `zamknięcie pod ${lab} (${cc}) · ${confirm(i, -1)}${follow(i, lvl, -1)}`, lvl); } }
  // HVN / LVN profilu narastającego: nowy HVN (nie zachodzi na żaden z poprzedniej świecy) i zamknięcie w strefie LVN
  if (DNN) { const inR = (v, R) => R.find(([a, b]) => v >= a && v <= b);
    cols.forEach((c, i) => { if (!i) return; const nd = DNN[c.last], pd = DNN[cols[i - 1].last]; if (!nd || !pd) return;
      for (const [a, b] of nd.hvn) if (!pd.hvn.some(([x, y_]) => a <= y_ && b >= x)) ev(i, 'HVN / LVN', 0, `nowy HVN w profilu dnia ${a}–${b} (cena ${c.C} ${c.C > b ? 'nad' : c.C < a ? 'pod' : 'w'} nim)`);
      const z = inR(c.C, nd.lvn); if (z && !inR(cols[i - 1].C, pd.lvn)) ev(i, 'HVN / LVN', c.C > cols[i - 1].C ? 1 : -1, `zamknięcie w LVN ${z[0]}–${z[1]} (${c.C}) – obszar małego wolumenu między HVN`); }); }
  // delta skumulowana (acc Δ, jak w nagłówku wykresu): zmiana znaku z + na − i z − na +
  cols.forEach((c, i) => { if (!i || c.acc == null || cols[i - 1].acc == null) return; const pa = cols[i - 1].acc, ca = c.acc, dp = c.C - cols[i - 1].C;
    if ((pa >= 0 && ca < 0) || (pa <= 0 && ca > 0 && pa !== ca)) ev(i, 'Delta acc', ca > 0 ? 1 : -1, `acc Δ z ${pa > 0 ? '+' : pa < 0 ? '−' : '0'} na ${ca > 0 ? '+' : '−'}: ${fmt(pa, 1)} → ${fmt(ca, 1)} (Δ świecy ${fmt(c.d, 1)}, cena ${c.C})`); });
  // przejścia zamknięcia przez VA dzienną (wartości VA z końca świecy) i otwarcie sesji kasowej
  { const fr = D.boxes.findIndex(b => b && b[9] === 1), c0 = cols[0]; if (c0 && c0.rth && fr >= 0 && (c0.parts ? c0.parts[0].idx : (c0.idx ?? c0.last)) <= fr) ev(0, 'Sesja', 0, `otwarcie sesji kasowej ${D.boxes[fr][1]}`); }
  cols.forEach((c, i) => { if (!i || c.vah == null) return; const p = cols[i - 1], pc = p.C, cc = c.C;
    if (pc <= c.vah && cc > c.vah) ev(i, 'VA dzienna', 1, `zamknięcie nad VAH ${c.vah} (${cc}) · ${confirm(i, 1)}${follow(i, c.vah, 1)}`, c.vah);
    if (pc >= c.val && cc < c.val) ev(i, 'VA dzienna', -1, `zamknięcie pod VAL ${c.val} (${cc}) · ${confirm(i, -1)}${follow(i, c.val, -1)}`, c.val);
    if (pc > c.vah && cc <= c.vah && cc >= c.val) ev(i, 'VA dzienna', -1, `powrót do VA z góry (${cc}, VAH ${c.vah})`, c.vah);
    if (pc < c.val && cc >= c.val && cc <= c.vah) ev(i, 'VA dzienna', 1, `powrót do VA z dołu (${cc}, VAL ${c.val})`, c.val);
    if (c.poc != null && p.poc != null && Math.sign(pc - p.poc) !== Math.sign(cc - c.poc) && Math.sign(cc - c.poc) !== 0) ev(i, 'VA dzienna', cc > c.poc ? 1 : -1, `zamknięcie ${cc > c.poc ? 'nad' : 'pod'} POC ${c.poc} (${cc}) · ${confirm(i, cc > c.poc ? 1 : -1)}${follow(i, c.poc, cc > c.poc ? 1 : -1)}`, c.poc);
    if (c.rth && !p.rth) ev(i, 'Sesja', 0, `otwarcie sesji kasowej ${c.O}`);
    if (!c.rth && p.rth) ev(i, 'Sesja', 0, `koniec sesji kasowej, ostatnie zamknięcie ${pc}`); });
  // kalendarz makro: zdarzenia sesji (czas polski) → linie na wykresie, wpisy w historii, reakcja ceny
  const MK = [], MKX = [];
  if (S.mkw || S.evw) { mkLoad();
    if (MAKRO) for (const e of MAKRO.ev.filter(e => e.sess === S.day)) { const em = mmS(e.t), B = D.boxes;
      let bi = -1; for (let k = 0; k < B.length; k++) if (B[k] && mmS(B[k][0]) <= em) bi = k;
      const lastIdx = cols[cols.length - 1].parts ? cols[cols.length - 1].parts.slice(-1)[0].idx : (cols[cols.length - 1].last ?? cols[cols.length - 1].idx);
      const fIx = cols[0].parts ? cols[0].parts[0].idx : (cols[0].idx ?? cols[0].last), ci = bi >= fIx ? cols.findIndex(c => (c.parts ? c.parts.slice(-1)[0].idx : (c.last ?? c.idx)) >= bi) : -1, seen = bi >= 0 && bi <= lastIdx;
      let re = null;
      if (bi >= 1 && seen) { const p0 = B[bi - 1][4], at = B.slice(Math.max(0, bi - 20), bi).reduce((a, b) => a + (b[2] - b[3]), 0) / Math.min(20, bi), mv = k => bi + k <= lastIdx && B[bi + k] ? B[bi + k][4] - p0 : null;
        re = {p0, at, m5: mv(0), m30: mv(5), m60: mv(11), x: B[bi][8], rg: B[bi][2] - B[bi][3]}; }
      MK.push({...e, bi, ci, seen, re});
      if (seen && ci >= 0) { const fm1 = v => v == null ? '–' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(DEC);
        ev(ci, 'Makro', 0, `${e.cc} ${e.nm} (${e.t})${re ? ` · ruch 5′ ${fm1(re.m5)}, 30′ ${fm1(re.m30)}, 60′ ${fm1(re.m60)} pkt · wol ×${re.x != null ? (+re.x).toFixed(1).replace('.', ',') : '–'}` : ''}`);
        if (S.mkL !== false && S.mkw) { const x = ci * CW + (cols[ci].parts ? 0 : CW * ((em - mmS(B[bi][0])) / 5)), col = e.imp >= 3 ? css('--sell') : css('--mut'), ky = MKX.filter(q => Math.abs(q - x) < 175).length; MKX.push(x);
          o.push(`<g><title>${e.t} ${e.cc} ${e.nm} (${e.loc}, źródło ${e.src})</title><line x1="${x}" x2="${x}" y1="${HEAD}" y2="${HEAD + H}" stroke="${col}" stroke-width="${e.imp >= 3 ? 2 : 1.2}" stroke-dasharray="6 3" opacity=".85"/><rect x="${x - 2}" y="${HEAD + 2 + ky * 18}" width="${12 + (e.t.length + e.cc.length + Math.min(e.nm.length, 26) + 2) * 6.1}" height="15" rx="3" fill="${css('--panel')}" stroke="${col}"/><text x="${x + 3}" y="${HEAD + 13 + ky * 18}" font-size="9.5" font-weight="700" fill="${col}">${e.t} ${e.cc} ${e.nm.length > 26 ? e.nm.slice(0, 25) + '…' : e.nm}</text></g>`); } } } }
  { const box = $('mkWin'); box.hidden = !S.mkw;
    if (S.mkw) {
      if (!MAKRO) { $('mkWinB').innerHTML = '<p class="note">Wczytywanie kalendarza…</p>'; }
      else { const ds = S.day, fl = v => v == null ? '–' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(DEC)}`, fa = (v, a) => v == null || !a ? '' : ` <i>(${(v / a).toFixed(1).replace('.', ',')} ATR)</i>`;
        const nxt = MAKRO.ev.filter(e => e.sess > ds).slice(0, 12), prv = MAKRO.ev.filter(e => e.sess < ds).slice(-6).reverse();
        const row = (e, wr) => `<div class="mkr imp${e.imp}"><span class="mkd">${e.d.slice(8)}.${e.d.slice(5, 7)}</span><span class="mkt">${e.t}</span><span class="mkc">${e.cc}</span><span class="mkn">${e.nm}<small>${e.loc} · ${e.src}</small>${wr || ''}</span></div>`;
        const today = MK.map(e => row(e, e.re ? `<span class="mkre">5′ ${fl(e.re.m5)}${fa(e.re.m5, e.re.at)} · 30′ ${fl(e.re.m30)}${fa(e.re.m30, e.re.at)} · 60′ ${fl(e.re.m60)}${fa(e.re.m60, e.re.at)} · świeca: zakres ${(+e.re.rg).toFixed(DEC)}, wol ×${e.re.x != null ? (+e.re.x).toFixed(1).replace('.', ',') : '–'}</span>` : `<span class="mkre">${e.seen ? '' : 'jeszcze nie nastąpiło (w widoku / odtwarzaniu)'}</span>`)).join('');
        $('mkWinPx').innerHTML = `${ds.slice(8)}.${ds.slice(5, 7)} · ${MK.length} ${MK.length === 1 ? 'zdarzenie' : 'zdarzeń'}`;
        $('mkWinB').innerHTML = `<div class="dls"><label class="chk"><input type="checkbox" id="mkL" ${S.mkL !== false ? 'checked' : ''}> linie na wykresie</label><span><i class="mkdot h"></i>wysoki wpływ</span><span><i class="mkdot"></i>średni</span></div>`
          + `<div class="dlt">Ta sesja</div>${MK.some(e => e.seen && e.ci < 0) ? '<p class="note" style="margin:2px 0">Część zdarzeń jest przed początkiem zakresu wykresu (np. przy „Sesja kasowa”) – linii nie widać, reakcja liczona z danych doby.</p>' : ''}${today || '<p class="note">Brak zdarzeń z kalendarza w tej sesji.</p>'}`
          + `<div class="dlt">Następne</div>${nxt.map(e => row(e)).join('') || '<p class="note">Brak w kalendarzu.</p>'}`
          + `<details class="evn"><summary>Poprzednie</summary>${prv.map(e => row(e)).join('')}</details>`
          + `<p class="note">Czas polski. Kalendarz: harmonogramy BLS, BEA, Fed, EBC, BoE, BoJ i ISM (stan ${MAKRO.gen}); godzina BoJ orientacyjna. Reakcja = zmiana ceny od zamknięcia świecy M5 przed publikacją do zamknięcia świecy publikacji (5′), +30′ i +60′, w punktach i w ATR M5 (20 świec). Docelowo plik kalendarza dostarcza zespół danych. Opis, nie sygnał.</p>`;
        $('mkL').onchange = e => { S.mkL = e.target.checked; save(); render(true); }; } } }
  // okno zgodności rynków: ta sama sesja, stan na ostatnią świecę widoku – zmiana od otwarcia sesji kasowej, 30′ i 60′, delta doby, położenie względem VA dziennej
  { const box = $('zgWin'); box.hidden = !S.zgw;
    if (S.zgw) {
      const GR = {US: ['US500', 'US100', 'US30', 'RTY'], EU: ['DE40', 'FR40', 'EU50', 'UK100'], AS: ['J225', 'HK50', 'CN50']}, gk = Object.keys(GR).find(k => GR[k].includes(S.inst));
      const LEAD = ['US500', 'DE40', 'J225'], list = [...new Set([S.inst, ...(gk ? GR[gk] : []), ...LEAD.filter(x => !(gk && GR[gk].includes(x))), 'VIX', 'GOLD'])];
      const lc = cols[cols.length - 1], tEnd = (lc.t2 || lc.t), tm = mmS(D.boxes[lc.parts ? lc.parts.slice(-1)[0].idx : (lc.last ?? lc.idx)][0]);
      const st = n => { const J = CACHE[n]; if (!J) { needInst(n); return {n, load: 1}; } const P = J[S.day]; if (!P || !P.boxes || !P.boxes.length) return {n, none: 1};
        const B = P.boxes; let e = -1; for (let k = 0; k < B.length; k++) if (B[k] && mmS(B[k][0]) <= tm) e = k; if (e < 0) return {n, none: 1};
        const C0 = B[e][4], fr = B.findIndex(b => b && b[9] === 1), pct = (a, b) => (b - a) / a * 100;
        let acc = 0, vol = 0; for (const c of P.cells) if (c[0] <= e) { acc += c[3] - c[2]; vol += c[2] + c[3]; }
        return {n, t: B[e][0], C: C0, rth: fr >= 0 && fr <= e ? pct(B[fr][1], C0) : null, day: pct(B[0][1], C0), m30: e >= 6 ? pct(B[e - 6][4], C0) : null, m60: e >= 12 ? pct(B[e - 12][4], C0) : null, acc, dv: vol ? acc / vol * 100 : 0,
          va: B[e][5] == null ? null : C0 > B[e][5] ? 1 : C0 < B[e][7] ? -1 : 0, dec: (INSTS[n] || [1, 1])[1]}; };
      const R = list.map(st).map(r => (r.t && tm - mmS(r.t) > 15 ? {...r, old: 1} : r)), me = R[0], sg = v => v == null ? 0 : Math.abs(v) < .02 ? 0 : Math.sign(v);
      const agree = (r, k) => { if (r.old || r.n === me.n || me[k] == null || r[k] == null || !sg(me[k])) return null; const inv = r.n === 'VIX' && me.n !== 'VIX'; if (r.n === 'GOLD' || me.n === 'GOLD') return null; return inv ? sg(r[k]) === -sg(me[k]) : sg(r[k]) === sg(me[k]); };
      const cnt = k => { const a = R.map(r => agree(r, k)).filter(v => v != null); return [a.filter(Boolean).length, a.length]; };
      const fp = v => v == null ? '–' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2).replace('.', ',')}%`, cl = v => v == null || !sg(v) ? '' : v > 0 ? 'buy' : 'sell';
      const cell = (r, k) => { const a = agree(r, k); return `<td class="${cl(r[k])}">${fp(r[k])}${a == null ? '' : a ? ' <b class="zok">✓</b>' : ' <b class="zno">✗</b>'}</td>`; };
      const [a60, n60] = cnt('m60'), [ar, nr] = cnt('rth'), [a30, n30] = cnt('m30');
      $('zgWinPx').innerHTML = `${INST} · ${S.day.slice(8)}.${S.day.slice(5, 7)} · stan na ${tEnd}`;
      $('zgWinB').innerHTML = `<div class="dls"><span>zgodne 30′ <b>${a30}/${n30}</b></span><span>60′ <b>${a60}/${n60}</b></span><span>od otwarcia sesji kas. <b>${ar}/${nr}</b></span></div>`
        + `<table class="zgt"><tr><th>Rynek</th><th>Cena</th><th>od otw. sesji kas.</th><th>od początku doby</th><th>30′</th><th>60′</th><th>Δ doby</th><th>VA dzienna</th></tr>`
        + R.map(r => r.load ? `<tr><td>${r.n}</td><td colspan="7" class="mut">wczytywanie…</td></tr>` : r.none ? `<tr><td>${r.n}</td><td colspan="7" class="mut">brak danych dla tej sesji</td></tr>`
          : `<tr class="${r.n === me.n ? 'me' : ''}"><td>${r.n}${r.n === 'VIX' && me.n !== 'VIX' ? ' <small>(odwrotnie)</small>' : r.n === 'GOLD' ? ' <small>(bez oceny)</small>' : ''}</td><td>${(+r.C).toFixed(r.dec)}<small> ${r.t}${r.old ? ' – nieaktualne' : ''}</small></td>${cell(r, 'rth')}${cell(r, 'day')}${cell(r, 'm30')}${cell(r, 'm60')}<td class="${cl(r.acc)}">${fmt(r.acc, 1)} <small>(${r.dv.toFixed(0)}%)</small></td><td>${r.va == null ? '–' : r.va > 0 ? '<span class="vas up">nad VAH</span>' : r.va < 0 ? '<span class="vas dn">pod VAL</span>' : '<span class="vas in">w VA</span>'}</td></tr>`).join('') + '</table>'
        + `<p class="note">Stan każdego rynku na ostatnią świecę M5 z godziną ≤ ${tEnd} (czas polski) tej samej sesji. ✓ = ruch w tę samą stronę co ${me.n} (VIX: w przeciwną – odwrotna relacja z indeksami), ✗ = w przeciwną; ruch &lt; 0,02% = bez oceny; GOLD bez oceny; rynek, którego ostatnia świeca jest starsza niż 15 min (np. VIX po końcu eksportu, rynek zamknięty), jest „nieaktualny” i nie wchodzi do oceny. Δ doby = delta skumulowana od początku doby (w nawiasie % wolumenu). Grupy: USA (US500, US100, US30, RTY), Europa (DE40, FR40, EU50, UK100), Azja (J225, HK50, CN50) + liderzy innych regionów, VIX i GOLD. Opis, nie testowane jako sygnał.</p>`; } }
  // okno opcji SPX jak w DN v1.9.2 – strona opcje_dn.html (kod okna z DN bez zmian) w ramce; przekazujemy dzień, cenę i godzinę ostatniej świecy widoku oraz motyw
  { const box = $('opWin'); box.hidden = !S.opw;
    if (S.opw) { const lc_ = cols[cols.length - 1], th = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      if (S.inst !== 'US500') { $('opWinB').innerHTML = '<p class="note" style="padding:8px 4px">Opcje SPX są tylko dla US500.</p>'; $('opWinPx').innerHTML = ''; }
      else { // strona okna DN wczytywana jako tekst i osadzana przez srcdoc (ramka z adresem bywa blokowana w podglądzie artefaktu); stan przekazujemy wprost do jej boot()
        const st = {day: S.day, p: lc_.C, t: lc_.t2 || lc_.t, theme: th}, key = JSON.stringify(st); let fr = $('opFrame');
        const push = () => { try { const w = fr.contentWindow; if (w && w.boot) { w.DAF = st; w.boot(); fr.dataset.k = key; } } catch (e) { console.warn('okno opcji', e); } };
        if (!fr) { $('opWinB').innerHTML = '<iframe id="opFrame" title="Opcje SPX (DN)"></iframe>'; fr = $('opFrame'); fr.dataset.k = '';
          $('opWinB').insertAdjacentHTML('afterbegin', '<p class="note" id="opLoad" style="padding:8px 12px">Wczytywanie okna opcji…</p>');
          fetch('opcje_dn.html').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }).then(txt => {
            fr.addEventListener('load', () => { const l = $('opLoad'); if (l) l.remove(); fr.dataset.ready = '1'; push(); }, {once: true});
            fr.srcdoc = txt.replace('<head>', '<head><script>window.DAF=' + JSON.stringify(st) + '<\/script>'); })
          .catch(e => { const l = $('opLoad'); if (l) l.textContent = 'Nie udało się wczytać okna opcji (' + e.message + ').'; }); }
        else if (fr.dataset.ready && fr.dataset.k !== key) push();
        $('opWinPx').innerHTML = `${S.day.slice(8)}.${S.day.slice(5, 7)} · cena ${lc_.C} (${lc_.t2 || lc_.t})`; } } }
  // zakres na najbliższy tydzień z opcji SPX (1–5 DTE): stożek EM z ostatniego zrzutu ≤ wybranej sesji i jego migracja względem wcześniejszego zrzutu
  { const box = $('omWin'); box.hidden = !S.omw;
    if (S.omw) { ohLoad();
      if (!OPH) $('omWinB').innerHTML = '<p class="note">Wczytywanie archiwum opcji…</p>';
      else if (S.inst !== 'US500') { $('omWinB').innerHTML = '<p class="note">Zakres z opcji SPX jest tylko dla US500.</p>'; $('omWinPx').innerHTML = ''; }
      else {
        const SS = OPH.s.filter(q => q.sess <= S.day && q.exps.some(e => e.days <= 7 && e.straddle != null)), fd = d => `${d.slice(8)}.${d.slice(5, 7)}`;
        const close = d => { const P = DATA[d]; if (!P || !P.boxes || !P.boxes.length) return null; const r = P.boxes.filter(b => b[9]); return (r.length ? r[r.length - 1] : P.boxes[P.boxes.length - 1])[4]; };
        const cone = q => { const B = q.basis || 0, c = q.spx + B; return {q, c, pts: q.exps.filter(e => e.days <= 7 && e.straddle != null).sort((a, b) => a.exp < b.exp ? -1 : 1).slice(0, 5).map(e => ({d: e.exp, dte: e.days, em: e.straddle, lo: c - e.straddle, hi: c + e.straddle, ex: close(e.exp), fl: e.flip != null ? e.flip + B : null, gex: e.gex, iv: e.atm_iv}))}; };
        if (!SS.length) { $('omWinB').innerHTML = `<p class="note">Brak zrzutu łańcucha do ${fd(S.day)}.</p>`; }
        else {
          const cur = cone(SS[SS.length - 1]), prevs = SS.slice(0, -1), cmpS = prevs.find(q => q.sess === S.omCmp) || prevs[prevs.length - 1], prv = cmpS ? cone(cmpS) : null;
          const px = close(S.day) ?? cols[cols.length - 1].C, ages = Math.round((new Date(S.day) - new Date(cur.q.sess)) / 864e5);
          $('omWinPx').innerHTML = `zrzut ${fd(cur.q.sess)}${ages ? ` (${ages} dni przed wybraną sesją)` : ''} · środek US500 ${cur.c.toFixed(DEC)}`;
          // wykres stożka: oś X = dni kalendarzowe od zrzutu porównawczego do ostatniego wygaśnięcia
          const allD = [...new Set([cur.q.sess, ...cur.pts.map(p => p.d), ...(prv ? [prv.q.sess, ...prv.pts.map(p => p.d)] : [])])].sort(), d0 = new Date(allD[0]), dn = new Date(allD[allD.length - 1]), span = Math.max(1, (dn - d0) / 864e5);
          const vals = [cur.c, px, ...cur.pts.flatMap(p => [p.lo, p.hi, p.ex, p.fl != null && Math.abs(p.fl - cur.c) < 3 * p.em ? p.fl : null]), ...(prv ? [prv.c, ...prv.pts.flatMap(p => [p.lo, p.hi])] : [])].filter(v => v != null), lo = Math.min(...vals), hi = Math.max(...vals), pd = (hi - lo) * .08 || 10;
          const Wm = 880, Hm = 320, L = 60, R = 130, T = 14, Bm = 36, xs = d => L + ((new Date(d) - d0) / 864e5) / span * (Wm - L - R), ys = v => T + (hi + pd - v) / (hi - lo + 2 * pd) * (Hm - T - Bm);
          let g = ''; const st = (hi - lo) > 400 ? 100 : (hi - lo) > 200 ? 50 : (hi - lo) > 100 ? 25 : 10;
          for (let v = Math.ceil((lo - pd) / st) * st; v <= hi + pd; v += st) g += `<line x1="${L}" x2="${Wm - R + 10}" y1="${ys(v)}" y2="${ys(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${ys(v) + 3.5}" text-anchor="end" font-size="10" fill="var(--mut)">${v}</text>`;
          for (let k = 0; k <= span; k++) { const dd_ = new Date(d0.getTime() + k * 864e5), ds = dd_.toISOString().slice(0, 10), wk = dd_.getUTCDay(); if (wk === 0 || wk === 6) { g += `<rect x="${xs(ds) - (Wm - L - R) / span / 2}" y="${T}" width="${(Wm - L - R) / span}" height="${Hm - T - Bm}" fill="var(--line)" opacity=".35"/>`; continue; }
            g += `<text x="${xs(ds)}" y="${Hm - 18}" text-anchor="middle" font-size="10" fill="${ds === S.day ? 'var(--ink)' : 'var(--mut)'}" font-weight="${ds === S.day ? 700 : 400}">${fd(ds)}</text><text x="${xs(ds)}" y="${Hm - 6}" text-anchor="middle" font-size="9" fill="var(--mut)">${['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'][wk]}</text>`; }
          const poly = (C, fill, stroke, dash, op) => { const P = C.pts; if (!P.length) return ''; const up = [[xs(C.q.sess), ys(C.c)], ...P.map(p => [xs(p.d), ys(p.hi)])], dnL = P.slice().reverse().map(p => [xs(p.d), ys(p.lo)]);
            return `<polygon points="${[...up, ...dnL].map(q => q.join(',')).join(' ')}" fill="${fill}" opacity="${op}" stroke="none"/><polyline points="${up.map(q => q.join(',')).join(' ')}" fill="none" stroke="${stroke}" stroke-width="2" ${dash ? `stroke-dasharray="${dash}"` : ''}/><polyline points="${[[xs(C.q.sess), ys(C.c)], ...P.map(p => [xs(p.d), ys(p.lo)])].map(q => q.join(',')).join(' ')}" fill="none" stroke="${stroke}" stroke-width="2" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`; };
          if (prv) g += poly(prv, 'var(--mut)', 'var(--mut)', '5 4', .08);
          g += poly(cur, 'var(--opt)', 'var(--opt)', '', .16);
          g += `<line x1="${xs(cur.q.sess)}" x2="${xs(cur.pts.length ? cur.pts[cur.pts.length - 1].d : cur.q.sess)}" y1="${ys(cur.c)}" y2="${ys(cur.c)}" stroke="var(--opt)" stroke-dasharray="1 3"/>`;
          cur.pts.forEach(p => { g += `<g><title>${fd(p.d)} (${p.dte} DTE od ${fd(cur.q.sess)}): ± ${p.em.toFixed(1)} → ${p.lo.toFixed(DEC)} – ${p.hi.toFixed(DEC)}</title><line x1="${xs(p.d)}" x2="${xs(p.d)}" y1="${ys(p.hi)}" y2="${ys(p.lo)}" stroke="var(--opt)" stroke-width="1.2"/><circle cx="${xs(p.d)}" cy="${ys(p.hi)}" r="3.5" fill="var(--opt)"/><circle cx="${xs(p.d)}" cy="${ys(p.lo)}" r="3.5" fill="var(--opt)"/></g>`; });
          // GEX = 0 (gamma flip) każdej serii: poziom, przy którym łączna gamma dealerów zmienia znak
          for (const [C, col, dash, op] of [[prv, 'var(--mut)', '3 3', .8], [cur, 'var(--ewr)', '4 2', 1]]) { if (!C) continue; const F = C.pts.filter(p => p.fl != null && p.fl >= lo - pd && p.fl <= hi + pd); if (!F.length) continue;
            if (F.length > 1) g += `<polyline points="${F.map(p => xs(p.d) + ',' + ys(p.fl)).join(' ')}" fill="none" stroke="${col}" stroke-width="1.6" stroke-dasharray="${dash}" opacity="${op}"/>`;
            g += F.map(p => `<g><title>GEX = 0 (gamma flip) serii ${fd(p.d)} ze zrzutu ${fd(C.q.sess)}: US500 ≈ ${p.fl.toFixed(DEC)}${p.gex != null ? ` · GEX serii ${p.gex > 0 ? '+' : ''}${p.gex.toFixed(2)} mld $/1%` : ''} – ${px > p.fl ? 'cena nad (dodatnia gamma – ruchy gaszone)' : 'cena pod (ujemna gamma – ruchy mogą się wydłużać)'}</title><path d="M${xs(p.d) - 6},${ys(p.fl)} h12 M${xs(p.d)},${ys(p.fl) - 6} v12" stroke="${col}" stroke-width="2.4" opacity="${op}"/></g>`).join('');
            if (C === cur) { const lf = F[F.length - 1]; g += `<text x="${xs(lf.d) + 8}" y="${ys(lf.fl) + 4}" font-size="10" font-weight="700" fill="var(--ewr)">GEX 0 ${lf.fl.toFixed(0)}</text>`; } }
          const lp = cur.pts[cur.pts.length - 1]; if (lp) g += `<text x="${xs(lp.d) + 8}" y="${ys(lp.hi) + 4}" font-size="10.5" font-weight="700" fill="var(--opt)">${lp.hi.toFixed(0)}</text><text x="${xs(lp.d) + 8}" y="${ys(lp.lo) + 4}" font-size="10.5" font-weight="700" fill="var(--opt)">${lp.lo.toFixed(0)}</text><text x="${xs(lp.d) + 8}" y="${ys(cur.c) + 4}" font-size="10" fill="var(--opt)">środek ${cur.c.toFixed(0)}</text>`;
          if (prv && prv.pts.length) { const pp = prv.pts[prv.pts.length - 1]; g += `<text x="${xs(pp.d) + 8}" y="${ys(pp.hi) - 4}" font-size="9.5" fill="var(--mut)">${fd(prv.q.sess)}</text>`; }
          // zamknięcia US500 w znanych sesjach (od zrzutu porównawczego)
          const cl = Object.keys(DATA).filter(d => d >= allD[0] && d <= S.day).sort().map(d => [d, close(d)]).filter(q => q[1] != null);
          if (cl.length) g += `<polyline points="${cl.map(q => xs(q[0]) + ',' + ys(q[1])).join(' ')}" fill="none" stroke="var(--ink)" stroke-width="2"/>` + cl.map(q => `<circle cx="${xs(q[0])}" cy="${ys(q[1])}" r="3" fill="var(--ink)"><title>${fd(q[0])}: zamknięcie US500 ${q[1].toFixed(DEC)}</title></circle>`).join('');
          for (const C of [cur, prv].filter(Boolean)) C.pts.forEach(p => { if (p.ex == null) return; const ok = p.ex >= p.lo && p.ex <= p.hi; g += `<g><title>${fd(p.d)}: zamknięcie ${p.ex.toFixed(DEC)} – ${ok ? 'w' : 'poza'} zakresem ze zrzutu ${fd(C.q.sess)} (${p.lo.toFixed(0)}–${p.hi.toFixed(0)})</title><rect x="${xs(p.d) - 5}" y="${ys(p.ex) - 5}" width="10" height="10" transform="rotate(45 ${xs(p.d)} ${ys(p.ex)})" fill="${ok ? 'var(--buy)' : 'var(--sell)'}" stroke="var(--panel)"/></g>`; });
          // podsumowanie: zakres tygodnia teraz vs wcześniej
          const wk = cur.pts[cur.pts.length - 1], pk = prv && prv.pts.length ? prv.pts[prv.pts.length - 1] : null, sg = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(0);
          let t = `<div class="omh"><div><span>Zakres do ${wk ? fd(wk.d) : '–'} (${wk ? wk.dte + ' DTE' : ''})</span><b>${wk ? wk.lo.toFixed(0) + ' – ' + wk.hi.toFixed(0) : '–'}</b><i>± ${wk ? wk.em.toFixed(0) : '–'} pkt od środka ${cur.c.toFixed(0)} · cena ${px.toFixed(DEC)} = ${wk ? Math.round((px - cur.c) / wk.em * 100) : 0}% zakresu ${px >= cur.c ? 'w górę' : 'w dół'}</i></div>`;
          const dw = C => { const p = C.pts[C.pts.length - 1]; return p ? p.em / Math.sqrt(Math.max(1, p.dte)) : null; }, w1 = dw(cur), w0 = prv ? dw(prv) : null;
          if (pk) t += `<div><span>Migracja vs zrzut ${fd(prv.q.sess)}</span><b>środek ${sg(cur.c - prv.c)} · zakres dzienny ${w0 ? sg((w1 / w0 - 1) * 100) + '%' : '–'}</b><i>wtedy do ${fd(pk.d)}: ${pk.lo.toFixed(0)} – ${pk.hi.toFixed(0)} (± ${pk.em.toFixed(0)})${cur.c - prv.c > 0 ? ' · zakres przesunął się w górę' : cur.c - prv.c < 0 ? ' · zakres przesunął się w dół' : ''}${w0 ? `; ruch wyceniany na 1 dzień (EM/√DTE) ± ${w1.toFixed(0)} vs ± ${w0.toFixed(0)}` : ''}</i></div>`;
          { const fls = cur.pts.filter(p => p.fl != null); const nf = fls[0]; t += `<div class="omg"><span>GEX = 0 (gamma flip)</span><b>${nf ? nf.fl.toFixed(0) : '–'}</b><i>${nf ? `seria ${fd(nf.d)} · cena ${px > nf.fl ? 'nad – dodatnia gamma, ruchy gaszone' : 'pod – ujemna gamma, ruchy mogą się wydłużać'} (${sg(px - nf.fl)} pkt)` : 'brak przejścia GEX przez zero w zakresie strike\'ów tych serii'}${fls.length > 1 ? ' · dalsze serie: ' + fls.slice(1).map(p => fd(p.d) + ' ' + p.fl.toFixed(0)).join(', ') : ''}</i></div>`; }
          { // v1.3 krzywa zmienności (term structure): IV ATM najbliższej vs najdalszej serii ≤ 7 DTE w zrzucie
            const ivc = C => { const P = C ? C.pts.filter(p => p.iv != null) : []; if (P.length < 2) return P.length ? {one: P[0]} : null; const a = P[0], b = P[P.length - 1];
              return {a, b, sl: b.iv - a.iv, P}; };
            const k1 = ivc(cur), k0 = prv ? ivc(prv) : null, lab = sl => sl > .5 ? ['normalna ↗', 'buy', 'dalsze terminy droższe – spokój, rynek nie płaci za ochronę na najbliższe dni'] : sl < -.5 ? ['odwrócona ↘', 'sell', 'najbliższe dni droższe niż dalsze – stres, rynek wycenia ruch teraz'] : ['płaska →', '', 'bez wyraźnego nachylenia'];
            if (k1 && !k1.one) { const [L_, cl_, ds_] = lab(k1.sl), spark = (() => { const W = 150, H = 34, ivs = k1.P.map(p => p.iv), mn = Math.min(...ivs), mx = Math.max(...ivs), rg = mx - mn || 1;
                return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display:block;margin-top:3px"><polyline points="${k1.P.map((p, i) => `${6 + i / (k1.P.length - 1) * (W - 12)},${H - 5 - (p.iv - mn) / rg * (H - 10)}`).join(' ')}" fill="none" stroke="var(--opt)" stroke-width="2"/>${k1.P.map((p, i) => `<circle cx="${6 + i / (k1.P.length - 1) * (W - 12)}" cy="${H - 5 - (p.iv - mn) / rg * (H - 10)}" r="2.5" fill="var(--opt)"><title>${fd(p.d)} (${p.dte} DTE): IV ATM ${p.iv.toFixed(1)}%</title></circle>`).join('')}</svg>`; })();
              t += `<div title="IV ATM po wygaśnięciach ze zrzutu ${fd(cur.q.sess)}: ${k1.P.map(p => `${p.dte} DTE ${p.iv.toFixed(1)}%`).join(' · ')}. Status: opis – wpływu krzywej na dzień nie testowaliśmy (test reżimu po eksporcie historii Option Edge)."><span>Krzywa zmienności (IV ATM)</span><b class="${cl_}">${L_} ${k1.sl > 0 ? '+' : ''}${k1.sl.toFixed(1)} pp</b><i>${k1.a.dte} DTE ${k1.a.iv.toFixed(1)}% → ${k1.b.dte} DTE ${k1.b.iv.toFixed(1)}% · ${ds_}${k0 && !k0.one ? ` · zrzut ${fd(prv.q.sess)}: ${k0.sl > 0 ? '+' : ''}${k0.sl.toFixed(1)} pp (${lab(k0.sl)[0]})` : ''}</i>${spark}</div>`; }
            else if (k1 && k1.one) t += `<div title="W zrzucie jest tylko jedna seria ≤ 7 DTE – do krzywej potrzeba co najmniej dwóch wygaśnięć (pobierz łańcuch z kilkoma seriami, np. 1–5 DTE)."><span>Krzywa zmienności (IV ATM)</span><b>–</b><i>tylko 1 seria (${fd(k1.one.d)}, ${k1.one.dte} DTE): IV ATM ${k1.one.iv.toFixed(1)}%${k0 && !k0.one ? ` · zrzut ${fd(prv.q.sess)}: ${k0.a.dte} DTE ${k0.a.iv.toFixed(1)}%, krzywa ${lab(k0.sl)[0]} ${k0.sl > 0 ? '+' : ''}${k0.sl.toFixed(1)} pp` : ''}</i></div>`; }
          t += `</div>`;
          t += `<svg viewBox="0 0 ${Wm} ${Hm}" width="100%" style="display:block;margin:4px 0;cursor:crosshair"${xhA({x0: L, x1: Wm - R, y0: T, y1: Hm - Bm, v0: lo - pd, v1: hi + pd, f: 'p', ys: 'l', xm: 'p', xl: Array.from({length: span + 1}, (_, k) => fd(new Date(d0.getTime() + k * 864e5).toISOString().slice(0, 10))).join('|')})}>${g}</svg>`;
          t += `<div class="omk"><span><i style="background:var(--opt);opacity:.5"></i>zakres EM z ostatniego zrzutu</span>${prv ? `<span><i class="d"></i>zakres ze zrzutu ${fd(prv.q.sess)}</span>` : ''}<span><i style="background:var(--ink);height:2px"></i>zamknięcia US500</span><span><b style="color:var(--buy)">◆</b>/<b style="color:var(--sell)">◆</b> zamknięcie w dniu wygaśnięcia w / poza zakresem</span><span><b style="color:var(--ewr)">✚</b> GEX = 0 (gamma flip) serii</span></div>`;
          if (prevs.length) t += `<div class="dls" style="border:0"><span>porównaj ze zrzutem:</span><span class="seg">${prevs.slice(-6).map(q => `<button data-omc="${q.sess}" class="${prv && q.sess === prv.q.sess ? 'on' : ''}">${fd(q.sess)}</button>`).join('')}</span></div>`;
          t += `<div class="optab"><table><tr><th>Dzień (wygaśnięcie)</th><th>DTE</th><th>± EM</th><th>zakres US500</th><th>IV ATM</th><th>GEX 0</th><th>GEX serii</th>${prv ? `<th>wcześniej (${fd(prv.q.sess)})</th><th>zmiana</th>` : ''}<th>zamknięcie</th></tr>` + cur.pts.map(p => { const o = prv && prv.pts.find(z => z.d === p.d), ok = p.ex != null ? p.ex >= p.lo && p.ex <= p.hi : null;
            return `<tr><td>${fd(p.d)} <small>${['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'][new Date(p.d).getUTCDay()]}</small></td><td>${p.dte}</td><td>± ${p.em.toFixed(1)}</td><td><b>${p.lo.toFixed(0)} – ${p.hi.toFixed(0)}</b></td><td>${p.iv != null ? p.iv.toFixed(1) + '%' : '–'}</td><td>${p.fl != null ? p.fl.toFixed(0) : '<small>–</small>'}</td><td class="${p.gex < 0 ? 'sell' : p.gex > 0 ? 'buy' : ''}">${p.gex != null ? (p.gex > 0 ? '+' : '') + p.gex.toFixed(2) : '–'}</td>${prv ? `<td>${o ? o.lo.toFixed(0) + ' – ' + o.hi.toFixed(0) : '<small>–</small>'}</td><td>${o ? `<small class="${p.lo + p.hi > o.lo + o.hi ? 'buy' : 'sell'}">środek ${sg((p.lo + p.hi - o.lo - o.hi) / 2)}</small> · <small>szer. ${sg(p.em - o.em)}</small>` : ''}</td>` : ''}<td>${p.ex != null ? `${p.ex.toFixed(DEC)} <b class="${ok ? 'zok' : 'zno'}">${ok ? '✓' : '✗'}</b>` : '<small>–</small>'}</td></tr>`; }).join('') + `</table></div>`;
          t += `<p class="note">Zakres = środek (SPX z dnia zrzutu + baza US500 − SPX) ± straddle ATM serii wygasającej w danym dniu – rynek opcji wycenia ruch do tego dnia; zamknięcie w zakresie ma przy rozkładzie normalnym ok. 58% szans. Zrzut: ostatni z archiwum DN do wybranej sesji (wycena na zamknięcie; ${OPH.s.length} zrzutów od ${fd(OPH.s[0].sess)}). Migracja = jak przesunął się środek i zmieniła szerokość zakresu na ten sam lub najdalszy dzień względem wcześniejszego zrzutu. Szare pasy = weekend. GEX = 0 (gamma flip): poziom US500, przy którym łączna gamma dealerów w danej serii zmienia znak (konwencja: call +, put −) – nad nim ruchy są zwykle gaszone, pod nim mogą się wydłużać; brak, gdy GEX nie przechodzi przez zero w zakresie strike'ów. Migracja szerokości porównuje ruch wyceniany na 1 dzień (EM/√DTE), bo zrzuty mają różne horyzonty. Opis wyceny rynku, nie prognoza.</p>`;
          { // v1.3 profil gamma i zabezpieczenia animatorów dla wybranej sesji (tools/hedge_lines.py): łączny GEX w funkcji ceny + przepływ przy ruchu o ± EM
            const O3 = DATA[S.day] && DATA[S.day].opt, h = O3 && O3.hl;
            if (h && h.curve && h.curve[0].length > 3) { const cv = h.curve, xs_ = cv.map(q => q[0]), gx = cv.map(q => q[3]), fd_ = cv.map(q => q[1]), fu_ = cv.map(q => q[2]);
              const W2 = 880, H1 = 150, H2 = 110, L2 = 60, R2 = 20, x0 = Math.min(...xs_), x1 = Math.max(...xs_), X = v => L2 + (v - x0) / (x1 - x0) * (W2 - L2 - R2);
              const gm = Math.max(...gx.map(Math.abs), .1), Yg = v => 10 + (gm - v) / (2 * gm) * (H1 - 20), fm = Math.max(...fd_.map(Math.abs), ...fu_.map(Math.abs), .1), Yf = v => H1 + 10 + (fm - v) / (2 * fm) * (H2 - 20);
              const pl = (ys, Y) => xs_.map((x, i) => `${X(x).toFixed(1)},${Y(ys[i]).toFixed(1)}`).join(' ');
              let g2 = `<line x1="${L2}" x2="${W2 - R2}" y1="${Yg(0)}" y2="${Yg(0)}" stroke="var(--mut)"/><line x1="${L2}" x2="${W2 - R2}" y1="${Yf(0)}" y2="${Yf(0)}" stroke="var(--mut)"/>`
                + `<polygon points="${X(x0)},${Yg(0)} ${pl(gx, Yg)} ${X(x1)},${Yg(0)}" fill="var(--opt)" opacity=".15"/><polyline points="${pl(gx, Yg)}" fill="none" stroke="var(--opt)" stroke-width="2"/>`
                + `<polyline points="${pl(fd_, Yf)}" fill="none" stroke="var(--sell)" stroke-width="1.8"/><polyline points="${pl(fu_, Yf)}" fill="none" stroke="var(--buy)" stroke-width="1.8"/>`
                + `<text x="${L2 - 6}" y="${Yg(gm) + 8}" text-anchor="end" font-size="10" fill="var(--mut)">+${gm.toFixed(1)}</text><text x="${L2 - 6}" y="${Yg(-gm)}" text-anchor="end" font-size="10" fill="var(--mut)">−${gm.toFixed(1)}</text><text x="${L2 + 4}" y="${Yg(gm) + 9}" font-size="10" fill="var(--opt)" font-weight="700">GEX (mld $ / 1%) w funkcji ceny</text>`
                + `<text x="${L2 + 4}" y="${H1 + 20}" font-size="10" fill="var(--mut)"><tspan fill="var(--sell)" font-weight="700">przepływ przy spadku o EM</tspan> · <tspan fill="var(--buy)" font-weight="700">przy wzroście o EM</tspan> (mld $; + kupują, − sprzedają)</text>`;
              for (let v = Math.ceil(x0 / 50) * 50; v <= x1; v += 50) g2 += `<line x1="${X(v)}" x2="${X(v)}" y1="8" y2="${H1 + H2}" stroke="var(--line)" opacity=".6"/><text x="${X(v)}" y="${H1 + H2 + 12}" text-anchor="middle" font-size="10" fill="var(--mut)">${v}</text>`;
              const mk = (v, col, lab, dash) => v == null || v < x0 || v > x1 ? '' : `<line x1="${X(v)}" x2="${X(v)}" y1="8" y2="${H1 + H2}" stroke="${col}" stroke-width="1.6" stroke-dasharray="${dash}"/><text x="${X(v) + 3}" y="${H1 - 4}" font-size="9.5" font-weight="700" fill="${col}">${lab}</text>`;
              (h.g0 || []).forEach(v => g2 += mk(v, 'var(--ewr)', 'GEX 0 ' + v.toFixed(0), '4 2'));
              g2 += mk(O3.asym, 'var(--sell)', 'asym. ' + (O3.asym || 0).toFixed(0), '6 2 1 2') + mk(O3.sqz, 'var(--buy)', 'squeeze ' + (O3.sqz || 0).toFixed(0), '6 2 1 2');
              const lp = close(S.day); if (lp != null) g2 += mk(lp, 'var(--ink)', 'cena ' + lp.toFixed(0), '');
              t += `<div class="dlt" style="margin-top:10px">Profil gamma i zabezpieczenia animatorów · zrzut dla sesji ${fd(S.day)} (serie ${h.exps.map(fd).join(', ')})</div><svg viewBox="0 0 ${W2} ${H1 + H2 + 16}" width="100%" style="display:block;cursor:crosshair"${xhA({x0: L2, x1: W2 - R2, y0: 8, y1: H1 + H2, xa: x0, xb: x1, xf: 'v'})}>${g2}</svg>`
                + `<p class="note">Górny wykres: łączny GEX, gdyby SPX był na danej cenie (przeliczone na US500). Nad zerem dodatnia gamma, ruchy są gaszone; pod zerem ujemna, ruchy mogą się wydłużać. Szczyt ${h.gpk[1] > 0 ? '+' : ''}${h.gpk[1]} przy ${h.gpk[0].toFixed(0)}, dołek ${h.gtr[1]} przy ${h.gtr[0].toFixed(0)}; przy środku ${h.gspot > 0 ? '+' : ''}${h.gspot} mld $. Dolny: ile SPX animatorzy kupiliby (+) albo sprzedali (−) przy ruchu o ± ${h.m} pkt z danej ceny. Linia asymetrii: czerwona przechodzi przez zero, pod nią spadki są dobijane. Linia squeeze: zielona przechodzi przez zero, pod nią wzrosty są podbijane. Założenie pozycji: calle kupione, puty sprzedane – inni dostawcy (model z przepływów) potrafią dać przeciwny znak. Status: opis.</p>`; }
            else if (O3 && !h) t += `<p class="note">Profil gamma: brak przeliczenia dla tej sesji (uruchom tools/hedge_lines.py dla zrzutu łańcucha).</p>`; }
          $('omWinB').innerHTML = t;
          box.querySelectorAll('[data-omc]').forEach(b => b.onclick = () => { S.omCmp = b.dataset.omc; save(); render(true); }); } } } }
  // v1.3 pakiet dla agenta: stan sesji świeca po świecy + zdarzenia + poziomy, każdy element ze statusem z testów (tools/agent_export.js zapisuje go do JSON)
  try { const ST = {'Absorpcja': 'bez przewagi (sama); przy poziomie ★★ obserwacja: +0,40 ATR/30 min, n 113; permutacja p 0,11', 'Wyczerpanie': 'bez przewagi', 'Uwięzieni traderzy': 'bez przewagi',
      'Odwrócona strefa': 'bez przewagi', 'Order Block': 'M15: zbieranie danych; M5: bez przewagi', 'VA → POC': 'W1 z klatką LVN: obserwacja; bez klatki: opis; P1 z agresją: zbieranie danych', 'FVG': 'bez przewagi', 'Strefa imbalansów': 'obserwacja', 'Strefa z poprzednich sesji': 'opis', 'Dywergencja': 'bez przewagi (po dywergencji ruch częściej idzie dalej)',
      'Wybicie poziomu': 'PDH/PDL ze stopem za poziomem: przewaga +0,23 R (n 117); IB i inne: bez przewagi', 'Naked POC / VA': 'bez przewagi (magnes)', 'Opcje': 'zbieranie danych',
      'VA dzienna': 'opis (powrót do POC tylko w równowadze)', 'VWAP': 'opis', 'DVMZ': 'opis', 'Niedokończona aukcja': 'opis (powrót do słabych high/low: brak dowodu, test 14.11)', 'HVN / LVN': 'opis', 'Delta acc': 'opis', 'Sesja': 'opis'};
    const r2 = v => v == null ? null : Math.round(v * 100) / 100, LPa = cols.length ? cols[cols.length - 1].C : null;
    window.__AGENT = {inst: INST, day: S.day, tf: S.tf, range: S.rng, gen: new Date().toISOString(),
      uwaga: 'Analiza rynku, nie rekomendacja. Statusy z testów z grupą kontrolną (DA Flow / research). Elementy „bez przewagi” i „opis” to kontekst, nie sygnał.',
      kontekst: {atr5: ATRB ? r2(ATRB.atr) : null, atr_zuzyte_pct: ATRB && ATRB.used != null ? Math.round(ATRB.used) : null, cena: LPa,
        opcje: DATA[S.day].opt ? Object.fromEntries(Object.entries(DATA[S.day].opt).filter(([k]) => k !== 'hl')) : null},
      swiece: cols.map(c => ({t: c.t, o: c.O, h: c.H, l: c.L, c: c.C, wol: c.v, delta: c.d, delta_pct: c.v ? Math.round(c.d / c.v * 100) : 0, cvd: c.acc, wol_x_sr: c.x != null ? r2(c.x) : null,
        poc_swiecy: c.pocK, va_dnia: [c.val ?? null, c.poc ?? null, c.vah ?? null], sesja_kasowa: !!c.rth})),
      zdarzenia: EV.map(e => { const ce = cols[e.i], px = ce ? (e.side > 0 ? ce.L : ce.H) : null, ws = px == null ? 1 : Math.max(1, new Set(POOL.filter(q => Math.abs(q.v - px) <= TOLW).map(q => q.g)).size); return {t: e.t, typ: e.typ, strona: e.side, opis: e.txt, poziomy: e.lvl || null, waga: ws, poziomy_w_poblizu: px == null ? [] : POOL.filter(q => Math.abs(q.v - px) <= TOLW).map(q => q.lab),
        status: e.typ === 'Absorpcja' ? (ws >= 2 ? 'obserwacja: absorpcja przy poziomie ★★ (+0,40 ATR/30 min, n 113; test permutacyjny 14.11: p 0,11 – niepotwierdzone) – najlepszy element intraday, ale bez pewności' : 'bez przewagi') : (ST[e.typ] || 'opis')}; }),
      poziomy: LEV.map(q => ({cena: r2(q[0]), nazwa: q[3]})).filter(q => q.cena != null && Number.isFinite(q.cena))}; } catch (err) { window.__AGENT = {blad: String(err)}; }
  // v1.4 znacznik stanu w nagłówku (jak etap Filtr w specyfikacji bota): sygnał tylko z reguł v0 – R1 wybicie PDH/PDL, R2 absorpcja przy poziomie ★★ –
  // na ostatniej świecy w widoku (lub poprzedniej); blokady: makro wysokiej wagi ± 15 min, ATR zużyty > 100%, ostatnie 30 min sesji DA; obok flagi braków danych
  try { mkLoad(); const el = $('stat'), n = cols.length, lc = n ? cols[n - 1] : null, A = window.__AGENT || {}, ZD = A.zdarzenia || [];
    const sig = [], blk = [], dat = [];
    const r1 = e => e.typ === 'Wybicie poziomu' && ((/PDH/.test(e.txt) && e.side > 0) || (/PDL/.test(e.txt) && e.side < 0)) && cols[e.i] && cols[e.i].rth;   // R1: zamknięcie nad PDH / pod PDL w sesji kasowej, pierwsze na poziom
    const r1first = new Set(); { const seen = new Set(); EV.forEach((e, k) => { if (!r1(e)) return; const key = /PDH/.test(e.txt) ? 'H' : 'L'; if (!seen.has(key)) { seen.add(key); r1first.add(k); } }); }
    EV.forEach((e, k) => { if (e.i < n - 2) return; const z = ZD[k] || {};
      if (r1first.has(k)) sig.push(`R1 wybicie ${e.side > 0 ? 'PDH ↑ long' : 'PDL ↓ short'} ${e.t} (niepotwierdzone)`);
      if (e.typ === 'Absorpcja' && (z.waga || 1) >= 2) sig.push(`R2 absorpcja ★★ ${e.side > 0 ? '↑' : '↓'} ${e.t}`); });
    if (lc) { const tm = mmS(lc.t);
      if (MAKRO && MAKRO.ev) MAKRO.ev.filter(m => m.sess === S.day && m.imp >= 3 && Math.abs(mmS(m.t) - tm) <= 15).forEach(m => blk.push(`makro ${m.t} ${m.nm}`));
      if (ATRB && ATRB.used != null && ATRB.n >= 3 && ATRB.used > 100) blk.push(`ATR zużyty ${Math.round(ATRB.used)}%`);
      if (tm >= mmS('22:30')) blk.push('ostatnie 30 min sesji – tylko zamykanie'); }
    // v1.5 stan dwóch profili (research/dwa_profile, 14.11): profil przed sesją vs sesja kasowa do świecy i−1 (min. 12 świec 5 min);
    // RÓWNOWAGA = POC sesji w VA sprzed sesji, NAD / POD = POC sesji nad VAH / pod VAL sprzed sesji. R3 = odbicie od krawędzi VA sesji tylko w RÓWNOWADZE.
    let DP = null;
    { const DD = DATA[S.day], BX = DD.boxes, last = Number.isFinite(RL) ? RL : BX.length - 1, R0x = BX.findIndex(b => b && b[9] === 1);
      const vaR = sel => { const pm = new Map(); for (const [bi, p, bd, ak] of DD.cells) if (sel(bi)) pm.set(p, (pm.get(p) || 0) + bd + ak);
        const ks = [...pm.keys()].sort((a, b) => a - b); if (!ks.length) return null; const vs = ks.map(k => pm.get(k)), tot = vs.reduce((a, b) => a + b, 0);
        let pi = vs.indexOf(Math.max(...vs)), a0 = pi, a1 = pi, ac = vs[pi];
        while (ac < .7 * tot && (a0 > 0 || a1 < ks.length - 1)) { const up = a1 < ks.length - 1 ? vs[a1 + 1] : -1, dn = a0 > 0 ? vs[a0 - 1] : -1; if (up >= dn) ac += vs[++a1]; else ac += vs[--a0]; }
        return {vah: ks[a1], poc: ks[pi], val: ks[a0]}; };
      if (R0x >= 12 && last >= R0x) {
        const pre = vaR(bi => bi < R0x), nR = BX.slice(R0x, last + 1).filter(b => b && b[9] === 1).length;
        const stOf = ses => !pre || !ses ? null : ses.poc > pre.vah ? 'NAD' : ses.poc < pre.val ? 'POD' : 'RÓWNOWAGA';
        if (nR > 12) for (const i of [last - 1, last]) { const b = BX[i]; if (!b || b[9] !== 1) continue;
          const ses = vaR(bi => bi >= R0x && bi < i && BX[bi] && BX[bi][9] === 1), st_ = stOf(ses); if (i === last) DP = {st: st_, pre, ses};
          if (st_ === 'RÓWNOWAGA' && ATRB && ATRB.atr && ses.vah - ses.val >= .10 * ATRB.atr) {
            if (b[2] >= ses.vah && b[4] < ses.vah && b[4] > ses.poc) sig.push(`R3 odbicie od VAH sesji ↓ short ${b[0]} (cel POC ${ses.poc})`);
            if (b[3] <= ses.val && b[4] > ses.val && b[4] < ses.poc) sig.push(`R3 odbicie od VAL sesji ↑ long ${b[0]} (cel POC ${ses.poc})`); } }
        else DP = {st: null, pre}; } }
    const Bd = (DATA[S.day].boxes || []).filter(b => b), lastB = Bd.length ? Bd[Bd.length - 1][0] : null;
    if (Number.isFinite(RL)) dat.push(`odtwarzanie do ${lc ? lc.t : '–'}`);
    if (lastB && lastB < '22:50') dat.push(`dane sesji do ${lastB}`);
    if (INST === 'US500' && !DATA[S.day].opt && !DATA[S.day].opt0) dat.push('brak zrzutu opcji');
    if (MAKRO === null) dat.push('kalendarz makro: wczytywanie');
    const st = !lc ? 'brak' : sig.length && !blk.length ? 'sig' : sig.length ? 'blk' : 'wait';
    el.className = 'stat ' + st;
    el.innerHTML = (st === 'sig' ? `<b>SYGNAŁ – OBSERWACJA</b> ${sig.join(' · ')}` : st === 'blk' ? `<b>ZABLOKOWANY</b> ${sig.join(' · ')} — ${blk.join(' · ')}` : st === 'wait' ? `<b>CZEKAJ</b> brak sygnału z reguł R1–R3${blk.length ? ' — blokada: ' + blk.join(' · ') : ''}` : '<b>BRAK DANYCH</b>')
      + (DP && DP.st ? `<span class="statd">dzień: <b>${DP.st}</b> (POC sesji ${DP.ses.poc} vs VA przed sesją ${DP.pre.val}–${DP.pre.vah})</span>` : DP && DP.pre ? '<span class="statd">dzień: stan od 2. godziny sesji</span>' : '')
      + (dat.length ? `<span class="statd">${dat.join(' · ')}</span>` : '');
    el.title = 'Stan jak etap Filtr bota (v1.5, 14.11): żadna reguła nie ma przewagi potwierdzonej poza próbą – wszystkie to obserwacje do zbierania na papierze. R1 wybicie PDH/PDL: niepotwierdzone poza próbą (M1 US500 24.08–13.11, n 21/35, ok. −0,2 R). R2 absorpcja przy poziomie ★★: obserwacja (permutacja p 0,11). R3 odbicie od krawędzi VA sesji przy RÓWNOWADZE dwóch profili (POC sesji w VA sprzed sesji), cel POC sesji, stop za krawędzią o pół odległości krawędź–POC: obserwacja (DA Flow +0,30 R vs losowe, n 68; M1 US500 +0,25, n 33, przedział obejmuje zero; działało w X–XI). Stan dnia: RÓWNOWAGA / NAD / POD = POC sesji kasowej względem VA sprzed sesji (od 2. godziny sesji). Liczone na ostatniej świecy i poprzedniej. Blokady: makro wysokiej wagi ± 15 min, ATR zużyty > 100%, ostatnie 30 min sesji DA. Analiza rynku, nie rekomendacja.'; } catch (err) { const el = $('stat'); if (el) el.textContent = ''; }
  { const box = $('evWin'); box.hidden = !S.evw;
    if (S.evw) {
      const TYP = ['Wybicie poziomu', 'VA dzienna', 'VWAP', 'Naked POC / VA', 'Opcje', 'Strefa imbalansów', 'Odwrócona strefa', 'Order Block', 'FVG', 'VA → POC', 'Strefa z poprzednich sesji', 'Dywergencja', 'Wyczerpanie', 'Absorpcja', 'Nieefektywna agresja', 'Uwięzieni traderzy', 'DVMZ', 'Delta acc', 'HVN / LVN', 'Niedokończona aukcja', 'Sesja', 'Makro'], F = S.evF || {}, on_ = t => F[t] ?? !['Niedokończona aukcja', 'HVN / LVN', 'FVG'].includes(t);   // UA domyślnie wyłączone – jest ich dużo
      EV.forEach(e => { if (e.lvl == null) { e.w = 0; return; } const [a, b] = Array.isArray(e.lvl) ? e.lvl : [e.lvl, e.lvl], nb = POOL.filter(q => q.v >= a - TOLW && q.v <= b + TOLW), gs = new Set(nb.map(q => q.g));
        const own = e.typ === 'VWAP' ? 'VWAP' : e.typ === 'VA dzienna' ? 'VA' : e.typ.startsWith('Strefa') ? 'strefa' : e.typ === 'Opcje' ? 'opcje' : e.typ.startsWith('Naked') ? 'naked' : /ONH|ONL/.test(e.txt) ? 'noc' : /IBH|IBL/.test(e.txt) ? 'IB' : /D-1 kas/.test(e.txt) ? 'D-1 VA' : /PDH|PDL/.test(e.txt) ? 'D-1' : 'inne';
        if (e.typ.startsWith('Strefa')) e.zw = new Set(nb.map(q => q.g)).size;   // waga samej strefy: różne grupy poziomów przy niej (bez własnej)
        gs.add(own); e.w = Math.max(gs.size, e.fw || 0); e.nb = nb; });
      const zHide = e => S.evZAll !== true && e.typ.startsWith('Strefa') && !(e.zw >= 2);   // test 11.11: strefy bez ★★ bez przewagi nad losową – domyślnie ukryte   // własna grupa zdarzenia + różne grupy poziomów w pobliżu
      const cnt = t => EV.filter(e => e.typ === t).length, L = EV.filter(e => on_(e.typ) && !zHide(e) && (!S.evImp || e.w >= 2) && (!S.evAg || e.typ !== 'Wybicie poziomu' || e.ag === true)).sort((a, b) => S.evAsc ? a.i - b.i : b.i - a.i);
      $('evWinPx').innerHTML = `${INST} · ${S.day.slice(8)}.${S.day.slice(5, 7)} · ${L.length} z ${EV.length}${Number.isFinite(RL) ? ' · do ' + cols[cols.length - 1].t : ''}`;
      $('evWinB').innerHTML = `<div class="evf">${TYP.filter(cnt).map(t => `<button data-evt="${t}" class="${on_(t) ? 'on' : ''}">${t} <b>${cnt(t)}</b></button>`).join('')}<button data-evi="1" class="${S.evImp ? 'on' : ''}" title="Tylko zdarzenia na poziomach o wadze ≥ 2 (zbieżność poziomów z różnych grup)">tylko ważne ★★+ <b>${EV.filter(e => on_(e.typ) && e.w >= 2).length}</b></button><button data-evz="1" class="${S.evZAll ? 'on' : ''}" title="Domyślnie strefy imbalansów (także z poprzednich sesji) pokazujemy tylko przy poziomach z ≥ 2 grup (★★) – w teście 11.11 strefy bez takich poziomów nie trzymały lepiej niż losowy przedział tej samej szerokości">strefy: ${S.evZAll ? 'wszystkie' : 'tylko przy ★★'} <b>${EV.filter(e => e.typ.startsWith('Strefa') && (S.evZAll || e.zw >= 2)).length}/${EV.filter(e => e.typ.startsWith('Strefa')).length}</b></button><button data-eva="1" class="${S.evAg ? 'on' : ''}" title="Wybicia poziomów tylko z agresją w świecy wybicia (M1 nierównowaga diagonalna za poziomem lub M2 ułożone nierównowagi ≥ 3). Test 15.11: prawdziwe wybicie 29% vs 13% (M1), R +0,12 nad resztą; samodzielnie po kosztach nadal ok. zera – opis, nie sygnał.">wybicia z agresją <b>${EV.filter(e => e.typ === 'Wybicie poziomu' && e.ag === true).length}/${EV.filter(e => e.typ === 'Wybicie poziomu').length}</b></button><button data-evo="1" class="ord">${S.evAsc ? 'od najstarszych ↓' : 'od najnowszych ↑'}</button></div>`
        + `<div class="evl">${L.length ? L.map(e => `<div class="evr${e.w >= 3 ? ' imp3' : e.w >= 2 ? ' imp2' : ''}" data-i="${e.i}" title="${e.w >= 2 ? `Waga ${e.w} – w pobliżu: ${e.nb.map(q => q.lab + ' ' + q.v.toFixed(DEC)).join(', ')}. ` : ''}Kliknij – przewiń wykres do świecy ${e.t}"><span class="evt">${e.t}</span><i class="evd ${e.side > 0 ? 'up' : e.side < 0 ? 'dn' : 'nt'}"></i><span class="evk">${e.typ}${e.w >= 2 ? `<span class="evs">${'★'.repeat(Math.min(e.w, 5))}</span>` : ''}</span><span class="evx">${e.txt.replace(/ · (✔|◐|✖)([^·]*?)(?= · |$)/, (m, k, r) => { const [hd, rest] = r.split(' – '); return `<span class="evc ${k === '✔' ? 'ok' : k === '◐' ? 'half' : 'no'}">${k}${hd}</span>` + (rest ? `<span class="evi">${rest.split(' | ').map(q => { const kk = q.match(/[✔◐✖]/); return `<span class="${kk ? (kk[0] === '✔' ? 'ok' : kk[0] === '◐' ? 'half' : 'no') : ''}">${q}</span>`; }).join('')}</span>` : ''); }).replace(/ · agresja (✚|–) ([^·]*?)(?= · |$)/, (m, k, r) => `<span class="evc ${k === '✚' ? 'ok' : 'no'}" title="M1 = nierównowaga diagonalna ≥ 3:1 za poziomem w stronę wybicia; M2 = ≥ 3 kolejne poziomy z nierównowagą w stronę wybicia (świeca 5 min wybicia, natywny krok ceny). Test 15.11: opis, nie sygnał.">agresja ${k === '✚' ? 'tak' : 'nie'} · ${r}</span>`).replace(/ · (powrót [^·]*|utrzymane 6 świec|w toku)$/, (m, r) => `<span class="evf2 ${r.startsWith('powrót') ? 'no' : r.startsWith('utrz') ? 'ok' : ''}">${r}</span>`)}</span></div>`).join('') : '<p class="note">Brak zdarzeń dla wybranych typów.</p>'}</div>`
        + `<details class="evn"><summary>Jak liczymy i wyniki testów</summary><p class="note">Zdarzenia z warstw włączonych na wykresie (wyłączona warstwa = brak jej zdarzeń), w interwale wykresu, ${Number.isFinite(RL) ? 'do bieżącej świecy odtwarzania' : 'do ostatniej świecy'}. Kropka: zielona = wydźwięk wzrostowy (np. strefa kupna, wyczerpanie na dołku, zamknięcie nad VAH), czerwona = spadkowy, szara = neutralne (sesja, niedokończone aukcje). Strefy imbalansów (v1.2): domyślnie pokazujemy zdarzenia stref tylko przy poziomach z ≥ 2 grup (★★), a na wykresie strefy bez takich poziomów są wygaszone – test 11.11 (14 rynków, pary z losowym przedziałem tej samej szerokości w tej samej świecy): strefy bez poziomu trzymały tak samo jak losowe (+0,5 pp), przy ★★ o ok. 3 pp lepiej (76% vs 72%); ok. 70% „utrzymania” to sama geometria. Przycisk „strefy” przełącza na wszystkie. Nieefektywna agresja (v1.2) = w oknie 30 min (6 świec 5 min) delta ≥ 10% wolumenu w jedną stronę, a cena stoi lub idzie przeciwnie, i przy cenie (± 0,25 ATR M5) są poziomy z ≥ 2 grup (D-1, noc, IB, D-1 VA, VA dzienna, VWAP) – liczona na świecach 5 min niezależnie od interwału wykresu; w teście przy ★★ cena szła potem przeciwnie do delty (13 rynków: +0,57 ATR M5 w 30 min, 67%, n = 84), poza poziomami – za deltą; na VIX efektu nie było (n = 42, +0,02), więc dla VIX zdarzenie jest wyłączone; obserwacja, zbieramy przypadki poza próbą. Gwiazdki ★ = waga poziomu, na którym zaszło zdarzenie: liczba różnych grup poziomów (dzień poprzedni, noc, IB, naked, opcje, VA dzienna; strefa imbalansów liczy się jako własna) w ± max(2 kroki, 4% ATR5) – ★★ = 2 grupy, ★★★ = 3+; takie wiersze są pogrubione, a przycisk „tylko ważne” zostawia tylko je. Waga = zbieżność, nie testowana siła. Typy włączasz i wyłączasz przyciskami u góry; niedokończone aukcje i HVN / LVN są domyślnie wyłączone, bo jest ich dużo. VWAP: zamknięcie po drugiej stronie VWAP lub pasma ±1σ/±2σ (wybrany tryb VWAP). Naked POC/VA: pierwsze dotknięcie. Opcje (DN, tylko US500): zamknięcie za EM, ścianą calli/putów, flipem GEX. HVN/LVN z profilu narastającego (stan w danej chwili). Delta acc: zmiana znaku delty skumulowanej (acc Δ z nagłówka wykresu) z + na − lub z − na +. Nie testowane. Uwięzieni traderzy: silne kupno przy szczycie (sprzedaż przy dołku) świecy i w ciągu 3 świec zamknięcie poza całą strefą; test 11.11 – bez przewagi, także przy poziomie ★★ (−0,14 ATR). Absorpcja przy poziomie ★★: +0,40 ATR w 30 min ponad kontrolę (n 113, obie połowy dodatnie; test permutacyjny 14.11: p 0,11 – niepotwierdzone) – obserwacja. TPO max/min nie trafia do historii – liczone z gotowego profilu, więc znałoby przyszłość. Wybicie poziomu (PDH/PDL, ONH/ONL, IBH/IBL, VAH/POC/VAL sesji kasowej D-1) i wyjście z VA dziennej = zamknięcie świecy za poziomem; potwierdzenie w interwałach 5′, 15′, 30′ i 60′ kończących się na świecy wybicia (ze świec M5): w każdym ✔ = delta w stronę wybicia ≥ 10% wolumenu interwału i wolumen ≥ 1,2 × średnia tej pory dnia z 5 sesji, ◐ = jedno z dwóch, ✖ = żadne; ocena ogólna: ✔ potwierdzone = ✔ w co najmniej 3 interwałach, ◐ częściowo = coś w co najmniej 2, inaczej ✖. Dalej: „powrót” = zamknięcie z powrotem za poziomem w ciągu 6 świec (fałszywe wybicie), „utrzymane 6 świec” lub „w toku”. Test 08.11 (14 rynków, 15.10–06.11, 7967 wybić): ok. 60% wybić wraca za poziom w ciągu 6 świec; „✔ potwierdzone” utrzymuje się w 47% vs 39% „bez” – po uwzględnieniu sesji +5 pp (90%: 0…+10 pp), na rynkach niejednolicie (GOLD odwrotnie). Najwyraźniej przy wyjściu z VA dziennej (nad VAH / pod VAL): potwierdzone 51% vs 37%, ruch po 6 świecach +0,46 vs −0,12 ATR (n 178 / 984); przy przejściu przez POC dzienny potwierdzenie nic nie zmienia (42% vs 40%). Status: obserwacja, nie filtr. VWAP i pasma (5316 przejść): utrzymanie ok. 39–40% niezależnie od potwierdzenia – bez przewagi. Opcje DN: tylko 4 dni z łańcuchem (111 przejść) – za mało, zbieramy dane. Naked POC/VAH/VAL, pierwszy test: utrzymany (1 ATR odbicia przed 1 ATR przebicia) 75% vs 70% dla losowych nietkniętych poziomów z tych samych sesji (n 152 / 566, p 0,23; w parach sesja-rynek +11 pp, 90%: +4…+17) – obserwacja, najwyraźniej dla poziomów z D-1. Agresja przy wybiciu (v1.8, test 15.11: 13 rynków, 2550 wybić – range nocny w sesji kasowej, knot H1, wyjście za LVN 60′): liczona na świecy 5 min, w której pada zamknięcie, na poziomach flexu w natywnym kroku ceny. M1 = za poziomem więcej nierównowag diagonalnych ≥ 3:1 (min. 2) w stronę wybicia niż przeciw; M2 = ≥ 3 kolejne poziomy z nierównowagą w stronę wybicia. „Agresja tak” = M1 lub M2. W teście prawdziwe wybicie (0,2·A za poziomem przed zamknięciem z powrotem) M1 29% vs 13%, M2 22% vs 13%; transakcja w stronę wybicia (stop 0,1·A, cel 1,5R) o +0,12R lepsza niż bez agresji, z celem 3R o +0,2R – ale samodzielnie po kosztach ok. zera (M1 −0,08R, 3R −0,03R); wyjątek: range nocny w sesji kasowej z M1 i celem 3R +0,23R (n 39) – obserwacja. Tempo, zamknięcie przy ekstremum i podtrzymana delta – bez przewagi. Na dniach z szacowanym footprintem (z M1) agresji nie liczymy. Przycisk „wybicia z agresją” zostawia tylko takie wybicia. Order Block i FVG (v1.8, test 15.11, 13 rynków, 18 dni, kontrola: strefa tej samej szerokości w losowym miejscu nogi impulsu, pierwszy powrót, limit na krawędzi, stop 0,1·A, cel 1,5R, koszt 0,1R): FVG bez przewagi (M5 −0,20R vs −0,21R, M15 −0,19R vs −0,24R); OB M15 +0,04R vs −0,30R (n 51, połowy niespójne) – zbieranie danych; OB M5 bez przewagi. ✚ = footprint w świecy strefy (FVG: ułożone nierównowagi w świecy impulsu; OB: absorpcja lub ułożone nierównowagi). FVG domyślnie wyłączone w historii – jest ich dużo. Kliknij wiersz, żeby przewinąć wykres do świecy. Opis zdarzeń, nie sygnały.</p></details>`;
      box.querySelectorAll('[data-evt]').forEach(b => b.onclick = () => { S.evF = {...(S.evF || {}), [b.dataset.evt]: !on_(b.dataset.evt)}; save(); render(true); });
      box.querySelector('[data-evi]').onclick = () => { S.evImp = !S.evImp; save(); render(true); };
      box.querySelector('[data-eva]').onclick = () => { S.evAg = !S.evAg; save(); render(true); };
      box.querySelector('[data-evz]').onclick = () => { S.evZAll = !S.evZAll; save(); render(true); };
      box.querySelector('[data-evo]').onclick = () => { S.evAsc = !S.evAsc; save(); render(true); };
      box.querySelectorAll('.evr').forEach(r => r.onclick = () => { const i = +r.dataset.i, fpEl = $('fp'); let sc = fpEl.parentElement; while (sc && sc.scrollWidth <= sc.clientWidth + 1) sc = sc.parentElement;
        if (sc) sc.scrollTo({left: Math.max(0, i * CW - sc.clientWidth / 2 + CW / 2), behavior: 'smooth'});
        const hl = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); hl.setAttribute('x', i * CW); hl.setAttribute('y', HEAD); hl.setAttribute('width', CW); hl.setAttribute('height', H); hl.setAttribute('fill', 'none'); hl.setAttribute('stroke', css('--ewr')); hl.setAttribute('stroke-width', 3); hl.setAttribute('rx', 4); fpEl.appendChild(hl); setTimeout(() => hl.remove(), 1800);
        box.querySelectorAll('.evr.sel').forEach(q => q.classList.remove('sel')); r.classList.add('sel'); }); } }
  const defs = `<defs><pattern id="lvnh" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="${C.lvn}" opacity=".08"/><line x1="0" y1="0" x2="0" y2="6" stroke="${C.lvn}" stroke-width="1.6" opacity=".45"/></pattern></defs>`;
  const LP = cols[cols.length - 1].C, LT = cols[cols.length - 1].t;
  { const lpe = document.getElementById('lastPx'); if (lpe) lpe.innerHTML = `· cena <span class="px">${PXF(LP)}</span> <span class="mutd">(${LT}${cols[cols.length - 1].ap ? '*' : ''})</span>`; }
  { const st = document.getElementById('liveSt'); if (st) { const net = navigator.onLine; st.innerHTML = `<i class="dot ${net ? 'off' : 'down'}"></i>${net ? 'offline – dane z eksportu DA' : 'brak sieci'}`; st.title = 'Strona nie ma bieżącego zasilania danymi: pokazuje wbudowane eksporty flex/M1 z Delta Analyzera. Ostatnia świeca: ' + LT; } }
  o.push(`<line x1="0" x2="${W}" y1="${y(LP)}" y2="${y(LP)}" stroke="${C.ink}" stroke-width="1" stroke-dasharray="2 3" opacity=".8"/>`);
  const clip = `<clipPath id="plotclip"><rect x="0" y="${HEAD}" width="${W}" height="${H}"/></clipPath>`;
  o.unshift(defs, clip, '<g clip-path="url(#plotclip)" shape-rendering="crispEdges">', ...ou, ...on, '</g>'); o.push('<g clip-path="url(#plotclip)">', ...ov, '</g>');
  o.push(`<g id="lvlab">${olab.join('')}</g>`);
  const fp = $('fp'); fp.setAttribute('width', W); fp.setAttribute('height', HEAD + H + FOOT); fp.setAttribute('viewBox', `0 0 ${W} ${HEAD + H + FOOT}`); fp.innerHTML = o.join('');
  const ax = [], AW = 64;
  const hd = $('hdr'); hd.setAttribute('width', W); hd.setAttribute('height', HH + 8); hd.innerHTML = oh.join('');
  const cn = $('corner'); cn.setAttribute('width', AW); cn.setAttribute('height', HH + 8);
  cn.innerHTML = `<text x="${AW - 6}" y="16" text-anchor="end" font-size="9.5" fill="${C.mut}">wolumen</text><text x="${AW - 6}" y="31" text-anchor="end" font-size="9.5" fill="${C.mut}">Δ świecy</text><text x="${AW - 6}" y="45" text-anchor="end" font-size="9.5" fill="${C.poc}">acc Δ</text>` + (S.st && !M1 ? `<text x="${AW - 6}" y="60" text-anchor="end" font-size="9" fill="${C.mut}">Δ %</text><text x="${AW - 6}" y="73" text-anchor="end" font-size="9" fill="${C.mut}">bid × ask</text><text x="${AW - 6}" y="86" text-anchor="end" font-size="9" fill="${C.mut}">Δ min/max</text><text x="${AW - 6}" y="99" text-anchor="end" font-size="9" fill="${C.mut}">czas</text>` : '');
  for (let p = Q(Math.ceil(lo / step - 1e-9) * step); p <= hi + 1e-9; p = Q(p + step)) ax.push(`<text x="${AW - 6}" y="${y(p) + 3.5}" text-anchor="end" font-size="10" fill="${C.mut}">${DEC >= 2 ? p.toFixed(DEC) : p}</text>`);
  // panel delty: słupki delty świecy (góra) i delta skumulowana (dół) – osobne skale
  { const on = !!S.dp, row = $('dprow'); row.hidden = !on;
    if (on) {
      const DH = 240, H1_ = 70, HV_ = 70, H2_ = 70, G = 10, out = [], ax2 = [];
      const ds_ = cols.map(c => c.d), mx = Math.max(1, ...ds_.map(Math.abs)), accs = cols.map(c => c.acc).filter(v => v != null);
      const a0 = Math.min(...accs), a1 = Math.max(...accs), yd = v => 6 + H1_ / 2 - v / mx * (H1_ / 2 - 2), yc = v => 6 + H1_ + G + HV_ + G + (a1 - v) / Math.max(a1 - a0, 1) * (H2_ - 4) + 2;
      const vmx = Math.max(1, ...cols.map(c => c.v)), yv0 = 6 + H1_ + G + HV_, yv = v => yv0 - v / vmx * (HV_ - 4);
      out.push(`<line x1="0" x2="${W}" y1="${yd(0)}" y2="${yd(0)}" stroke="${C.mut}" stroke-width=".8"/><line x1="0" x2="${W}" y1="${6 + H1_ + G / 2}" y2="${6 + H1_ + G / 2}" stroke="${C.line}"/><line x1="0" x2="${W}" y1="${yv0 + G / 2}" y2="${yv0 + G / 2}" stroke="${C.line}"/><line x1="0" x2="${W}" y1="${yv0}" y2="${yv0}" stroke="${C.mut}" stroke-width=".8"/>`);
      if (!M1) {
        const vmx2 = Math.max(vmx, ...cols.filter(c => c.x).map(c => c.v / c.x));
        cols.forEach((c, i) => { const hot = c.x != null && c.x >= 1.5, x = i * CW + CW * .2, w = CW * .6, yy = yv(Math.min(c.v, vmx));
          out.push(`<rect x="${x}" y="${yy}" width="${w}" height="${yv0 - yy}" fill="${hot ? C.hot : C.bar}" opacity="${hot ? .9 : .6}"><title>${c.t}: wolumen ${c.v}${c.x != null ? `, średnia 5 sesji ${Math.round(c.v / c.x)} (×${c.x.toFixed(2).replace('.', ',')})` : ''}</title></rect>`);
          if (c.x != null && c.x > 0) { const ya = yv(Math.min(c.v / c.x, vmx)); out.push(`<line x1="${x - 3}" x2="${x + w + 3}" y1="${ya}" y2="${ya}" stroke="${C.ink}" stroke-width="1.6" stroke-dasharray="3 2"/>`);
            const pct = Math.round((c.x - 1) * 100); out.push(`<text x="${x + w / 2}" y="${Math.max(Math.min(yy, ya) - 4, 6 + H1_ + G + 9)}" text-anchor="middle" font-size="${NARROW ? 8.5 : 9.5}" font-weight="${hot ? 700 : 500}" fill="${hot ? C.hot : pct >= 0 ? C.ink : C.mut}">×${c.x.toFixed(1).replace('.', ',')}${NARROW ? '' : ` (${pct > 0 ? '+' : ''}${pct}%)`}</text>`); } });
      }
      else out.push(`<text x="8" y="${yv0 - 30}" font-size="10" fill="${C.mut}">M1: eksport DA nie ma wolumenu</text>`);
      if (!M1) cols.forEach((c, i) => { const x = i * CW + CW * .2, w = CW * .6; out.push(`<rect x="${x}" y="${Math.min(yd(c.d), yd(0))}" width="${w}" height="${Math.max(Math.abs(yd(c.d) - yd(0)), 1)}" fill="${c.d >= 0 ? C.buy : C.sell}" opacity=".8"><title>${c.t}: Δ ${c.d > 0 ? '+' : ''}${c.d}</title></rect>`); });
      else out.push(`<text x="8" y="${yd(0) - 6}" font-size="10" fill="${C.mut}">M1: eksport DA nie ma delty minutowej – tylko delta skumulowana poniżej</text>`);
      if (accs.length) {
        if (a0 < 0 && a1 > 0) out.push(`<line x1="0" x2="${W}" y1="${yc(0)}" y2="${yc(0)}" stroke="${C.ink}" stroke-width="1" stroke-dasharray="4 3"/>`);
        let d = ''; cols.forEach((c, i) => { if (c.acc == null) return; d += `${d ? 'L' : 'M'}${i * CW + CW / 2},${yc(c.acc)}`; });
        const top = 6 + H1_ + G + HV_ + G, bot = DH, z0 = Math.min(Math.max(yc(0), top), bot);
        const fx0 = cols.findIndex(c => c.acc != null), fx1 = cols.length - 1 - [...cols].reverse().findIndex(c => c.acc != null);
        const area = d + `L${fx1 * CW + CW / 2},${z0}L${fx0 * CW + CW / 2},${z0}Z`;
        out.push(`<defs><clipPath id="accpos"><rect x="0" y="${top}" width="${W}" height="${Math.max(z0 - top, 0)}"/></clipPath><clipPath id="accneg"><rect x="0" y="${z0}" width="${W}" height="${Math.max(bot - z0, 0)}"/></clipPath></defs>`);
        out.push(`<path d="${area}" fill="${C.buy}" opacity=".15" clip-path="url(#accpos)"/><path d="${area}" fill="${C.sell}" opacity=".15" clip-path="url(#accneg)"/>`);
        out.push(`<path d="${d}" fill="none" stroke="${C.buy}" stroke-width="2.2" clip-path="url(#accpos)"/><path d="${d}" fill="none" stroke="${C.sell}" stroke-width="2.2" clip-path="url(#accneg)"/>`);
        cols.forEach((c, i) => { if (c.acc == null || M1) return; out.push(`<circle cx="${i * CW + CW / 2}" cy="${yc(c.acc)}" r="2.6" fill="${c.acc >= 0 ? C.buy : C.sell}"><title>${c.t}: acc Δ ${c.acc > 0 ? '+' : ''}${c.acc}</title></circle>`); });
      }
      const dl = $('dlt'); dl.setAttribute('width', W); dl.setAttribute('height', DH); dl.innerHTML = out.join('');
      ax2.push(`<text x="${AW - 6}" y="13" text-anchor="end" font-size="9.5" fill="${C.ink}" font-weight="600">Δ świecy</text><text x="${AW - 6}" y="25" text-anchor="end" font-size="8.5" fill="${C.mut}">±${fmt(mx)}</text><text x="${AW - 6}" y="${yd(0) + 3}" text-anchor="end" font-size="9" fill="${C.mut}">0</text>`);
      ax2.push(`<text x="${AW - 6}" y="${6 + H1_ + G + 11}" text-anchor="end" font-size="9.5" fill="${C.ink}" font-weight="600">wolumen</text><text x="${AW - 6}" y="${6 + H1_ + G + 23}" text-anchor="end" font-size="8.5" fill="${C.mut}">${fmt(vmx)}</text><text x="${AW - 6}" y="${yv0}" text-anchor="end" font-size="8.5" fill="${C.mut}">0</text>`);
      if (accs.length) ax2.push(`<text x="${AW - 6}" y="${6 + H1_ + G + HV_ + G + 11}" text-anchor="end" font-size="9.5" fill="${C.poc}" font-weight="600">acc Δ</text><text x="${AW - 6}" y="${6 + H1_ + G + HV_ + G + 23}" text-anchor="end" font-size="8.5" fill="${a1 >= 0 ? C.buy : C.sell}">${fmt(a1, 1)}</text><text x="${AW - 6}" y="${DH - 4}" text-anchor="end" font-size="8.5" fill="${a0 >= 0 ? C.buy : C.sell}">${fmt(a0, 1)}</text>`);
      const da = $('dax'); da.setAttribute('width', AW); da.setAttribute('height', DH); da.innerHTML = ax2.join('');
      const dp = $('dpr'), tw = Math.max(Number($('prof').getAttribute('width') || 0), 300); dp.setAttribute('width', tw); dp.setAttribute('height', DH);
      // zmiany w ostatnich 5 / 15 / 30 / 60 min (świece M5 do ostatniej świecy widoku)
      const LB = cols[cols.length - 1].last, bv = i => { let v = 0, d = 0; for (const z of Object.values(boxLv(i))) { v += z[0] + z[1]; d += z[1] - z[0]; } return [v, d]; };
      const rowsW = [5, 15, 30, 60].map(n => { const k = n / 5, i0 = Math.max(0, LB - k + 1); let v = 0, d = 0, avg = 0, ok = true;
        for (let i = i0; i <= LB; i++) { const [vv, dd] = bv(i); v += vv; d += dd; const x = D.boxes[i][8]; if (x) avg += vv / x; else ok = false; }
        const accEnd = ACCB[LB], accStart = i0 > 0 ? ACCB[i0 - 1] : 0; return {n, d, v, x: ok && avg > 0 ? v / avg : null, a0: accStart, a1: accEnd}; });
      const cx = [8, 58, 128, 222];
      let tb = `<text x="${cx[0]}" y="16" font-size="9.5" font-weight="700" fill="${C.ink}">okno</text><text x="${cx[1]}" y="16" font-size="9.5" font-weight="700" fill="${C.ink}">Δ</text><text x="${cx[2]}" y="16" font-size="9.5" font-weight="700" fill="${C.ink}">acc Δ (od → do)</text><text x="${cx[3]}" y="16" font-size="9.5" font-weight="700" fill="${C.ink}">wolumen</text>`;
      rowsW.forEach((r, j) => { const yy = 36 + j * 22, col = r.d >= 0 ? C.buy : C.sell;
        tb += `<line x1="4" x2="${tw - 4}" y1="${yy - 14}" y2="${yy - 14}" stroke="${C.line}"/><text x="${cx[0]}" y="${yy}" font-size="10" fill="${C.mut}">${r.n} min</text><text x="${cx[1]}" y="${yy}" font-size="10.5" font-weight="700" fill="${col}">${fmt(r.d, 1)}</text>`;
        tb += `<text x="${cx[2]}" y="${yy}" font-size="10" fill="${C.ink}"><tspan fill="${r.a0 >= 0 ? C.buy : C.sell}">${fmt(r.a0, 1)}</tspan> → <tspan fill="${r.a1 >= 0 ? C.buy : C.sell}" font-weight="700">${fmt(r.a1, 1)}</tspan></text>`;
        tb += `<text x="${cx[3]}" y="${yy}" font-size="10" fill="${C.ink}">${fmt(r.v)}${r.x != null ? ` <tspan fill="${r.x >= 1.5 ? C.hot : C.mut}" font-weight="${r.x >= 1.5 ? 700 : 400}">×${r.x.toFixed(1).replace('.', ',')}</tspan>` : ''}</text>`; });
      tb += `<text x="8" y="${36 + 4 * 22}" font-size="9" fill="${C.mut}">do świecy ${cols[cols.length - 1].t}${M1 ? ' · M1: z footprintu M5' : ''} · ×N = wolumen / średnia 5 sesji</text>`;
      tb += `<text x="8" y="${DH - 30}" font-size="10" fill="${C.mut}">Δ w widoku: <tspan fill="${cols.reduce((a, c) => a + c.d, 0) >= 0 ? C.buy : C.sell}" font-weight="600">${fmt(cols.reduce((a, c) => a + c.d, 0), 1)}</tspan> · wol: <tspan fill="${C.ink}" font-weight="600">${fmt(cols.reduce((a, c) => a + c.v, 0))}</tspan></text><text x="8" y="${DH - 12}" font-size="10" fill="${C.mut}">acc Δ na końcu: <tspan fill="${(accs[accs.length - 1] ?? 0) >= 0 ? C.buy : C.sell}" font-weight="600">${accs.length ? fmt(accs[accs.length - 1], 1) : '–'}</tspan></text>`;
      dp.innerHTML = tb;
    } }
  { const want = S.vx !== false, row = $('vxrow'), has = cols.some(c => c.ve != null || c.vs != null);
    const on = want && INST !== 'VIX';
    row.hidden = !on; $('wrap').classList.toggle('vx-on', on);
    if (on) {
      const VH = 128, inv = S.vxInv !== false, pts = cols.map((c, i) => ({i, t: c.t, c: c.C, v: c.ve != null ? c.ve : c.vs, vs: c.vs, ve: c.ve}));
      const ok = pts.filter(p => p.v != null);
      const out = [], ax = [];
      if (ok.length < 2) {
        out.push(`<text x="12" y="64" font-size="11" fill="${C.mut}">Brak danych VIX w tym zakresie – panel pojawi się, gdy będzie przynajmniej kilka świec z VIX.</text>`);
      } else {
        const lo0 = Math.min(...ok.map(p => p.v)), hi0 = Math.max(...ok.map(p => p.v)), pd = Math.max((hi0 - lo0) * .08, 0.05);
        const lo = lo0 - pd, hi = hi0 + pd, rg = hi - lo || 1;
        const yv = v => inv ? (8 + (v - lo) / rg * (VH - 20)) : (VH - 12 - (v - lo) / rg * (VH - 20));
        const vo = DATA[S.day] && DATA[S.day].vix_open;
        if (vo != null && vo >= lo && vo <= hi) out.push(`<line x1="0" x2="${W}" y1="${yv(vo)}" y2="${yv(vo)}" stroke="${C.mut}" stroke-width=".8" stroke-dasharray="4 3"/>`);
        let d = '';
        pts.forEach(p => { if (p.v == null) return; d += `${d ? 'L' : 'M'}${p.i * CW + CW / 2},${yv(p.v)}`; });
        out.push(`<path d="${d}" fill="none" stroke="${C.vix}" stroke-width="2"/>`);
        pts.forEach(p => { if (p.v == null) return; out.push(`<circle cx="${p.i * CW + CW / 2}" cy="${yv(p.v)}" r="2.2" fill="${C.vix}"><title>${p.t}: VIX ${p.v.toFixed(2)}${p.c != null ? ` · ${INST} ${p.c}` : ''}</title></circle>`); });
        const last = ok[ok.length - 1];
        out.push(`<text x="${last.i * CW + CW / 2 + 6}" y="${Math.max(12, Math.min(VH - 6, yv(last.v) - 6))}" font-size="10" font-weight="700" fill="${C.vix}">${last.v.toFixed(2)}</text>`);
      }
      const pearson = (xs, ys) => { const n = xs.length; if (n < 5) return null; const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n; let num = 0, dx = 0, dy = 0; for (let i = 0; i < n; i++) { const a = xs[i] - mx, b = ys[i] - my; num += a * b; dx += a * a; dy += b * b; } const den = Math.sqrt(dx * dy); return den < 1e-12 ? null : num / den; };
      const rets = [];
      for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; if (a.v == null || b.v == null || !a.c || !b.c) continue; rets.push({rc: (b.c - a.c) / a.c, rv: (b.v - a.v) / a.v}); }
      const rSes = pearson(rets.map(q => q.rc), rets.map(q => q.rv));
      const last60 = rets.slice(-12), r60 = pearson(last60.map(q => q.rc), last60.map(q => q.rv));
      const fr = v => v == null ? '–' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2).replace('.', ',');
      const colr = v => v == null ? C.mut : v < -0.3 ? C.buy : v > 0.3 ? C.sell : C.ink;
      const vl = $('vln'); vl.setAttribute('width', W); vl.setAttribute('height', VH); vl.innerHTML = out.join('');
      if (ok.length >= 2) {
        const lo0 = Math.min(...ok.map(p => p.v)), hi0 = Math.max(...ok.map(p => p.v)), pd = Math.max((hi0 - lo0) * .08, 0.05), lo = lo0 - pd, hi = hi0 + pd;
        const topL = inv ? hi : lo, botL = inv ? lo : hi;
        ax.push(`<text x="${AW - 6}" y="14" text-anchor="end" font-size="9.5" fill="${C.vix}" font-weight="700">VIX${inv ? ' odwr.' : ''}</text>`);
        ax.push(`<text x="${AW - 6}" y="28" text-anchor="end" font-size="8.5" fill="${C.mut}">${topL.toFixed(2)}</text>`);
        ax.push(`<text x="${AW - 6}" y="${VH - 6}" text-anchor="end" font-size="8.5" fill="${C.mut}">${botL.toFixed(2)}</text>`);
      } else ax.push(`<text x="${AW - 6}" y="14" text-anchor="end" font-size="9.5" fill="${C.vix}" font-weight="700">VIX</text>`);
      const va = $('vax'); va.setAttribute('width', AW); va.setAttribute('height', VH); va.innerHTML = ax.join('');
      const tw = Math.max(Number($('prof').getAttribute('width') || 0), 300), vp = $('vpr');
      vp.setAttribute('width', tw); vp.setAttribute('height', VH);
      let tb = `<text x="10" y="18" font-size="10" font-weight="700" fill="${C.vix}">korelacja ${INST} × VIX</text>`;
      tb += `<text x="10" y="40" font-size="12" font-weight="700" fill="${colr(rSes)}">sesja  r = ${fr(rSes)}</text><text x="10" y="54" font-size="9.5" fill="${C.mut}">zwroty M5, n = ${rets.length}</text>`;
      tb += `<text x="10" y="76" font-size="12" font-weight="700" fill="${colr(r60)}">60 min  r = ${fr(r60)}</text><text x="10" y="90" font-size="9.5" fill="${C.mut}">ostatnie ${last60.length} zwrotów (rolling)</text>`;
      tb += `<text x="10" y="${VH - 10}" font-size="9" fill="${C.mut}">${inv ? 'oś VIX odwrócona · ' : ''}typowa relacja: r < 0 · opis, nie sygnał</text>`;
      vp.innerHTML = tb;
    } }
  const ft = $('ftr'); ft.setAttribute('width', W); ft.setAttribute('height', FH); ft.innerHTML = of.join('');
  const bc = $('bcorner'); bc.setAttribute('width', AW); bc.setAttribute('height', FH);
  bc.innerHTML = `<text x="${AW - 6}" y="15" text-anchor="end" font-size="9.5" fill="${C.mut}">czas PL</text><text x="${AW - 6}" y="35" text-anchor="end" font-size="9.5" fill="${C.vix}">VIX (Δ)</text><text x="${AW - 6}" y="50" text-anchor="end" font-size="9.5" fill="${C.mut}">potw. VIX</text>`;
  // profile przyklejone do prawej: przed sesją kasową / sesja kasowa / cała doba – obok siebie
  const PV = 270, PW = 300, pB = HEAD + H + FOOT;
  const firstR = D.boxes.findIndex(b => b[9]), lastR = D.boxes.length - 1 - [...D.boxes].reverse().findIndex(b => b[9]);
  const LI = cols[cols.length - 1].last;
  const SEG = [
    ...(() => { const NO = nightOf(DATA, S.day); if (!NO) return [['pre', 'Noc (przed sesją)', () => false]]; const cut = NO.n0 + Math.min(firstR, RL + 1);   // świece D-1 po sesji + doby do otwarcia, w odtwarzaniu do świecy w widoku
      return [['pre', `Noc ${NO.from}${NO.prev ? ' D-1' : ''} – ${D.boxes[firstR][0]}`, i => i < cut, NO]]; })(), ['rth', 'Sesja kasowa', i => D.boxes[i][9] === 1 && i <= RL], ['day', 'Cała doba', i => i <= RL],
    ...(S.sel && S.sel.day === S.day ? [['sel', `Zaznaczenie ${D.boxes[S.sel.a][0]}–${D.boxes[S.sel.b][0]}`, i => i >= S.sel.a && i <= S.sel.b && i <= RL]] : []),
    ...[60, 90, 120, 180, 240].map(n => ['p' + n, `Ostatnie ${n} min`, i => i <= LI && i > LI - n / 5]),
    ...(() => { const ds = Object.keys(DATA).sort(), j = ds.indexOf(S.day), pd = j > 0 ? ds[j - 1] : null; if (!pd) return []; const P = DATA[pd], lab = `${pd.slice(8)}.${pd.slice(5, 7)}`;
      return [['d1', `D-1 ${lab} cała doba`, () => true, P], ['d1r', `D-1 ${lab} sesja kasowa`, i => P.boxes[i][9] === 1, P]]; })(),
    ...(() => { if (!S.pf.c5) return []; const ds = Object.keys(DATA).sort(), j = ds.indexOf(S.day), use = ds.slice(Math.max(0, j - 4), j + 1), boxes = [], cells = [];   // profil złożony z 5 ostatnich sesji
      for (const dk of use) { const P = DATA[dk], o_ = boxes.length; P.boxes.forEach((b, i) => boxes.push(dk === S.day && i > RL ? null : b)); for (const c of P.cells) cells.push([c[0] + o_, c[1], c[2], c[3]]); }
      const B2 = boxes.map(b => b || [null, 0, -1e9, 1e9, 0, null, null, null, null, 0]);
      return [['c5', `5 sesji ${use[0].slice(8)}.${use[0].slice(5, 7)}–${use[use.length - 1].slice(8)}.${use[use.length - 1].slice(5, 7)}`, i => boxes[i] != null, {boxes: B2, cells}]]; })()].filter(q => q[0] === 'sel' || S.pf[q[0]]);
  const PB = [], PH = [], PF = [], TVCHART = []; LASTP = [];
  SEG.forEach(([key, title, sel, DD_], si) => {
    const DD = DD_ || D, off = si * PW, prof = new Map(), idx = DD.boxes.map((_, i) => i).filter(sel);
    if (!idx.length) { PH.push(`<g transform="translate(${off},0)"><text x="${PW / 2}" y="18" text-anchor="middle" font-size="10.5" font-weight="600" fill="${C.ink}">${title}</text><text x="${PW / 2}" y="34" text-anchor="middle" font-size="9.5" fill="${C.mut}">brak świec</text></g>`); return; }
    const inSel = new Set(idx);
    for (const [bi, p, bid, ask] of DD.cells) { if (!inSel.has(bi)) continue; const k = Q(Math.floor(p / bin + 1e-9) * bin), z = prof.get(k) || {v: 0, d: 0, bid: 0, ask: 0}; z.v += bid + ask; z.d += ask - bid; z.bid += bid; z.ask += ask; prof.set(k, z); }
    const ks = [...prof.keys()].sort((a, b) => a - b), vs = ks.map(k => prof.get(k).v), tot_ = vs.reduce((a, b) => a + b, 0);
    let pi = vs.indexOf(Math.max(...vs)), a0 = pi, a1 = pi, accv = vs[pi];
    while (accv < .7 * tot_ && (a0 > 0 || a1 < ks.length - 1)) { const up = a1 < ks.length - 1 ? vs[a1 + 1] : -1, dn = a0 > 0 ? vs[a0 - 1] : -1; if (up >= dn) accv += vs[++a1]; else accv += vs[--a0]; }
    const pvmax = vs[pi], pr = [], pid = 'lvnp' + si;
    LASTP.push({off, title, prof, poc: ks[pi], val: ks[a0], vah: ks[a1] + bin, tot: tot_, pmax: pvmax});
    // TPO odcinka (okresy 30 min) i strefy rozbieżności czas / wolumen
    const tpo = new Map(), per = new Map();
    for (const i of idx) { const b = DD.boxes[i], key = b[11] + (Number(b[0].slice(3)) < 30 ? 'a' : 'b'), q = per.get(key) || [1e9, -1e9]; per.set(key, [Math.min(q[0], b[3]), Math.max(q[1], b[2])]); }
    for (const [L, H_] of per.values()) for (let k = Q(Math.floor(L / bin + 1e-9) * bin); k <= Q(Math.floor(H_ / bin + 1e-9) * bin); k = Q(k + bin)) tpo.set(k, (tpo.get(k) || 0) + 1);
    const tmax = Math.max(1, ...tpo.values()), TV = [];
    if (S.tv) {                           // najwyższe TPO (≥ 80% maksimum, ciągły obszar wokół maksimum) i najniższe TPO (poziomy odwiedzone tylko w 1 okresie 30 min, ciągi ≥ 2)
      const all = [...tpo.keys()].sort((a, b) => a - b), tk = all.reduce((m, k) => tpo.get(k) > tpo.get(m) ? k : m, all[0]);
      let l0 = tk, l1 = tk; while (tpo.get(Q(l0 - bin)) >= .8 * tmax) l0 = Q(l0 - bin); while (tpo.get(Q(l1 + bin)) >= .8 * tmax) l1 = Q(l1 + bin);
      TV.push({lo: l0, hi: l1 + bin, typ: 1});
      let run = [];
      for (const k of all.concat([null])) { if (k != null && tpo.get(k) === 1 && (!run.length || k - run[run.length - 1] === bin)) { run.push(k); continue; }
        if (run.length >= 2) TV.push({lo: run[0], hi: run[run.length - 1] + bin, typ: -1}); run = k != null && tpo.get(k) === 1 ? [k] : []; }
      if (si === 0) TVCHART.push(...TV.map(z => ({...z, title})));
    }
    pr.push(`<defs><pattern id="${pid}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="${C.lvn}" opacity=".08"/><line x1="0" y1="0" x2="0" y2="6" stroke="${C.lvn}" stroke-width="1.6" opacity=".45"/></pattern></defs>`);
    pr.push(`<rect x="0" y="${y(ks[a1] + bin)}" width="${PV}" height="${y(ks[a0]) - y(ks[a1] + bin)}" fill="${C.va}" opacity=".12"/>`);
    const nd = S.nodes ? nodes(new Map(ks.map(k => [k, prof.get(k).v])), bin) : {hvn: [], lvn: []};
    for (const [arr, col, lab] of [[nd.hvn, C.hvn, 'HVN'], [nd.lvn, C.lvn, 'LVN']]) for (const [p0, p1] of arr) if (p1 >= lo && p0 <= hi) pr.push(`<rect x="146" y="${y(p1)}" width="${PV - 186}" height="${y(p0) - y(p1)}" fill="${lab === 'HVN' ? col : `url(#${pid})`}" opacity="${lab === 'HVN' ? .16 : .9}" stroke="${col}" stroke-width="1" ${lab === 'LVN' ? 'stroke-dasharray="4 3"' : ''}/>`);
    const pdm = Math.max(1, ...ks.map(k => Math.abs(prof.get(k).d))), PI = imbalances({lv: prof}, bin);
    const psmax = Math.max(1, ...ks.map(k => Math.max(prof.get(k).bid, prof.get(k).ask)));
    if (S.tree) pr.push(`<line x1="${150 + (PV - 190) * (S.treeV ? .3 : .5)}" x2="${150 + (PV - 190) * (S.treeV ? .3 : .5)}" y1="${HEAD}" y2="${HEAD + H}" stroke="${C.mut}" stroke-width=".8" opacity=".6"/>`);
    ks.forEach((k, j) => {
      if (k < lo || k + bin > hi) return;
      const z = prof.get(k), yy = y(k + bin), ym = yy + RH / 2 + 3.5, inVA = j >= a0 && j <= a1, BX = 150, BW = PV - BX - 40, w = BW * z.v / pvmax, ib = PI.buy.has(k), is_ = PI.sell.has(k);
      pr.push(`<g><title>${title} ${k}${bin > 1 ? '–' + (k + bin) : ''}: bid ${z.bid}, ask ${z.ask}, Δ ${z.d > 0 ? '+' : ''}${z.d}, wol ${z.v}</title>`);
      pr.push(`<rect x="4" y="${yy + .5}" width="${BX - 8}" height="${RH - 1}" fill="${z.d >= 0 ? C.buy : C.sell}" opacity="${(Math.min(Math.abs(z.d) / pdm, 1) * .45).toFixed(3)}"/>`);
      pr.push(`<text x="8" y="${ym}" font-size="10" font-weight="600" fill="${z.d > 0 ? C.buy : z.d < 0 ? C.sell : C.mut}">${z.d > 0 ? '+' : ''}${z.d}</text>`);
      pr.push(`<text x="${BX / 2 + 16}" y="${ym}" font-size="10" text-anchor="end" fill="${is_ ? C.sell : C.ink}" font-weight="${is_ ? 700 : 400}">${z.bid}</text><text x="${BX / 2 + 22}" y="${ym}" font-size="9" text-anchor="middle" fill="${C.mut}">×</text><text x="${BX / 2 + 28}" y="${ym}" font-size="10" fill="${ib ? C.buy : C.ink}" font-weight="${ib ? 700 : 400}">${z.ask}</text>`);
      if (S.tree) {   // drzewo bid × ask: od osi środkowej bid w lewo, ask w prawo, wspólna skala dla obu stron
        const TWd = S.treeV ? BW * .6 : BW, cx2 = BX + TWd / 2, half = TWd / 2 - 2, wb = half * z.bid / psmax, wa = half * z.ask / psmax, op = inVA ? .75 : .45;
        if (S.treeV) { const vx = BX + BW * .63, vw = BW * .37 * z.v / pvmax; pr.push(`<rect x="${vx}" y="${yy + 1}" width="${vw}" height="${RH - 2}" fill="${j === pi ? C.poc : inVA ? C.va : C.bar}" opacity="${j === pi ? .85 : inVA ? .55 : .4}"/>`); }
        pr.push(`<rect x="${cx2 - wb}" y="${yy + 1}" width="${wb}" height="${RH - 2}" fill="${C.sell}" opacity="${op}"/><rect x="${cx2}" y="${yy + 1}" width="${wa}" height="${RH - 2}" fill="${C.buy}" opacity="${op}"/>`);
        if (j === pi) pr.push(`<rect x="${cx2 - wb - 1}" y="${yy + .5}" width="${wb + wa + 2}" height="${RH - 1}" fill="none" stroke="${C.poc}" stroke-width="1.6"/>`);
      } else
      pr.push(`<rect x="${BX}" y="${yy + 1}" width="${w}" height="${RH - 2}" fill="${j === pi ? C.poc : inVA ? C.va : C.bar}" opacity="${j === pi ? .85 : inVA ? .55 : .4}"/>`);
      pr.push(`<text x="${PV - 4}" y="${ym}" text-anchor="end" font-size="9.5" fill="${j === pi ? C.poc : C.mut}" font-weight="${j === pi ? 600 : 400}">${z.v}</text></g>`);
    });
    if (S.z) for (const zn of PI.zones) if (zn.hi > lo && zn.lo < hi) { const col = zn.side > 0 ? C.buy : C.sell;
      pr.push(`<rect x="3" y="${y(zn.hi)}" width="143" height="${y(zn.lo) - y(zn.hi)}" fill="none" stroke="${col}" stroke-width="2.2" rx="2"/><text x="6" y="${zn.side > 0 ? y(zn.lo) + 11 : y(zn.hi) - 3}" font-size="9.5" font-weight="700" fill="${col}" paint-order="stroke" stroke="${css('--panel')}" stroke-width="3">${zn.side > 0 ? 'kupno' : 'sprzedaż'} ×${zn.n} ${zn.lo}–${zn.hi}</text>`); }
    if (S.ua) for (const [k, side] of [[ks[ks.length - 1], 1], [ks[0], -1]]) { const z = prof.get(k); if (z && z.bid > 0 && z.ask > 0 && k >= lo && k + bin <= hi) pr.push(`<rect x="3" y="${y(k + bin)}" width="${PV - 6}" height="${RH}" fill="none" stroke="${C.ua}" stroke-width="2" stroke-dasharray="2 2"/><text x="${PV - 44}" y="${side > 0 ? y(k + bin) - 3 : y(k) + 11}" text-anchor="end" font-size="9.5" font-weight="700" fill="${C.ua}" paint-order="stroke" stroke="${css('--panel')}" stroke-width="3">UA ${side > 0 ? '▲ ' + (k + bin) : '▼ ' + k}</text>`); }
    for (const z of TV) if (z.hi > lo && z.lo < hi) { const col = z.typ > 0 ? C.tvt : C.tvv;
      pr.push(`<rect x="1" y="${y(z.hi)}" width="${PV - 2}" height="${y(z.lo) - y(z.hi)}" fill="${col}" opacity=".16" stroke="${col}" stroke-width="1.6"/><text x="${PV - 4}" y="${y(z.lo) - 3}" text-anchor="end" font-size="9.5" font-weight="700" fill="${col}" paint-order="stroke" stroke="${css('--panel')}" stroke-width="3">${z.typ > 0 ? 'TPO max' : 'TPO min'} ${z.lo}–${z.hi}</text>`); }
    for (const [k, lab, col] of [[ks[a1] + bin, 'VAH', C.va], [ks[pi] + bin / 2, 'POC', C.poc], [ks[a0], 'VAL', C.va]]) if (k >= lo && k <= hi) pr.push(`<line x1="0" x2="${PV}" y1="${y(k)}" y2="${y(k)}" stroke="${col}" stroke-width="1.2" stroke-dasharray="${lab === 'POC' ? '' : '4 3'}"/><text x="${PV - 44}" y="${y(k) - 3}" text-anchor="end" font-size="9.5" font-weight="600" fill="${col}" paint-order="stroke" stroke="${css('--panel')}" stroke-width="3">${lab} ${lab === 'POC' ? ks[pi] : k}</text>`);
    for (const [arr, col, lab] of [[nd.hvn, C.hvn, 'HVN'], [nd.lvn, C.lvn, 'LVN']]) for (const [p0, p1] of arr) if (p1 >= lo && p0 <= hi) pr.push(`<text x="${PV - 42}" y="${y(p1) + 10}" text-anchor="end" font-size="9.5" font-weight="600" fill="${col}" paint-order="stroke" stroke="${css('--panel')}" stroke-width="3">${lab} ${p0}–${p1}</text>`);
    // EM i ATR na profilach bieżącego dnia (linie przez cały profil i świecę dnia)
    if (!DD_ || DD_ === D) {
      const PL_ = [];
      if (S.opt && DATA[S.day].opt) { const O2 = DATA[S.day].opt; for (const [v, lab, st] of [[O2.emH, `EM +${O2.em}`, ''], [O2.emL, `EM −${O2.em}`, ''], [O2.F, 'środek EM', '1 3']]) if (v != null) PL_.push([v, C.opt, st, lab]); }
      if (S.atr && ATRV) PL_.push([ATRV.up, C.atr, '', `ATR5 ↑ ${ATRV.up.toFixed(0)}`], [ATRV.dn, C.atr, '', `ATR5 ↓ ${ATRV.dn.toFixed(0)}`]);
      const PG_ = [];   // GEX i ściany z opcji DN – na profilu całej doby (etykiety z lewej, żeby nie nachodziły na EM)
      if (key === 'day' && S.opt && DATA[S.day].opt) { const O2 = DATA[S.day].opt; for (const [v, lab, st] of [[O2.cw, 'ściana calli', '7 3'], [O2.pw, 'ściana putów', '7 3'], [O2.flip, 'flip GEX', '2 2'], [O2.gmin, 'najgłębszy GEX', '4 2 1 2']]) if (v != null) PG_.push([v, lab, st]); }
      const seenY = [];
      for (const [v, lab, st] of PG_) if (v >= lo && v <= hi) { const yy = y(v), dup = seenY.filter(q => Math.abs(q - yy) < 11).length; seenY.push(yy); const wg = typeof WGT === 'function' ? WGT(v) : {w: 1};
        pr.push(`<g><title>${lab} ${v.toFixed(DEC)} (opcje DN, zrzut ${DATA[S.day].opt.snap}, GEX ${DATA[S.day].opt.gex} mld $)${wg.w >= 2 ? ' · waga ' + wg.w : ''}</title><line x1="0" x2="${PV}" y1="${yy}" y2="${yy}" stroke="${C.opt}" stroke-width="${wg.w >= 3 ? 3 : wg.w === 2 ? 2.2 : 1.6}" stroke-dasharray="${st}"/><text x="4" y="${yy - 3 + dup * 11}" font-size="9.5" font-weight="${wg.w >= 2 ? 900 : 700}" fill="${C.opt}" paint-order="stroke" stroke="${css('--panel')}" stroke-width="3">${wg.w >= 2 ? '★'.repeat(Math.min(wg.w, 5)) + ' ' : ''}${lab} ${v.toFixed(0)}</text></g>`); }
      for (const [v, col, st, lab] of PL_) if (v >= lo && v <= hi) pr.push(`<line x1="0" x2="${PW}" y1="${y(v)}" y2="${y(v)}" stroke="${col}" stroke-width="1.6" ${st ? `stroke-dasharray="${st}"` : ''}/><text x="146" y="${y(v) - 3}" text-anchor="end" font-size="9.5" font-weight="700" fill="${col}" paint-order="stroke" stroke="${css('--panel')}" stroke-width="3">${lab}</text>`);
    }
    // świeca segmentu (OHLC)
    const B = idx.map(i => DD.boxes[i]), dO = B[0][1], dC = B[B.length - 1][4], dH = Math.max(...B.map(b => b[2])), dL = Math.min(...B.map(b => b[3])), col = dC >= dO ? C.buy : C.sell, cx = PV + 15;
    pr.push(`<line x1="${PV}" x2="${PV}" y1="0" y2="${pB}" stroke="${C.line}"/><line x1="${PW}" x2="${PW}" y1="0" y2="${pB}" stroke="${C.line}"/><g><title>${title}: O ${dO} · H ${dH} · L ${dL} · C ${dC}</title><line x1="${cx}" x2="${cx}" y1="${y(Math.min(dH, hi))}" y2="${y(Math.max(dL, lo))}" stroke="${col}" stroke-width="1.6"/>`);
    pr.push(`<rect x="${cx - 7}" y="${y(Math.min(Math.max(dO, dC), hi))}" width="14" height="${Math.max(y(Math.max(Math.min(dO, dC), lo)) - y(Math.min(Math.max(dO, dC), hi)), 1.5)}" fill="${col}" opacity=".9"/></g>`);
    pr.push(`<line x1="0" x2="${PV}" y1="${y(LP)}" y2="${y(LP)}" stroke="${C.ink}" stroke-width="1" stroke-dasharray="2 3"/>`);
    if (si === SEG.length - 1) pr.push(`<rect x="${PV - 58}" y="${y(LP) - 8}" width="56" height="16" rx="3" fill="${C.ink}"/><text x="${PV - 30}" y="${y(LP) + 3.5}" text-anchor="middle" font-size="10" font-weight="600" fill="${css('--panel')}">${PXF(LP)}</text>`);
    PB.push(`<g transform="translate(${off},0)">${pr.join('')}</g>`);
    const dlt = ks.reduce((a, k) => a + prof.get(k).d, 0);
    PH.push(`<g transform="translate(${off},0)"><line x1="${PW}" x2="${PW}" y1="0" y2="${HH + 8}" stroke="${C.line}"/><text x="${PW / 2}" y="16" text-anchor="middle" font-size="10.5" font-weight="600" fill="${C.ink}">${title} · <tspan fill="${dlt >= 0 ? C.buy : C.sell}">Δ ${fmt(dlt, 1)}</tspan></text><text x="${PW / 2}" y="31" text-anchor="middle" font-size="9.5" fill="${C.mut}">wol ${fmt(tot_)} · imbalanse ${PI.buy.size}↑ ${PI.sell.size}↓ · stref ${PI.zones.length}</text><text x="${PW / 2}" y="45" text-anchor="middle" font-size="9.5" fill="${C.mut}">VA ${ks[a0]}–${ks[a1] + bin} · POC ${ks[pi]} · ${B[0][0]}–${B[B.length - 1][0]}</text></g>`);
    // zgodność z VIX (przed sesją, sesja kasowa, cała doba): zmiana ceny vs zmiana VIX w tym zakresie + korelacja zmian 5 min
    let vxT = '';
    if ((['pre', 'rth', 'day', 'sel'].includes(key) || /^p\d+$/.test(key)) && S.inst === 'US500') {   // także Last 60–240 min i zaznaczenie   // tylko US500 (VIX = zmienność S&P 500)
      const vb = B.filter(q => q[13] != null && q[14] != null);
      if (vb.length < 3) vxT = `<text x="${PV / 2}" y="34" text-anchor="middle" font-size="9.5" fill="${C.mut}">VIX: brak danych dla tego zakresu</text>`;
      else {
        const v0 = vb[0][13], v1 = vb[vb.length - 1][14], dV = v1 - v0, dP = B[B.length - 1][4] - B[0][1], tP = (B.reduce((a, q) => a + (q[2] - q[3]), 0) / B.length) * .5;
        const xs = vb.map(q => q[4] - q[1]), ys = vb.map(q => q[14] - q[13]), mx_ = xs.reduce((a, v) => a + v, 0) / xs.length, my_ = ys.reduce((a, v) => a + v, 0) / ys.length;
        const cv = xs.reduce((a, v, i) => a + (v - mx_) * (ys[i] - my_), 0), sx = Math.sqrt(xs.reduce((a, v) => a + (v - mx_) ** 2, 0)), sy = Math.sqrt(ys.reduce((a, v) => a + (v - my_) ** 2, 0)), r = sx && sy ? cv / sx / sy : 0;
        const pF = Math.abs(dP) < tP ? 0 : Math.sign(dP), vF = Math.abs(dV) < .1 ? 0 : Math.sign(dV);
        let lab, col;
        const EQ = !['GOLD', 'VIX'].includes(S.inst);   // relacja odwrotna cena–VIX dotyczy indeksów akcji
        if (!EQ) { lab = `kierunek: cena ${pF > 0 ? '↑' : pF < 0 ? '↓' : '→'}, VIX ${vF > 0 ? '↑' : vF < 0 ? '↓' : '→'} `; col = C.mut; }
        else if (!pF || !vF) { lab = !pF && !vF ? 'cena i VIX bez wyraźnej zmiany' : !pF ? `cena bez zmian, VIX ${vF > 0 ? '↑' : '↓'}` : `cena ${pF > 0 ? '↑' : '↓'}, VIX bez zmian`; col = C.mut; }
        else if (pF !== vF) { lab = `zgodne: cena ${pF > 0 ? '↑' : '↓'} VIX ${vF > 0 ? '↑' : '↓'}`; col = C.buy; }
        else { lab = `rozbieżne: cena ${pF > 0 ? '↑' : '↓'} i VIX ${vF > 0 ? '↑' : '↓'}`; col = C.sell; }
        const tt = `VIX ${v0.toFixed(2)} → ${v1.toFixed(2)} (${dV >= 0 ? '+' : '−'}${Math.abs(dV).toFixed(2)}), cena ${dP >= 0 ? '+' : '−'}${Math.abs(dP).toFixed(DEC)} pkt. Zgodne = ruch w przeciwnych kierunkach (typowa relacja indeksu i VIX). Rozbieżne = w tym samym kierunku. Próg: VIX ±0,10, cena ±0,5 średniego zakresu świecy 5 min. r = korelacja zmian 5 min ceny i VIX w zakresie (typowo ujemna). ${EQ ? '' : 'Dla tego instrumentu bez oceny zgodne/rozbieżne – relacja odwrotna z VIX dotyczy indeksów akcji. '}Opis, nie testowane jako sygnał.`;
        vxT = `<g><title>${tt}</title><text x="${PV / 2}" y="34" text-anchor="middle" font-size="9.5" font-weight="700" fill="${col}">VIX · ${lab}</text><text x="${PV / 2}" y="49" text-anchor="middle" font-size="9.5" fill="${C.mut}">VIX ${v0.toFixed(2)}→${v1.toFixed(2)} (${dV >= 0 ? '+' : '−'}${Math.abs(dV).toFixed(2)}) · r 5 min ${r >= 0 ? '+' : '−'}${Math.abs(r).toFixed(2).replace('.', ',')}</text></g>`; } }
    PF.push(`<g transform="translate(${off},0)"><line x1="${PV}" x2="${PV}" y1="0" y2="${FH}" stroke="${C.line}"/><line x1="${PW}" x2="${PW}" y1="0" y2="${FH}" stroke="${C.line}"/><text x="${cx}" y="15" text-anchor="middle" font-size="9.5" fill="${C.mut}">${key === 'day' ? 'D1' : key === 'rth' ? 'RTH' : key === 'pre' ? 'ETH' : key === 'c5' ? '5 D' : key === 'sel' ? 'zazn.' : key === 'd1' ? 'D-1' : key === 'd1r' ? 'D-1 RTH' : key.slice(1) + "'"}</text><text x="${PV / 2}" y="15" text-anchor="middle" font-size="9.5" fill="${C.mut}">O ${dO} · H ${dH} · L ${dL} · C ${dC}</text>${vxT}</g>`);
  });
  if (S.tv && TVCHART.length) { const g = TVCHART.map(z => { const col = z.typ > 0 ? C.tvt : C.tvv; return `<g><title>${z.title}: ${z.typ > 0 ? 'TPO max – tu cena spędziła najwięcej czasu' : 'TPO min – cena była tu tylko w jednym okresie 30 min'} ${z.lo}–${z.hi}</title><rect x="0" y="${y(z.hi)}" width="${W}" height="${y(z.lo) - y(z.hi)}" fill="${col}" opacity=".07"/><line x1="0" x2="${W}" y1="${y(z.hi)}" y2="${y(z.hi)}" stroke="${col}" stroke-width="1" stroke-dasharray="1 3"/><line x1="0" x2="${W}" y1="${y(z.lo)}" y2="${y(z.lo)}" stroke="${col}" stroke-width="1" stroke-dasharray="1 3"/></g>`; }).join('');
    $('fp').insertAdjacentHTML('afterbegin', `<g clip-path="url(#plotclip)">${g}</g>`); }
  // okna przepływu (10 dni i intraday): OHLC, delta, delta skumulowana, wolumen na wspólnej osi kolumn
  const fmN = v => { const a = Math.abs(v), sg = v > 0 ? '+' : v < 0 ? '−' : ''; return sg + (a >= 1e6 ? (a / 1e6).toFixed(2) + ' mln' : a >= 1e4 ? (a / 1e3).toFixed(1) + ' tys.' : Math.round(a)); };
  const flowPanels = (dd, o) => {   // dd: [{lab, o,h,l,c, dl, vol, cum, cur, rv}], o: {unit, ohlcT, dT, cT, vT, every}
    const fm = fmN, Wd = 520, pl = 8, pr = 80, n = dd.length, cw = (Wd - pl - pr) / Math.max(n, 1), cx = i => pl + cw * (i + .5), fp = v => (+v).toFixed(DEC);
    const tip = x => `${x.lab}${x.cur ? (Number.isFinite(RL) ? ' (do ' + LT + ')' : ' (w toku)') : ''}: O ${fp(x.o)} · H ${fp(x.h)} · L ${fp(x.l)} · C ${fp(x.c)} · delta ${fm(x.dl)} · wolumen ${fm(x.vol).replace('+', '')} (${x.rv ? (x.rv * 100).toFixed(0) + '% średniej' : '–'}) · delta/wolumen ${(x.vol ? x.dl / x.vol * 100 : 0).toFixed(1)}% · skumulowana ${fm(x.cum)}`;
    const hit = (x, i, H) => `<title>${tip(x)}</title><rect x="${cx(i) - cw / 2}" y="0" width="${cw}" height="${H}" fill="transparent"/>`;
    const XG = 'fp' + (++XHN), XL = dd.map(x => x.lab).join('|');
    const svg = (H, g, a) => `<svg viewBox="0 0 ${Wd} ${H}" width="100%" height="${H}" style="display:block;overflow:visible;cursor:crosshair"${xhA({x0: pl, x1: Wd - pr, y0: 14, y1: H - 6, xg: XG, xl: XL, xm: 'c', ...a, last: null})}>${g}</svg>`;
    const panel = (H, vals, kind) => { const top = 14, bot = H - 6;
      if (kind === 'ohlc') { const ok = dd.filter(x => x.h != null), mv = dd.flatMap(x => [x.ma10, x.ma20]).filter(v => v != null), L0 = Math.min(...ok.map(x => x.l), ...mv), H0 = Math.max(...ok.map(x => x.h), ...mv), pp = v => bot - (v - L0) / (H0 - L0 || 1) * (bot - top); let g = '';
        dd.forEach((x, i) => { if (x.h == null) return; const col = x.c >= x.o ? 'buy' : 'sell', bw = Math.max(1.5, Math.min(20, cw * .55)), op = x.cur ? .55 : 1;
          g += `<g>${hit(x, i, H)}<line x1="${cx(i)}" x2="${cx(i)}" y1="${pp(x.h)}" y2="${pp(x.l)}" stroke="var(--${col})" stroke-width="${cw < 6 ? 1 : 1.5}" opacity="${op}"/><rect x="${cx(i) - bw / 2}" y="${pp(Math.max(x.o, x.c))}" width="${bw}" height="${Math.max(1.5, Math.abs(pp(x.o) - pp(x.c)))}" rx="${cw < 8 ? 0.5 : 2}" fill="var(--${col})" opacity="${op}"/></g>`; });
        for (const [key, col, lab] of [['ma10', '--pxl', 'MA10'], ['ma20', '--hot', 'MA20']]) { const pts = dd.map((x, i) => x[key] != null ? [cx(i), pp(x[key]), x[key]] : null).filter(Boolean);   // v1.7 średnie zamknięć dziennych
          if (pts.length > 1) g += `<polyline points="${pts.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ')}" fill="none" stroke="var(${col})" stroke-width="1.8" stroke-linejoin="round"><title>${lab} – średnia z ${lab.slice(2)} zamknięć dziennych</title></polyline>`;
          if (pts.length) { const q = pts[pts.length - 1]; g += `<circle cx="${q[0]}" cy="${q[1]}" r="2.5" fill="var(${col})"/>`; } }
        const lc = ok[ok.length - 1];
        { // etykiety z prawej: zamknięcie, MA10, MA20 – rozsunięte co najmniej o 12 px
          const lab = [{y: pp(lc.c), t: fp(lc.c), c: '--ink', fs: 11.5}, ...[['ma10', '--pxl', 'MA10'], ['ma20', '--hot', 'MA20']].filter(([k]) => lc[k] != null).map(([k, c, l]) => ({y: pp(lc[k]), t: `${l} ${fp(lc[k])}`, c, fs: 10}))].sort((a, b) => a.y - b.y);
          for (let q = 1; q < lab.length; q++) if (lab[q].y - lab[q - 1].y < 12) lab[q].y = lab[q - 1].y + 12;
          const over = lab.length ? lab[lab.length - 1].y - (bot + 2) : 0; if (over > 0) lab.forEach(q => { q.y -= over; });
          for (const q of lab) g += `<text x="${Wd - pr + 8}" y="${q.y + 4}" font-size="${q.fs}" font-weight="700" fill="var(${q.c})">${q.t}</text>`; }
        g += `<text x="${Wd - pr + 8}" y="${top}" font-size="10" fill="var(--mut)">${fp(H0)}</text><text x="${Wd - pr + 8}" y="${bot + 4}" font-size="10" fill="var(--mut)">${fp(L0)}</text>`;
        return svg(H, g, {v0: L0, v1: H0, f: 'p'}); }
      const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals, 1), sc = v => bot - (v - lo) / (hi - lo || 1) * (bot - top), z = sc(0);
      let g = `<line x1="${pl}" x2="${Wd - pr + 4}" y1="${z}" y2="${z}" stroke="var(--mut)" stroke-width="1" opacity=".6"/>`;
      if (kind !== 'line') dd.forEach((x, i) => { const v = vals[i], y1 = sc(v), bw = Math.max(1.5, Math.min(28, cw * .62)), col = kind === 'vol' ? 'bar' : v >= 0 ? 'buy' : 'sell';
        g += `<g>${hit(x, i, H)}<rect x="${cx(i) - bw / 2}" y="${Math.min(z, y1)}" width="${bw}" height="${Math.max(1, Math.abs(y1 - z))}" rx="${cw < 8 ? 0.5 : 3}" fill="var(--${col})" opacity="${x.cur ? .55 : 1}"/></g>`; });
      if (kind === 'vol') { const done = dd.filter(x => !x.cur), av = (done.length ? done : dd).reduce((a, x) => a + x.vol, 0) / Math.max(1, (done.length ? done : dd).length);
        g += `<line x1="${pl}" x2="${Wd - pr + 4}" y1="${sc(av)}" y2="${sc(av)}" stroke="var(--va)" stroke-width="1.5" stroke-dasharray="4 3"><title>średni wolumen ${o.unit}: ${fm(av).replace('+', '')}</title></line><text x="${Wd - pr + 8}" y="${sc(av) + 4}" font-size="10.5" fill="var(--va)">śr. ${fm(av).replace('+', '')}</text>`; }
      if (kind === 'line') { g += `<polyline points="${dd.map((x, i) => cx(i) + ',' + sc(x.cum)).join(' ')}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/>`;
        const r = Math.min(4, Math.max(0, cw / 3 - .5));
        dd.forEach((x, i) => { g += `<g>${hit(x, i, H)}${r >= 1.5 ? `<circle cx="${cx(i)}" cy="${sc(x.cum)}" r="${r}" fill="var(--${x.cum >= 0 ? 'buy' : 'sell'})" stroke="var(--panel)" stroke-width="${r > 2.5 ? 2 : 1}"/>` : ''}</g>`; }); }
      if (kind !== 'vol') { const last = vals[vals.length - 1]; g += `<text x="${Wd - pr + 8}" y="${sc(last) + 4}" font-size="11.5" font-weight="700" fill="var(--ink)">${fm(last)}</text>`; }
      return svg(H, g, {v0: lo, v1: hi, f: 'n', last: kind === 'vol'}); };
    const ev = o.every || 1;
    return `<div class="dlt">${o.ohlcT}</div>${panel(110, [], 'ohlc')}<div class="dlt">${o.dT}</div>${panel(96, dd.map(x => x.dl), 'bar')}<div class="dlt">${o.cT}</div>${panel(96, dd.map(x => x.cum), 'line')}<div class="dlt">${o.vT}</div>${panel(80, dd.map(x => x.vol), 'vol')}`
      + `<div class="dlx" style="padding-right:${pr}px">${dd.map((x, i) => `<span${x.cur ? ' class="cur"' : ''}>${i % ev === 0 || i === n - 1 && ev === 1 ? x.lab : ''}</span>`).join('')}</div>`; };
  const relVol = dd => { const done = dd.filter(x => !x.cur), av = done.length ? done.reduce((a, x) => a + x.vol, 0) / done.length : 0; dd.forEach(x => { x.rv = av ? x.vol / av : 0; }); };
  const RLd = Number.isFinite(RL) ? RL : Infinity;
  // okno 10 dni: dzienne OHLC, delta, delta skumulowana z 10 sesji, wolumen; bieżąca sesja do ostatniej świecy w widoku
  { const box = $('dlWin'); box.hidden = !S.dlw;
    if (S.dlw) {
      const ds = Object.keys(DATA).sort(), j = ds.indexOf(S.day), use = ds.slice(Math.max(0, j - 9), j + 1);
      const dd = use.map(k => { let a = 0, b = 0; const cur = k === S.day; for (const c of DATA[k].cells) { if (cur && c[0] > RLd) continue; b += c[2]; a += c[3]; } const bx = DATA[k].boxes.filter((q, i) => q && !(cur && i > RLd)); return {k, lab: `${k.slice(8)}.${k.slice(5, 7)}`, dl: a - b, vol: a + b, cur, o: bx.length ? bx[0][1] : null, h: bx.length ? Math.max(...bx.map(q => q[2])) : null, l: bx.length ? Math.min(...bx.map(q => q[3])) : null, c: bx.length ? bx[bx.length - 1][4] : null}; });
      let cum = 0; dd.forEach(x => { cum += x.dl; x.cum = cum; }); relVol(dd);
      { // v1.7 MA10 / MA20 zamknięć dziennych: dni z DA Flow (zamknięcie ostatniej świecy doby), starsza historia z eksportu M1 (data/dclose.json); bieżąca sesja – cena do świecy w widoku
        let DCL = {}; try { DCL = JSON.parse(document.getElementById('dclose').textContent)[INST] || {}; } catch (e) { DCL = {}; }
        const cl = {...DCL}; for (const k of ds) { const bx = DATA[k].boxes.filter(Boolean); if (bx.length) cl[k] = bx[bx.length - 1][4]; }
        dd.forEach(x => { if (x.c != null) cl[x.k] = x.c; });
        const ks = Object.keys(cl).sort();
        dd.forEach(x => { const prev = ks.filter(k => k <= x.k).slice(-20).map(k => cl[k]); const ma = N => prev.length >= N ? prev.slice(-N).reduce((a, b) => a + b, 0) / N : null; x.ma10 = ma(10); x.ma20 = ma(20); });
        dd.maN = ks.filter(k => k <= S.day).length; }
      const n = dd.length, pos = dd.filter(x => x.dl > 0).length, vt = dd.reduce((a, x) => a + x.vol, 0);
      $('dlWinPx').innerHTML = `${INST} · ${n} ${n === 1 ? 'sesja' : n < 5 ? 'sesje' : 'sesji'}${Number.isFinite(RL) ? ' · do ' + LT : ''}`;
      $('dlWinB').innerHTML = `<div class="dls"><span>Σ ${n} ${n < 5 ? 'sesje' : 'sesji'} <b class="${cum >= 0 ? 'buy' : 'sell'}">${fmN(cum)}</b></span><span>delta/wolumen <b>${(vt ? cum / vt * 100 : 0).toFixed(1)}%</b></span><span>sesje z dodatnią deltą <b>${pos}/${n}</b></span><span>wolumen wybranej sesji <b>${dd[n - 1].rv ? (dd[n - 1].rv * 100).toFixed(0) + '% średniej' : '–'}</b></span></div>`
        + flowPanels(dd, {unit: `z ${n} sesji`, ohlcT: 'Cena – OHLC dzienny · <span style="color:var(--pxl)">MA10</span> · <span style="color:var(--hot)">MA20</span> (zamknięcia dzienne)', dT: 'Delta dzienna', cT: `Delta skumulowana (od ${dd[0].lab})`, vT: 'Wolumen dzienny'})
        + `<p class="note">OHLC = pierwsze otwarcie, maks., min. i ostatnie zamknięcie świec 5 min doby. MA10 / MA20 = średnia z 10 / 20 ostatnich zamknięć dziennych (doba DA, do dnia włącznie; bieżąca sesja – cena do świecy w widoku). Starsza historia zamknięć z eksportu M1 DA (US500 od 24.08) – dla innych rynków tylko dni z DA Flow, więc średnia pojawia się dopiero, gdy jest 10 / 20 zamknięć${dd.maN != null ? ` (dostępnych: ${dd.maN})` : ''}. Delta = ask − bid, wolumen = bid + ask z footprintu, cała doba (sesja wg danych DA). Średnia wolumenu (linia przerywana) liczona z sesji poprzedzających wybraną; „wolumen wybranej sesji” porównuje z tą średnią. ${n < 10 ? `W danych jest ${n} ${n < 5 ? 'sesje' : 'sesji'} do wybranego dnia, nie 10. ` : ''}Bieżąca sesja (jaśniejszy słupek) liczona do ostatniej świecy w widoku. Najedź na słupek lub punkt po szczegóły. Opis przepływu, nie sygnał.</p>`; } }

  // v1.9 okno korelacji: korelacja Pearsona stóp zwrotu (log) wybranego instrumentu z pozostałymi rynkami DA Flow (indeksy: indeksy, złoto, VIX + DXY, EURUSD, USDJPY; waluty: wszystkie pary + US500 i złoto). Interwał M5 / M15 / H1 (stopy w obrębie doby,
  // świece wyrównane po czasie DA od 23:00, bez luki nocnej) albo D1 (zamknięcia dób); okres 1 / 5 / 10 / 20 sesji do wybranej sesji (w odtwarzaniu ucięte do świecy w widoku).
  // Pasek sesji = korelacja intraday w każdej z ostatnich 10 sesji (M15, a dla M5 / H1 – ten interwał). Wykres pary = zmiana % od początku okresu. Tylko ceny, footprint nie wchodzi. Opis, nie sygnał.
  { const box = $('krWin'); if (box) { box.hidden = !S.krw;
    if (S.krw) {
      const FXS = Object.keys(INSTS).filter(n => n === 'DXY' || /^[A-Z]{6}$/.test(n) && INSTS[n][0] < .05), base = INSTS[S.krB] ? S.krB : S.inst, isFX = FXS.includes(base),
        NM = isFX ? [...FXS, 'US500', 'GOLD'] : [...Object.keys(INSTS).filter(n => !FXS.includes(n)), 'DXY', 'EURUSD', 'USDJPY'], TFm = {M5: 1, M15: 3, H1: 12, D1: 0}, tf = S.krTf in TFm ? S.krTf : 'M15', NN = [1, 5, 10, 20].includes(S.krN) ? S.krN : 10;
      const Jn = n => n === INST ? DATA : CACHE[n]; let wait = NM.filter(n => !Jn(n)); wait.forEach(needInst);
      const lc = cols[cols.length - 1], tCut = Number.isFinite(RL) ? mmS(D.boxes[lc.parts ? lc.parts.slice(-1)[0].idx : (lc.last ?? lc.idx)][0]) : Infinity;
      const BJ = Jn(base) || DATA, bd = Object.keys(BJ).filter(k => k <= S.day).sort(), N = tf === 'D1' ? Math.max(NN, 5) : NN, win = bd.slice(-N), win10 = bd.slice(-10), dSet = new Set(win), allD = [...new Set([...win, ...win10])].sort();
      const IK = tf === 'D1' || tf === 'M5' || tf === 'H1' ? (tf === 'D1' ? 3 : TFm[tf]) : 3;   // interwał paska sesji
      const SER = {};   // n → {K: Map(day → Map(kubełek → zamknięcie))}
      const ser = (n, K) => { const key = n + ':' + K; if (SER[key]) return SER[key]; const J = Jn(n), out = new Map(); if (!J || !J[allD[0]] && !Object.keys(J).length) return (SER[key] = out);
        for (const k of allD) { const P = J[k]; if (!P || !P.boxes) continue; const m = new Map();
          P.boxes.forEach(b => { if (!b) return; const t = mmS(b[0]); if (k === S.day && t > tCut) return; m.set(Math.floor(t / (5 * K)), b[4]); });
          if (m.size) out.set(k, m); } return (SER[key] = out); };
      const rets = (n, K, days) => { const S_ = ser(n, K), r = new Map();
        for (const k of days) { const m = S_.get(k); if (!m) continue; for (const [q, c] of m) { const pv = m.get(q - 1); if (pv > 0 && c > 0) r.set(k + '|' + q, Math.log(c / pv)); } } return r; };
      const retsD = (n, days) => { const S_ = ser(n, 1), cl = days.map(k => { const m = S_.get(k); if (!m || !m.size) return null; return m.get(Math.max(...m.keys())); }), r = new Map();
        for (let i = 1; i < days.length; i++) if (cl[i] > 0 && cl[i - 1] > 0) r.set(days[i], Math.log(cl[i] / cl[i - 1])); return r; };
      const corr = (A, B) => { let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0; for (const [k, a] of A) { const b = B.get(k); if (b == null) continue; n++; sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b; }
        if (n < 8) return {n, r: null}; const va = saa - sa * sa / n, vb = sbb - sb * sb / n; return {n, r: va > 0 && vb > 0 ? (sab - sa * sb / n) / Math.sqrt(va * vb) : null}; };
      const dDays = bd.slice(-(N + 1));
      const RB = tf === 'D1' ? retsD(base, dDays) : rets(base, TFm[tf], win), RBs = {}; for (const k of win10) RBs[k] = rets(base, IK, [k]);
      const ROWS = NM.filter(n => n !== base).map(n => { if (!Jn(n)) return {n, load: 1};
        const R = tf === 'D1' ? retsD(n, dDays) : rets(n, TFm[tf], win), c = corr(RB, R), sp = win10.map(k => ({k, ...corr(RBs[k], rets(n, IK, [k]))}));
        return {n, r: c.r, cnt: c.n, sp}; });
      ROWS.sort((a, b) => (b.r == null ? -2 : Math.abs(b.r)) - (a.r == null ? -2 : Math.abs(a.r)));
      const f2 = v => v == null ? '–' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2).replace('.', ','), lab = r => r == null ? '' : Math.abs(r) >= .7 ? 'silna' : Math.abs(r) >= .4 ? 'umiarkowana' : Math.abs(r) >= .2 ? 'słaba' : 'brak';
      const pair = ROWS.find(r => r.n === S.krP && r.r != null) ? S.krP : (ROWS.find(r => r.r != null) || {}).n;
      const bar = r => { if (r == null) return '<span class="krb"></span>'; const w = Math.abs(r) * 50; return `<span class="krb"><i style="${r >= 0 ? 'left:50%' : `left:${50 - w}%`};width:${w}%;background:var(--${r >= 0 ? 'buy' : 'sell'})"></i></span>`; };
      const spark = sp => { const W = 120, H = 24, n = sp.length, xs = i => 4 + (n > 1 ? i * (W - 8) / (n - 1) : 0), ys = v => H / 2 - v * (H / 2 - 3); let g = `<line x1="2" x2="${W - 2}" y1="${H / 2}" y2="${H / 2}" stroke="var(--line)"/>`;
        sp.forEach((q, i) => { if (q.r == null) return; g += `<g><title>${q.k.slice(8)}.${q.k.slice(5, 7)}: ${f2(q.r)} (n ${q.n})</title><rect x="${xs(i) - 4}" y="${Math.min(ys(q.r), H / 2)}" width="8" height="${Math.max(1, Math.abs(ys(q.r) - H / 2))}" rx="1.5" fill="var(--${q.r >= 0 ? 'buy' : 'sell'})" opacity="${q.k === S.day ? 1 : .7}"/></g>`; });
        return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display:block">${g}</svg>`; };
      let h = `<div class="dls krc"><label>instrument <select id="krB">${Object.keys(INSTS).map(n => `<option value="${n}"${n === base ? ' selected' : ''}>${n}</option>`).join('')}</select></label>`
        + `<span class="seg" id="krTf">${Object.keys(TFm).map(q => `<button data-v="${q}" aria-pressed="${q === tf}">${q}</button>`).join('')}</span>`
        + `<span class="seg" id="krN">${[1, 5, 10, 20].map(q => `<button data-v="${q}" aria-pressed="${q === NN}"${tf === 'D1' && q < 5 ? ' disabled' : ''}>${q} ${q === 1 ? 'sesja' : q < 5 ? 'sesje' : 'sesji'}</button>`).join('')}</span>`
        + (wait.length ? `<span class="mut">wczytywanie: ${wait.join(', ')}…</span>` : '') + `</div>`;
      h += `<table class="zgt krt"><tr><th>rynek</th><th>korelacja ${tf} · ${win.length} ${win.length === 1 ? 'sesja' : win.length < 5 ? 'sesje' : 'sesji'}</th><th></th><th>siła</th><th>n</th><th>ostatnie 10 sesji (${IK === 12 ? 'H1' : 'M' + IK * 5}, każda osobno)</th></tr>`
        + ROWS.map(r => r.load ? `<tr><td>${r.n}</td><td colspan="5" class="mut">wczytywanie…</td></tr>` : `<tr data-krp="${r.n}" class="${r.n === pair ? 'on' : ''}" title="Kliknij – wykres ${base} i ${r.n}"><td><b>${r.n}</b></td><td>${bar(r.r)}</td><td class="${r.r == null ? '' : r.r >= 0 ? 'buy' : 'sell'}"><b>${f2(r.r)}</b></td><td>${lab(r.r)}</td><td class="mut">${r.cnt}${r.r == null ? ' (za mało)' : ''}</td><td>${spark(r.sp)}</td></tr>`).join('') + `</table>`;
      // wykres pary: zmiana % od początku okresu, wspólna oś czasu po kubełkach bazy
      if (pair) { const K = tf === 'D1' ? 12 : TFm[tf], A = ser(base, K), B = ser(pair, K), PTS = [];
        for (const k of win) { const ma = A.get(k), mb = B.get(k); if (!ma) continue; for (const q of [...ma.keys()].sort((x, y) => x - y)) PTS.push({k, q, a: ma.get(q), b: mb ? mb.get(q) : null}); }
        let lb = null; PTS.forEach(p => { if (p.b == null) p.b = lb; else lb = p.b; });
        const a0 = PTS.length ? PTS[0].a : null, b0 = (PTS.find(p => p.b != null) || {}).b;
        if (PTS.length > 1 && a0 && b0) { PTS.forEach(p => { p.pa = (p.a / a0 - 1) * 100; p.pb = p.b != null ? (p.b / b0 - 1) * 100 : null; });
          const vs = PTS.flatMap(p => [p.pa, p.pb]).filter(v => v != null), lo = Math.min(...vs), hi = Math.max(...vs), pd = (hi - lo) * .06 || .1;
          const Wd = 780, Hd = 260, x0 = 52, x1 = Wd - 110, y0 = 12, y1 = Hd - 26, n = PTS.length, xs = i => x0 + i * (x1 - x0) / (n - 1), ys = v => y1 - (v - lo + pd) / (hi - lo + 2 * pd) * (y1 - y0);
          const hh = (q, K) => { const m = q * 5 * K + 23 * 60; return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
          let g = ''; for (let t = 0; t <= 4; t++) { const v = lo - pd + (hi - lo + 2 * pd) * t / 4; g += `<line x1="${x0}" x2="${x1}" y1="${ys(v)}" y2="${ys(v)}" stroke="var(--line)" stroke-width=".6"/><text x="${x0 - 6}" y="${ys(v) + 4}" text-anchor="end" font-size="10" fill="var(--mut)">${v.toFixed(2).replace('.', ',')}%</text>`; }
          g += `<line x1="${x0}" x2="${x1}" y1="${ys(0)}" y2="${ys(0)}" stroke="var(--mut)" stroke-dasharray="3 3"/>`;
          PTS.forEach((p, i) => { if (!i || PTS[i - 1].k !== p.k) g += `<line x1="${xs(i)}" x2="${xs(i)}" y1="${y0}" y2="${y1}" stroke="var(--line)"/><text x="${xs(i) + 3}" y="${Hd - 10}" font-size="10" fill="var(--mut)">${p.k.slice(8)}.${p.k.slice(5, 7)}</text>`; });
          const pl = (key, col, w) => `<polyline points="${PTS.map((p, i) => p[key] == null ? null : `${xs(i).toFixed(1)},${ys(p[key]).toFixed(1)}`).filter(Boolean).join(' ')}" fill="none" stroke="var(${col})" stroke-width="${w}" stroke-linejoin="round"/>`;
          g += pl('pb', '--hot', 1.6) + pl('pa', '--ink', 1.8);
          const L = PTS[n - 1], lab2 = [{y: ys(L.pa), t: `${base} ${f2(L.pa)}%`, c: '--ink'}, {y: ys(L.pb ?? 0), t: `${pair} ${f2(L.pb)}%`, c: '--hot'}].sort((a, b) => a.y - b.y);
          if (lab2[1].y - lab2[0].y < 13) lab2[1].y = lab2[0].y + 13; for (const q of lab2) g += `<text x="${x1 + 6}" y="${q.y + 4}" font-size="10.5" font-weight="700" fill="var(${q.c})">${q.t}</text>`;
          const XL = PTS.map(p => `${p.k.slice(8)}.${p.k.slice(5, 7)} ${hh(p.q, K)}`).join('|');
          h += `<div class="dlt" style="margin-top:8px"><span style="color:var(--ink)">${base}</span> i <span style="color:var(--hot)">${pair}</span> – zmiana % od początku okresu (${tf === 'D1' ? 'H1' : tf})</div>`
            + `<svg viewBox="0 0 ${Wd} ${Hd}" width="100%" style="display:block;cursor:crosshair" role="img" aria-label="${base} i ${pair}: zmiana procentowa"${xhA({x0, x1, y0, y1, v0: lo - pd, v1: hi + pd, f: 'n2', ys: 'l', xm: 'p', xl: XL})}>${g}</svg>`; } }
      h += `<p class="note">Korelacja Pearsona logarytmicznych stóp zwrotu ze świec ${tf === 'D1' ? 'dziennych (zamknięcie doby DA)' : tf + ' w obrębie doby DA (bez luki między dobami), świece wyrównane po czasie od 23:00'}; n = liczba wspólnych świec (minimum 8). Siła: |r| ≥ 0,7 silna, 0,4–0,7 umiarkowana, 0,2–0,4 słaba. VIX z indeksami zwykle ujemnie. Rynki o innych godzinach handlu (Azja, Europa) mają mniej wspólnych świec. Liczone tylko z cen – szacowany footprint części dni nie ma znaczenia. Danych jest ok. 21 sesji, więc D1 to najwyżej 20 stóp zwrotu – wynik orientacyjny. Kliknij wiersz, żeby zobaczyć parę na wykresie. Opis zależności, nie sygnał.</p>`;
      $('krWinPx').innerHTML = `${base} · ${tf} · ${win.length} ${win.length === 1 ? 'sesja' : win.length < 5 ? 'sesje' : 'sesji'}${Number.isFinite(RL) ? ' · do ' + LT : ''}`;
      $('krWinB').innerHTML = h;
      $('krB').onchange = e => { S.krB = e.target.value; save(); render(true); };
      box.querySelectorAll('#krTf button').forEach(b => b.onclick = () => { S.krTf = b.dataset.v; save(); render(true); });
      box.querySelectorAll('#krN button').forEach(b => b.onclick = () => { S.krN = +b.dataset.v; save(); render(true); });
      box.querySelectorAll('tr[data-krp]').forEach(tr => tr.onclick = () => { S.krP = tr.dataset.krp; save(); render(true); }); } } }

  // v1.9 okno „Cena 10 sesji z profilami”: wykres liniowy M15 / M30 / H1 (zamknięcia) z ostatnich 10 sesji; nakładki VA 70% i POC liczone z flexu DA:
  // 24 h = kroczące 288 świec 5 min, 1 / 2 / 3 / 5 dni = profil złożony z N poprzednich pełnych dób DA (stały w ciągu doby), doba = profil bieżącej doby narastająco.
  // Każda wartość z danych do końca poprzedniej świecy wykresu (bez zaglądania w przyszłość); w odtwarzaniu bieżąca sesja ucięta do świecy w widoku. Opis, nie sygnał.
  { const box = $('lnWin'); if (box) { box.hidden = !S.lnw;
    if (S.lnw) {
      const ds = Object.keys(DATA).sort(), j = ds.indexOf(S.day), show = ds.slice(Math.max(0, j - 9), j + 1), all = ds.slice(Math.max(0, j - 15), j + 1);
      const TFm = {M15: 3, M30: 6, H1: 12}, tf = TFm[S.lnTf] ? S.lnTf : 'M30', K = TFm[tf];
      const O_ = S.lnO || (S.lnO = {h24: true, d1: false, d2: false, d3: false, d5: true, dz: false}), Qn = v => Q(Math.floor(v / TK + 1e-9) * TK);
      const SER = [];   // świece 5 min: {d, t, C, m: Map(cena → wolumen)}
      for (const k of all) { const V = DATA[k], cur = k === S.day, mm = V.boxes.map(() => null);
        for (const [i, pz, bd, ak] of V.cells) { if (cur && i > RLd) continue; const m = mm[i] || (mm[i] = new Map()), q = Qn(pz); m.set(q, (m.get(q) || 0) + bd + ak); }
        V.boxes.forEach((b, i) => { if (b && !(cur && i > RLd)) SER.push({d: k, t: b[0], C: b[4], H: b[2], L: b[3], m: mm[i] || new Map()}); }); }
      const vaOf = m => { if (!m.size) return null; const ks = [...m.keys()].sort((a, b) => a - b), vs = ks.map(q => m.get(q)), tot = vs.reduce((a, b) => a + b, 0); let pi = 0; for (let q = 1; q < vs.length; q++) if (vs[q] > vs[pi]) pi = q; let a0 = pi, a1 = pi, ac = vs[pi];
        while (ac < .7 * tot && (a0 > 0 || a1 < ks.length - 1)) { const up = a1 < ks.length - 1 ? vs[a1 + 1] : -1, dn = a0 > 0 ? vs[a0 - 1] : -1; if (up >= dn) ac += vs[++a1]; else ac += vs[--a0]; } return {h: ks[a1] + TK, p: ks[pi] + TK / 2, l: ks[a0]}; };
      const addM = (A, B, sg) => { for (const [q, v] of B) { const r = (A.get(q) || 0) + sg * v; if (r <= 1e-9) A.delete(q); else A.set(q, r); } };
      const DAYP = {}; for (const k of all) { const m = new Map(); for (const x of SER) if (x.d === k) addM(m, x.m, 1); DAYP[k] = m; }
      const comp = (k, N) => { const pk = all.slice(0, all.indexOf(k)).slice(-N); if (pk.length < N) return null; const m = new Map(); for (const q of pk) addM(m, DAYP[q], 1); return vaOf(m); };
      const CMP = {}; for (const k of show) CMP[k] = {d1: comp(k, 1), d2: comp(k, 2), d3: comp(k, 3), d5: comp(k, 5)};
      // świece wykresu: paczki K świec 5 min od początku każdej doby; nakładki = stan na koniec poprzedniej świecy wykresu
      const PTS = [], roll = new Map(); let rs = 0, dayM = new Map(), dcur = null, kk = 0, grp = null;
      SER.forEach((x, i) => {
        if (x.d !== dcur) { dcur = x.d; dayM = new Map(); kk = 0; }
        if (show.includes(x.d) && kk % K === 0) { grp = {d: x.d, t: x.t, H: -Infinity, L: Infinity, h24: i >= 288 ? vaOf(roll) : null, dz: dayM.size ? vaOf(dayM) : null, ...CMP[x.d]}; PTS.push(grp); }
        if (show.includes(x.d) && grp) { grp.C = x.C; grp.H = Math.max(grp.H, x.H); grp.L = Math.min(grp.L, x.L); grp.t2 = x.t; }
        addM(roll, x.m, 1); if (i - 288 >= 0) addM(roll, SER[i - 288].m, -1); addM(dayM, x.m, 1); kk++; });
      const LAY = [['h24', '24 h', '--r60'], ['d1', '1 dzień', '--r90'], ['d2', '2 dni', '--r120'], ['d3', '3 dni', '--r180'], ['d5', '5 dni', '--r240'], ['dz', 'doba (narastająco)', '--vpk']];
      let hi = -Infinity, lo = Infinity; for (const p of PTS) { hi = Math.max(hi, p.H); lo = Math.min(lo, p.L); for (const [key] of LAY) if (O_[key] && p[key]) { hi = Math.max(hi, p[key].h); lo = Math.min(lo, p[key].l); } }
      const Wd = 1080, Hd = 430, x0 = 56, x1 = Wd - 12, y0 = 14, y1 = Hd - 34, n = PTS.length, xs = q => x0 + (n > 1 ? q * (x1 - x0) / (n - 1) : 0), ys = v => y1 - (v - lo) / ((hi - lo) || 1) * (y1 - y0), f_ = v => (+v).toFixed(DEC);
      const st = (key, f) => { let d = ''; PTS.forEach((p, q) => { const v = p[key] ? p[key][f] : null; if (v == null) return; const X = xs(q), Xn = q < n - 1 ? xs(q + 1) : X, Y = ys(v); d += (q && PTS[q - 1][key] ? `L${X},${Y}` : `M${X},${Y}`) + `L${Xn},${Y}`; }); return d; };
      let svg = `<svg viewBox="0 0 ${Wd} ${Hd}" width="100%" role="img" aria-label="Cena ${tf} z 10 sesji z VA i POC" style="font:11px var(--mono, monospace);cursor:crosshair"${xhA({x0, x1, y0, y1, v0: lo, v1: hi, f: 'p', ys: 'l', xm: 'p', xl: PTS.map(p => `${p.d.slice(8)}.${p.d.slice(5, 7)} ${p.t}`).join('|')})}>`;
      for (let g = 0; g <= 5; g++) { const v = lo + (hi - lo) * g / 5; svg += `<line x1="${x0}" x2="${x1}" y1="${ys(v)}" y2="${ys(v)}" stroke="${css('--line')}" stroke-width=".6"/><text x="${x0 - 6}" y="${ys(v) + 4}" text-anchor="end" fill="${css('--mut')}">${f_(v)}</text>`; }
      PTS.forEach((p, q) => { if (!q || PTS[q - 1].d !== p.d) svg += `<line x1="${xs(q)}" x2="${xs(q)}" y1="${y0}" y2="${y1}" stroke="${css('--line')}"/><text x="${xs(q) + 3}" y="${Hd - 18}" fill="${css('--mut')}">${p.d.slice(8)}.${p.d.slice(5, 7)}</text>`; });
      const band = key => { let out = '', seg = []; const flush = () => { if (seg.length) { const top = seg.map(([X, Xn, h]) => `L${X},${ys(h)}L${Xn},${ys(h)}`).join('').replace(/^L/, 'M'), bot = seg.slice().reverse().map(([X, Xn, , l]) => `L${Xn},${ys(l)}L${X},${ys(l)}`).join(''); out += top + bot + 'Z'; } seg = []; };
        PTS.forEach((p, q) => { const v = p[key]; if (!v) { flush(); return; } seg.push([xs(q), q < n - 1 ? xs(q + 1) : xs(q), v.h, v.l]); }); flush(); return out; };
      for (const [key, , tok] of LAY) if (O_[key]) svg += `<path d="${band(key)}" fill="${css(tok)}" fill-opacity="${key === 'd5' ? .07 : .10}" stroke="none"/>`;
      for (const [key, nm, tok] of LAY) if (O_[key]) { const c = css(tok); svg += `<g><title>${nm}: VAH / VAL (cienkie) i POC (przerywana)</title><path d="${st(key, 'h')}" fill="none" stroke="${c}" stroke-width="1.1" opacity=".75"/><path d="${st(key, 'l')}" fill="none" stroke="${c}" stroke-width="1.1" opacity=".75"/><path d="${st(key, 'p')}" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="6 3"/></g>`; }
      svg += `<polyline points="${PTS.map((p, q) => `${xs(q)},${ys(p.C)}`).join(' ')}" fill="none" stroke="${css('--ink')}" stroke-width="1.5"/>`;
      const bw = n > 1 ? (x1 - x0) / (n - 1) : 10;
      PTS.forEach((p, q) => { const tt = `${p.d.slice(8)}.${p.d.slice(5, 7)} ${p.t}–${p.t2} · zamkn. ${f_(p.C)}` + LAY.filter(([key]) => O_[key] && p[key]).map(([key, nm]) => ` · ${nm}: VAH ${f_(p[key].h)} POC ${f_(p[key].p)} VAL ${f_(p[key].l)}`).join('');
        svg += `<rect x="${xs(q) - bw / 2}" y="${y0}" width="${bw}" height="${y1 - y0}" fill="transparent"><title>${tt}</title></rect>`; });
      svg += `</svg>`;
      const last = PTS[n - 1], inn = key => { const z = PTS.filter(p => p[key]); return z.length ? Math.round(z.filter(p => p.C >= p[key].l && p.C <= p[key].h).length / z.length * 100) : null; };
      $('lnWinPx').innerHTML = `${INST} · ${show.length} sesji · ${tf}${Number.isFinite(RL) ? ' · do ' + LT : ''}`;
      $('lnWinB').innerHTML = `<div class="dls lnc"><span class="seg" id="lnTf">${Object.keys(TFm).map(q => `<button data-v="${q}" aria-pressed="${q === tf}">${q}</button>`).join('')}</span>`
        + LAY.map(([key, nm, tok]) => `<label class="chk"><input type="checkbox" data-lno="${key}" ${O_[key] ? 'checked' : ''}> <i style="display:inline-block;width:14px;height:3px;background:${css(tok)};vertical-align:middle"></i> ${nm}${O_[key] && inn(key) != null ? ` <span class="mutd">(cena w VA ${inn(key)}%)</span>` : ''}</label>`).join('') + `</div>` + svg
        + (last ? `<div class="dls">${LAY.filter(([key]) => O_[key] && last[key]).map(([key, nm]) => `<span>${nm}: VAH <b>${f_(last[key].h)}</b> · POC <b>${f_(last[key].p)}</b> · VAL <b>${f_(last[key].l)}</b></span>`).join('')}</div>` : '')
        + `<p class="note">Linia = zamknięcia świec ${tf} (paczki świec 5 min od początku doby DA 23:00). VA 70% (wypełnione pasmo w kolorze nakładki) i POC z wolumenu flex DA (krok ceny instrumentu): 24 h = kroczące ostatnie 288 świec 5 min; 1 / 2 / 3 / 5 dni = profil złożony z 1 / 2 / 3 / 5 poprzednich pełnych dób (stały w ciągu doby); doba = profil bieżącej doby narastająco. Wartości z danych do końca poprzedniej świecy wykresu. Test 15.11: powrót do POC z VA 24 h – bez przewagi (trafność 60% vs 76% dla VA doby); reguły na VA 24 h i 5 dni (akceptacja, powrót, krawędź, zbieżne POC) – bez przewagi. Najedź na wykres – wartości w danej świecy. Opis, nie sygnał.</p>`;
      box.querySelectorAll('#lnTf button').forEach(b => b.onclick = () => { S.lnTf = b.dataset.v; save(); render(true); });
      box.querySelectorAll('[data-lno]').forEach(b => b.onchange = () => { S.lnO[b.dataset.lno] = b.checked; save(); render(true); });
    } } }
  // v1.3 okno „Profile sesji”: profile wolumenu 5 poprzednich sesji i bieżącej (do świecy w widoku), noc (do startu sesji kasowej) jaśniej, sesja kasowa ciemniej;
  // tło = VA 70%, złoty = POC, delta sesji u góry; nPOC = POC sesji (do 20 wstecz), do którego cena nie wróciła w kolejnych sesjach; ✓ = zmitygowany w bieżącej sesji
  { const box = $('psWin'); box.hidden = !S.psw;
    if (S.psw) {
      const ds = Object.keys(DATA).sort(), j = ds.indexOf(S.day), show = ds.slice(Math.max(0, j - 5), j + 1), hist = ds.slice(Math.max(0, j - 20), j);
      const prof = (k, cur) => { const V = DATA[k], B = V.boxes, fr = B.findIndex(b => b && b[9]), m = new Map(); let dl = 0, hi = -Infinity, lo = Infinity;
        for (const [i, p, bd, ak] of V.cells) { if (cur && i > RLd) continue; const q = Q(Math.floor(p / TK + 1e-9) * TK), z = m.get(q) || [0, 0]; if (fr >= 0 && i >= fr) z[1] += bd + ak; else z[0] += bd + ak; m.set(q, z); dl += ak - bd; }
        B.forEach((b, i) => { if (b && !(cur && i > RLd)) { hi = Math.max(hi, b[2]); lo = Math.min(lo, b[3]); } });
        const ks = [...m.keys()].sort((a, b) => a - b), vs = ks.map(q => m.get(q)[0] + m.get(q)[1]), tot = vs.reduce((a, b) => a + b, 0);
        if (!ks.length) return null; let pi = vs.indexOf(Math.max(...vs)), a0 = pi, a1 = pi, ac = vs[pi];
        while (ac < .7 * tot && (a0 > 0 || a1 < ks.length - 1)) { const up = a1 < ks.length - 1 ? vs[a1 + 1] : -1, dn = a0 > 0 ? vs[a0 - 1] : -1; if (up >= dn) ac += vs[++a1]; else ac += vs[--a0]; }
        const last = B.filter((b, i) => b && !(cur && i > RLd)).pop();
        return {k, m, poc: ks[pi], vah: ks[a1] + TK, val: ks[a0], dl, hi, lo, c: last ? last[4] : null, rth: fr >= 0 && !(cur && fr > RLd)}; };
      const P = new Map(); for (const k of new Set([...hist, ...show])) { const r = prof(k, k === S.day); if (r) P.set(k, r); }
      const cur = P.get(S.day), LPx = cur ? cur.c : null;
      // nPOC: POC sesji h, którego nie dotknęła żadna późniejsza sesja przed bieżącą; ✓ = dotknięty w bieżącej
      const touched = (k, x) => { const r = P.get(k); return r && r.lo <= x + TK / 2 && r.hi >= x; };
      const NP = []; for (const h of hist) { const r = P.get(h); if (!r) continue; const x = r.poc + TK / 2, later = ds.slice(ds.indexOf(h) + 1, j);
        if (later.some(k => touched(k, x))) continue; NP.push({k: h, x, done: touched(S.day, x)}); }
      const sh = show.filter(k => P.has(k));
      { const m = new Map(); let dl = 0, hi_ = -Infinity, lo_ = Infinity;   // Σ wyświetlonych sesji – profil zbiorczy (VA 70% i POC liczone na nowo)
        for (const k of sh) { const r = P.get(k); dl += r.dl; hi_ = Math.max(hi_, r.hi); lo_ = Math.min(lo_, r.lo); for (const [q, z] of r.m) { const a = m.get(q) || [0, 0]; a[0] += z[0]; a[1] += z[1]; m.set(q, a); } }
        const ks = [...m.keys()].sort((a, b) => a - b), vs = ks.map(q => m.get(q)[0] + m.get(q)[1]), tot = vs.reduce((a, b) => a + b, 0);
        if (ks.length) { let pi = vs.indexOf(Math.max(...vs)), a0 = pi, a1 = pi, ac = vs[pi];
          while (ac < .7 * tot && (a0 > 0 || a1 < ks.length - 1)) { const up = a1 < ks.length - 1 ? vs[a1 + 1] : -1, dn = a0 > 0 ? vs[a0 - 1] : -1; if (up >= dn) ac += vs[++a1]; else ac += vs[--a0]; }
          P.set('SUM', {k: 'SUM', m, poc: ks[pi], vah: ks[a1] + TK, val: ks[a0], dl, hi: hi_, lo: lo_, c: null, n: sh.length}); sh.push('SUM'); } }
      const n = sh.length;
      let hi = Math.max(...sh.map(k => P.get(k).hi), ...NP.map(q => q.x)), lo = Math.min(...sh.map(k => P.get(k).lo), ...NP.map(q => q.x));
      const span = hi - lo || 1, steps = [1, 2, 4, 5, 10, 20, 25, 50, 100, 200, 250, 500].map(q => q * TK), bin = steps.find(q => span / q <= 140) || steps[steps.length - 1];
      const Wd = 1040, Hd = 570, L0 = 70, R0 = 190, T0 = 40, B0 = 14, cw = (Wd - L0 - R0) / Math.max(n - 1 + 1.6, 1), cx = ci => L0 + ci * cw, yy = v => T0 + (hi - v) / span * (Hd - T0 - B0), rh = Math.max(1.5, bin / span * (Hd - T0 - B0) - .6);
      const G = [], f = v => (+v).toFixed(DEC).replace('.', ','), ink = css('--ink'), mut = css('--mut'), line = css('--line'), gold = css('--va'), np = css('--hvn') || '#7b3fbf';
      for (let t = Math.ceil(lo / (bin * 10)) * bin * 10; t <= hi; t += bin * 10) G.push(`<line x1="${L0}" x2="${Wd - R0 + 6}" y1="${yy(t)}" y2="${yy(t)}" stroke="${line}" stroke-width=".6"/><text x="${L0 - 6}" y="${yy(t) + 4}" text-anchor="end" font-size="11" fill="${mut}">${f(t)}</text>`);
      sh.forEach((k, ci) => { const r = P.get(k), isS = k === 'SUM', x0 = cx(ci) + 4 + (isS ? 6 : 0), w = (isS ? 1.6 * cw - 6 : cw) - 10, agg = new Map();
        if (isS) G.push(`<rect x="${cx(ci) + 4}" y="${T0 - 34}" width="${1.6 * cw - 4}" height="${Hd - B0 - T0 + 34}" fill="${gold}" opacity=".05"/>`);
        for (const [q, z] of r.m) { const b = Q(Math.floor(q / bin + 1e-9) * bin), a = agg.get(b) || [0, 0]; a[0] += z[0]; a[1] += z[1]; agg.set(b, a); }
        const mx = Math.max(...[...agg.values()].map(a => a[0] + a[1]), 1), pocB = Q(Math.floor(r.poc / bin + 1e-9) * bin);
        G.push(`<rect x="${x0}" y="${yy(r.vah)}" width="${w * .9}" height="${Math.max(2, yy(r.val) - yy(r.vah))}" fill="${mut}" opacity=".10"/>`);
        if (ci) G.push(`<line x1="${x0 - 5}" x2="${x0 - 5}" y1="${T0 - 34}" y2="${Hd - B0}" stroke="${line}"/>`);
        for (const [b, a] of agg) { const ytop = yy(b + bin), wN = a[0] / mx * w * .9, wR = a[1] / mx * w * .9, isP = b === pocB;
          if (wN > .3) G.push(`<rect x="${x0}" y="${ytop}" width="${wN}" height="${rh}" fill="${isP ? gold : mut}" opacity="${isP ? .55 : .32}"/>`);
          if (wR > .3) G.push(`<rect x="${x0 + wN}" y="${ytop}" width="${wR}" height="${rh}" fill="${isP ? gold : mut}" opacity="${isP ? 1 : .8}"/>`); }
        G.push(`<line x1="${x0}" x2="${x0 + w * .9}" y1="${yy(r.poc + TK / 2)}" y2="${yy(r.poc + TK / 2)}" stroke="${gold}" stroke-width="2"/><text x="${x0 + w * .9}" y="${yy(r.poc + TK / 2) - 3}" text-anchor="end" font-size="11" font-weight="700" fill="${gold}">${f(r.poc)}</text>`);
        if (!isS) { // v1.7 ruch ceny sesji (zamknięcia świec 5 min) jako linia na tle profilu: oś X = czas sesji DA w szerokości kolumny; noc cieńsza, sesja kasowa grubsza
          const Bk = DATA[k].boxes, pts = [];
          Bk.forEach((b, i) => { if (b && !(k === S.day && i > RLd)) pts.push([i, b[4], !!b[9]]); });
          if (pts.length > 1) { const nB = Math.max(Bk.length - 1, 1), px = i => x0 + i / nB * w * .9, seg = (a, rth) => a.length > 1 ? `<polyline points="${a.map(p => `${px(p[0]).toFixed(1)},${yy(p[1]).toFixed(1)}`).join(' ')}" fill="none" stroke="${css('--pxl') || '#1c6fd1'}" stroke-width="${rth ? 1.7 : 1.1}" stroke-opacity="${rth ? 1 : .55}" stroke-linejoin="round"/>` : '';
            const night = pts.filter(p => !p[2]), r0 = pts.findIndex(p => p[2]), rth = r0 >= 0 ? pts.slice(Math.max(r0 - 1, 0)).filter((p, q) => q === 0 || p[2]) : [], post = r0 >= 0 ? pts.slice(r0).filter(p => !p[2]) : [];
            const pre = r0 >= 0 ? pts.slice(0, r0 + 1) : night;
            G.push(seg(pre, false) + seg(rth, true) + (post.length ? seg([rth[rth.length - 1], ...post].filter(Boolean), false) : ''));
            const lp = pts[pts.length - 1]; G.push(`<circle cx="${px(lp[0]).toFixed(1)}" cy="${yy(lp[1]).toFixed(1)}" r="2.8" fill="${css('--pxl') || '#1c6fd1'}"/>`); } }
        G.push(`<text x="${x0 + 2}" y="${T0 - 8}" font-size="11.5" font-weight="700" fill="${r.dl >= 0 ? css('--buy') : css('--sell')}">Δ ${fmt(r.dl, 1)}</text><text x="${x0 + 2}" y="${T0 - 24}" font-size="10.5" fill="${k === S.day || isS ? ink : mut}" font-weight="${k === S.day || isS ? 700 : 400}">${isS ? `Σ ${r.n} sesji · VA ${f(r.val)}–${f(r.vah)}` : `${k.slice(8)}.${k.slice(5, 7)}${k === S.day ? (Number.isFinite(RL) ? ' do ' + LT : ' dziś') : ''}`}</text>`);
        G.push(`<title>${isS ? `Profil zbiorczy ${r.n} sesji (${sh[0].slice(8)}.${sh[0].slice(5, 7)}–${S.day.slice(8)}.${S.day.slice(5, 7)}${Number.isFinite(RL) ? ' do ' + LT : ''})` : k}: POC ${f(r.poc)}, VA ${f(r.val)}–${f(r.vah)}, Δ ${fmt(r.dl, 1)}, zakres ${f(r.lo)}–${f(r.hi)}</title>`); });
      for (const q of NP) { const ci = sh.indexOf(q.k), xs = ci >= 0 ? cx(ci) + 4 : L0, c_ = q.done ? mut : np, yv = yy(q.x);
        G.push(`<g opacity="${q.done ? .7 : 1}"><title>nPOC ${q.k}: ${f(q.x - TK / 2)} – cena nie wróciła do niego w kolejnych sesjach${q.done ? '; dotknięty w bieżącej sesji (✓)' : ''}. Naked POC jako magnes: test 21.10 bez przewagi; pierwszy test naked 75% wobec 70% dla losowych – obserwacja.</title><line x1="${xs}" x2="${Wd - R0 + 4}" y1="${yv}" y2="${yv}" stroke="${c_}" stroke-width="1.6" stroke-dasharray="6 4"/>`
          + `<rect x="${Wd - R0 + 6}" y="${yv - 9}" width="${R0 - 10}" height="18" rx="4" fill="${c_}"/><text x="${Wd - 8}" y="${yv + 4}" text-anchor="end" font-size="11" font-weight="700" fill="${css('--panel')}">nPOC ${q.k.slice(8)}.${q.k.slice(5, 7)} · ${f(q.x - TK / 2)}${q.done ? ' ✓' : ''}</text></g>`); }
      if (LPx != null) G.push(`<line x1="${L0}" x2="${Wd - R0 + 4}" y1="${yy(LPx)}" y2="${yy(LPx)}" stroke="${ink}" stroke-width="1.3"/><rect x="2" y="${yy(LPx) - 10}" width="${L0 - 6}" height="20" rx="4" fill="${ink}"/><text x="${L0 / 2 - 1}" y="${yy(LPx) + 4}" text-anchor="middle" font-size="11.5" font-weight="700" fill="${css('--panel')}">${f(LPx)}</text>`);
      const open = NP.filter(q => !q.done);
      $('psWinPx').innerHTML = `${INST} · ${Number.isFinite(RL) ? 'stan na ' + LT : 'do ostatniej świecy'}${LPx != null ? ' · cena ' + f(LPx) : ''}`;
      $('psWinB').innerHTML = `<svg viewBox="0 0 ${Wd} ${Hd}" width="100%" style="display:block;max-height:min(600px,62vh);cursor:crosshair" role="img" aria-label="Profile sesji"${xhA({x0: L0, x1: Wd - R0, y0: T0, y1: Hd - B0, v0: lo, v1: hi, f: 'p', ys: 'l'})}>${G.join('')}</svg>`
        + `<p class="note">Profile wolumenu z footprintu 5 min (cała doba sesji DA; krok ${f(bin)} pkt): jaśniej = noc (do startu sesji kasowej), ciemniej = sesja kasowa. Niebieska linia = ruch ceny w sesji (zamknięcia świec 5 min, czas od lewej do prawej w szerokości kolumny; cienka = noc i po sesji, gruba = sesja kasowa, kropka = ostatnia cena). Tło = VA 70%, złoty = POC, nad kolumną delta sesji. Ostatnia kolumna (Σ, złote tło) = profil zbiorczy wszystkich pokazanych sesji z własnym VA 70% i POC; przedostatnia = wybrana sesja do ${Number.isFinite(RL) ? 'bieżącej świecy odtwarzania' : 'ostatniej świecy w danych'}. Fioletowe przerywane = nPOC – POC sesji (do 20 wstecz w danych: ${hist.length}), do którego cena nie wróciła w kolejnych sesjach; ✓ = dotknięty w wybranej sesji. Otwartych nPOC: ${open.length}${open.length ? ' (' + open.map(q => f(q.x - TK / 2)).join(', ') + ')' : ''}. Dni bez eksportu w danych są pomijane – nPOC może być „dotknięty” w dniu, którego nie ma. Status: <span class="st stb" title="Naked POC jako magnes – bez przewagi (21.10.2026); pierwszy test naked 75% wobec 70% dla losowych nietkniętych poziomów – obserwacja">opis</span></p>`; } }
  // okno intraday: wybrana sesja w świecach 15 / 30 / 60 min (z 5 min) – OHLC, delta, CVD od początku doby, wolumen
  { const box = $('inWin'); box.hidden = !S.inw;
    if (S.inw) {
      const iv = [15, 30, 60].includes(S.inIv) ? S.inIv : 30, k = iv / 5, B = D.boxes, last = Math.min(B.length - 1, RLd), dl = new Array(B.length).fill(0), vo = new Array(B.length).fill(0);
      for (const c of D.cells) { if (c[0] > last) continue; dl[c[0]] += c[3] - c[2]; vo[c[0]] += c[2] + c[3]; }
      const dd = []; let cum = 0;
      for (let s0 = 0; s0 <= last; s0 += k) { const idx = []; for (let i = s0; i < Math.min(s0 + k, last + 1); i++) if (B[i]) idx.push(i); if (!idx.length) continue;
        const x = {lab: B[idx[0]][0], o: B[idx[0]][1], h: Math.max(...idx.map(i => B[i][2])), l: Math.min(...idx.map(i => B[i][3])), c: B[idx[idx.length - 1]][4], dl: idx.reduce((a, i) => a + dl[i], 0), vol: idx.reduce((a, i) => a + vo[i], 0), cur: s0 + k - 1 > last, rth: idx.some(i => B[i][9] === 1)};
        cum += x.dl; x.cum = cum; dd.push(x); }
      relVol(dd);
      const n = dd.length, pos = dd.filter(x => x.dl > 0).length, vt = dd.reduce((a, x) => a + x.vol, 0), lx = dd[n - 1];
      $('inWinPx').innerHTML = `${INST} · ${S.day.slice(8)}.${S.day.slice(5, 7)} · ${n} świec ${iv} min${Number.isFinite(RL) ? ' · do ' + LT : ''}`;
      $('inWinB').innerHTML = `<div class="dls"><span class="seg">${[15, 30, 60].map(v => `<button data-iv="${v}" class="${v === iv ? 'on' : ''}">${v} min</button>`).join('')}</span><span>CVD doby <b class="${cum >= 0 ? 'buy' : 'sell'}">${fmN(cum)}</b></span><span>delta/wolumen <b>${(vt ? cum / vt * 100 : 0).toFixed(1)}%</b></span><span>świece z dodatnią deltą <b>${pos}/${n}</b></span><span>wolumen ostatniej świecy${lx && lx.cur ? ' (niepełna)' : ''} <b>${lx && lx.rv ? (lx.rv * 100).toFixed(0) + '% średniej' : '–'}</b></span></div>`
        + flowPanels(dd, {unit: `świecy ${iv} min w tej sesji`, ohlcT: `Cena – OHLC ${iv} min`, dT: `Delta ${iv} min`, cT: 'Delta skumulowana (CVD od początku doby)', vT: `Wolumen ${iv} min`, every: Math.max(1, Math.ceil(n / 8))})
        + `<p class="note">Świece ${iv} min złożone ze świec 5 min wybranej sesji (doba wg danych DA, od ${dd.length ? dd[0].lab : '–'}). Delta = ask − bid, wolumen = bid + ask z footprintu, CVD = suma delty od początku doby. Średnia wolumenu = średnia świec ${iv} min tej sesji bez ostatniej niepełnej (jaśniejszej) świecy. W odtwarzaniu liczone do bieżącej świecy. Najedź na świecę po szczegóły. Opis przepływu, nie sygnał.</p>`;
      box.querySelectorAll('[data-iv]').forEach(b => b.onclick = () => { S.inIv = +b.dataset.iv; save(); render(true); }); } }
  $('djWin').hidden = !S.djw; if (S.djw) djRender();
  // okno footprintu wielu interwałów (v1.2): ostatnie N świec 5 / 15 / 30 / 60 min obok siebie, wspólna oś ceny i celownik, poziomy z wagą ≥ 2 przez wszystkie kolumny
  { const box = $('mtWin'); box.hidden = !S.mtw;
    if (S.mtw) {
      const TFS = {M5: 5, M15: 15, M30: 30, H1: 60}, sel = (Array.isArray(S.mtTf) && S.mtTf.length ? S.mtTf : ['M5', 'M15', 'H1']).filter(t => TFS[t]).sort((a, b) => TFS[a] - TFS[b]);
      const TFL = {M5: '5', M15: '15', M30: '30', H1: '60'}, NC = [4, 6, 8, 12].includes(S.mtN) ? S.mtN : 6, MODE = ['auto', 'num', 'col'].includes(S.mtMode) ? S.mtMode : 'auto';
      const m5 = columns(S.day, 'M5', S.rng).filter(c => c.idx <= RLd);
      const agg = N => { const out = []; let cur = null;
        const key = b => { const m = Math.floor(Number(b.t.slice(3)) / N) * N; return b.t.slice(0, 2) + ':' + String(N === 60 ? 0 : m).padStart(2, '0'); };
        for (const b of m5) { const kk = N === 5 ? b.t : key(b);
          if (!cur || cur.t !== kk) { cur = {t: kk, O: b.O, H: b.H, L: b.L, C: b.C, a: b.idx, b: b.idx, n: 0, lv: new Map()}; out.push(cur); }
          cur.H = Math.max(cur.H, b.H); cur.L = Math.min(cur.L, b.L); cur.C = b.C; cur.b = b.idx; cur.n++;
          for (const [k, z] of b.lv) { const q = cur.lv.get(k) || {bid: 0, ask: 0}; q.bid += z.bid; q.ask += z.ask; cur.lv.set(k, q); } }
        for (const c of out) { c.d = 0; c.v = 0; c.vmax = 0; c.pocK = null; c.cur = c.n < N / 5 && c === out[out.length - 1] && Number.isFinite(RL);
          for (const [k, z] of c.lv) { z.d = z.ask - z.bid; z.v = z.ask + z.bid; c.d += z.d; c.v += z.v; if (z.v > c.vmax) { c.vmax = z.v; c.pocK = k; } } }
        const done = out.filter(c => !c.cur), av = done.length ? done.reduce((a, c) => a + c.v, 0) / done.length : 0; out.forEach(c => { c.rv = av ? c.v / av : null; });
        return out; };
      const pats = cs => { const P = [];   // te same definicje co na wykresie głównym (W, A, UT), liczone na danym interwale
        cs.forEach((c, i) => { const ks = [...c.lv.keys()].sort((a, b) => a - b); if (!c.v) return; const rng_ = c.H - c.L || 1;
          if (ks.length >= 4) { const top = ks[ks.length - 1], bot = ks[0], zt = c.lv.get(top), zb = c.lv.get(bot), lim = Math.max(2, .02 * c.vmax);
            if (zt.v <= .05 * c.vmax && zt.ask <= lim && c.lv.get(ks[ks.length - 2]).v >= 3 * Math.max(zt.v, 1)) P.push({i, k: top, s: 1, t: 'W', x: `wyczerpanie kupna na szczycie (bid ${zt.bid} × ask ${zt.ask})`});
            if (zb.v <= .05 * c.vmax && zb.bid <= lim && c.lv.get(ks[1]).v >= 3 * Math.max(zb.v, 1)) P.push({i, k: bot, s: -1, t: 'W', x: `wyczerpanie sprzedaży na dołku (bid ${zb.bid} × ask ${zb.ask})`});
            const cpos = (c.C - c.L) / rng_, band = up => { let v = 0, d = 0; for (const [k, z] of c.lv) if (up ? k + bin / 2 >= c.L + .7 * rng_ : k + bin / 2 <= c.L + .3 * rng_) { v += z.v; d += z.d; } return {v, d}; }, T = band(true), Bm = band(false);
            if (T.v >= .3 * c.v && T.d >= .15 * T.v && cpos < .5) P.push({i, k: top, s: 1, t: 'A', x: `absorpcja kupna przy szczycie (${Math.round(T.v / c.v * 100)}% wolumenu, Δ ${fmt(T.d, 1)})`});
            if (Bm.v >= .3 * c.v && Bm.d <= -.15 * Bm.v && cpos > .5) P.push({i, k: bot, s: -1, t: 'A', x: `absorpcja sprzedaży przy dołku (${Math.round(Bm.v / c.v * 100)}% wolumenu, Δ ${fmt(Bm.d, 1)})`}); }
          if (ks.length >= 3) for (const side of [1, -1]) {
            const Z = ks.filter(k => { const z = c.lv.get(k), mid = k + bin / 2, inB = side > 0 ? mid >= c.L + .6 * rng_ : mid <= c.L + .4 * rng_, ag = side > 0 ? z.ask : z.bid, op = side > 0 ? z.bid : z.ask; return inB && ag >= 10 && ag >= 2 * Math.max(op, 1); });
            if (Z.length < 2 || Z.reduce((a, k) => a + c.lv.get(k).v, 0) < .15 * c.v) continue;
            const zlo = Math.min(...Z), zhi = Math.max(...Z) + bin; let j = null; for (let q = i + 1; q <= Math.min(cs.length - 1, i + 3); q++) if (side > 0 ? cs[q].C < zlo : cs[q].C > zhi) { j = q; break; }
            if (j != null) P.push({i, k: side > 0 ? Math.max(...Z) : Math.min(...Z), s: side, t: 'UT', x: `uwięzieni ${side > 0 ? 'kupujący' : 'sprzedający'} w strefie ${zlo}–${zhi}, zamknięcie ${cs[j].t} ${side > 0 ? 'poniżej' : 'powyżej'}`}); } });
        return P; };
      const PAN = sel.map(tf => { const all = agg(TFS[tf]), cs = all.slice(-NC), off = all.length - cs.length; return {tf, cs, P: pats(all).filter(p => p.i >= off).map(p => ({...p, i: p.i - off}))}; });
      const shown = PAN.flatMap(p => p.cs);
      if (!shown.length) { $('mtWinPx').textContent = ''; $('mtWinB').innerHTML = '<p class="note">Brak świec do pokazania w tym widoku.</p>'; }
      else {
        const lo = Q(Math.floor(Math.min(...shown.map(c => c.L)) / bin + 1e-9) * bin), hi = Q(Math.floor(Math.max(...shown.map(c => c.H)) / bin + 1e-9) * bin), nb = Math.round((hi - lo) / bin) + 1;
        const full = MODE === 'num' || (MODE === 'auto' && nb <= 70), RH = full ? 13 : Math.max(4, Math.min(12, Math.floor(560 / nb))), CWm = full ? 60 : 24, ST = 7, GAP = 14, AX = 54, RM = 10, T0 = 6, FT = 8;
        const Y = k => T0 + (hi - k) / bin * RH, Hs = T0 + nb * RH + FT, kf = n => Math.abs(n) >= 1e4 ? Math.round(n / 1e3) + 'k' : Math.abs(n) >= 1e3 ? (n / 1e3).toFixed(1).replace('.', ',') + 'k' : String(Math.round(n));
        let x = AX, g = '', ov = '', gh = '', gf = '';
        const px = []; PAN.forEach(p => { p.x0 = x; p.w = p.cs.length * (CWm + ST); x += p.w + GAP; px.push(p); });
        const Ws = x - GAP + RM;
        // oś ceny (lewa)
        const every = Math.max(1, Math.ceil(16 / RH));
        for (let r = 0; r < nb; r++) { const k = hi - r * bin; if (r % every) continue; g += `<text x="${AX - 6}" y="${Y(k) + RH / 2 + 3.5}" text-anchor="end" font-size="9.5" fill="var(--mut)" font-variant-numeric="tabular-nums">${(k + bin / 2).toFixed(DEC)}</text>`; }
        for (const p of PAN) {
          gh += `<text x="${p.x0}" y="15" font-size="11.5" font-weight="700" fill="var(--ink)">${TFL[p.tf]} min</text><text x="${p.x0 + 50}" y="15" font-size="10" fill="var(--mut)">ostatnie ${p.cs.length}</text>`;
          p.cs.forEach((c, ci) => { const x0 = p.x0 + ci * (CWm + ST), cx = x0 + ST / 2, up = c.C >= c.O;
            g += `<rect class="mtc" data-a="${c.a}" data-b="${c.b}" x="${x0 - 1}" y="${T0 - 4}" width="${CWm + ST}" height="${nb * RH + 8}" rx="3" fill="transparent"><title>${TFL[p.tf]} min ${c.t}${c.cur ? ' (niepełna)' : ''}: O ${c.O.toFixed(DEC)} H ${c.H.toFixed(DEC)} L ${c.L.toFixed(DEC)} C ${c.C.toFixed(DEC)} · Δ ${fmt(c.d, 1)} · wolumen ${fmt(c.v)}${c.rv ? ` (×${c.rv.toFixed(2)} średniej świec ${p.tf} tej sesji)` : ''} · POC świecy ${c.pocK != null ? (c.pocK + bin / 2).toFixed(DEC) : '–'}</title></rect>`;
            g += `<line x1="${cx}" x2="${cx}" y1="${Y(Q(Math.floor(c.H / bin + 1e-9) * bin))}" y2="${Y(Q(Math.floor(c.L / bin + 1e-9) * bin)) + RH}" stroke="var(--mut)" stroke-width="1"/>`;
            const bo = Q(Math.floor(Math.max(c.O, c.C) / bin + 1e-9) * bin), bc = Q(Math.floor(Math.min(c.O, c.C) / bin + 1e-9) * bin);
            g += `<rect x="${cx - 2.5}" y="${Y(bo)}" width="5" height="${Y(bc) - Y(bo) + RH}" fill="${up ? 'var(--buy)' : 'var(--sell)'}"/>`;
            for (const [k, z] of c.lv) { const yy = Y(k), xc = x0 + ST, r = c.vmax ? z.v / c.vmax : 0, poc = k === c.pocK;
              if (full) { const ib = z.ask >= 3 * Math.max(z.bid, 1) && z.ask >= 5, is = z.bid >= 3 * Math.max(z.ask, 1) && z.bid >= 5;
                g += `<rect x="${xc}" y="${yy + .5}" width="${(CWm - 2) * r}" height="${RH - 1}" fill="var(--bar)" opacity=".22"/>`
                  + (poc ? `<rect x="${xc}" y="${yy + .5}" width="${CWm - 2}" height="${RH - 1}" fill="none" stroke="var(--poc)" stroke-width="1.2"/>` : '')
                  + `<text x="${xc + CWm / 2 - 4}" y="${yy + RH - 3}" text-anchor="end" font-size="9.5" font-variant-numeric="tabular-nums" fill="${is ? 'var(--sell)' : 'var(--ink)'}" font-weight="${is ? 800 : 400}">${kf(z.bid)}</text><text x="${xc + CWm / 2 - 1}" y="${yy + RH - 3}" text-anchor="middle" font-size="9" fill="var(--mut)">×</text><text x="${xc + CWm / 2 + 2}" y="${yy + RH - 3}" font-size="9.5" font-variant-numeric="tabular-nums" fill="${ib ? 'var(--buy)' : 'var(--ink)'}" font-weight="${ib ? 800 : 400}">${kf(z.ask)}</text>`; }
              else g += `<rect x="${xc}" y="${yy + .5}" width="${CWm - 2}" height="${Math.max(1, RH - 1)}" fill="${z.d >= 0 ? 'var(--buy)' : 'var(--sell)'}" opacity="${(.12 + .78 * r).toFixed(2)}"${poc ? ' stroke="var(--poc)" stroke-width="1.4"' : ''}/>`; }
            const yb = 0;
            gf += `<text x="${x0 + (CWm + ST) / 2}" y="${yb + 10}" text-anchor="middle" font-size="9.5" fill="var(--mut)">${c.t}${c.cur ? '*' : ''}</text>`
              + `<text x="${x0 + (CWm + ST) / 2}" y="${yb + 23}" text-anchor="middle" font-size="9.5" font-weight="700" font-variant-numeric="tabular-nums" fill="${c.d >= 0 ? 'var(--buy)' : 'var(--sell)'}">${c.d >= 0 ? '+' : '−'}${kf(Math.abs(c.d))}</text>`
              + `<text x="${x0 + (CWm + ST) / 2}" y="${yb + 36}" text-anchor="middle" font-size="9.5" font-variant-numeric="tabular-nums" fill="${c.rv >= 1.5 ? 'var(--hot)' : 'var(--mut)'}" font-weight="${c.rv >= 1.5 ? 700 : 400}">${c.rv ? '×' + c.rv.toFixed(1).replace('.', ',') : '–'}</text>`
; });
          for (const q of p.P) { const x0 = p.x0 + q.i * (CWm + ST), yy = q.s > 0 ? Y(q.k) - 1 : Y(q.k) + RH + 1, w_ = q.t === 'UT' ? 20 : 14, col = q.s > 0 ? 'var(--sell)' : 'var(--buy)';
            ov += `<g><title>${TFL[p.tf]} min ${p.cs[q.i].t}: ${q.x}</title><rect x="${x0 + ST + CWm - w_ - 2}" y="${q.s > 0 ? yy - 11 : yy}" width="${w_}" height="11" rx="2" fill="${col}"/><text x="${x0 + ST + CWm - w_ / 2 - 2}" y="${q.s > 0 ? yy - 2.5 : yy + 8.5}" text-anchor="middle" font-size="8.5" font-weight="700" fill="var(--panel)">${q.t}</text></g>`; } }
        // poziomy z wagą ≥ 2 (★★) przez wszystkie kolumny
        const WL = []; for (const L of LEV) { const v = +L[0]; if (/^ATR5/.test(L[3]) || v < lo || v > hi + bin) continue; const w = WGT(v).w; if (w < 2) continue; if (WL.some(q => Math.abs(q.v - v) < bin)) continue; WL.push({v, w, lab: L[3].replace(/ → test.*$/, '').replace(/\s[−+]?[\d.,]+$/, ''), col: L[1]}); }
        for (const q of WL) { const yy = T0 + (hi + bin - q.v) / bin * RH;
          ov += `<g><title>${q.lab}: ${q.v.toFixed(DEC)} · waga ${q.w}</title><line x1="${AX}" x2="${Ws - RM + 4}" y1="${yy}" y2="${yy}" stroke="${q.col}" stroke-width="${q.w >= 3 ? 2.6 : 1.8}" stroke-dasharray="6 3" opacity=".85"/><text x="${AX + 2}" y="${yy - 2}" font-size="9" font-weight="800" fill="${q.col}" paint-order="stroke" stroke="var(--panel)" stroke-width="3">${'★'.repeat(Math.min(q.w, 5))}</text></g>`; }
        // cena ostatniego zamknięcia
        { const yy = T0 + (hi + bin - LP) / bin * RH; ov += `<line x1="${AX}" x2="${Ws - RM + 4}" y1="${yy}" y2="${yy}" stroke="var(--ink)" stroke-width="1" stroke-dasharray="2 3"/><rect x="2" y="${yy - 8}" width="${AX - 6}" height="16" rx="3" fill="var(--ink)"/><text x="${AX / 2 - 1}" y="${yy + 3.5}" text-anchor="middle" font-size="9.5" font-weight="700" fill="var(--panel)">${LP.toFixed(DEC)}</text>`; }
        const xh = `<g class="mtx" style="display:none;pointer-events:none"><line class="h" x1="${AX}" x2="${Ws - RM + 4}" stroke="var(--ewr)" stroke-width="1"/><rect class="b" x="2" width="${AX - 6}" height="15" rx="3" fill="var(--ewr)"/><text class="t" x="${AX / 2 - 1}" text-anchor="middle" font-size="9.5" font-weight="700" fill="#fff"></text></g>`;
        $('mtWinPx').innerHTML = `${INST} · ${S.day.slice(8)}.${S.day.slice(5, 7)}${Number.isFinite(RL) ? ' · do ' + LT : ''} · krok ${bin}`;
        const segB = (attr, list, cur) => `<span class="seg">${list.map(([v, l]) => `<button data-${attr}="${v}" class="${cur(v) ? 'on' : ''}">${l}</button>`).join('')}</span>`;
        // podsumowanie: ostatnia świeca każdego interwału
        const sumR = PAN.map(p => { const c = p.cs[p.cs.length - 1]; if (!c) return ''; const pl = p.P.filter(q => q.i === p.cs.length - 1).map(q => q.t).join(' ');
          return `<span>${TFL[p.tf]} min ${c.t}${c.cur ? '*' : ''}: Δ <b class="${c.d >= 0 ? 'buy' : 'sell'}">${fmt(c.d, 1)}</b> · wol. <b>${c.rv ? '×' + c.rv.toFixed(1).replace('.', ',') : '–'}</b>${pl ? ` · <b>${pl}</b>` : ''}</span>`; }).join('');
        $('mtWinB').innerHTML = `<div class="dls">${segB('mtf', [['M5', '5'], ['M15', '15'], ['M30', '30'], ['H1', '60 min']], v => sel.includes(v))}${segB('mtn', [[4, '4'], [6, '6'], [8, '8'], [12, '12 świec']], v => v === NC)}${segB('mtm', [['auto', 'auto'], ['num', 'liczby'], ['col', 'kolory']], v => v === MODE)}</div>`
          + `<div class="dls" style="border:0;padding-top:0">${sumR}</div>`
          + (WL.length ? `<div class="dls" style="border:0;padding-top:0">${WL.sort((a, b) => b.v - a.v).map(q => `<span style="color:${q.col}"><b style="color:inherit">${'★'.repeat(Math.min(q.w, 5))}</b> ${q.lab} ${q.v.toFixed(DEC)}</span>`).join('')}</div>` : '<div class="dls" style="border:0;padding-top:0"><span>poziomów z wagą ≥ 2 w tym zakresie cen: brak</span></div>')
          + `<div class="mtsc"><svg class="mth" viewBox="0 0 ${Ws} 22" width="${Ws}" height="22">${gh}</svg><svg class="mtsvg" data-t="${T0}" data-hi="${hi}" data-nb="${nb}" data-rh="${RH}" data-w="${Ws}" data-h="${Hs}" viewBox="0 0 ${Ws} ${Hs}" width="${Ws}" height="${Hs}" style="display:block;cursor:crosshair">${g}${ov}${xh}</svg><svg class="mtf" viewBox="0 0 ${Ws} 42" width="${Ws}" height="42">${gf}</svg></div>`
          + `<p class="note">Świece 15 / 30 / 60 min złożone ze świec 5 min wybranej sesji (${S.rng === 'rth' ? 'sesja kasowa' : 'cała doba'}), krok ceny jak na wykresie. W trybie liczb: bid × ask na poziomie, pogrubione = przewaga ≥ 3× (zielony ask, czerwony bid), szary pasek = wolumen poziomu względem POC świecy, ramka = POC świecy. W trybie kolorów: kolor = znak delty poziomu, nasycenie = wolumen. Pod świecą: godzina, delta, wolumen × średnia świec tego interwału w sesji (* = świeca niepełna). W / A / UT – te same definicje co na wykresie, liczone osobno na każdym interwale (czerwony przy szczycie, zielony przy dołku). Linie przerywane z gwiazdkami = poziomy z wagą ≥ 2. Najechanie na świecę podświetla świece innych interwałów z tego samego czasu. Zgodność interwałów w naszych testach nie dawała kontynuacji – okno pomaga czytać, nie daje sygnału.</p>`;
        { const sc = $('mtWinB').querySelector('.mtsc'), yp = T0 + (hi + bin - LP) / bin * RH; sc.scrollTop = Math.max(0, yp + 22 - sc.clientHeight / 2); sc.scrollLeft = sc.scrollWidth; }
        const sv = $('mtWinB').querySelector('.mtsvg'), xg = sv.querySelector('.mtx'), hl = xg.querySelector('.h'), bx_ = xg.querySelector('.b'), tx = xg.querySelector('.t'), cs_ = [...sv.querySelectorAll('.mtc')];
        sv.addEventListener('pointermove', e => { const r = sv.getBoundingClientRect(), yy = (e.clientY - r.top) / r.height * Hs; if (yy < T0 || yy > T0 + nb * RH) { xg.style.display = 'none'; } else {
            const k = hi - Math.floor((yy - T0) / RH) * bin, yc = Y(k) + RH / 2; hl.setAttribute('y1', yc); hl.setAttribute('y2', yc); bx_.setAttribute('y', yc - 7.5); tx.setAttribute('y', yc + 3.5);
            const dd_ = k + bin / 2 - LP; tx.textContent = (k + bin / 2).toFixed(DEC); bx_.parentNode.querySelector('title')?.remove(); xg.style.display = ''; xg.setAttribute('data-d', dd_); }
          const t_ = e.target.closest('.mtc') || (() => { const xx = (e.clientX - r.left) / r.width * Ws; return cs_.find(q => xx >= +q.getAttribute('x') && xx <= +q.getAttribute('x') + +q.getAttribute('width')); })();
          if (!t_) { cs_.forEach(q => q.classList.remove('hl')); return; } const a = +t_.dataset.a, b = +t_.dataset.b; cs_.forEach(q => q.classList.toggle('hl', +q.dataset.a <= b && +q.dataset.b >= a)); });
        sv.addEventListener('pointerleave', () => { xg.style.display = 'none'; cs_.forEach(q => q.classList.remove('hl')); });
        $('mtWinB').querySelectorAll('[data-mtf]').forEach(b_ => b_.onclick = () => { const v = b_.dataset.mtf; let s = sel.slice(); if (s.includes(v)) { if (s.length > 1) s = s.filter(q => q !== v); } else { s.push(v); if (s.length > 3) s.shift(); } S.mtTf = s; save(); render(true); });
        $('mtWinB').querySelectorAll('[data-mtn]').forEach(b_ => b_.onclick = () => { S.mtN = +b_.dataset.mtn; save(); render(true); });
        $('mtWinB').querySelectorAll('[data-mtm]').forEach(b_ => b_.onclick = () => { S.mtMode = b_.dataset.mtm; save(); render(true); }); } } }

  // v1.3 karta świecy (klik w świecę): OHLC, wolumen, delta i delta %, max/min delta narastająca w świecy (z jej świec M5), POC i VA 70% świecy,
  // imbalanse kupna / sprzedaży, niedokończona aukcja góra / dół, tabela poziomów (bid, ask, delta, wolumen); wszystko z tych samych danych co wykres
  { const box = $('cdWin'), ci = S.cd && S.cd.day === S.day && S.cd.tf === S.tf ? cols.findIndex(c => c.t === S.cd.t) : -1; box.hidden = ci < 0;
    if (ci >= 0) { const c = cols[ci], ks = [...c.lv.keys()].sort((a, b) => b - a), f1 = v => (+v).toFixed(DEC), sg = v => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v)), dp = c.v ? c.d / c.v * 100 : 0;
      let mx = null, mn = null; if (c.parts && c.parts.length > 1) { let a = 0; mx = -Infinity; mn = Infinity; for (const b of c.parts) { for (const z of b.lv.values()) a += z.ask - z.bid; mx = Math.max(mx, a); mn = Math.min(mn, a); } }
      const vs = ks.map(k => c.lv.get(k).v), tot = vs.reduce((a, b) => a + b, 0); let pi = vs.indexOf(Math.max(...vs)), a0 = pi, a1 = pi, ac = vs[pi] || 0;
      while (ac < .7 * tot && (a0 > 0 || a1 < ks.length - 1)) { const nx = a0 > 0 ? vs[a0 - 1] : -1, pv = a1 < ks.length - 1 ? vs[a1 + 1] : -1; if (nx >= pv) ac += vs[--a0]; else ac += vs[++a1]; }
      const vah = ks[a0] + bin, val = ks[a1], IM = imbalances(c, bin), top = ks[0], bot = ks[ks.length - 1], zt = c.lv.get(top), zb = c.lv.get(bot), uaT = zt && zt.bid > 0 && zt.ask > 0, uaB = zb && zb.bid > 0 && zb.ask > 0;
      const dmx = Math.max(1, ...ks.map(k => Math.abs(c.lv.get(k).d))), vmx = Math.max(1, ...vs);
      $('cdWinPx').innerHTML = `${S.tf} · ${c.t}${c.t2 && c.t2 !== c.t ? '–' + c.t2 : ''} · ${S.day.slice(8)}.${S.day.slice(5, 7)}`;
      const kv = (k, v, cl = '') => `<div><span>${k}</span><b class="${cl}">${v}</b></div>`;
      let h = `<div class="cdg">${kv('Open / High', `${f1(c.O)} / ${f1(c.H)}`)}${kv('Low / Close', `${f1(c.L)} / ${f1(c.C)}`)}${kv('Wolumen', fmt(c.v) + (c.x ? ` <small>(×${c.x.toFixed(2)} śr.)</small>` : ''))}${kv('Delta', `${sg(c.d)} <small>(${dp > 0 ? '+' : ''}${dp.toFixed(0)}%)</small>`, c.d > 0 ? 'buy' : c.d < 0 ? 'sell' : '')}`
        + `${kv('Max / min delta w świecy', mx == null ? '<small>– (świeca M5)</small>' : `${sg(mx)} / ${sg(mn)}`)}${kv('Delta narastająca dnia', sg(c.acc), c.acc > 0 ? 'buy' : c.acc < 0 ? 'sell' : '')}${kv('POC · VA 70% świecy', `${f1(ks[pi])} · ${f1(val)}–${f1(vah)}`)}`
        + `${kv('Imbalanse kupna · sprzedaży', `<span class="buy">${IM.buy.size}</span> · <span class="sell">${IM.sell.size}</span>${IM.zones.length ? ` <small>(${IM.zones.length} stref)</small>` : ''}`)}${kv('Niedokończona aukcja', [uaT ? 'góra ▲' : '', uaB ? 'dół ▼' : ''].filter(Boolean).join(' · ') || '<small>brak</small>')}</div>`;
      h += `<div class="cdt"><table><tr><th>Cena</th><th>Bid</th><th>Ask</th><th>Delta</th><th>Wolumen</th></tr>` + ks.map(k => { const z = c.lv.get(k), ib = IM.buy.has(k), is = IM.sell.has(k);
        return `<tr class="${k === ks[pi] ? 'poc' : k >= val && k < vah ? 'va' : ''}"><td>${f1(k)}${bin > TK ? '–' + f1(k + bin) : ''}${k === ks[pi] ? ' <small>POC</small>' : ''}</td><td class="${is ? 'sell b' : ''}">${fmt(z.bid)}</td><td class="${ib ? 'buy b' : ''}">${fmt(z.ask)}</td>`
          + `<td><i class="cdb ${z.d >= 0 ? 'p' : 'n'}" style="width:${Math.abs(z.d) / dmx * 46}px"></i><span class="${z.d > 0 ? 'buy' : z.d < 0 ? 'sell' : ''}">${sg(z.d)}</span></td><td><i class="cdb v" style="width:${z.v / vmx * 46}px"></i>${fmt(z.v)}</td></tr>`; }).join('') + `</table></div>`;
      h += `<p class="note">Pogrubione bid / ask = imbalans ukośny ≥ 3:1 (min. 20). Tło: POC i VA 70% świecy. Klik w tę samą świecę lub × zamyka kartę; klik w inną – przełącza.</p>`;
      $('cdWinB').innerHTML = h;
      const fp = $('fp'), x0 = ci * CW; fp.insertAdjacentHTML('beforeend', `<rect x="${x0 + 1}" y="${HEAD}" width="${CW - 2}" height="${H}" fill="none" stroke="${css('--vwap')}" stroke-width="1.5" pointer-events="none"/>`); } }
  // okno statusu VA: ostatnie 60–240 min, doba, 5 sesji – cena (ostatnie zamknięcie w widoku) względem VA 70%
  { const box = $('vaWin'); box.hidden = !S.vaw;
    if (S.vaw) {
      const vaOf = (DD, sel) => { const ids = new Set(); DD.boxes.forEach((b, i) => { if (b && sel(i)) ids.add(i); }); if (!ids.size) return null; const pm = new Map(); let dl = 0;
        for (const [bi, p, bid, ask] of DD.cells) if (ids.has(bi)) { const k = Q(Math.floor(p / bin + 1e-9) * bin); pm.set(k, (pm.get(k) || 0) + bid + ask); dl += ask - bid; }
        const ks = [...pm.keys()].sort((a, b) => a - b); if (!ks.length) return null; const vs = ks.map(k => pm.get(k)), tot = vs.reduce((a, b) => a + b, 0);
        let pi = vs.indexOf(Math.max(...vs)), a0 = pi, a1 = pi, ac = vs[pi];
        while (ac < .7 * tot && (a0 > 0 || a1 < ks.length - 1)) { const up = a1 < ks.length - 1 ? vs[a1 + 1] : -1, dn = a0 > 0 ? vs[a0 - 1] : -1; if (up >= dn) ac += vs[++a1]; else ac += vs[--a0]; }
        return {val: ks[a0], vah: ks[a1] + bin, poc: ks[pi] + bin / 2, n: ids.size, dl, vol: tot}; };
      const mk = (LIx, RLx) => {   // wiersze okna dla stanu „do świecy LIx”; D-1 jest stałe (brak migracji)
        const rows = [60, 90, 120, 180, 240].map(n => [`Last ${n} min`, vaOf(D, i => i <= LIx && i > LIx - n / 5)]);
        { const R0 = D.boxes.findIndex(b => b && b[9] === 1);   // pierwsza świeca sesji kasowej dnia
          rows.push([R0 < 0 ? 'Przed sesją (cała doba)' : 'Przed sesją', vaOf(D, i => i <= RLx && (R0 < 0 || i < R0)), 'extra'],
                    ['Sesja kasowa', R0 < 0 || RLx < R0 ? null : vaOf(D, i => i <= RLx && D.boxes[i][9] === 1), R0 < 0 ? 'nocash' : RLx < R0 ? 'notyet' : 'extra']); }
        rows.push(['Daily (doba)', vaOf(D, i => i <= RLx)]);
        { const ds = Object.keys(DATA).sort(), j = ds.indexOf(S.day), pd = j > 0 ? ds[j - 1] : null;   // wczorajsze VA (poprzednia sesja w danych)
          if (pd) { const P = DATA[pd], lab = `${pd.slice(8)}.${pd.slice(5, 7)}`; rows.push([`D-1 doba (${lab})`, vaOf(P, () => true), 'static'], [`D-1 sesja kas. (${lab})`, vaOf(P, i => P.boxes[i][9] === 1), 'static']); }
          else rows.push(['D-1', null, 'static']); }
        { const ds = Object.keys(DATA).sort(), j = ds.indexOf(S.day), use = ds.slice(Math.max(0, j - 4), j + 1), bx = [], cl = [];
          for (const dk of use) { const P = DATA[dk], o_ = bx.length; P.boxes.forEach((b, i) => bx.push(dk === S.day && i > RLx ? null : b)); for (const c of P.cells) cl.push([c[0] + o_, c[1], c[2], c[3]]); }
          rows.push([`5 Daily${use.length < 5 ? ` (${use.length})` : ''}`, vaOf({boxes: bx, cells: cl}, i => bx[i] != null)]); }
        return rows; };
      const RLc = Number.isFinite(RL) ? RL : D.boxes.length - 1, rows = mk(LI, RLc);
      const PC = cols.length > 1 ? cols[cols.length - 2] : null, prev = PC ? mk(PC.last, PC.last) : null;
      const f = v => (+v).toFixed(DEC), dist = (v, r) => v > r.vah ? '+' + f(v - r.vah) : v < r.val ? '−' + f(r.val - v) : (v - r.val <= r.vah - v ? f(v - r.val) + ' od VAL' : f(r.vah - v) + ' do VAH');
      const mig = (r, q, kind) => {   // migracja VA względem poprzedniego odczytu (poprzednia świeca)
        if (kind === 'static') return '<span class="vam" title="poprzednia sesja – VA się nie zmienia">–</span>';
        if (!q) return '<span class="vam">–</span>';
        const dv = r.val - q.val, dp = r.poc - q.poc, dh = r.vah - q.vah, e = bin / 2, sg_ = v => (v > 0 ? '+' : v < 0 ? '−' : '±') + f(Math.abs(v));
        let lab, cl;
        if (Math.abs(dv) < e && Math.abs(dp) < e && Math.abs(dh) < e) { lab = '= bez zmian'; cl = ''; }
        else if (dp >= e && dv >= -e && dh >= -e) { lab = '▲ wyżej'; cl = 'buy'; }
        else if (dp <= -e && dv <= e && dh <= e) { lab = '▼ niżej'; cl = 'sell'; }
        else if (dh >= e && dv <= -e) { lab = '↕ rozszerza'; cl = ''; }
        else if (dh <= -e && dv >= e) { lab = '↔ zawęża'; cl = ''; }
        else { lab = dp > 0 ? 'POC ▲' : dp < 0 ? 'POC ▼' : (dh > 0 || dv > 0 ? 'VA ▲' : 'VA ▼'); cl = (dp > 0 || (dp === 0 && (dh > 0 || dv > 0))) ? 'buy' : 'sell'; }
        const st = v => LP < v.val ? 'pod VAL' : LP > v.vah ? 'nad VAH' : 'w VA';
        return `<span class="vam ${cl}" title="poprzedni odczyt (${PC.t}): VAL ${f(q.val)} · POC ${f(q.poc)} · VAH ${f(q.vah)}; zmiana: VAL ${sg_(dv)}, POC ${sg_(dp)}, VAH ${sg_(dh)}">${lab}</span>${Math.abs(dp) >= e ? ` <span class="vamd">POC ${sg_(dp)}</span>` : ''}`; };
      // zgodność horyzontów: +1 nad VAH / −1 pod VAL, ±0,5 migracja ▲ wyżej / ▼ niżej; 9 okien × 1,5 = 13,5 → −100…+100 (jak w research/zgodnosc_test.py)
      let zs = 0, zn = 0;
      rows.forEach(([lab, r, kind], ri) => { if (!r || kind === 'static') return; zn++; zs += LP > r.vah ? 1 : LP < r.val ? -1 : 0;
        const q = prev && prev[ri] && prev[ri][1]; if (!q) return; const e = bin / 2, dv = r.val - q.val, dp = r.poc - q.poc, dh = r.vah - q.vah;
        if (dp >= e && dv >= -e && dh >= -e) zs += .5; else if (dp <= -e && dv <= e && dh <= e) zs -= .5; });
      const Zc = Math.round(zs / 13.5 * 100), Zl = Zc >= 50 ? 'silna zgodność ↑' : Zc >= 20 ? 'przewaga wzrostów' : Zc > -20 ? 'równowaga' : Zc > -50 ? 'przewaga spadków' : 'silna zgodność ↓',
        Zk = Zc >= 20 ? 'buy' : Zc <= -20 ? 'sell' : 'in', Zw = Math.min(50, Math.abs(Zc) / 2);
      const zHTML = `<div class="vaz"><div class="vazh"><b>Zgodność horyzontów</b><span class="vazv ${Zk}">${Zc > 0 ? '+' : Zc < 0 ? '−' : ''}${Math.abs(Zc)}</span><span class="vazl">${Zl}</span><span class="st stk" title="Test na 14 rynkach (dane 5 min, sesje 22.10–06.11.2026): przy zgodności ≥ 20 w jedną stronę cena w ciągu 60 min średnio COFAŁA się o ok. 0,3 ATR (90%: 0,2–0,45; 70% sesji), zamiast iść dalej. Jako filtr nie poprawił QM (n za małe) ani utrzymania stref imbalansów (73% vs 70%, p 0,09). Krótka historia – liczymy dalej.">test: brak kontynuacji</span></div>`
        + `<div class="vazt" title="−100 = cena pod VAL we wszystkich oknach i VA migruje w dół; +100 = nad VAH wszędzie i VA migruje w górę"><i class="c"></i><i class="f ${Zk}" style="${Zc >= 0 ? 'left:50%' : `left:${50 - Zw}%`};width:${Zw}%"></i><i class="m" style="left:${50 + Zc / 2}%"></i></div>`
        + `<div class="vazs"><span>−100</span><span>pod VAL · ▼</span><span>0</span><span>▲ · nad VAH</span><span>+100</span></div></div>`;
      $('vaWinPx').innerHTML = `cena ${f(LP)} · ${LT}`;
      $('vaWinB').innerHTML = zHTML + '<table><tr><th>Okno</th><th>VAL</th><th>POC</th><th>VAH</th><th>Status</th><th>Odl.</th><th title="Delta okna (ask − bid) i jej udział w wolumenie okna; strzałka = zmiana delty od poprzedniego odczytu">Δ okna</th><th>Migracja' + (PC ? ` vs ${PC.t}` : '') + '</th></tr>' + rows.map(([lab, r, kind], ri) => !r ? `<tr><td>${lab}</td><td colspan="7" style="text-align:center;color:var(--mut)">${kind === 'notyet' ? 'sesja kasowa jeszcze się nie zaczęła' : kind === 'nocash' ? 'brak sesji kasowej w danych tego dnia' : 'brak danych'}</td></tr>`
        : `<tr><td>${lab}</td><td>${f(r.val)}</td><td>${f(r.poc)}</td><td>${f(r.vah)}</td><td>${LP < r.val ? '<span class="vas dn">pod VAL</span>' : LP > r.vah ? '<span class="vas up">nad VAH</span>' : `<span class="vas in">w VA</span> ${LP < r.poc ? '<span class="vat sell" title="cena w VA pod POC – strona sprzedających">sell</span>' : LP > r.poc ? '<span class="vat buy" title="cena w VA nad POC – strona kupujących">buy</span>' : '<span class="vat">= POC</span>'}`}</td><td style="font-size:11px">${dist(LP, r)}</td><td>${(() => { const q = kind === 'static' || !prev ? null : prev[ri][1], pc_ = r.vol ? Math.round(r.dl / r.vol * 100) : 0, ch = q ? r.dl - q.dl : null;
          return `<span class="vam ${r.dl > 0 ? 'buy' : r.dl < 0 ? 'sell' : ''}" title="delta ${fmt(r.dl, 1)} przy wolumenie ${fmt(r.vol)} (${pc_ > 0 ? '+' : ''}${pc_}% wolumenu)${q ? `; poprzedni odczyt (${PC.t}): ${fmt(q.dl, 1)}` : ''}">${fmt(r.dl, 1)}</span> <span class="vamd">${pc_ > 0 ? '+' : ''}${pc_}%${ch != null && ch !== 0 ? ` ${ch > 0 ? '▲' : '▼'}` : ''}</span>`; })()}</td><td>${mig(r, kind === 'static' || !prev ? null : prev[ri][1], kind)}</td></tr>`).join('') + '</table>'
        + (() => {   // mapa poziomów: VA (VAL–VAH) i POC okien Last 60–240 i Daily na wspólnej osi ceny, pionowa linia = cena
          const mr = rows.filter(([lab, r]) => r && (S.vamAll !== false || !(lab.startsWith('D-1') || lab.startsWith('5 Daily'))));   // wszystkie wiersze tabeli: Last 60–240, przed sesją, sesja kasowa, Daily, D-1, 5 Daily
          if (!mr.length) return '';
          const lo0 = Math.min(LP, ...mr.map(([, r]) => r.val)), hi0 = Math.max(LP, ...mr.map(([, r]) => r.vah)), pad = (hi0 - lo0) * .06 || bin * 4, lo = lo0 - pad, hi = hi0 + pad;
          const Wm = 680, L0 = 100, R0 = 96, RH_ = 22, T0 = 22, X = v => L0 + (v - lo) / (hi - lo) * (Wm - L0 - R0), Hm = T0 + mr.length * RH_ + 18;
          let g = '';
          const step = (() => { const raw = (hi - lo) / 5, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; })();
          for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) g += `<line x1="${X(v)}" x2="${X(v)}" y1="${T0 - 4}" y2="${Hm - 16}" stroke="var(--line)"/><text x="${X(v)}" y="${Hm - 4}" text-anchor="middle" font-size="9.5" fill="var(--mut)">${(+v).toFixed(step < 1 ? 2 : 0)}</text>`;
          mr.forEach(([lab, r], i) => { const y0 = T0 + i * RH_, st = LP < r.val ? 'dn' : LP > r.vah ? 'up' : 'in', col = st === 'dn' ? 'var(--sell)' : st === 'up' ? 'var(--buy)' : 'var(--poc)', dp = LP - r.poc;
            g += `<g><title>${lab}: VAL ${f(r.val)} · POC ${f(r.poc)} · VAH ${f(r.vah)} · cena ${f(LP)} (${dp >= 0 ? '+' : '−'}${f(Math.abs(dp))} od POC; ${st === 'dn' ? 'pod VAL o ' + f(r.val - LP) : st === 'up' ? 'nad VAH o ' + f(LP - r.vah) : 'w VA'})</title>`
              + `<rect x="0" y="${y0}" width="${Wm}" height="${RH_}" fill="transparent"/><text x="${L0 - 8}" y="${y0 + 15}" text-anchor="end" font-size="11" fill="var(--ink)">${lab.replace(' min', '').replace(' (doba)', '').replace(' (cała doba)', '').replace(/D-1 doba \((.+)\)/, 'D-1 $1').replace(/D-1 sesja kas\. \((.+)\)/, 'D-1 kas. $1')}</text>`
              + `<rect x="${X(r.val)}" y="${y0 + 5}" width="${Math.max(2, X(r.vah) - X(r.val))}" height="${RH_ - 10}" rx="3" fill="${col}" opacity=".28" stroke="${col}" stroke-width="1"/>`
              + `<line x1="${X(r.poc)}" x2="${X(r.poc)}" y1="${y0 + 3}" y2="${y0 + RH_ - 3}" stroke="var(--ink)" stroke-width="2.5"/>`
              + `<text x="${Wm - R0 + 10}" y="${y0 + 15}" font-size="10.5" font-variant-numeric="tabular-nums" fill="${dp >= 0 ? 'var(--buy)' : 'var(--sell)'}">${dp >= 0 ? '+' : '−'}${f(Math.abs(dp))} od POC</text></g>`; });
          g += `<line x1="${X(LP)}" x2="${X(LP)}" y1="${T0 - 8}" y2="${Hm - 16}" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="3 2"/><text x="${X(LP)}" y="${T0 - 11}" text-anchor="middle" font-size="10.5" font-weight="700" fill="var(--ink)">cena ${f(LP)}</text>`;
          return `<div class="vamap"><div class="dlt" style="margin:8px 0 0;display:flex;align-items:center;gap:10px">Poziomy vs cena<span class="dls" style="border:0;padding:0"><span class="seg"><button data-vam="0" class="${S.vamAll === false ? 'on' : ''}">dziś</button><button data-vam="1" class="${S.vamAll !== false ? 'on' : ''}">+ D-1 i 5 Daily</button></span></span></div><svg class="vamsvg" data-lo="${lo}" data-hi="${hi}" data-l0="${L0}" data-r0="${R0}" data-w="${Wm}" data-h="${Hm}" data-t="${T0}" data-lp="${LP}" viewBox="0 0 ${Wm} ${Hm}" width="100%" style="display:block;overflow:visible;cursor:crosshair">${g}<g class="vamx" style="display:none;pointer-events:none"><line y1="${T0 - 8}" y2="${Hm - 16}" stroke="var(--ewr)" stroke-width="1"/><line class="h" x1="0" x2="${Wm}" stroke="var(--ewr)" stroke-width="1" stroke-dasharray="2 2" opacity=".6"/><rect class="b" y="${Hm - 15}" height="15" rx="3" fill="var(--ewr)"/><text class="t" y="${Hm - 4}" text-anchor="middle" font-size="10" font-weight="700" fill="#fff"></text></g></svg><div class="vamk"><span><i style="background:var(--poc)"></i>VA (cena w VA)</span><span><i style="background:var(--sell)"></i>VA (cena pod VAL)</span><span><i style="background:var(--buy)"></i>VA (cena nad VAH)</span><span><i style="background:var(--ink);width:3px;opacity:1"></i>POC</span><span><i class="d"></i>cena</span></div></div>`; })()
        + `<p class="note">VA 70% z footprintu (krok ${bin} pkt), cena = ostatnie zamknięcie w widoku${S.rp ? ' (odtwarzanie)' : ''}. W VA: sell = cena pod POC, buy = nad POC. D-1 = poprzednia sesja w danych. Migracja = zmiana VA względem poprzedniej świecy (▲ wyżej / ▼ niżej / ↕ rozszerza / ↔ zawęża; szczegóły po najechaniu). Odl. = punkty od przekroczonej granicy VA (w VA: do bliższej granicy). Zgodność = położenie ceny (±1) i migracja (±0,5) w oknach Last 60–240, przed sesją, sesja kasowa, Daily i 5 Daily, skala −100…+100; D-1 nie wchodzi. Przed sesją = świece dnia przed otwarciem sesji kasowej. W teście nie wskazywała dalszego ruchu – to opis stanu, nie trend do grania. Na mapie poziomów celownik pokazuje cenę pod kursorem i odległość od bieżącej ceny. Okno przesuwasz za nagłówek. Opis położenia, nie sygnał.</p>`;
      { const sv = $('vaWinB').querySelector('.vamsvg');   // celownik na mapie poziomów: cena pod kursorem i odległość od bieżącej ceny
        if (sv) { const q = k => +sv.dataset[k], xg = sv.querySelector('.vamx'), vl = xg.children[0], hl = xg.children[1], bx_ = xg.children[2], tx = xg.children[3];
          sv.addEventListener('pointermove', e => { const r = sv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * q('w'), y = (e.clientY - r.top) / r.height * q('h');
            if (x < q('l0') || x > q('w') - q('r0')) { xg.style.display = 'none'; return; }
            const p = Math.round((q('lo') + (x - q('l0')) / (q('w') - q('l0') - q('r0')) * (q('hi') - q('lo'))) / bin) * bin, dd_ = p - q('lp'), xs = q('l0') + (p - q('lo')) / (q('hi') - q('lo')) * (q('w') - q('l0') - q('r0'));
            vl.setAttribute('x1', xs); vl.setAttribute('x2', xs); hl.setAttribute('y1', y); hl.setAttribute('y2', y);
            tx.textContent = `${p.toFixed(DEC)}  (${dd_ >= 0 ? '+' : '−'}${Math.abs(dd_).toFixed(DEC)})`; tx.setAttribute('x', xs); const tw = tx.textContent.length * 6 + 10; bx_.setAttribute('x', xs - tw / 2); bx_.setAttribute('width', tw);
            xg.style.display = ''; });
          sv.addEventListener('pointerleave', () => { xg.style.display = 'none'; }); } }
      $('vaWinB').querySelectorAll('[data-vam]').forEach(b => b.onclick = () => { S.vamAll = b.dataset.vam === '1'; save(); render(true); }); } }
  const TW = PW * SEG.length;
  const pf = $('prof'); pf.setAttribute('width', TW); pf.setAttribute('height', pB); pf.innerHTML = PB.join('') + '<g id="xhp" pointer-events="none"></g>';
  const pc = $('pcorner'); pc.setAttribute('width', TW); pc.setAttribute('height', HH + 8); pc.innerHTML = PH.join('');
  const pb = $('pbcorner'); pb.setAttribute('width', TW); pb.setAttribute('height', FH); pb.innerHTML = PF.join('');
  ax.push(`<rect x="2" y="${y(LP) - 8}" width="${AW - 4}" height="16" rx="3" fill="${C.ink}"/><text x="${AW / 2}" y="${y(LP) + 3.5}" text-anchor="middle" font-size="10" font-weight="600" fill="${css('--panel')}">${PXF(LP)}</text>`);
  const axs = $('axis'); axs.setAttribute('width', AW); axs.setAttribute('height', HEAD + H + FOOT); axs.innerHTML = ax.join('');
  if (keep !== true) { const w = $('wrap'); const ys = cols.slice(0, 12).map(c => y(c.C)); w.scrollTop = Math.max(0, (Math.min(...ys) + Math.max(...ys)) / 2 - (w.clientHeight - HH) / 2); w.scrollLeft = 0; }
  { const g = document.getElementById('lvlab'); if (g) g.setAttribute('transform', `translate(${$('wrap').scrollLeft},0)`); }
  $('fp').insertAdjacentHTML('beforeend', '<g id="xh" pointer-events="none"></g>'); $('axis').insertAdjacentHTML('beforeend', '<g id="xha" pointer-events="none"></g>'); $('ftr').insertAdjacentHTML('beforeend', '<g id="xhf" pointer-events="none"></g>');
  if (typeof tick === 'function') tick();
  const tot = cols.reduce((a, c) => a + c.d, 0), vol = cols.reduce((a, c) => a + c.v, 0), last = cols[cols.length - 1];
  $('sum').innerHTML = (S.bin === 'auto' ? `<span>Krok auto: <b>${bin} pkt</b></span>` : '') + `<span>Ostatnia cena: <b>${PXF(LP)}</b> (${LT}${last.ap ? '*' : ''})</span><span>Świec: <b>${cols.length}</b></span><span>Zakres: <b>${PXF(Math.min(...cols.map(c => c.L)))}–${PXF(Math.max(...cols.map(c => c.H)))}</b></span>${M1 ? '<span>M1: świece i acc Δ z eksportu DA (bez bid × ask)</span>' : `<span>Wolumen: <b>${fmt(vol)}</b></span><span>Delta: <b style="color:${tot >= 0 ? C.buy : C.sell}">${fmt(tot, 1)}</b></span>`}` +
    (last.vah != null ? `<span>VA dzienna na końcu: <b>${last.val}–${last.vah}</b>, POC <b>${last.poc}</b></span>` : '') + `<span>Stref imbalansów: <b>${nz}</b>${S.cz ? ` + z poprzednich sesji: <b>${ncz}</b>${ncz_out ? ` (i ${ncz_out} poza zakresem cen wykresu)` : ''}` : ''}</span><span>Dywergencji: <b>${ndiv}</b></span>${S.ua && !M1 ? `<span>Niedokończonych aukcji: <b>${nua}</b> (otwartych: <b>${nuaOpen}</b>)</span>` : ''}` + (() => { const st = cols.map(vixState).filter(Boolean); return st.length ? `<span>VIX: <b>${st.filter(q => q.s > 0).length}</b> ✓ / <b>${st.filter(q => q.s < 0).length}</b> ✗ z ${st.length} świec</span>` : `<span>VIX: brak danych w tym zakresie</span>`; })() + `` + (cols.some(c => c.ap) ? `<span>* zamknięcie przybliżone (flex)</span>` : '') + (S.ea && !M1 ? `<span>Wyczerpanie: <b>${nW}</b> · absorpcja: <b>${nA}</b></span>` : '') + (S.ew !== false && !M1 ? `<span>DVMZ (duży wolumen, mały zakres): <b>${nE}</b></span>` : '') + vwTxt + gapTxt + atrTxt + optTxt + (S.sel && S.sel.day === S.day ? `<span>Zaznaczenie: <b>${D.boxes[S.sel.a][0]}–${D.boxes[S.sel.b][0]}</b> <button id="selClr" style="font:inherit;font-size:12px;padding:1px 6px;border:1px solid var(--line);border-radius:4px;background:var(--panel);color:var(--ink);cursor:pointer">wyczyść (Esc)</button></span>` : '');
}
// link z Delta Navigatora: #inst=US500&day=2026-11-06&t=14:00 – instrument, dzień i odtwarzanie do tej godziny (PL)
try { const H = new URLSearchParams((location.hash || '').slice(1)); if (H.get('inst') && INSTS[H.get('inst')]) S.inst = H.get('inst'); if (/^\d{4}-\d\d-\d\d$/.test(H.get('day') || '')) S.day = H.get('day'); if (/^\d\d:\d\d$/.test(H.get('t') || '')) { S.rp = true; S.rpT = H.get('t'); } } catch (e) {}
// ===== Dziennik zdarzeń poza próbą (v1.2) =====
// Zdarzenia z zamrożonymi definicjami (jak w testach research/efektywnosc i research/wzorce_poziom_test.py), liczone na świecach 5 min każdej sesji z danych.
// Wynik: ruch od zamknięcia świecy zdarzenia po 6 i 12 świecach (30 / 60 min) w ATR M5 (średni zakres 20 poprzednich świec), w stronę oczekiwaną,
// minus średni ruch w tę stronę po wszystkich świecach tej sesji (dryf). „Poza próbą” = sesje po dacie zamrożenia definicji.
// ===== v1.9 Powrót VAH/VAL → POC i P1 (research/va_poc, reguły zamrożone 15.11.2026) =====
// Profil doby narastająco do świecy i−1 (surowe ceny flexu), VA 70%; sygnały od 25. świecy doby. W1: C[i−1] w VA, świeca i dotyka VAH (short) / VAL (long),
// wejście limit na krawędzi (otwarcie za krawędzią → po otwarciu). W2: C[i−1] poza VA, C[i] w VA → wejście na otwarciu i+1. Cel = POC z chwili sygnału,
// |POC − wejście| ≥ 0,05·A (A = mediana zakresu 5 poprzednich dób), przerwa 12 świec na typ i stronę, wyjście na POC albo koniec doby, bez stopu.
// KLATKA = w profilu ostatnich 12 świec (paczki 0,01·A, wygładzenie 3) LVN nad i pod POC (min. lokalne ≤ 35% POC, ≥ 0,05·A od POC).
// P1: zamknięcie świecy i przecina POC → wejście na otwarciu i+1 w stronę przecięcia, cel VAH / VAL z chwili sygnału; AGR = w świecy i za POC więcej
// nierównowag diagonalnych ≥ 3:1 (min. 2, natywny krok ceny) w stronę transakcji niż przeciw, lub ≥ 3 kolejne takie poziomy.
function hrCalc(D, cols) {   // v1.9 oczekiwany zakres godziny – wspólne dla podsumowania, rysunku i zakresu osi
  const hrR = (D_, upto) => { const m = {}; D_.boxes.forEach((b, i) => { if (!b || (upto != null && i > upto)) return; const h = b[0].slice(0, 2), z = m[h] || (m[h] = {H: -Infinity, L: Infinity, n: 0}); z.H = Math.max(z.H, b[2]); z.L = Math.min(z.L, b[3]); z.n++; }); return m; };
  const ds_h = Object.keys(DATA).sort(), jh = ds_h.indexOf(S.day), PR = ds_h.slice(Math.max(0, jh - 5), jh).map(k => hrR(DATA[k])), li = cols.length ? cols.at(-1).last : null;
  if (li == null || !D.boxes[li] || PR.length < 3) return null;
  const TD = hrR(D, li), h = D.boxes[li][0].slice(0, 2), hn = String((+h + 1) % 24).padStart(2, '0'), hp = String((+h + 23) % 24).padStart(2, '0');
  const f5 = hh => { const v = PR.map(m => m[hh] && m[hh].n >= 6 ? m[hh].H - m[hh].L : null).filter(x => x != null); return v.length >= 3 ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const rg = hh => TD[hh] ? TD[hh].H - TD[hh].L : null, mix = (a, b) => a != null && b != null ? (a + b) / 2 : a ?? b;
  const done = !!(TD[h] && TD[h].n >= 12), eCur = mix(f5(h), rg(hp)), eNext = mix(f5(hn), done ? rg(h) : null), now = rg(h), cl = cols.at(-1).C;
  const r = {h, hn, done, eCur, eNext, now, TDh: TD[h], cl};
  if (!done && eCur && TD[h]) { r.pmx = TD[h].L + eCur; r.pmn = TD[h].H - eCur; }
  if (eNext && Number.isFinite(cl) && (done || !eCur)) { r.nx = cl + eNext / 2; r.nn = cl - eNext / 2; }
  return r; }
function vpA(DATA_, d) { const ds = Object.keys(DATA_).sort(), j = ds.indexOf(d), r = ds.slice(Math.max(0, j - 5), j).map(k => { const bx = DATA_[k].boxes.filter(Boolean); return bx.length ? Math.max(...bx.map(b => b[2])) - Math.min(...bx.map(b => b[3])) : null; }).filter(v => v).sort((a, b) => a - b); return r.length >= 3 ? r[Math.floor(r.length / 2)] : null; }
function vpDay(D_, A) {
  const B = D_.boxes, n = B.length, out = []; if (!A || n < 40 || String(D_.src || '').startsWith('M1 (footprint szacowany')) return out;
  const O = B.map(b => b ? b[1] : NaN), H = B.map(b => b ? b[2] : NaN), L = B.map(b => b ? b[3] : NaN), C = B.map(b => b ? b[4] : NaN), lv = B.map(() => new Map());
  for (const [i, p, bd, ak] of D_.cells) { const z = lv[i].get(p) || [0, 0]; z[0] += bd; z[1] += ak; lv[i].set(p, z); }
  const ps = [...new Set(D_.cells.map(c => c[1]))].sort((a, b) => a - b), df = []; for (let k = 1; k < ps.length; k++) df.push(+(ps[k] - ps[k - 1]).toFixed(8)); df.sort((a, b) => a - b); const stp = df.length ? df[Math.floor(df.length / 2)] : 1;
  const va = m => { const ks = [...m.keys()].sort((a, b) => a - b), vs = ks.map(k => m.get(k)), tot = vs.reduce((a, b) => a + b, 0); let pi = 0; for (let k = 1; k < vs.length; k++) if (vs[k] > vs[pi]) pi = k; let a0 = pi, a1 = pi, ac = vs[pi];
    while (ac < .7 * tot && (a0 > 0 || a1 < ks.length - 1)) { const up = a1 < ks.length - 1 ? vs[a1 + 1] : -1, dn = a0 > 0 ? vs[a0 - 1] : -1; if (up >= dn) ac += vs[++a1]; else ac += vs[--a0]; } return [ks[a1], ks[pi], ks[a0]]; };
  const cage = i => { const m = new Map(); for (let q = Math.max(0, i - 11); q <= i; q++) for (const [p, [b_, a_]] of lv[q]) m.set(p, (m.get(p) || 0) + b_ + a_); if (!m.size) return false;
    const bw = .01 * A, ks = [...m.keys()], lo = Math.floor(Math.min(...ks) / bw), V = []; for (const k of ks) { const ix = Math.floor(k / bw) - lo; V[ix] = (V[ix] || 0) + m.get(k); } for (let k = 0; k < V.length; k++) V[k] = V[k] || 0;
    const S_ = V.map((_, k) => ((V[k - 1] || 0) + V[k] + (V[k + 1] || 0)) / 3); let pi = 0; for (let k = 1; k < S_.length; k++) if (S_[k] > S_[pi]) pi = k; const f = [false, false];
    for (let k = pi + 1; k < S_.length - 1; k++) if (S_[k] <= .35 * S_[pi] && S_[k] <= S_[k - 1] && S_[k] <= S_[k + 1] && (k - pi) * bw >= .05 * A) { f[0] = true; break; }
    for (let k = pi - 1; k > 0; k--) if (S_[k] <= .35 * S_[pi] && S_[k] <= S_[k - 1] && S_[k] <= S_[k + 1] && (pi - k) * bw >= .05 * A) { f[1] = true; break; } return f[0] && f[1]; };
  const agr = (i, lvl, sd) => { const q = lv[i], ks = [...q.keys()].sort((a, b) => a - b), at = k => { for (const x of ks) if (Math.abs(x - k) < stp / 2) return q.get(x); return null; };
    const im = (k, dd) => { const z = q.get(k), nb = at(k - dd * stp); return !!nb && (dd > 0 ? z[1] >= 2 && z[1] >= 3 * nb[0] : z[0] >= 2 && z[0] >= 3 * nb[1]); };
    const bey = ks.filter(k => sd > 0 ? k > lvl : k < lvl); if (bey.filter(k => im(k, sd)).length > bey.filter(k => im(k, -sd)).length) return true;
    let run = 0; for (const k of ks) { run = im(k, sd) ? run + 1 : 0; if (run >= 3) return true; } return false; };
  const prof = new Map(), last = {}, fr = B.findIndex(b => b && b[9]);
  for (let i = 0; i < n - 1; i++) {
    if (i >= 24 && prof.size && B[i] && B[i - 1]) { const [vah, poc, val] = va(prof), cand = [];
      for (const [s, edge] of [[-1, vah], [1, val]]) {
        if ((s < 0 ? H[i] >= edge : L[i] <= edge) && val <= C[i - 1] && C[i - 1] <= vah) cand.push(['W1', s, edge, i, (s < 0 ? O[i] <= edge : O[i] >= edge) ? edge : O[i], poc]);
        if ((s < 0 ? C[i - 1] > vah : C[i - 1] < val) && val <= C[i] && C[i] <= vah) cand.push(['W2', s, edge, i + 1, O[i + 1], poc]); }
      for (const s of [1, -1]) if (s > 0 ? C[i - 1] < poc && poc < C[i] : C[i - 1] > poc && poc > C[i]) cand.push(['P1', s, poc, i + 1, O[i + 1], s > 0 ? vah : val]);
      for (const [typ, s, lvl, j0, e, tg] of cand) { const key = typ + s; if ((last[key] ?? -99) > i - 12 || (tg - e) * s < .05 * A || !Number.isFinite(e)) continue; last[key] = i;
        let mae = 0, jx = null; for (let j = j0; j < n; j++) { if (!B[j]) continue; mae = Math.max(mae, (s > 0 ? e - L[j] : H[j] - e) / A); if (s > 0 ? H[j] >= tg : L[j] <= tg) { jx = j; break; } }
        const lastC = C.filter(Number.isFinite).at(-1), res = jx != null ? Math.abs(tg - e) : (lastC - e) * s;
        out.push({typ, s, i, j0, e, tg, edge: lvl, jx, res, resA: res / A, mae, kl: typ !== 'P1' ? cage(i) : null, agr: typ === 'P1' ? agr(i, lvl, s) : null, t: B[Math.min(j0, n - 1)][0], rth: !!B[Math.min(j0, n - 1)][9], o90: fr >= 0 && j0 - fr >= 0 && j0 - fr < 18, A}); } }
    if (lv[i]) for (const [p, [b_, a_]] of lv[i]) prof.set(p, (prof.get(p) || 0) + b_ + a_); }
  return out; }
const VP_FREEZE = '2026-11-15';   // filtr „bez pierwszych 90 min sesji kasowej” (o90) dodany 15.11 21:10 – ta sama data zamrożenia
function vpSpread(inst, t, rth) { return inst === 'US500' ? (t.slice(0, 2) === '23' ? .6 : rth ? .4 : .5) : null; }
const DJ_EV = {
  'Nieefektywna agresja ★★': {freeze: '2026-11-11', test: 'test 11.11 (13 rynków bez VIX, 14 sesji): +0,57 ATR w 30 min, 67% trafnych, n = 84', noVIX: true},
  'Absorpcja ★★': {freeze: '2026-11-11', test: 'test 10.11 (14 rynków, 14 sesji): +0,40 ATR w 30 min, n = 113', noVIX: false}
};
const DJ_CACHE = {};
function djVA(P, TK_) { const S_ = new Set(P.boxes.map((b, i) => b && b[9] ? i : -1).filter(i => i >= 0)), m = new Map();
  for (const [i, p, bd, ak] of P.cells) if (S_.has(i)) { const k = Q(Math.floor(p / TK_ + 1e-9) * TK_); m.set(k, (m.get(k) || 0) + bd + ak); }
  if (!m.size) return null; const ks = [...m.keys()].sort((a, b) => a - b), vs = ks.map(k => m.get(k)), tot = vs.reduce((a, b) => a + b, 0); let pi = vs.indexOf(Math.max(...vs)), a0 = pi, a1 = pi, ac = vs[pi];
  while (ac < .7 * tot && (a0 > 0 || a1 < ks.length - 1)) { const up = a1 < ks.length - 1 ? vs[a1 + 1] : -1, dn = a0 > 0 ? vs[a0 - 1] : -1; if (up >= dn) ac += vs[++a1]; else ac += vs[--a0]; }
  return [ks[a1] + TK_, ks[pi] + TK_ / 2, ks[a0]]; }
function djCompute(inst, DATA_) {
  if (DJ_CACHE[inst]) return DJ_CACHE[inst];
  const TK_ = (INSTS[inst] || [1])[0], days = Object.keys(DATA_).sort(), out = [];
  days.forEach((d, di) => { const D_ = DATA_[d], B = D_.boxes, n = B.length; if (n < 40) return;
    const H = B.map(b => b[2]), L = B.map(b => b[3]), C = B.map(b => b[4]), rg = B.map(b => b[2] - b[3]);
    const atr = B.map((_, i) => { const s = rg.slice(Math.max(0, i - 20), i); return s.length >= 6 ? s.reduce((a, x) => a + x, 0) / s.length : NaN; });
    const dl = new Float64Array(n), vo = new Float64Array(n), pv = new Float64Array(n), lv = B.map(() => new Map());
    for (const [i, p, bid, ask] of D_.cells) { dl[i] += ask - bid; vo[i] += bid + ask; pv[i] += p * (bid + ask); const k = Q(Math.floor(p / TK_ + 1e-9) * TK_), z = lv[i].get(k) || [0, 0]; z[0] += bid; z[1] += ask; lv[i].set(k, z); }
    const rth = B.map((b, i) => b[9] ? i : -1).filter(i => i >= 0), fr = rth.length ? rth[0] : null, LV = [];
    if (di > 0) { const P = DATA_[days[di - 1]], pr = P.boxes.filter(b => b[9]);
      if (pr.length) LV.push(['D-1', Math.max(...pr.map(b => b[2])), 0], ['D-1', Math.min(...pr.map(b => b[3])), 0], ['D-1', pr[pr.length - 1][4], 0]);
      const v = djVA(P, TK_); if (v) v.forEach(x => LV.push(['D-1 VA', x, 0])); }
    if (fr) LV.push(['noc', Math.max(...H.slice(0, fr)), fr], ['noc', Math.min(...L.slice(0, fr)), fr]);
    if (rth.length >= 12) { const ib = rth.slice(0, 12); LV.push(['IB', Math.max(...ib.map(i => H[i])), ib[11] + 1], ['IB', Math.min(...ib.map(i => L[i])), ib[11] + 1]); }
    const vw = new Float64Array(n).fill(NaN); if (fr != null) { let a = 0, b = 0; for (let i = fr; i < n; i++) { a += pv[i]; b += vo[i]; vw[i] = b > 0 ? a / b : NaN; } }
    const ng = (i, lo, hi) => { const tol = .25 * atr[i], g = new Set(); for (const [nm, x, st] of LV) if (i >= st && lo - tol <= x && x <= hi + tol) g.add(nm);
      for (const x of [B[i][5], B[i][6], B[i][7]]) if (x != null && lo - tol <= x && x <= hi + tol) g.add('VA dzienna');
      if (Number.isFinite(vw[i]) && lo - tol <= vw[i] && vw[i] <= hi + tol) g.add('VWAP'); return g; };
    const base = h => { let s = 0, c = 0; for (let i = 0; i + h < n; i++) if (atr[i] > 0) { s += (C[i + h] - C[i]) / atr[i]; c++; } return c ? s / c : 0; }, b6 = base(6), b12 = base(12);
    const sess = i => B[i][9] ? 'kasowa' : (Number(B[i][0].slice(0, 2)) >= 8 && (fr == null || i < fr) ? 'przed otwarciem (od 8:00)' : 'noc');
    const add = (typ, i, dir, g, txt) => { const r6 = i + 6 < n ? dir * ((C[i + 6] - C[i]) / atr[i] - b6) : null, r12 = i + 12 < n ? dir * ((C[i + 12] - C[i]) / atr[i] - b12) : null;
      out.push({inst, d, t: B[i][0], typ, dir, g: [...g].join(', '), r6, r12, s: sess(i), txt}); };
    // nieefektywna agresja (okno 30 min, delta ≥ 10% wolumenu, cena w miejscu lub przeciwnie; ★★ przy cenie zamknięcia)
    if (inst !== 'VIX') { const nxt = {k: -1, s: -1};
      for (let i = 6; i < n; i++) { if (!(atr[i] > 0)) continue; let V = 0, Dl = 0; for (let q = i - 5; q <= i; q++) { V += vo[q]; Dl += dl[q]; } if (V <= 0) continue;
        const r = Dl / V, mv = (C[i] - C[i - 6]) / atr[i], key = r >= .10 && mv <= 0 ? 'k' : r <= -.10 && mv >= 0 ? 's' : null; if (!key || i < nxt[key]) continue; nxt[key] = i + 6;
        const g = ng(i, C[i], C[i]); if (g.size >= 2) add('Nieefektywna agresja ★★', i, key === 'k' ? -1 : 1, g, `${key === 'k' ? 'kupno' : 'sprzedaż'} bez ruchu ceny, Δ ${(r * 100).toFixed(0)}% wol.`); } }
    // absorpcja (pasmo 30% przy krańcu świecy z ≥ 30% wolumenu i deltą ≥ 15% w stronę krańca, zamknięcie w przeciwnej połowie; ★★ przy strefie)
    for (let i = 0; i < n; i++) { if (!(atr[i] > 0)) continue; const Lz = lv[i], ks = [...Lz.keys()].sort((a, b) => a - b); if (ks.length < 4) continue;
      let v = 0; for (const [b_, a_] of Lz.values()) v += a_ + b_; if (!v) continue; const rng = (H[i] - L[i]) || TK_, cpos = (C[i] - L[i]) / rng;
      const band = up => { let vv = 0, dd = 0; for (const [k, [b_, a_]] of Lz) if (up ? k + TK_ / 2 >= L[i] + .7 * rng : k + TK_ / 2 <= L[i] + .3 * rng) { vv += a_ + b_; dd += a_ - b_; } return [vv, dd]; };
      const [tv, td] = band(true), [bv, bd] = band(false);
      if (tv >= .3 * v && td >= .15 * tv && cpos < .5) { const g = ng(i, L[i] + .7 * rng, H[i]); if (g.size >= 2) add('Absorpcja ★★', i, -1, g, 'kupno wchłonięte przy szczycie świecy'); }
      if (bv >= .3 * v && bd <= -.15 * bv && cpos > .5) { const g = ng(i, L[i], L[i] + .3 * rng); if (g.size >= 2) add('Absorpcja ★★', i, 1, g, 'sprzedaż wchłonięta przy dołku świecy'); } } });
  return DJ_CACHE[inst] = out; }
let DJ_BUSY = false;
async function djRender() {
  const box = $('djWinB'); if (!box) return; const ALL = S.djAll === true;
  let rows = [];
  if (ALL) { if (DJ_BUSY) return; const need = Object.keys(INSTS).filter(k => !DJ_CACHE[k]);
    if (need.length) { DJ_BUSY = true; box.innerHTML = '<p class="note">Liczę zdarzenia na 14 rynkach…</p>';
      for (const k of need) { try { if (!CACHE[k]) { const r = await fetch(`data/${k}.json`); CACHE[k] = await r.json(); } djCompute(k, CACHE[k]); } catch (e) { DJ_CACHE[k] = []; } }
      DJ_BUSY = false; }
    rows = Object.keys(INSTS).flatMap(k => DJ_CACHE[k] || []); }
  else rows = djCompute(INST, DATA);
  const pct = a => a.length ? Math.round(a.filter(x => x > 0).length / a.length * 100) + '%' : '–', avg = a => a.length ? (a.reduce((x, y) => x + y, 0) / a.length) : null;
  const f2 = v => v == null ? '–' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2).replace('.', ','), cls = v => v == null ? '' : v > 0 ? 'buy' : 'sell';
  const SES = ['noc', 'przed otwarciem (od 8:00)', 'kasowa'];
  let html = `<div class="dls"><span class="seg"><button data-dja="0" class="${ALL ? '' : 'on'}">bieżący rynek (${INST})</button><button data-dja="1" class="${ALL ? 'on' : ''}">wszystkie rynki</button></span></div>`;
  const lastDay = rows.reduce((m, r) => r.d > m ? r.d : m, '');
  for (const [typ, cfg] of Object.entries(DJ_EV)) {
    const R = rows.filter(r => r.typ === typ && r.r6 != null), ins = R.filter(r => r.d <= cfg.freeze), oos = R.filter(r => r.d > cfg.freeze);
    const line = (lab, a, extra) => { const x6 = a.map(r => r.r6), x12 = a.filter(r => r.r12 != null).map(r => r.r12), m6 = avg(x6), m12 = avg(x12);
      return `<tr${extra || ''}><td>${lab}</td><td class="n">${a.length}</td><td class="n ${cls(m6)}"><b>${f2(m6)}</b></td><td class="n">${pct(x6)}</td><td class="n ${cls(m12)}">${f2(m12)}</td>${SES.map(s => { const q = a.filter(r => r.s === s).map(r => r.r6); return `<td class="n">${q.length ? `${f2(avg(q))} <span class="mut">(${q.length})</span>` : '–'}</td>`; }).join('')}</tr>`; };
    html += `<h4 class="djh">${typ}${cfg.noVIX ? ' <span class="mut">(bez VIX)</span>' : ''}</h4><p class="note" style="margin:0 0 4px">Definicja zamrożona ${cfg.freeze.split('-').reverse().join('.')} · ${cfg.test}</p>
      <table class="djt"><thead><tr><th></th><th>n</th><th>30 min, ATR</th><th>trafne</th><th>60 min, ATR</th><th>noc</th><th>przed otwarciem</th><th>sesja kasowa</th></tr></thead><tbody>
      ${line(`w próbie (do ${cfg.freeze.slice(8)}.${cfg.freeze.slice(5, 7)})`, ins)}${line('<b>poza próbą</b> (od następnej sesji)', oos, ' class="djo"')}</tbody></table>`;
    const L_ = oos.slice().sort((a, b) => (b.d + b.t).localeCompare(a.d + a.t)).slice(0, 12);
    html += L_.length ? `<table class="djt djl"><tbody>${L_.map(r => `<tr><td>${r.d.slice(8)}.${r.d.slice(5, 7)} ${r.t}</td><td>${r.inst}</td><td class="${r.dir > 0 ? 'buy' : 'sell'}">${r.dir > 0 ? '▲ wzrost' : '▼ spadek'}</td><td>${r.txt} · ${r.g}</td><td class="n ${cls(r.r6)}"><b>${f2(r.r6)}</b></td><td class="n ${cls(r.r12)}">${f2(r.r12)}</td></tr>`).join('')}</tbody></table>`
      : `<p class="note djn">Poza próbą: jeszcze brak przypadków – dane kończą się ${lastDay ? lastDay.split('-').reverse().join('.') : '–'}, a definicja jest zamrożona od ${cfg.freeze.split('-').reverse().join('.')}. Każda nowa sesja z eksportu dopisze się tutaj automatycznie.</p>`; }
  { // v1.9 powrót VAH/VAL → POC i P1 – wynik w A (po koszcie 0,01·A) i dla US500 w pkt po spreadzie 0,4 / 0,5 / 0,6
    const insts = ALL ? Object.keys(INSTS).filter(k => k !== 'VIX' && CACHE[k]) : [INST], VR = [];
    for (const k of insts) { const DD = k === INST ? DATA : CACHE[k]; if (!DD) continue; DJ_CACHE['vp_' + k] = DJ_CACHE['vp_' + k] || Object.keys(DD).sort().flatMap(d => vpDay(DD[d], vpA(DD, d)).map(g => ({...g, inst: k, d})));
      VR.push(...DJ_CACHE['vp_' + k]); }
    const vLast = VR.reduce((m, g) => g.d > m ? g.d : m, ''), done = VR.filter(g => g.jx != null || g.d < vLast), grp = [['W1 z klatką LVN (obserwacja)', g => g.typ === 'W1' && g.kl], ['W1 z klatką, bez 90 min od otwarcia', g => g.typ === 'W1' && g.kl && !g.o90], ['W1 bez klatki (opis)', g => g.typ === 'W1' && !g.kl], ['W2 z klatką LVN', g => g.typ === 'W2' && g.kl], ['P1 z agresją (zbieranie danych)', g => g.typ === 'P1' && g.agr]];
    const pk = g => { const sp = vpSpread(g.inst, g.t, g.rth); return sp == null ? null : g.res - sp; };
    const row = (lab, a, extra) => { const w = a.filter(g => g.jx != null), nl = a.filter(g => g.jx == null), m = avg(a.map(g => g.resA - .01)), u = a.map(pk).filter(v => v != null);
      return `<tr${extra || ''}><td>${lab}</td><td class="n">${a.length}</td><td class="n">${a.length ? Math.round(w.length / a.length * 100) + '%' : '–'}</td><td class="n ${cls(m)}"><b>${f2(m)}</b></td><td class="n">${nl.length ? f2(avg(nl.map(g => g.resA))) : '–'}</td><td class="n">${a.length ? Math.round(a.filter(g => g.mae >= .5).length / a.length * 100) + '%' : '–'}</td><td class="n ${cls(avg(u))}">${u.length ? `${f2(avg(u))} <span class="mut">(${u.length})</span>` : '–'}</td><td class="n">${u.length ? (u.reduce((x, y) => x + y, 0) >= 0 ? '+' : '−') + Math.abs(u.reduce((x, y) => x + y, 0)).toFixed(0) : '–'}</td></tr>`; };
    html += `<h4 class="djh">Powrót VAH/VAL → POC i P1 od POC <span class="mut">(v1.9)</span></h4><p class="note" style="margin:0 0 4px">Definicje zamrożone 15.11.2026 (research/va_poc) · test 13 rynków, 18 dni: W1 z klatką LVN +0,052·A na transakcję, US500 +8,3 pkt (n 45), najgorsza strata −18,5 pkt; bez stopu, wyjście na celu albo koniec doby (nietrafiona = pozycja do hedgu).</p>
      <table class="djt"><thead><tr><th></th><th>n</th><th>trafne</th><th>wynik, A</th><th>śr. nietrafiona, A</th><th>MAE ≥ 0,5·A</th><th>US500 pkt / trans.</th><th>US500 suma pkt</th></tr></thead><tbody>
      ${grp.map(([lab, f]) => { const a = done.filter(f); return row(`${lab} – w próbie`, a.filter(g => g.d <= VP_FREEZE)) + row(`<b>${lab} – poza próbą</b>`, a.filter(g => g.d > VP_FREEZE), ' class="djo"'); }).join('')}</tbody></table>`;
    const L_ = done.filter(g => g.d > VP_FREEZE && (g.kl || g.agr)).sort((a, b) => (b.d + b.t).localeCompare(a.d + a.t)).slice(0, 12);
    html += L_.length ? `<table class="djt djl"><tbody>${L_.map(g => { const v = pk(g); return `<tr><td>${g.d.slice(8)}.${g.d.slice(5, 7)} ${g.t}</td><td>${g.inst}</td><td class="${g.s > 0 ? 'buy' : 'sell'}">${g.typ} ${g.s > 0 ? '▲' : '▼'}</td><td>${g.jx != null ? 'cel' : 'nietrafiony'} · MAE ${g.mae.toFixed(2).replace('.', ',')}·A</td><td class="n ${cls(g.resA)}"><b>${f2(g.resA - .01)}</b></td><td class="n ${cls(v)}">${v == null ? '' : f2(v) + ' pkt'}</td></tr>`; }).join('')}</tbody></table>`
      : `<p class="note djn">Poza próbą: jeszcze brak przypadków – definicje zamrożone 15.11.2026; każda nowa sesja z eksportu dopisze się tutaj automatycznie.</p>`; }
  html += `<p class="note">Wynik = ruch ceny od zamknięcia świecy zdarzenia po 6 (30 min) i 12 (60 min) świecach 5 min, w ATR M5 (średni zakres 20 poprzednich świec), w stronę oczekiwaną (przeciwnie do delty / od strefy absorpcji), minus średni ruch w tę stronę po wszystkich świecach tej sesji (zdejmuje dryf dnia). Bez kosztów i poślizgu, bez wyboru przypadków – liczone są wszystkie zdarzenia spełniające definicję. „W próbie” = sesje, na których definicję znaleziono i sprawdzono; tylko wiersz „poza próbą” jest uczciwą oceną. Pora: noc / przed otwarciem kasowym od 8:00 / sesja kasowa danego rynku. Opis zachowania rynku po zdarzeniach, nie rekomendacja.</p>`;
  box.innerHTML = html;
  box.querySelectorAll('[data-dja]').forEach(b => b.onclick = () => { S.djAll = b.dataset.dja === '1'; save(); djRender(); });
}
if (!S.inst || !INSTS[S.inst]) S.inst = 'US500';   // domyślny rynek – bez tego okna z warunkiem „tylko US500” traktowały świeżą stronę jak inny rynek
if (S.inst && S.inst !== 'US500' && INSTS[S.inst]) setInst(S.inst); else { binLabels(); render(); }
// US500: dociągnij nowsze sesje z data/US500.json i dzień w toku z live/US500_day.json
function mergeUS500Days(j) {
  if (!j || typeof j !== 'object') return;
  const B = CACHE.US500, wasLast = Object.keys(B).sort().pop();
  let changed = false;
  for (const k of Object.keys(j)) {
    const inc = j[k];
    if (!inc || !Array.isArray(inc.boxes) || !inc.boxes.length) continue;
    const cur = B[k], cN = cur && cur.boxes ? cur.boxes.length : 0, nN = inc.boxes.length;
    const cLast = cN ? String(cur.boxes[cN - 1][0]) : '', nLast = String(inc.boxes[nN - 1][0]);
    if (cur && !cur.niepelna && inc.niepelna) continue;   // sfinalizowany dzień z paczki nie jest nadpisywany sesją w toku
    const newer = !cur || nN > cN || (nN === cN && nLast !== cLast) || (!!cur.niepelna && !inc.niepelna);
    if (!newer) continue;
    B[k] = inc; changed = true;
  }
  if (!changed || INST !== 'US500') return;
  const ds = Object.keys(B).sort();
  if (!S.day || S.day === wasLast) S.day = ds[ds.length - 1];
  DATA = B; fillDays(); save(); render(true);
}
function loadUS500Updates() {
  const t = Date.now();
  const main = fetch('data/US500.json?t=' + t, {cache: 'no-store'}).then(r => r.ok ? r.json() : null).catch(() => null);
  const live = fetch('live/US500_day.json?t=' + t, {cache: 'no-store'}).then(r => r.ok ? r.json() : null).catch(() => null);
  Promise.all([main, live]).then(([j, d]) => {
    if (j) mergeUS500Days(j);
    if (d && d.session && Array.isArray(d.boxes) && d.boxes.length) mergeUS500Days({[d.session]: d});
  });
}
loadUS500Updates();
if (!window._dafTodayPoll) window._dafTodayPoll = setInterval(loadUS500Updates, 60000);
function tick() { const e = document.getElementById('clk'); if (e) e.textContent = new Date().toLocaleTimeString('pl-PL', {hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw'}); }
tick(); setInterval(tick, 15000); addEventListener('online', () => render(true)); addEventListener('offline', () => render(true));
$('wrap').addEventListener('scroll', () => { const g = document.getElementById('lvlab'); if (g) g.setAttribute('transform', `translate(${$('wrap').scrollLeft},0)`); }, {passive: true});
let _rt; addEventListener('resize', () => { if (S.bin !== 'auto') return; clearTimeout(_rt); _rt = setTimeout(() => render(), 200); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => render(true));
new MutationObserver(() => render(true)).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});

/* US500 HVN/LVN H1 – okno niezmitygowanego wolumenu (ostatnie 3 tygodnie) */
const HVN_CMAP = [[0,"#0B0E14"],[0.04,"#15202B"],[0.12,"#1A3A4A"],[0.28,"#156B73"],[0.45,"#1B9A5C"],[0.62,"#C6C22A"],[0.78,"#F0A202"],[0.90,"#F2580A"],[1,"#FFE9B0"]];
function hvnHex(h){ return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]; }
function hvnLerpC(t){
  const s = HVN_CMAP; t = Math.max(0, Math.min(1, t));
  let i = 0; while (i < s.length - 2 && t > s[i+1][0]) i++;
  const a = s[i], b = s[i+1], u = (t - a[0]) / Math.max(1e-9, b[0] - a[0]);
  const A = hvnHex(a[1]), B = hvnHex(b[1]);
  return `rgb(${A[0]+(B[0]-A[0])*u|0},${A[1]+(B[1]-A[1])*u|0},${A[2]+(B[2]-A[2])*u|0})`;
}
function hvnLoad(){
  if (HVN_ST) return;
  HVN_ST = 1;
  fetch('data/US500_hvn_lvn.json?t=' + Date.now(), {cache: 'no-store'})
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(j => { HVN = j; if (S.hvw) drawHvnWin(); })
    .catch(() => { HVN = {err: 1}; if (S.hvw) drawHvnWin(); });
}
function drawHvnWin(){
  const box = $('hvWin'); if (!box) return;
  box.hidden = !S.hvw;
  if (!S.hvw) return;
  if (!HVN) { hvnLoad(); $('hvWinPx').textContent = 'wczytywanie…'; $('hvWinB').innerHTML = '<p class="hvnote">Wczytywanie data/US500_hvn_lvn.json…</p>'; return; }
  if (HVN.err) { $('hvWinPx').textContent = 'brak danych'; $('hvWinB').innerHTML = '<p class="hvnote">Nie udało się wczytać data/US500_hvn_lvn.json.</p>'; return; }
  const D = HVN, C = D.counts || {}, open = D.open || [], last = D.last_price;
  const fd = (d) => d ? `${String(d).slice(8,10)}.${String(d).slice(5,7)}.${String(d).slice(0,4)}` : '';
  const asof = D.asof ? D.asof.slice(0,16).replace('T',' ') : '';
  const lastTs = D.last_ts ? D.last_ts.slice(8,16).replace('T',' ') : '';
  $('hvWinPx').innerHTML = `${fd(D.from)}–${fd(D.to)} · cena ${last != null ? last.toLocaleString('pl-PL', {minimumFractionDigits:1, maximumFractionDigits:1}) : '–'} · ${lastTs} PL · niezmitygowane ${C.niezmitygowane_hvn || 0} HVN / ${C.niezmitygowane_lvn || 0} LVN`;
  const rows = open.slice().sort((a,b) => a.cena - b.cena).reverse().map(lv => {
    const dist = lv.dist, sign = dist > 0 ? '+' : (dist < 0 ? '−' : '');
    const sta = lv.status === 'w_grze' ? 'w grze' : 'otwarte';
    const poc = lv.poc ? ' <span class="hvnote" style="padding:0">POC</span>' : '';
    return `<tr><td class="${lv.typ==='HVN'?'hv-hvn':'hv-lvn'}">${lv.typ}${poc}</td><td>${lv.cena}</td><td>${lv.form_pl || lv.sesja || ''}</td><td>${sign}${Math.abs(dist).toFixed(1)}</td><td class="${lv.status==='w_grze'?'hv-play':'hv-open'}">${sta}</td><td>${lv.vol != null ? lv.vol.toLocaleString('pl-PL', {maximumFractionDigits:1}) : ''}</td></tr>`;
  }).join('');
  $('hvWinB').innerHTML = `<div class="hvwrap">
    <div class="hvheat" id="hvHeat"><canvas id="hvHeatC"></canvas><div class="hvtip" id="hvTip"></div></div>
    <div class="hvprof" id="hvProf"><canvas id="hvProfC"></canvas></div>
    <div class="hvlist"><table><thead><tr><th>typ</th><th>cena</th><th>powstanie</th><th>od ceny</th><th>status</th><th>wolumen</th></tr></thead><tbody>${rows || '<tr><td colspan="6">Brak niezmitygowanych poziomów w oknie.</td></tr>'}</tbody></table></div>
  </div>
  <div class="hvleg">
    <span><i style="background:#FFC14A"></i>HVN niezmitygowany</span>
    <span><i style="background:#7EC8F8"></i>LVN niezmitygowany</span>
    <span><i style="background:#FF9F43;opacity:.7"></i>HVN zmitygowany</span>
    <span><i style="background:#5DA9E9;opacity:.7"></i>LVN zmitygowany</span>
    <span><i style="background:#F4F1DE;height:0;border-top:1.5px dotted #F4F1DE;width:14px"></i>cena bieżąca</span>
    <span><i style="background:#3DDC97"></i>H1 wzrost / <i style="background:#F07178"></i>spadek</span>
  </div>
  <div class="hvnote">Profil dzienny wygładzony Gaussem (σ=2 pkt). Mitygacja = pierwszy powrót po oddaleniu ≥15 pkt (±1,5 pkt). „W grze” = od powstania cena jeszcze nie odeszła o 15 pkt. Prawy profil: wolumen 3 tyg. na cenach jeszcze niezmitygowanych (jasne słupki; w tle cały profil). Czasy: Europe/Warsaw. Dane do sesji ${fd(D.to)} włącznie${asof ? ' (stan '+asof+' PL)' : ''}.</div>`;
  requestAnimationFrame(paintHvnWin);
}
function paintHvnWin(){
  const D = HVN; if (!D || D.err) return;
  const heatBox = $('hvHeat'), profBox = $('hvProf'), cH = $('hvHeatC'), cP = $('hvProfC');
  if (!heatBox || !cH || !cP) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const hours = D.hours || [], cols = D.cols || [], h1 = D.h1 || [], levels = D.levels || [];
  const n = hours.length; if (!n) return;
  const pmin = (D.pmin || 0) - 8, pmax = (D.pmax || 0) + 8, pr = Math.max(1, pmax - pmin);
  const last = D.last_price, vmax = Math.max(1e-6, D.vmax || 1);
  const layout = (canvas, box, minH) => {
    const w = Math.max(120, box.clientWidth || box.getBoundingClientRect().width || 200);
    const h = Math.max(minH, box.clientHeight || 420);
    box.style.height = h + 'px';
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return {ctx, w, h};
  };
  const heatH = Math.max(440, Math.min(620, Math.floor((window.innerHeight || 800) * 0.62)));
  const Hm = layout(cH, heatBox, heatH), Pm = layout(cP, profBox, heatH);
  const L = 44, R = 8, T = 10, B = 28;
  const x0 = L, x1 = Hm.w - R, y0 = T, y1 = Hm.h - B;
  const xOf = (j) => x0 + (j + 0.5) * (x1 - x0) / n;
  const xCol = (j) => x0 + j * (x1 - x0) / n;
  const yOf = (p) => y1 - (p - pmin) * (y1 - y0) / pr;
  const ctx = Hm.ctx;
  ctx.fillStyle = '#0B0E14'; ctx.fillRect(0, 0, Hm.w, Hm.h);
  const cw = Math.max(1, (x1 - x0) / n), ch = Math.max(0.6, (y1 - y0) / pr);
  const gamma = 0.55;
  for (let j = 0; j < n; j++) {
    const pairs = cols[j] || [];
    const x = xCol(j);
    for (let k = 0; k < pairs.length; k++) {
      const p = pairs[k][0], v = pairs[k][1];
      const t = Math.pow(Math.min(1, v / vmax), gamma);
      ctx.fillStyle = hvnLerpC(t);
      const y = yOf(p + 0.5);
      ctx.fillRect(x, y, cw + 0.3, ch + 0.3);
    }
  }
  // separatory sesji + 15:00 PL
  ctx.lineWidth = 1;
  for (let j = 1; j < n; j++) {
    if (hours[j].s !== hours[j-1].s) {
      ctx.strokeStyle = 'rgba(58,69,88,0.9)';
      ctx.beginPath(); ctx.moveTo(xCol(j), y0); ctx.lineTo(xCol(j), y1); ctx.stroke();
    }
    if (hours[j].hh === 15) {
      ctx.strokeStyle = 'rgba(42,51,68,0.7)'; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(xOf(j), y0); ctx.lineTo(xOf(j), y1); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  // świece H1
  for (let j = 0; j < n; j++) {
    const bar = h1[j]; if (!bar) continue;
    const [O,H,L,C] = bar, up = C >= O, col = up ? '#3DDC97' : '#F07178';
    const x = xOf(j);
    ctx.strokeStyle = col; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(x, yOf(H)); ctx.lineTo(x, yOf(L)); ctx.stroke();
    const yb = yOf(Math.max(O, C)), yt = yOf(Math.min(O, C));
    ctx.fillStyle = col; ctx.globalAlpha = 0.85;
    ctx.fillRect(x - Math.max(0.6, cw * 0.28), yt, Math.max(1.2, cw * 0.56), Math.max(1, yb - yt));
    ctx.globalAlpha = 1;
  }
  // poziomy HVN/LVN
  const formIdx = (iso) => {
    if (!iso) return 0;
    let best = 0;
    for (let j = 0; j < n; j++) { if (hours[j].t && hours[j].t >= iso) return j; best = j; }
    return best;
  };
  const mitIdx = (iso) => {
    if (!iso) return n - 1;
    for (let j = 0; j < n; j++) if (hours[j].t && hours[j].t >= iso) return j;
    return n - 1;
  };
  for (const lv of levels) {
    const open = lv.status === 'otwarte' || lv.status === 'w_grze';
    const col = lv.typ === 'HVN' ? (open ? '#FFC14A' : '#FF9F43') : (open ? '#7EC8F8' : '#5DA9E9');
    const j0 = formIdx(lv.form_ts), j1 = open ? n - 1 : mitIdx(lv.mit_ts);
    const y = yOf(lv.cena);
    ctx.strokeStyle = col; ctx.lineWidth = open ? 1.4 : 1.1; ctx.globalAlpha = open ? 0.95 : 0.55;
    if (open) ctx.setLineDash([5, 3]); else ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(xOf(j0), y); ctx.lineTo(xOf(j1), y); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    if (!open) {
      ctx.strokeStyle = '#F4F1DE'; ctx.lineWidth = 1.2;
      const xm = xOf(j1), ym = y;
      if (lv.reakcja === 'odbicie') {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(xm, ym - 3.5); ctx.lineTo(xm + 3.5, ym); ctx.lineTo(xm, ym + 3.5); ctx.lineTo(xm - 3.5, ym);
        ctx.closePath(); ctx.fill();
      } else {
        ctx.beginPath(); ctx.moveTo(xm - 3, ym - 3); ctx.lineTo(xm + 3, ym + 3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(xm + 3, ym - 3); ctx.lineTo(xm - 3, ym + 3); ctx.stroke();
      }
    }
  }
  if (last != null) {
    ctx.strokeStyle = '#F4F1DE'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(x0, yOf(last)); ctx.lineTo(x1, yOf(last)); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    ctx.fillStyle = '#F4F1DE'; ctx.font = '10px ui-monospace,monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText(String(last), x0 + 2, yOf(last) - 2);
  }
  // osie
  ctx.fillStyle = '#9AA3B2'; ctx.font = '10px ui-monospace,monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  const step = pr > 400 ? 100 : (pr > 200 ? 50 : 25);
  const p0 = Math.ceil(pmin / step) * step;
  for (let p = p0; p <= pmax; p += step) {
    const y = yOf(p);
    ctx.fillText(String(p), L - 4, y);
    ctx.strokeStyle = 'rgba(35,40,51,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  let lastLabX = -999;
  for (let j = 0; j < n; j++) {
    const sessStart = j === 0 || hours[j].s !== hours[j-1].s;
    if (!sessStart) continue;
    const x = xCol(j) + 2;
    if (x - lastLabX < 42) continue;
    lastLabX = x;
    const s = hours[j].s || '';
    const lab = s.length >= 10 ? s.slice(8, 10) + '.' + s.slice(5, 7) : (hours[j].lab || '').slice(0, 5);
    ctx.fillStyle = '#9AA3B2';
    ctx.fillText(lab, Math.min(x + 16, x1 - 10), y1 + 4);
  }
  ctx.textAlign = 'left'; ctx.fillText('H1', x0, y1 + 4);

  // prawy profil: cały 3 tyg. w tle + niezmitygowane wyróżnione
  const pctx = Pm.ctx, pw = Pm.w, ph = Pm.h;
  pctx.fillStyle = '#10141C'; pctx.fillRect(0, 0, pw, ph);
  const pL = 4, pR = 8, pT = T, pB = B;
  const px0 = pL, px1 = pw - pR, py0 = pT, py1 = ph - pB;
  const pyOf = (p) => py1 - (p - pmin) * (py1 - py0) / pr;
  const prof = D.profile || [], popen = D.profile_open || [];
  let pmaxV = 1;
  for (const q of prof) if (q[1] > pmaxV) pmaxV = q[1];
  const barMax = (px1 - px0) * 0.92;
  pctx.fillStyle = '#2B3544';
  for (const q of prof) {
    const w = (q[1] / pmaxV) * barMax;
    pctx.fillRect(px0, pyOf(q[0] + 0.5), w, Math.max(0.7, (py1 - py0) / pr));
  }
  pctx.fillStyle = '#FFC14A';
  const openSet = new Set((D.open || []).filter(x => x.typ === 'HVN').map(x => x.cena));
  const lvnSet = new Set((D.open || []).filter(x => x.typ === 'LVN').map(x => x.cena));
  for (const q of popen) {
    pctx.fillStyle = lvnSet.has(q[0]) && !openSet.has(q[0]) ? '#7EC8F8' : '#FFC14A';
    const w = (q[1] / pmaxV) * barMax;
    pctx.fillRect(px0, pyOf(q[0] + 0.5), w, Math.max(1.1, (py1 - py0) / pr));
  }
  for (const lv of (D.open || [])) {
    pctx.strokeStyle = lv.typ === 'HVN' ? '#FFC14A' : '#7EC8F8';
    pctx.lineWidth = 1; pctx.globalAlpha = 0.7;
    pctx.beginPath(); pctx.moveTo(px0, pyOf(lv.cena)); pctx.lineTo(px1, pyOf(lv.cena)); pctx.stroke();
    pctx.globalAlpha = 1;
  }
  if (last != null) {
    pctx.strokeStyle = '#F4F1DE'; pctx.lineWidth = 1; pctx.setLineDash([2, 3]);
    pctx.beginPath(); pctx.moveTo(px0, pyOf(last)); pctx.lineTo(px1, pyOf(last)); pctx.stroke();
    pctx.setLineDash([]);
  }
  pctx.fillStyle = '#9AA3B2'; pctx.font = '9px "IBM Plex Sans Condensed",sans-serif';
  pctx.textAlign = 'center'; pctx.textBaseline = 'top';
  pctx.fillText('niezmitygowane', pw / 2, py1 + 4);

  // tooltip
  const tip = $('hvTip');
  cH.onmousemove = ev => {
    const r = cH.getBoundingClientRect();
    const x = ev.clientX - r.left, y = ev.clientY - r.top;
    if (x < x0 || x > x1 || y < y0 || y > y1) { tip.style.display = 'none'; return; }
    const j = Math.max(0, Math.min(n - 1, Math.floor((x - x0) / (x1 - x0) * n)));
    const price = Math.round(pmin + (y1 - y) / (y1 - y0) * pr);
    const pairs = cols[j] || [];
    let vol = 0; for (const q of pairs) if (q[0] === price) vol = q[1];
    const near = (D.open || []).filter(lv => Math.abs(lv.cena - price) <= 1).map(lv => `${lv.typ} ${lv.cena}`).join(', ');
    tip.style.display = 'block';
    tip.style.left = Math.min(x + 12, r.width - 160) + 'px';
    tip.style.top = Math.max(0, y - 28) + 'px';
    tip.textContent = `${hours[j].lab || ''}  ·  ${price}  ·  vol ${vol}${near ? '  ·  ' + near : ''}`;
  };
  cH.onmouseleave = () => { tip.style.display = 'none'; };
}
addEventListener('resize', () => { if (S.hvw && HVN && !HVN.err) paintHvnWin(); });
