/* StructCap Analysis — 3D model editor (click to select and edit in the 3D view), load cases and combinations,
   results (diagrams, deflected shape, reactions, modes, buckling) and report.
   Engine: frame.js (FRAME.analyse). app.js creates this module with its helpers (ctx). */
(function (G) {
  'use strict';
  G.SC_ANALYSIS_UI = function (ctx) {
    const { T, esc, f, $, S, toast, isPro, COPY, logoMark, today } = ctx;
    const F = G.FRAME, KEY = 'structcap.analysis.v3', OLD = 'structcap.analysis.v2', FREE_MEMBERS = 80, HEAVY_PTS = 1500;
    const lsGet = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
    const lsSet = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { } };
    const clone = o => JSON.parse(JSON.stringify(o));
    const fx = (v, d) => { if (v === undefined || v === null || !isFinite(v)) return '—'; const dd = d === undefined ? 2 : d; return f(Math.abs(v) < 0.5 * Math.pow(10, -dd) ? 0 : v, dd); };
    const r4 = v => Math.round(v * 1e4) / 1e4;
    const pro = () => isPro();
    const PI = Math.PI;

    // ------------------------------------------------------------------ materials, cases, combinations
    const MAT = {
      steel: { id: 'STEEL', name: 'Steel', E: 200000, nu: 0.3, rho: 78.5 },
      conc: { id: 'C32', name: 'Concrete 32 MPa', E: 30100, nu: 0.2, rho: 24 },
      timber: { id: 'TIMBER', name: 'Timber (MGP10)', E: 10000, nu: 0.3, rho: 5.5 }
    };
    const CASE = (id, type, sw, en, th) => ({ id, name: T(en, th), type, sw: !!sw });
    function preset(code, cases) {
      const G0 = cases.filter(c => c.type === 'G').map(c => c.id), Q0 = cases.filter(c => c.type === 'Q').map(c => c.id), W0 = cases.filter(c => c.type === 'W').map(c => c.id), E0 = cases.filter(c => c.type === 'E').map(c => c.id);
      const out = [], add = (name, type, parts) => { const fct = {}; parts.forEach(([ids, k]) => ids.forEach(id => { fct[id] = (fct[id] || 0) + k; })); out.push({ id: 'C' + (out.length + 1), name, type, f: fct }); };
      if (code === 'AS') {
        add('1.35G', 'ULS', [[G0, 1.35]]);
        if (Q0.length) add('1.2G + 1.5Q', 'ULS', [[G0, 1.2], [Q0, 1.5]]);
        W0.forEach(w => { add('1.2G + ' + w + ' + 0.4Q', 'ULS', [[G0, 1.2], [[w], 1], [Q0, 0.4]]); add('0.9G + ' + w, 'ULS', [[G0, 0.9], [[w], 1]]); });
        E0.forEach(e => add('G + ' + e + ' + 0.3Q', 'ULS', [[G0, 1], [[e], 1], [Q0, 0.3]]));
        add('G + 0.7Q (short-term)', 'SLS', [[G0, 1], [Q0, 0.7]]); add('G + 0.4Q (long-term)', 'SLS', [[G0, 1], [Q0, 0.4]]);
      } else if (code === 'EC') {
        add('1.35G + 1.5Q', 'ULS', [[G0, 1.35], [Q0, 1.5]]);
        W0.forEach(w => { add('1.35G + 1.5Q + 0.9' + w, 'ULS', [[G0, 1.35], [Q0, 1.5], [[w], 0.9]]); add('1.35G + 1.5' + w + ' + 1.05Q', 'ULS', [[G0, 1.35], [[w], 1.5], [Q0, 1.05]]); add('1.0G + 1.5' + w, 'ULS', [[G0, 1], [[w], 1.5]]); });
        E0.forEach(e => add('G + ' + e + ' + 0.3Q', 'ULS', [[G0, 1], [[e], 1], [Q0, 0.3]]));
        add('G + Q (characteristic)', 'SLS', [[G0, 1], [Q0, 1]]); add('G + 0.3Q (quasi-permanent)', 'SLS', [[G0, 1], [Q0, 0.3]]);
      } else {
        add('1.4D', 'ULS', [[G0, 1.4]]); add('1.2D + 1.6L', 'ULS', [[G0, 1.2], [Q0, 1.6]]);
        W0.forEach(w => { add('1.2D + 1.0' + w + ' + L', 'ULS', [[G0, 1.2], [[w], 1], [Q0, 1]]); add('0.9D + 1.0' + w, 'ULS', [[G0, 0.9], [[w], 1]]); });
        E0.forEach(e => { add('1.2D + 1.0' + e + ' + L', 'ULS', [[G0, 1.2], [[e], 1], [Q0, 1]]); add('0.9D + 1.0' + e, 'ULS', [[G0, 0.9], [[e], 1]]); });
        add('D + L', 'SLS', [[G0, 1], [Q0, 1]]);
      }
      return out;
    }

    // ------------------------------------------------------------------ templates
    const TPL = {
      building: { n: ['3D building frame (RC)', 'อาคาร 3 มิติ (คสล.)'], p: { bx: '6, 6', by: '5, 5', st: '4, 3.5, 3.5', g: 25, q: 12, wind: 20 } },
      shed: { n: ['3D steel portal shed', 'โรงงานโครงเหล็ก 3 มิติ'], p: { span: 20, eave: 6, rise: 1.5, bay: 6, nb: 4, base: 'pin' } },
      portal: { n: ['Portal frame (2D)', 'โครงข้อแข็งหลังคาจั่ว (2 มิติ)'], p: { span: 20, eave: 6, rise: 1.5, bay: 6, base: 'pin' } },
      beam: { n: ['Continuous beam (2D)', 'คานต่อเนื่อง (2 มิติ)'], p: { spans: '6, 6, 6', g: 15, q: 10 } },
      truss: { n: ['Truss (2D)', 'โครงถัก (2 มิติ)'], p: { kind: 'pratt', span: 18, depth: 2, panels: 6, load: 12 } },
      blank: { n: ['Empty 3D model', 'โมเดลว่าง 3 มิติ'], p: {} }
    };
    const blankModel = (name, plane, secs, mats, cases) => ({ name, plane: plane || '', nodes: [], members: [], sections: secs, materials: mats, cases, loads: [], combos: [], code: 'AS' });
    const GQ = () => [CASE('G', 'G', true, 'Dead', 'น้ำหนักบรรทุกคงที่'), CASE('Q', 'Q', false, 'Live', 'น้ำหนักบรรทุกจร')];
    const udl = (cs, member, w, dir) => ({ case: cs, kind: 'udl', member, dir: dir || 'grav', w1: r4(w), w2: '', a: '', b: '' });
    const nload = (cs, node, o) => Object.assign({ case: cs, kind: 'node', node, Fx: 0, Fy: 0, Fz: 0, Mx: 0, My: 0, Mz: 0 }, o);
    function build(kind, p) {
      const num = s => String(s).split(/[,\s]+/).map(Number).filter(v => v > 0);
      let m;
      if (kind === 'building') {
        m = blankModel('', '', [{ id: 'COL', name: '400×400 RC column', type: 'rect', b: 400, h: 400 }, { id: 'BM', name: '300×600 RC beam', type: 'rect', b: 300, h: 600 }], [clone(MAT.conc)],
          GQ().concat([CASE('WX', 'W', false, 'Wind +X', 'ลม +X'), CASE('WY', 'W', false, 'Wind +Y', 'ลม +Y')]));
        const cum = a => a.reduce((o, v) => { o.push(r4(o[o.length - 1] + v)); return o; }, [0]);
        const xs = cum(num(p.bx)), ys = cum(num(p.by)), zs = cum(num(p.st)), nx = xs.length, ny = ys.length;
        const id = (i, j, k) => 'N' + (k * nx * ny + j * nx + i + 1);
        zs.forEach((z, k) => ys.forEach((y, j) => xs.forEach((x, i) => m.nodes.push({ id: id(i, j, k), x, y, z, sup: k ? 'free' : 'fixed' }))));
        let c = 0, b = 0;
        for (let k = 1; k < zs.length; k++) {
          ys.forEach((y, j) => xs.forEach((x, i) => m.members.push({ id: 'C' + (++c), i: id(i, j, k - 1), j: id(i, j, k), sec: 'COL', mat: 'C32', type: 'frame' })));
          ys.forEach((y, j) => { for (let i = 0; i < nx - 1; i++) m.members.push({ id: 'B' + (++b), i: id(i, j, k), j: id(i + 1, j, k), sec: 'BM', mat: 'C32', type: 'frame' }); });
          xs.forEach((x, i) => { for (let j = 0; j < ny - 1; j++) m.members.push({ id: 'B' + (++b), i: id(i, j, k), j: id(i, j + 1, k), sec: 'BM', mat: 'C32', type: 'frame' }); });
          const top = k === zs.length - 1, W = +p.wind * (top ? 0.6 : 1);
          ys.forEach((y, j) => m.loads.push(nload('WX', id(0, j, k), { Fx: r4(W / ny) })));
          xs.forEach((x, i) => m.loads.push(nload('WY', id(i, 0, k), { Fy: r4(W / nx) })));
        }
        m.members.filter(q => q.sec === 'BM').forEach(q => m.loads.push(udl('G', q.id, +p.g), udl('Q', q.id, +p.q)));
      } else if (kind === 'shed') {
        m = blankModel('', '', [{ id: 'COL', name: '360×170 I (column)', type: 'I', d: 356, bf: 171, tf: 11.5, tw: 7.3 }, { id: 'RAF', name: '310×165 I (rafter)', type: 'I', d: 304, bf: 165, tf: 10.2, tw: 6.1 },
          { id: 'ES', name: 'SHS 100×100×5 (eave / ridge strut)', type: 'tube', shape: 'SHS', size: '100x100x5' }, { id: 'BR', name: 'Rod Ø20 (bracing)', type: 'circ', D: 20 }], [clone(MAT.steel)],
          GQ().concat([CASE('WX', 'W', false, 'Wind across (+X)', 'ลมขวาง (+X)'), CASE('WY', 'W', false, 'Wind along (+Y)', 'ลมตามยาว (+Y)')]));
        const L = +p.span, h = +p.eave, r = +p.rise, s = +p.bay, nb = Math.max(1, Math.round(+p.nb)), base0 = p.base === 'fixed' ? 'fixed' : 'pin', qz = 0.9;
        for (let k = 0; k <= nb; k++) {
          const y = r4(k * s), o = 5 * k, nid = q => 'N' + (o + q), M = (id, i, j, sec, x) => m.members.push(Object.assign({ id, i: nid(i), j: nid(j), sec, mat: 'STEEL', type: 'frame' }, x || {}));
          m.nodes.push({ id: nid(1), x: 0, y, z: 0, sup: base0 }, { id: nid(2), x: 0, y, z: h }, { id: nid(3), x: L / 2, y, z: r4(h + r) }, { id: nid(4), x: L, y, z: h }, { id: nid(5), x: L, y, z: 0, sup: base0 });
          M('C' + (2 * k + 1), 1, 2, 'COL'); M('R' + (2 * k + 1), 2, 3, 'RAF'); M('R' + (2 * k + 2), 3, 4, 'RAF'); M('C' + (2 * k + 2), 5, 4, 'COL');
          const tw = (k === 0 || k === nb ? 0.5 : 1) * s;
          ['R' + (2 * k + 1), 'R' + (2 * k + 2)].forEach(id => m.loads.push(udl('G', id, 0.15 * tw, 'gravp'), udl('Q', id, 0.25 * tw, 'gravp'), udl('WX', id, 0.9 * qz * tw, 'ly')));
          m.loads.push(udl('WX', 'C' + (2 * k + 1), 0.7 * qz * tw, 'gx'), udl('WX', 'C' + (2 * k + 2), 0.5 * qz * tw, 'gx'));
          if (k > 0) {
            const q = n => 'N' + (o - 5 + n), b = n => 'N' + (o + n);
            [2, 3, 4].forEach(n => m.members.push({ id: (n === 3 ? 'RS' : 'ES') + (n === 2 ? 'L' : n === 4 ? 'R' : '') + k, i: q(n), j: b(n), sec: 'ES', mat: 'STEEL', type: 'frame', relI: true, relJ: true }));
            if (k === 1 || k === nb) {
              [[1, 2], [5, 4]].forEach(([lo, hi], t) => { m.members.push({ id: 'XW' + (t ? 'R' : 'L') + k + 'a', i: q(lo), j: b(hi), sec: 'BR', mat: 'STEEL', type: 'truss' }, { id: 'XW' + (t ? 'R' : 'L') + k + 'b', i: b(lo), j: q(hi), sec: 'BR', mat: 'STEEL', type: 'truss' }); });
              [[2, 3], [3, 4]].forEach(([u, v], t) => { m.members.push({ id: 'XR' + (t ? 'R' : 'L') + k + 'a', i: q(u), j: b(v), sec: 'BR', mat: 'STEEL', type: 'truss' }, { id: 'XR' + (t ? 'R' : 'L') + k + 'b', i: b(u), j: q(v), sec: 'BR', mat: 'STEEL', type: 'truss' }); });
            }
          }
        }
        const Aend = L * (h + r / 2), Fy = 0.8 * qz * Aend;
        m.loads.push(nload('WY', 'N2', { Fy: r4(Fy / 4) }), nload('WY', 'N3', { Fy: r4(Fy / 2) }), nload('WY', 'N4', { Fy: r4(Fy / 4) }));
      } else if (kind === 'portal') {
        m = blankModel('', 'XZ', [{ id: 'COL', name: '360×170 I (column)', type: 'I', d: 356, bf: 171, tf: 11.5, tw: 7.3 }, { id: 'RAF', name: '310×165 I (rafter)', type: 'I', d: 304, bf: 165, tf: 10.2, tw: 6.1 }], [clone(MAT.steel)],
          GQ().concat([CASE('W1', 'W', false, 'Wind → (left to right)', 'ลม → (ซ้ายไปขวา)'), CASE('W2', 'W', false, 'Wind ← (right to left)', 'ลม ← (ขวาไปซ้าย)')]));
        const L = +p.span, h = +p.eave, r = +p.rise, s = +p.bay, base0 = p.base === 'fixed' ? 'fixed' : 'pin', qz = 0.9;
        m.nodes.push({ id: 'N1', x: 0, y: 0, z: 0, sup: base0 }, { id: 'N2', x: 0, y: 0, z: h }, { id: 'N3', x: L / 2, y: 0, z: r4(h + r) }, { id: 'N4', x: L, y: 0, z: h }, { id: 'N5', x: L, y: 0, z: 0, sup: base0 });
        m.members.push({ id: 'C1', i: 'N1', j: 'N2', sec: 'COL', mat: 'STEEL', type: 'frame' }, { id: 'R1', i: 'N2', j: 'N3', sec: 'RAF', mat: 'STEEL', type: 'frame' }, { id: 'R2', i: 'N3', j: 'N4', sec: 'RAF', mat: 'STEEL', type: 'frame' }, { id: 'C2', i: 'N5', j: 'N4', sec: 'COL', mat: 'STEEL', type: 'frame' });
        ['R1', 'R2'].forEach(id => m.loads.push(udl('G', id, 0.15 * s, 'gravp'), udl('Q', id, 0.25 * s, 'gravp')));
        [['W1', 1], ['W2', -1]].forEach(([cs, sg]) => { m.loads.push(udl(cs, sg > 0 ? 'C1' : 'C2', sg * 0.7 * qz * s, 'gx'), udl(cs, sg > 0 ? 'C2' : 'C1', sg * 0.5 * qz * s, 'gx')); ['R1', 'R2'].forEach(id => m.loads.push(udl(cs, id, 0.9 * qz * s, 'ly'))); });
      } else if (kind === 'beam') {
        m = blankModel('', 'XZ', [{ id: 'S1', name: '300×600 RC', type: 'rect', b: 300, h: 600 }], [clone(MAT.conc)], GQ());
        let x = 0; m.nodes.push({ id: 'N1', x: 0, y: 0, z: 0, sup: 'pin' });
        num(p.spans).forEach((L, i) => { x = r4(x + L); m.nodes.push({ id: 'N' + (i + 2), x, y: 0, z: 0, sup: 'rollerX' }); m.members.push({ id: 'B' + (i + 1), i: 'N' + (i + 1), j: 'N' + (i + 2), sec: 'S1', mat: 'C32', type: 'frame' }); });
        m.members.forEach(b => m.loads.push(udl('G', b.id, +p.g), udl('Q', b.id, +p.q)));
      } else if (kind === 'truss') {
        m = blankModel('', 'XZ', [{ id: 'CH', name: 'SHS 125×125×5 (chord)', type: 'tube', shape: 'SHS', size: '125x125x5' }, { id: 'WEB', name: 'SHS 100×100×4 (web)', type: 'tube', shape: 'SHS', size: '100x100x4' }], [clone(MAT.steel)], GQ());
        const L = +p.span, d = +p.depth, n = Math.max(2, Math.round(+p.panels / 2) * 2), dx = L / n, K = p.kind;
        let k = 0; const mem = (a, b, s) => m.members.push({ id: 'T' + (++k), i: a, j: b, sec: s, mat: 'STEEL', type: 'truss' });
        for (let i = 0; i <= n; i++) m.nodes.push({ id: 'B' + i, x: r4(i * dx), y: 0, z: 0, sup: i === 0 ? 'pin' : i === n ? 'rollerX' : 'free' });
        for (let i = 0; i < n; i++) mem('B' + i, 'B' + (i + 1), 'CH');
        if (K === 'warren') {
          for (let i = 0; i < n; i++) m.nodes.push({ id: 'T' + i, x: r4((i + 0.5) * dx), y: 0, z: d });
          for (let i = 0; i < n - 1; i++) mem('T' + i, 'T' + (i + 1), 'CH');
          for (let i = 0; i < n; i++) { mem('B' + i, 'T' + i, 'WEB'); mem('T' + i, 'B' + (i + 1), 'WEB'); }
          for (let i = 0; i < n; i++) m.loads.push(nload('G', 'T' + i, { Fz: -(+p.load) }), nload('Q', 'T' + i, { Fz: -r4(0.6 * p.load) }));
        } else {
          for (let i = 1; i < n; i++) m.nodes.push({ id: 'T' + i, x: r4(i * dx), y: 0, z: d });
          mem('B0', 'T1', 'CH'); for (let i = 1; i < n - 1; i++) mem('T' + i, 'T' + (i + 1), 'CH'); mem('T' + (n - 1), 'B' + n, 'CH');
          for (let i = 1; i < n; i++) mem('B' + i, 'T' + i, 'WEB');
          for (let i = 1; i < n - 1; i++) { const left = i < n / 2, pr = K === 'pratt'; if (left === pr) mem('T' + i, 'B' + (i + 1), 'WEB'); else mem('B' + i, 'T' + (i + 1), 'WEB'); }
          for (let i = 1; i < n; i++) m.loads.push(nload('G', 'T' + i, { Fz: -(+p.load) }), nload('Q', 'T' + i, { Fz: -r4(0.6 * p.load) }));
        }
        m.members.forEach((x, i) => { x.id = 'T' + (i + 1); });
      } else {
        m = blankModel('', '', [{ id: 'S1', name: '300×600 RC', type: 'rect', b: 300, h: 600 }, { id: 'S2', name: 'SHS 150×150×6', type: 'tube', shape: 'SHS', size: '150x150x6' }], [clone(MAT.conc), clone(MAT.steel)], GQ());
      }
      m.combos = preset(m.code, m.cases);
      m.name = T(TPL[kind].n[0], TPL[kind].n[1]);
      return m;
    }
    // 2D models saved by the first analysis page (x, y up) → 3D model in the XZ plane
    function migrate(o) {
      if (!o || !o.nodes) return null;
      if (o.nodes.some(n => n.z !== undefined)) return o;
      const m = clone(o); m.plane = 'XZ';
      const supMap = { fixed: ['fixed'], pin: ['pin'], rollerX: ['rollerX'], rollerY: ['custom', [1, 1, 0, 0, 0, 0]], guided: ['custom', [1, 1, 0, 0, 1, 0]], fixedRot: ['custom', [0, 1, 0, 0, 1, 0]], free: ['free'] };
      const oldEy = {}, nd = {}; o.nodes.forEach(n => { nd[n.id] = n; });
      o.members.forEach(mb => { const a = nd[mb.i], b = nd[mb.j]; if (!a || !b) return; const L = Math.hypot(b.x - a.x, b.y - a.y) || 1, c = (b.x - a.x) / L, s = (b.y - a.y) / L, ax = F.axes([+a.x, 0, +a.y], [+b.x, 0, +b.y], 0); oldEy[mb.id] = Math.sign((-s) * ax.ey[0] + c * ax.ey[2]) || 1; });
      m.nodes = o.nodes.map(n => { const sm = supMap[n.sup || 'free'] || ['free']; const q = { id: n.id, x: +n.x, y: 0, z: +n.y, sup: sm[0] }; if (sm[1]) q.fix = sm[1]; if (+n.kx) q.kx = +n.kx; if (+n.ky) q.kz = +n.ky; if (+n.kr) q.kry = +n.kr; return q; });
      m.loads = o.loads.map(l => {
        if (l.kind === 'node') return nload(l.case, l.node, { Fx: +l.Fx || 0, Fz: +l.Fy || 0, My: -(+l.Mz || 0) });
        const q = Object.assign({}, l);
        if (l.kind === 'moment') { q.dir = 'gy'; q.M = -(+l.M || 0); return q; }
        const neg = v => (v === '' || v == null ? v : -(+v));
        if (l.dir === 'gy') { q.dir = 'gz'; } else if (l.dir === 'gyp') { q.dir = 'gravp'; q.w1 = neg(l.w1); q.w2 = neg(l.w2); q.P = neg(l.P); }
        else if (l.dir === 'ly' && oldEy[l.member] < 0) { q.w1 = neg(l.w1); q.w2 = neg(l.w2); q.P = neg(l.P); }
        return q;
      });
      m.materials = m.materials.map(t => Object.assign({ nu: /conc|^C\d/i.test(t.id + t.name) ? 0.2 : 0.3 }, t));
      return m;
    }

    // ------------------------------------------------------------------ state, history
    const saved = lsGet(KEY) || (old => (old && old.model ? { model: migrate(old.model), opt: old.opt } : null))(lsGet(OLD));
    const VIEWS = { '3d': [-PI / 2 - 0.62, 0.5], plan: [-PI / 2, PI / 2], xz: [-PI / 2, 0], yz: [0, 0] };
    const A = {
      model: saved && saved.model ? saved.model : build('building', TPL.building.p),
      opt: Object.assign({ pdelta: false, modes: false, nmodes: 6, buckling: false, nseg: 4, massG: 1, massQ: 0.3, snap: 0.5 }, saved && saved.opt || {}),
      side: 'edit', tab: 'nodes', view: 'model', src: null, sel: { n: [], m: [] }, tool: 'select', draw: null, mode: 0, labels: true, loadsOn: true, dscale: 1,
      res: null, err: null, errNode: null, tpl: 'building', tplOpen: false, rtab: 'sum', lcase: 'G', cut: 'all',
      cam: { v: '3d', yaw: VIEWS['3d'][0], pitch: VIEWS['3d'][1], k: null, t: [0, 0, 0] }, hist: [], fut: [], ver: 0, resVer: -1, heavy: false, hover: null, mouse: null, box: null
    };
    if (A.model.plane === 'XZ') Object.assign(A.cam, { v: 'xz', yaw: VIEWS.xz[0], pitch: VIEWS.xz[1] });
    if (!A.model.cases.some(c => c.id === A.lcase)) A.lcase = (A.model.cases[0] || {}).id || 'all';
    const persist = () => lsSet({ model: A.model, opt: A.opt });
    let lastSnap = 0;
    function snap(force) { const now = Date.now(); if (!force && now - lastSnap < 900) return; lastSnap = now; A.hist.push(JSON.stringify(A.model)); if (A.hist.length > 60) A.hist.shift(); A.fut = []; }
    function undo(redo) {
      const from = redo ? A.fut : A.hist, to = redo ? A.hist : A.fut; if (!from.length) return;
      to.push(JSON.stringify(A.model)); A.model = JSON.parse(from.pop()); lastSnap = 0;
      A.sel = { n: A.sel.n.filter(id => A.model.nodes.some(q => q.id === id)), m: A.sel.m.filter(id => A.model.members.some(q => q.id === id)) };
      changed(true);
    }

    // ------------------------------------------------------------------ analysis
    const estPts = () => A.model.nodes.length + A.model.members.reduce((s, q) => s + (q.type === 'truss' ? 0 : Math.max(0, (A.opt.nseg | 0) - 1)), 0);
    function run(force) {
      A.err = null; A.errNode = null; A.res = null; A.heavy = false;
      const m = A.model;
      try {
        if (!m.nodes.length || !m.members.length) throw new Error(T('Add nodes and members — draw them in the 3D view or start from a template.', 'เพิ่มจุดต่อและชิ้นส่วน — วาดในมุมมอง 3 มิติ หรือเริ่มจากแม่แบบ'));
        if (!pro() && m.members.length > FREE_MEMBERS) throw new Error(T('The Free plan analyses up to ' + FREE_MEMBERS + ' members. Upgrade to Pro for larger models.', 'แพ็กเกจ Free วิเคราะห์ได้ไม่เกิน ' + FREE_MEMBERS + ' ชิ้นส่วน อัปเกรดเป็น Pro สำหรับโมเดลที่ใหญ่กว่า'));
        const o = A.opt, adv = pro(), want = adv && (o.pdelta || o.modes || o.buckling);
        A.heavy = want && !force && estPts() > HEAVY_PTS;
        const go = want && !A.heavy;
        const mass = {}; m.cases.forEach(c => { if (c.type === 'G') mass[c.id] = +o.massG || 0; else if (c.type === 'Q') mass[c.id] = +o.massQ || 0; });
        A.res = F.analyse(m, { pdelta: go && o.pdelta, modes: go && o.modes ? Math.max(1, Math.min(20, o.nmodes | 0)) : 0, buckling: go && o.buckling, nseg: Math.max(2, Math.min(10, o.nseg | 0)), massSrc: mass });
        if (!A.src || !srcList().some(s => s[0] === A.src)) A.src = m.combos.length ? 'combo:' + m.combos[0].id : 'case:' + m.cases[0].id;
      } catch (e) { A.err = e.message || String(e); A.errNode = e.node || null; }
      A.resVer = A.ver;
    }
    let tmr = null;
    const schedule = () => { clearTimeout(tmr); tmr = setTimeout(() => { persist(); run(); drawAll(); }, 220); };
    function changed(side) { A.ver++; persist(); schedule(); redraw(); if (side) sideRefresh(); }

    // ------------------------------------------------------------------ results
    const COMPS = [['N', 'N', 'kN'], ['Vy', 'V<sub>y</sub>', 'kN'], ['Vz', 'V<sub>z</sub>', 'kN'], ['T', 'T', 'kNm'], ['My', 'M<sub>y</sub>', 'kNm'], ['Mz', 'M<sub>z</sub>', 'kNm']];
    const isComp = v => COMPS.some(c => c[0] === v);
    function srcList() {
      const m = A.model, out = [];
      m.cases.forEach(c => out.push(['case:' + c.id, T('Case ', 'กรณี ') + c.id + ' — ' + c.name]));
      m.combos.forEach(c => out.push(['combo:' + c.id, c.id + ' — ' + c.name + ' (' + c.type + ')']));
      if (m.combos.some(c => c.type === 'ULS')) out.push(['env:ULS', T('Envelope — all ULS combinations', 'ค่าสูงสุด/ต่ำสุด — ULS ทั้งหมด')]);
      if (m.combos.some(c => c.type === 'SLS')) out.push(['env:SLS', T('Envelope — all SLS combinations', 'ค่าสูงสุด/ต่ำสุด — SLS ทั้งหมด')]);
      return out;
    }
    function current() {
      const r = A.res; if (!r || !A.src || A.resVer !== A.ver) return null;
      const [k, id] = A.src.split(':');
      if (k === 'case') return r.cases[id] ? Object.assign({ kind: 'case' }, r.cases[id]) : null;
      if (k === 'combo') return r.combos[id] && !r.combos[id].failed ? Object.assign({ kind: 'combo' }, r.combos[id]) : null;
      const env = F.envelope(r, A.model.combos.filter(c => c.type === id).map(c => c.id));
      return env ? Object.assign({ kind: 'env', name: id }, env) : null;
    }
    const memRes = (cur, id) => cur && cur.mem ? cur.mem.find(q => q.id === id) : null;
    const arr = (mm, q, env) => (env ? [mm[q + 'max'], mm[q + 'min']] : [mm[q]]);

    // ------------------------------------------------------------------ geometry and camera
    const nodeMap = () => { const o = {}; A.model.nodes.forEach(n => { o[n.id] = n; }); return o; };
    const P3 = n => [+n.x || 0, +n.y || 0, +n.z || 0];
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const addv = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
    function basis(c) {
      const d = [Math.cos(c.pitch) * Math.cos(c.yaw), Math.cos(c.pitch) * Math.sin(c.yaw), Math.sin(c.pitch)], r = [-Math.sin(c.yaw), Math.cos(c.yaw), 0];
      return { r, u: cross(r, [-d[0], -d[1], -d[2]]), d };
    }
    const cutAxis = () => ({ plan: 'z', xz: 'y', yz: 'x' }[A.cam.v] || null);
    function levels() { const ax = cutAxis(); if (!ax) return []; const s = new Set(A.model.nodes.map(n => r4(+n[ax] || 0))); return [...s].sort((a, b) => a - b); }
    function nodeVisible(n) { const ax = cutAxis(); if (!ax || A.cut === 'all') return true; return Math.abs((+n[ax] || 0) - +A.cut) < 1e-3; }
    function setView(v) { const [y, p] = VIEWS[v]; Object.assign(A.cam, { v, yaw: y, pitch: p, k: null }); A.cut = 'all'; }
    function fit(W, H) {
      const c = A.cam, B = basis(c), ns = A.model.nodes.filter(nodeVisible);
      if (!ns.length) { c.t = [0, 0, 0]; c.k = Math.min(W, H) / 14; return; }
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      ns.forEach(n => { const p = P3(n), a = dot(p, B.r), b = dot(p, B.u); x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); });
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, ctr = ns.reduce((s, n) => addv(s, P3(n), 1 / ns.length), [0, 0, 0]);
      const dd = dot(ctr, B.d); c.t = addv(addv(addv([0, 0, 0], B.r, cx), B.u, cy), B.d, dd);
      c.k = Math.min((W - 90) / Math.max(x1 - x0, 1), (H - 90) / Math.max(y1 - y0, 1), 400);
    }
    function extent() { const ns = A.model.nodes; if (!ns.length) return 10; let mx = 0; const c = ns.reduce((s, n) => addv(s, P3(n), 1 / ns.length), [0, 0, 0]); ns.forEach(n => { mx = Math.max(mx, Math.hypot(...sub(P3(n), c))); }); return Math.max(2 * mx, 1); }
    function screenToWorld(x, y, W, H) { const c = A.cam, B = basis(c); return addv(addv(c.t.slice(), B.r, (x - W / 2) / c.k), B.u, (H / 2 - y) / c.k); }
    function planePoint(x, y, W, H) {
      const ax = cutAxis(); if (!ax) return null;
      const p = screenToWorld(x, y, W, H), i = { x: 0, y: 1, z: 2 }[ax], sn = +A.opt.snap > 0 ? +A.opt.snap : 0;
      p[i] = A.cut === 'all' ? 0 : +A.cut;
      return p.map((v, k) => (k === i || !sn ? r4(v) : r4(Math.round(v / sn) * sn)));
    }

    // ------------------------------------------------------------------ drawing
    const LIGHT = { bg: '#FFFFFF', ink: '#141B2B', muted: '#6B7690', line: '#E3E8F0', grid: '#EEF1F6', acc: '#FF6A2B', blue: '#2E6BFF', teal: '#00A89A', pink: '#E8336F', ok: '#119C55', warn: '#C97A06', soft: '#AAB4C6' };
    function palette() {
      const cs = getComputedStyle(document.documentElement), v = k => cs.getPropertyValue(k).trim();
      return { bg: v('--bg') || LIGHT.bg, ink: v('--ink') || LIGHT.ink, muted: v('--muted') || LIGHT.muted, line: v('--line2') || LIGHT.line, grid: v('--line') || LIGHT.grid, acc: v('--acc') || LIGHT.acc, blue: v('--blue') || LIGHT.blue, teal: v('--teal') || LIGHT.teal, pink: v('--pink') || LIGHT.pink, ok: v('--ok') || LIGHT.ok, warn: v('--warn') || LIGHT.warn, soft: v('--conc-line') || LIGHT.soft };
    }
    const caseCol = (pal, id) => { const t = (A.model.cases.find(c => c.id === id) || {}).type; return t === 'G' ? pal.ink : t === 'Q' ? pal.blue : t === 'W' ? pal.teal : t === 'E' ? pal.pink : pal.warn; };
    const GDIR = { grav: [0, 0, -1], gravp: [0, 0, -1], gx: [1, 0, 0], gy: [0, 1, 0], gz: [0, 0, 1] };
    function render(cv, o) {
      const pal = o.pal, W = o.W, H = o.H, dpr = o.dpr || 1, g = cv.getContext('2d');
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = pal.bg; g.fillRect(0, 0, W, H);
      const m = A.model, nd = nodeMap(), c = A.cam; if (!c.k) fit(W, H);
      const B = basis(c), k = c.k, t = c.t, view = o.view || A.view, rep = !!o.rep;
      const P = p => { const q = sub(p, t); return [W / 2 + k * dot(q, B.r), H / 2 - k * dot(q, B.u), dot(q, B.d)]; };
      const line = (a, b, col, w, dash) => { g.strokeStyle = col; g.lineWidth = w; g.setLineDash(dash || []); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.setLineDash([]); };
      const text = (s, x, y, col, opt) => { g.font = (opt && opt.font) || '11px ui-monospace, SFMono-Regular, Menlo, monospace'; g.textAlign = (opt && opt.align) || 'left'; g.lineWidth = 3; g.strokeStyle = pal.bg; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y); };
      const arrow = (a, b, col, w) => { if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 4) { g.strokeStyle = col; g.lineWidth = 1.2; g.beginPath(); g.arc(b[0], b[1], 4, 0, 2 * PI); g.moveTo(b[0] - 2.8, b[1] - 2.8); g.lineTo(b[0] + 2.8, b[1] + 2.8); g.moveTo(b[0] + 2.8, b[1] - 2.8); g.lineTo(b[0] - 2.8, b[1] + 2.8); g.stroke(); return; } line(a, b, col, w || 1.4); const an = Math.atan2(b[1] - a[1], b[0] - a[0]), hl = 7; g.fillStyle = col; g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(b[0] - hl * Math.cos(an - 0.42), b[1] - hl * Math.sin(an - 0.42)); g.lineTo(b[0] - hl * Math.cos(an + 0.42), b[1] - hl * Math.sin(an + 0.42)); g.closePath(); g.fill(); };
      const ext = extent(), cur = view === 'model' ? null : current();
      const visN = new Set(m.nodes.filter(nodeVisible).map(n => n.id)), selN = new Set(rep ? [] : A.sel.n), selM = new Set(rep ? [] : A.sel.m);
      const memVis = mb => visN.has(mb.i) && visN.has(mb.j);
      // structural grid on the base plane / elevation plane
      const xs = [...new Set(m.nodes.map(n => r4(+n.x || 0)))], ys = [...new Set(m.nodes.map(n => r4(+n.y || 0)))], zs = [...new Set(m.nodes.map(n => r4(+n.z || 0)))];
      const mm = a => [Math.min(...a), Math.max(...a)], pad = Math.max(1, 0.06 * ext);
      if (xs.length && xs.length < 60 && ys.length < 60) {
        const [x0, x1] = mm(xs), [y0, y1] = mm(ys), [z0, z1] = mm(zs), v = c.v;
        g.save(); g.globalAlpha = 0.9;
        if (v === 'xz') { const yy = A.cut === 'all' ? y0 : +A.cut; xs.forEach(x => line(P([x, yy, z0 - pad]), P([x, yy, z1 + pad]), pal.grid, 1, [4, 4])); zs.forEach(z => line(P([x0 - pad, yy, z]), P([x1 + pad, yy, z]), pal.grid, 1, [4, 4])); }
        else if (v === 'yz') { const xx = A.cut === 'all' ? x0 : +A.cut; ys.forEach(y => line(P([xx, y, z0 - pad]), P([xx, y, z1 + pad]), pal.grid, 1, [4, 4])); zs.forEach(z => line(P([xx, y0 - pad, z]), P([xx, y1 + pad, z]), pal.grid, 1, [4, 4])); }
        else { const zz = v === 'plan' && A.cut !== 'all' ? +A.cut : z0; xs.forEach(x => line(P([x, y0 - pad, zz]), P([x, y1 + pad, zz]), pal.grid, 1, [4, 4])); ys.forEach(y => line(P([x0 - pad, y, zz]), P([x1 + pad, y, zz]), pal.grid, 1, [4, 4])); }
        g.restore();
      }
      // members
      const scr = { n: [], m: [] }, resMode = view !== 'model';
      m.members.forEach(mb => {
        const a = nd[mb.i], b = nd[mb.j]; if (!a || !b) return;
        const pa = P(P3(a)), pb = P(P3(b)), vis = memVis(mb), sel = selM.has(mb.id), hov = !rep && A.hover && A.hover.k === 'm' && A.hover.id === mb.id;
        if (!vis) { g.save(); g.globalAlpha = 0.14; line(pa, pb, pal.muted, 1.2); g.restore(); return; }
        const col = sel ? pal.acc : hov ? pal.blue : resMode ? pal.soft : mb.type === 'truss' ? pal.teal : pal.ink;
        line(pa, pb, col, sel ? 4 : resMode ? 1.6 : mb.type === 'truss' ? 1.6 : 2.4);
        scr.m.push({ id: mb.id, a: pa, b: pb });
        if (mb.type !== 'truss' && !resMode) [[mb.relI, pa, pb], [mb.relJ, pb, pa]].forEach(([r, p, q]) => { if (!r) return; const L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, d = Math.min(11, L / 3); g.beginPath(); g.arc(p[0] + (q[0] - p[0]) / L * d, p[1] + (q[1] - p[1]) / L * d, 3.4, 0, 2 * PI); g.fillStyle = pal.bg; g.fill(); g.strokeStyle = col; g.lineWidth = 1.4; g.stroke(); });
      });
      // results
      const notes = [];
      if (view !== 'model' && A.res && A.resVer === A.ver) drawResults();
      else if (view !== 'model' && A.resVer !== A.ver) notes.push(T('Updating…', 'กำลังคำนวณ…'));
      // nodes and supports
      m.nodes.forEach(n => {
        if (!visN.has(n.id)) return;
        const p = P(P3(n)), sel = selN.has(n.id), hov = !rep && A.hover && A.hover.k === 'n' && A.hover.id === n.id, fx6 = F.fixOf(n), nt = fx6[0] + fx6[1] + fx6[2], nr = fx6[3] + fx6[4] + fx6[5];
        const sc = pal.muted;
        if (nt + nr) {
          g.strokeStyle = sc; g.lineWidth = 1.4; g.fillStyle = pal.bg;
          if (nt === 3 && nr === 3) { g.beginPath(); g.moveTo(p[0] - 11, p[1] + 2); g.lineTo(p[0] + 11, p[1] + 2); g.stroke(); for (let i = -9; i <= 9; i += 5) { g.beginPath(); g.moveTo(p[0] + i, p[1] + 2); g.lineTo(p[0] + i - 5, p[1] + 8); g.stroke(); } }
          else if (nt === 3) { g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[0] - 8, p[1] + 12); g.lineTo(p[0] + 8, p[1] + 12); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(p[0] - 11, p[1] + 14); g.lineTo(p[0] + 11, p[1] + 14); g.stroke(); }
          else if (fx6[2] && nt < 3) { g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[0] - 8, p[1] + 11); g.lineTo(p[0] + 8, p[1] + 11); g.closePath(); g.stroke(); [-4, 4].forEach(d => { g.beginPath(); g.arc(p[0] + d, p[1] + 14, 2.4, 0, 2 * PI); g.stroke(); }); }
          else { g.beginPath(); g.moveTo(p[0], p[1] - 8); g.lineTo(p[0] + 8, p[1]); g.lineTo(p[0], p[1] + 8); g.lineTo(p[0] - 8, p[1]); g.closePath(); g.stroke(); }
        }
        if (F.SUPS && ['kx', 'ky', 'kz', 'krx', 'kry', 'krz'].some(q => +n[q] > 0)) { g.strokeStyle = sc; g.beginPath(); g.moveTo(p[0], p[1] + 2); for (let i = 0; i < 5; i++) g.lineTo(p[0] + (i % 2 ? -4 : 4), p[1] + 4 + i * 3); g.stroke(); }
        const err = A.errNode === n.id;
        g.beginPath(); g.arc(p[0], p[1], sel ? 5.2 : hov ? 4.6 : 3.2, 0, 2 * PI); g.fillStyle = sel ? pal.acc : err ? pal.pink : hov ? pal.blue : pal.bg; g.fill(); g.strokeStyle = sel ? pal.acc : err ? pal.pink : hov ? pal.blue : pal.ink; g.lineWidth = 1.5; g.stroke();
        if (err) { g.beginPath(); g.arc(p[0], p[1], 11, 0, 2 * PI); g.strokeStyle = pal.pink; g.lineWidth = 2; g.stroke(); }
        scr.n.push({ id: n.id, p });
      });
      // loads
      if (view === 'model' && (A.loadsOn || rep)) drawLoads(o.lcase || A.lcase);
      // local axes of selected members
      if (!rep && selM.size && selM.size <= 24) m.members.forEach(mb => {
        if (!selM.has(mb.id)) return; const a = nd[mb.i], b = nd[mb.j]; if (!a || !b) return;
        const ax = F.axes(P3(a), P3(b), mb.beta), mid = addv(P3(a), sub(P3(b), P3(a)), 0.5), L = 34 / k, pm = P(mid);
        [[ax.ex, pal.pink, 'x'], [ax.ey, pal.ok, 'y'], [ax.ez, pal.blue, 'z']].forEach(([e, col, lb]) => { const q = P(addv(mid, e, L)); arrow(pm, q, col, 1.8); text(lb, q[0] + 3, q[1] - 3, col, { font: '600 11px ui-monospace, monospace' }); });
      });
      // labels
      if (A.labels || rep) {
        const vm = m.members.filter(memVis).length, many = vm > 70;
        m.members.forEach(mb => { if (!memVis(mb) || (many && !selM.has(mb.id))) return; const a = nd[mb.i], b = nd[mb.j]; if (!a || !b) return; const p = P(addv(P3(a), sub(P3(b), P3(a)), 0.5)); text(mb.id, p[0] + 4, p[1] - 4, pal.blue, { font: '10.5px ui-monospace, monospace' }); });
        m.nodes.forEach(n => { if (!visN.has(n.id) || (many && !selN.has(n.id))) return; const p = P(P3(n)); text(n.id, p[0] + 6, p[1] + 13, pal.muted, { font: '10.5px ui-monospace, monospace' }); });
      }
      // drawing a member: rubber band
      if (!rep && A.tool === 'member' && A.draw && A.mouse && nd[A.draw]) { const p = P(P3(nd[A.draw])); line(p, A.mouse, pal.acc, 1.5, [6, 4]); }
      if (!rep && A.box) { g.strokeStyle = pal.blue; g.lineWidth = 1; g.setLineDash([5, 3]); g.strokeRect(Math.min(A.box[0], A.box[2]), Math.min(A.box[1], A.box[3]), Math.abs(A.box[2] - A.box[0]), Math.abs(A.box[3] - A.box[1])); g.setLineDash([]); g.fillStyle = 'rgba(46,107,255,0.06)'; g.fillRect(Math.min(A.box[0], A.box[2]), Math.min(A.box[1], A.box[3]), Math.abs(A.box[2] - A.box[0]), Math.abs(A.box[3] - A.box[1])); }
      // axis triad
      const o0 = [34, H - 30];
      [[[1, 0, 0], 'X', pal.pink], [[0, 1, 0], 'Y', pal.ok], [[0, 0, 1], 'Z', pal.blue]].forEach(([e, lb, col]) => { const dx = dot(e, B.r), dy = dot(e, B.u); if (Math.hypot(dx, dy) < 0.08) { text(lb, o0[0] + 2, o0[1] - 2, col, { font: '600 10px ui-monospace, monospace' }); return; } const q = [o0[0] + 22 * dx, o0[1] - 22 * dy]; arrow(o0, q, col, 1.6); text(lb, q[0] + 3, q[1] + 3, col, { font: '600 10px ui-monospace, monospace' }); });
      notes.forEach((s, i) => text(s, 14, 22 + i * 16, pal.muted, { font: '12px system-ui, sans-serif' }));
      return scr;

      function drawLoads(lc) {
        const ls = m.loads.filter(l => lc === 'all' || l.case === lc);
        const maxW = Math.max(1e-9, ...ls.filter(l => l.kind === 'udl').map(l => Math.max(Math.abs(+l.w1 || 0), Math.abs(l.w2 === '' || l.w2 == null ? 0 : +l.w2))));
        const maxP = Math.max(1e-9, ...ls.filter(l => l.kind !== 'udl').map(l => l.kind === 'node' ? Math.max(Math.abs(+l.Fx || 0), Math.abs(+l.Fy || 0), Math.abs(+l.Fz || 0)) : Math.abs(+l.P || 0)));
        const stack = {}, fewL = ls.length <= 40 || rep;
        ls.forEach(l => {
          const col = caseCol(pal, l.case);
          if (l.kind === 'node') {
            const n = nd[l.node]; if (!n || !visN.has(n.id)) return; const p0 = P3(n), pp = P(p0);
            [['Fx', [1, 0, 0]], ['Fy', [0, 1, 0]], ['Fz', [0, 0, 1]]].forEach(([q, e]) => { const v = +l[q] || 0; if (!v) return; const len = (20 + 26 * Math.abs(v) / maxP) / k, d = e.map(c0 => c0 * Math.sign(v)), tail = P(addv(p0, d, -len - 5 / k)), head = P(addv(p0, d, -5 / k)); arrow(tail, head, col, 1.5); if (fewL || selN.has(n.id)) text(f(Math.abs(v), 1), tail[0] + 3, tail[1] - 3, col); });
            const mtot = ['Mx', 'My', 'Mz'].filter(q => +l[q]).map(q => q + ' ' + f(+l[q], 1)).join(' ');
            if (mtot) { g.strokeStyle = col; g.lineWidth = 1.4; g.beginPath(); g.arc(pp[0], pp[1], 12, -PI * 0.9, PI * 0.4); g.stroke(); text(mtot, pp[0] + 14, pp[1] - 10, col); }
            return;
          }
          const mb = m.members.find(q => q.id === l.member); if (!mb || !memVis(mb)) return; const a = nd[mb.i], b = nd[mb.j]; if (!a || !b) return;
          const pa = P3(a), pb = P3(b), L = Math.hypot(...sub(pb, pa)), ax = F.axes(pa, pb, mb.beta), dir = l.dir || (l.kind === 'moment' ? 'lz' : 'grav');
          const e = GDIR[dir] || (dir === 'lx' ? ax.ex : dir === 'ly' ? ax.ey : ax.ez), at = s => addv(pa, ax.ex, s);
          if (l.kind === 'udl') {
            const a0 = Math.max(0, +l.a || 0), b0 = l.b === '' || l.b == null || +l.b <= 0 ? L : Math.min(L, +l.b), w1 = +l.w1 || 0, w2 = l.w2 === '' || l.w2 == null ? w1 : +l.w2;
            const kk = mb.id + '|' + dir + '|' + Math.sign(w1 || w2), off = (stack[kk] || 0); stack[kk] = off + 40;
            const segPx = Math.hypot(...[0, 1].map(i => P(at(b0))[i] - P(at(a0))[i])), na = Math.max(2, Math.min(14, Math.round(segPx / 26))), tops = [];
            for (let i = 0; i <= na; i++) {
              const s = a0 + (b0 - a0) * i / na, w = w1 + (w2 - w1) * i / na, sg = Math.sign(w || w1 || 1), len = (10 + 26 * Math.abs(w) / maxW + off) / k, base = at(s);
              const tail = P(addv(base, e, -sg * len)), head = P(addv(base, e, -sg * (3 + off) / k)); tops.push(tail);
              if (w) arrow(tail, head, col, 1.2);
            }
            g.strokeStyle = col; g.lineWidth = 1.2; g.beginPath(); tops.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.stroke();
            const tm = tops[Math.floor(tops.length / 2)]; if (fewL || selM.has(mb.id)) text(l.case + ' ' + f(Math.abs(w1), 2) + (w2 !== w1 ? '→' + f(Math.abs(w2), 2) : ''), tm[0] + 4, tm[1] - 4, col);
          } else if (l.kind === 'point') {
            const v = +l.P || 0, sg = Math.sign(v || 1), base = at(Math.min(L, +l.a || 0)), len = (20 + 26 * Math.abs(v) / maxP) / k, tail = P(addv(base, e, -sg * len)), head = P(addv(base, e, -sg * 4 / k));
            arrow(tail, head, col, 1.5); text(l.case + ' ' + f(Math.abs(v), 1), tail[0] + 4, tail[1] - 3, col);
          } else if (l.kind === 'moment') { const pp = P(at(Math.min(L, +l.a || 0))); g.strokeStyle = col; g.lineWidth = 1.4; g.beginPath(); g.arc(pp[0], pp[1], 11, -PI * 0.9, PI * 0.4); g.stroke(); text(l.case + ' M ' + f(+l.M || 0, 1), pp[0] + 13, pp[1] - 9, col); }
        });
      }
      function drawResults() {
        const r = A.res;
        if (view === 'mode' || view === 'buck') {
          let u, mesh, title;
          if (view === 'mode') { const md = r.modal && r.modal.modes[A.mode]; if (!md) { notes.push(r.modal ? T('No mode.', 'ไม่มีโหมด') : T('Turn on modal analysis (Pro) in the Analysis settings.', 'เปิดการวิเคราะห์โหมด (Pro) ในการตั้งค่าการวิเคราะห์')); return; } u = md.u; mesh = r.modal.mesh; title = T('Mode ', 'โหมด ') + (A.mode + 1) + ' · f = ' + f(md.f, 3) + ' Hz · T = ' + f(md.T, 3) + ' s'; }
          else { const bid = A.src && A.src.startsWith('combo:') ? A.src.slice(6) : null, bk = bid && r.buckling && r.buckling[bid], md = bk && bk.modes && bk.modes[0]; if (!md) { notes.push(bk && bk.none ? T('No compression in this combination — no buckling mode.', 'ไม่มีแรงอัดในกรณีนี้ — ไม่มีโหมดการโก่งเดาะ') : T('Turn on buckling analysis (Pro) and choose a ULS combination.', 'เปิดการวิเคราะห์การโก่งเดาะ (Pro) และเลือกกรณีรวมแรง ULS')); return; } u = md.u; mesh = bk.mesh; title = T('Buckling mode 1 · λcr = ', 'โหมดการโก่งเดาะ 1 · λcr = ') + f(md.lam, 2); }
          const sc = 0.1 * ext * A.dscale;
          mesh.els.forEach(el => { const mb = m.members.find(q => q.id === el.mem.id); if (mb && !memVis(mb)) return; const a = mesh.pts[el.n1], b = mesh.pts[el.n2], i = 6 * el.n1, j = 6 * el.n2; line(P([a.x + u[i] * sc, a.y + u[i + 1] * sc, a.z + u[i + 2] * sc]), P([b.x + u[j] * sc, b.y + u[j + 1] * sc, b.z + u[j + 2] * sc]), pal.pink, 2); });
          notes.push(title); return;
        }
        if (!cur) { notes.push(T('Choose results in the list above.', 'เลือกผลลัพธ์จากรายการด้านบน')); return; }
        const env = cur.kind === 'env';
        if (view === 'def') {
          if (env) { notes.push(T('Choose a load case or combination to see the deflected shape.', 'เลือกกรณีน้ำหนักหรือกรณีรวมแรงเพื่อดูรูปการโก่งตัว')); return; }
          let mx = 0, best = null; cur.mem.forEach(q => q.dx.forEach((d, i) => { const v = Math.hypot(d, q.dy[i], q.dz[i]); if (v > mx) { mx = v; best = [q, i]; } }));
          const sc = mx > 0 ? 0.08 * ext / mx * A.dscale : 0;
          cur.mem.forEach(q => { const mb = m.members.find(z => z.id === q.id); if (!mb || !memVis(mb)) return; const pa = P3(nd[mb.i]), pb = P3(nd[mb.j]), ex = sub(pb, pa).map(v => v / q.L); g.strokeStyle = pal.pink; g.lineWidth = 2.2; g.beginPath(); q.x.forEach((x, i) => { const p = P([pa[0] + ex[0] * x + q.dx[i] * sc, pa[1] + ex[1] * x + q.dy[i] * sc, pa[2] + ex[2] * x + q.dz[i] * sc]); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }); g.stroke(); });
          if (best) { const [q, i] = best, mb = m.members.find(z => z.id === q.id), pa = P3(nd[mb.i]), pb = P3(nd[mb.j]), ex = sub(pb, pa).map(v => v / q.L), p = P([pa[0] + ex[0] * q.x[i] + q.dx[i] * sc, pa[1] + ex[1] * q.x[i] + q.dy[i] * sc, pa[2] + ex[2] * q.x[i] + q.dz[i] * sc]); g.beginPath(); g.arc(p[0], p[1], 4.5, 0, 2 * PI); g.fillStyle = pal.pink; g.fill(); text(f(mx * 1000, 2) + ' mm', p[0] + 8, p[1] - 8, pal.ink, { font: '600 11px ui-monospace, monospace' }); }
          notes.push(T('Deflected shape · max ', 'รูปการโก่งตัว · สูงสุด ') + f(mx * 1000, 2) + ' mm'); return;
        }
        if (view === 'react') {
          const R = cur.R; let mx = 1e-9;
          m.nodes.forEach((n, i) => { for (let d = 0; d < 3; d++) { const v = env ? Math.max(Math.abs(R[6 * i + d][0]), Math.abs(R[6 * i + d][1])) : Math.abs(R[6 * i + d]); mx = Math.max(mx, v); } });
          m.nodes.forEach((n, i) => {
            const fx6 = F.fixOf(n); if (!fx6.some(Boolean) && !['kx', 'ky', 'kz', 'krx', 'kry', 'krz'].some(q => +n[q] > 0)) return; if (!visN.has(n.id)) return;
            const p0 = P3(n), pp = P(p0), lines = [];
            ['X', 'Y', 'Z'].forEach((lb, d) => { const v = env ? null : R[6 * i + d]; if (env) { const [a0, a1] = R[6 * i + d]; if (Math.abs(a0) > 1e-6 || Math.abs(a1) > 1e-6) lines.push('R' + lb.toLowerCase() + ' ' + f(a0, 1) + '…' + f(a1, 1)); return; } if (Math.abs(v) < 1e-6) return; const e = [0, 0, 0]; e[d] = Math.sign(v); const len = (18 + 30 * Math.abs(v) / mx) / k; arrow(P(addv(p0, e, -len - 8 / k)), P(addv(p0, e, -8 / k)), pal.ok, 1.8); lines.push('R' + lb.toLowerCase() + ' ' + f(v, 1)); });
            ['X', 'Y', 'Z'].forEach((lb, d) => { const v = env ? R[6 * i + 3 + d] : R[6 * i + 3 + d]; if (env) { if (Math.abs(v[0]) > 1e-6 || Math.abs(v[1]) > 1e-6) lines.push('M' + lb.toLowerCase() + ' ' + f(v[0], 1) + '…' + f(v[1], 1)); } else if (Math.abs(v) > 1e-6) lines.push('M' + lb.toLowerCase() + ' ' + f(v, 1)); });
            if (m.nodes.length <= 120 || selN.has(n.id)) lines.forEach((s, j) => text(s, pp[0] + 10, pp[1] + 26 + j * 13, pal.ok));
          });
          notes.push(T('Support reactions (kN, kNm), + along +X, +Y, +Z', 'แรงปฏิกิริยา (kN, kNm) + ตามแกน +X, +Y, +Z')); return;
        }
        if (!isComp(view)) return;
        const q = view, onY = ['N', 'Vy', 'T', 'Mz'].includes(q), sgn = q === 'Mz' || q === 'My' ? -1 : 1;
        let mx = 0; cur.mem.forEach(mm2 => { const mb = m.members.find(z => z.id === mm2.id); if (!mb || !memVis(mb) || (mb.type === 'truss' && q !== 'N')) return; arr(mm2, q, env).forEach(a2 => a2.forEach(v => { mx = Math.max(mx, Math.abs(v)); })); });
        if (q !== 'N' && m.members.filter(memVis).every(z => z.type === 'truss')) { notes.push(T('Truss members carry axial force only — see the N diagram.', 'ชิ้นส่วนโครงถักรับแรงตามแนวแกนเท่านั้น — ดูแผนภาพ N')); return; }
        const sc = mx > 0 ? 0.11 * ext / mx * A.dscale : 0, few = cur.mem.length <= 140 || A.cut !== 'all';
        const colQ = { N: pal.teal, Vy: pal.blue, Vz: pal.blue, T: pal.warn, My: pal.pink, Mz: pal.acc }[q];
        cur.mem.forEach(mm2 => {
          const mb = m.members.find(z => z.id === mm2.id); if (!mb || !memVis(mb) || (mb.type === 'truss' && q !== 'N')) return;
          const pa = P3(nd[mb.i]), pb = P3(nd[mb.j]), ax = F.axes(pa, pb, mb.beta), e = onY ? ax.ey : ax.ez;
          arr(mm2, q, env).forEach((vals, si) => {
            const pts = vals.map((v, i) => P(addv(addv(pa, ax.ex, mm2.x[i]), e, v * sc * sgn)));
            g.beginPath(); const p0 = P(pa); g.moveTo(p0[0], p0[1]); pts.forEach(p => g.lineTo(p[0], p[1])); const p1 = P(pb); g.lineTo(p1[0], p1[1]); g.closePath();
            g.save(); g.globalAlpha = si ? 0.12 : 0.24; g.fillStyle = colQ; g.fill(); g.restore();
            g.strokeStyle = colQ; g.lineWidth = 1.2; g.setLineDash(si ? [4, 3] : []); g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); g.setLineDash([]);
            if ((A.labels || rep) && (few || selM.has(mb.id))) {
              let bi = 0, bj = 0; vals.forEach((v, i) => { if (v > vals[bi]) bi = i; if (v < vals[bj]) bj = i; });
              [bi, bj].filter((x, i, a2) => a2.indexOf(x) === i).forEach(i => { if (Math.abs(vals[i]) < 0.04 * mx) return; const p = pts[i]; text(f(vals[i], 1), p[0] + 3, p[1] - 3, colQ); });
            }
          });
        });
        notes.push({ N: T('Axial force N (kN) · tension +', 'แรงตามแนวแกน N (kN) · แรงดึง +'), Vy: T('Shear V_y (kN) · local y', 'แรงเฉือน V_y (kN) · แกน y'), Vz: T('Shear V_z (kN) · local z', 'แรงเฉือน V_z (kN) · แกน z'), T: T('Torsion T (kNm)', 'แรงบิด T (kNm)'), My: T('Moment M_y (kNm) · minor axis, tension side', 'โมเมนต์ M_y (kNm) · แกนรอง ด้านรับแรงดึง'), Mz: T('Moment M_z (kNm) · major axis, tension side', 'โมเมนต์ M_z (kNm) · แกนหลัก ด้านรับแรงดึง') }[q] + ' · ' + T('max ', 'สูงสุด ') + f(mx, 2) + (env ? T(' · envelope (dashed = min)', ' · ค่าสูงสุด/ต่ำสุด (เส้นประ = ต่ำสุด)') : ''));
      }
    }
    // canvas on the page
    let cvEl = null;
    function redraw() {
      const cv = $('#anCv'); if (!cv) return; cvEl = cv;
      const W = cv.clientWidth || 800, H = cv.clientHeight || 520;
      A.scr = render(cv, { W, H, dpr: Math.min(2, G.devicePixelRatio || 1), pal: palette() });
      const vs = $('#anViewTag'); if (vs) vs.textContent = viewTag();
    }
    function viewTag() { return ({ '3d': '3D', plan: T('Plan', 'แปลน'), xz: T('Elevation X–Z', 'รูปด้าน X–Z'), yz: T('Elevation Y–Z', 'รูปด้าน Y–Z') }[A.cam.v]) + (A.cut !== 'all' && cutAxis() ? ' · ' + cutAxis().toUpperCase() + ' = ' + f(+A.cut, 2) + ' m' : ''); }
    function snapshot(view, lcase, w, h) {
      const cv = document.createElement('canvas'), cam = clone(A.cam), cut = A.cut;
      A.cut = 'all'; A.cam.k = null;
      render(cv, { W: w || 900, H: h || 500, dpr: 2, pal: LIGHT, view, lcase, rep: true });
      const url = cv.toDataURL('image/png'); A.cam = cam; A.cut = cut;
      return `<img src="${url}" alt="" style="width:100%;height:auto;display:block">`;
    }

    // ------------------------------------------------------------------ picking and pointer input
    function pickAt(x, y) {
      const s = A.scr; if (!s) return null;
      let best = null, bd = 100;
      s.n.forEach(q => { const d = (q.p[0] - x) ** 2 + (q.p[1] - y) ** 2; if (d < bd) { bd = d; best = { k: 'n', id: q.id }; } });
      if (best) return best;
      bd = 64;
      s.m.forEach(q => { const dx = q.b[0] - q.a[0], dy = q.b[1] - q.a[1], L2 = dx * dx + dy * dy || 1, tt = Math.max(0, Math.min(1, ((x - q.a[0]) * dx + (y - q.a[1]) * dy) / L2)), d = (q.a[0] + tt * dx - x) ** 2 + (q.a[1] + tt * dy - y) ** 2; if (d < bd) { bd = d; best = { k: 'm', id: q.id }; } });
      return best;
    }
    function boxSelect(b, add) {
      const x0 = Math.min(b[0], b[2]), x1 = Math.max(b[0], b[2]), y0 = Math.min(b[1], b[3]), y1 = Math.max(b[1], b[3]), inside = p => p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1;
      const n = A.scr.n.filter(q => inside(q.p)).map(q => q.id), m = A.scr.m.filter(q => inside(q.a) && inside(q.b)).map(q => q.id);
      A.sel = add ? { n: [...new Set(A.sel.n.concat(n))], m: [...new Set(A.sel.m.concat(m))] } : { n, m };
    }
    function selChanged() { A.side = 'edit'; sideRefresh(); redraw(); const mm = $('#anMember'); if (mm) mm.innerHTML = memberHTML(); }
    function bindCanvas(cv) {
      const pts = new Map(); let mode = null, sx = 0, sy = 0, lx = 0, ly = 0, moved = false, pd = 0;
      const rel = e => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
      cv.addEventListener('pointerdown', e => {
        cv.focus({ preventScroll: true }); cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, rel(e));
        const [x, y] = rel(e); sx = lx = x; sy = ly = y; moved = false;
        if (pts.size === 2) { const [a, b] = [...pts.values()]; pd = Math.hypot(a[0] - b[0], a[1] - b[1]); mode = 'pinch'; A.box = null; return; }
        mode = (A.tool === 'box' || e.ctrlKey || e.metaKey) && e.button === 0 ? 'box' : e.button === 2 || e.button === 1 || e.shiftKey || A.cam.v !== '3d' ? 'pan' : 'rot';
      });
      cv.addEventListener('pointermove', e => {
        const [x, y] = rel(e);
        if (!pts.size) { A.mouse = [x, y]; const h = pickAt(x, y), same = (h && A.hover && h.k === A.hover.k && h.id === A.hover.id) || (!h && !A.hover); if (!same || (A.tool === 'member' && A.draw)) { A.hover = h; cv.style.cursor = h ? 'pointer' : A.tool === 'select' ? 'grab' : 'crosshair'; redraw(); } return; }
        pts.set(e.pointerId, [x, y]);
        if (Math.hypot(x - sx, y - sy) > 4) moved = true; if (!moved) return;
        if (mode === 'pinch' && pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pd) zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, d / pd); pd = d; return; }
        const dx = x - lx, dy = y - ly; lx = x; ly = y;
        if (mode === 'rot') { const c = A.cam, pivot = c.t.slice(); c.yaw -= dx * 0.008; c.pitch = Math.max(-1.5, Math.min(1.5, c.pitch + dy * 0.008)); c.t = pivot; }
        else if (mode === 'pan') { const c = A.cam, B = basis(c); c.t = addv(addv(c.t, B.r, -dx / c.k), B.u, dy / c.k); }
        else if (mode === 'box') A.box = [sx, sy, x, y];
        redraw();
      });
      const up = e => {
        const [x, y] = rel(e), had = pts.has(e.pointerId); pts.delete(e.pointerId); if (!had) return;
        if (pts.size) return;
        if (mode === 'box' && moved && A.box) { boxSelect(A.box, e.shiftKey); A.box = null; selChanged(); mode = null; return; }
        A.box = null;
        if (!moved && e.type === 'pointerup' && mode !== 'pinch') clickAt(x, y, e);
        mode = null;
      };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('pointerleave', () => { if (!pts.size && A.hover) { A.hover = null; A.mouse = null; redraw(); } });
      cv.addEventListener('wheel', e => { e.preventDefault(); const [x, y] = rel(e); zoomAt(x, y, Math.exp(-e.deltaY * 0.0012)); }, { passive: false });
      cv.addEventListener('contextmenu', e => { e.preventDefault(); if (A.draw) { A.draw = null; redraw(); } });
    }
    function zoomAt(x, y, s) {
      const cv = cvEl, W = cv.clientWidth, H = cv.clientHeight, c = A.cam, wp = screenToWorld(x, y, W, H);
      c.k = Math.max(0.5, Math.min(5000, c.k * s)); const B = basis(c);
      c.t = addv(addv(wp, B.r, -(x - W / 2) / c.k), B.u, -(H / 2 - y) / c.k); redraw();
    }
    function clickAt(x, y, e) {
      const hit = pickAt(x, y), W = cvEl.clientWidth, H = cvEl.clientHeight;
      if (A.tool === 'member') {
        let id = hit && hit.k === 'n' ? hit.id : null;
        if (!id && !hit) { const p = planePoint(x, y, W, H); if (!p) { toast(T('Click an existing node, or switch to Plan / Elevation to place new nodes.', 'คลิกจุดต่อที่มีอยู่ หรือเปลี่ยนเป็นแปลน / รูปด้านเพื่อวางจุดต่อใหม่'), ''); return; } snap(true); id = ensureNode(p); }
        if (!id) return;
        if (!A.draw) { A.draw = id; redraw(); return; }
        if (id !== A.draw) { snap(true); addMember(A.draw, id); A.draw = id; changed(true); }
        return;
      }
      if (A.tool === 'node') {
        if (hit && hit.k === 'n') { A.sel = { n: [hit.id], m: [] }; selChanged(); return; }
        const p = planePoint(x, y, W, H); if (!p) { toast(T('Switch to Plan or an Elevation to place nodes by clicking — or type coordinates in the panel.', 'เปลี่ยนเป็นแปลนหรือรูปด้านเพื่อคลิกวางจุดต่อ — หรือพิมพ์พิกัดในแผงด้านขวา'), ''); return; }
        snap(true); const id = ensureNode(p); A.sel = { n: [id], m: [] }; changed(true); return;
      }
      const add = e.shiftKey || e.ctrlKey || e.metaKey;
      if (!hit) { if (!add) { A.sel = { n: [], m: [] }; selChanged(); } return; }
      const key = hit.k === 'n' ? 'n' : 'm', list = A.sel[key];
      if (add) { const i = list.indexOf(hit.id); if (i >= 0) list.splice(i, 1); else list.push(hit.id); }
      else A.sel = key === 'n' ? { n: [hit.id], m: [] } : { n: [], m: [hit.id] };
      selChanged();
    }

    // ------------------------------------------------------------------ model editing
    const nextId = (arr0, p) => { let i = arr0.length + 1; const has = new Set(arr0.map(o => o.id)); while (has.has(p + i)) i++; return p + i; };
    const sameP = (n, p) => Math.abs((+n.x || 0) - p[0]) < 1e-4 && Math.abs((+n.y || 0) - p[1]) < 1e-4 && Math.abs((+n.z || 0) - p[2]) < 1e-4;
    function ensureNode(p) { const m = A.model, ex = m.nodes.find(n => sameP(n, p)); if (ex) return ex.id; const id = nextId(m.nodes, 'N'); m.nodes.push({ id, x: r4(p[0]), y: r4(p[1]), z: r4(p[2]), sup: 'free' }); return id; }
    function addMember(i, j, tpl) {
      const m = A.model; if (i === j || m.members.some(q => (q.i === i && q.j === j) || (q.i === j && q.j === i))) return null;
      const id = nextId(m.members, 'M'), base0 = tpl || {};
      const has = (list, id) => id && list.some(q => q.id === id);
      const sec = base0.sec || (has(m.sections, A.lastSec) ? A.lastSec : (m.sections[0] || {}).id || ''), mat = base0.mat || (has(m.materials, A.lastMat) ? A.lastMat : (m.materials[0] || {}).id || '');
      m.members.push({ id, i, j, sec, mat, type: base0.type || 'frame', relI: !!base0.relI, relJ: !!base0.relJ, beta: base0.beta || 0 });
      return id;
    }
    function deleteSel() {
      const m = A.model, nS = new Set(A.sel.n), mS = new Set(A.sel.m); if (!nS.size && !mS.size) return;
      snap(true);
      m.members = m.members.filter(q => !mS.has(q.id) && !nS.has(q.i) && !nS.has(q.j));
      const keepM = new Set(m.members.map(q => q.id));
      m.nodes = m.nodes.filter(n => !nS.has(n.id));
      m.loads = m.loads.filter(l => (l.kind === 'node' ? !nS.has(l.node) : keepM.has(l.member)));
      A.sel = { n: [], m: [] }; A.draw = null; changed(true);
      const mm = $('#anMember'); if (mm) mm.innerHTML = '';
    }
    function renameRefs(tb, oldId, nid) {
      const m = A.model;
      if (tb === 'nodes') { m.members.forEach(x => { if (x.i === oldId) x.i = nid; if (x.j === oldId) x.j = nid; }); m.loads.forEach(l => { if (l.node === oldId) l.node = nid; }); A.sel.n = A.sel.n.map(i => (i === oldId ? nid : i)); }
      if (tb === 'members') { m.loads.forEach(l => { if (l.member === oldId) l.member = nid; }); A.sel.m = A.sel.m.map(i => (i === oldId ? nid : i)); }
      if (tb === 'sections') m.members.forEach(x => { if (x.sec === oldId) x.sec = nid; });
      if (tb === 'materials') m.members.forEach(x => { if (x.mat === oldId) x.mat = nid; });
      if (tb === 'cases') { m.loads.forEach(l => { if (l.case === oldId) l.case = nid; }); m.combos.forEach(c => { if (c.f && oldId in c.f) { c.f[nid] = c.f[oldId]; delete c.f[oldId]; } }); }
    }
    function replicate(d, nCopy, connect, withLoads) {
      const m = A.model, nd = nodeMap(), nIds = new Set(A.sel.n); A.sel.m.forEach(id => { const q = m.members.find(z => z.id === id); if (q) { nIds.add(q.i); nIds.add(q.j); } });
      if (!nIds.size) return;
      snap(true);
      const newSel = { n: [], m: [] }; let prev = {}; nIds.forEach(id => { prev[id] = id; });
      for (let c = 1; c <= nCopy; c++) {
        const map = {};
        nIds.forEach(id => { const n = nd[id], p = [(+n.x || 0) + d[0] * c, (+n.y || 0) + d[1] * c, (+n.z || 0) + d[2] * c], nid = ensureNode(p), nn = m.nodes.find(z => z.id === nid); if (n.sup && n.sup !== 'free' && nn.sup === 'free' && !connect) { nn.sup = n.sup; if (n.fix) nn.fix = n.fix.slice(); } map[id] = nid; newSel.n.push(nid); });
        A.sel.m.forEach(id => { const q = m.members.find(z => z.id === id); if (!q) return; const nm = addMember(map[q.i], map[q.j], q); if (nm) { newSel.m.push(nm); if (withLoads) m.loads.filter(l => l.member === q.id).forEach(l => m.loads.push(Object.assign({}, l, { member: nm }))); } });
        if (withLoads) m.loads.filter(l => l.kind === 'node' && A.sel.n.includes(l.node)).forEach(l => m.loads.push(Object.assign({}, l, { node: map[l.node] })));
        if (connect) A.sel.n.forEach(id => { const nm = addMember(prev[id], map[id]); if (nm) newSel.m.push(nm); });
        prev = map;
      }
      A.sel = newSel; changed(true);
      toast(T('Replicated: ' + newSel.n.length + ' nodes, ' + newSel.m.length + ' members', 'คัดลอกแล้ว: ' + newSel.n.length + ' จุดต่อ ' + newSel.m.length + ' ชิ้นส่วน'), 'ok');
    }
    function splitMember(id, n) {
      const m = A.model, q = m.members.find(z => z.id === id); if (!q || n < 2) return [];
      const nd = nodeMap(), a = P3(nd[q.i]), b = P3(nd[q.j]), L = Math.hypot(...sub(b, a));
      const ids = [q.i]; for (let k = 1; k < n; k++) ids.push(ensureNode(a.map((v, i) => v + (b[i] - v) * k / n))); ids.push(q.j);
      const segs = [], loads = m.loads.filter(l => l.member === id); m.loads = m.loads.filter(l => l.member !== id);
      const idx = m.members.indexOf(q); m.members.splice(idx, 1);
      for (let k = 0; k < n; k++) {
        const s0 = L * k / n, s1 = L * (k + 1) / n, nid = k === 0 ? q.id : nextId(m.members, q.id + '_'), nm = Object.assign({}, q, { id: nid, i: ids[k], j: ids[k + 1], relI: k === 0 ? q.relI : false, relJ: k === n - 1 ? q.relJ : false });
        m.members.splice(idx + k, 0, nm); segs.push(nid);
        loads.forEach(l => {
          if (l.kind === 'udl') {
            const a0 = +l.a || 0, b0 = l.b === '' || l.b == null || +l.b <= 0 ? L : +l.b, w1 = +l.w1 || 0, w2 = l.w2 === '' || l.w2 == null ? w1 : +l.w2, lo = Math.max(a0, s0), hi = Math.min(b0, s1); if (hi - lo < 1e-6) return;
            const w = s => w1 + (w2 - w1) * (s - a0) / ((b0 - a0) || 1), full = Math.abs(lo - s0) < 1e-6 && Math.abs(hi - s1) < 1e-6;
            m.loads.push(Object.assign({}, l, { member: nid, w1: r4(w(lo)), w2: w1 === w2 ? '' : r4(w(hi)), a: full ? '' : r4(lo - s0), b: full ? '' : r4(hi - s0) }));
          } else { const p = +l.a || 0; if (p >= s0 - 1e-9 && (p < s1 - 1e-9 || (k === n - 1 && p <= s1 + 1e-9))) m.loads.push(Object.assign({}, l, { member: nid, a: r4(p - s0) })); }
        });
      }
      return segs;
    }
    function addRow(tb) {
      const m = A.model;
      if (tb === 'nodes') { const l = m.nodes[m.nodes.length - 1]; m.nodes.push({ id: nextId(m.nodes, 'N'), x: l ? r4(+l.x + 1) : 0, y: l ? +l.y : 0, z: l ? +l.z : 0, sup: 'free' }); }
      else if (tb === 'members') { const n = m.nodes; m.members.push({ id: nextId(m.members, 'M'), i: n[0] ? n[0].id : '', j: n[1] ? n[1].id : '', sec: m.sections[0] ? m.sections[0].id : '', mat: m.materials[0] ? m.materials[0].id : '', type: 'frame', beta: 0 }); }
      else if (tb === 'sections') m.sections.push({ id: nextId(m.sections, 'S'), name: '', type: 'rect', b: 300, h: 500 });
      else if (tb === 'materials') m.materials.push({ id: nextId(m.materials, 'MAT'), name: '', E: 200000, nu: 0.3, rho: 78.5 });
      else if (tb === 'cases') { const id = nextId(m.cases, 'L'); m.cases.push({ id, name: id, type: 'O', sw: false }); }
      else if (tb === 'nload') m.loads.push(nload(defCase(), m.nodes[0] ? m.nodes[0].id : '', { Fz: -10 }));
      else if (tb === 'mload') m.loads.push(udl(defCase(), m.members[0] ? m.members[0].id : '', 5));
      else if (tb === 'combos') m.combos.push({ id: nextId(m.combos, 'C'), name: '', type: 'ULS', f: {} });
    }
    const defCase = () => (A.lcase !== 'all' && A.model.cases.some(c => c.id === A.lcase) ? A.lcase : (A.model.cases[0] || {}).id || '');

    // ------------------------------------------------------------------ html helpers
    const SUP = () => [['free', T('Free', 'อิสระ')], ['fixed', T('Fixed', 'ยึดแน่น')], ['pin', T('Pinned (X, Y, Z held)', 'หมุด (ยึด X, Y, Z)')], ['roller', T('Roller (Z held)', 'ล้อเลื่อน (ยึด Z)')], ['rollerX', T('Roller, slides in X', 'ล้อเลื่อน เลื่อนแกน X')], ['rollerY', T('Roller, slides in Y', 'ล้อเลื่อน เลื่อนแกน Y')], ['custom', T('Custom…', 'กำหนดเอง…')]];
    const DIRS = () => [['grav', T('Gravity ↓ (per length)', 'แรงโน้มถ่วง ↓ (ต่อความยาว)')], ['gravp', T('Gravity ↓ (per plan length)', 'แรงโน้มถ่วง ↓ (ต่อความยาวแนวราบ)')], ['gx', T('Global X', 'แกน X')], ['gy', T('Global Y', 'แกน Y')], ['gz', T('Global Z (+ up)', 'แกน Z (+ ขึ้น)')], ['ly', T('Local y', 'แกน y เฉพาะที่')], ['lz', T('Local z', 'แกน z เฉพาะที่')], ['lx', T('Local x (axial)', 'แกน x เฉพาะที่ (ตามแนวแกน)')]];
    const MDIRS = () => [['lz', T('about local z', 'รอบแกน z')], ['ly', T('about local y', 'รอบแกน y')], ['lx', T('torque (local x)', 'แรงบิด (แกน x)')], ['gx', T('about global X', 'รอบแกน X')], ['gy', T('about global Y', 'รอบแกน Y')], ['gz', T('about global Z', 'รอบแกน Z')]];
    const SECT = () => [['rect', T('Rectangle', 'สี่เหลี่ยม')], ['I', T('I-section', 'หน้าตัด I')], ['circ', T('Solid circle', 'วงกลมตัน')], ['tube', 'CHS / SHS / RHS'], ['user', T('User A, I, J', 'กำหนดเอง A, I, J')]];
    const CTYPES = () => [['G', T('G — dead', 'G — คงที่')], ['Q', T('Q — live', 'Q — จร')], ['W', T('W — wind', 'W — ลม')], ['E', T('E — earthquake', 'E — แผ่นดินไหว')], ['O', T('Other', 'อื่น ๆ')]];
    const sel = (opts, v, attrs) => `<select ${attrs}>${opts.map(o => `<option value="${esc(o[0])}" ${String(v) === String(o[0]) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
    const inp = (v, attrs, w) => `<input ${attrs} value="${esc(v == null ? '' : v)}" ${w ? `style="width:${w}px"` : ''}>`;
    const cell = (tbl, i, fld, v, type, w) => inp(v, `data-tb="${tbl}" data-i="${i}" data-f="${fld}" ${type === 'n' ? 'type="number" step="any" inputmode="decimal"' : ''}`, w);
    const del = (tb, i) => `<button class="icon-btn" data-act="an-del" data-tb="${tb}" data-i="${i}" aria-label="${T('Delete row', 'ลบแถว')}">×</button>`;
    const addBtn = (tb, lbl) => `<button class="linkbtn" data-act="an-add" data-tb="${tb}">+ ${lbl}</button>`;
    const fld = (lbl, html) => `<label class="an-f"><span>${lbl}</span>${html}</label>`;
    const ins = (k, v, type, w) => inp(v, `data-ins="${k}" ${type === 'n' ? 'type="number" step="any" inputmode="decimal"' : ''}`, w);
    const secOpts = () => A.model.sections.map(s => [s.id, s.id + (s.name ? ' · ' + s.name : '')]);
    const matOpts = () => A.model.materials.map(s => [s.id, s.id]);
    const caseOpts = () => A.model.cases.map(c => [c.id, c.id + ' — ' + c.name]);
    const loadRowsMember = rows => rows.length ? `<div class="tbl-wrap"><table class="an-t"><thead><tr><th>${T('Case', 'กรณี')}</th><th>${T('Load', 'ชนิด')}</th><th>${T('Direction', 'ทิศทาง')}</th><th>w₁ / P / M</th><th>w₂</th><th>a</th><th>b</th><th></th></tr></thead><tbody>${rows.map(([l, i]) => `<tr><td>${sel(A.model.cases.map(c => [c.id, c.id]), l.case, `data-tb="loads" data-i="${i}" data-f="case"`)}</td><td>${sel([['udl', T('Distributed', 'แผ่กระจาย')], ['point', T('Point', 'แรงจุด')], ['moment', T('Moment', 'โมเมนต์')]], l.kind, `data-tb="loads" data-i="${i}" data-f="kind"`)}</td><td>${sel(l.kind === 'moment' ? MDIRS() : DIRS(), l.dir || (l.kind === 'moment' ? 'lz' : 'grav'), `data-tb="loads" data-i="${i}" data-f="dir"`)}</td><td>${cell('loads', i, l.kind === 'udl' ? 'w1' : l.kind === 'point' ? 'P' : 'M', l.kind === 'udl' ? l.w1 : l.kind === 'point' ? l.P : l.M, 'n', 62)}</td><td>${l.kind === 'udl' ? cell('loads', i, 'w2', l.w2, 'n', 54) : ''}</td><td>${cell('loads', i, 'a', l.a, 'n', 48)}</td><td>${l.kind === 'udl' ? cell('loads', i, 'b', l.b, 'n', 48) : ''}</td><td>${del('loads', i)}</td></tr>`).join('')}</tbody></table></div>` : `<p class="hint">${T('No loads on this member.', 'ยังไม่มีแรงบนชิ้นส่วนนี้')}</p>`;
    const loadRowsNode = rows => rows.length ? `<div class="tbl-wrap"><table class="an-t"><thead><tr><th>${T('Case', 'กรณี')}</th><th>Fx</th><th>Fy</th><th>Fz</th><th>Mx</th><th>My</th><th>Mz</th><th></th></tr></thead><tbody>${rows.map(([l, i]) => `<tr><td>${sel(A.model.cases.map(c => [c.id, c.id]), l.case, `data-tb="loads" data-i="${i}" data-f="case"`)}</td>${['Fx', 'Fy', 'Fz', 'Mx', 'My', 'Mz'].map(q => `<td>${cell('loads', i, q, l[q] || 0, 'n', 50)}</td>`).join('')}<td>${del('loads', i)}</td></tr>`).join('')}</tbody></table></div>` : `<p class="hint">${T('No loads on this node.', 'ยังไม่มีแรงที่จุดต่อนี้')}</p>`;

    // ------------------------------------------------------------------ inspector (selection editor)
    function inspector() {
      const m = A.model, nN = A.sel.n.length, nM = A.sel.m.length, nd = nodeMap();
      const tools = `<div class="an-ihead"><b>${nN || nM ? (nN ? nN + ' ' + T(nN > 1 ? 'nodes' : 'node', 'จุดต่อ') : '') + (nN && nM ? ' · ' : '') + (nM ? nM + ' ' + T(nM > 1 ? 'members' : 'member', 'ชิ้นส่วน') : '') + ' ' + T('selected', 'ที่เลือก') : T('Nothing selected', 'ยังไม่ได้เลือก')}</b>
        <span class="grow"></span>${nN || nM ? `<button class="btn btn-ghost xs" data-act="an-clear">${T('Clear', 'ยกเลิก')}</button><button class="btn btn-ghost xs danger" data-act="an-delsel">${T('Delete', 'ลบ')}</button>` : `<button class="btn btn-ghost xs" data-act="an-selall">${T('Select all', 'เลือกทั้งหมด')}</button>`}</div>`;
      if (!nN && !nM) {
        return tools + `<div class="an-help"><p>${T('Click a node or member in the view to edit it. Shift-click to add to the selection, Ctrl-drag (or the Box tool) to select a window.', 'คลิกจุดต่อหรือชิ้นส่วนในมุมมองเพื่อแก้ไข กด Shift ค้างเพื่อเลือกเพิ่ม ลากพร้อม Ctrl (หรือใช้เครื่องมือกรอบ) เพื่อเลือกเป็นกรอบ')}</p>
          <p>${T('Draw: pick the Member tool and click node to node. In Plan or an Elevation you can click empty grid points to create nodes (snap ' + f(+A.opt.snap, 2) + ' m).', 'วาด: เลือกเครื่องมือชิ้นส่วน แล้วคลิกจากจุดต่อไปยังจุดต่อ ในแปลนหรือรูปด้าน คลิกตำแหน่งว่างเพื่อสร้างจุดต่อ (ระยะสแนป ' + f(+A.opt.snap, 2) + ' ม.)')}</p>
          <p class="hint">${T('Keys: Delete removes the selection, Esc stops drawing, Ctrl+Z / Ctrl+Y undo and redo.', 'ปุ่มลัด: Delete ลบที่เลือก Esc หยุดวาด Ctrl+Z / Ctrl+Y ย้อนกลับ / ทำซ้ำ')}</p></div>
          <div class="an-blk"><h4>${T('Add a node', 'เพิ่มจุดต่อ')}</h4><div class="an-row3">${fld('X', `<input id="an-nx" type="number" step="any" value="0">`)}${fld('Y', `<input id="an-ny" type="number" step="any" value="0">`)}${fld('Z', `<input id="an-nz" type="number" step="any" value="0">`)}</div><button class="btn btn-ghost xs" data-act="an-addnode">${T('Add node', 'เพิ่มจุดต่อ')}</button></div>
          <div class="an-blk an-stat"><span>${m.nodes.length} ${T('nodes', 'จุดต่อ')}</span><span>${m.members.length} ${T('members', 'ชิ้นส่วน')}</span><span>${m.loads.length} ${T('loads', 'แรง')}</span><span>${m.plane === 'XZ' ? T('2D frame (X–Z plane)', 'โครง 2 มิติ (ระนาบ X–Z)') : T('3D frame', 'โครง 3 มิติ')}</span></div>`;
      }
      let html = tools;
      if (nN === 1) {
        const n = nd[A.sel.n[0]], i = m.nodes.indexOf(n), fx6 = F.fixOf(n), rows = m.loads.map((l, k) => [l, k]).filter(([l]) => l.kind === 'node' && l.node === n.id);
        html += `<div class="an-blk"><h4>${T('Node', 'จุดต่อ')} ${esc(n.id)}</h4><div class="an-row4">${fld('ID', ins('nid', n.id))}${fld('X (m)', ins('x', n.x, 'n'))}${fld('Y (m)', ins('y', n.y, 'n'))}${fld('Z (m)', ins('z', n.z, 'n'))}</div>
          ${fld(T('Support', 'จุดรองรับ'), sel(SUP(), n.sup || 'free', 'data-ins="sup"'))}
          ${n.sup === 'custom' ? `<div class="an-fix">${['Ux', 'Uy', 'Uz', 'Rx', 'Ry', 'Rz'].map((lb, d) => `<label class="chkl"><input type="checkbox" data-ins="fix${d}" ${fx6[d] ? 'checked' : ''}> ${lb}</label>`).join('')}</div>` : ''}
          <details class="an-det"><summary>${T('Springs (kN/m, kNm/rad)', 'สปริง (kN/m, kNm/rad)')}</summary><div class="an-row3">${['kx', 'ky', 'kz', 'krx', 'kry', 'krz'].map(q => fld(q, ins(q, n[q] || '', 'n'))).join('')}</div></details>
          <h4>${T('Nodal loads', 'แรงที่จุดต่อ')} <span class="muted small">kN, kNm · ${T('global axes', 'แกนหลัก')}</span></h4>${loadRowsNode(rows)}
          <button class="linkbtn" data-act="an-addnl">+ ${T('Add nodal load', 'เพิ่มแรงที่จุดต่อ')}</button></div>`;
        void i;
      } else if (nN > 1) {
        html += `<div class="an-blk"><h4>${nN} ${T('nodes', 'จุดต่อ')}</h4>${fld(T('Support for all', 'จุดรองรับทั้งหมด'), sel([['', T('— keep —', '— คงเดิม —')]].concat(SUP().filter(s => s[0] !== 'custom')), '', 'data-ins="sup"'))}
          <h4>${T('Move by', 'เลื่อนไป')}</h4><div class="an-row3">${fld('ΔX', `<input id="an-mx" type="number" step="any" value="0">`)}${fld('ΔY', `<input id="an-my" type="number" step="any" value="0">`)}${fld('ΔZ', `<input id="an-mz" type="number" step="any" value="0">`)}</div><button class="btn btn-ghost xs" data-act="an-move">${T('Move nodes', 'เลื่อนจุดต่อ')}</button></div>`;
      }
      if (nN) html += `<div class="an-blk"><h4>${T('Add load to selected nodes', 'เพิ่มแรงให้จุดต่อที่เลือก')}</h4><div class="an-row4">${fld(T('Case', 'กรณี'), sel(caseOpts(), defCase(), 'id="an-nlc"'))}${['Fx', 'Fy', 'Fz'].map(q => fld(q, `<input id="an-n${q}" type="number" step="any" value="${q === 'Fz' ? -10 : 0}">`)).join('')}</div><div class="an-row4">${['Mx', 'My', 'Mz'].map(q => fld(q, `<input id="an-n${q}" type="number" step="any" value="0">`)).join('')}<span class="an-f"><span>&nbsp;</span><button class="btn btn-ghost xs" data-act="an-nl">${T('Add', 'เพิ่ม')}</button></span></div></div>`;
      if (nM === 1) {
        const q = m.members.find(z => z.id === A.sel.m[0]), i0 = nd[q.i], j0 = nd[q.j], L = i0 && j0 ? Math.hypot(...sub(P3(j0), P3(i0))) : 0, s = m.sections.find(z => z.id === q.sec), p = s ? F.secProps(s) : null;
        const rows = m.loads.map((l, k) => [l, k]).filter(([l]) => l.kind !== 'node' && l.member === q.id), nOpts = m.nodes.map(n => [n.id, n.id]);
        html += `<div class="an-blk"><h4>${T('Member', 'ชิ้นส่วน')} ${esc(q.id)} <span class="muted small">L = ${f(L, 3)} m</span></h4>
          <div class="an-row3">${fld('ID', ins('mid', q.id))}${fld(T('Node i', 'จุด i'), sel(nOpts, q.i, 'data-ins="i"'))}${fld(T('Node j', 'จุด j'), sel(nOpts, q.j, 'data-ins="j"'))}</div>
          <div class="an-row2">${fld(T('Section', 'หน้าตัด'), sel(secOpts(), q.sec, 'data-ins="sec"'))}${fld(T('Material', 'วัสดุ'), sel(matOpts(), q.mat, 'data-ins="mat"'))}</div>
          <div class="an-row3">${fld(T('Type', 'ชนิด'), sel([['frame', T('Frame', 'โครงข้อแข็ง')], ['truss', T('Truss (axial only)', 'โครงถัก (แรงตามแนวแกน)')]], q.type || 'frame', 'data-ins="type"'))}${fld(T('Rotation β (°)', 'มุมหมุน β (°)'), ins('beta', q.beta || 0, 'n'))}<span class="an-f"><span>${T('Hinges', 'บานพับ')}</span><span class="an-chk"><label class="chkl"><input type="checkbox" data-ins="relI" ${q.relI ? 'checked' : ''} ${q.type === 'truss' ? 'disabled' : ''}> i</label><label class="chkl"><input type="checkbox" data-ins="relJ" ${q.relJ ? 'checked' : ''} ${q.type === 'truss' ? 'disabled' : ''}> j</label></span></span></div>
          ${p ? `<p class="hint">A = ${f(p.A, 0)} mm² · I<sub>z</sub> = ${f(p.Iz / 1e6, 1)} · I<sub>y</sub> = ${f(p.Iy / 1e6, 1)} · J = ${f(p.J / 1e6, 2)} ×10⁶ mm⁴ · ${T('local axes: x red, y green, z blue', 'แกนเฉพาะที่: x แดง y เขียว z น้ำเงิน')}</p>` : ''}
          <h4>${T('Member loads', 'แรงบนชิ้นส่วน')} <span class="muted small">kN/m, kN, kNm · a, b ${T('from end i (m)', 'จากปลาย i (ม.)')}</span></h4>${loadRowsMember(rows)}
          <div class="an-adds"><button class="linkbtn" data-act="an-addml" data-k="udl">+ ${T('Distributed', 'แผ่กระจาย')}</button><button class="linkbtn" data-act="an-addml" data-k="point">+ ${T('Point', 'แรงจุด')}</button><button class="linkbtn" data-act="an-addml" data-k="moment">+ ${T('Moment', 'โมเมนต์')}</button></div>
          <div class="an-row3 an-split">${fld(T('Split into', 'แบ่งเป็น'), `<input id="an-splitn" type="number" min="2" max="20" value="2">`)}<span class="an-f"><span>&nbsp;</span><button class="btn btn-ghost xs" data-act="an-split">${T('Split member', 'แบ่งชิ้นส่วน')}</button></span></div></div>`;
      } else if (nM > 1) {
        html += `<div class="an-blk"><h4>${nM} ${T('members', 'ชิ้นส่วน')} — ${T('assign', 'กำหนดค่า')}</h4>
          <div class="an-row2">${fld(T('Section', 'หน้าตัด'), sel([['', T('— keep —', '— คงเดิม —')]].concat(secOpts()), '', 'data-ins="sec"'))}${fld(T('Material', 'วัสดุ'), sel([['', T('— keep —', '— คงเดิม —')]].concat(matOpts()), '', 'data-ins="mat"'))}</div>
          <div class="an-row3">${fld(T('Type', 'ชนิด'), sel([['', T('— keep —', '— คงเดิม —')], ['frame', T('Frame', 'โครงข้อแข็ง')], ['truss', T('Truss', 'โครงถัก')]], '', 'data-ins="type"'))}${fld(T('Hinges', 'บานพับ'), sel([['', T('— keep —', '— คงเดิม —')], ['none', T('None', 'ไม่มี')], ['i', 'i'], ['j', 'j'], ['both', T('Both ends', 'ทั้งสองปลาย')]], '', 'data-ins="hinge"'))}${fld('β (°)', inp('', 'data-ins="beta" type="number" step="any" placeholder="—"'))}</div></div>`;
      }
      if (nM) html += `<div class="an-blk"><h4>${T('Add load to selected members', 'เพิ่มแรงให้ชิ้นส่วนที่เลือก')}</h4><div class="an-row4">${fld(T('Case', 'กรณี'), sel(caseOpts(), defCase(), 'id="an-mlc"'))}${fld(T('Load', 'ชนิด'), sel([['udl', T('Distributed', 'แผ่กระจาย')], ['point', T('Point at mid', 'แรงจุดกึ่งกลาง')]], 'udl', 'id="an-mlk"'))}${fld(T('Direction', 'ทิศทาง'), sel(DIRS(), 'grav', 'id="an-mld"'))}${fld(T('Value', 'ค่า'), `<input id="an-mlv" type="number" step="any" value="10">`)}</div>
          <div class="an-adds"><button class="btn btn-ghost xs" data-act="an-ml">${T('Add load', 'เพิ่มแรง')}</button><button class="btn btn-ghost xs" data-act="an-mlclear">${T('Remove loads of this case', 'ลบแรงของกรณีนี้')}</button></div></div>`;
      html += `<details class="an-blk an-det" ${A.repOpen ? 'open' : ''} id="an-rep"><summary><b>${T('Replicate / extrude', 'คัดลอก / ยืด')}</b></summary><div class="an-row4">${fld('ΔX', `<input id="an-rx" type="number" step="any" value="${A.rep ? A.rep[0] : 0}">`)}${fld('ΔY', `<input id="an-ry" type="number" step="any" value="${A.rep ? A.rep[1] : 0}">`)}${fld('ΔZ', `<input id="an-rz" type="number" step="any" value="${A.rep ? A.rep[2] : 3.5}">`)}${fld(T('Copies', 'จำนวน'), `<input id="an-rn" type="number" min="1" max="50" value="${A.rep ? A.rep[3] : 1}">`)}</div>
        <label class="chkl"><input type="checkbox" id="an-rc" ${A.rep && A.rep[4] ? 'checked' : ''}> ${T('Connect the selected nodes to their copies (e.g. columns)', 'เชื่อมจุดต่อที่เลือกกับสำเนา (เช่น เสา)')}</label><label class="chkl"><input type="checkbox" id="an-rl" ${!A.rep || A.rep[5] ? 'checked' : ''}> ${T('Copy loads too', 'คัดลอกแรงด้วย')}</label>
        <button class="btn btn-ghost xs" data-act="an-replicate">${T('Replicate', 'คัดลอก')}</button></details>`;
      return html;
    }
    function applyIns(t) {
      const k = t.dataset.ins, m = A.model, v = t.type === 'checkbox' ? t.checked : t.value, nd = nodeMap();
      snap();
      const nodes = A.sel.n.map(id => nd[id]).filter(Boolean), mems = A.sel.m.map(id => m.members.find(q => q.id === id)).filter(Boolean);
      let side = false;
      const NK = ['nid', 'x', 'y', 'z', 'sup', 'kx', 'ky', 'kz', 'krx', 'kry', 'krz'];
      if (nodes.length && (NK.includes(k) || /^fix\d$/.test(k))) {
        if (k === 'nid') { if (nodes.length !== 1) return; const nid = String(v).trim(); if (!nid || m.nodes.some(q => q !== nodes[0] && q.id === nid)) { t.classList.add('bad'); return; } t.classList.remove('bad'); renameRefs('nodes', nodes[0].id, nid); nodes[0].id = nid; }
        else if (['x', 'y', 'z'].includes(k)) { if (v === '' || !isFinite(+v)) return; nodes.forEach(n => { n[k] = +v; }); }
        else if (k === 'sup') { if (!v) return; nodes.forEach(n => { n.sup = v; if (v === 'custom' && !n.fix) n.fix = F.SUPS.pin.slice(); }); side = true; }
        else if (/^fix\d$/.test(k)) { const d = +k.slice(3); nodes.forEach(n => { n.fix = F.fixOf(n).slice(); n.sup = 'custom'; n.fix[d] = v ? 1 : 0; }); }
        else nodes.forEach(n => { if (v === '' || !(+v)) delete n[k]; else n[k] = +v; });
      } else if (mems.length) {
        if (k === 'mid') { if (mems.length !== 1) return; const nid = String(v).trim(); if (!nid || m.members.some(q => q !== mems[0] && q.id === nid)) { t.classList.add('bad'); return; } t.classList.remove('bad'); renameRefs('members', mems[0].id, nid); mems[0].id = nid; }
        else if ((k === 'i' || k === 'j') && mems.length === 1) { mems[0][k] = v; side = true; }
        else if (k === 'sec' || k === 'mat') { if (!v) return; mems.forEach(q => { q[k] = v; }); if (k === 'sec') A.lastSec = v; else A.lastMat = v; side = mems.length === 1; }
        else if (k === 'type') { if (!v) return; mems.forEach(q => { q.type = v; }); side = true; }
        else if (k === 'relI' || k === 'relJ') mems.forEach(q => { q[k] = !!v; });
        else if (k === 'hinge') { if (!v) return; mems.forEach(q => { q.relI = v === 'i' || v === 'both'; q.relJ = v === 'j' || v === 'both'; }); }
        else if (k === 'beta') { if (v === '' || !isFinite(+v)) return; mems.forEach(q => { q.beta = +v; }); }
      } else return;
      changed(side);
    }

    // ------------------------------------------------------------------ tables (bulk editing)
    function tables() {
      const m = A.model, t = A.tab;
      const tabs = [['nodes', T('Nodes', 'จุดต่อ')], ['members', T('Members', 'ชิ้นส่วน')], ['sections', T('Sections', 'หน้าตัด')], ['materials', T('Materials', 'วัสดุ')], ['cases', T('Load cases', 'กรณีน้ำหนัก')], ['nloads', T('Nodal loads', 'แรงที่จุดต่อ')], ['mloads', T('Member loads', 'แรงบนชิ้นส่วน')], ['combos', T('Combinations', 'กรณีรวมแรง')], ['settings', T('Analysis', 'การวิเคราะห์')]];
      const nodeOpts = m.nodes.map(n => [n.id, n.id]), memOpts = m.members.map(n => [n.id, n.id]), cOpts = m.cases.map(c => [c.id, c.id]);
      const big = n => n > 300 ? `<p class="hint">${T('Showing the first 300 rows — select items in the view to edit the rest.', 'แสดง 300 แถวแรก — เลือกในมุมมองเพื่อแก้ไขส่วนที่เหลือ')}</p>` : '';
      let body = '';
      if (t === 'nodes') body = `<div class="tbl-wrap"><table class="an-t"><thead><tr><th>ID</th><th>X</th><th>Y</th><th>Z</th><th>${T('Support', 'จุดรองรับ')}</th><th></th></tr></thead><tbody>${m.nodes.slice(0, 300).map((n, i) => `<tr class="${A.sel.n.includes(n.id) ? 'on' : ''}"><td>${cell('nodes', i, 'id', n.id, '', 52)}</td><td>${cell('nodes', i, 'x', n.x, 'n', 60)}</td><td>${cell('nodes', i, 'y', n.y, 'n', 60)}</td><td>${cell('nodes', i, 'z', n.z, 'n', 60)}</td><td>${sel(SUP(), n.sup || 'free', `data-tb="nodes" data-i="${i}" data-f="sup"`)}</td><td>${del('nodes', i)}</td></tr>`).join('')}</tbody></table></div>${big(m.nodes.length)}${addBtn('nodes', T('Add node', 'เพิ่มจุดต่อ'))}`;
      else if (t === 'members') body = `<div class="tbl-wrap"><table class="an-t"><thead><tr><th>ID</th><th>i</th><th>j</th><th>${T('Section', 'หน้าตัด')}</th><th>${T('Material', 'วัสดุ')}</th><th>${T('Type', 'ชนิด')}</th><th>${T('Hinge i / j', 'บานพับ i / j')}</th><th>β°</th><th>L (m)</th><th></th></tr></thead><tbody>${m.members.slice(0, 300).map((mb, i) => { const nd = nodeMap(), a = nd[mb.i], b = nd[mb.j], L = a && b ? Math.hypot(...sub(P3(b), P3(a))) : 0; return `<tr class="${A.sel.m.includes(mb.id) ? 'on' : ''}"><td>${cell('members', i, 'id', mb.id, '', 52)}</td><td>${sel(nodeOpts, mb.i, `data-tb="members" data-i="${i}" data-f="i"`)}</td><td>${sel(nodeOpts, mb.j, `data-tb="members" data-i="${i}" data-f="j"`)}</td><td>${sel(secOpts().map(o => [o[0], o[0]]), mb.sec, `data-tb="members" data-i="${i}" data-f="sec"`)}</td><td>${sel(matOpts(), mb.mat, `data-tb="members" data-i="${i}" data-f="mat"`)}</td><td>${sel([['frame', T('Frame', 'โครงข้อแข็ง')], ['truss', T('Truss', 'โครงถัก')]], mb.type || 'frame', `data-tb="members" data-i="${i}" data-f="type"`)}</td><td class="chk2"><input type="checkbox" data-tb="members" data-i="${i}" data-f="relI" ${mb.relI ? 'checked' : ''} ${mb.type === 'truss' ? 'disabled' : ''} aria-label="hinge i"><input type="checkbox" data-tb="members" data-i="${i}" data-f="relJ" ${mb.relJ ? 'checked' : ''} ${mb.type === 'truss' ? 'disabled' : ''} aria-label="hinge j"></td><td>${cell('members', i, 'beta', mb.beta || 0, 'n', 46)}</td><td class="mono">${f(L, 3)}</td><td>${del('members', i)}</td></tr>`; }).join('')}</tbody></table></div>${big(m.members.length)}${addBtn('members', T('Add member', 'เพิ่มชิ้นส่วน'))}`;
      else if (t === 'sections') body = `<div class="tbl-wrap"><table class="an-t"><thead><tr><th>ID</th><th>${T('Name', 'ชื่อ')}</th><th>${T('Type', 'ชนิด')}</th><th>${T('Dimensions (mm) / properties', 'ขนาด (มม.) / คุณสมบัติ')}</th><th>A (mm²)</th><th>I<sub>z</sub> / I<sub>y</sub> (×10⁶)</th><th></th></tr></thead><tbody>${m.sections.map((s, i) => { const p = F.secProps(s); const dims = s.type === 'rect' ? `b ${cell('sections', i, 'b', s.b, 'n', 54)} h ${cell('sections', i, 'h', s.h, 'n', 54)}` : s.type === 'I' ? `d ${cell('sections', i, 'd', s.d, 'n', 50)} bf ${cell('sections', i, 'bf', s.bf, 'n', 50)} tf ${cell('sections', i, 'tf', s.tf, 'n', 44)} tw ${cell('sections', i, 'tw', s.tw, 'n', 44)}` : s.type === 'circ' ? `D ${cell('sections', i, 'D', s.D, 'n', 60)}` : s.type === 'tube' ? `${sel([['CHS', 'CHS'], ['SHS', 'SHS'], ['RHS', 'RHS']], s.shape || 'SHS', `data-tb="sections" data-i="${i}" data-f="shape"`)} ${sel((G.GANTRY ? G.GANTRY.sizeOptions(s.shape || 'SHS') : []).map(o => [o[0], o[1]]), s.size, `data-tb="sections" data-i="${i}" data-f="size"`)}` : `A ${cell('sections', i, 'A', s.A, 'n', 70)} I<sub>z</sub> ${cell('sections', i, 'Iz', s.Iz || s.I, 'n', 86)} I<sub>y</sub> ${cell('sections', i, 'Iy', s.Iy, 'n', 86)} J ${cell('sections', i, 'J', s.J, 'n', 80)}`; return `<tr><td>${cell('sections', i, 'id', s.id, '', 56)}</td><td>${cell('sections', i, 'name', s.name || '', '', 120)}</td><td>${sel(SECT(), s.type, `data-tb="sections" data-i="${i}" data-f="type"`)}</td><td class="dims">${dims}</td><td class="mono">${f(p.A, 0)}</td><td class="mono">${f(p.Iz / 1e6, 1)} / ${f(p.Iy / 1e6, 1)}</td><td>${del('sections', i)}</td></tr>`; }).join('')}</tbody></table></div>${addBtn('sections', T('Add section', 'เพิ่มหน้าตัด'))}<p class="hint">${T('Depth h (d, D) lies along the member local y axis, so I_z is the major axis. Rotate a member with β.', 'ความลึก h (d, D) อยู่ตามแกน y เฉพาะที่ของชิ้นส่วน I_z จึงเป็นแกนหลัก หมุนชิ้นส่วนด้วย β')}</p>`;
      else if (t === 'materials') body = `<table class="an-t"><thead><tr><th>ID</th><th>${T('Name', 'ชื่อ')}</th><th>E (MPa)</th><th>ν</th><th>${T('Unit weight (kN/m³)', 'หน่วยน้ำหนัก (kN/m³)')}</th><th></th></tr></thead><tbody>${m.materials.map((s, i) => `<tr><td>${cell('materials', i, 'id', s.id, '', 70)}</td><td>${cell('materials', i, 'name', s.name || '', '', 130)}</td><td>${cell('materials', i, 'E', s.E, 'n', 76)}</td><td>${cell('materials', i, 'nu', s.nu === undefined ? 0.3 : s.nu, 'n', 50)}</td><td>${cell('materials', i, 'rho', s.rho, 'n', 64)}</td><td>${del('materials', i)}</td></tr>`).join('')}</tbody></table><div class="an-adds">${addBtn('materials', T('Add material', 'เพิ่มวัสดุ'))} <button class="linkbtn" data-act="an-mat" data-m="steel">+ ${T('Steel', 'เหล็ก')}</button> <button class="linkbtn" data-act="an-mat" data-m="conc">+ ${T('Concrete 32 MPa', 'คอนกรีต 32 MPa')}</button> <button class="linkbtn" data-act="an-mat" data-m="timber">+ ${T('Timber', 'ไม้')}</button></div>`;
      else if (t === 'cases') body = `<table class="an-t"><thead><tr><th>ID</th><th>${T('Name', 'ชื่อ')}</th><th>${T('Type', 'ประเภท')}</th><th>${T('Self-weight', 'น้ำหนักตัวเอง')}</th><th></th></tr></thead><tbody>${m.cases.map((c, i) => `<tr><td>${cell('cases', i, 'id', c.id, '', 52)}</td><td>${cell('cases', i, 'name', c.name, '', 160)}</td><td>${sel(CTYPES(), c.type, `data-tb="cases" data-i="${i}" data-f="type"`)}</td><td><input type="checkbox" data-tb="cases" data-i="${i}" data-f="sw" ${c.sw ? 'checked' : ''} aria-label="self-weight"></td><td>${del('cases', i)}</td></tr>`).join('')}</tbody></table>${addBtn('cases', T('Add load case', 'เพิ่มกรณีน้ำหนัก'))}`;
      else if (t === 'nloads') { const rows = m.loads.map((l, i) => [l, i]).filter(([l]) => l.kind === 'node'); body = `<p class="hint">${T('Global axes, Z up. kN, kNm.', 'แกนหลัก Z ชี้ขึ้น หน่วย kN, kNm')}</p><div class="tbl-wrap"><table class="an-t"><thead><tr><th>${T('Case', 'กรณี')}</th><th>${T('Node', 'จุดต่อ')}</th><th>Fx</th><th>Fy</th><th>Fz</th><th>Mx</th><th>My</th><th>Mz</th><th></th></tr></thead><tbody>${rows.slice(0, 300).map(([l, i]) => `<tr><td>${sel(cOpts, l.case, `data-tb="loads" data-i="${i}" data-f="case"`)}</td><td>${sel(nodeOpts, l.node, `data-tb="loads" data-i="${i}" data-f="node"`)}</td>${['Fx', 'Fy', 'Fz', 'Mx', 'My', 'Mz'].map(q => `<td>${cell('loads', i, q, l[q] || 0, 'n', 52)}</td>`).join('')}<td>${del('loads', i)}</td></tr>`).join('')}</tbody></table></div>${big(rows.length)}${addBtn('nload', T('Add nodal load', 'เพิ่มแรงที่จุดต่อ'))}`; }
      else if (t === 'mloads') { const rows = m.loads.map((l, i) => [l, i]).filter(([l]) => l.kind !== 'node'); body = `<p class="hint">${T('UDL: w₁ → w₂ (kN/m) from a to b (m from end i; blank b = to end j). Point: P (kN) at a. Moment: M (kNm) at a. Gravity takes positive values downward.', 'แผ่กระจาย: w₁ → w₂ (kN/m) จาก a ถึง b (ม. จากปลาย i; เว้นว่าง b = ถึงปลาย j) แรงจุด: P (kN) ที่ a โมเมนต์: M (kNm) ที่ a แรงโน้มถ่วงใช้ค่าบวกเมื่อกดลง')}</p><div class="tbl-wrap"><table class="an-t"><thead><tr><th>${T('Case', 'กรณี')}</th><th>${T('Member', 'ชิ้นส่วน')}</th><th>${T('Load', 'ชนิด')}</th><th>${T('Direction', 'ทิศทาง')}</th><th>w₁ / P / M</th><th>w₂</th><th>a</th><th>b</th><th></th></tr></thead><tbody>${rows.slice(0, 300).map(([l, i]) => `<tr><td>${sel(cOpts, l.case, `data-tb="loads" data-i="${i}" data-f="case"`)}</td><td>${sel(memOpts, l.member, `data-tb="loads" data-i="${i}" data-f="member"`)}</td><td>${sel([['udl', T('Distributed', 'แผ่กระจาย')], ['point', T('Point', 'แรงจุด')], ['moment', T('Moment', 'โมเมนต์')]], l.kind, `data-tb="loads" data-i="${i}" data-f="kind"`)}</td><td>${sel(l.kind === 'moment' ? MDIRS() : DIRS(), l.dir || (l.kind === 'moment' ? 'lz' : 'grav'), `data-tb="loads" data-i="${i}" data-f="dir"`)}</td><td>${cell('loads', i, l.kind === 'udl' ? 'w1' : l.kind === 'point' ? 'P' : 'M', l.kind === 'udl' ? l.w1 : l.kind === 'point' ? l.P : l.M, 'n', 60)}</td><td>${l.kind === 'udl' ? cell('loads', i, 'w2', l.w2, 'n', 52) : ''}</td><td>${cell('loads', i, 'a', l.a, 'n', 46)}</td><td>${l.kind === 'udl' ? cell('loads', i, 'b', l.b, 'n', 46) : ''}</td><td>${del('loads', i)}</td></tr>`).join('')}</tbody></table></div>${big(rows.length)}${addBtn('mload', T('Add member load', 'เพิ่มแรงบนชิ้นส่วน'))}`; }
      else if (t === 'combos') body = `<div class="an-preset"><span>${T('Generate from', 'สร้างตาม')}</span>${sel([['AS', 'AS/NZS 1170.0'], ['EC', 'EN 1990 (Eurocode)'], ['ASCE', 'ASCE 7 (LRFD)']], m.code || 'AS', 'id="an-code"')}<button class="btn btn-ghost xs" data-act="an-gen">${T('Generate combinations', 'สร้างกรณีรวมแรง')}</button></div>
        <div class="tbl-wrap"><table class="an-t"><thead><tr><th>ID</th><th>${T('Name', 'ชื่อ')}</th><th>${T('Type', 'ชนิด')}</th>${m.cases.map(c => `<th>${esc(c.id)}</th>`).join('')}<th></th></tr></thead><tbody>${m.combos.map((c, i) => `<tr><td>${cell('combos', i, 'id', c.id, '', 44)}</td><td>${cell('combos', i, 'name', c.name, '', 150)}</td><td>${sel([['ULS', 'ULS'], ['SLS', 'SLS']], c.type, `data-tb="combos" data-i="${i}" data-f="type"`)}</td>${m.cases.map(cs => `<td>${inp((c.f || {})[cs.id] || '', `data-tb="combos" data-i="${i}" data-f="f.${esc(cs.id)}" type="number" step="any"`, 48)}</td>`).join('')}<td>${del('combos', i)}</td></tr>`).join('')}</tbody></table></div>${addBtn('combos', T('Add combination', 'เพิ่มกรณีรวมแรง'))}`;
      else {
        const o = A.opt, lock = pro() ? '' : 'disabled';
        body = `<div class="an-set">
          ${fld(T('Model type', 'ชนิดแบบจำลอง'), sel([['', T('3D frame (6 DOF per node)', 'โครง 3 มิติ (6 องศาอิสระต่อจุด)')], ['XZ', T('2D frame in the X–Z plane', 'โครง 2 มิติ ในระนาบ X–Z')]], m.plane || '', 'data-opt="plane"'))}
          ${fld(T('Grid snap when clicking (m)', 'ระยะสแนปเมื่อคลิก (ม.)'), `<input type="number" step="any" min="0" data-opt="snap" value="${o.snap}">`)}
          <p><b>${T('Linear static', 'สถิตเชิงเส้น')}</b> — ${T('always on: every load case, combinations by superposition, envelopes.', 'คำนวณเสมอ: ทุกกรณีน้ำหนัก กรณีรวมแรงโดยการซ้อนทับ และค่าสูงสุด/ต่ำสุด')}</p>
          ${pro() ? '' : `<p class="notice warn">${T('P-Delta, modal and buckling analyses, models over ' + FREE_MEMBERS + ' members and the analysis report are Pro features.', 'การวิเคราะห์ P-Delta โหมด และการโก่งเดาะ โมเดลเกิน ' + FREE_MEMBERS + ' ชิ้นส่วน และรายงานการวิเคราะห์ สำหรับสมาชิก Pro')}</p>`}
          <label class="chkl"><input type="checkbox" data-opt="pdelta" ${o.pdelta ? 'checked' : ''} ${lock}> <b>${T('P-Delta (second-order)', 'P-Delta (อันดับสอง)')}</b> — ${T('combinations solved iteratively with geometric stiffness; members subdivided internally (P-Δ and P-δ).', 'แก้กรณีรวมแรงแบบวนซ้ำด้วย geometric stiffness แบ่งชิ้นส่วนย่อยภายใน (P-Δ และ P-δ)')}</label>
          <label class="chkl"><input type="checkbox" data-opt="modes" ${o.modes ? 'checked' : ''} ${lock}> <b>${T('Modal analysis', 'การวิเคราะห์โหมด')}</b> — ${T('natural frequencies, periods, mode shapes and mass participation in X, Y, Z.', 'ความถี่ธรรมชาติ คาบ รูปโหมด และสัดส่วนมวลในแกน X, Y, Z')}</label>
          <div class="an-row">${fld(T('Modes', 'จำนวนโหมด'), `<input type="number" min="1" max="20" data-opt="nmodes" value="${o.nmodes}" ${lock}>`)}${fld(T('Mass: G ×', 'มวล: G ×'), `<input type="number" step="any" data-opt="massG" value="${o.massG}" ${lock}>`)}${fld('Q ×', `<input type="number" step="any" data-opt="massQ" value="${o.massQ}" ${lock}>`)}</div>
          <label class="chkl"><input type="checkbox" data-opt="buckling" ${o.buckling ? 'checked' : ''} ${lock}> <b>${T('Elastic buckling', 'การโก่งเดาะแบบยืดหยุ่น')}</b> — ${T('critical load factor λcr for every ULS combination (λcr < 10: second-order effects matter — AS 4100 §4.4, EN 1993-1-1 §5.2.1).', 'ตัวคูณแรงวิกฤต λcr ของทุกกรณีรวมแรง ULS (λcr < 10: ต้องพิจารณาผลอันดับสอง — AS 4100 §4.4, EN 1993-1-1 §5.2.1)')}</label>
          <div class="an-row">${fld(T('Internal segments per member', 'จำนวนส่วนย่อยต่อชิ้นส่วน'), `<input type="number" min="2" max="10" data-opt="nseg" value="${o.nseg}" ${lock}>`)}</div>
          <p class="hint">${T('Signs: N tension +. M_z + gives tension on the −y side, M_y + on the −z side (local axes). Reactions + along +X, +Y, +Z. Member local axes: x from i to j, y in the vertical plane (up), z = x × y; vertical members: y = +X.', 'เครื่องหมาย: N แรงดึง + M_z บวกเมื่อดึงด้าน −y, M_y บวกเมื่อดึงด้าน −z (แกนเฉพาะที่) แรงปฏิกิริยา + ตาม +X, +Y, +Z แกนเฉพาะที่: x จาก i ไป j, y อยู่ในระนาบดิ่งชี้ขึ้น, z = x × y; ชิ้นส่วนแนวดิ่ง y = +X')}</p></div>`;
      }
      return `<div class="an-tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${t === k}" data-act="an-tab" data-t="${k}">${l}</button>`).join('')}</div><div class="an-tb">${body}</div>`;
    }
    function sideHTML() {
      return `<div class="seg an-sidetabs" role="tablist"><button data-act="an-side" data-s="edit" aria-pressed="${A.side === 'edit'}">${T('Selection', 'ที่เลือก')}</button><button data-act="an-side" data-s="tables" aria-pressed="${A.side === 'tables'}">${T('Tables & settings', 'ตารางและการตั้งค่า')}</button></div>
        <div class="an-sidebody">${A.side === 'edit' ? inspector() : tables()}</div>`;
    }
    function sideRefresh() { const s = $('#anSide'); if (!s) return; const b = s.querySelector('.an-sidebody'), sc = b ? b.scrollTop : 0; s.innerHTML = sideHTML(); const nb = s.querySelector('.an-sidebody'); if (nb) nb.scrollTop = sc; }

    // ------------------------------------------------------------------ results panel
    function resultsHTML() {
      if (A.err) return `<p class="form-err">${esc(A.err)}</p>`;
      const r = A.res; if (!r) return '';
      const cur = current(), m = A.model, env = cur && cur.kind === 'env';
      const rt = A.rtab, tabs = [['sum', T('Summary', 'สรุป')], ['react', T('Reactions', 'แรงปฏิกิริยา')], ['forces', T('Member forces', 'แรงในชิ้นส่วน')], ['disp', T('Displacements', 'การเคลื่อนตัว')], ['drift', T('Storey drift', 'การเคลื่อนตัวระหว่างชั้น')], ['modal', T('Modal', 'โหมด')], ['buck', T('Buckling', 'การโก่งเดาะ')]];
      const ext2 = (mm, q) => { if (env) return [Math.max(...mm[q + 'max']), Math.min(...mm[q + 'min'])]; return [Math.max(...mm[q]), Math.min(...mm[q])]; };
      const amax = (mm, q) => { const e = ext2(mm, q); return Math.max(Math.abs(e[0]), Math.abs(e[1])); };
      let body = '';
      const heavy = A.heavy ? `<p class="notice warn">${T('Large model: P-Delta, modal and buckling run when you press Run analysis.', 'โมเดลขนาดใหญ่: P-Delta โหมด และการโก่งเดาะ จะคำนวณเมื่อกดปุ่ม วิเคราะห์')} <button class="btn btn-hot xs" data-act="an-runall">${T('Run analysis', 'วิเคราะห์')}</button></p>` : '';
      if (rt === 'sum') {
        const best = {}; if (cur) cur.mem.forEach(mm => { ['N', 'Vy', 'Vz', 'T', 'My', 'Mz'].forEach(q => { const v = amax(mm, q); if (!best[q] || v > best[q][0]) best[q] = [v, mm.id]; }); const e = ext2(mm, 'N'); if (!best.Nt || e[0] > best.Nt[0]) best.Nt = [e[0], mm.id]; if (!best.Nc || e[1] < best.Nc[0]) best.Nc = [e[1], mm.id]; });
        let md = null; if (cur && !env) cur.mem.forEach(mm => mm.x.forEach((x, i) => { const d = Math.hypot(mm.dx[i], mm.dy[i], mm.dz[i]); if (!md || d > md.d) md = { d, id: mm.id, x }; }));
        const kv = (k, v, u) => `<div><dt>${k}</dt><dd class="mono">${v} <span class="u">${u}</span></dd></div>`, bv = (q, u) => best[q] ? kv('|' + COMPS.find(c => c[0] === q)[1] + '| max', fx(best[q][0]), u + ' · ' + esc(best[q][1])) : '';
        body = heavy + `<dl class="kv an-kv">${bv('Mz', 'kNm')}${bv('My', 'kNm')}${bv('Vy', 'kN')}${bv('Vz', 'kN')}${bv('T', 'kNm')}${best.Nt ? kv(T('Max tension', 'แรงดึงสูงสุด'), fx(best.Nt[0]), 'kN · ' + esc(best.Nt[1])) : ''}${best.Nc ? kv(T('Max compression', 'แรงอัดสูงสุด'), fx(best.Nc[0]), 'kN · ' + esc(best.Nc[1])) : ''}${md ? kv(T('Max displacement', 'การเคลื่อนตัวสูงสุด'), fx(md.d * 1000) + ' mm', '· ' + esc(md.id) + ' @ ' + f(md.x, 2) + ' m') : ''}${kv(T('Model', 'แบบจำลอง'), m.nodes.length + ' / ' + m.members.length, T('nodes / members', 'จุดต่อ / ชิ้นส่วน'))}${kv(T('Solved in', 'เวลาคำนวณ'), r.ms, 'ms')}</dl>
          ${r.modal && r.modal.modes.length ? `<p class="muted">${T('Fundamental period', 'คาบพื้นฐาน')} T₁ = <b class="mono">${f(r.modal.modes[0].T, 3)} s</b> (f₁ = ${f(r.modal.modes[0].f, 3)} Hz)</p>` : ''}
          ${r.buckling ? `<p class="muted">${T('Lowest buckling factor', 'ตัวคูณการโก่งเดาะต่ำสุด')} λcr = <b class="mono">${fx(Math.min(...Object.values(r.buckling).map(b => (b.modes && b.modes[0] ? b.modes[0].lam : Infinity))))}</b></p>` : ''}
          ${r.warn.length ? `<ul class="warn-list">${r.warn.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}`;
      } else if (rt === 'react') {
        const rows = m.nodes.map((n, i) => [n, i]).filter(([n]) => F.fixOf(n).some(Boolean) || ['kx', 'ky', 'kz', 'krx', 'kry', 'krz'].some(q => +n[q] > 0));
        body = !cur ? '' : `<div class="tbl-wrap"><table class="chk an-r"><thead><tr><th>${T('Node', 'จุดต่อ')}</th>${['Rx', 'Ry', 'Rz'].map(q => `<th class="num">${q} (kN)</th>`).join('')}${['Mx', 'My', 'Mz'].map(q => `<th class="num">${q} (kNm)</th>`).join('')}</tr></thead><tbody>${rows.map(([n, i]) => `<tr><td>${esc(n.id)}</td>${[0, 1, 2, 3, 4, 5].map(d => `<td class="num mono">${env ? fx(cur.R[6 * i + d][0], 1) + ' … ' + fx(cur.R[6 * i + d][1], 1) : fx(cur.R[6 * i + d])}</td>`).join('')}</tr>`).join('')}
          ${env ? '' : `<tr class="tot"><td>Σ</td>${[0, 1, 2].map(d => `<td class="num mono">${fx(rows.reduce((s, [, i]) => s + cur.R[6 * i + d], 0))}</td>`).join('')}<td></td><td></td><td></td></tr>`}</tbody></table></div>`;
      } else if (rt === 'forces') {
        body = !cur ? '' : `<div class="tbl-wrap"><table class="chk an-r"><thead><tr><th>${T('Member', 'ชิ้นส่วน')}</th><th class="num">L</th><th class="num">N max</th><th class="num">N min</th><th class="num">|V<sub>y</sub>|</th><th class="num">|V<sub>z</sub>|</th><th class="num">|T|</th><th class="num">M<sub>y</sub> max</th><th class="num">M<sub>y</sub> min</th><th class="num">M<sub>z</sub> max</th><th class="num">M<sub>z</sub> min</th>${env ? '' : `<th class="num">δ (mm)</th><th class="num">L/δ</th>`}</tr></thead><tbody>${cur.mem.slice(0, 400).map(mm => { const dmax = env ? 0 : Math.max(...mm.drel.map(Math.abs), ...mm.drelz.map(Math.abs)); const N = ext2(mm, 'N'), My = ext2(mm, 'My'), Mz = ext2(mm, 'Mz'); return `<tr class="${A.sel.m.includes(mm.id) ? 'on' : ''}" data-act="an-pick" data-m="${esc(mm.id)}"><td>${esc(mm.id)}</td><td class="num mono">${f(mm.L, 2)}</td>${[N[0], N[1], amax(mm, 'Vy'), amax(mm, 'Vz'), amax(mm, 'T'), My[0], My[1], Mz[0], Mz[1]].map(v => `<td class="num mono">${fx(v)}</td>`).join('')}${env ? '' : `<td class="num mono">${fx(dmax * 1000)}</td><td class="num mono">${dmax > 1e-9 ? f(mm.L / dmax, 0) : '—'}</td>`}</tr>`; }).join('')}</tbody></table></div><p class="hint">${T('δ = deflection relative to the line joining the member ends (local y and z). Click a row to show the member.', 'δ = การโก่งเทียบเส้นเชื่อมปลายชิ้นส่วน (แกน y และ z) คลิกแถวเพื่อแสดงชิ้นส่วน')}</p>`;
      } else if (rt === 'disp') {
        body = !cur || env ? `<p class="muted">${T('Choose a load case or combination.', 'เลือกกรณีน้ำหนักหรือกรณีรวมแรง')}</p>` : `<div class="tbl-wrap"><table class="chk an-r"><thead><tr><th>${T('Node', 'จุดต่อ')}</th><th class="num">u<sub>x</sub> (mm)</th><th class="num">u<sub>y</sub> (mm)</th><th class="num">u<sub>z</sub> (mm)</th><th class="num">θ<sub>x</sub></th><th class="num">θ<sub>y</sub></th><th class="num">θ<sub>z</sub> (mrad)</th></tr></thead><tbody>${m.nodes.slice(0, 400).map((n, i) => `<tr class="${A.sel.n.includes(n.id) ? 'on' : ''}"><td>${esc(n.id)}</td>${[0, 1, 2, 3, 4, 5].map(d => `<td class="num mono">${fx(cur.u[6 * i + d] * 1000, 3)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      } else if (rt === 'drift') {
        if (!cur || env) body = `<p class="muted">${T('Choose a load case or combination.', 'เลือกกรณีน้ำหนักหรือกรณีรวมแรง')}</p>`;
        else {
          const lv = {}; m.nodes.forEach((n, i) => { const z = r4(+n.z || 0); (lv[z] = lv[z] || []).push([cur.u[6 * i], cur.u[6 * i + 1]]); });
          const zs = Object.keys(lv).map(Number).sort((a, b) => a - b), rows = []; let prev = null;
          zs.forEach(z => { const L = lv[z], ux = L.reduce((s, v) => s + v[0], 0) / L.length, uy = L.reduce((s, v) => s + v[1], 0) / L.length; if (prev) rows.push({ z, ux, uy, h: z - prev.z, dx: ux - prev.ux, dy: uy - prev.uy }); prev = { z, ux, uy }; });
          const rat = (d, h) => (Math.abs(d) > 1e-9 ? 'h / ' + f(h / Math.abs(d), 0) : '—');
          body = rows.length ? `<table class="chk an-r"><thead><tr><th>${T('Level Z (m)', 'ระดับ Z (ม.)')}</th><th class="num">u<sub>x</sub> (mm)</th><th class="num">u<sub>y</sub> (mm)</th><th class="num">h (m)</th><th class="num">${T('Drift X', 'ดริฟต์ X')}</th><th class="num">${T('Drift Y', 'ดริฟต์ Y')}</th></tr></thead><tbody>${rows.map(rw => `<tr><td class="mono">${f(rw.z, 2)}</td><td class="num mono">${fx(rw.ux * 1000)}</td><td class="num mono">${fx(rw.uy * 1000)}</td><td class="num mono">${f(rw.h, 2)}</td><td class="num mono">${fx(rw.dx * 1000)} · ${rat(rw.dx, rw.h)}</td><td class="num mono">${fx(rw.dy * 1000)} · ${rat(rw.dy, rw.h)}</td></tr>`).join('')}</tbody></table><p class="hint">${T('Average horizontal displacement of the nodes at each level. Typical limits h/500 (AS 1170 commentary), h/300 (portal frames under wind).', 'ค่าเฉลี่ยการเคลื่อนตัวแนวราบของจุดต่อในแต่ละระดับ ค่าจำกัดทั่วไป h/500, h/300 (โครงข้อแข็งรับลม)')}</p>` : `<p class="muted">${T('One level only.', 'มีระดับเดียว')}</p>`;
        }
      } else if (rt === 'modal') {
        body = heavy + (r.modal ? `<div class="tbl-wrap"><table class="chk an-r"><thead><tr><th>${T('Mode', 'โหมด')}</th><th class="num">f (Hz)</th><th class="num">T (s)</th><th class="num">${T('Mass', 'มวล')} X</th><th class="num">Y</th><th class="num">Z</th><th class="num">Σ X</th><th class="num">Σ Y</th><th class="num">Σ Z</th><th></th></tr></thead><tbody>${r.modal.modes.map((md, i) => `<tr class="${A.view === 'mode' && A.mode === i ? 'on' : ''}"><td>${i + 1}</td><td class="num mono">${f(md.f, 3)}</td><td class="num mono">${f(md.T, 3)}</td>${[md.mx, md.my, md.mz, md.cmx, md.cmy, md.cmz].map(v => `<td class="num mono">${f(v * 100, 1)}%</td>`).join('')}<td><button class="btn btn-ghost xs" data-act="an-mode" data-k="${i}">${T('Show', 'แสดง')}</button></td></tr>`).join('')}</tbody></table></div><p class="hint">${T('Mass X / Y / Z', 'มวล X / Y / Z')}: ${f(r.modal.massX, 2)} / ${f(r.modal.massY, 2)} / ${f(r.modal.massZ, 2)} t</p>` : `<p class="muted">${pro() ? T('Turn on modal analysis in Tables & settings → Analysis.', 'เปิดการวิเคราะห์โหมดใน ตารางและการตั้งค่า → การวิเคราะห์') : T('Modal analysis is a Pro feature.', 'การวิเคราะห์โหมดสำหรับสมาชิก Pro')}</p>`);
      } else if (rt === 'buck') {
        body = heavy + (r.buckling ? `<table class="chk an-r"><thead><tr><th>${T('Combination', 'กรณีรวมแรง')}</th><th class="num">λcr,1</th><th class="num">λcr,2</th><th class="num">λcr,3</th><th>${T('Second-order effects', 'ผลอันดับสอง')}</th><th></th></tr></thead><tbody>${m.combos.filter(c => r.buckling[c.id]).map(c => { const b = r.buckling[c.id], l = b.modes ? b.modes.map(q => q.lam) : [], l1 = l[0]; return `<tr><td>${esc(c.id)} — ${esc(c.name)}</td>${[0, 1, 2].map(i => `<td class="num mono">${l[i] ? f(l[i], 2) : b.none && i === 0 ? '∞' : '—'}</td>`).join('')}<td>${l1 ? (l1 < 3 ? `<span class="pill st-bad">${T('λcr < 3: unstable / redesign', 'λcr < 3: ไม่มั่นคง ควรแก้ไข')}</span>` : l1 < 10 ? `<span class="pill st-warn">${T('3 ≤ λcr < 10: use second-order (P-Delta)', '3 ≤ λcr < 10: ใช้การวิเคราะห์อันดับสอง')}</span>` : `<span class="pill st-ok">${T('λcr ≥ 10: first-order OK', 'λcr ≥ 10: อันดับหนึ่งเพียงพอ')}</span>`) : b.error ? esc(b.error) : ''}</td><td>${l1 ? `<button class="btn btn-ghost xs" data-act="an-buck" data-c="${esc(c.id)}">${T('Show', 'แสดง')}</button>` : ''}</td></tr>`; }).join('')}</tbody></table>` : `<p class="muted">${pro() ? T('Turn on buckling analysis in Tables & settings → Analysis.', 'เปิดการวิเคราะห์การโก่งเดาะใน ตารางและการตั้งค่า → การวิเคราะห์') : T('Buckling analysis is a Pro feature.', 'การวิเคราะห์การโก่งเดาะสำหรับสมาชิก Pro')}</p>`);
      }
      return `<div class="tabs sm" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${rt === k}" data-act="an-rtab" data-t="${k}">${l}</button>`).join('')}</div><div class="an-rb">${body}</div>`;
    }
    // selected member: N, V, T, M and deflection along the member
    function memberHTML() {
      const cur = current(); if (A.sel.m.length !== 1 || !cur) return '';
      const mm = memRes(cur, A.sel.m[0]); if (!mm) return '';
      const mb = A.model.members.find(q => q.id === mm.id), env = cur.kind === 'env'; if (!mb) return '';
      const chart = (lbl, unit, arrs, cls, flip) => {
        const Wc = 260, Hc = 96, all = arrs.flat(), mx = Math.max(1e-9, ...all.map(Math.abs)), X = x => 8 + (Wc - 16) * x / mm.L, Y = v => Hc / 2 - v / mx * (Hc / 2 - 12) * (flip ? -1 : 1);
        const paths = arrs.map((a, si) => `<path d="M${X(0)} ${Hc / 2} ${a.map((v, i) => `L${X(mm.x[i]).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ')} L${X(mm.L)} ${Hc / 2} Z" class="an-dg ${cls} ${si ? 'neg' : ''}"/>`).join('');
        return `<figure class="an-mc"><figcaption><span>${lbl}</span> <span class="mono">${f(Math.min(...all), 2)} … ${f(Math.max(...all), 2)} ${unit}</span></figcaption><svg viewBox="0 0 ${Wc} ${Hc}"><line x1="8" x2="${Wc - 8}" y1="${Hc / 2}" y2="${Hc / 2}" class="an-ax"/>${paths}</svg></figure>`;
      };
      const g = q => arr(mm, q, env), s = A.model.sections.find(q => q.id === mb.sec), p = s ? F.secProps(s) : null;
      return `<div class="card an-member"><div class="an-mh"><h3>${T('Member', 'ชิ้นส่วน')} ${esc(mm.id)} <span class="muted small">${esc(mb.i)} → ${esc(mb.j)} · L = ${f(mm.L, 3)} m · ${esc(mb.sec)}${p ? ' (A ' + f(p.A, 0) + ' mm²)' : ''}</span></h3>
        <div class="an-send"><button class="btn btn-ghost xs" data-act="an-send" data-e="beam">${T('Design as RC beam →', 'ออกแบบเป็นคาน คสล. →')}</button><button class="btn btn-ghost xs" data-act="an-send" data-e="column">${T('Design as RC column →', 'ออกแบบเป็นเสา คสล. →')}</button></div></div>
        <div class="an-mcs">${chart(T('Axial N', 'แรงตามแนวแกน N'), 'kN', g('N'), 'N')}${chart('V<sub>y</sub>', 'kN', g('Vy'), 'V')}${chart('V<sub>z</sub>', 'kN', g('Vz'), 'V')}${chart(T('Torsion T', 'แรงบิด T'), 'kNm', g('T'), 'T')}${chart('M<sub>y</sub>', 'kNm', g('My'), 'My', true)}${chart('M<sub>z</sub>', 'kNm', g('Mz'), 'M', true)}${env ? '' : chart(T('Deflection (local y)', 'การโก่ง (แกน y)'), 'mm', [mm.drel.map(v => v * 1000)], 'D') + chart(T('Deflection (local z)', 'การโก่ง (แกน z)'), 'mm', [mm.drelz.map(v => v * 1000)], 'D')}</div></div>`;
    }
    function sendToDesign(elem) {
      const cur = current(); if (!cur || A.sel.m.length !== 1) return;
      const mm = memRes(cur, A.sel.m[0]); if (!mm) return;
      const env = cur.kind === 'env', mxA = q => (env ? Math.max(...mm[q + 'max'].map(Math.abs), ...mm[q + 'min'].map(Math.abs)) : Math.max(...mm[q].map(Math.abs)));
      const hi = q => (env ? Math.max(...mm[q + 'max']) : Math.max(...mm[q])), lo = q => (env ? Math.min(...mm[q + 'min']) : Math.min(...mm[q]));
      const M = Math.abs(hi('Mz')) >= Math.abs(lo('Mz')) ? hi('Mz') : lo('Mz'), Nc = -lo('N');
      ctx.toDesign(elem, { M, My: mxA('My'), V: mxA('Vy'), Vz: mxA('Vz'), T: mxA('T'), N: Math.max(0, Nc), id: mm.id, src: A.src });
    }

    // ------------------------------------------------------------------ page
    function view() {
      if (A.resVer !== A.ver || (!A.res && !A.err)) run();
      const srcs = srcList(), views = [['model', T('Model & loads', 'แบบจำลองและแรง')], ['def', T('Deflected', 'การโก่งตัว')]].concat(COMPS.map(c => [c[0], c[1]])).concat([['react', T('Reactions', 'แรงปฏิกิริยา')], ['mode', T('Modes', 'โหมด')], ['buck', T('Buckling', 'การโก่งเดาะ')]]);
      const lv = levels(), ax = cutAxis();
      return `<main class="wrap page an">
        <div class="page-head"><div><p class="eyebrow">Structural Analysis · ${T('3D frame & truss', 'โครงข้อแข็งและโครงถัก 3 มิติ')}</p><h1>${T('Frame analysis', 'วิเคราะห์โครงสร้าง')}</h1><p class="muted">${T('Click to select and edit in 3D · linear static, P-Delta, modal and buckling · load combinations and envelopes.', 'คลิกเพื่อเลือกและแก้ไขใน 3 มิติ · สถิตเชิงเส้น P-Delta โหมด และการโก่งเดาะ · การรวมแรงและค่าสูงสุด/ต่ำสุด')}</p></div>
          <div class="dz-actions an-acts"><button class="btn btn-ghost sm" data-act="an-tplopen">${T('New from template', 'สร้างจากแม่แบบ')}</button><button class="btn btn-ghost sm" data-act="an-save">${T('Save model', 'บันทึกแบบจำลอง')}</button><label class="btn btn-ghost sm an-open">${T('Open model', 'เปิดแบบจำลอง')}<input type="file" accept=".json,application/json" id="an-file" hidden></label><button class="btn ${pro() ? 'btn-hot' : 'btn-lock'} sm" data-act="an-report">${pro() ? T('Analysis report', 'รายงานการวิเคราะห์') : '🔒 ' + T('Report (Pro)', 'รายงาน (Pro)')}</button></div></div>
        ${A.tplOpen ? tplHTML() : ''}
        <div class="an-grid">
          <section class="an-main">
            <div class="card an-view">
              <div class="an-tools">
                <div class="seg" role="group" aria-label="${T('Tool', 'เครื่องมือ')}">${[['select', T('Select', 'เลือก')], ['box', T('Box', 'กรอบ')], ['member', T('Member', 'ชิ้นส่วน')], ['node', T('Node', 'จุดต่อ')]].map(([k, l]) => `<button data-act="an-tool" data-t="${k}" aria-pressed="${A.tool === k}">${l}</button>`).join('')}</div>
                <div class="seg" role="group" aria-label="${T('View', 'มุมมอง')}">${[['3d', '3D'], ['plan', T('Plan', 'แปลน')], ['xz', 'X–Z'], ['yz', 'Y–Z']].map(([k, l]) => `<button data-act="an-cam" data-v="${k}" aria-pressed="${A.cam.v === k}">${l}</button>`).join('')}</div>
                ${ax ? `<label class="an-lv">${ax.toUpperCase()} = ${sel([['all', T('all', 'ทั้งหมด')]].concat(lv.map(v => [v, f(v, 2)])), A.cut, 'id="an-cut"')}</label>` : ''}
                <span class="grow"></span>
                <button class="btn btn-ghost xs" data-act="an-fit" title="${T('Zoom to fit', 'ซูมให้พอดี')}">⤢ ${T('Fit', 'พอดี')}</button><button class="btn btn-ghost xs" data-act="an-undo" ${A.hist.length ? '' : 'disabled'} title="Ctrl+Z">↶</button><button class="btn btn-ghost xs" data-act="an-redo" ${A.fut.length ? '' : 'disabled'} title="Ctrl+Y">↷</button>
              </div>
              <div class="an-bar"><div class="seg sm" role="group" aria-label="${T('Display', 'การแสดงผล')}">${views.map(([k, l]) => `<button data-act="an-view" data-v="${k}" aria-pressed="${A.view === k}">${l}</button>`).join('')}</div></div>
              <div class="an-bar2">${A.view === 'model' ? `<label>${T('Loads', 'แรง')} ${sel([['all', T('All cases', 'ทุกกรณี')]].concat(A.model.cases.map(c => [c.id, c.id + ' — ' + c.name])), A.lcase, 'id="an-lcase"')}</label><label class="chkl sm"><input type="checkbox" id="an-loadson" ${A.loadsOn ? 'checked' : ''}> ${T('Show loads', 'แสดงแรง')}</label>` : A.view === 'mode' ? `<label>${T('Mode', 'โหมด')} ${sel((A.res && A.res.modal ? A.res.modal.modes : []).map((md, i) => [i, (i + 1) + ' · ' + f(md.T, 3) + ' s']), A.mode, 'id="an-modesel"')}</label>` : `<label>${T('Results for', 'ผลของ')} ${sel(srcs, A.src, 'id="an-src"')}</label>`}
                <label>${T('Scale', 'มาตราส่วน')} <input type="range" min="0.2" max="4" step="0.1" value="${A.dscale}" id="an-scale"></label>
                <label class="chkl sm"><input type="checkbox" id="an-labels" ${A.labels ? 'checked' : ''}> ${T('Labels', 'ป้ายชื่อ')}</label><span class="an-tag" id="anViewTag">${viewTag()}</span></div>
              <div class="an-canvas"><canvas id="anCv" tabindex="0" aria-label="${T('3D model view', 'มุมมองแบบจำลอง 3 มิติ')}"></canvas></div>
              <p class="hint">${A.cam.v === '3d' ? T('Drag to rotate · right-drag or Shift-drag to pan · wheel or pinch to zoom · click to select.', 'ลากเพื่อหมุน · คลิกขวาลากหรือ Shift ลากเพื่อเลื่อน · ล้อเมาส์หรือถ่างนิ้วเพื่อซูม · คลิกเพื่อเลือก') : T('Drag to pan · wheel or pinch to zoom · click to select · pick a level to edit one plane at a time.', 'ลากเพื่อเลื่อน · ล้อเมาส์หรือถ่างนิ้วเพื่อซูม · คลิกเพื่อเลือก · เลือกระดับเพื่อแก้ไขทีละระนาบ')} ${T('Units: kN, m, kNm.', 'หน่วย kN, m, kNm')}</p>
            </div>
            <div id="anMember">${memberHTML()}</div>
            <div class="card an-results" id="anRes">${resultsHTML()}</div>
          </section>
          <aside class="an-side card" id="anSide">${sideHTML()}</aside>
        </div>
        <div id="reportWrap"></div></main>`;
    }
    function tplHTML() {
      const p = Object.assign({}, TPL[A.tpl].p, A.tplP || {});
      const fl = (k, lbl, type) => `<label>${lbl}<input data-tp="${k}" value="${esc(p[k])}" ${type === 'n' ? 'type="number" step="any"' : ''}></label>`;
      const form = A.tpl === 'building' ? fl('bx', T('Bays in X (m), comma separated', 'ช่วงแกน X (ม.) คั่นด้วยจุลภาค')) + fl('by', T('Bays in Y (m)', 'ช่วงแกน Y (ม.)')) + fl('st', T('Storey heights (m), bottom up', 'ความสูงชั้น (ม.) จากล่างขึ้นบน')) + fl('g', T('Beam dead UDL G (kN/m, plus self-weight)', 'น้ำหนักคงที่บนคาน G (kN/m ไม่รวมน้ำหนักตัวเอง)'), 'n') + fl('q', T('Beam live UDL Q (kN/m)', 'น้ำหนักจรบนคาน Q (kN/m)'), 'n') + fl('wind', T('Wind force per floor, each direction (kN)', 'แรงลมต่อชั้น แต่ละทิศ (kN)'), 'n')
        : A.tpl === 'shed' ? fl('span', T('Span (m)', 'ช่วงกว้าง (ม.)'), 'n') + fl('eave', T('Eave height (m)', 'ความสูงชายคา (ม.)'), 'n') + fl('rise', T('Apex rise (m)', 'ความสูงจั่ว (ม.)'), 'n') + fl('bay', T('Frame spacing (m)', 'ระยะห่างโครง (ม.)'), 'n') + fl('nb', T('Number of bays', 'จำนวนช่วง'), 'n') + `<label>${T('Bases', 'ฐาน')}${sel([['pin', T('Pinned', 'หมุด')], ['fixed', T('Fixed', 'ยึดแน่น')]], p.base, 'data-tp="base"')}</label>`
          : A.tpl === 'portal' ? fl('span', T('Span (m)', 'ช่วงกว้าง (ม.)'), 'n') + fl('eave', T('Eave height (m)', 'ความสูงชายคา (ม.)'), 'n') + fl('rise', T('Apex rise (m)', 'ความสูงจั่ว (ม.)'), 'n') + fl('bay', T('Frame spacing (m)', 'ระยะห่างโครง (ม.)'), 'n') + `<label>${T('Bases', 'ฐาน')}${sel([['pin', T('Pinned', 'หมุด')], ['fixed', T('Fixed', 'ยึดแน่น')]], p.base, 'data-tp="base"')}</label>`
            : A.tpl === 'beam' ? fl('spans', T('Spans (m), comma separated', 'ช่วงคาน (ม.) คั่นด้วยจุลภาค')) + fl('g', T('Dead UDL G (kN/m, plus self-weight)', 'น้ำหนักคงที่ G (kN/m ไม่รวมน้ำหนักตัวเอง)'), 'n') + fl('q', T('Live UDL Q (kN/m)', 'น้ำหนักจร Q (kN/m)'), 'n')
              : A.tpl === 'truss' ? `<label>${T('Type', 'ชนิด')}${sel([['pratt', 'Pratt'], ['howe', 'Howe'], ['warren', 'Warren']], p.kind, 'data-tp="kind"')}</label>` + fl('span', T('Span (m)', 'ช่วงกว้าง (ม.)'), 'n') + fl('depth', T('Depth (m)', 'ความลึก (ม.)'), 'n') + fl('panels', T('Panels (even)', 'จำนวนช่อง (คู่)'), 'n') + fl('load', T('Dead load per top node (kN)', 'น้ำหนักคงที่ต่อจุดต่อบน (kN)'), 'n')
                : `<p class="muted">${T('An empty 3D model with a concrete and a steel section, G and Q load cases. Draw members with the Member tool.', 'โมเดล 3 มิติว่าง มีหน้าตัดคอนกรีตและเหล็ก กรณีน้ำหนัก G และ Q วาดชิ้นส่วนด้วยเครื่องมือชิ้นส่วน')}</p>`;
      return `<div class="card an-tpl"><div class="seg" role="group">${Object.entries(TPL).map(([k, v]) => `<button data-act="an-tpl" data-t="${k}" aria-pressed="${A.tpl === k}">${T(v.n[0], v.n[1])}</button>`).join('')}</div><div class="mgrid an-tplf">${form}</div><div class="mfoot"><span class="muted small">${T('Replaces the current model (Undo brings it back). Loads, sections and AS/NZS 1170.0 combinations are filled in — edit them freely.', 'แทนที่แบบจำลองปัจจุบัน (กดย้อนกลับได้) ระบบใส่แรง หน้าตัด และกรณีรวมแรงตาม AS/NZS 1170.0 ให้ — แก้ไขได้')}</span><span class="grow"></span><button class="btn btn-ghost sm" data-act="an-tplclose">${T('Cancel', 'ยกเลิก')}</button><button class="btn btn-hot sm" data-act="an-tplgo">${T('Create model', 'สร้างแบบจำลอง')}</button></div></div>`;
    }
    function drawAll() {
      redraw();
      const r = $('#anRes'); if (r) r.innerHTML = resultsHTML();
      const mm = $('#anMember'); if (mm) mm.innerHTML = memberHTML();
      const s = $('#an-src'); if (s) { const list = srcList(); s.innerHTML = list.map(o => `<option value="${esc(o[0])}" ${o[0] === A.src ? 'selected' : ''}>${esc(o[1])}</option>`).join(''); }
      const u = document.querySelector('[data-act=an-undo]'), rd = document.querySelector('[data-act=an-redo]'); if (u) u.disabled = !A.hist.length; if (rd) rd.disabled = !A.fut.length;
    }
    let resizeBound = false, keyBound = false;
    function mount() {
      const cv = $('#anCv'); if (!cv) return;
      if (!cv._b) { cv._b = true; bindCanvas(cv); }
      redraw();
      if (!resizeBound) { resizeBound = true; let rt = null; G.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if ($('#anCv')) redraw(); }, 120); }); }
      if (!keyBound) {
        keyBound = true;
        document.addEventListener('keydown', e => {
          if (S.view !== 'analysis' || !$('#anCv')) return;
          const tg = e.target, typing = tg && (tg.tagName === 'INPUT' || tg.tagName === 'SELECT' || tg.tagName === 'TEXTAREA');
          if ((e.ctrlKey || e.metaKey) && !typing && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo(e.shiftKey); return; }
          if ((e.ctrlKey || e.metaKey) && !typing && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); undo(true); return; }
          if (typing) return;
          if (e.key === 'Escape') { if (A.draw) { A.draw = null; redraw(); } else if (A.sel.n.length || A.sel.m.length) { A.sel = { n: [], m: [] }; selChanged(); } }
          else if ((e.key === 'Delete' || e.key === 'Backspace') && (A.sel.n.length || A.sel.m.length)) { e.preventDefault(); deleteSel(); }
        });
      }
    }

    // ------------------------------------------------------------------ input handlers
    function onInput(t) {
      if (t.dataset.tp) { A.tplP = Object.assign({}, TPL[A.tpl].p, A.tplP || {}); A.tplP[t.dataset.tp] = t.value; return true; }
      if (t.dataset.ins) { applyIns(t); return true; }
      if (t.dataset.opt) {
        const k = t.dataset.opt;
        if (k === 'plane') { snap(true); A.model.plane = t.value; changed(false); return true; }
        A.opt[k] = t.type === 'checkbox' ? t.checked : +t.value; persist(); if (k !== 'snap') schedule(); return true;
      }
      if (t.id === 'an-src') { A.src = t.value; drawAll(); return true; }
      if (t.id === 'an-lcase') { A.lcase = t.value; redraw(); return true; }
      if (t.id === 'an-loadson') { A.loadsOn = t.checked; redraw(); return true; }
      if (t.id === 'an-modesel') { A.mode = +t.value; redraw(); return true; }
      if (t.id === 'an-scale') { A.dscale = +t.value; redraw(); return true; }
      if (t.id === 'an-labels') { A.labels = t.checked; redraw(); return true; }
      if (t.id === 'an-cut') { A.cut = t.value === 'all' ? 'all' : +t.value; A.cam.k = null; A.sel = { n: [], m: [] }; redraw(); sideRefresh(); const vt = $('#anViewTag'); if (vt) vt.textContent = viewTag(); return true; }
      if (t.id === 'an-file') {
        const fl = t.files[0]; if (!fl) return true;
        fl.text().then(txt => { try { const j = JSON.parse(txt), mm = migrate(j.model || j); if (!mm || !mm.nodes || !mm.members) throw 0; snap(true); A.model = Object.assign({ loads: [], combos: [], cases: [], sections: [], materials: [] }, mm); if (j.opt) A.opt = Object.assign(A.opt, j.opt); afterNewModel(); toast(T('Model opened', 'เปิดแบบจำลองแล้ว'), 'ok'); } catch (e) { toast(T('That file is not a StructCap model.', 'ไฟล์นี้ไม่ใช่แบบจำลอง StructCap'), 'bad'); } });
        return true;
      }
      if (!t.dataset.tb) return false;
      const tb = t.dataset.tb, i = +t.dataset.i, fd = t.dataset.f, row = A.model[tb] && A.model[tb][i]; if (!row) return true;
      snap();
      const v = t.type === 'checkbox' ? t.checked : t.value;
      let side = false;
      if (fd.startsWith('f.')) { row.f = row.f || {}; const k = fd.slice(2); if (v === '' || +v === 0) delete row.f[k]; else row.f[k] = +v; }
      else if (fd === 'id') { const nid = String(v).trim(); if (!nid || A.model[tb].some((o, k) => k !== i && o.id === nid)) { t.classList.add('bad'); return true; } t.classList.remove('bad'); renameRefs(tb, row.id, nid); row.id = nid; }
      else if (['x', 'y', 'z', 'b', 'h', 'd', 'bf', 'tf', 'tw', 'D', 'A', 'I', 'Iz', 'Iy', 'J', 'E', 'nu', 'rho', 'Fx', 'Fy', 'Fz', 'Mx', 'My', 'Mz', 'w1', 'P', 'M', 'beta'].includes(fd)) row[fd] = v === '' ? '' : +v;
      else row[fd] = v;
      if (tb === 'nodes' && fd === 'sup' && v === 'custom' && !row.fix) row.fix = F.SUPS.pin.slice();
      if (tb === 'sections' && fd === 'shape') { const o = G.GANTRY ? G.GANTRY.sizeOptions(v) : []; row.size = o[0] ? o[0][0] : ''; side = true; }
      if (tb === 'sections' && fd === 'type') { Object.assign(row, { rect: { b: 300, h: 500 }, I: { d: 356, bf: 171, tf: 11.5, tw: 7.3 }, circ: { D: 400 }, tube: { shape: 'SHS', size: (G.GANTRY ? G.GANTRY.sizeOptions('SHS')[0][0] : '') }, user: { A: 10000, Iz: 100e6, Iy: 50e6, J: 20e6 } }[v]); side = true; }
      if (tb === 'loads' && fd === 'kind') { Object.assign(row, v === 'udl' ? { w1: row.w1 || 5, dir: row.dir && row.dir[0] !== 'l' || row.dir === 'ly' ? row.dir : 'grav' } : v === 'point' ? { P: row.P || 10, a: row.a || 1, dir: GDIR[row.dir] || /^l[yz]$/.test(row.dir) ? row.dir : 'grav' } : { M: row.M || 10, a: row.a || 1, dir: 'lz' }); side = true; }
      if ((tb === 'members' && (fd === 'type' || fd === 'i' || fd === 'j')) || (tb === 'cases' && fd === 'id')) side = true;
      changed(side);
      return true;
    }
    function afterNewModel() { A.sel = { n: [], m: [] }; A.src = null; A.draw = null; A.cut = 'all'; A.lcase = (A.model.cases[0] || {}).id || 'all'; setView(A.model.plane === 'XZ' ? 'xz' : '3d'); A.ver++; persist(); run(); ctx.render(); }
    function onClick(a, b) {
      const m = A.model;
      if (a === 'an-tab') { A.tab = b.dataset.t; sideRefresh(); }
      else if (a === 'an-side') { A.side = b.dataset.s; sideRefresh(); }
      else if (a === 'an-rtab') { A.rtab = b.dataset.t; const r = $('#anRes'); if (r) r.innerHTML = resultsHTML(); }
      else if (a === 'an-view') { A.view = b.dataset.v; if (A.view === 'buck' && !(A.src || '').startsWith('combo:')) { const c = m.combos.find(q => q.type === 'ULS'); if (c) A.src = 'combo:' + c.id; } ctx.render(); }
      else if (a === 'an-tool') { A.tool = b.dataset.t; A.draw = null; document.querySelectorAll('[data-act=an-tool]').forEach(x => x.setAttribute('aria-pressed', x.dataset.t === A.tool)); if ((A.tool === 'node' || A.tool === 'member') && A.cam.v === '3d') toast(T('Tip: in Plan or an Elevation you can click empty grid points to create nodes.', 'เคล็ดลับ: ในแปลนหรือรูปด้าน คลิกตำแหน่งว่างเพื่อสร้างจุดต่อ'), ''); redraw(); }
      else if (a === 'an-cam') { setView(b.dataset.v); ctx.render(); }
      else if (a === 'an-fit') { A.cam.k = null; redraw(); }
      else if (a === 'an-undo') undo(false);
      else if (a === 'an-redo') undo(true);
      else if (a === 'an-clear') { A.sel = { n: [], m: [] }; selChanged(); }
      else if (a === 'an-selall') { A.sel = { n: m.nodes.filter(nodeVisible).map(n => n.id), m: m.members.filter(q => { const nd = nodeMap(); return nd[q.i] && nd[q.j] && nodeVisible(nd[q.i]) && nodeVisible(nd[q.j]); }).map(q => q.id) }; selChanged(); }
      else if (a === 'an-delsel') deleteSel();
      else if (a === 'an-add') { snap(true); addRow(b.dataset.tb); changed(true); }
      else if (a === 'an-del') { snap(true); const tb = b.dataset.tb, i = +b.dataset.i, row = m[tb][i]; m[tb].splice(i, 1); if (tb === 'nodes') { m.members = m.members.filter(x => x.i !== row.id && x.j !== row.id); m.loads = m.loads.filter(l => l.node !== row.id); } if (tb === 'members') m.loads = m.loads.filter(l => l.member !== row.id); if (tb === 'cases') { m.loads = m.loads.filter(l => l.case !== row.id); m.combos.forEach(c => { if (c.f) delete c.f[row.id]; }); } A.sel = { n: A.sel.n.filter(id => m.nodes.some(q => q.id === id)), m: A.sel.m.filter(id => m.members.some(q => q.id === id)) }; changed(true); }
      else if (a === 'an-mat') { snap(true); const mt = clone(MAT[b.dataset.m]); let id = mt.id, k = 2; while (m.materials.some(q => q.id === id)) id = mt.id + k++; mt.id = id; m.materials.push(mt); changed(true); }
      else if (a === 'an-gen') { snap(true); m.code = $('#an-code').value; m.combos = preset(m.code, m.cases); A.src = null; changed(true); toast(T('Combinations generated', 'สร้างกรณีรวมแรงแล้ว'), 'ok'); }
      else if (a === 'an-tplopen') { A.tplOpen = true; ctx.render(); }
      else if (a === 'an-tplclose') { A.tplOpen = false; ctx.render(); }
      else if (a === 'an-tpl') { A.tpl = b.dataset.t; A.tplP = null; ctx.render(); }
      else if (a === 'an-tplgo') { const p = Object.assign({}, TPL[A.tpl].p, A.tplP || {}); try { const nm = build(A.tpl, p); snap(true); A.model = nm; A.tplOpen = false; afterNewModel(); toast(T('Model created', 'สร้างแบบจำลองแล้ว'), 'ok'); } catch (e) { toast(T('Check the template values.', 'ตรวจสอบค่าที่กรอก'), 'bad'); } }
      else if (a === 'an-save') { const blob = new Blob([JSON.stringify({ app: 'StructCap', kind: 'frame3d', version: 3, model: m, opt: A.opt }, null, 1)], { type: 'application/json' }); ctx.saveFile((m.name || 'model').replace(/[^\w\-]+/g, '_') + '_' + today() + '.json', blob); }
      else if (a === 'an-pick') { A.sel = { n: [], m: [b.dataset.m] }; selChanged(); const r = $('#anRes'); if (r) r.innerHTML = resultsHTML(); const mm = $('#anMember'); if (mm) mm.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
      else if (a === 'an-mode') { A.mode = +b.dataset.k; A.view = 'mode'; ctx.render(); }
      else if (a === 'an-buck') { A.src = 'combo:' + b.dataset.c; A.view = 'buck'; ctx.render(); }
      else if (a === 'an-send') sendToDesign(b.dataset.e);
      else if (a === 'an-runall') { run(true); drawAll(); }
      else if (a === 'an-report') { if (!pro()) { toast(T('The analysis report is a Pro feature.', 'รายงานการวิเคราะห์สำหรับสมาชิก Pro'), 'bad'); return; } if (A.heavy) run(true); renderReport(); const w = $('#reportWrap'); if (w) w.scrollIntoView({ behavior: 'smooth' }); }
      else if (a === 'an-addnode') { const p = ['an-nx', 'an-ny', 'an-nz'].map(id => +($('#' + id).value) || 0); snap(true); const id = ensureNode(p); A.sel = { n: [id], m: [] }; changed(true); }
      else if (a === 'an-move') { const d = ['an-mx', 'an-my', 'an-mz'].map(id => +($('#' + id).value) || 0); snap(true); const nd = nodeMap(); A.sel.n.forEach(id => { const n = nd[id]; n.x = r4((+n.x || 0) + d[0]); n.y = r4((+n.y || 0) + d[1]); n.z = r4((+n.z || 0) + d[2]); }); changed(true); }
      else if (a === 'an-addnl') { snap(true); m.loads.push(nload(defCase(), A.sel.n[0], { Fz: -10 })); changed(true); }
      else if (a === 'an-nl') { const cs = $('#an-nlc').value, o = {}; ['Fx', 'Fy', 'Fz', 'Mx', 'My', 'Mz'].forEach(q => { o[q] = +($('#an-n' + q).value) || 0; }); snap(true); A.sel.n.forEach(id => m.loads.push(nload(cs, id, o))); changed(true); toast(T('Load added to ' + A.sel.n.length + ' node(s)', 'เพิ่มแรงให้ ' + A.sel.n.length + ' จุดต่อแล้ว'), 'ok'); }
      else if (a === 'an-addml') { snap(true); const k = b.dataset.k, id = A.sel.m[0]; m.loads.push(k === 'udl' ? udl(defCase(), id, 5) : k === 'point' ? { case: defCase(), kind: 'point', member: id, dir: 'grav', P: 10, a: 1 } : { case: defCase(), kind: 'moment', member: id, dir: 'lz', M: 10, a: 1 }); changed(true); }
      else if (a === 'an-ml') { const cs = $('#an-mlc').value, kd = $('#an-mlk').value, dir = $('#an-mld').value, v = +$('#an-mlv').value || 0; snap(true); const nd = nodeMap(); A.sel.m.forEach(id => { const q = m.members.find(z => z.id === id); if (!q) return; if (kd === 'udl') m.loads.push(udl(cs, id, v, dir)); else { const L = Math.hypot(...sub(P3(nd[q.j]), P3(nd[q.i]))); m.loads.push({ case: cs, kind: 'point', member: id, dir, P: v, a: r4(L / 2) }); } }); changed(true); toast(T('Load added to ' + A.sel.m.length + ' member(s)', 'เพิ่มแรงให้ ' + A.sel.m.length + ' ชิ้นส่วนแล้ว'), 'ok'); }
      else if (a === 'an-mlclear') { const cs = $('#an-mlc').value, s0 = new Set(A.sel.m), n0 = m.loads.length; snap(true); m.loads = m.loads.filter(l => !(l.kind !== 'node' && s0.has(l.member) && l.case === cs)); changed(true); toast(T((n0 - m.loads.length) + ' load(s) removed', 'ลบแรง ' + (n0 - m.loads.length) + ' รายการ'), 'ok'); }
      else if (a === 'an-split') { const n = Math.max(2, Math.min(20, +$('#an-splitn').value | 0)); snap(true); const segs = splitMember(A.sel.m[0], n); A.sel = { n: [], m: segs }; changed(true); }
      else if (a === 'an-replicate') { const d = ['an-rx', 'an-ry', 'an-rz'].map(id => +($('#' + id).value) || 0), n = Math.max(1, Math.min(50, +$('#an-rn').value | 0)), c = $('#an-rc').checked, l = $('#an-rl').checked; A.rep = d.concat([n, c, l]); A.repOpen = true; if (!d.some(Boolean)) { toast(T('Enter a distance to copy by.', 'ใส่ระยะที่ต้องการคัดลอก'), 'bad'); return; } replicate(d, n, c, l); }
      else return false;
      return true;
    }

    // ------------------------------------------------------------------ report
    function renderReport() {
      const m = A.model, r = A.res; if (!r) { toast(A.err || T('Nothing to report yet.', 'ยังไม่มีผลลัพธ์'), 'bad'); return; }
      const Mt = S.meta, keep = { src: A.src, view: A.view };
      const tbl = (head, rows) => `<table class="rp-t an-rp"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(rw => `<tr>${rw.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      const sec = (n, title, html) => `<section class="rp-sec"><h3><span class="rp-n">${n}</span>${title}</h3>${html}</section>`;
      const fig = (v, lc, cap) => `<figure class="an-fig">${snapshot(v, lc)}${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
      const nd = nodeMap(), lim = (a2, n) => (a2.length > n ? a2.slice(0, n) : a2), more = (a2, n) => (a2.length > n ? `<p class="rp-txt">${T('First ' + n + ' of ' + a2.length + ' rows shown.', 'แสดง ' + n + ' แถวแรกจาก ' + a2.length + ' แถว')}</p>` : '');
      const supName = n => (SUP().find(s => s[0] === (n.sup || 'free')) || [])[1] + (n.sup === 'custom' ? ' [' + F.fixOf(n).join('') + ']' : '');
      const supN = m.nodes.filter(n => F.fixOf(n).some(Boolean));
      let html = sec(1, T('Model', 'แบบจำลอง'), fig('model', '__none', esc(m.name || '') + ' · ' + (m.plane === 'XZ' ? T('2D frame, X–Z plane', 'โครง 2 มิติ ระนาบ X–Z') : T('3D frame', 'โครง 3 มิติ')) + ' · ' + m.nodes.length + ' ' + T('nodes', 'จุดต่อ') + ', ' + m.members.length + ' ' + T('members', 'ชิ้นส่วน')) +
        tbl([T('Node', 'จุดต่อ'), 'X (m)', 'Y (m)', 'Z (m)', T('Support', 'จุดรองรับ')], lim(m.nodes, 200).map(n => [esc(n.id), f(+n.x || 0, 3), f(+n.y || 0, 3), f(+n.z || 0, 3), esc(supName(n))])) + more(m.nodes, 200) +
        tbl([T('Member', 'ชิ้นส่วน'), 'i', 'j', T('Section', 'หน้าตัด'), T('Material', 'วัสดุ'), T('Type', 'ชนิด'), T('Hinges', 'บานพับ'), 'β°', 'L (m)'], lim(m.members, 200).map(x => { const a2 = nd[x.i], b2 = nd[x.j]; return [esc(x.id), esc(x.i), esc(x.j), esc(x.sec), esc(x.mat), x.type === 'truss' ? T('truss', 'โครงถัก') : T('frame', 'โครงข้อแข็ง'), (x.relI ? 'i ' : '') + (x.relJ ? 'j' : ''), f(+x.beta || 0, 0), a2 && b2 ? f(Math.hypot(...sub(P3(b2), P3(a2))), 3) : '']; })) + more(m.members, 200) +
        tbl([T('Section', 'หน้าตัด'), T('Name', 'ชื่อ'), 'A (mm²)', 'I<sub>z</sub> (×10⁶ mm⁴)', 'I<sub>y</sub> (×10⁶ mm⁴)', 'J (×10⁶ mm⁴)'], m.sections.map(s => { const p = F.secProps(s); return [esc(s.id), esc(s.name || s.type), f(p.A, 0), f(p.Iz / 1e6, 2), f(p.Iy / 1e6, 2), f(p.J / 1e6, 3)]; })) +
        tbl([T('Material', 'วัสดุ'), 'E (MPa)', 'ν', T('Unit weight (kN/m³)', 'หน่วยน้ำหนัก (kN/m³)')], m.materials.map(x => [esc(x.id + (x.name ? ' — ' + x.name : '')), f(+x.E, 0), f(x.nu === undefined ? 0.3 : +x.nu, 2), f(+x.rho, 1)])));
      html += sec(2, T('Loads and combinations', 'แรงและกรณีรวมแรง'), m.cases.filter(c => m.loads.some(l => l.case === c.id)).map(c => fig('model', c.id, '<b>' + esc(c.id) + '</b> — ' + esc(c.name))).join('') +
        tbl([T('Case', 'กรณี'), T('Name', 'ชื่อ'), T('Type', 'ประเภท'), T('Self-weight', 'น้ำหนักตัวเอง')], m.cases.map(c => [esc(c.id), esc(c.name), c.type, c.sw ? '✓' : ''])) +
        tbl([T('Case', 'กรณี'), T('On', 'ที่'), T('Load', 'แรง'), T('Values', 'ค่า')], lim(m.loads, 300).map(l => [esc(l.case), esc(l.kind === 'node' ? l.node : l.member), l.kind === 'node' ? T('nodal', 'ที่จุดต่อ') : l.kind + ' · ' + esc(((l.kind === 'moment' ? MDIRS() : DIRS()).find(d => d[0] === (l.dir || (l.kind === 'moment' ? 'lz' : 'grav'))) || ['', ''])[1]), l.kind === 'node' ? ['Fx', 'Fy', 'Fz', 'Mx', 'My', 'Mz'].filter(q => +l[q]).map(q => q + ' ' + f(+l[q], 2)).join(', ') : l.kind === 'udl' ? `w ${f(+l.w1 || 0, 2)}${l.w2 !== '' && l.w2 != null ? '→' + f(+l.w2, 2) : ''} kN/m${+l.a || (l.b !== '' && l.b != null) ? ` (${f(+l.a || 0, 2)}–${l.b !== '' && l.b != null ? f(+l.b, 2) : 'L'} m)` : ''}` : l.kind === 'point' ? `P ${f(+l.P || 0, 2)} kN @ ${f(+l.a || 0, 2)} m` : `M ${f(+l.M || 0, 2)} kNm @ ${f(+l.a || 0, 2)} m`])) + more(m.loads, 300) +
        tbl([T('Combination', 'กรณีรวมแรง'), T('Type', 'ชนิด'), T('Factors', 'ตัวคูณ')], m.combos.map(c => [esc(c.id + ' — ' + c.name), c.type, Object.entries(c.f || {}).map(([k2, v]) => f(v, 2) + '·' + esc(k2)).join(' + ')])));
      html += sec(3, T('Analysis', 'การวิเคราะห์'), `<p class="rp-txt">${T('Finite-element stiffness method, ' + (m.plane === 'XZ' ? '2D frame elements in the X–Z plane' : '3D frame elements with 6 degrees of freedom per node (axial, two shears, torsion, two bending moments)') + ', exact fixed-end actions for member loads, member end releases by static condensation.', 'วิธีสติฟเนสไฟไนต์เอลิเมนต์ ' + (m.plane === 'XZ' ? 'ชิ้นส่วนโครงข้อแข็ง 2 มิติในระนาบ X–Z' : 'ชิ้นส่วนโครงข้อแข็ง 3 มิติ 6 องศาอิสระต่อจุด (แรงตามแนวแกน แรงเฉือนสองทิศ แรงบิด โมเมนต์ดัดสองแกน)') + ' ใช้แรงปลายยึดแน่นที่แม่นตรง และปลดแรงปลายชิ้นส่วนด้วย static condensation')} ${A.opt.pdelta && pro() ? T('Second-order P-Delta analysis of every combination (members subdivided into ' + A.opt.nseg + ' segments).', 'วิเคราะห์อันดับสอง P-Delta ทุกกรณีรวมแรง (แบ่งชิ้นส่วนเป็น ' + A.opt.nseg + ' ส่วน)') : T('First-order (linear) analysis; combinations by superposition.', 'วิเคราะห์อันดับหนึ่ง (เชิงเส้น) รวมแรงโดยการซ้อนทับ')} ${T('Sign convention: N tension +; M_z + = tension on the −y side, M_y + = tension on the −z side of the member local axes.', 'เครื่องหมาย: N แรงดึง +; M_z + ดึงด้าน −y, M_y + ดึงด้าน −z ของแกนเฉพาะที่')}</p>`);
      let n = 4;
      m.combos.filter(c => r.combos[c.id] && !r.combos[c.id].failed).forEach(c => {
        A.src = 'combo:' + c.id; const rc = current(); if (!rc) return;
        const sums = lim(rc.mem, 200).map(mm => { const e = q => [Math.max(...mm[q]), Math.min(...mm[q])], am = q => Math.max(...mm[q].map(Math.abs)); const N = e('N'), My = e('My'), Mz = e('Mz'); return [esc(mm.id), f(N[0], 1), f(N[1], 1), f(am('Vy'), 1), f(am('Vz'), 1), f(am('T'), 1), f(My[0], 1), f(My[1], 1), f(Mz[0], 1), f(Mz[1], 1), f(Math.max(...mm.drel.map(Math.abs), ...mm.drelz.map(Math.abs)) * 1000, 1)]; });
        const ri = m.nodes.map((nn, i) => [nn, i]).filter(([nn]) => supN.includes(nn));
        html += sec(n++, esc(c.id + ' — ' + c.name) + ' <span class="rp-cl">' + c.type + '</span>', (c.type === 'ULS' ? `<div class="an-figs">${fig('Mz', null, 'M<sub>z</sub> (kNm)')}${m.plane === 'XZ' ? fig('N', null, 'N (kN)') : fig('My', null, 'M<sub>y</sub> (kNm)')}</div>` : `<div class="an-figs">${fig('def', null, T('Deflected shape', 'รูปการโก่งตัว'))}</div>`) +
          tbl([T('Node', 'จุดต่อ'), 'Rx', 'Ry', 'Rz (kN)', 'Mx', 'My', 'Mz (kNm)'], ri.map(([nn, i]) => [esc(nn.id)].concat([0, 1, 2, 3, 4, 5].map(d => f(rc.R[6 * i + d], 2))))) +
          tbl([T('Member', 'ชิ้นส่วน'), 'N max', 'N min', '|V<sub>y</sub>|', '|V<sub>z</sub>|', '|T|', 'M<sub>y</sub> max', 'M<sub>y</sub> min', 'M<sub>z</sub> max', 'M<sub>z</sub> min', 'δ (mm)'], sums) + more(rc.mem, 200));
      });
      A.src = keep.src; A.view = keep.view;
      if (r.modal) html += sec(n++, T('Modal analysis', 'การวิเคราะห์โหมด'), tbl([T('Mode', 'โหมด'), 'f (Hz)', 'T (s)', T('Mass X', 'มวล X'), 'Y', 'Z'], r.modal.modes.map((md, i) => [i + 1, f(md.f, 3), f(md.T, 3), f(md.mx * 100, 1) + '%', f(md.my * 100, 1) + '%', f(md.mz * 100, 1) + '%'])));
      if (r.buckling) html += sec(n++, T('Elastic buckling', 'การโก่งเดาะแบบยืดหยุ่น'), tbl([T('Combination', 'กรณีรวมแรง'), 'λcr,1', 'λcr,2', 'λcr,3'], m.combos.filter(c => r.buckling[c.id]).map(c => { const b2 = r.buckling[c.id], l = b2.modes ? b2.modes.map(q => f(q.lam, 2)) : []; return [esc(c.id + ' — ' + c.name), l[0] || (b2.none ? '∞' : '—'), l[1] || '—', l[2] || '—']; })));
      if (r.warn.length) html += `<ul class="warn-list">${r.warn.map(w => `<li>${esc(w)}</li>`).join('')}</ul>`;
      $('#reportWrap').innerHTML = `<div class="rp-bar"><h2>${T('Analysis report', 'รายงานการวิเคราะห์')}</h2>
        <div class="rp-meta">${[['project', T('Project', 'โครงการ')], ['job', T('Job no.', 'เลขที่งาน')], ['ref', T('Model ref.', 'ชื่อแบบจำลอง')], ['by', T('Analysed by', 'ผู้วิเคราะห์')], ['checked', T('Checked by', 'ผู้ตรวจสอบ')]].map(([k2, l]) => `<label>${l}<input id="meta-${k2}" data-meta="${k2}" value="${esc(Mt[k2])}"></label>`).join('')}</div>
        <div class="rp-btns"><button class="btn btn-hot sm" data-act="pdf" id="pdfBtn">${T('Export PDF', 'ส่งออก PDF')}</button><button class="btn btn-ghost sm" data-act="closeReport">${T('Close', 'ปิด')}</button></div></div>
        <article class="report" id="report" lang="${S.ui}">
          <header class="rp-head"><div class="rp-brand">${logoMark(34)}<div><b>StructCap</b><small>${T('Structural analysis · ' + (m.plane === 'XZ' ? '2D' : '3D') + ' frame', 'วิเคราะห์โครงสร้าง · โครงข้อแข็ง ' + (m.plane === 'XZ' ? '2' : '3') + ' มิติ')}</small></div></div>
            <table class="rp-hd"><tr><th>${T('Project', 'โครงการ')}</th><td id="rv-project">${esc(Mt.project)}</td><th>${T('Job no.', 'เลขที่งาน')}</th><td id="rv-job">${esc(Mt.job)}</td></tr>
            <tr><th>${T('Model', 'แบบจำลอง')}</th><td>${esc(m.name || '')} · <span id="rv-ref">${esc(Mt.ref)}</span></td><th>${T('Date', 'วันที่')}</th><td>${today()}</td></tr>
            <tr><th>${T('Analysed', 'วิเคราะห์')}</th><td id="rv-by">${esc(Mt.by)}</td><th>${T('Checked', 'ตรวจสอบ')}</th><td id="rv-checked">${esc(Mt.checked)}</td></tr></table></header>
          ${html}
          <p class="rp-foot"><b>${COPY}</b> · ${T('Generated by StructCap. Units kN, m, kNm. The engineer remains responsible for the model, loads and interpretation of results.', 'จัดทำโดย StructCap หน่วย kN, m, kNm วิศวกรต้องรับผิดชอบต่อแบบจำลอง แรง และการตีความผลลัพธ์')}</p>
        </article>`;
    }

    return { view, mount, onClick, onInput, run, state: A, build, preset, TPL, migrate };
  };
})(typeof window !== 'undefined' ? window : globalThis);
