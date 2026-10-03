// StructCap 3D frame engine — checks against closed-form results.  Run: node tests/frame.test.js
require(require('path').join(__dirname, '..', 'frame.js')); const F = globalThis.FRAME;
const E = 200000, b = 200, h = 400, Iz = b * h ** 3 / 12, Iy = h * b ** 3 / 12, A = b * h;
const EIz = E * 1e3 * Iz * 1e-12, EIy = E * 1e3 * Iy * 1e-12;
const base = () => ({ sections: [{ id: 'S1', type: 'rect', b, h }], materials: [{ id: 'M1', E, nu: 0.3, rho: 0 }], cases: [{ id: 'G', name: 'G', sw: false }], combos: [{ id: 'C1', name: '1.0G', type: 'ULS', f: { G: 1 } }], loads: [] });
let bad = 0;
const P = (lbl, got, exp, tol = 0.005) => { const ok = Math.abs(got - exp) <= tol * Math.max(1, Math.abs(exp)); if (!ok) bad++; console.log(ok ? 'OK ' : 'BAD', lbl.padEnd(54), (+got).toFixed(4), 'expected', (+exp).toFixed(4)); };
const mx = a => Math.max(...a), mn = a => Math.min(...a);
const N = (id, x, y, z, sup, o) => Object.assign({ id, x, y, z, sup: sup || 'free' }, o || {});
const Mb = (id, i, j, o) => Object.assign({ id, i, j, sec: 'S1', mat: 'M1' }, o || {});
const run = (m, o) => F.analyse(m, o);

// 1 simply supported beam along X in space (torsion held at both ends), gravity UDL
let m = base();
m.nodes = [N('A', 0, 0, 0, 'custom', { fix: [1, 1, 1, 1, 0, 0] }), N('B', 6, 0, 0, 'custom', { fix: [0, 1, 1, 1, 0, 0] })]; m.members = [Mb('B1', 'A', 'B')];
m.loads = [{ case: 'G', kind: 'udl', member: 'B1', dir: 'grav', w1: 10 }];
let c = run(m).cases.G;
P('1 SS beam along X: Mz max = wL²/8', mx(c.mem[0].Mz), 45); P('1 reaction Rz = wL/2', c.R[2], 30); P('1 midspan deflection 5wL⁴/384EIz', -mn(c.mem[0].dz), 5 * 10 * 6 ** 4 / 384 / EIz);
// 2 beam along a skew line in plan (3-4-5), horizontal load perpendicular to it → weak axis
m = base();
m.nodes = [N('A', 0, 0, 0, 'custom', { fix: [1, 1, 1, 1, 0, 0] }), N('B', 3.6, 4.8, 0, 'custom', { fix: [1, 1, 1, 1, 0, 0] })]; m.members = [Mb('B1', 'A', 'B')];
m.loads = [{ case: 'G', kind: 'udl', member: 'B1', dir: 'gx', w1: 8 }, { case: 'G', kind: 'udl', member: 'B1', dir: 'gy', w1: -6 }];
c = run(m).cases.G;
P('2 skew beam, 10 kN/m horizontal ⟂: |My| max = wL²/8', mx(c.mem[0].My.map(Math.abs)), 45);
P('2 lateral deflection 5wL⁴/384EIy', mx(c.mem[0].dx.map((d, i) => Math.hypot(d, c.mem[0].dy[i]))), 5 * 10 * 6 ** 4 / 384 / EIy);
// 3 cantilever along Y, tip loads Fz and Fx, end torque
m = base(); m.nodes = [N('A', 0, 0, 0, 'fixed'), N('B', 0, 3, 0)]; m.members = [Mb('B1', 'A', 'B')];
m.loads = [{ case: 'G', kind: 'node', node: 'B', Fz: -10, Fx: 4, My: 2 }];
c = run(m).cases.G;
P('3 cantilever tip deflection Z = PL³/3EIz', -c.u[8], 10 * 27 / 3 / EIz); P('3 tip deflection X = PL³/3EIy', c.u[6], 4 * 27 / 3 / EIy);
P('3 base reaction Mx = 10·3', c.R[3], 30); P('3 base reaction Mz = 4·3', c.R[5], 12);
const Gm = E * 1e3 / 2.6, J = h * b ** 3 * (1 / 3 - 0.21 * (b / h) * (1 - (b / h) ** 4 / 12)) * 1e-12;
P('3 torque about member axis: twist = TL/GJ', c.u[10], 2 * 3 / (Gm * J)); P('3 torsion T in member = 2', Math.abs(c.mem[0].T[5]), 2);
// 4 L-shaped grillage (beam along X then along Y), tip load down — statics at the support
m = base(); m.nodes = [N('A', 0, 0, 0, 'fixed'), N('B', 4, 0, 0), N('C', 4, 3, 0)]; m.members = [Mb('B1', 'A', 'B'), Mb('B2', 'B', 'C')];
m.loads = [{ case: 'G', kind: 'node', node: 'C', Fz: -10 }]; c = run(m).cases.G;
P('4 grillage Rz = 10', c.R[2], 10); P('4 grillage base Mx = P·3 (torsion in B1)', c.R[3], 30); P('4 grillage base My = −P·4', c.R[4], -40);
P('4 torsion in B1 = P·3', Math.abs(c.mem[0].T[3]), 30);
// 5 space tripod (truss): apex 0,0,4; feet on a circle radius 3; vertical 30 kN → each leg N = −10/sin
m = base(); m.nodes = [N('T', 0, 0, 4)].concat([0, 1, 2].map(k => N('F' + k, 3 * Math.cos(2 * Math.PI * k / 3), 3 * Math.sin(2 * Math.PI * k / 3), 0, 'pin')));
m.members = [0, 1, 2].map(k => Mb('L' + k, 'F' + k, 'T', { type: 'truss' })); m.loads = [{ case: 'G', kind: 'node', node: 'T', Fz: -30 }];
c = run(m).cases.G; P('5 tripod leg force = −10/(4/5)', c.mem[0].N[0], -12.5); P('5 tripod leg 3 force', c.mem[2].N[0], -12.5);
// 6 plane frame (XZ) — portal, fixed bases, lateral 10 kN; equal columns → base shears 5
m = base(); m.plane = 'XZ'; m.nodes = [N('A', 0, 0, 0, 'fixed'), N('B', 0, 0, 4), N('C', 6, 0, 4), N('D', 6, 0, 0, 'fixed')];
m.members = [Mb('C1', 'A', 'B'), Mb('R1', 'B', 'C'), Mb('C2', 'D', 'C')]; m.loads = [{ case: 'G', kind: 'node', node: 'B', Fx: 10 }];
c = run(m).cases.G; P('6 plane portal base shears equal', -c.R[0], 5, 0.02); P('6 sum H', c.R[0] + c.R[18], -10);
// 7 fixed-fixed, propped (release), 2-span — plane XZ
m = base(); m.plane = 'XZ'; m.nodes = [N('A', 0, 0, 0, 'fixed'), N('B', 6, 0, 0, 'fixed')]; m.members = [Mb('B1', 'A', 'B')];
m.loads = [{ case: 'G', kind: 'udl', member: 'B1', dir: 'grav', w1: 10 }]; c = run(m).cases.G;
P('7 FF end M = −wL²/12', c.mem[0].Mz[0], -30); P('7 FF mid M = wL²/24', c.mem[0].Mz[10], 15);
m.members[0].relJ = true; c = run(m).cases.G; P('7 propped fixed-end M = −wL²/8', c.mem[0].Mz[0], -45); P('7 M at hinge = 0', c.mem[0].Mz[20], 0);
m = base(); m.plane = 'XZ'; m.nodes = [N('A', 0, 0, 0, 'pin'), N('B', 5, 0, 0, 'rollerX'), N('C', 10, 0, 0, 'rollerX')]; m.members = [Mb('B1', 'A', 'B'), Mb('B2', 'B', 'C')];
m.loads = ['B1', 'B2'].map(id => ({ case: 'G', kind: 'udl', member: id, dir: 'grav', w1: 12 })); c = run(m).cases.G;
P('7 2-span support M = −wL²/8', c.mem[0].Mz[20], -37.5); P('7 2-span middle reaction 1.25wL', c.R[8], 75);
// 8 inclined member, projected load
m = base(); m.plane = 'XZ'; m.nodes = [N('A', 0, 0, 0, 'pin'), N('B', 4, 0, 3, 'rollerX')]; m.members = [Mb('B1', 'A', 'B')];
m.loads = [{ case: 'G', kind: 'udl', member: 'B1', dir: 'gravp', w1: 10 }]; c = run(m).cases.G;
P('8 inclined projected UDL Mmax = wLh²/8', mx(c.mem[0].Mz), 20); P('8 vertical reactions = 40', c.R[2] + c.R[8], 40);
// 9 point load
m = base(); m.plane = 'XZ'; m.nodes = [N('A', 0, 0, 0, 'pin'), N('B', 8, 0, 0, 'rollerX')]; m.members = [Mb('B1', 'A', 'B')];
m.loads = [{ case: 'G', kind: 'point', member: 'B1', dir: 'grav', P: 20, a: 2 }]; c = run(m).cases.G;
P('9 SS point Mmax = Pab/L', mx(c.mem[0].Mz), 30); P('9 R1 = Pb/L', c.R[2], 15);
// 10 Euler buckling, pinned both ends in 3D (weak axis governs)
m = base(); m.nodes = [N('A', 0, 0, 0, 'custom', { fix: [1, 1, 1, 0, 0, 1] }), N('B', 0, 0, 5, 'custom', { fix: [1, 1, 0, 0, 0, 0] })]; m.members = [Mb('C1', 'A', 'B')];
m.loads = [{ case: 'G', kind: 'node', node: 'B', Fz: -1 }];
let r = run(m, { buckling: true, nseg: 6 });
P('10 Euler Pcr = π²EIy/L² (weak axis)', r.buckling.C1.modes[0].lam, Math.PI ** 2 * EIy / 25, 0.01);
P('10 strong-axis mode = π²EIz/L²', (r.buckling.C1.modes.find(q => q.lam > 1.5 * Math.PI ** 2 * EIy / 25) || { lam: 0 }).lam, Math.PI ** 2 * EIz / 25, 0.01);
// 11 P-Delta cantilever (strong axis), exact amplification
m = base(); m.nodes = [N('A', 0, 0, 0, 'fixed'), N('B', 0, 0, 4)]; m.members = [Mb('C1', 'A', 'B')];
const Pcr = Math.PI ** 2 * EIz / 64, Pp = 0.3 * Pcr; m.loads = [{ case: 'G', kind: 'node', node: 'B', Fz: -Pp, Fx: 1 }];
const d1 = run(m).combos.C1.u[6], d2 = run(m, { pdelta: true, nseg: 6 }).combos.C1.u[6], uu = 4 * Math.sqrt(Pp / EIz);
P('11 P-Delta amplification 3(tan u − u)/u³', d2 / d1, 3 * (Math.tan(uu) - uu) / uu ** 3);
// 12 modal: SS beam in 3D with self-weight: lateral (Iy) then vertical (Iz)
m = base(); m.materials[0].rho = 78.5; m.cases[0].sw = true;
m.nodes = [N('A', 0, 0, 0, 'custom', { fix: [1, 1, 1, 1, 0, 0] }), N('B', 6, 0, 0, 'custom', { fix: [0, 1, 1, 1, 0, 0] })]; m.members = [Mb('B1', 'A', 'B')];
r = run(m, { modes: 4, nseg: 8 }); const mb = 78.5 * A * 1e-6 / 9.81, fz = Math.PI / 2 / 36 * Math.sqrt(EIz / mb), fy = Math.PI / 2 / 36 * Math.sqrt(EIy / mb);
P('12 modal lateral f1 = (π/2L²)√(EIy/m)', r.modal.modes[0].f, fy, 0.01); P('12 lateral mode 1 participating mass (t) = 8/π²·mL', r.modal.modes[0].my * r.modal.massY, 8 / Math.PI ** 2 * mb * 6, 0.06); // consistent mass, support coupling ignored
P('12 vertical mode f = (π/2L²)√(EIz/m)', (r.modal.modes.find(q => q.mz > 0.5) || { f: 0 }).f, fz, 0.01);
// 13 3D building: equilibrium of reactions under gravity + wind; beta rotation
m = base(); m.sections.push({ id: 'C', type: 'rect', b: 400, h: 400 }); m.materials[0].rho = 24;
m.cases = [{ id: 'G', name: 'G', sw: true }, { id: 'W', name: 'W', sw: false }]; m.combos = [{ id: 'C1', name: 'G+W', type: 'ULS', f: { G: 1.2, W: 1 } }];
const nodes = [], mems = []; for (let k = 0; k <= 2; k++) for (let j = 0; j <= 1; j++) for (let i = 0; i <= 2; i++) nodes.push(N(`N${i}${j}${k}`, 6 * i, 5 * j, 3.5 * k, k ? 'free' : 'fixed'));
for (let k = 1; k <= 2; k++) for (let j = 0; j <= 1; j++) for (let i = 0; i <= 2; i++) { mems.push(Mb(`C${i}${j}${k}`, `N${i}${j}${k - 1}`, `N${i}${j}${k}`, { sec: 'C' })); if (i < 2) mems.push(Mb(`BX${i}${j}${k}`, `N${i}${j}${k}`, `N${i + 1}${j}${k}`)); if (j < 1) mems.push(Mb(`BY${i}${j}${k}`, `N${i}${j}${k}`, `N${i}${j + 1}${k}`)); }
m.nodes = nodes; m.members = mems;
m.loads = mems.filter(q => q.id[0] === 'B').map(q => ({ case: 'G', kind: 'udl', member: q.id, dir: 'grav', w1: 20 })).concat([{ case: 'W', kind: 'node', node: 'N011', Fx: 15, Fy: 8 }, { case: 'W', kind: 'node', node: 'N012', Fx: 10, Fy: 5 }]);
r = run(m); c = r.combos.C1;
const sumR = (cc, d) => cc.R.reduce((s, v, i) => s + (i % 6 === d ? v : 0), 0);
const wt = mems.reduce((s, q) => { const L = q.sec === 'C' ? 3.5 : q.id[1] === 'X' ? 6 : 5; return s + L * ((q.sec === 'C' ? 0.16 : 0.08) * 24 + (q.sec === 'C' ? 0 : 20)); }, 0);
P('13 ΣRx = −25', sumR(c, 0), -25); P('13 ΣRy = −13', sumR(c, 1), -13); P('13 ΣRz = 1.2·weight', sumR(c, 2), 1.2 * wt);
m.members.forEach(q => { if (q.sec === 'C') q.beta = 90; }); P('13 beta = 90° on columns keeps equilibrium', sumR(run(m).combos.C1, 0), -25);
// 14 mechanism detection
m = base(); m.nodes = [N('A', 0, 0, 0, 'pin'), N('B', 6, 0, 0, 'pin'), N('C', 3, 0, 3)]; m.members = [Mb('B1', 'A', 'C', { relI: true, relJ: true }), Mb('B2', 'C', 'B', { relI: true, relJ: true })];
m.loads = [{ case: 'G', kind: 'node', node: 'C', Fz: -10 }];
let msg = ''; try { run(m); } catch (e) { msg = e.message; } console.log(/unstable/.test(msg) ? 'OK ' : 'BAD', '14 out-of-plane mechanism detected:', msg); if (!/unstable/.test(msg)) bad++;
m.plane = 'XZ'; c = run(m).cases.G; P('14 same frame in plane XZ: N = −10/(2 sin45°)', c.mem[0].N[0], -10 / Math.SQRT2);
// 15 larger model timing (5×5 bays × 8 storeys)
m = base(); m.sections.push({ id: 'C', type: 'rect', b: 500, h: 500 }); m.materials[0].rho = 24;
m.cases = [{ id: 'G', name: 'G', sw: true }, { id: 'W', name: 'W', sw: false }]; m.combos = [{ id: 'C1', name: 'G+W', type: 'ULS', f: { G: 1.2, W: 1 } }, { id: 'C2', name: '1.35G', type: 'ULS', f: { G: 1.35 } }];
const n2 = [], m2 = [], nb = 5, ns = 8; for (let k = 0; k <= ns; k++) for (let j = 0; j <= nb; j++) for (let i = 0; i <= nb; i++) n2.push(N(`N${i}_${j}_${k}`, 6 * i, 6 * j, 3.5 * k, k ? 'free' : 'fixed'));
for (let k = 1; k <= ns; k++) for (let j = 0; j <= nb; j++) for (let i = 0; i <= nb; i++) { m2.push(Mb(`C${i}_${j}_${k}`, `N${i}_${j}_${k - 1}`, `N${i}_${j}_${k}`, { sec: 'C' })); if (i < nb) m2.push(Mb(`X${i}_${j}_${k}`, `N${i}_${j}_${k}`, `N${i + 1}_${j}_${k}`)); if (j < nb) m2.push(Mb(`Y${i}_${j}_${k}`, `N${i}_${j}_${k}`, `N${i}_${j + 1}_${k}`)); }
m.nodes = n2; m.members = m2; m.loads = m2.filter(q => q.sec !== 'C').map(q => ({ case: 'G', kind: 'udl', member: q.id, dir: 'grav', w1: 25 })).concat(Array.from({ length: ns }, (_, k) => ({ case: 'W', kind: 'node', node: `N0_0_${k + 1}`, Fx: 50 })));
let t = Date.now(); r = run(m); console.log('15 linear,', m2.length, 'members:', Date.now() - t, 'ms');
for (const o of [{ pdelta: true }, { modes: 6 }, { buckling: true }]) { t = Date.now(); run(m, Object.assign({ nseg: 2 }, o)); console.log('15', JSON.stringify(o), Date.now() - t, 'ms'); }
t = Date.now(); r = run(m, { pdelta: true, nseg: 2, modes: 6, buckling: true }); console.log('15 P-Delta + modal + buckling:', Date.now() - t, 'ms; T1 =', r.modal.modes[0].T.toFixed(3), 's; λcr =', r.buckling.C2.modes[0].lam.toFixed(2));
// 17 temperature loads (α = 12e-6 /°C for steel E): uniform ΔT and gradients across depth / width
{
  const al = 12e-6, EA = E * 1e3 * A * 1e-6, hm = h / 1000, bm = b / 1000, SS = () => [N('A', 0, 0, 0, 'custom', { fix: [1, 1, 1, 1, 0, 0] }), N('B', 6, 0, 0, 'custom', { fix: [0, 1, 1, 1, 0, 0] })];
  let m = base(); m.nodes = [N('A', 0, 0, 0, 'fixed'), N('B', 6, 0, 0, 'fixed')]; m.members = [Mb('B1', 'A', 'B')]; m.loads = [{ case: 'G', kind: 'temp', member: 'B1', dT: 30 }];
  let c = run(m).cases.G; P('17 fixed bar, ΔT = 30: N = −EAαΔT', c.mem[0].N[3], -EA * al * 30);
  m.nodes = SS(); c = run(m).cases.G; P('17 sliding end: elongation αΔT·L', c.u[6], al * 30 * 6); P('17 sliding end: N = 0', c.mem[0].N[3], 0);
  m.loads = [{ case: 'G', kind: 'temp', member: 'B1', dTy: 20 }]; c = run(m, { nps: 10 }).cases.G;
  P('17 SS beam, top 20° hotter: midspan rises αΔT·L²/8h', c.mem[0].dz[5], al * 20 * 36 / (8 * hm)); P('17 SS beam gradient: Mz = 0', mx(c.mem[0].Mz.map(Math.abs)), 0);
  m.nodes = [N('A', 0, 0, 0, 'fixed'), N('B', 6, 0, 0, 'fixed')]; c = run(m).cases.G;
  P('17 fixed beam gradient: Mz = EIz·αΔT/h', c.mem[0].Mz[5], EIz * al * 20 / hm); P('17 fixed beam gradient: no deflection', mx(c.mem[0].dz.map(Math.abs)), 0);
  m.nodes = SS(); m.loads = [{ case: 'G', kind: 'temp', member: 'B1', dTz: 20 }]; c = run(m).cases.G;
  P('17 SS beam, +z face hotter: lateral αΔT·L²/8b (local z = −Y)', -c.mem[0].dy[5], al * 20 * 36 / (8 * bm));
  m.nodes = [N('A', 0, 0, 0, 'fixed'), N('B', 6, 0, 0, 'fixed'), N('C', 6, 0, -4, 'fixed')]; m.members = [Mb('B1', 'A', 'B'), Mb('C1', 'C', 'B')]; m.loads = [{ case: 'G', kind: 'temp', member: 'B1', dT: 25 }, { case: 'G', kind: 'temp', member: 'B1', dTy: 10 }];
  c = run(m).cases.G; P('17 frame: thermal loads are self-equilibrating (ΣRx)', sumR(c, 0), 0); P('17 frame: ΣRz', sumR(c, 2), 0);
  m.materials[0].alpha = 10; m.nodes = [N('A', 0, 0, 0, 'fixed'), N('B', 6, 0, 0, 'fixed')]; m.members = [Mb('B1', 'A', 'B')]; m.loads = [{ case: 'G', kind: 'temp', member: 'B1', dT: -20 }]; m.combos = [{ id: 'C1', name: '1.5', type: 'ULS', f: { G: 1.5 } }];
  P('17 material α = 10e-6, cooling 20°, factor 1.5: N = +1.5·EAαΔT', run(m).combos.C1.mem[0].N[2], 1.5 * EA * 10e-6 * 20);
}
// 18 support settlement, prestress and influence lines
{
  const SS2 = () => [N('A', 0, 0, 0, 'custom', { fix: [1, 1, 1, 1, 0, 0] }), N('B', 6, 0, 0, 'custom', { fix: [0, 1, 1, 1, 0, 0] }), N('C', 12, 0, 0, 'custom', { fix: [0, 1, 1, 1, 0, 0] })];
  let m = base(); m.nodes = SS2(); m.members = [Mb('B1', 'A', 'B'), Mb('B2', 'B', 'C')];
  const D = 0.01, Ls = 6; m.loads = [{ case: 'G', kind: 'settle', node: 'B', dz: -D }];
  let c = run(m).cases.G;
  P('18 middle support settles 10 mm: M_B = 3EIΔ/L²', c.mem[0].Mz[c.mem[0].Mz.length - 1], 3 * EIz * D / Ls ** 2);
  P('18 settlement: R_B = −6EIΔ/L³', c.R[6 * 1 + 2], -6 * EIz * D / Ls ** 3); P('18 settlement: ΣRz = 0', c.R[2] + c.R[8] + c.R[14], 0); P('18 settled node moves 10 mm', c.u[6 * 1 + 2], -D);
  m.combos = [{ id: 'C1', name: '1.5', type: 'ULS', f: { G: 1.5 } }]; P('18 settlement × 1.5 in a combination', run(m).combos.C1.mem[0].Mz[20], 1.5 * 3 * EIz * D / Ls ** 2);
  // prestress
  const SS = () => [N('A', 0, 0, 0, 'custom', { fix: [1, 1, 1, 1, 0, 0] }), N('B', 10, 0, 0, 'custom', { fix: [0, 1, 1, 1, 0, 0] })];
  m = base(); m.nodes = SS(); m.members = [Mb('B1', 'A', 'B')]; m.loads = [{ case: 'G', kind: 'pres', member: 'B1', P: 1000, e1: 200, em: 200, e2: 200 }];
  c = run(m).cases.G;
  P('18 straight tendon 200 mm below centroid: Mz = −P·e', c.mem[0].Mz[10], -200); P('18 straight tendon: N = −P', c.mem[0].N[10], -1000);
  P('18 straight tendon camber = P·e·L²/8EI (up)', c.mem[0].dz[10], 200 * 100 / 8 / EIz); P('18 straight tendon: no vertical reactions', Math.abs(c.R[2]) + Math.abs(c.R[8]), 0);
  m.loads = [{ case: 'G', kind: 'pres', member: 'B1', P: 1000, e1: 0, em: 300, e2: 0 }]; c = run(m).cases.G;
  P('18 parabolic tendon (sag 300 mm): midspan Mz = −P·e', c.mem[0].Mz[10], -300); P('18 parabolic tendon: end Mz = 0', c.mem[0].Mz[0], 0);
  P('18 parabolic tendon: self-equilibrating (Rz)', Math.abs(c.R[2]) + Math.abs(c.R[8]), 0);
  // influence lines
  m = base(); m.nodes = SS(); m.members = [Mb('B1', 'A', 'B')];
  const inf = F.influence(m, { paths: [{ id: 'P1', mems: ['B1'] }], ds: 0.5, nps: 10 }), pa = inf.paths.P1, np = 11, at = (k, comp, pt) => pa.data[k * 1 * 7 * np + inf.comps.indexOf(comp) * np + pt];
  P('18 IL: unit load at midspan → Mz(mid) = L/4', at(10, 'Mz', 5), 2.5); P('18 IL: unit load at 2.5 m → Mz(mid) = 1.25', at(5, 'Mz', 5), 1.25);
  P('18 IL: reaction A for load at 2.5 m = 0.75', pa.R[5 * inf.nd + 2], 0.75);
  m.nodes = SS2(); m.members = [Mb('B1', 'A', 'B'), Mb('B2', 'B', 'C')];
  const i2 = F.influence(m, { paths: [{ id: 'P', mems: ['B2', 'B1'] }], ds: 0.5 }), p2 = i2.paths.P;
  P('18 IL along a reversed path: total length', p2.L, 12); P('18 IL two-span: R_B for load over B = 1', p2.R[12 * i2.nd + 8], 1);
  P('18 IL two-span: R_B for load at 3 m in span 1 = 0.6875', p2.R[18 * i2.nd + 8], 0.6875);
}
// 16 standard steel sections (properties computed from dimensions) against published tables
require(require('path').join(__dirname, '..', 'steelsec.js')); const SL = globalThis.STEELLIB;
[['UB', '310UB40.4', 5210, 86.4e6, 7.65e6, 157e3], ['IPE', 'IPE 300', 5381, 83.56e6, 6.038e6, 201.2e3], ['HEB', 'HEB 300', 14910, 251.7e6, 85.63e6, 1850e3], ['H', 'H 300×150', 4678, 72.1e6, 5.08e6, null]].forEach(([sr, nm, A0, Iz0, Iy0, J0]) => {
  const p = SL.find(sr, nm); P('16 ' + nm + ' A', p.A, A0, 0.01); P('16 ' + nm + ' Iz', p.Iz, Iz0, 0.01); P('16 ' + nm + ' Iy', p.Iy, Iy0, 0.01); if (J0) P('16 ' + nm + ' J', p.J, J0, 0.03);
});
console.log(bad ? bad + ' check(s) FAILED' : 'all checks passed');
process.exitCode = bad ? 1 : 0;
