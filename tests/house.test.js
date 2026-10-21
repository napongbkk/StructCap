// StructCap House — engine checks: SDM formulas against hand values, load take-down equilibrium, Method-2 slab coefficients,
// column interaction, footing sizing, steel roof truss, BBS hooks / laps, variants (piles, wind, roof types) and the output modules.
// Run: node tests/house.test.js
const path = require('path');
globalThis.window = globalThis;
['frame.js', 'house.js', 'housebbs.js', 'housereport.js', 'housedwg.js'].forEach(f => { try { require(path.join(__dirname, '..', f)); } catch (e) { if (!/housereport|housedwg/.test(f)) throw e; } });
const X = globalThis.HOUSE, BB = globalThis.HOUSEBBS, KG = X.KG;
let bad = 0;
const P = (lbl, got, exp, tol = 0.005) => { const ok = Math.abs(got - exp) <= tol * Math.max(1, Math.abs(exp)); if (!ok) bad++; console.log(ok ? 'OK ' : 'BAD', lbl.padEnd(64), (+got).toFixed(4), 'expected', (+exp).toFixed(4)); };
const T = (lbl, ok) => { if (!ok) bad++; console.log(ok ? 'OK ' : 'BAD', lbl); };

// 1. SDM basics (f'c 240, fy 4000)
P('β1 (f\'c 240)', X.beta1(240), 0.85);
P('ρb = 0.85β1(f\'c/fy)(6120/(6120+fy))', X.rhoB(240, 4000), 0.85 * 0.85 * 0.06 * 6120 / 10120, 1e-6);
{ const r = X.rhoReq(3e5, 20, 35, 240, 4000), Rn = 3e5 / (0.9 * 20 * 35 * 35); P('Rn = Mu/(φbd²) for 3 t·m on 20×35', r.Rn, Rn, 1e-6); P('ρreq = 0.85f\'c/fy(1−√(1−2Rn/0.85f\'c))', r.rho, 0.85 * 240 / 4000 * (1 - Math.sqrt(1 - 2 * Rn / (0.85 * 240))), 1e-6); }
P('Ld DB16 = 0.06Abfy/√f\'c (≥ 0.0057dbfy)', X.devLen('DB16', 240, 4000), Math.max(0.06 * 2.011 * 4000 / Math.sqrt(240), 0.0057 * 1.6 * 4000), 1e-6);
P('Method 2 case 1, m = 1.0, short neg. continuous', X.coef(X.M2[1][0], 1), 0.033, 1e-6);
P('Method 2 case 4, m = 0.75 short pos. (interpolated)', X.coef(X.M2[4][2], 0.75), (0.056 + 0.062) / 2, 1e-6);

// 2. example house: load take-down equilibrium (Σ service reactions = Σ applied loads + self weight)
const H = X.example(), SV = X.solve(H), A = SV.A, D = SV.D, Q = BB.boq(H, D);
{
  const m = A.fm.model, wD = m.loads.filter(l => l.case === 'D' || l.case === 'L').reduce((s, l) => s + (l.kind === "udl" ? (l.w1 + l.w2) / 2 * (l.b - l.a) : 0), 0);
  const nodes = Object.fromEntries(m.nodes.map(n => [n.id, n])), secs = Object.fromEntries(m.sections.map(q => [q.id, q]));
  const sw = m.members.reduce((s, mb) => { const a = nodes[mb.i], b = nodes[mb.j], q = secs[mb.sec]; return s + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) * q.b * q.h / 1e6 * H.mat.ws * KG; }, 0);
  const R = Object.values(A.RX).reduce((s, r) => s + r.s[2], 0) * 1000 * KG;
  P('Σ reactions (D + L) = Σ applied + self weight (kN)', R, wD + sw, 0.002);
  const slabL = H.slabs.filter(s => !s.ground && s.st === 'S2').reduce((s, q) => s + 16 * 150, 0) * KG, Lin = m.loads.filter(l => l.case === 'L' && l.kind === 'udl' && /beam:/.test(l.member)).reduce((s, l) => s + (l.w1 + l.w2) / 2 * (l.b - l.a), 0);
  const rl = X.roofLoads(H), rg = X.roofGeom(H), sd = X.stairDesign(H, H.stairs[0]);
  P('live load into the beams = slabs + roof + stair (kN)', Lin, slabL + rl.L * (rg.span + 2 * rg.ov) * rg.len * KG + sd.L * sd.Lh * sd.W * KG, 0.002);
}
{ // a two-way slab panel: the four edge loads add up to q·Lx·Ly
  const s = H.slabs.find(q => q.st === 'S2' && q.i === 1 && q.j === 0), ld = X.slabLoads(H, s), m = A.fm.model;
  const ids = ['s', 'n', 'w', 'e'].map(k => ({ s: [[1, 0], [2, 0]], n: [[1, 1], [2, 1]], w: [[1, 0], [1, 1]], e: [[2, 0], [2, 1]] })[k]).map(([a, b]) => 'beam:' + X.beamOn(H, 'S2', a, b).id);
  T('two-way slab 4×4: equal triangles on all four edges (D)', ids.every(id => m.loads.some(l => l.member === id && l.case === 'D')));
  P('slab self weight + SDL (kg/m²)', ld.D, 0.12 * 2400 + 100, 1e-9);
}
// 3. member design spot checks
{
  const b = D.beams.find(x => x.top && x.st === 'S2'), M = H.mat, d = b.h - M.cover.beam - 0.6 / 2 * 2 / 2 - X.barD('RB6') / 10 - 0.8;
  P('beam d = h − cover − stirrup − db/2 (cm)', b.d, b.h - 3 - 0.6 - 0.8, 1e-6); void d;
  const rho = X.rhoReq(b.bot.Mu * 1e5, b.b, b.d, 240, 4000).rho, As = Math.max(rho * b.b * b.d, 14 / 4000 * b.b * b.d);
  P('beam bottom As,req = max(ρbd, 14/fy·bd)', b.bot.As, As, 1e-6);
  T('beam bottom bars provide As ≥ As,req', b.bot.n * X.barA(b.bot.bar) >= b.bot.As - 1e-9);
  const Vc = 0.53 * Math.sqrt(240) * b.b * b.d; P('beam Vc = 0.53√f\'c bd (kg)', b.shear.Vc, Vc, 1e-6);
  T('stirrup spacing ≤ d/2', b.shear.s <= b.d / 2 + 1e-9);
}
{
  const it = X.interaction(20, 20, 3.5, 'DB12', 4, 240, 4000, 0), Ast = 4 * X.barA('DB12');
  P('column φPn,max = 0.8φ[0.85f\'c(Ag−Ast)+fyAst] (kg)', it.Pmax, 0.8 * 0.7 * (0.85 * 240 * (400 - Ast) + 4000 * Ast), 1e-6);
  const c = D.cols.find(x => x.seg === 1); T('column UR ≤ 1 and 1 % ≤ ρg ≤ 4 %', c.ur <= 1 && c.rho >= 0.0099 && c.rho <= 0.04);
}
{
  const f = D.fnds[0], qa = H.soil.qa; T('footing q ≤ qa (spread)', f.q <= qa + 1e-9);
  P('footing area B·L ≥ P/(qa − γDf)', Math.min(f.B * f.L / (f.Ps / (qa - H.soil.Df * 2)), 1), 1, 1e-9);
  T('footing shear: punching and one-way OK', f.sh.Vp <= f.sh.pVp && f.sh.V1x <= f.sh.pV1x);
}
{
  const r = D.roof, tot = (r.rl.D + r.rl.L) * r.sp * (r.g.span + 2 * r.g.ov), Rz = r.truss.R.filter((v, i) => i % 6 === 2).reduce((s, v) => s + v, 0) / KG;
  P('roof truss: Σ vertical reactions = panel loads (kg)', Rz, tot, 0.001);
  T('truss members within ASD (Fa, 0.6Fy) and KL/r ≤ 200', r.truss.groups.every(g => g.sec && g.sec.ok));
  P('Fa(KL/r = 100, Fy 2400) AISC ASD (ksc)', X.Fa(100, 2400, 2.04e6), (() => { const Cc = Math.sqrt(2 * Math.PI ** 2 * 2.04e6 / 2400), q = 100 / Cc; return (1 - q * q / 2) * 2400 / (5 / 3 + 3 / 8 * q - q ** 3 / 8); })(), 1e-9);
}
{ // purlin: biaxial bending on the slope with sag rods, deflection both ways
  const pu = D.roof.purlin, th = D.roof.g.th, p = pu.p, cov = X.ROOFS[H.roof.cover][1], w = cov * D.roof.psp + p.w + D.roof.rl.L * Math.cos(th) * D.roof.psp;
  P('purlin load w = cover·psp + self + LL·cosθ·psp (kg/m)', pu.w, w, 1e-9);
  P('purlin wt = w·sinθ', pu.wt, w * Math.sin(th), 1e-9);
  P('purlin interaction fbx/0.6Fy + fby/0.75Fy', pu.ur, (w * Math.cos(th) * D.roof.sp ** 2 / 8 * 100 / p.Sx) / 1440 + (w * Math.sin(th) * pu.Ly ** 2 / 8 * 100 / p.Sy) / 1800, 1e-9);
  P('purlin Δt along the slope = 5wt·Ly⁴/384EIy (cm)', pu.dy, 5 * pu.wt / 100 * (pu.Ly * 100) ** 4 / (384 * H.mat.Es * p.Iy), 1e-9);
  const h2 = X.example(); h2.roof.sp = 4; h2.roof.pitch = 35; const r2 = X.solve(h2).D.roof.purlin;
  T(`purlin 4 m span at 35°: sag rods added (${r2.nsag}) and every check OK (${r2.name})`, r2.nsag >= 2 && r2.ok);
  const h3 = X.example(); h3.roof.sp = 4; h3.roof.pitch = 35; h3.roof.sag = 0; h3.roof.purlin = '75x45x15x2.3'; T('purlin C75 over 4 m without sag rods fails the weak-axis check', !X.solve(h3).D.roof.purlin.ok);
}
{ // pedestals run down to the top of each designed footing
  const h = X.example(); h.grid.x = [0, 6, 12, 18]; h.grid.y = [0, 6, 12]; h.loads.sdl = 300; const r = X.solve(h);
  const nodes = r.A.fm.model.nodes.filter(n => n.sup === 'fixed');
  T('frame base level = −Df + t of the footing below every column', r.D.fnds.every(f => { const n = nodes.find(q => q.id === `F:${f.i}:${f.j}`); return Math.abs(n.z - (-h.soil.Df + f.t / 100)) < 1e-9; }) && r.D.fnds.some(f => f.t > 30));
}
{ // BOQ default unit rates and VAT
  const c = Q.items.find(i => i.key === 'conc'), b = Q.items.find(i => i.key === 'bar_DB12');
  P('default concrete rate (mat + labour, บาท/ลบ.ม.)', c.mat + c.lab, 2634 + 522, 1e-9);
  P('default DB12 rate (บาท/กก.)', b.mat + b.lab, 20.65 + 3.9, 1e-9);
  P('BOQ total = Σ q·(mat + lab); grand = total × 1.07', Q.grand, Q.items.reduce((s, i) => s + i.q * (i.mat + i.lab), 0) * 1.07, 1e-9);
  const h = X.example(); h.rates = { conc: { mat: 3000 } }; const q2 = BB.boq(h, D); T('user rate overrides the default', q2.items.find(i => i.key === 'conc').mat === 3000 && q2.items.find(i => i.key === 'conc').lab === 522);
}
T('example house: every member passes', X.summary(D).nBad === 0);
// 4. BBS
P('90° hook DB12 = 12db (m)', BB.hook90('DB12'), 0.144, 1e-9);
P('lap DB16 = 40db (m)', BB.lap(H, 'DB16'), 0.64, 1e-9);
P('stirrup hook RB6 = max(6db, 7.5 cm) + 3db (m)', BB.hookStir('RB6'), 0.075 + 0.018, 1e-9);
{ const r = Q.B.rows.find(x => x.grp === 'คาน' && x.note === 'เหล็กบน'); P('BBS row weight = L·n·kg/m', r.kg, r.L * r.n * X.barW(r.bar), 1e-9); }
T('BOQ: concrete, formwork and rebar quantities present', Q.items.some(i => i.key === 'conc' && i.q > 5) && Q.items.some(i => i.key === 'form' && i.q > 10) && Q.kgAll > 1000);
P('BOQ rebar total = Σ by diameter × (1 + waste)', Q.kgAll, Q.B.byBar.reduce((s, o) => s + o.kg, 0) * 1.05, 1e-9);
T('3D cage has bars for every member type', ['fnd:', 'col:', 'beam:'].every(k => BB.cage(H, D).some(r => r.el.startsWith(k))));
// 5. variants
[['pile foundations', h => { h.soil.type = 'pile'; }], ['wind on', h => { h.loads.wind.on = true; }], ['hip roof', h => { h.roof.type = 'hip'; }], ['shed roof', h => { h.roof.type = 'shed'; h.roof.pitch = 10; }], ['flat (no truss)', h => { h.roof.type = 'flat'; }], ['user combos', h => { h.loads.combos = [{ id: 'U1', name: '1.2D+1.6L', f: { D: 1.2, L: 1.6 } }, { id: 'SV', name: 'D+L', f: { D: 1, L: 1 }, type: 'SLS' }]; }],
 ['overrides', h => { h.over = { ['beam:' + h.beams[5].id]: { top: 'DB16', ntop: 4 } }; }], ['3 storeys, 5 × 3 bays', h => { h.grid = { x: [0, 4, 8, 12, 16, 20], y: [0, 3.5, 7, 10.5], xn: ['1', '2', '3', '4', '5', '6'], yn: ['A', 'B', 'C', 'D'] }; h.stories.push({ id: 'S4', name: 'ชั้น 3', z: 9.2 }); h.columns = []; h.beams = []; h.slabs = []; h.stairs = []; h.walls = []; X.auto(h, { cols: true, beams: true, slabs: true }); h.slabs = h.slabs.filter(s => s.st !== 'S4'); h.slabs.filter(s => s.st === 'S1').forEach(s => { s.ground = true; }); h.roof.st = 'S4'; }]
].forEach(([nm, mod]) => {
  try { const h = X.example(); mod(h); const sv = X.solve(h), a = sv.A, d = sv.D, q = BB.boq(h, d), s = X.summary(d);
    T(`variant ${nm}: analysed and designed (${s.nOk} OK, ${s.nBad} NG), BOQ ${q.items.length} items`, s.list.length > 10 && q.items.length > 10);
    if (nm === 'pile foundations') T('pile caps: load per pile ≤ capacity', d.fnds.every(f => f.Rpile <= h.soil.pile.cap + 1e-9));
    if (nm === 'overrides') { const b = d.beams.find(x => x.id === h.beams[5].id); T('override: 4-DB16 top bars used', b.top.bar === 'DB16' && b.top.n === 4); }
    if (globalThis.HOUSERPT) { const html = globalThis.HOUSERPT.html(h, a, d, q, { esc: s2 => String(s2).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]), logo: '', date: '2026-10-21' }); T(`variant ${nm}: report has no NaN / undefined`, html.length > 5000 && !/NaN|undefined|Infinity/.test(html.replace(/<style[\s\S]*?<\/style>/g, ''))); }
    if (globalThis.HOUSEDWG) { const sh = globalThis.HOUSEDWG.sheets(h, a, d, { size: 'A3' }), dx = globalThis.HOUSEDWG.dxf(h, a, d, { size: 'A3' }), txt = Buffer.from(dx).toString('latin1'); T(`variant ${nm}: ${sh.length} drawing sheets, DXF ${Math.round(dx.length / 1024)} kB`, sh.length >= 5 && /ANSI_874/.test(txt) && /EOF\s*$/.test(txt) && sh.every(x => !/NaN|undefined/.test(globalThis.HOUSEDWG.svg(x)))); }
  } catch (e) { bad++; console.log('BAD', `variant ${nm}: ${e.message}`); }
});
console.log(bad ? `${bad} check(s) FAILED` : 'All house checks passed');
process.exitCode = bad ? 1 : 0;
