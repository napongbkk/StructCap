// StructCap bridge barrier (Thai DOH practice, AASHTO LRFD Section 13 yield-line method).
// Checked against the "Barrier" sheet of the AS5100 road bridge calculation workbook (same inputs, φ = 0.8, 6 bars per metre).
// Run: node tests/barrier.test.js
const path = require('path');
globalThis.window = globalThis;
['engine.js', 'barrier.js'].forEach(f => require(path.join(__dirname, '..', f)));
const B = globalThis.BARRIER;
let bad = 0;
const P = (lbl, got, exp, tol = 0.005) => { const ok = Math.abs(got - exp) <= tol * Math.max(1, Math.abs(exp)); if (!ok) bad++; console.log(ok ? 'OK ' : 'BAD', lbl.padEnd(52), (+got).toFixed(4), 'expected', (+exp).toFixed(4)); };
const T = (lbl, ok) => { if (!ok) bad++; console.log(ok ? 'OK ' : 'BAD', lbl); };
const base = () => ({ geo: { tl: 'custom', H: 1000, tt: 250, tb: 450, cover: 40, shape: 'tapered' }, load: { Ft: 300, Fl: 100, Fv: 80, Lt: 1200, He: 810, Hmin: 810, Lv: 5500 }, mat: { fc: 40, fy: 500 },
  bars: { vD: 16, vS: 1000 / 6, v2D: 12, v2S: 300, hD: 12, hS: 150 }, deck: { ts: 250, dTop: 20, sTop: 100, cTop: 40, cBot: 40, iface: 'rough', check: 'yes' }, coef: { phi: 0.8, Mb: 0, theta: 45, gc: 24, ends: 'yes' } });

// 1. the calculation sheet (Barrier tab)
{
  const r = B.design(base(), 'en');
  P('M_w (kNm)', r.Mw, 81.134, 0.003); P('M_c (kNm/m)', r.Mc, 141.364, 0.003);
  P('L_c interior (m)', r.LcI, 2.8252, 0.002); P('R_w interior (kN)', r.RwI, 798.76, 0.003);
  P('L_c end (m)', r.LcE, 1.5664, 0.002); P('R_w end (kN)', r.RwE, 442.87, 0.003);
  P('Base check: L = L_t + H tan45 (m)', r.Ls, 2.2, 1e-6); P('Base check: M* (kNm/m)', r.Mstar, 136.364, 1e-4);
  P('Deck slab design moment 1.1 M* (kNm/m)', r.dM, 150.0, 1e-4); P('Deck slab design tension (kN/m)', r.dT, 150.0, 1e-4);
  const end = r.checks.find(c => /end segment/.test(c.name)); P('UR end segment = F_t / R_w', end.ur, 0.6774, 0.003);
}
// 2. AASHTO test levels and behaviour
{
  T('six test levels with Table A13.2-1 forces', Object.keys(B.TL).length === 6 && B.TL['TL-4'].Ft === 240 && B.TL['TL-5'].Ft === 550 && B.TL['TL-5'].Lt === 2440);
  const x = base(); x.geo.tl = 'TL-5'; x.coef.phi = 1; const r5 = B.design(x, 'en'), x4 = base(); x4.geo.tl = 'TL-4'; x4.coef.phi = 1; const r4 = B.design(x4, 'en');
  T('TL-5 governs over TL-4 (higher interior UR)', r5.checks[2].ur > r4.checks[2].ur);
  T('1.0 m wall fails the TL-5 height (1.07 m)', r5.checks[0].ur > 1);
  const x2 = base(); x2.bars.vS = 100; const r2 = B.design(x2, 'en'), r1 = B.design(base(), 'en'); T('more vertical steel → higher R_w', r2.RwI > r1.RwI && r2.McBase > r1.McBase);
  const xv = base(); xv.geo.shape = 'vertical'; xv.geo.tb = 250; const rv = B.design(xv, 'en'); T('vertical wall: M_c(base) = M_c average', Math.abs(rv.McBase - rv.Mc) < 1e-6);
  T('every check has a finite UR', r1.checks.every(c => isFinite(c.ur) && c.ur >= 0));
  T('report has 8 sections', r1.rep.secs.length === 8);
}
console.log(bad ? `\n${bad} check(s) FAILED` : '\nall barrier checks passed');
process.exit(bad ? 1 : 0);
