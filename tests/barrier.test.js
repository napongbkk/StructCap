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
  T('six test levels with Table A13.2-1 forces', ['TL-1','TL-2','TL-3','TL-4','TL-5','TL-6'].every(k => B.TL[k]) && B.TL['TL-4'].Ft === 240 && B.TL['TL-5'].Ft === 550 && B.TL['TL-5'].Lt === 2440);
  const x = base(); x.geo.tl = 'TL-5'; x.coef.phi = 1; const r5 = B.design(x, 'en'), x4 = base(); x4.geo.tl = 'TL-4'; x4.coef.phi = 1; const r4 = B.design(x4, 'en');
  T('TL-5 governs over TL-4 (higher interior UR)', r5.checks[2].ur > r4.checks[2].ur);
  T('1.0 m wall fails the TL-5 height (1.07 m)', r5.checks[0].ur > 1);
  const x2 = base(); x2.bars.vS = 100; const r2 = B.design(x2, 'en'), r1 = B.design(base(), 'en'); T('more vertical steel → higher R_w', r2.RwI > r1.RwI && r2.McBase > r1.McBase);
  const xv = base(); xv.geo.shape = 'vertical'; xv.geo.tb = 250; const rv = B.design(xv, 'en'); T('vertical wall: M_c(base) = M_c average', Math.abs(rv.McBase - rv.Mc) < 1e-6);
  T('every check has a finite UR', r1.checks.every(c => isFinite(c.ur) && c.ur >= 0));
  T('report has 8 sections', r1.rep.secs.length === 8);
}
// 3. AS: Austroads AP-G108-25 Design Example 1 (A.1), medium performance level, φ = 0.6, f'c 32, f_sy 400
{
  const asx = (Asc) => ({ code: 'AS', mode: 'direct', geo: { tl: 'AS-medium', H: 1200, tt: 250, tb: 400, cover: 50, shape: 'tapered' }, mat: { fc: 32, fy: 400 },
    direct: { Asb: 400, bb: 180, db: 300, Asw: 550, bw: 1020, dw: 250, Asc, dc: 350 },
    bars: { vD: 20, vS: 200, v2D: 12, v2S: 300, hD: 12, hS: 200 }, deck: { ts: 250, dTop: 20, sTop: 150, cTop: 50, cBot: 40, iface: 'rough', check: 'yes' }, coef: { phi: 0.6, ends: 'yes', gc: 24 } });
  T('AS medium level: F_t 600, L_t 2400, H_e 1200', B.TL['AS-medium'].Ft === 600 && B.TL['AS-medium'].Lt === 2400 && B.TL['AS-medium'].He === 1200);
  const r = B.design(asx(1570), 'en');
  P('AS M_b (kNm)', r.Mb, 27.3, 0.01); P('AS M_w (kNm)', r.Mw, 32.5, 0.01); P('AS M_c (kNm/m)', r.Mc, 128, 0.01);
  P('AS L_c interior (m)', r.LcI, 3.635, 0.01); P('AS R_w interior (kN)', r.RwI, 775, 0.01);
  P('AS L_c end (m)', r.LcE, 2.615, 0.01); P('AS R_w end (kN)', r.RwE, 557, 0.01);
  T('AS end segment fails as in the example (557 < 600)', r.checks.find(c => /end segment/.test(c.name)).ur > 1);
  const r2 = B.design(asx(2200), 'en');
  P('AS revised M_c (kNm/m)', r2.Mc, 177, 0.01); P('AS revised R_w end (kN)', r2.RwE, 754, 0.01);
  T('AS revised end segment passes', r2.checks.find(c => /end segment/.test(c.name)).ur < 1);
  T('AS deck designed for 1.1 M_c and 1.1 T', Math.abs(r2.deck.Ms - 1.1 * r2.McBase) < 1e-9);
  T('AS has no simplified sheet check', r.Mstar === null && r.rep.secs.length === 7);
}
console.log(bad ? `\n${bad} check(s) FAILED` : '\nall barrier checks passed');
process.exit(bad ? 1 : 0);
