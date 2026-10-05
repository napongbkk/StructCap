/* StructCap Connection — steel joint model (pure, no DOM).
   Codes: AS 4100, EN 1993-1-8, AISC 360 (also used with Thai TIS steels).
   A joint = type + members + parameters + load effects, plus the setting out (J.so) and the parts added in the
   workspace (J.ops: plates, members, welds, bolt groups). build(J) turns it into plates, bolts, welds, contacts
   and supports (geometry for the 3D view and the plate FE model); conncheck.js checks the components; connfe.js
   runs the plate finite-element analysis. Units: N, mm, MPa (loads entered in kN, kNm). */
(function (G) {
  'use strict';
  const PI = Math.PI, sq = Math.sqrt, r3 = v => Math.round(v * 1e3) / 1e3;
  const V = { add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: a => Math.hypot(a[0], a[1], a[2]), unit: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    lin: (o, ...t) => { const r = o.slice(); for (let i = 0; i < t.length; i += 2) { r[0] += t[i][0] * t[i + 1]; r[1] += t[i][1] * t[i + 1]; r[2] += t[i][2] * t[i + 1]; } return r; } };

  // ------------------------------------------------------------------ codes and materials
  const CODES = {
    AS: { name: 'AS 4100', full: 'AS 4100:2020 / AS/NZS 1252', steel: ['250', '300', '350', 'C350L0', 'C450L0'], defSteel: '300', bolts: ['4.6/S', '8.8/S', '8.8/TB'], defBolt: '8.8/S', welds: ['E41XX', 'E48XX'], defWeld: 'E48XX', conc: [25, 32, 40, 50], defConc: 32, anchors: ['4.6/S', '8.8/S'], defAnchor: '4.6/S' },
    EN: { name: 'EN 1993-1-8', full: 'EN 1993-1-8:2005 (component method) / EN 1992-4', steel: ['S235', 'S275', 'S355', 'S460'], defSteel: 'S355', bolts: ['4.6', '5.6', '8.8', '10.9'], defBolt: '8.8', welds: ['match'], defWeld: 'match', conc: [20, 25, 30, 35, 40], defConc: 25, anchors: ['4.6', '8.8'], defAnchor: '8.8' },
    AISC: { name: 'AISC 360', full: 'AISC 360-16 LRFD / ACI 318-19 Ch. 17 (Thai: TIS steels)', steel: ['A36', 'A572-50', 'A992', 'SS400', 'SM490', 'SM520', 'A500C'], defSteel: 'A572-50', bolts: ['A307', 'A325', 'A490'], defBolt: 'A325', welds: ['E70XX', 'E60XX'], defWeld: 'E70XX', conc: [21, 24, 28, 32, 35], defConc: 28, anchors: ['F1554-36', 'F1554-55', 'F1554-105'], defAnchor: 'F1554-36' }
  };
  // yield / tensile strength of a plate or section of thickness t (mm)
  function steel(grade, t) {
    t = +t || 10;
    switch (grade) {
      case '250': return { fy: t <= 8 ? 280 : t <= 12 ? 260 : 250, fu: 410, E: 200000 };
      case '300': return { fy: t <= 8 ? 320 : t <= 12 ? 310 : t <= 20 ? 300 : 280, fu: 430, E: 200000 };
      case '350': return { fy: t <= 12 ? 360 : t <= 20 ? 350 : 340, fu: 450, E: 200000 };
      case 'C350L0': return { fy: 350, fu: 430, E: 200000 };
      case 'C450L0': return { fy: 450, fu: 500, E: 200000 };
      case 'S235': return { fy: t <= 40 ? 235 : 215, fu: 360, E: 210000, bw: 0.8 };
      case 'S275': return { fy: t <= 40 ? 275 : 255, fu: 430, E: 210000, bw: 0.85 };
      case 'S355': return { fy: t <= 40 ? 355 : 335, fu: 490, E: 210000, bw: 0.9 };
      case 'S460': return { fy: t <= 40 ? 460 : 430, fu: 540, E: 210000, bw: 1.0 };
      case 'A36': return { fy: 250, fu: 400, E: 200000 };
      case 'A572-50': case 'A992': return { fy: 345, fu: 450, E: 200000 };
      case 'SS400': return { fy: t <= 16 ? 245 : t <= 40 ? 235 : 215, fu: 400, E: 200000 };
      case 'SM490': return { fy: t <= 16 ? 325 : t <= 40 ? 315 : 295, fu: 490, E: 200000 };
      case 'SM520': return { fy: t <= 16 ? 365 : t <= 40 ? 355 : 335, fu: 520, E: 200000 };
      case 'A500C': return { fy: 345, fu: 427, E: 200000 };
      default: return { fy: 300, fu: 440, E: 200000 };
    }
  }
  // bolt sizes: [d, As (tensile stress area), Ac (core area, AS), s (across flats of head / nut)]
  const BSIZE = { M12: [12, 84.3, 76.2, 18], M16: [16, 157, 144, 24], M20: [20, 245, 225, 30], M22: [22, 303, 282, 34], M24: [24, 353, 324, 36], M27: [27, 459, 427, 41], M30: [30, 561, 519, 46], M36: [36, 817, 759, 55] };
  function bolt(code, grade, size) {
    const z = BSIZE[size] || BSIZE.M20, d = z[0], o = { size, d, As: z[1], Ac: z[2], Ao: PI * d * d / 4, s: z[3], d0: d + (d <= 24 ? 2 : 3), grade };
    if (code === 'AS') { o.fu = /^4\.6/.test(grade) ? 400 : 830; o.fy = /^4\.6/.test(grade) ? 240 : 660; }
    else if (code === 'EN') { const t = { '4.6': [240, 400], '5.6': [300, 500], '8.8': [640, 800], '10.9': [900, 1000] }[grade] || [640, 800]; o.fy = t[0]; o.fu = t[1]; }
    else { const t = { A307: [310, 188, 188, 414], A325: [620, 372, 469, 825], A490: [780, 469, 579, 1035] }[grade] || [620, 372, 469, 825]; o.Fnt = t[0]; o.FnvN = t[1]; o.FnvX = t[2]; o.fu = t[3]; o.fy = 0.8 * t[3]; }
    return o;
  }
  // anchor rods (same data as bolts; AISC F1554 grades)
  function anchor(code, grade, size) {
    const b = bolt(code, code === 'AISC' ? 'A325' : grade, size);
    if (code === 'AISC') { const fu = { 'F1554-36': 400, 'F1554-55': 517, 'F1554-105': 862 }[grade] || 400; b.fu = fu; b.fy = { 'F1554-36': 248, 'F1554-55': 380, 'F1554-105': 724 }[grade] || 248; b.Fnt = 0.75 * fu; b.FnvN = 0.45 * fu; b.FnvX = 0.563 * fu; }
    b.grade = grade; return b;
  }
  function weldMetal(code, grade, plateFu) { if (code === 'EN') return { fu: plateFu, label: 'matching' }; if (code === 'AS') return { fu: grade === 'E41XX' ? 410 : 480, label: grade }; return { fu: grade === 'E60XX' ? 414 : 482, label: grade }; }

  // ------------------------------------------------------------------ sections
  const SL = () => G.STEELLIB, GT = () => G.GANTRY;
  // sec: { kind: 'I', lib, size } | { kind: 'BU', d, bf, tf, bf2, tf2, tw } | { kind: 'SHS'|'RHS'|'CHS', size } | { kind: 'L', b1, b2, t }
  function dims(sec) {
    sec = sec || {};
    if (sec.kind === 'I') { const p = SL() && SL().find(sec.lib, sec.size); if (p) return { kind: 'I', name: sec.size, d: p.d, bf: p.bf, tf: p.tf, bf2: p.bf, tf2: p.tf, tw: p.tw, r: p.r, A: p.A, Iy: p.Iz, Iz: p.Iy }; }
    if (sec.kind === 'BU' || sec.kind === 'I') { const d = +sec.d || 400, bf = +sec.bf || 200, tf = +sec.tf || 16, bf2 = +sec.bf2 || bf, tf2 = +sec.tf2 || tf, tw = +sec.tw || 10, hw = d - tf - tf2; const A = bf * tf + bf2 * tf2 + hw * tw, zc = (bf * tf * (d - tf / 2) + bf2 * tf2 * tf2 / 2 + hw * tw * (tf2 + hw / 2)) / A; const Iy = bf * tf ** 3 / 12 + bf * tf * (d - tf / 2 - zc) ** 2 + bf2 * tf2 ** 3 / 12 + bf2 * tf2 * (tf2 / 2 - zc) ** 2 + tw * hw ** 3 / 12 + hw * tw * (tf2 + hw / 2 - zc) ** 2; return { kind: 'BU', name: sec.name || ('BU ' + d + '×' + bf + '×' + tf + '/' + tw), d, bf, tf, bf2, tf2, tw, r: 0, A, Iy, Iz: (tf * bf ** 3 + tf2 * bf2 ** 3 + hw * tw ** 3) / 12 }; }
    if (sec.kind === 'SHS' || sec.kind === 'RHS' || sec.kind === 'CHS') { const s = GT().section(sec.kind, sec.size || (sec.kind === 'CHS' ? '219.1x8.2' : sec.kind === 'SHS' ? '200x200x9' : '300x200x10'), 'C350L0'); return { kind: sec.kind, name: s.label, D: s.D, B: s.B, t: s.t, d: s.D, bf: s.B, A: s.A, Iy: s.Ix, Iz: s.Iy, ro: s.ro || 0 }; }
    if (sec.kind === 'L') { const b1 = +sec.b1 || 100, b2 = +sec.b2 || b1, t = +sec.t || 10; return { kind: 'L', name: 'L ' + b1 + '×' + b2 + '×' + t, b1, b2, t, d: b1, bf: b2, A: (b1 + b2 - t) * t }; }
    return dims({ kind: 'BU' });
  }
  // the mid-surface plates of a section in its own (y, z) plane: [{ a:[y,z], b:[y,z], t, tag }]
  function secPlates(s) {
    if (s.kind === 'I' || s.kind === 'BU') { const zt = s.d / 2 - s.tf / 2, zb = -(s.d / 2 - s.tf2 / 2); return [{ a: [-s.bf / 2, zt], b: [s.bf / 2, zt], t: s.tf, tag: 'tf', mid: [0, zt] }, { a: [-s.bf2 / 2, zb], b: [s.bf2 / 2, zb], t: s.tf2, tag: 'bf', mid: [0, zb] }, { a: [0, zb], b: [0, zt], t: s.tw, tag: 'w' }]; }
    if (s.kind === 'SHS' || s.kind === 'RHS') { const y = (s.B - s.t) / 2, z = (s.D - s.t) / 2; return [{ a: [-y, z], b: [y, z], t: s.t, tag: 'tf', mid: [0, z] }, { a: [-y, -z], b: [y, -z], t: s.t, tag: 'bf', mid: [0, -z] }, { a: [-y, -z], b: [-y, z], t: s.t, tag: 'w1', mid: [-y, 0] }, { a: [y, -z], b: [y, z], t: s.t, tag: 'w2', mid: [y, 0] }]; }
    if (s.kind === 'CHS') { const R = (s.D - s.t) / 2, n = 16, out = []; for (let k = 0; k < n; k++) { const a0 = 2 * PI * k / n, a1 = 2 * PI * (k + 1) / n; out.push({ a: [R * Math.cos(a0), R * Math.sin(a0)], b: [R * Math.cos(a1), R * Math.sin(a1)], t: s.t, tag: 'f' + k }); } return out; }
    if (s.kind === 'L') { return [{ a: [0, 0], b: [0, s.b1 - s.t / 2], t: s.t, tag: 'l1' }, { a: [0, 0], b: [s.b2 - s.t / 2, 0], t: s.t, tag: 'l2' }]; }
    return [];
  }
  // member frame: x along the member (away from the joint), z = section "up" (web), y = z × x
  function frame(dir) {
    const b = (+dir.beta || 0) * PI / 180, g = (+dir.gamma || 0) * PI / 180, a = (+dir.alpha || 0) * PI / 180;
    const x = [Math.cos(g) * Math.cos(b), Math.cos(g) * Math.sin(b), Math.sin(g)];
    let z = Math.abs(x[2]) > 0.999 ? [Math.cos(b), Math.sin(b), 0] : V.unit(V.sub([0, 0, 1], V.mul(x, x[2])));
    let y = V.cross(z, x);
    if (a) { const c = Math.cos(a), s = Math.sin(a), z2 = V.add(V.mul(z, c), V.mul(y, -s)), y2 = V.add(V.mul(y, c), V.mul(z, s)); z = z2; y = y2; }
    return { x, y: V.unit(y), z: V.unit(z) };
  }

  // ------------------------------------------------------------------ geometry container
  function Geo() { return { plates: [], bolts: [], welds: [], contacts: [], members: [], conc: null, anchors: [], notes: [], dims: [] }; }
  // a flat quadrilateral plate: corners c[4] (3D, counter-clockwise seen from n), thickness, material, role
  function plate(g, id, name, c, t, mat, o) { const u = V.unit(V.sub(c[1], c[0])), n0 = V.cross(V.sub(c[1], c[0]), V.sub(c[3], c[0])), n = V.unit(n0), v = V.cross(n, u); const p = Object.assign({ id, name, c, t, mat, u, v, n, o: c[0], role: 'plate', hu: [], hv: [] }, o || {}); g.plates.push(p); return p; }
  const rectPlate = (g, id, name, o, ax1, ax2, w1, w2, t, mat, opt) => plate(g, id, name, [V.lin(o, ax1, -w1 / 2, ax2, -w2 / 2), V.lin(o, ax1, w1 / 2, ax2, -w2 / 2), V.lin(o, ax1, w1 / 2, ax2, w2 / 2), V.lin(o, ax1, -w1 / 2, ax2, w2 / 2)], t, mat, opt);
  // member: section plates extruded from s0 to s1 along x from origin O
  function member(g, id, name, s, mat, O, fr, s0, s1, o) {
    const m = Object.assign({ id, name, s, mat, O, fr, s0, s1, plates: [], role: 'connected' }, o || {}), P = (yz, x) => V.lin(O, fr.x, x, fr.y, yz[0], fr.z, yz[1]);
    secPlates(s).forEach(sp => { const p = plate(g, id + '.' + sp.tag, name + ' ' + sp.tag, [P(sp.a, s0), P(sp.a, s1), P(sp.b, s1), P(sp.b, s0)], sp.t, mat, { role: 'member', mem: id, tag: sp.tag }); m.plates.push(p.id); });
    g.members.push(m); return m;
  }
  const pt = (m, x, y, z) => V.lin(m.O, m.fr.x, x, m.fr.y, y, m.fr.z, z);
  // bolt through a stack of plates, axis = normal of the first plate
  function boltAt(g, id, p, axis, stack, B, o) { g.bolts.push(Object.assign({ id, p, axis: V.unit(axis), stack, d: B.d, B }, o || {})); }
  // weld of edge plate a along a line (p0 → p1) onto face plate b
  function weld(g, id, a, b, p0, p1, thr, o) { g.welds.push(Object.assign({ id, a, b, p0, p1, L: V.len(V.sub(p1, p0)), a_: thr, sides: 2, type: 'fillet' }, o || {})); }

  // ------------------------------------------------------------------ joint types
  const I400 = { kind: 'I' }, defI = (code, w) => code === 'EN' ? { kind: 'I', lib: w === 'col' ? 'HEB' : 'IPE', size: w === 'col' ? 'HEB 300' : 'IPE 400' } : code === 'AISC' ? { kind: 'I', lib: 'H', size: w === 'col' ? 'H 350×350' : 'H 400×200' } : { kind: 'I', lib: w === 'col' ? 'UC' : 'UB', size: w === 'col' ? '310UC118' : '410UB59.7' };
  const TYPES = {
    ep: { n: ['Beam–column moment end plate', 'แผ่นปลายคานรับโมเมนต์'], g: 'moment', mem: ['col', 'beam'], p: { ext: 'top', tp: 20, bp: 0, ex: 90, bolt: 'M24', g: 120, rows: 'auto', pitch: 90, ninner: 1, af: 10, aw: 6, stiff: true, ts: 12 } },
    wld: { n: ['Welded beam–column / tube joint', 'รอยต่อเชื่อมคาน–เสา / ท่อ'], g: 'moment', mem: ['col', 'beam'], p: { af: 12, aw: 8, butt: false, stiff: true, ts: 12, ang: 90 } },
    fin: { n: ['Fin plate (shear tab)', 'แผ่นครีบรับแรงเฉือน'], g: 'shear', mem: ['col', 'beam'], p: { to: 'flange', tp: 10, hp: 0, gap: 15, e: 60, e2: 40, bolt: 'M20', n: 4, pitch: 70, a: 8 } },
    hdr: { n: ['Flexible end plate (header)', 'แผ่นปลายรับแรงเฉือน'], g: 'shear', mem: ['col', 'beam'], p: { tp: 10, bp: 150, hp: 0, g: 90, bolt: 'M20', n: 4, pitch: 70, a: 6 } },
    clt: { n: ['Double angle cleat', 'เหล็กฉากคู่'], g: 'shear', mem: ['col', 'beam'], p: { angle: '90x90x8', hp: 0, gap: 10, bolt: 'M20', n: 3, pitch: 70, g: 110, e: 45 } },
    base: { n: ['Column base plate', 'แผ่นฐานเสา'], g: 'base', mem: ['col'], p: { tp: 30, B: 0, L: 0, na: 4, bolt: 'M24', ex: 60, ey: 60, hef: 400, grout: 30, pedB: 0, pedL: 0, a: 8, stiff: false, ts: 12 } },
    spl: { n: ['Bolted cover-plate splice', 'รอยต่อทาบด้วยแผ่นประกบ'], g: 'splice', mem: ['beam'], p: { gap: 10, tfp: 20, bfp: 0, nf: 4, pf: 75, gf: 0, twp: 10, hwp: 0, nw: 4, pw: 70, cw: 2, pc: 70, bolt: 'M20' } },
    spe: { n: ['End-plate splice (I / tube)', 'รอยต่อแผ่นปลาย (I / ท่อ)'], g: 'splice', mem: ['beam'], p: { tp: 20, ext: 70, bolt: 'M20', nb: 0, a: 8 } },
    gus: { n: ['Brace to gusset plate', 'ค้ำยันกับแผ่นประกับ (กัสเซ็ท)'], g: 'brace', mem: ['beam', 'brace'], p: { theta: 45, tg: 12, Lw: 200, a: 6, Lg: 0, Hg: 0, bolt: 'M20', nb: 3, pb: 70 } }
  };
  const TYPE_ORDER = ['ep', 'fin', 'hdr', 'clt', 'wld', 'base', 'spl', 'spe', 'gus'];
  // a new joint of a type with sensible defaults for the code
  function newJoint(type, code) {
    code = CODES[code] ? code : 'EN'; const T = TYPES[type] || TYPES.ep, C = CODES[code];
    const J = { type: T === TYPES[type] ? type : 'ep', code, name: T.n[0], mat: { steel: C.defSteel, bolt: C.defBolt, weld: C.defWeld, conc: C.defConc, anchor: C.defAnchor }, p: JSON.parse(JSON.stringify(T.p)), mem: {}, loads: [], fe: { mesh: 'normal' } };
    const col = defI(code, 'col'), beam = defI(code, 'beam');
    if (type === 'base') { J.mem.col = col; J.loads = [{ id: 'LE1', name: 'ULS', N: -800, Vy: 0, Vz: 60, Mx: 0, My: 80, Mz: 0 }]; }
    else if (type === 'spl' || type === 'spe') { J.mem.beam = beam; J.loads = [{ id: 'LE1', name: 'ULS', N: 0, Vy: 0, Vz: 120, Mx: 0, My: type === 'spe' ? 120 : 180, Mz: 0 }]; }
    else if (type === 'gus') { J.mem.beam = beam; J.mem.brace = { kind: 'CHS', size: '168.3x6.4' }; J.loads = [{ id: 'LE1', name: 'ULS tension', N: 450, Vy: 0, Vz: 0, Mx: 0, My: 0, Mz: 0 }, { id: 'LE2', name: 'ULS compression', N: -350, Vy: 0, Vz: 0, Mx: 0, My: 0, Mz: 0 }]; }
    else { J.mem.col = col; J.mem.beam = beam; J.loads = [{ id: 'LE1', name: 'ULS', N: 0, Vy: 0, Vz: type === 'ep' || type === 'wld' ? 150 : 180, Mx: 0, My: type === 'ep' ? 160 : type === 'wld' ? 200 : 0, Mz: 0 }]; }
    return J;
  }

  // ------------------------------------------------------------------ geometry builders (mm)
  const memLen = s => Math.max(400, 2 * (s.d || s.D || 300));
  function build(J) {
    const g = Geo(), C = J.code, P = J.p, M = J.mat, sg = M.steel, b = (sz) => bolt(C, M.bolt, sz || P.bolt);
    g.code = C; g.type = J.type;
    const col = J.mem.col ? dims(J.mem.col) : null, bm = J.mem.beam ? dims(J.mem.beam) : null;
    const colLen = col ? Math.max(memLen(col), 1.6 * ((bm && bm.d) || 300)) : 0;
    const addCol = () => { const fr = { x: [0, 0, 1], y: [0, -1, 0], z: [1, 0, 0] }; return member(g, 'C', 'Column', col, sg, [0, 0, 0], fr, -colLen, colLen, { role: 'bearing', ends: 'both' }); };
    const fX = [1, 0, 0], fY = [0, 1, 0], fZ = [0, 0, 1];
    if (J.type === 'ep' || J.type === 'wld') {
      const tubeJ = J.type === 'wld' && (col.kind === 'RHS' || col.kind === 'SHS' || col.kind === 'CHS' || bm.kind === 'RHS' || bm.kind === 'SHS' || bm.kind === 'CHS');
      const C0 = addCol(), face = col.kind === 'CHS' ? col.D / 2 : col.kind === 'SHS' || col.kind === 'RHS' ? col.D / 2 : col.d / 2;
      const tfc = col.tf || col.t, cfMid = face - tfc / 2, cfId = col.kind === 'CHS' ? null : 'C.tf';
      const bfr = frame({ beta: 0, gamma: J.type === 'wld' ? 90 - (+P.ang || 90) : 0 });
      if (J.type === 'ep') {
        const tp = +P.tp || 20, xe = face + tp / 2, bp = +P.bp || bm.bf + 20, ext = P.ext || 'top', ex = +P.ex || 90;
        const zt = bm.d / 2 + (ext === 'top' || ext === 'both' ? ex : 10), zb = -(bm.d / 2 + (ext === 'both' ? ex : 10));
        const EP = rectPlate(g, 'EP', 'End plate', [xe, 0, (zt + zb) / 2], [0, 1, 0], [0, 0, 1], bp, zt - zb, tp, sg, { op: 'EP' });
        member(g, 'B', 'Beam', bm, sg, [xe, 0, 0], bfr, 0, memLen(bm), { loaded: true });
        const zf = bm.d / 2 - bm.tf / 2, zf2 = -(bm.d / 2 - bm.tf2 / 2);
        weld(g, 'W1', 'B.tf', 'EP', [xe, -bm.bf / 2, zf], [xe, bm.bf / 2, zf], +P.af, { name: 'Top flange' });
        weld(g, 'W2', 'B.bf', 'EP', [xe, -bm.bf2 / 2, zf2], [xe, bm.bf2 / 2, zf2], +P.af, { name: 'Bottom flange' });
        weld(g, 'W3', 'B.w', 'EP', [xe, 0, zf2], [xe, 0, zf], +P.aw, { name: 'Web' });
        const B = b(), gg = +P.g || 100, man = String(P.rows || 'auto').trim();
        let zs = man && man !== 'auto' ? man.split(/[,;\s]+/).map(Number).filter(v => isFinite(v) && v > 0).map(r => zt - r) : null;
        if (!zs || !zs.length) { const pin = +P.pitch || 90, zin = bm.d / 2 - bm.tf - Math.max(45, 1.5 * B.d + 10); zs = []; if (ext === 'top' || ext === 'both') zs.push(bm.d / 2 + ex / 2); for (let k = 0; k < Math.max(1, +P.ninner || 1); k++) zs.push(zin - k * pin); if (ext === 'both') zs.push(-(bm.d / 2 + ex / 2)); zs.push(-zin); }
        zs.forEach((z, i) => [-1, 1].forEach(s => boltAt(g, 'B' + (i + 1) + (s < 0 ? 'a' : 'b'), [xe, s * gg / 2, z], fX, ['EP', cfId], B, { row: i + 1, z })));
        const rows = zs.map(z => zt - z);
        g.contacts.push({ a: 'EP', b: cfId, gap: 0 });
        g.ep = { zt, zb, rows: rows.map(r => zt - r), bp, tp, g: gg };
        if (P.stiff && (col.kind === 'I' || col.kind === 'BU')) addStiff(g, col, [zf, zf2], +P.ts || 12, sg);
      } else if (!tubeJ) {
        const xb = cfMid; member(g, 'B', 'Beam', bm, sg, [xb, 0, 0], bfr, 0, memLen(bm), { loaded: true });
        const zf = bm.d / 2 - bm.tf / 2, zf2 = -(bm.d / 2 - bm.tf2 / 2), kind = P.butt ? 'butt' : 'fillet';
        weld(g, 'W1', 'B.tf', 'C.tf', [xb, -bm.bf / 2, zf], [xb, bm.bf / 2, zf], +P.af, { name: 'Top flange', type: kind });
        weld(g, 'W2', 'B.bf', 'C.tf', [xb, -bm.bf2 / 2, zf2], [xb, bm.bf2 / 2, zf2], +P.af, { name: 'Bottom flange', type: kind });
        weld(g, 'W3', 'B.w', 'C.tf', [xb, 0, zf2], [xb, 0, zf], +P.aw, { name: 'Web', type: kind });
        if (P.stiff && (col.kind === 'I' || col.kind === 'BU')) addStiff(g, col, [zf, zf2], +P.ts || 12, sg);
      } else {
        // tube branch welded to a chord (column): branch walls end on the chord face (RHS) or surface (CHS)
        const ang = (+P.ang || 90) * PI / 180, xb = col.kind === 'CHS' ? sq(Math.max(0, ((col.D - col.t) / 2) ** 2 - ((bm.bf || bm.D) / 2) ** 2)) : cfMid;
        const BR = member(g, 'B', 'Branch', bm, sg, [xb, 0, 0], bfr, 0, memLen(bm), { loaded: true });
        BR.plates.forEach((pid, i) => { const pl = g.plates.find(q => q.id === pid); weld(g, 'W' + (i + 1), pid, col.kind === 'CHS' ? 'C.*' : 'C.tf', pl.c[0], pl.c[3], +P.af, { name: 'Branch wall ' + (i + 1), type: P.butt ? 'butt' : 'fillet' }); });
        g.tube = { chord: col, branch: bm, theta: ang };
      }
      g.load = 'B';
    } else if (J.type === 'fin' || J.type === 'hdr' || J.type === 'clt') {
      const C0 = addCol(), web = J.type === 'fin' && P.to === 'web', B = b();
      // beam frames into the column flange (+X) or the column web (+Y, between the flanges)
      const face = web ? col.tw / 2 : col.d / 2, faceMid = web ? 0 : col.d / 2 - col.tf / 2, faceId = web ? 'C.w' : 'C.tf';
      const ax = web ? fY : fX, lat = web ? [-1, 0, 0] : fY, bfr = web ? frame({ beta: 90 }) : frame({ beta: 0 });
      const P3 = (a, l, z) => V.lin([0, 0, 0], ax, a, lat, l, fZ, z); // along the beam / lateral / vertical
      const n = Math.max(1, +P.n | 0), pitch = +P.pitch || 70, hw = bm.d - bm.tf - bm.tf2 - 2 * ((bm.r || 0) + 10);
      if (J.type === 'fin') {
        const tp = +P.tp || 10, gap = +P.gap || 15, e = +P.e || 60, e2 = +P.e2 || 40, hp = +P.hp || Math.min(hw, (n - 1) * pitch + 2 * 40), y0 = bm.tw / 2 + tp / 2, xs = face + gap;
        const FP = plate(g, 'FP', 'Fin plate', [P3(faceMid, y0, -hp / 2), P3(face + e + e2, y0, -hp / 2), P3(face + e + e2, y0, hp / 2), P3(faceMid, y0, hp / 2)], tp, sg, { op: 'FP' });
        member(g, 'B', 'Beam', bm, sg, P3(xs, 0, 0), bfr, 0, memLen(bm), { loaded: true });
        weld(g, 'W1', 'FP', faceId, P3(faceMid, y0, -hp / 2), P3(faceMid, y0, hp / 2), +P.a, { name: 'Fin plate to column' });
        for (let i = 0; i < n; i++) boltAt(g, 'B' + (i + 1), P3(face + e, y0, ((n - 1) / 2 - i) * pitch), lat, ['FP', 'B.w'], B, { row: i + 1 });
        g.contacts.push({ a: 'FP', b: 'B.w', gap: 0 });
        g.fin = { e, tp, hp, n, pitch, e2, gap, web };
      } else if (J.type === 'hdr') {
        const tp = +P.tp || 10, bp = +P.bp || 150, hp = +P.hp || Math.min(hw, (n - 1) * pitch + 2 * 40), xe = face + tp / 2, gg = +P.g || 90;
        rectPlate(g, 'EP', 'Header plate', P3(xe, 0, 0), lat, fZ, bp, hp, tp, sg, { op: 'EP' });
        member(g, 'B', 'Beam', bm, sg, P3(xe, 0, 0), bfr, 0, memLen(bm), { loaded: true, cope: hp });
        weld(g, 'W1', 'B.w', 'EP', P3(xe, 0, -hp / 2 + 5), P3(xe, 0, hp / 2 - 5), +P.a, { name: 'Web to plate' });
        for (let i = 0; i < n; i++) [-1, 1].forEach(s => boltAt(g, 'B' + (i + 1) + (s < 0 ? 'a' : 'b'), P3(xe, s * gg / 2, ((n - 1) / 2 - i) * pitch), ax, ['EP', faceId], B, { row: i + 1 }));
        g.contacts.push({ a: 'EP', b: faceId, gap: 0 });
        g.hdr = { tp, bp, hp, n, pitch, g: gg };
      } else {
        const L = (P.angle || '90x90x8').split('x').map(Number), la = L[0], lb = L[1] || la, ta = L[2] || 8, gap = +P.gap || 10, hp = +P.hp || Math.min(hw, (n - 1) * pitch + 2 * 35), e = +P.e || 45, gg = +P.g || 110;
        const xs = face + gap; member(g, 'B', 'Beam', bm, sg, P3(xs, 0, 0), bfr, 0, memLen(bm), { loaded: true });
        [-1, 1].forEach(sd => {
          const yA = sd * (bm.tw / 2 + ta / 2), xB = face + ta / 2, tag = sd < 0 ? 'L' : 'R';
          plate(g, 'A' + tag + '.w', 'Cleat ' + tag + ' (web leg)', [P3(xB, yA, -hp / 2), P3(face + la, yA, -hp / 2), P3(face + la, yA, hp / 2), P3(xB, yA, hp / 2)], ta, sg, { op: 'CL', part: 'A' + tag });
          plate(g, 'A' + tag + '.c', 'Cleat ' + tag + ' (column leg)', [P3(xB, yA, -hp / 2), P3(xB, sd * (bm.tw / 2 + lb), -hp / 2), P3(xB, sd * (bm.tw / 2 + lb), hp / 2), P3(xB, yA, hp / 2)], ta, sg, { op: 'CL', part: 'A' + tag });
          for (let i = 0; i < n; i++) boltAt(g, 'C' + tag + (i + 1), P3(xB, sd * (bm.tw / 2 + Math.min(lb - 30, gg / 2)), ((n - 1) / 2 - i) * pitch), ax, ['A' + tag + '.c', faceId], B, { row: i + 1, grp: 'col' });
          g.contacts.push({ a: 'A' + tag + '.c', b: faceId, gap: 0 }, { a: 'A' + tag + '.w', b: 'B.w', gap: 0 });
        });
        for (let i = 0; i < n; i++) boltAt(g, 'W' + (i + 1), P3(face + la - e, -(bm.tw / 2 + ta / 2), ((n - 1) / 2 - i) * pitch), lat, ['AL.w', 'B.w', 'AR.w'], B, { row: i + 1, grp: 'web' });
        g.clt = { la, lb, ta, hp, n, pitch, g: gg, e, gap };
      }
      g.load = 'B';
    } else if (J.type === 'base') {
      const tp = +P.tp || 30, isI = col.kind === 'I' || col.kind === 'BU', Ld = +P.L || ((col.d || col.D) + 2 * ((+P.ex || 60) + 40)), Bd = +P.B || ((col.bf || col.B || col.D) + 2 * ((+P.ey || 60) + 40));
      rectPlate(g, 'BP', 'Base plate', [0, 0, 0], fX, fY, Ld, Bd, tp, sg, { op: 'BP' });
      member(g, 'C', 'Column', col, sg, [0, 0, 0], { x: fZ, y: [0, -1, 0], z: fX }, 0, memLen(col), { loaded: true });
      g.members[0].plates.forEach((pid, i) => { const pl = g.plates.find(q => q.id === pid); weld(g, 'W' + (i + 1), pid, 'BP', pl.c[0], pl.c[3], +P.a, { name: 'Column ' + pl.tag + ' to base plate' }); });
      const A = anchor(C, M.anchor, P.bolt), na = Math.max(4, +P.na | 0), ex = +P.ex || 60, ey = +P.ey || 60, xs = Ld / 2 - ex, ys = Bd / 2 - ey, pos = [];
      if (na >= 8) [-xs, 0, xs].forEach(x => [-ys, ys].forEach(y => pos.push([x, y]))), [-xs, xs].forEach(x => pos.push([x, 0]));
      else if (na >= 6) [-xs, 0, xs].forEach(x => [-ys, ys].forEach(y => pos.push([x, y])));
      else [-xs, xs].forEach(x => [-ys, ys].forEach(y => pos.push([x, y])));
      pos.slice(0, na).forEach((q, i) => g.anchors.push({ id: 'A' + (i + 1), p: [q[0], q[1], 0], plate: 'BP', B: A, d: A.d, hef: +P.hef || 400 }));
      g.conc = { plate: 'BP', fc: +M.conc || 25, grout: +P.grout || 30, pedB: +P.pedB || Bd + 400, pedL: +P.pedL || Ld + 400, L: Ld, B: Bd, tp };
      if (P.stiff && isI) { const hs = Math.min(150, 0.5 * Ld - col.d / 2 + 60); [-1, 1].forEach(s => { const x0 = s * (col.d / 2 - col.tf / 2); /* stiffeners in line with the web, beyond the flanges */ plate(g, 'S' + (s < 0 ? 'L' : 'R'), 'Base stiffener', [[x0, 0, 0], [s * Ld / 2, 0, 0], [s * Ld / 2, 0, hs * 0.4], [x0, 0, hs]], +P.ts || 12, sg, { op: 'ST' }); weld(g, 'WS' + (s < 0 ? 'L' : 'R'), 'S' + (s < 0 ? 'L' : 'R'), 'BP', [x0, 0, 0], [s * Ld / 2, 0, 0], +P.a, { name: 'Stiffener to base plate' }); weld(g, 'WT' + (s < 0 ? 'L' : 'R'), 'S' + (s < 0 ? 'L' : 'R'), s < 0 ? 'C.bf' : 'C.tf', [x0, 0, 0], [x0, 0, hs], +P.a, { name: 'Stiffener to flange' }); }); }
      g.load = 'C'; g.base = { L: Ld, B: Bd, tp, pos, A, hef: +P.hef || 400, ex, ey };
    } else if (J.type === 'spl') {
      const gap = +P.gap || 10, fr = frame({ beta: 0 }), Lm = memLen(bm), B = b();
      member(g, 'A', 'Member A', bm, sg, [-gap / 2, 0, 0], frame({ beta: 180 }), 0, Lm, { role: 'bearing', ends: 'far' });
      member(g, 'B', 'Member B', bm, sg, [gap / 2, 0, 0], fr, 0, Lm, { loaded: true });
      const nf = Math.max(1, +P.nf | 0), pf = +P.pf || 75, ef = 40, gf = +P.gf || Math.min(bm.bf - 50, Math.max(80, bm.bf * 0.55)), tfp = +P.tfp || 16, bfp = +P.bfp || bm.bf, Lf = 2 * ((nf - 1) * pf + 2 * ef) + gap;
      const zt = bm.d / 2 + tfp / 2, zb = -(bm.d / 2 + tfp / 2);
      rectPlate(g, 'FT', 'Top flange plate', [0, 0, zt], fX, fY, Lf, bfp, tfp, sg, { op: 'SP' }); rectPlate(g, 'FB', 'Bottom flange plate', [0, 0, zb], fX, fY, Lf, bfp, tfp, sg, { op: 'SP' });
      const nw = Math.max(1, +P.nw | 0), pw = +P.pw || 70, cw = Math.max(1, +P.cw | 0), pc = +P.pc || 70, twp = +P.twp || 10, hwp = +P.hwp || Math.min(bm.d - bm.tf - bm.tf2 - 2 * ((bm.r || 0) + 10), (nw - 1) * pw + 80), Lw = 2 * (40 + 40 + (cw - 1) * pc) + gap;
      [-1, 1].forEach(s => rectPlate(g, s < 0 ? 'WL' : 'WR', 'Web plate', [0, s * (bm.tw / 2 + twp / 2), 0], fX, fZ, Lw, hwp, twp, sg, { op: 'SP' }));
      [-1, 1].forEach(side => { const mem = side < 0 ? 'A' : 'B'; for (let i = 0; i < nf; i++) { const x = side * (gap / 2 + ef + i * pf); [-1, 1].forEach(s => { boltAt(g, 'T' + mem + (i + 1) + (s < 0 ? 'a' : 'b'), [x, s * gf / 2, zt], fZ, ['FT', mem + '.tf'], B, { grp: 'flange', side: mem }); boltAt(g, 'U' + mem + (i + 1) + (s < 0 ? 'a' : 'b'), [x, s * gf / 2, zb], fZ, ['FB', mem + '.bf'], B, { grp: 'flange', side: mem }); }); }
        for (let c = 0; c < cw; c++) for (let i = 0; i < nw; i++) boltAt(g, 'W' + mem + (c + 1) + '.' + (i + 1), [side * (gap / 2 + 40 + c * pc), -(bm.tw / 2 + twp / 2), ((nw - 1) / 2 - i) * pw], fY, ['WL', mem + '.w', 'WR'], B, { grp: 'web', side: mem }); });
      g.contacts.push({ a: 'FT', b: 'A.tf' }, { a: 'FT', b: 'B.tf' }, { a: 'FB', b: 'A.bf' }, { a: 'FB', b: 'B.bf' }, { a: 'WL', b: 'A.w' }, { a: 'WL', b: 'B.w' }, { a: 'WR', b: 'A.w' }, { a: 'WR', b: 'B.w' });
      g.load = 'B'; g.spl = { nf, pf, ef, gf, tfp, bfp, Lf, nw, pw, cw, pc, twp, hwp, gap };
    } else if (J.type === 'spe') {
      const tp = +P.tp || 20, ext = +P.ext || 70, B = b(), tube = bm.kind !== 'I' && bm.kind !== 'BU';
      // shell model: the member walls stop at the mid-surface of their own end plate
      member(g, 'A', 'Member A', bm, sg, [-tp / 2, 0, 0], frame({ beta: 180 }), 0, memLen(bm), { role: 'bearing', ends: 'far' });
      member(g, 'B', 'Member B', bm, sg, [tp / 2, 0, 0], frame({ beta: 0 }), 0, memLen(bm), { loaded: true });
      const H = (bm.d || bm.D) + 2 * ext, W = (bm.bf || bm.B || bm.D) + (tube ? 2 * ext : 30);
      rectPlate(g, 'PA', 'End plate A', [-tp / 2, 0, 0], fY, fZ, W, H, tp, sg, { op: 'EP' }); rectPlate(g, 'PB', 'End plate B', [tp / 2, 0, 0], fY, fZ, W, H, tp, sg, { op: 'EP' });
      g.members.forEach(mm => mm.plates.forEach((pid, i) => { const pl = g.plates.find(q => q.id === pid); weld(g, 'W' + mm.id + (i + 1), pid, mm.id === 'A' ? 'PA' : 'PB', pl.c[0], pl.c[3], +P.a, { name: 'Member ' + mm.id + ' ' + pl.tag + ' to end plate' }); }));
      const pos = []; if (tube) { const cy = W / 2 - ext / 2, cz = H / 2 - ext / 2, nb = Math.max(4, +P.nb | 0 || 8); if (bm.kind === 'CHS') { const R = bm.D / 2 + ext / 2; for (let k = 0; k < nb; k++) pos.push([R * Math.cos(2 * PI * (k + 0.5) / nb), R * Math.sin(2 * PI * (k + 0.5) / nb)]); } else { [-cy, cy].forEach(y => [-cz, cz].forEach(z => pos.push([y, z]))); if (nb >= 8) { [-cy, cy].forEach(y => pos.push([y, 0])); [-cz, cz].forEach(z => pos.push([0, z])); } } }
      else { const gg = Math.min(W - 60, Math.max(90, bm.bf * 0.6)), zo = bm.d / 2 + ext / 2, zi = bm.d / 2 - bm.tf - 45; [zo, zi, -zi, -zo].forEach(z => [-gg / 2, gg / 2].forEach(y => pos.push([y, z]))); }
      pos.forEach((q, i) => boltAt(g, 'B' + (i + 1), [0, q[0], q[1]], fX, ['PA', 'PB'], B, { z: q[1], y: q[0] }));
      g.contacts.push({ a: 'PA', b: 'PB', gap: 0 }); g.load = 'B'; g.spe = { tp, W, H, pos, tube };
    } else if (J.type === 'gus') {
      const br = dims(J.mem.brace), th = (+P.theta || 45) * PI / 180, tg = +P.tg || 12, Lw = +P.Lw || 200, angle = br.kind === 'L';
      const Lb = memLen(bm); member(g, 'G', 'Beam', bm, sg, [-Lb, 0, 0], frame({ beta: 0 }), 0, 2 * Lb, { role: 'bearing', ends: 'both' });
      const zf = bm.d / 2 - bm.tf / 2, Wb = br.D || br.d || br.b1 || 150, R0 = Wb / 2, Lg = +P.Lg || Math.round(Math.max(300, 2 * ((Lw / 2) * Math.cos(th) + R0 * Math.sin(th)) + 160)), Hg = +P.Hg || Math.round(Math.max(200, 2 * ((Lw / 2) * Math.sin(th) + R0 * Math.cos(th)) + 100));
      plate(g, 'GP', 'Gusset plate', [[-Lg / 2, 0, zf], [Lg / 2, 0, zf], [Lg / 2, 0, zf + Hg], [-Lg / 2, 0, zf + Hg]], tg, sg, { op: 'GP' });
      weld(g, 'WG', 'GP', 'G.tf', [-Lg / 2, 0, zf], [Lg / 2, 0, zf], +P.a, { name: 'Gusset to beam flange' });
      const dir = [Math.cos(th), 0, Math.sin(th)], c0 = [0, 0, zf + Hg * 0.5], start = V.lin(c0, dir, -Lw / 2), fr = { x: dir, y: [0, 1, 0], z: V.cross(dir, [0, 1, 0]) };
      if (!angle) {
        const BR = member(g, 'D', 'Brace', br, sg, start, fr, 0, Lw + memLen(br), { loaded: true, slot: tg });
        // slotted brace: the walls crossing the gusset plane are welded along the overlap (4 fillet welds)
        const R = br.kind === 'CHS' ? (br.D - br.t) / 2 : (br.D - br.t) / 2;
        [-1, 1].forEach(s => { const pa = V.lin(start, fr.z, s * R), pb = V.lin(pa, dir, Lw); weld(g, 'WB' + (s < 0 ? '1' : '2'), br.kind === 'CHS' ? 'D.*' : (s > 0 ? 'D.tf' : 'D.bf'), 'GP', pa, pb, +P.a, { name: 'Brace to gusset ' + (s < 0 ? 'bottom' : 'top'), sides: 2 }); });
      } else {
        const B = b(), ta = br.t, y0 = tg / 2 + ta / 2, nb = Math.max(1, +P.nb | 0), pb = +P.pb || 70, frA = { x: dir, y: [0, 1, 0], z: V.cross(dir, [0, 1, 0]) };
        member(g, 'D', 'Brace', br, sg, V.lin(start, [0, 1, 0], y0), { x: dir, z: frA.z, y: V.cross(frA.z, dir) }, 0, Lw + memLen(br), { loaded: true });
        for (let i = 0; i < nb; i++) boltAt(g, 'B' + (i + 1), V.lin(start, dir, 40 + i * pb, [0, 1, 0], y0, frA.z, br.b1 * 0.45), [0, 1, 0], ['D.l1', 'GP'], B, { row: i + 1 });
        g.contacts.push({ a: 'D.l1', b: 'GP', gap: 0 });
      }
      g.load = 'D'; g.gus = { th, tg, Lw, Lg, Hg, zf, Wb, start, dir, angle };
    }
    setOut(g, J, col, bm);
    applyOps(g, J);
    // corner points and dimensions for every plate in its own axes
    g.plates.forEach(p => { p.loc = p.c.map(q => { const d = V.sub(q, p.o); return [V.dot(d, p.u), V.dot(d, p.v)]; }); p.area = polyArea(p.loc); const st = steel(p.mat, p.t); p.fy = st.fy; p.fu = st.fu; p.E = st.E; p.bw = st.bw || 1; });
    return g;
  }

  // ------------------------------------------------------------------ setting out (eccentricity of the connected member)
  // Column–beam joints: J.so = { dy, dz } moves the beam and all its connection parts along the column face
  // (dz also moves the column stiffeners at the flange levels). Base plates: J.so = { dx, dy } moves the column
  // (with its welds and stiffeners) on the base plate. The plate FE includes the eccentricity; the component
  // method keeps the centred layout and says so in a note.
  const SO_TYPES = { ep: 1, wld: 1, fin: 1, hdr: 1, clt: 1, base: 1 };
  function setOut(g, J, col, bm) {
    const so = J.so || {}; if (!SO_TYPES[J.type]) return;
    // points can be shared between plates, welds and members (same array object): move each one only once
    const done = new Set(), mv = (o, d) => { if (done.has(o)) return; done.add(o); for (let i = 0; i < 3; i++) o[i] += d[i]; };
    const movePlate = (p, d) => { p.c.forEach(q => mv(q, d)); mv(p.o, d); };
    if (J.type === 'base') {
      const d = [+so.dx || 0, +so.dy || 0, 0]; if (!d[0] && !d[1]) return;
      const set = new Set(); g.plates.forEach(p => { if (p.mem === 'C' || p.op === 'ST') { movePlate(p, d); set.add(p.id); } });
      g.members.forEach(m => { if (m.id === 'C') mv(m.O, d); });
      g.welds.forEach(w => { if (set.has(w.a)) { mv(w.p0, d); mv(w.p1, d); } });
      const b = g.base; if (b && (Math.abs(d[0]) + (col.d || col.D) / 2 > b.L / 2 || Math.abs(d[1]) + (col.bf || col.B || col.D) / 2 > b.B / 2)) g.notes.push({ bad: 1, en: 'The column is set out beyond the base plate edge.', th: 'เสาเยื้องออกนอกขอบแผ่นฐาน' });
      g.so = { d }; g.notes.push({ en: 'Column set out on the base plate by ' + d[0] + ' / ' + d[1] + ' mm (x / y): included in CBFEM; the component method assumes a centred column.', th: 'เสาเยื้องบนแผ่นฐาน ' + d[0] + ' / ' + d[1] + ' มม. (x / y): รวมใน CBFEM ส่วนวิธีชิ้นส่วนถือว่าเสาอยู่กึ่งกลาง' });
      return;
    }
    if (g.tube) return;
    const dy = +so.dy || 0, dz = +so.dz || 0; if (!dy && !dz) return;
    const web = J.type === 'fin' && J.p.to === 'web', lat = web ? [-1, 0, 0] : [0, 1, 0], d = V.lin([0, 0, 0], lat, dy, [0, 0, 1], dz), dzv = [0, 0, dz];
    const moved = new Set(), st = new Set();
    g.plates.forEach(p => { if (p.mem === 'C') return; if (p.op === 'ST') { movePlate(p, dzv); st.add(p.id); } else { movePlate(p, d); moved.add(p.id); } });
    g.members.forEach(m => { if (m.id !== 'C') mv(m.O, d); });
    g.bolts.forEach(b => mv(b.p, d));
    g.welds.forEach(w => { const dd = moved.has(w.a) || moved.has(w.b) ? d : st.has(w.a) ? dzv : null; if (dd) { mv(w.p0, dd); mv(w.p1, dd); } });
    // the connection must stay on the column face
    const half = web ? (col.d / 2 - col.tf) : (col.bf || col.B || col.D) / 2; let ext = 0;
    g.plates.forEach(p => { if (!moved.has(p.id) || p.role === 'member') return; p.c.forEach(q => { ext = Math.max(ext, Math.abs(V.dot(q, lat))); }); });
    if (ext > half + 0.5) g.notes.push({ bad: 1, en: 'The connection is set out beyond the column ' + (web ? 'web' : 'flange') + ' (' + Math.round(ext) + ' > ' + Math.round(half) + ' mm from the column axis).', th: 'รอยต่อเยื้องออกนอก' + (web ? 'เอว' : 'ปีก') + 'เสา (' + Math.round(ext) + ' > ' + Math.round(half) + ' มม. จากแกนเสา)' });
    g.so = { d, lat }; g.notes.push({ en: 'Beam set out ' + dy + ' mm sideways and ' + dz + ' mm vertically on the column: included in CBFEM; the component method assumes the centred layout.', th: 'คานเยื้อง ' + dy + ' มม. ด้านข้าง และ ' + dz + ' มม. แนวดิ่งบนเสา: รวมใน CBFEM ส่วนวิธีชิ้นส่วนถือว่าอยู่กึ่งกลาง' });
  }

  // ------------------------------------------------------------------ user operations (added in the workspace)
  // J.ops: [{ id, kind: 'plate', o, u, v, w, h, t } | { kind: 'member', sec, o, x, roll, L, end } |
  //         { kind: 'weld', a, b, a_, sides, type } | { kind: 'bolts', host, o, dir, nr, nc, p, gg, size }]
  // Plates are flat rectangles (o = centre, u / v = in-plane axes); a member starts at o and runs along x.
  // Welds join an edge of plate a (or the start of member 'M:id') to the face of plate b; bolts pass through every
  // plate stacked at their position along the host normal. Items that end up connected to nothing are left out of
  // the analysis and listed in g.floating.
  const OPKINDS = ['plate', 'member', 'weld', 'bolts'];
  function memberFrame(x, roll) {
    x = V.unit(x); let z = Math.abs(x[2]) > 0.999 ? [1, 0, 0] : V.unit(V.sub([0, 0, 1], V.mul(x, x[2]))), y = V.cross(z, x);
    const a = (+roll || 0) * PI / 180; if (a) { const c = Math.cos(a), sn = Math.sin(a), z2 = V.add(V.mul(z, c), V.mul(y, -sn)), y2 = V.add(V.mul(y, c), V.mul(z, sn)); z = z2; y = y2; }
    return { x, y: V.unit(y), z: V.unit(z) };
  }
  // local 2D coordinates of a point on plate p (corner c[0] = origin, axes u, v)
  const loc2 = (p, q) => { const d = V.sub(q, p.c[0]); return [V.dot(d, p.u), V.dot(d, p.v)]; };
  const loc2all = p => p.c.map(q => loc2(p, q));
  function inQuad(L, x, y, tol) { // convex quad, either winding
    let sgn = 0; for (let i = 0; i < 4; i++) { const a = L[i], b = L[(i + 1) % 4], cr = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]), e = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, d = cr / e; if (Math.abs(d) <= (tol || 0)) continue; const s2 = Math.sign(d); if (sgn && s2 !== sgn) return false; sgn = s2; } return true;
  }
  // clip the segment a–b (3D, lying on or near plate p) to the outline of p; returns [t0, t1] or null
  function clipToPlate(p, a, b) {
    const L = loc2all(p), A = loc2(p, a), B = loc2(p, b); let t0 = 0, t1 = 1;
    const area = (L[1][0] - L[0][0]) * (L[2][1] - L[0][1]) - (L[2][0] - L[0][0]) * (L[1][1] - L[0][1]), wnd = area >= 0 ? 1 : -1;
    for (let i = 0; i < 4; i++) { const e0 = L[i], e1 = L[(i + 1) % 4], nx = -(e1[1] - e0[1]) * wnd, ny = (e1[0] - e0[0]) * wnd; // inward normal
      const fa = nx * (A[0] - e0[0]) + ny * (A[1] - e0[1]) + 0.5, fb = nx * (B[0] - e0[0]) + ny * (B[1] - e0[1]) + 0.5;
      if (fa < 0 && fb < 0) return null; if (fa < 0) t0 = Math.max(t0, fa / (fa - fb)); else if (fb < 0) t1 = Math.min(t1, fa / (fa - fb)); }
    return t1 - t0 > 1e-3 ? [t0, t1] : null;
  }
  // the edge of plate a that lies on plate b: [p0, p1] or null
  function weldEdge(a, b, starts, all) {
    let best = null; const out = [];
    for (let k = 0; k < 4; k++) {
      if (starts && k !== 3) continue; // member wall: the start edge c[3] → c[0]
      const q0 = a.c[k], q1 = a.c[(k + 1) % 4], d0 = V.dot(V.sub(q0, b.o), b.n), d1 = V.dot(V.sub(q1, b.o), b.n), lim = b.t / 2 + a.t / 2 + 3;
      if (Math.abs(d0) > lim || Math.abs(d1) > lim) continue;
      const cl = clipToPlate(b, q0, q1); if (!cl) continue;
      const sc = Math.abs(d0) + Math.abs(d1) - 0.01 * V.len(V.sub(q1, q0)) * (cl[1] - cl[0]), e = V.sub(q1, q0), hit = { sc, k, p0: V.lin(q0, e, cl[0]), p1: V.lin(q0, e, cl[1]) };
      out.push(hit); if (!best || sc < best.sc) best = hit;
    }
    return all ? out : best;
  }
  function applyOps(g, J) {
    const ops = Array.isArray(J.ops) ? J.ops : []; g.user = []; g.floating = { plates: [], bolts: [], welds: [], members: [] };
    if (!ops.length) return;
    const M = J.mat, sg = M.steel, pl = id => g.plates.find(q => q.id === id), note = (bad, en, th) => g.notes.push({ bad, en, th });
    // 1 plates and members
    ops.forEach(op => {
      if (op.kind === 'plate') {
        const o = op.o, u = V.unit(op.u), v = V.unit(V.sub(op.v, V.mul(u, V.dot(op.v, u)))), w = Math.max(1, +op.w || 100), h = Math.max(1, +op.h || 100);
        rectPlate(g, op.id, op.name || 'Plate ' + op.id, o, u, v, w, h, Math.max(1, +op.t || 10), op.mat || sg, { op: 'UP', user: true, part: op.id });
        g.user.push(op.id);
      } else if (op.kind === 'member') {
        let s; try { s = dims(op.sec); } catch (e) { s = null; } if (!s) { note(1, 'Member ' + op.id + ': unknown section.', 'ชิ้นส่วน ' + op.id + ': ไม่รู้จักหน้าตัด'); return; }
        const fr = memberFrame(op.x || [1, 0, 0], op.roll), L = Math.max(50, +op.L || memLen(s));
        member(g, op.id, op.name || 'Member ' + op.id, s, op.mat || sg, op.o.slice(), fr, 0, L, { role: op.end === 'supported' ? 'bearing' : 'connected', ends: 'far', user: true });
        g.user.push(op.id);
      }
    });
    // 2 welds
    ops.forEach(op => {
      if (op.kind !== 'weld') return;
      const B = pl(op.b), mem = /^M:/.test(op.a || '') ? g.members.find(m => m.id === op.a.slice(2)) : null, As = mem ? mem.plates.map(pl) : [pl(op.a)].filter(Boolean);
      if (!B || !As.length) { note(1, 'Weld ' + op.id + ': choose the two parts it joins.', 'รอยเชื่อม ' + op.id + ': เลือกชิ้นส่วนที่ต้องการเชื่อม'); return; }
      // all round: every edge of the plate that lies on the face (a lap plate or a stiffener welded on several sides)
      const list = []; As.forEach(A => { if (A.id === B.id) return; if (op.all && !mem) weldEdge(A, B, false, true).forEach(e => list.push([A, e])); else { const e = weldEdge(A, B, !!mem); if (e) list.push([A, e]); } });
      let n = 0; list.forEach(([A, e], i) => { n++;
        const lap = Math.abs(V.dot(A.n, B.n)) > 0.9;
        weld(g, list.length > 1 ? op.id + '.' + (i + 1) : op.id, A.id, B.id, e.p0, e.p1, Math.max(2, +op.a_ || 6), { name: op.name || ((mem ? mem.name + ' ' + A.tag : A.name) + ' to ' + B.name), type: op.type === 'butt' ? 'butt' : 'fillet', sides: lap ? 1 : +op.sides === 1 ? 1 : 2, lap, user: op.id }); });
      if (!n) note(1, 'Weld ' + op.id + ': ' + (mem ? 'the member does not start on ' : 'no edge of ' + op.a + ' lies on ') + op.b + ' — move the part onto the face.', 'รอยเชื่อม ' + op.id + ': ชิ้นส่วนไม่ได้วางชิดผิว ' + op.b);
      else if (mem && n < As.length) note(0, 'Weld ' + op.id + ': ' + n + ' of ' + As.length + ' walls of ' + mem.id + ' reach ' + op.b + ' (a member set at an angle is not cut to the face).', 'รอยเชื่อม ' + op.id + ': ผนัง ' + n + ' จาก ' + As.length + ' ของ ' + mem.id + ' ถึงผิว ' + op.b + ' (ชิ้นส่วนที่เอียงไม่ได้ตัดให้ชิดผิว)');
    });
    // 3 bolt groups
    ops.forEach(op => {
      if (op.kind !== 'bolts') return;
      const H = pl(op.host); if (!H) { note(1, 'Bolts ' + op.id + ': host plate ' + op.host + ' not found.', 'สลัก ' + op.id + ': ไม่พบแผ่น ' + op.host); return; }
      const Bt = bolt(J.code, M.bolt, op.size || 'M20'), nr = Math.max(1, +op.nr | 0), nc = Math.max(1, +op.nc | 0), pp = +op.p || 3 * Bt.d, gg = +op.gg || 3 * Bt.d;
      const n = H.n, dir = V.unit(V.sub(op.dir || H.u, V.mul(n, V.dot(op.dir || H.u, n)))), per = V.cross(n, dir);
      let made = 0;
      for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
        const q = V.lin(op.o, dir, (i - (nr - 1) / 2) * pp, per, (j - (nc - 1) / 2) * gg);
        // plates crossed by the bolt line next to the host, in order along the normal
        const hit = g.plates.map(p => { const dn = V.dot(p.n, n); if (Math.abs(dn) < 0.95) return null; const s = V.dot(V.sub(p.o, q), p.n) / dn, x = V.lin(q, n, s), l = loc2(p, x); return inQuad(loc2all(p), l[0], l[1], -Math.max(4, 0.6 * Bt.d)) ? { p, s } : null; }).filter(Boolean).sort((a, b) => a.s - b.s);
        const hi = hit.findIndex(x => x.p.id === H.id); if (hi < 0) continue;
        let lo = hi, up = hi; while (lo > 0 && hit[lo].s - hit[lo - 1].s <= (hit[lo].p.t + hit[lo - 1].p.t) / 2 + 2) lo--; while (up < hit.length - 1 && hit[up + 1].s - hit[up].s <= (hit[up].p.t + hit[up + 1].p.t) / 2 + 2) up++;
        const stack = hit.slice(lo, up + 1).map(x => x.p.id); if (stack.length < 2) continue;
        boltAt(g, op.id + '.' + (++made), V.lin(q, n, hit[hi].s), n, stack, Bt, { user: op.id, grp: 'user' });
        for (let k = 0; k + 1 < stack.length; k++) if (!g.contacts.some(c => (c.a === stack[k] && c.b === stack[k + 1]) || (c.b === stack[k] && c.a === stack[k + 1]))) g.contacts.push({ a: stack[k], b: stack[k + 1], gap: 0, user: op.id });
      }
      if (!made) note(1, 'Bolts ' + op.id + ': no other plate lies against ' + op.host + ' at the bolt positions.', 'สลัก ' + op.id + ': ไม่มีแผ่นอื่นแนบกับ ' + op.host + ' ที่ตำแหน่งสลัก');
      else if (made < nr * nc) note(0, 'Bolts ' + op.id + ': ' + (nr * nc - made) + ' position(s) pass through only one plate and were left out.', 'สลัก ' + op.id + ': ' + (nr * nc - made) + ' ตำแหน่งผ่านแผ่นเดียวจึงไม่นำมาคิด');
    });
    // 4 connectivity: everything must hang from a supported member (or the loaded member's support path)
    const partOf = id => { const p = pl(id); return p ? (p.mem ? 'M' + p.mem : p.part || p.id) : id; }, adj = {};
    const link = (a, b) => { (adj[a] = adj[a] || new Set()).add(b); (adj[b] = adj[b] || new Set()).add(a); };
    const expand = id => (/\.\*$/.test(id) ? g.plates.filter(q => q.mem === id.slice(0, -2)).map(q => q.id) : [id]);
    g.welds.forEach(w => expand(w.a).forEach(a => expand(w.b).forEach(b => link(partOf(a), partOf(b)))));
    g.bolts.forEach(b => { const ps = b.stack.filter(Boolean).map(partOf); ps.forEach(x => ps.forEach(y => { if (x !== y) link(x, y); })); });
    g.contacts.forEach(c => { if (c.a && c.b) link(partOf(c.a), partOf(c.b)); });
    g.anchors.forEach(a => link(partOf(a.plate), 'GROUND'));
    const seen = new Set(), stackQ = g.members.filter(m => m.role === 'bearing' && !m.user).map(m => 'M' + m.id).concat(g.anchors.length ? ['GROUND'] : []);
    if (!stackQ.length) g.members.forEach(m => { if (!m.user) stackQ.push('M' + m.id); });
    g.members.filter(m => m.user && m.role === 'bearing').forEach(m => stackQ.push('M' + m.id));
    while (stackQ.length) { const x = stackQ.pop(); if (seen.has(x)) continue; seen.add(x); (adj[x] || []).forEach(y => { if (!seen.has(y)) stackQ.push(y); }); }
    const floatP = new Set(g.plates.filter(p => !seen.has(partOf(p.id))).map(p => p.id));
    if (floatP.size) {
      const userFloat = [...new Set([...floatP].map(id => { const p = pl(id); return p.user ? p.id : p.mem && g.members.find(m => m.id === p.mem && m.user) ? p.mem : null; }).filter(Boolean))];
      g.floating.plates = g.plates.filter(p => floatP.has(p.id)); g.plates = g.plates.filter(p => !floatP.has(p.id));
      g.floating.members = g.members.filter(m => m.plates.every(id => floatP.has(id))); g.members = g.members.filter(m => !m.plates.every(id => floatP.has(id)));
      const touches = id => expand(id).some(x => floatP.has(x));
      g.floating.welds = g.welds.filter(w => touches(w.a) || touches(w.b)); g.welds = g.welds.filter(w => !(touches(w.a) || touches(w.b)));
      g.floating.bolts = g.bolts.filter(b => b.stack.some(id => id && floatP.has(id))); g.bolts = g.bolts.filter(b => !b.stack.some(id => id && floatP.has(id)));
      g.contacts = g.contacts.filter(c => !floatP.has(c.a) && !floatP.has(c.b));
      if (userFloat.length) note(1, userFloat.join(', ') + ' ' + (userFloat.length > 1 ? 'are' : 'is') + ' not connected (add a weld or bolts) — left out of the analysis.', userFloat.join(', ') + ' ยังไม่ได้ต่อกับชิ้นส่วนอื่น (เพิ่มรอยเชื่อมหรือสลัก) — ไม่นำมาวิเคราะห์');
    }
  }
  function polyArea(loc) { let a = 0; for (let i = 0; i < loc.length; i++) { const p = loc[i], q = loc[(i + 1) % loc.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; }
  // column continuity stiffeners at the beam flange levels (both sides of the web)
  function addStiff(g, col, zs, ts, mat) {
    const xm = col.d / 2 - col.tf / 2, bs = (col.bf - col.tw) / 2 - 10;
    zs.forEach((z, k) => [-1, 1].forEach(s => { const id = 'S' + (k + 1) + (s < 0 ? 'a' : 'b'); plate(g, id, 'Stiffener', [[-xm, 0, z], [xm, 0, z], [xm, s * (col.tw / 2 + bs), z], [-xm, 0 + s * (col.tw / 2 + bs), z]], ts, mat, { op: 'ST' });
      weld(g, 'W' + id + 'w', id, 'C.w', [-xm, 0, z], [xm, 0, z], Math.max(5, Math.round(0.5 * ts)), { name: 'Stiffener to web' });
      weld(g, 'W' + id + 't', id, 'C.tf', [xm, 0, z], [xm, s * (col.tw / 2 + bs), z], Math.max(5, Math.round(0.5 * ts)), { name: 'Stiffener to flange' });
      weld(g, 'W' + id + 'b', id, 'C.bf', [-xm, 0, z], [-xm, s * (col.tw / 2 + bs), z], Math.max(5, Math.round(0.5 * ts)), { name: 'Stiffener to flange' }); }));
  }

  G.CONN = { CODES, TYPES, TYPE_ORDER, steel, bolt, anchor, weldMetal, BSIZE, dims, secPlates, frame, newJoint, build, V, polyArea, defI, memberFrame, weldEdge, OPKINDS, SO_TYPES, memLen };
})(typeof window !== 'undefined' ? window : globalThis);
