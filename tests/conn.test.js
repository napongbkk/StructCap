// StructCap steel connection module — geometry, component method, plate FE (CBFEM).
// Run: node tests/conn.test.js
const path = require('path');
['engine.js', 'steelsec.js', 'gantry.js', 'conn.js', 'conncheck.js', 'connfe.js', 'conn3d.js'].forEach(f => require(path.join(__dirname, '..', f)));
const C = globalThis.CONN, V = C.V;
let bad = 0;
const P = (lbl, got, exp, tol = 0.005) => { const ok = Math.abs(got - exp) <= tol * Math.max(1, Math.abs(exp)); if (!ok) bad++; console.log(ok ? 'OK ' : 'BAD', lbl.padEnd(66), (+got).toFixed(4), 'expected', (+exp).toFixed(4)); };
const T = (lbl, ok) => { if (!ok) bad++; console.log(ok ? 'OK ' : 'BAD', lbl); };

// 1. shell element: cantilever of two collinear built-up I members joined by butt welds, tip load at the joint face
{
  const s = C.dims({ kind: 'BU', d: 300, bf: 150, tf: 12, tw: 8 }), g = { plates: [], bolts: [], welds: [], contacts: [], members: [], anchors: [], conc: null, notes: [] };
  const mk = (id, fr, role, extra) => { const O = [0, 0, 0], m = Object.assign({ id, name: id, s, mat: 'S355', O, fr, s0: 0, s1: 600, plates: [], role }, extra);
    C.secPlates(s).forEach(sp => { const Pp = (yz, x) => V.lin(O, fr.x, x, fr.y, yz[0], fr.z, yz[1]), c = [Pp(sp.a, 0), Pp(sp.a, 600), Pp(sp.b, 600), Pp(sp.b, 0)], u = V.unit(V.sub(c[1], c[0])), n = V.unit(V.cross(V.sub(c[1], c[0]), V.sub(c[3], c[0])));
      const p = { id: id + '.' + sp.tag, name: id, c, t: sp.t, mat: 'S355', u, v: V.cross(n, u), n, o: c[0], role: 'member', mem: id, tag: sp.tag, fy: 355, fu: 490, E: 210000 }; p.loc = p.c.map(q => { const d = V.sub(q, p.o); return [V.dot(d, p.u), V.dot(d, p.v)]; }); p.area = C.polyArea(p.loc); g.plates.push(p); m.plates.push(p.id); });
    g.members.push(m); };
  mk('A', C.frame({ beta: 180 }), 'bearing', { ends: 'far' }); mk('B', C.frame({ beta: 0 }), 'connected', { loaded: true });
  ['tf', 'bf', 'w'].forEach(t => { const pa = g.plates.find(p => p.id === 'A.' + t); g.welds.push({ id: 'W' + t, a: 'B.' + t, b: 'A.' + t, p0: pa.c[0], p1: pa.c[3], L: V.len(V.sub(pa.c[3], pa.c[0])), a_: 10, sides: 2, type: 'butt' }); });
  const J = { code: 'EN', fe: { mesh: 'normal' }, mat: { steel: 'S355', weld: 'match' } }, Pz = 20000;
  const r = C.fe.run(J, g, { N: 0, Vy: 0, Vz: Pz / 1e3, Mx: 0, My: 0, Mz: 0 }, { steps: 1 });
  T('cantilever model solves', r.ok);
  if (r.ok) { const m = r.masters.find(q => q.m === 'B'), uz = m.nodes.reduce((a, i) => a + r.u[6 * i + 2], 0) / m.nodes.length;
    // reference: shell result before the solver changes, consistent with beam theory incl. the moment applied at the far end
    P('cantilever tip deflection vs. reference (mm)', uz, -0.279, 0.04); }
}

// 2. every joint type and code builds, checks and runs the FE with sensible utilisations
for (const code of ['AS', 'EN', 'AISC']) for (const t of C.TYPE_ORDER) {
  const J = C.newJoint(t, code), g = C.build(J), l = J.loads[0], cm = C.check(J, g, l);
  T(`${code} ${t}: geometry (${g.plates.length} plates, ${g.bolts.length} bolts, ${g.welds.length} welds)`, g.plates.length > 2 && (g.bolts.length + g.welds.length) > 0);
  T(`${code} ${t}: component method utilisation ${cm.util.toFixed(2)} in 0.2 … 1.05`, cm.util > 0.2 && cm.util < 1.05);
  if (code === 'EN' || process.argv.includes('--all')) {
    const r = C.fe.run(J, g, l);
    T(`${code} ${t}: FE ok and converged (${r.ok ? r.ndof + ' DOF, ' + r.ms + ' ms' : r.err})`, r.ok && r.conv);
    if (r.ok) { const ch = C.fe.checks(J, g, r, l), w = Math.max(...ch.map(c => c.util)); T(`${code} ${t}: CBFEM utilisation ${w.toFixed(2)} in 0.2 … 1.1`, w > 0.2 && w < 1.1); }
  }
}

// 3. bolts in tension under hogging in a moment end plate; bottom bolts unloaded in tension
{
  const J = C.newJoint('ep', 'EN'), g = C.build(J), r = C.fe.run(J, g, J.loads[0]);
  const top = r.bolts.filter(b => b.b.p[2] > 0), bot = r.bolts.filter(b => b.b.p[2] < -100);
  T('end plate: top bolts in tension', top.every(b => b.Nt > 20e3));
  T('end plate: bottom bolts not in tension', bot.every(b => b.Nt < 5e3));
  const V = r.bolts.reduce((a, b) => a + b.V, 0); P('end plate: bolt shear sum ≈ V_Ed (kN)', V / 1e3, 150, 0.25);
}

// 4. base plate: concrete takes the compression, anchors stay unloaded in pure compression
{
  const J = C.newJoint('base', 'EN'); J.loads = [{ id: 'C', name: 'axial', N: -800, Vy: 0, Vz: 0, Mx: 0, My: 0, Mz: 0 }];
  const g = C.build(J), r = C.fe.run(J, g, J.loads[0]);
  T('base plate: solves', r.ok && r.conv);
  if (r.ok) { P('base plate: concrete force = N (kN)', r.conc.force / 1e3, 800, 0.03); T('base plate: anchors carry no tension', r.anchors.every(a => a.Nt < 1e3)); }
}
// 5. setting out and parts added in the workspace
{
  const base = C.newJoint('ep', 'EN'); base.fe = { mesh: 'coarse' };
  const g0 = C.build(base), r0 = C.fe.run(base, g0, base.loads[0]), u0 = Math.max(...C.fe.checks(base, g0, r0, base.loads[0]).map(c => c.util));
  const J = JSON.parse(JSON.stringify(base)); J.so = { dy: 5, dz: 0 };
  const g = C.build(J), r = C.fe.run(J, g, J.loads[0]), u = Math.max(...C.fe.checks(J, g, r, J.loads[0]).map(c => c.util));
  T('setting out: 5 mm offset moves the end plate by 5 mm', Math.abs(g.plates.find(p => p.id === 'EP').c[0][1] - g0.plates.find(p => p.id === 'EP').c[0][1] - 5) < 1e-9);
  T('setting out: column does not move', JSON.stringify(g.plates.find(p => p.id === 'C.tf').c) === JSON.stringify(g0.plates.find(p => p.id === 'C.tf').c));
  P('setting out: 5 mm offset changes the governing utilisation only slightly', u, u0, 0.03);
  const Jw = JSON.parse(JSON.stringify(base)); Jw.so = { dy: 200 }; T('setting out beyond the flange is flagged', C.build(Jw).notes.some(n => n.bad));
  const col = C.dims(base.mem.col), Jo = JSON.parse(JSON.stringify(base));
  Jo.ops = [{ id: 'UP1', kind: 'plate', o: [0, 56, 600], u: [1, 0, 0], v: [0, 1, 0], w: 200, h: 100, t: 12 }];
  T('unconnected plate is left out of the analysis', C.build(Jo).floating.plates.length === 1);
  Jo.ops.push({ id: 'UW1', kind: 'weld', a: 'UP1', b: 'C.w', a_: 6 });
  const go = C.build(Jo), ro = C.fe.run(Jo, go, Jo.loads[0]);
  T('welded plate: weld found along the web', go.welds.some(w => w.id === 'UW1') && !go.floating.plates.length);
  T('welded plate: FE solves and checks the weld', ro.ok && C.fe.checks(Jo, go, ro, Jo.loads[0]).some(c => c.item === 'UW1'));
  const Jb = JSON.parse(JSON.stringify(base)); Jb.ops = [{ id: 'UB1', kind: 'bolts', host: 'EP', o: [col.d / 2 + 10, 0, -150], dir: [0, 0, 1], nr: 1, nc: 2, p: 80, gg: 150, size: 'M20' }];
  const gb = C.build(Jb); T('bolt group passes through the end plate and the column flange', gb.bolts.filter(b => b.user).length === 2 && gb.bolts.filter(b => b.user).every(b => b.stack.join() === 'C.tf,EP'));
  const Jm = JSON.parse(JSON.stringify(base)); Jm.ops = [{ id: 'UM1', kind: 'member', sec: { kind: 'SHS', size: '100x100x6' }, o: [-col.d / 2, 0, 300], x: [-1, 0, 0], roll: 0, L: 500, end: 'free' }, { id: 'UW2', kind: 'weld', a: 'M:UM1', b: 'C.bf', a_: 5 }];
  const gm = C.build(Jm), rm = C.fe.run(Jm, gm, Jm.loads[0]); T('added member welded all round (4 walls) and solves', gm.welds.filter(w => w.user === 'UW2').length === 4 && rm.ok);
}
// 6. 3D view: every joint type gives a closed mesh, and a ray finds the part in front
{
  const R3 = globalThis.CONN3D, pal = { edge: [0, 0, 0], edgeM: [0, 0, 0], mem: [1, 1, 1], pl: [1, 1, 1], st: [1, 1, 1], bolt: [1, 1, 1], weld: [1, 1, 1], selRGB: [1, 1, 1], user: [1, 1, 1], userMem: [1, 1, 1], float: [1, 1, 1], conc: [1, 1, 1], grout: [1, 1, 1] };
  T('3D mesh for all joint types', C.TYPE_ORDER.every(t => { const g = C.build(C.newJoint(t, 'EN')), M = R3.meshOf(g, { pal, lay: {} }); return M.p.length > 900 && M.p.every(Number.isFinite) && M.lp.length > 0; }));
  const J = C.newJoint('ep', 'EN'), g = C.build(J), col = C.dims(J.mem.col);
  const h = R3.raycast(g, [2000, 80, -100], [-1, 0, 0], { parts: false }); T('ray from the beam side hits the end plate before the column', h && h.key === 'pl:EP' && Math.abs(h.x[0] - (col.d / 2 + J.p.tp)) < 1);
  const hb = R3.raycast(g, [2000, g.bolts[0].p[1], g.bolts[0].p[2]], [-1, 0, 0]); T('ray along a bolt axis picks the bolt', hb && hb.key === 'b:' + g.bolts[0].id);
  J.ops = [{ id: 'US1', kind: 'plate', o: [0, -66, 520], u: [1, 0, 0], v: [0, -1, 0], w: 160, h: 120, t: 10 }, { id: 'UW1', kind: 'weld', a: 'US1', b: 'C.w', a_: 6, sides: 2 }];
  const gu = C.build(J), hu = R3.raycast(gu, [0, -66, 2000], [0, 0, -1], { parts: false }); T('user plate is picked as u:US1', hu && hu.key === 'u:US1');
}
console.log(bad ? bad + ' FAILED' : 'all passed'); process.exit(bad ? 1 : 0);
