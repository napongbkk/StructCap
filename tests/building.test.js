// StructCap building module — floor loads, wind (AS/NZS 1170.2, EN 1991-1-4, DPT 1311-50), diaphragm, story results, quantity take-off.
// Run: node tests/building.test.js
const path = require('path');
require(path.join(__dirname, '..', 'frame.js')); require(path.join(__dirname, '..', 'building.js'));
const F = globalThis.FRAME, BD = globalThis.BUILDING;
let bad = 0;
const P = (lbl, got, exp, tol = 0.005) => { const ok = Math.abs(got - exp) <= tol * Math.max(1, Math.abs(exp)); if (!ok) bad++; console.log(ok ? 'OK ' : 'BAD', lbl.padEnd(66), (+got).toFixed(4), 'expected', (+exp).toFixed(4)); };
const T = (lbl, ok) => { if (!ok) bad++; console.log(ok ? 'OK ' : 'BAD', lbl); };

// a regular frame: bays bx, by, story heights hs; RC columns 400×400, beams 300×600, slabs t on every bay
function frame(bx, by, hs, o) {
  o = o || {};
  const cum = a => a.reduce((s, v) => { s.push(s[s.length - 1] + v); return s; }, [0]), xs = cum(bx), ys = cum(by), zs = cum(hs);
  const m = { std: 'AS', nodes: [], members: [], sections: [{ id: 'C', type: 'rect', b: 400, h: 400 }, { id: 'B', type: 'rect', b: 300, h: 600 }], materials: [{ id: 'N32', kind: 'conc', E: 30100, nu: 0.2, rho: o.rho == null ? 24 : o.rho }],
    cases: [{ id: 'G', type: 'G', sw: !!o.sw }, { id: 'Q', type: 'Q', sw: false }, { id: 'WX', type: 'W' }, { id: 'WY', type: 'W' }], loads: [], combos: [] };
  const id = (i, j, k) => 'N' + i + '_' + j + '_' + k;
  zs.forEach((z, k) => ys.forEach((y, j) => xs.forEach((x, i) => m.nodes.push({ id: id(i, j, k), x, y, z, sup: k ? 'free' : 'fixed' }))));
  let c = 0, bxn = 0, byn = 0;
  for (let k = 1; k < zs.length; k++) {
    ys.forEach((y, j) => xs.forEach((x, i) => m.members.push({ id: 'C' + (++c), i: id(i, j, k - 1), j: id(i, j, k), sec: 'C', mat: 'N32', type: 'frame' })));
    ys.forEach((y, j) => { for (let i = 0; i + 1 < xs.length; i++) m.members.push({ id: 'BX' + (++bxn), i: id(i, j, k), j: id(i + 1, j, k), sec: 'B', mat: 'N32', type: 'frame' }); });
    xs.forEach((x, i) => { for (let j = 0; j + 1 < ys.length; j++) m.members.push({ id: 'BY' + (++byn), i: id(i, j, k), j: id(i, j + 1, k), sec: 'B', mat: 'N32', type: 'frame' }); });
  }
  m.bld = { gx: [], gy: [], stories: zs.map((z, k) => ({ id: k ? 'L' + k : 'Base', z })), slabs: [], floor: { dl: 'G', ll: 'Q', sw: !!o.slabsw }, dia: !!o.dia, wind: Object.assign(BD.windDefaults('AS'), { on: false }) };
  let s = 0;
  for (let k = 1; k < zs.length; k++) for (let i = 0; i + 1 < xs.length; i++) for (let j = 0; j + 1 < ys.length; j++) m.bld.slabs.push({ id: 'S' + (++s), st: 'L' + k, x0: xs[i], x1: xs[i + 1], y0: ys[j], y1: ys[j + 1], t: 150, sdl: o.sdl == null ? 5 : o.sdl, ll: o.ll || 0, way: o.way || 'auto' });
  return m;
}
let mL = null; const udlTot = (ls, mem, cs) => ls.filter(l => l.member === mem && l.case === cs && l.kind === 'udl').reduce((t, l) => { const q = mL.members.find(z => z.id === mem), n1 = mL.nodes.find(n => n.id === q.i), n2 = mL.nodes.find(n => n.id === q.j), L = Math.hypot(n2.x - n1.x, n2.y - n1.y), w2 = l.w2 === '' ? +l.w1 : +l.w2, a = l.a === '' ? 0 : +l.a, b = l.b === '' ? L : +l.b; return t + (+l.w1 + w2) / 2 * (b - a); }, 0);

// 1 two-way square slab 6 × 6 m, 5 kPa: each edge beam takes a triangle q·L²/4 = 45 kN, peak q·L/2 = 15 kN/m at midspan
let m = frame([6], [6], [3.5]); mL = m; let s = BD.slabLoads(m);
P('1 two-way 6×6 m slab, 5 kPa: edge beam load = qL²/4', udlTot(s.loads, 'BX1', 'G'), 45);
P('1 total on the four beams = q·A', ['BX1', 'BX2', 'BY1', 'BY2'].reduce((t, id) => t + udlTot(s.loads, id, 'G'), 0), 180);
const tri = s.loads.filter(l => l.member === 'BX1'); P('1 triangle peak at midspan = q·L/2', Math.max(...tri.map(l => Math.max(+l.w1, l.w2 === '' ? +l.w1 : +l.w2))), 15);
// 2 two-way rectangle 6 × 8: trapezoid on the 8 m beams = q·(L·h − h²) with h = 3 → 5·(24 − 9) = 75 kN, triangle on 6 m = 45 kN
m = frame([8], [6], [3.5]); mL = m; s = BD.slabLoads(m);
P('2 two-way 8×6 m: trapezoid on the long beams = q·h·(L − h)', udlTot(s.loads, 'BX1', 'G'), 75);
P('2 triangle on the short beams = q·Ls²/4', udlTot(s.loads, 'BY1', 'G'), 45);
// 3 one-way slab 3 × 9 m (ratio 3): spans in X, half the load to each 9 m edge, nothing on the 3 m edges
m = frame([3], [9], [3.5]); s = BD.slabLoads(m);
T('3 one-way 3×9 m slab spans the short way (oneX)', BD.slabWay(m.bld.slabs[0]) === 'oneX');
P('3 9 m edge beam: uniform q·Lx/2 = 7.5 kN/m', +s.loads.find(l => l.member === 'BY1').w1, 7.5);
T('3 the 3 m edge beams carry nothing', !s.loads.some(l => l.member === 'BX1' || l.member === 'BX2'));
// 4 interior beam shared by two slabs (two bays 6 + 6 by 6): middle beam takes two triangles = 90 kN as one merged load set
m = frame([6, 6], [6], [3.5]); mL = m; s = BD.slabLoads(m);
const midBeam = m.members.find(q => q.id.startsWith('BY') && Math.abs(m.nodes.find(n => n.id === q.i).x - 6) < 1e-6 && m.nodes.find(n => n.id === q.i).z > 0).id;
P('4 interior beam between two slabs: 2 · qL²/4', udlTot(s.loads, midBeam, 'G'), 90);
T('4 merged into one triangle (two linear pieces)', s.loads.filter(l => l.member === midBeam).length === 2);
// 5 equilibrium: analyse a 2 × 2 bay, 2-story frame with slab loads + slab self-weight; ΣRz = Σ slab loads + member weight
m = frame([6, 5], [4, 4], [3.5, 3], { sw: true, slabsw: true, sdl: 2, ll: 3 }); BD.sync(m);
let r = F.analyse(m, {}); const Rz = cs => r.cases[cs].R.reduce((t, v, i) => t + (i % 6 === 2 ? v : 0), 0);
const area = 11 * 8 * 2, memW = m.members.reduce((t, q) => { const sc = q.sec === 'C' ? 0.16 : 0.18, n1 = m.nodes.find(n => n.id === q.i), n2 = m.nodes.find(n => n.id === q.j); return t + 24 * sc * Math.hypot(n2.x - n1.x, n2.y - n1.y, n2.z - n1.z); }, 0);
P('5 ΣRz case G = slab SDL + slab self-weight + member self-weight', Rz('G'), area * (2 + 24 * 0.15) + memW, 0.001);
P('5 ΣRz case Q = live load × floor area', Rz('Q'), area * 3, 0.001);

// 6 wind — AS/NZS 1170.2: Region A, R = 500 → VR = 67 − 41·500^−0.1 = 44.97 m/s; TC3, z = 10 m: Mz,cat 0.83
P('6 AS VR Region A, R 500', BD.asVR('A', 500), 67 - 41 * Math.pow(500, -0.1), 1e-6);
P('6 AS VR Region D, R 500 (≈ 80 m/s)', BD.asVR('D', 500), 80, 0.01);
P('6 AS Mz,cat TC2 at 10 m = 1.00', BD.asMz(10, '2'), 1.0, 1e-6); P('6 AS Mz,cat TC3 at 35 m (interpolated) = 1.02', BD.asMz(35, '3'), 1.02, 1e-6);
let cfg = BD.windDefaults('AS'), wm = BD.windModel(cfg, 10, 20, 20), V = BD.asVR('A', 500) * 0.83;
P('6 AS h = 10 m ≤ 25: windward p = 0.6·Vdes²·0.7 (kPa)', wm.pw(3), 0.6 * V * V * 0.7 / 1000, 1e-6);
P('6 AS leeward d/b = 1: −0.5', wm.pl, -0.6 * V * V * 0.5 / 1000, 1e-6);
wm = BD.windModel(cfg, 10, 10, 30); P('6 AS leeward d/b = 3: −0.25', wm.cp[1], -0.25, 1e-6);
// 7 EN 1991-1-4: vb = 25, terrain II, z = 10 m: qp = 0.919 kPa (ce ≈ 2.35)
cfg = BD.windDefaults('EC'); cfg.EN.tc = 'II'; wm = BD.windModel(cfg, 10, 30, 30);
const lz = Math.log(10 / 0.05), qp10 = (1 + 7 / lz) * 0.5 * 1.25 * Math.pow(0.19 * lz * 25, 2) / 1000;
P('7 EN qp(10 m), terrain II, vb 25 m/s', wm.info(10).qp, qp10, 1e-6); P('7 EN ce(10) = qp/qb ≈ 2.35', qp10 / (0.5 * 1.25 * 625 / 1000), 2.35, 0.01);
P('7 EN h/d = 1/3: cpe,D = 0.7 + 0.1·(0.333−0.25)/0.75', wm.cp[0], 0.7 + 0.1 * (1 / 3 - 0.25) / 0.75, 1e-6); P('7 EN lack-of-correlation factor 0.85 for h/d ≤ 1', wm.fac, 0.85, 1e-6);
wm = BD.windModel(cfg, 50, 20, 20); P('7 EN h > 2b: ze = z in the middle strip', wm.info(25).ze, 25, 1e-9); P('7 EN h > 2b: ze = b in the lower strip', wm.info(10).ze, 20, 1e-9); P('7 EN h > 2b: ze = h in the top strip', wm.info(45).ze, 50, 1e-9);
// 8 DPT 1311-50: zone 1 (25 m/s), normal, exposure A, z = 10 m: Ce = 1 → p = 1·390.6·1·2·0.8 = 625 Pa; leeward Ce(H/2)
cfg = BD.windDefaults('TH'); cfg.TH.exp = 'A'; wm = BD.windModel(cfg, 20, 20, 20);
P('8 TH windward at 10 m: Iw·q·Ce·Cg·Cp', wm.pw(10), 0.5 * 1.25 * 625 * 2 * 0.8 / 1000, 1e-6);
P('8 TH leeward: Ce at H/2 = 10 m → −0.5·2·q', wm.pl, -0.5 * 2 * 0.390625, 1e-6);
cfg.TH.exp = 'B'; P('8 TH exposure B at 20 m: Ce = 0.7·(20/12)^0.3', BD.windModel(cfg, 20, 20, 20).info(20).Ce, 0.7 * Math.pow(20 / 12, 0.3), 1e-6);
cfg.TH.zone = '4A'; P('8 TH zone 4A: V = 25 × 1.2 = 30 m/s → q = 562.5 Pa', BD.windModel(cfg, 20, 20, 20).q0 * 1000, 562.5, 1e-6);

// 9 story forces → nodal loads: ΣFx of case WX = base shear; storey forces add up
m = frame([6, 6, 6], [5, 5], [4, 3.5, 3.5, 3.5]); m.bld.wind = BD.windDefaults('AS'); m.bld.wind.neg = false; const out = BD.sync(m);
const c9 = out.calc.X, sumF = cs => m.loads.filter(l => l.case === cs && l.gen === 'wind').reduce((t, l) => t + (+l.Fx || 0) + (+l.Fy || 0), 0);
P('9 ΣFx in WX = base shear of the wind table', sumF('WX'), c9.base, 1e-5);
P('9 base shear = Σ (pw − pl)·B·trib height (top story check)', c9.rows[3].F, (c9.rows[3].pw - c9.rows[3].pl) * 10 * (3.5 / 2), 1e-3);
T('9 windward loads on the x = 0 face only, leeward on x = 18', m.loads.filter(l => l.gen === 'wind' && l.case === 'WX').every(l => { const n = m.nodes.find(q => q.id === l.node); return n.x === 0 || n.x === 18; }));
r = F.analyse(m, {}); const Rx = r.cases.WX.R.reduce((t, v, i) => t + (i % 6 === 0 ? v : 0), 0);
P('9 analysis: ΣRx = −base shear', Rx, -c9.base, 1e-5);
const sr = BD.storyResults(m, r.cases.WX);
P('9 story shear at story 1 from column forces = base shear', sr[0].Vx, c9.base, 1e-4);
P('9 story shear at the top story = top story force', sr[3].Vx, c9.rows[3].F, 1e-4);
T('9 drift ratio finite and > 0', sr[0].rx > 10 && isFinite(sr[0].rx));
// 10 rigid diaphragm: windward and leeward nodes of a floor move together
m.bld.dia = true; const ex = BD.expand(m); r = BD.stripRes(F.analyse(ex, {}));
const ux = id => r.cases.WX.u[6 * m.nodes.findIndex(n => n.id === id)];
P('10 diaphragm: ux at the far corner = ux at the windward corner (top)', ux('N3_0_4'), ux('N0_0_4'), 0.01);
T('10 diaphragm members stay out of the results', !r.cases.WX.mem.some(q => q.id.startsWith('~')));
T('10 the model itself is unchanged by expand()', !m.members.some(q => q.id.startsWith('~')) && ex.members.length > m.members.length);
P('10 diaphragm: ΣRx still = base shear', r.cases.WX.R.reduce((t, v, i) => t + (i % 6 === 0 ? v : 0), 0), -c9.base, 1e-5);
const dup = frame([6], [5], [4]); dup.members.push(Object.assign({}, dup.members[4], { id: 'DUP' })); let okDup = true; try { F.analyse(dup, {}); } catch (e) { okDup = false; }
T('10 two elements between the same nodes no longer reported as a mechanism', okDup);

// 11 quantity take-off: one bay 6 × 6, one story 3.5 m, RC 400×400 columns, 300×600 beams, 150 slab
m = frame([6], [6], [3.5]); let q = BD.qto(m, {});
const cat = k => q.byCat.find(g => g.k === k) || {};
P('11 columns: 4 × 0.4² × 3.5 m³', cat('col|conc').V, 4 * 0.16 * 3.5, 1e-9);
P('11 beams below the slab: 4 × 0.3·(0.6−0.15)·(6 − 0.4) m³', cat('beam|conc').V, 4 * 0.3 * 0.45 * 5.6, 1e-9);
P('11 slab: 36 m² × 0.15 m', cat('slab|conc').V, 5.4, 1e-9);
P('11 column formwork: 4 × 1.6 m × (3.5 − 0.15)', cat('col|conc').form, 4 * 1.6 * 3.35, 1e-9);
P('11 slab formwork: soffit (36 − half beam widths) + free edges', cat('slab|conc').form, 36 - 4 * 6 * 0.15 + 4 * 6 * 0.15, 1e-9);
P('11 rebar: default ratios 180 / 150 / 100 kg/m³', q.tot.rebar, 2.24 * 180 + 3.024 * 150 + 5.4 * 100, 1e-9);
q = BD.qto(m, { deduct: false }); P('11 without joint deduction: beam clear length 6 m', cat('beam|conc').V, 4 * 0.3 * 0.45 * 6, 1e-9);
q = BD.qto(m, { rates: { conc: 100, form: 10, rebar: 1000, steel: 0 } }); P('11 cost = V·rate + form·rate + rebar t·rate', q.cost.tot, q.tot.V * 100 + q.tot.form * 10 + q.tot.rebar);
// 12 steel members: mass = A·L·7850 kg/m³ (+ connection allowance)
const ms = { std: 'AS', nodes: [{ id: 'A', x: 0, y: 0, z: 0 }, { id: 'B', x: 10, y: 0, z: 0 }], members: [{ id: 'S1', i: 'A', j: 'B', sec: 'I', mat: 'ST' }], sections: [{ id: 'I', type: 'I', d: 300, bf: 150, tf: 10, tw: 6 }], materials: [{ id: 'ST', kind: 'steel', E: 200000, rho: 78.5 }], cases: [], loads: [], combos: [] };
const Ai = (2 * 150 * 10 + 280 * 6) / 1e6;
P('12 steel beam mass = A·L·7850', BD.qto(ms, {}).tot.steel, Ai * 10 * 7850, 1e-9);
P('12 with 5 % connections', BD.qto(ms, { conn: 5 }).tot.steel, Ai * 10 * 7850 * 1.05, 1e-9);

console.log(bad ? bad + ' check(s) FAILED' : 'all checks passed');
process.exit(bad ? 1 : 0);
