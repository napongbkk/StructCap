// StructCap steel post-and-rail barrier — Austroads AP-G108-25 Appendix A.2 (Design example 2).
// Run: node tests/sbarrier.test.js
const path = require('path');
globalThis.window = globalThis;
['engine.js', 'sbarrier.js'].forEach(f => require(path.join(__dirname, '..', f)));
const SB = globalThis.SBARRIER;
let bad = 0;
const P = (lbl, got, exp, tol = 0.006) => { const ok = Math.abs(got - exp) <= tol * Math.max(1, Math.abs(exp)); if (!ok) bad++; console.log(ok ? 'OK ' : 'BAD', lbl.padEnd(46), (+got).toFixed(3), 'expected', (+exp).toFixed(3)); };
const T = (lbl, ok) => { if (!ok) bad++; console.log(ok ? 'OK ' : 'BAD', lbl); };
const ex = (t, tp) => ({ code: 'AS', geo: { level: 'AS-regular', L: 3000, setback: 200, kerb: 0,
  rails: [{ y: 1050, shape: 'RHS', d: 150, b: 100, t, S: 0, fy: 350, use: true }, { y: 750, shape: 'RHS', d: 150, b: 100, t, S: 0, fy: 350, use: true }, { y: 300, shape: 'RHS', d: 150, b: 100, t, S: 0, fy: 350, use: false }],
  post: { shape: 'SHS', d: 200, b: 200, t: tp, S: 0, fy: 350 } }, load: {}, coef: { phi: 0.9, Nmax: 6, ends: 'yes' },
  base: { nt: 2, n: 4, db: 24, grade: '8.8', z: 320, e: 60, bp: 400, Wb: 400, tp: 40, fyp: 250, D: 340, X: 300 } });

// section tables (plastic modulus) reproduced from the dimensions
P('S 150×100×6 RHS (×10³ mm³)', SB.hollow('RHS', 150, 100, 6).S / 1e3, 134, 0.01);
P('S 200×200×6 SHS (×10³ mm³)', SB.hollow('SHS', 200, 200, 6).S / 1e3, 327, 0.01);
P('S 150×100×8 RHS (×10³ mm³)', SB.hollow('RHS', 150, 100, 8).S / 1e3, 169, 0.01);
P('S 200×200×8 SHS (×10³ mm³)', SB.hollow('SHS', 200, 200, 8).S / 1e3, 421, 0.01);

// Design example 2, first trial (6 mm sections)
const r = SB.design(ex(6, 6), 'en');
P('M_p top rail (kNm)', r.rails[0].Mp0 / 1e6, 42.2, 0.01); P('M_p middle rail (kNm)', r.rails[1].Mp / 1e6, 30.2, 0.01);
P('M_p,post (kNm)', r.MpPost / 1e6, 103, 0.01); P('Y* (mm)', r.Ystar, 925, 0.002); P('P_p (kN)', r.Pp / 1e3, 111, 0.006);
[[1, 241], [2, 231], [3, 228], [4, 285], [5, 319], [6, 378]].forEach(([N, R]) => P('R* for N = ' + N + ' (kN)', r.inter[N - 1].R, R, 0.006));
T('governing mode N = 3, R* < F_t = 300 kN (example: not adequate)', r.crit.N === 3 && r.checks[0].ur > 1);
P('R_i top rail share at R* = 306 (kN)', 306 * r.rails[0].Mp / r.Mp, 179, 0.006); P('R_i middle rail share (kN)', 306 * r.rails[1].Mp / r.Mp, 127, 0.006);
// second trial (8 mm sections): capacities as printed; R*(N = 3) recomputed
const r8 = SB.design(ex(8, 8), 'en');
P('8 mm: M_p top rail (kNm)', r8.rails[0].Mp0 / 1e6, 53.2, 0.01); P('8 mm: M_p middle rail (kNm)', r8.rails[1].Mp / 1e6, 38.0, 0.01);
P('8 mm: M_p,post (kNm)', r8.MpPost / 1e6, 133, 0.01); P('8 mm: P_p (kN)', r8.Pp / 1e3, 143, 0.006);
P('8 mm: R*(N = 3) from Eq. 9 (kN)', r8.inter[2].R, 291.8, 0.003);
T('report has 7 sections and all URs are finite', r.rep.secs.length === 7 && r.checks.every(c => isFinite(c.ur)));
T('AASHTO TL-4 level available', SB.LEVELS['TL-4'].Ft === 240 && SB.LEVELS['TL-4'].Lt === 1070);
console.log(bad ? `\n${bad} check(s) FAILED` : '\nall steel barrier checks passed');
process.exit(bad ? 1 : 0);
