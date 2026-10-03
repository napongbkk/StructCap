// StructCap bridge analysis — moving loads, stages and combinations against hand results.  Run: node tests/bridge.test.js
const path = require('path');
require(path.join(__dirname, '..', 'frame.js')); require(path.join(__dirname, '..', 'bridge.js'));
const F = globalThis.FRAME, BR = globalThis.BRIDGE;
let bad = 0;
const P = (lbl, got, exp, tol = 0.005) => { const ok = Math.abs(got - exp) <= tol * Math.max(1, Math.abs(exp)); if (!ok) bad++; console.log(ok ? 'OK ' : 'BAD', lbl.padEnd(62), (+got).toFixed(3), 'expected', (+exp).toFixed(3)); };
const sec = [{ id: 'S', type: 'rect', b: 400, h: 1000 }], mat = [{ id: 'C', E: 30000, nu: 0.2, rho: 0 }];
const N = (id, x, fix) => ({ id, x, y: 0, z: 0, sup: 'custom', fix });
const pin = [1, 1, 1, 1, 0, 0], rol = [0, 1, 1, 1, 0, 0];
function beam(spans) { const nodes = [N('A0', 0, pin)]; const mem = []; let x = 0; spans.forEach((L, i) => { x += L; nodes.push(N('A' + (i + 1), x, rol)); mem.push({ id: 'B' + (i + 1), i: 'A' + i, j: 'A' + (i + 1), sec: 'S', mat: 'C' }); }); return { nodes, members: mem, sections: sec, materials: mat, cases: [{ id: 'G', name: 'G', sw: false }], loads: [], combos: [], bridge: { lanes: [{ id: 'L1', a: mem.map(m => m.id) }] } }; }
const ix = (m, f) => m.x.reduce((b, x, i) => (Math.abs(x - f * m.L) < Math.abs(m.x[b] - f * m.L) ? i : b), 0);
const mid = (env, id, q) => { const m = env.mem.find(z => z.id === id), i = ix(m, 0.5); return [m[q + 'max'][i], m[q + 'min'][i]]; };
const end = (env, id, q) => { const m = env.mem.find(z => z.id === id), i = m.x.length - 1; return [m[q + 'max'][i], m[q + 'min'][i]]; };

// 1 single axle on a 20 m simple span → M_mid = PL/4
let m = beam([20]); m.bridge.vehicles = [{ id: 'V', name: 'axle', axles: [[0, 100]], udl: 0, dla: 0 }]; m.bridge.mlc = [{ id: 'ML', code: 'USER', veh: ['V'] }];
let inf = BR.influence(m), env = BR.movingEnvelope(m, inf, m.bridge.mlc[0]);
P('1 single 100 kN axle, 20 m span: M_mid max = PL/4', mid(env, 'B1', 'Mz')[0], 500); P('1 shear at the end: V max = P', Math.max(...env.mem[0].Vymax.map(Math.abs), ...env.mem[0].Vymin.map(Math.abs)), 100);
P('1 reaction range at A0: 0 … 100', env.R[2][1], 100); P('1 reaction min at A0 = 0', env.R[2][0], 0);
// 2 lane UDL only (patch loading) on two 6 m spans: M_B = −qL²/8, span sagging max = 0.0957 qL² (… one span loaded)
m = beam([6, 6]); m.bridge.vehicles = [{ id: 'U', name: 'udl', axles: [[0, 0]], udl: 10, dla: 0 }]; m.bridge.mlc = [{ id: 'ML', code: 'USER', veh: ['U'] }];
inf = BR.influence(m); env = BR.movingEnvelope(m, inf, m.bridge.mlc[0]);
P('2 UDL 10 kN/m, 2 × 6 m: hogging at B = −qL²/8', end(env, 'B1', 'Mz')[1], -45);
P('2 sagging at 0.4L of span 1 (one span loaded) = 0.0957qL²', BR.movingEnvelope(m, BR.influence(m, { nps: 10 }), m.bridge.mlc[0]).mem[0].Mzmax[4], 0.0957 * 360, 0.01);
// 3 HL-93 truck + lane on a 30 m span, midspan section, one lane (m = 1.2, IM 33 % on the truck only)
m = beam([30]); m.bridge.mlc = [{ id: 'ML', code: 'HL93', veh: ['HL93T', 'HL93D'] }];
inf = BR.influence(m); env = BR.movingEnvelope(m, inf, m.bridge.mlc[0]);
const IL = x => (x <= 15 ? x / 2 : (30 - x) / 2); let bt = 0;
for (let g = 4.3; g <= 9.0001; g += 0.01) for (let x = 0; x <= 40; x += 0.01) { const v = 35 * (x >= 0 && x <= 30 ? IL(x) : 0) + 145 * (x - 4.3 >= 0 && x - 4.3 <= 30 ? IL(x - 4.3) : 0) + 145 * (x - 4.3 - g >= 0 && x - 4.3 - g <= 30 ? IL(x - 4.3 - g) : 0); if (v > bt) bt = v; }
P('3 HL-93 at midspan of 30 m: 1.2·(1.33·M_truck + 9.3·L²/8)', mid(env, 'B1', 'Mz')[0], 1.2 * (1.33 * bt + 9.3 * 900 / 8), 0.004);
// 4 EN LM1, two lanes on the same girder line: (2·300·IL + 27∫IL) + (2·200·IL + 7.5∫IL) at midspan of 20 m
m = beam([20]); m.bridge.lanes.push({ id: 'L2', a: ['B1'] }); m.bridge.mlc = [{ id: 'ML', code: 'EN', veh: ['LM1'] }];
inf = BR.influence(m); env = BR.movingEnvelope(m, inf, m.bridge.mlc[0]);
const tand = 5 + (10 - 0.6) / 2 * 0 + 0; // tandem symmetric about midspan: 2 × IL(10 − 0.6) = 2 × 4.7
P('4 LM1 two lanes, 20 m: lane 1 + lane 2', mid(env, 'B1', 'Mz')[0], (300 * 2 * 4.7 + 27 * 50) + (200 * 2 * 4.7 + 7.5 * 50), 0.004);
// 5 AS 5100 M1600 lane factors: two identical lanes → (1.0 + 0.8) × one lane
m = beam([20]); m.bridge.mlc = [{ id: 'ML', code: 'AS', veh: ['M1600'] }]; inf = BR.influence(m);
const one = BR.movingEnvelope(m, inf, m.bridge.mlc[0]); m.bridge.lanes.push({ id: 'L2', a: ['B1'] }); inf = BR.influence(m); const two = BR.movingEnvelope(m, inf, m.bridge.mlc[0]);
P('5 AS 5100: two lanes = 1.8 × one lane', mid(two, 'B1', 'Mz')[0], 1.8 * mid(one, 'B1', 'Mz')[0]);
// 6 lane between two girder lines (lever rule): w = 0.25 → 75 % / 25 %
m = { nodes: [N('a0', 0, pin), N('a1', 10, rol), Object.assign(N('b0', 0, pin), { y: 3 }), Object.assign(N('b1', 10, rol), { y: 3 })], members: [{ id: 'GA', i: 'a0', j: 'a1', sec: 'S', mat: 'C' }, { id: 'GB', i: 'b0', j: 'b1', sec: 'S', mat: 'C' }], sections: sec, materials: mat, cases: [{ id: 'G', sw: false }], loads: [], combos: [],
  bridge: { lanes: [{ id: 'L', a: ['GA'], b: ['GB'], w: 0.25 }], vehicles: [{ id: 'V', axles: [[0, 100]], udl: 0, dla: 0 }], mlc: [{ id: 'ML', code: 'USER', veh: ['V'] }] } };
inf = BR.influence(m); env = BR.movingEnvelope(m, inf, m.bridge.mlc[0]);
P('6 lane at 1/4 of the girder spacing: girder A takes 75 %', mid(env, 'GA', 'Mz')[0], 0.75 * 250); P('6 girder B takes 25 %', mid(env, 'GB', 'Mz')[0], 0.25 * 250);
// 7 construction stages: span 1 built and loaded, then span 2 added and both loaded
m = beam([6, 6]); m.cases = [{ id: 'G', sw: false }, { id: 'Q', sw: false }];
m.loads = [{ case: 'G', kind: 'udl', member: 'B1', dir: 'grav', w1: 10 }, { case: 'Q', kind: 'udl', member: 'B1', dir: 'grav', w1: 10 }, { case: 'Q', kind: 'udl', member: 'B2', dir: 'grav', w1: 10 }];
m.bridge.stages = [{ id: 'S1', name: 'Span 1', mems: ['B1'], cases: ['G'] }, { id: 'S2', name: 'Span 2 + live', mems: ['B2'], cases: ['Q'] }];
const st = BR.stageRun(m);
P('7 stage 1: simply supported span, M_mid = qL²/8', st[0].mem[0].Mz[10], 45); P('7 stage 2: support moment from stage-2 load only = −qL²/8', st[1].mem[0].Mz[20], -45);
P('7 stage 2 cumulative M_mid span 1 = 45 + (45 − 22.5)', st[1].mem[0].Mz[10], 67.5);
// 8 bridge combination: 1.2·G + 1.8·ML
m = beam([20]); m.loads = [{ case: 'G', kind: 'udl', member: 'B1', dir: 'grav', w1: 10 }]; m.bridge.vehicles = [{ id: 'V', axles: [[0, 100]], udl: 0, dla: 0 }]; m.bridge.mlc = [{ id: 'ML', code: 'USER', veh: ['V'] }];
m.bridge.bcombos = [{ id: 'U1', name: 'ULS', type: 'ULS', f: { G: 1.2 }, ml: { ML: 1.8 } }];
const res = F.analyse(m), all = BR.run(m, res);
P('8 combination at midspan: 1.2·qL²/8 + 1.8·PL/4', mid(all.bc.U1, 'B1', 'Mz')[0], 1.2 * 500 + 1.8 * 500);
P('8 combination minimum at midspan: 1.2·qL²/8 (vehicle never reduces it)', mid(all.bc.U1, 'B1', 'Mz')[1], 600);
console.log(bad ? bad + ' check(s) FAILED' : 'all checks passed'); process.exitCode = bad ? 1 : 0;
