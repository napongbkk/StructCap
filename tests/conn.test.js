// StructCap steel connection module — geometry, component method, plate FE (CBFEM).
// Run: node tests/conn.test.js
const path = require('path');
['engine.js', 'steelsec.js', 'gantry.js', 'conn.js', 'conncheck.js', 'connfe.js'].forEach(f => require(path.join(__dirname, '..', f)));
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
console.log(bad ? bad + ' FAILED' : 'all passed'); process.exit(bad ? 1 : 0);
