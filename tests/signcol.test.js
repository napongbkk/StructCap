// Sign column on a concrete pad (signcol.js) — node tests/signcol.test.js
const path = require('path');
global.window = globalThis;
['engine.js', 'gantry.js', 'shelter.js', 'signcol.js'].forEach(f => require(path.join(__dirname, '..', f)));
const SC = globalThis.SIGNCOL;
let bad = 0;
const T = (lbl, ok) => { if (!ok) bad++; console.log(ok ? 'OK ' : 'BAD', lbl); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const base = { Wp: 600, Dpn: 150, Hp: 3100, zb: 100, Gs: 1.8, dcov: 350, Lpad: 1200, Bpad: 1000, Dpad: 600, fc: 25, gc: 24, db: 12, nbar: 9, cover: 50, gs: 18, soil: 'yes', mu: 0.4, qult: 150, qa: 100,
  region: 'A', Ru: 500, Rs: 25, VRu: 45, VRs: 37, Md: 1, tc: 2, Ms: 1, Mt: 1, Cf: 1.8, Cfs: 1.3, ecc: 0.2,
  Lpl: 800, Bpl: 350, tpl: 12, fyp: 250, eb: 30, bolt: 'M16', bgrade: '4.6', hef: 300, ld: 150, lb: 50, lt: 3, lfy: 350, sleg: 498, sw: 3,
  sbolt: 'M12', sgrade: '8.8', sL: 600, sB: 200, sx1: 173, sy1: 70, sx2: 123 };
const run = o => SC.design(Object.assign({}, base, o || {}), 'en');
const ck = (r, id) => r.checks.find(c => c.id === id);
const r = run();
T('wind on the face F = q·C_fig·W·H = 1.005 × 1.8 × 0.6 × 3.1 = 3.37 kN', near(r.wind.FY, 1.005 * 1.8 * 0.6 * 3.1, 0.01));
{
  const Md = r.wind.FY * (0.1 + 1.55 + 0.95), Ms = 0.9 * (1.8 + 24 * 1.2 * 1.0 * 0.6 + 18 * 1.2 * 1.0 * 0.35) * 0.5;
  T('pad overturning matches a hand calculation', near(ck(r, 'otY').Ed, Md, 0.01) && near(ck(r, 'otY').Rd, Ms, 0.01));
}
T('bolt tension: (M/z − N/2)/2 with z = y_b + d_leg/2', near(ck(r, 'bT').Ed, (r.wind.FY * 2.0 * 1e3 / (145 + 75) - 0.9 * 1.8 / 2) / 2, 0.05));
T('RHS 150x50x3 section modulus (sharp corners)', near(SC.rhs(150, 50, 3, 350).Sx, (50 * 150 * 150 - 44 * 144 * 144) / 4, 1));
T('default design passes every check', r.checks.every(c => c.ur <= 1.0001));
T('a smaller pad overturns', ck(run({ Bpad: 600 }), 'otY').ur > 1);
T('thicker plate helps the plate bending', ck(run({ tpl: 16 }), 'plT').ur < ck(r, 'plT').ur);
T('Thai report runs', SC.design(Object.assign({}, base), 'th').rep.secs.length === r.rep.secs.length);
T('sketch renders', /<svg/.test(SC.sketch(r, a => a)));
console.log(bad ? bad + ' BAD' : 'all sign column checks passed');
process.exit(bad ? 1 : 0);
