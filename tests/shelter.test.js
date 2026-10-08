// Bus shelter footing (shelter.js): wind, statics, footing, bolts — node tests/shelter.test.js
const path = require('path');
global.window = globalThis;
['engine.js', 'gantry.js', 'shelter.js'].forEach(f => require(path.join(__dirname, '..', f)));
const SH = globalThis.SHELTER;
let bad = 0;
const T = (lbl, ok) => { if (!ok) bad++; console.log(ok ? 'OK ' : 'BAD', lbl); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const base = { L: 8000, Dp: 1800, hF: 2512, hR: 2400, ofF: 150, ofR: 300, ep: 365, nR: 5, nF: 2, dcov: 310, Df: 400, rtype: 'strip', Lsr: 7900, Br: 900, Lpr: 1200, Bpr: 1200, ftype: 'strip', Lsf: 7900, Bf: 600, Lp: 800, Bp: 800,
  Lw: 7300, hw: 1952, zwb: 250, bs: 1600, nsw: 2, groof: 0.25, gwall: 0.20, wseat: 0.25, Lseat: 3820, qroof: 0.25, post: '100x100x6', pgrade: 'C350L0',
  region: 'A', Ru: 500, Rs: 25, VRu: 45, VRs: 37, Md: 1, tc: 2, Ms: 1, Mt: 1, cpw: 1.3, cps: 1.3, Kp: 1, r1w: -1.3, r1l: -0.8, r2w: -0.8, r2l: -0.5, r3: -0.6, rd: 0.5,
  gc: 24, gs: 18, soil: 'yes', mu: 0.4, qult: 150, qa: 100, fc: 25, cover: 50, db: 16, dl: 10, nt: 4, nb: 4, path: 'cant', dlim: 100,
  nbolt: 4, bolt: 'M16', bgrade: '4.6', sbolt: 170, Bpl: 250, tpl: 16, fyp: 250, hef: 250, sw: 6 };
const run = o => SH.design(Object.assign({}, base, o || {}), 'en');
const ck = (r, id) => r.checks.find(c => c.id === id);

// 1. wind (AS/NZS 1170.2:2021 Table 3.1(A))
T('V_R region A, R = 500 is 45 m/s', near(SH.REGIONS.A.VR(500), 45, 0.1));
T('V_R region W, R = 500 is 51 m/s', near(SH.REGIONS.W.VR(500), 51, 0.2));
T('V_R region C, R = 500 is 69 m/s', near(SH.REGIONS.C.VR(500), 69, 0.5));
T('V_R region D, R = 500 is 88 m/s', near(SH.REGIONS.D.VR(500), 88, 0.5));
const r = run();
T('V_des = 45 × 0.91 = 40.9 m/s, q_u = 0.6V² = 1.005 kPa', near(r.wind.Vu, 40.92, 0.05) && near(r.wind.qu, 1.005, 0.002));
T('V_des is never below 30 m/s at ULS', run({ tc: 4, Ms: 0.7 }).wind.Vu === 30);

// 2. statics: hand check of overturning for wind into the open front
{
  const q = r.wind.qu, wall = q * 1.3 * 7.3 * 1.952, post = 2 * q * 2.0 * 0.1 * 2.512, zb = -0.71, piv = 1.8 + 0.45;
  const U1 = q * 1.3 * 9, U2 = q * 0.8 * 9, y1 = -0.15 + 2.25 / 4, y2 = -0.15 + 2.25 * 3 / 4;
  const Md = wall * (0.25 + 1.952 / 2 - zb) + post * (2.512 / 2 - zb) + U1 * (piv - y1) + U2 * (piv - y2);
  T('W1 overturning moment matches a hand calculation (' + Md.toFixed(2) + ' kNm)', near(r.stab.W1.Md, Md, 0.05));
  T('Sliding force W1 = wall + post drag', near(ck(r, 'slW1').Ed, wall + post, 0.01));
}
T('default design passes every check', r.checks.every(c => c.ur <= 1.0001));
T('a narrow rear strip (600) fails footing rotation with cantilever posts', ck(run({ Br: 600 }), 'frrot').ur > 1);
T('portal action reduces the footing rotation', ck(run({ Br: 600, path: 'frame' }), 'frrot').ur < ck(run({ Br: 600 }), 'frrot').ur);
T('front pads design runs and checks pad rotation', !!ck(run({ ftype: 'pad' }), 'ffrot'));
{ const q = run({ rtype: 'pad', ftype: 'pad', Lpr: 1200, Bpr: 1200, Lp: 1200, Bp: 1200 });
  T('one footing per post on both lines: footing checks and pad bending present', !!ck(q, 'frrot') && !!ck(q, 'ffrot') && !!ck(q, 'frmp') && !!ck(q, 'ffmp') && !ck(q, 'frmt'));
  T('individual footings weigh less than continuous strips', q.Gtot < r.Gtot); }
T('stronger wind (region C) raises bolt tension', ck(run({ region: 'C' }), 'bT').Ed > ck(r, 'bT').Ed);
T('bigger bolts raise the bolt tension capacity', ck(run({ bolt: 'M20' }), 'bT').Rd > ck(r, 'bT').Rd);
T('thicker plate raises the plate bending capacity', ck(run({ tpl: 20 }), 'plT').Rd > ck(r, 'plT').Rd);
T('report has sections and the Thai report runs', r.rep.secs.length > 12 && SH.design(Object.assign({}, base), 'th').rep.secs.length === r.rep.secs.length);
T('sketch renders', /<svg/.test(SH.sketch(r, (a) => a)));
console.log(bad ? bad + ' BAD' : 'all shelter checks passed');
process.exit(bad ? 1 : 0);
