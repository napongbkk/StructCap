require(require('path').join(__dirname, '..', 'frame.js')); const F = globalThis.FRAME;
const E = 200000, b = 200, h = 400, I = b*h**3/12, A = b*h, EI = E*1e3*I*1e-12;
const base = () => ({ sections: [{ id: 'S1', type: 'rect', b, h }], materials: [{ id: 'M1', E, rho: 0 }], cases: [{ id: 'G', name: 'G', sw: false }], combos: [{ id: 'C1', name: '1.0G', type: 'ULS', f: { G: 1 } }], loads: [] });
const near = (a, b, tol = 0.005) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)) ? 'OK ' : 'BAD';
const mx = a => Math.max(...a), mn = a => Math.min(...a);
const P = (lbl, got, exp, tol) => console.log(near(got, exp, tol), lbl.padEnd(46), (+got).toFixed(4), 'expected', (+exp).toFixed(4));
// 1 simply supported UDL
let m = base(); m.nodes = [{ id: 'N1', x: 0, y: 0, sup: 'pin' }, { id: 'N2', x: 6, y: 0, sup: 'rollerX' }]; m.members = [{ id: 'B1', i: 'N1', j: 'N2', sec: 'S1', mat: 'M1' }];
m.loads = [{ case: 'G', kind: 'udl', member: 'B1', dir: 'gy', w1: -10 }];
let r = F.analyse(m), c = r.cases.G;
P('SS UDL Mmax = wL2/8', mx(c.mem[0].M), 45); P('SS UDL R1 = 30', c.R[1], 30); P('SS UDL defl 5wL4/384EI', -mn(c.mem[0].dy), 5*10*6**4/384/EI);
// 2 fixed-fixed
m.nodes[0].sup = 'fixed'; m.nodes[1].sup = 'fixed'; r = F.analyse(m); c = r.cases.G;
P('FF UDL end M = -wL2/12', c.mem[0].M[0], -30); P('FF UDL mid M = wL2/24', c.mem[0].M[10], 15); P('FF defl wL4/384EI', -mn(c.mem[0].dy), 10*6**4/384/EI);
// 3 hinge at j -> propped cantilever
m.members[0].relJ = true; r = F.analyse(m); c = r.cases.G;
P('Propped (release J) fixed M = -wL2/8', c.mem[0].M[0], -45); P('Propped M at hinge = 0', c.mem[0].M[20], 0);
delete m.members[0].relJ;
// 4 cantilever tip load
m = base(); m.nodes = [{ id: 'N1', x: 0, y: 0, sup: 'fixed' }, { id: 'N2', x: 3, y: 0 }]; m.members = [{ id: 'B1', i: 'N1', j: 'N2', sec: 'S1', mat: 'M1' }];
m.loads = [{ case: 'G', kind: 'node', node: 'N2', Fy: -10 }]; r = F.analyse(m); c = r.cases.G;
P('Cantilever M fixed = -PL', c.mem[0].M[0], -30); P('Cantilever tip defl PL3/3EI', -c.u[4], 10*27/3/EI);
// 5 SS point load mid inside member
m = base(); m.nodes = [{ id: 'N1', x: 0, y: 0, sup: 'pin' }, { id: 'N2', x: 8, y: 0, sup: 'rollerX' }]; m.members = [{ id: 'B1', i: 'N1', j: 'N2', sec: 'S1', mat: 'M1' }];
m.loads = [{ case: 'G', kind: 'point', member: 'B1', dir: 'gy', P: -20, a: 2 }]; r = F.analyse(m); c = r.cases.G;
P('SS point at a=2 Mmax = Pab/L', mx(c.mem[0].M), 20*2*6/8); P('SS point R1 = Pb/L', c.R[1], 15);
// 6 two-span continuous
m = base(); m.nodes = [{ id: 'N1', x: 0, y: 0, sup: 'pin' }, { id: 'N2', x: 5, y: 0, sup: 'rollerX' }, { id: 'N3', x: 10, y: 0, sup: 'rollerX' }];
m.members = [{ id: 'B1', i: 'N1', j: 'N2', sec: 'S1', mat: 'M1' }, { id: 'B2', i: 'N2', j: 'N3', sec: 'S1', mat: 'M1' }];
m.loads = [{ case: 'G', kind: 'udl', member: 'B1', dir: 'gy', w1: -12 }, { case: 'G', kind: 'udl', member: 'B2', dir: 'gy', w1: -12 }]; r = F.analyse(m); c = r.cases.G;
P('2-span support M = -wL2/8', c.mem[0].M[20], -12*25/8); P('2-span mid reaction 1.25wL', c.R[4], 1.25*12*5);
// 7 inclined member gy load: SS inclined 3-4-5, gyp projected 10 kN/m -> M = w Lh^2/8 (horizontal span 4)
m = base(); m.nodes = [{ id: 'N1', x: 0, y: 0, sup: 'pin' }, { id: 'N2', x: 4, y: 3, sup: 'rollerX' }]; m.members = [{ id: 'B1', i: 'N1', j: 'N2', sec: 'S1', mat: 'M1' }];
m.loads = [{ case: 'G', kind: 'udl', member: 'B1', dir: 'gyp', w1: -10 }]; r = F.analyse(m); c = r.cases.G;
P('Inclined projected UDL Mmax = wLh2/8', mx(c.mem[0].M), 10*16/8); P('Inclined R vertical total', c.R[1] + c.R[4], 40);
// 8 truss triangle: span 4, height 3 apex load 10 down
m = base(); m.nodes = [{ id: 'A', x: 0, y: 0, sup: 'pin' }, { id: 'B', x: 4, y: 0, sup: 'rollerX' }, { id: 'C', x: 2, y: 3 }];
m.members = [{ id: 'T1', i: 'A', j: 'C', sec: 'S1', mat: 'M1', type: 'truss' }, { id: 'T2', i: 'C', j: 'B', sec: 'S1', mat: 'M1', type: 'truss' }, { id: 'T3', i: 'A', j: 'B', sec: 'S1', mat: 'M1', type: 'truss' }];
m.loads = [{ case: 'G', kind: 'node', node: 'C', Fy: -10 }]; r = F.analyse(m); c = r.cases.G;
P('Truss rafter N = -5/sin', c.mem[0].N[0], -5/(3/Math.sqrt(13))); P('Truss tie N = 5 cot', c.mem[2].N[0], 5*2/3);
// 9 portal frame fixed bases, lateral H=10 at beam level, rigid-ish: columns 4 m, beam 6 m same section
m = base(); m.nodes = [{ id: 'A', x: 0, y: 0, sup: 'fixed' }, { id: 'B', x: 0, y: 4 }, { id: 'C', x: 6, y: 4 }, { id: 'D', x: 6, y: 0, sup: 'fixed' }];
m.members = [{ id: 'C1', i: 'A', j: 'B', sec: 'S1', mat: 'M1' }, { id: 'R1', i: 'B', j: 'C', sec: 'S1', mat: 'M1' }, { id: 'C2', i: 'D', j: 'C', sec: 'S1', mat: 'M1' }];
m.loads = [{ case: 'G', kind: 'node', node: 'B', Fx: 10 }]; r = F.analyse(m); c = r.cases.G;
// classical (axially rigid) result: k = (I/h)/(I/L)... base shear split equal 5 each
P('Portal base shears equal', -c.R[0], 5, 0.02); P('Portal sum H', c.R[0] + c.R[9], -10);
// 10 Euler buckling pinned column L=5, P=1 compression
m = base(); m.nodes = [{ id: 'A', x: 0, y: 0, sup: 'pin' }, { id: 'B', x: 0, y: 5, sup: 'rollerY' }]; m.members = [{ id: 'C1', i: 'A', j: 'B', sec: 'S1', mat: 'M1' }];
m.loads = [{ case: 'G', kind: 'node', node: 'B', Fy: -1 }];
r = F.analyse(m, { buckling: true, nseg: 6 }); const Ieff = Math.min(I, h*b**3/12);
P('Euler pinned Pcr = pi2EI/L2 (strong axis)', r.buckling.C1.modes[0].lam, Math.PI**2*EI/25, 0.01);
// 11 P-delta cantilever column L=4 fixed base, P=0.3 Pcr, H=1
m = base(); m.nodes = [{ id: 'A', x: 0, y: 0, sup: 'fixed' }, { id: 'B', x: 0, y: 4 }]; m.members = [{ id: 'C1', i: 'A', j: 'B', sec: 'S1', mat: 'M1' }];
const Pcr = Math.PI**2*EI/(4*16), Pp = 0.3*Pcr;
m.loads = [{ case: 'G', kind: 'node', node: 'B', Fy: -Pp, Fx: 1 }];
const r1 = F.analyse(m), r2 = F.analyse(m, { pdelta: true, nseg: 6 });
const d1 = r1.combos.C1.u[3], d2 = r2.combos.C1.u[3];
const uu = 4*Math.sqrt(Pp/EI);
P('P-Delta amplification = 3(tan u - u)/u^3 (exact)', d2/d1, 3*(Math.tan(uu)-uu)/uu**3, 0.005);
// 12 modal: SS beam with self weight rho
m = base(); m.materials[0].rho = 78.5; m.cases[0].sw = true;
m.nodes = [{ id: 'N1', x: 0, y: 0, sup: 'pin' }, { id: 'N2', x: 6, y: 0, sup: 'rollerX' }]; m.members = [{ id: 'B1', i: 'N1', j: 'N2', sec: 'S1', mat: 'M1' }];
r = F.analyse(m, { modes: 3, nseg: 8 }); const mb = 78.5*A*1e-6/9.81;
const fexp = Math.PI/2/36*Math.sqrt(EI/mb);
console.log('modes', r.modal.modes.map(q => q.f.toFixed(3)).join(', '));
P('Modal f1 SS beam = (pi/2L2) sqrt(EI/m)', r.modal.modes.find(q=>q.my>0.5).f, fexp, 0.01);
console.log('time ms', r.ms);
