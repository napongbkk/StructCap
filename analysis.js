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

    // ------------------------------------------------------------------ design standard, materials, combinations
    const SL = G.STEELLIB, STDS = ['AS', 'EC', 'TH'];
    const stdInfo = k => SL.STD[k] || SL.STD.AS;
    const DEFS = {
      AS: { conc: 'N32', steel: 'AS3679-300', tube: 'C350L0', col: ['UB', '360UB50.7'], raf: ['UB', '310UB40.4'] },
      EC: { conc: 'C30/37', steel: 'S355', tube: 'S355', col: ['IPE', 'IPE 360'], raf: ['IPE', 'IPE 300'] },
      TH: { conc: 'FC240', steel: 'SS400', tube: 'SS400', col: ['H', 'H 350×175'], raf: ['H', 'H 300×150'] }
    };
    function concMat(std, gid) { const d = stdInfo(std), g = d.conc.find(q => q[0] === gid) || d.conc.find(q => q[0] === DEFS[std].conc) || d.conc[0]; return { id: g[0], name: T('Concrete ', 'คอนกรีต ') + g[1], kind: 'conc', grade: g[0], fc: g[2], E: g[3], nu: 0.2, rho: d.rhoC }; }
    function steelMat(std, gid) { const d = stdInfo(std), g = d.steel.find(q => q[0] === gid) || d.steel[0]; return { id: g[0], name: g[1], kind: 'steel', grade: g[0], fy: g[2], E: d.Es, nu: 0.3, rho: d.rhoS }; }
    const MAT = { timber: { id: 'TIMBER', name: 'Timber (MGP10)', kind: 'other', E: 10000, nu: 0.3, rho: 5.5 } };
    const stdSec = (id, sr, sz) => ({ id, name: sz, type: 'std', series: sr, size: sz });
    const CASE = (id, type, sw, en, th) => ({ id, name: T(en, th), type, sw: !!sw });
    function preset(code, cases) {
      const G0 = cases.filter(c => c.type === 'G').map(c => c.id), Q0 = cases.filter(c => c.type === 'Q').map(c => c.id), W0 = cases.filter(c => c.type === 'W').map(c => c.id), E0 = cases.filter(c => c.type === 'E').map(c => c.id);
      const out = [], add = (name, type, parts) => { const fct = {}; parts.forEach(([ids, k]) => ids.forEach(id => { fct[id] = r4((fct[id] || 0) + k); })); out.push({ id: 'C' + (out.length + 1), name, type, f: fct }); };
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
      } else if (code === 'TH') { // EIT 1008 / ACI 318-99 strength design load factors
        add('1.4D + 1.7L', 'ULS', [[G0, 1.4], [Q0, 1.7]]);
        W0.forEach(w => { add('0.75(1.4D + 1.7L + 1.7' + w + ')', 'ULS', [[G0, 1.05], [Q0, 1.275], [[w], 1.275]]); add('0.9D + 1.3' + w, 'ULS', [[G0, 0.9], [[w], 1.3]]); });
        E0.forEach(e => { add('0.75(1.4D + 1.7L + 1.87' + e + ')', 'ULS', [[G0, 1.05], [Q0, 1.275], [[e], 1.4025]]); add('0.9D + 1.43' + e, 'ULS', [[G0, 0.9], [[e], 1.43]]); });
        add('D + L (service)', 'SLS', [[G0, 1], [Q0, 1]]);
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
    const blankModel = (std, name, plane, secs, mats, cases) => ({ std, name, plane: plane || '', nodes: [], members: [], sections: secs, materials: mats, cases, loads: [], combos: [], code: stdInfo(std).combo });
    const GQ = () => [CASE('G', 'G', true, 'Dead', 'น้ำหนักบรรทุกคงที่'), CASE('Q', 'Q', false, 'Live', 'น้ำหนักบรรทุกจร')];
    const udl = (cs, member, w, dir) => ({ case: cs, kind: 'udl', member, dir: dir || 'grav', w1: r4(w), w2: '', a: '', b: '' });
    const nload = (cs, node, o) => Object.assign({ case: cs, kind: 'node', node, Fx: 0, Fy: 0, Fz: 0, Mx: 0, My: 0, Mz: 0 }, o);
    function build(kind, p, std) {
      std = STDS.includes(std) ? std : 'AS';
      const D = DEFS[std], CM = concMat(std, D.conc), SM = steelMat(std, D.steel), TM = steelMat(std, D.tube);
      const num = s => String(s).split(/[,\s]+/).map(Number).filter(v => v > 0);
      const steelI = () => [stdSec('COL', D.col[0], D.col[1]), stdSec('RAF', D.raf[0], D.raf[1])];
      let m;
      if (kind === 'building') {
        m = blankModel(std, '', '', [{ id: 'COL', name: '400×400 RC column', type: 'rect', b: 400, h: 400 }, { id: 'BM', name: '300×600 RC beam', type: 'rect', b: 300, h: 600 }], [CM],
          GQ().concat([CASE('WX', 'W', false, 'Wind +X', 'ลม +X'), CASE('WY', 'W', false, 'Wind +Y', 'ลม +Y')]));
        const cum = a => a.reduce((o, v) => { o.push(r4(o[o.length - 1] + v)); return o; }, [0]);
        const xs = cum(num(p.bx)), ys = cum(num(p.by)), zs = cum(num(p.st)), nx = xs.length, ny = ys.length;
        const id = (i, j, k) => 'N' + (k * nx * ny + j * nx + i + 1);
        zs.forEach((z, k) => ys.forEach((y, j) => xs.forEach((x, i) => m.nodes.push({ id: id(i, j, k), x, y, z, sup: k ? 'free' : 'fixed' }))));
        let c = 0, b = 0;
        for (let k = 1; k < zs.length; k++) {
          ys.forEach((y, j) => xs.forEach((x, i) => m.members.push({ id: 'C' + (++c), i: id(i, j, k - 1), j: id(i, j, k), sec: 'COL', mat: CM.id, type: 'frame' })));
          ys.forEach((y, j) => { for (let i = 0; i < nx - 1; i++) m.members.push({ id: 'B' + (++b), i: id(i, j, k), j: id(i + 1, j, k), sec: 'BM', mat: CM.id, type: 'frame' }); });
          xs.forEach((x, i) => { for (let j = 0; j < ny - 1; j++) m.members.push({ id: 'B' + (++b), i: id(i, j, k), j: id(i, j + 1, k), sec: 'BM', mat: CM.id, type: 'frame' }); });
          const top = k === zs.length - 1, W = +p.wind * (top ? 0.6 : 1);
          ys.forEach((y, j) => m.loads.push(nload('WX', id(0, j, k), { Fx: r4(W / ny) })));
          xs.forEach((x, i) => m.loads.push(nload('WY', id(i, 0, k), { Fy: r4(W / nx) })));
        }
        m.members.filter(q => q.sec === 'BM').forEach(q => m.loads.push(udl('G', q.id, +p.g), udl('Q', q.id, +p.q)));
      } else if (kind === 'shed') {
        m = blankModel(std, '', '', steelI().concat([{ id: 'ES', name: 'SHS 100×100×5 (eave / ridge strut)', type: 'tube', shape: 'SHS', size: '100x100x5' }, { id: 'BR', name: 'Rod Ø20 (bracing)', type: 'circ', D: 20 }]), [SM].concat(TM.id !== SM.id ? [TM] : []),
          GQ().concat([CASE('WX', 'W', false, 'Wind across (+X)', 'ลมขวาง (+X)'), CASE('WY', 'W', false, 'Wind along (+Y)', 'ลมตามยาว (+Y)')]));
        const L = +p.span, h = +p.eave, r = +p.rise, s = +p.bay, nb = Math.max(1, Math.round(+p.nb)), base0 = p.base === 'fixed' ? 'fixed' : 'pin', qz = 0.9;
        for (let k = 0; k <= nb; k++) {
          const y = r4(k * s), o = 5 * k, nid = q => 'N' + (o + q), M = (id, i, j, sec) => m.members.push({ id, i: nid(i), j: nid(j), sec, mat: SM.id, type: 'frame' });
          m.nodes.push({ id: nid(1), x: 0, y, z: 0, sup: base0 }, { id: nid(2), x: 0, y, z: h }, { id: nid(3), x: L / 2, y, z: r4(h + r) }, { id: nid(4), x: L, y, z: h }, { id: nid(5), x: L, y, z: 0, sup: base0 });
          M('C' + (2 * k + 1), 1, 2, 'COL'); M('R' + (2 * k + 1), 2, 3, 'RAF'); M('R' + (2 * k + 2), 3, 4, 'RAF'); M('C' + (2 * k + 2), 5, 4, 'COL');
          const tw = (k === 0 || k === nb ? 0.5 : 1) * s;
          ['R' + (2 * k + 1), 'R' + (2 * k + 2)].forEach(id => m.loads.push(udl('G', id, 0.15 * tw, 'gravp'), udl('Q', id, 0.25 * tw, 'gravp'), udl('WX', id, 0.9 * qz * tw, 'ly')));
          m.loads.push(udl('WX', 'C' + (2 * k + 1), 0.7 * qz * tw, 'gx'), udl('WX', 'C' + (2 * k + 2), 0.5 * qz * tw, 'gx'));
          if (k > 0) {
            const q = n => 'N' + (o - 5 + n), b = n => 'N' + (o + n);
            [2, 3, 4].forEach(n => m.members.push({ id: (n === 3 ? 'RS' : 'ES') + (n === 2 ? 'L' : n === 4 ? 'R' : '') + k, i: q(n), j: b(n), sec: 'ES', mat: TM.id, type: 'frame', relI: true, relJ: true }));
            if (k === 1 || k === nb) {
              [[1, 2], [5, 4]].forEach(([lo, hi], t) => { m.members.push({ id: 'XW' + (t ? 'R' : 'L') + k + 'a', i: q(lo), j: b(hi), sec: 'BR', mat: SM.id, type: 'truss' }, { id: 'XW' + (t ? 'R' : 'L') + k + 'b', i: b(lo), j: q(hi), sec: 'BR', mat: SM.id, type: 'truss' }); });
              [[2, 3], [3, 4]].forEach(([u, v], t) => { m.members.push({ id: 'XR' + (t ? 'R' : 'L') + k + 'a', i: q(u), j: b(v), sec: 'BR', mat: SM.id, type: 'truss' }, { id: 'XR' + (t ? 'R' : 'L') + k + 'b', i: b(u), j: q(v), sec: 'BR', mat: SM.id, type: 'truss' }); });
            }
          }
        }
        const Fy = 0.8 * qz * L * (h + r / 2);
        m.loads.push(nload('WY', 'N2', { Fy: r4(Fy / 4) }), nload('WY', 'N3', { Fy: r4(Fy / 2) }), nload('WY', 'N4', { Fy: r4(Fy / 4) }));
      } else if (kind === 'portal') {
        m = blankModel(std, '', 'XZ', steelI(), [SM], GQ().concat([CASE('W1', 'W', false, 'Wind → (left to right)', 'ลม → (ซ้ายไปขวา)'), CASE('W2', 'W', false, 'Wind ← (right to left)', 'ลม ← (ขวาไปซ้าย)')]));
        const L = +p.span, h = +p.eave, r = +p.rise, s = +p.bay, base0 = p.base === 'fixed' ? 'fixed' : 'pin', qz = 0.9;
        m.nodes.push({ id: 'N1', x: 0, y: 0, z: 0, sup: base0 }, { id: 'N2', x: 0, y: 0, z: h }, { id: 'N3', x: L / 2, y: 0, z: r4(h + r) }, { id: 'N4', x: L, y: 0, z: h }, { id: 'N5', x: L, y: 0, z: 0, sup: base0 });
        [['C1', 'N1', 'N2', 'COL'], ['R1', 'N2', 'N3', 'RAF'], ['R2', 'N3', 'N4', 'RAF'], ['C2', 'N5', 'N4', 'COL']].forEach(([id, i, j, sec]) => m.members.push({ id, i, j, sec, mat: SM.id, type: 'frame' }));
        ['R1', 'R2'].forEach(id => m.loads.push(udl('G', id, 0.15 * s, 'gravp'), udl('Q', id, 0.25 * s, 'gravp')));
        [['W1', 1], ['W2', -1]].forEach(([cs, sg]) => { m.loads.push(udl(cs, sg > 0 ? 'C1' : 'C2', sg * 0.7 * qz * s, 'gx'), udl(cs, sg > 0 ? 'C2' : 'C1', sg * 0.5 * qz * s, 'gx')); ['R1', 'R2'].forEach(id => m.loads.push(udl(cs, id, 0.9 * qz * s, 'ly'))); });
      } else if (kind === 'beam') {
        m = blankModel(std, '', 'XZ', [{ id: 'S1', name: '300×600 RC', type: 'rect', b: 300, h: 600 }], [CM], GQ());
        let x = 0; m.nodes.push({ id: 'N1', x: 0, y: 0, z: 0, sup: 'pin' });
        num(p.spans).forEach((L, i) => { x = r4(x + L); m.nodes.push({ id: 'N' + (i + 2), x, y: 0, z: 0, sup: 'rollerX' }); m.members.push({ id: 'B' + (i + 1), i: 'N' + (i + 1), j: 'N' + (i + 2), sec: 'S1', mat: CM.id, type: 'frame' }); });
        m.members.forEach(b => m.loads.push(udl('G', b.id, +p.g), udl('Q', b.id, +p.q)));
      } else if (kind === 'truss') {
        m = blankModel(std, '', 'XZ', [{ id: 'CH', name: 'SHS 125×125×5 (chord)', type: 'tube', shape: 'SHS', size: '125x125x5' }, { id: 'WEB', name: 'SHS 100×100×4 (web)', type: 'tube', shape: 'SHS', size: '100x100x4' }], [TM], GQ());
        const L = +p.span, d = +p.depth, n = Math.max(2, Math.round(+p.panels / 2) * 2), dx = L / n, K = p.kind;
        let k = 0; const mem = (a, b, s) => m.members.push({ id: 'T' + (++k), i: a, j: b, sec: s, mat: TM.id, type: 'truss' });
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
        m = blankModel(std, '', '', [{ id: 'RC1', name: '300×600 RC', type: 'rect', b: 300, h: 600 }, stdSec('ST1', D.raf[0], D.raf[1])], [CM, SM], GQ());
      }
      m.combos = preset(m.code, m.cases);
      m.name = T(TPL[kind].n[0], TPL[kind].n[1]);
      return m;
    }
    // 2D models saved by the first analysis page (x, y up) → 3D model in the XZ plane
    function migrate(o) {
      if (!o || !o.nodes) return null;
      if (o.nodes.some(n => n.z !== undefined)) return o;
      const m = clone(o); m.plane = 'XZ'; m.std = 'AS';
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
    const VIEWS = { '3d': [-PI / 2 - 0.72, 0.42], plan: [-PI / 2, PI / 2], xz: [-PI / 2, 0], yz: [0, 0] };
    const initStd = ({ EC2: 'EC', EC: 'EC', TH: 'TH', AS: 'AS' })[S.codeSel || S.code] || 'AS';
    const A = {
      model: saved && saved.model ? saved.model : build('building', TPL.building.p, initStd),
      opt: Object.assign({ pdelta: false, modes: false, nmodes: 6, buckling: false, nseg: 4, massG: 1, massQ: 0.3, snap: 0.5 }, saved && saved.opt || {}),
      step: 'std', rview: 'Mz', src: null, sel: { n: [], m: [] }, tool: 'select', draw: null, mode: 0, labels: true, loadsOn: false, dscale: 1,
      res: null, err: null, errNode: null, tpl: 'building', tplOpen: false, rtab: 'sum', lcase: 'G', cut: 'all', cb: null, ss: null,
      cam: { v: '3d', yaw: VIEWS['3d'][0], pitch: VIEWS['3d'][1], k: null, t: [0, 0, 0] }, hist: [], fut: [], ver: 0, resVer: -1, hover: null, mouse: null, box: null
    };
    if (!STDS.includes(A.model.std)) A.model.std = 'AS';
    if (A.model.plane === 'XZ') Object.assign(A.cam, { v: 'xz', yaw: VIEWS.xz[0], pitch: VIEWS.xz[1] });
    if (!A.model.cases.some(c => c.id === A.lcase)) A.lcase = (A.model.cases[0] || {}).id || '';
    const persist = () => lsSet({ model: A.model, opt: A.opt });
    let lastSnap = 0;
    function snap(force) { const now = Date.now(); if (!force && now - lastSnap < 900) return; lastSnap = now; A.hist.push(JSON.stringify(A.model)); if (A.hist.length > 60) A.hist.shift(); A.fut = []; }
    function undo(redo) {
      const from = redo ? A.fut : A.hist, to = redo ? A.hist : A.fut; if (!from.length) return;
      to.push(JSON.stringify(A.model)); A.model = JSON.parse(from.pop()); lastSnap = 0;
      A.sel = { n: A.sel.n.filter(id => A.model.nodes.some(q => q.id === id)), m: A.sel.m.filter(id => A.model.members.some(q => q.id === id)) };
      changed(true);
    }

    // ------------------------------------------------------------------ analysis (run on demand)
    function run() {
      A.err = null; A.errNode = null; A.res = null;
      const m = A.model;
      try {
        if (!m.nodes.length || !m.members.length) throw new Error(T('Add nodes and elements first — steps 3 and 4.', 'เพิ่มจุดต่อและชิ้นส่วนก่อน — ขั้นตอนที่ 3 และ 4'));
        if (!m.cases.length) throw new Error(T('Add at least one load case — step 6.', 'เพิ่มกรณีน้ำหนักอย่างน้อยหนึ่งกรณี — ขั้นตอนที่ 6'));
        if (!pro() && m.members.length > FREE_MEMBERS) throw new Error(T('The Free plan analyses up to ' + FREE_MEMBERS + ' elements. Upgrade to Pro for larger models.', 'แพ็กเกจ Free วิเคราะห์ได้ไม่เกิน ' + FREE_MEMBERS + ' ชิ้นส่วน อัปเกรดเป็น Pro สำหรับโมเดลที่ใหญ่กว่า'));
        const o = A.opt, go = pro();
        const mass = {}; m.cases.forEach(c => { if (c.type === 'G') mass[c.id] = +o.massG || 0; else if (c.type === 'Q') mass[c.id] = +o.massQ || 0; });
        A.res = F.analyse(m, { pdelta: go && o.pdelta, modes: go && o.modes ? Math.max(1, Math.min(20, o.nmodes | 0)) : 0, buckling: go && o.buckling, nseg: Math.max(2, Math.min(10, o.nseg | 0)), massSrc: mass });
        if (!A.src || !srcList().some(s => s[0] === A.src)) A.src = m.combos.length ? 'combo:' + m.combos[0].id : 'case:' + m.cases[0].id;
      } catch (e) { A.err = e.message || String(e); A.errNode = e.node || null; }
      A.resVer = A.ver;
      return !A.err;
    }
    const fresh = () => !!A.res && A.resVer === A.ver;
    const curView = () => (A.step === 'res' && fresh() ? A.rview : 'model');
    function changed(side) { A.ver++; persist(); redraw(); updCounts(); if (side) sideRefresh(); }

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
      c.k = Math.min((W - 110) / Math.max(x1 - x0, 1), (H - 120) / Math.max(y1 - y0, 1), 400);
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
      const B = basis(c), k = c.k, t = c.t, view = o.view || curView(), rep = !!o.rep;
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
      const scr = { n: [], m: [] }, resMode = view !== 'model', solidOn = !!A.solid && !resMode && !rep;
      if (solidOn) drawSolid();
      m.members.forEach(mb => {
        const a = nd[mb.i], b = nd[mb.j]; if (!a || !b) return;
        const pa = P(P3(a)), pb = P(P3(b)), vis = memVis(mb), sel = selM.has(mb.id), hov = !rep && A.hover && A.hover.k === 'm' && A.hover.id === mb.id;
        if (!vis) { g.save(); g.globalAlpha = 0.14; line(pa, pb, pal.muted, 1.2); g.restore(); return; }
        const col = sel ? pal.acc : hov ? pal.blue : resMode ? pal.soft : mb.type === 'truss' ? pal.teal : pal.ink;
        if (solidOn) { scr.m.push({ id: mb.id, a: pa, b: pb }); return; }
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
      if (view === 'model' && (A.loadsOn || rep)) drawLoads(o.lcase || A.lcase || 'all');
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
      if (!rep && A.box) { const cr = A.box[2] < A.box[0], bx = [Math.min(A.box[0], A.box[2]), Math.min(A.box[1], A.box[3]), Math.abs(A.box[2] - A.box[0]), Math.abs(A.box[3] - A.box[1])]; g.fillStyle = cr ? 'rgba(22,163,74,0.08)' : 'rgba(46,107,255,0.07)'; g.fillRect(...bx); g.strokeStyle = cr ? pal.ok : pal.blue; g.lineWidth = 1.2; g.setLineDash(cr ? [6, 4] : []); g.strokeRect(...bx); g.setLineDash([]); text(cr ? T('crossing', 'ตัดผ่าน') : T('window', 'หน้าต่าง'), bx[0] + 4, bx[1] - 5, cr ? pal.ok : pal.blue, { font: '10.5px system-ui, sans-serif' }) + (A.boxHow === 'add' ? text('+', bx[0] + bx[2] - 10, bx[1] - 5, pal.blue, { font: '700 12px system-ui' }) : A.boxHow === 'sub' ? text('−', bx[0] + bx[2] - 10, bx[1] - 5, pal.pink, { font: '700 12px system-ui' }) : 0); }
      // axis triad
      const o0 = [34, H - 30];
      [[[1, 0, 0], 'X', pal.pink], [[0, 1, 0], 'Y', pal.ok], [[0, 0, 1], 'Z', pal.blue]].forEach(([e, lb, col]) => { const dx = dot(e, B.r), dy = dot(e, B.u); if (Math.hypot(dx, dy) < 0.08) { text(lb, o0[0] + 2, o0[1] - 2, col, { font: '600 10px ui-monospace, monospace' }); return; } const q = [o0[0] + 22 * dx, o0[1] - 22 * dy]; arrow(o0, q, col, 1.6); text(lb, q[0] + 3, q[1] + 3, col, { font: '600 10px ui-monospace, monospace' }); });
      notes.forEach((s, i) => text(s, 14, 22 + i * 16, pal.muted, { font: '12px system-ui, sans-serif' }));
      return scr;

      function drawSolid() {
        const faces = [], cache = {}, Ld = (v => { const l = Math.hypot(...v); return v.map(x => x / l); })(addv([0.25, 0.35, 0.9], B.d, 0.8));
        const dark = (pal.bg || '').trim().toLowerCase() !== '#ffffff' && /^#([0-3])/.test((pal.bg || '').trim());
        const BASE = { conc: dark ? [150, 156, 166] : [190, 194, 200], steel: dark ? [110, 140, 190] : [126, 150, 188], sel: [255, 120, 40], hov: [60, 120, 255] };
        m.members.forEach(mb => {
          const a = nd[mb.i], b = nd[mb.j]; if (!a || !b || !memVis(mb)) return;
          const poly = cache[mb.sec] || (cache[mb.sec] = secPoly(mb.sec)); if (!poly) return;
          const pa = P3(a), pb = P3(b), ax = F.axes(pa, pb, mb.beta), W3 = (p0, q) => addv(addv(p0, ax.ez, q[0] / 1000), ax.ey, q[1] / 1000);
          const ri = poly.pts.map(q => W3(pa, q)), rj = poly.pts.map(q => W3(pb, q)), n = ri.length;
          const mat = m.materials.find(q => q.id === mb.mat), kind = mat ? mat.kind : poly.steel ? 'steel' : 'conc';
          const rgb = selM.has(mb.id) ? BASE.sel : A.hover && A.hover.k === 'm' && A.hover.id === mb.id ? BASE.hov : BASE[kind === 'steel' ? 'steel' : 'conc'];
          const push = (pts, nrm, edge) => { if (dot(nrm, B.d) <= 1e-9) return; const sp = pts.map(P); faces.push({ sp, z: sp.reduce((t, q) => t + q[2], 0) / sp.length, l: 0.42 + 0.58 * Math.abs(dot(nrm, Ld)), rgb, edge }); };
          for (let i = 0; i < n; i++) { const i2 = (i + 1) % n, dz = poly.pts[i2][0] - poly.pts[i][0], dy = poly.pts[i2][1] - poly.pts[i][1], h = Math.hypot(dz, dy) || 1; push([ri[i], ri[i2], rj[i2], rj[i]], addv(addv([0, 0, 0], ax.ez, dy / h), ax.ey, -dz / h), !poly.round); }
          push(ri, ax.ex.map(v => -v), true); push(rj, ax.ex, true);
        });
        faces.sort((p, q) => p.z - q.z);
        g.lineJoin = 'round';
        faces.forEach(fc => {
          const c = fc.rgb.map(v => Math.round(Math.min(255, v * fc.l))); g.beginPath(); fc.sp.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath();
          g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; g.fill(); g.strokeStyle = fc.edge ? `rgba(20,24,32,${dark ? 0.55 : 0.35})` : g.fillStyle; g.lineWidth = fc.edge ? 0.6 : 0.8; g.stroke();
        });
      }
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
    function redraw(fitOut) {
      const cv = $('#anCv'); if (!cv) return; cvEl = cv;
      const W = cv.clientWidth || 800, H = cv.clientHeight || 520;
      A.scr = render(cv, { W, H, dpr: Math.min(2, G.devicePixelRatio || 1), pal: palette() });
      // after adding or moving nodes, refit if any node left the view
      if (fitOut && A.scr.n.some(q => q.p[0] < 10 || q.p[0] > W - 10 || q.p[1] < 10 || q.p[1] > H - 10)) { A.cam.k = null; A.scr = render(cv, { W, H, dpr: Math.min(2, G.devicePixelRatio || 1), pal: palette() }); }
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
    // window (drag to the right): only items fully inside · crossing (drag to the left): anything the box touches
    function boxSelect(b, how) {
      const x0 = Math.min(b[0], b[2]), x1 = Math.max(b[0], b[2]), y0 = Math.min(b[1], b[3]), y1 = Math.max(b[1], b[3]), inside = p => p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1, cross = b[2] < b[0];
      const segX = (p, q, r, s2) => { const d = (q[0] - p[0]) * (s2[1] - r[1]) - (q[1] - p[1]) * (s2[0] - r[0]); if (!d) return false; const u = ((r[0] - p[0]) * (s2[1] - r[1]) - (r[1] - p[1]) * (s2[0] - r[0])) / d, v = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d; return u >= 0 && u <= 1 && v >= 0 && v <= 1; };
      const touches = (a, c) => inside(a) || inside(c) || [[[x0, y0], [x1, y0]], [[x1, y0], [x1, y1]], [[x1, y1], [x0, y1]], [[x0, y1], [x0, y0]]].some(([r, s2]) => segX(a, c, r, s2));
      const n = A.scr.n.filter(q => inside(q.p)).map(q => q.id), m = A.scr.m.filter(q => cross ? touches(q.a, q.b) : inside(q.a) && inside(q.b)).map(q => q.id);
      if (how === 'add') A.sel = { n: [...new Set(A.sel.n.concat(n))], m: [...new Set(A.sel.m.concat(m))] };
      else if (how === 'sub') { const sn = new Set(n), sm = new Set(m); A.sel = { n: A.sel.n.filter(q => !sn.has(q)), m: A.sel.m.filter(q => !sm.has(q)) }; }
      else A.sel = { n, m };
    }
    function selectBy(k) {
      const m = A.model, nd = nodeMap(), vis = new Set(m.nodes.filter(nodeVisible).map(n => n.id)), mv = m.members.filter(q => vis.has(q.i) && vis.has(q.j));
      const kind = q => { const a = nd[q.i], b = nd[q.j]; if (!a || !b) return ''; const v = sub(P3(b), P3(a)), L = Math.hypot(...v) || 1, c = Math.abs(v[2]) / L; return c > 0.97 ? 'col' : c < 0.03 ? 'beam' : 'brace'; };
      if (k === 'all') A.sel = { n: [...vis], m: mv.map(q => q.id) };
      else if (k === 'none') A.sel = { n: [], m: [] };
      else if (k === 'inv') { const sn = new Set(A.sel.n), sm = new Set(A.sel.m); A.sel = { n: [...vis].filter(q => !sn.has(q)), m: mv.filter(q => !sm.has(q.id)).map(q => q.id) }; }
      else if (k === 'nodes') A.sel = { n: [...vis], m: [] };
      else if (k === 'elems') A.sel = { n: [], m: mv.map(q => q.id) };
      else if (k === 'col' || k === 'beam' || k === 'brace') A.sel = { n: [], m: mv.filter(q => kind(q) === k).map(q => q.id) };
      else if (k === 'sup') A.sel = { n: m.nodes.filter(n => vis.has(n.id) && F.fixOf(n).some(Boolean)).map(n => n.id), m: [] };
      else if (k === 'samesec' || k === 'samemat') { const f0 = k === 'samesec' ? 'sec' : 'mat', want = new Set(m.members.filter(q => A.sel.m.includes(q.id)).map(q => q[f0])); if (!want.size) { toast(T('Select an element first.', 'เลือกชิ้นส่วนก่อน'), ''); return; } A.sel = { n: [], m: mv.filter(q => want.has(q[f0])).map(q => q.id) }; }
      else if (k.startsWith('sec:')) A.sel = { n: [], m: mv.filter(q => q.sec === k.slice(4)).map(q => q.id) };
      selChanged();
      toast(A.sel.n.length || A.sel.m.length ? (A.sel.n.length ? A.sel.n.length + T(' node(s) ', ' จุดต่อ ') : '') + (A.sel.m.length ? A.sel.m.length + T(' element(s) ', ' ชิ้นส่วน ') : '') + T('selected', 'ที่เลือก') : T('Selection cleared', 'ล้างการเลือกแล้ว'), '');
    }
    function selChanged() {
      if (A.step !== 'res') { if (A.sel.n.length && !['node', 'sup', 'load'].includes(A.step)) A.step = 'node'; else if (!A.sel.n.length && A.sel.m.length && !['elem', 'sup', 'load'].includes(A.step)) A.step = 'elem'; }
      sideRefresh(); redraw(); const mm = $('#anMember'); if (mm) mm.innerHTML = memberHTML();
    }
    function bindCanvas(cv) {
      const pts = new Map(); let mode = null, sx = 0, sy = 0, lx = 0, ly = 0, moved = false, pd = 0;
      const rel = e => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
      cv.addEventListener('pointerdown', e => {
        cv.focus({ preventScroll: true }); cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, rel(e));
        const [x, y] = rel(e); sx = lx = x; sy = ly = y; moved = false;
        if (pts.size === 2) { const [a, b] = [...pts.values()]; pd = Math.hypot(a[0] - b[0], a[1] - b[1]); mode = 'pinch'; A.box = null; return; }
        const is3 = A.cam.v === '3d', touch = e.pointerType === 'touch';
        if (e.button === 1 || (e.button === 2 && e.shiftKey)) mode = 'pan';
        else if (e.button === 2) mode = is3 ? 'rot' : 'pan';
        else if (A.tool === 'orbit') mode = is3 && !e.shiftKey ? 'rot' : 'pan';
        else if (A.tool === 'select' || (!touch && (e.ctrlKey || e.metaKey || e.shiftKey))) mode = 'box';
        else mode = is3 ? 'rot' : 'pan';
        A.boxHow = e.shiftKey ? 'add' : e.ctrlKey || e.metaKey ? 'sub' : 'new';
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
        if (mode === 'box' && moved && A.box) { boxSelect(A.box, A.boxHow); A.box = null; selChanged(); mode = null; return; }
        A.box = null;
        if (!moved && e.type === 'pointerup' && mode !== 'pinch') clickAt(x, y, e);
        mode = null;
      };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('pointerleave', () => { if (!pts.size && A.hover) { A.hover = null; A.mouse = null; redraw(); } });
      cv.addEventListener('wheel', e => { e.preventDefault(); const [x, y] = rel(e); zoomAt(x, y, Math.exp(-e.deltaY * 0.0012)); }, { passive: false });
      cv.addEventListener('contextmenu', e => { e.preventDefault(); if (A.draw && !moved) { A.draw = null; redraw(); } });
      // drop a property dragged from the tree
      cv.addEventListener('dragover', e => { if (!A.dnd) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; const [x, y] = rel(e), h = pickAt(x, y), want = A.dnd.startsWith('sup:') ? 'n' : 'm', ok = h && h.k === want ? h : null; if ((ok && (!A.hover || A.hover.id !== ok.id || A.hover.k !== ok.k)) || (!ok && A.hover)) { A.hover = ok; redraw(); } });
      cv.addEventListener('dragleave', () => { if (A.hover) { A.hover = null; redraw(); } });
      cv.addEventListener('drop', e => { if (!A.dnd) return; e.preventDefault(); const [x, y] = rel(e), h = pickAt(x, y), v = A.dnd; A.dnd = null; A.hover = null; dropApply(v, h); });
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
      m.members.push({ id, i, j, sec, mat, type: base0.type || A.lastType || 'frame', relI: !!base0.relI, relJ: !!base0.relJ, beta: base0.beta || 0 });
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
    const SECT = () => [['rect', T('Rectangle', 'สี่เหลี่ยม')], ['circ', T('Circle', 'วงกลม')], ['std', T('Standard steel', 'เหล็กมาตรฐาน')], ['tube', 'CHS / SHS / RHS'], ['I', T('I-section (custom)', 'หน้าตัด I (กำหนดเอง)')], ['user', T('User A, I, J', 'กำหนดเอง A, I, J')]];
    const CTYPES = () => [['G', T('G — dead', 'G — คงที่')], ['Q', T('Q — live', 'Q — จร')], ['W', T('W — wind', 'W — ลม')], ['E', T('E — earthquake', 'E — แผ่นดินไหว')], ['O', T('Other', 'อื่น ๆ')]];
    const LKIND = () => [['udl', T('Distributed', 'แผ่กระจาย')], ['point', T('Point', 'แรงจุด')], ['moment', T('Moment', 'โมเมนต์')]];
    const sel = (opts, v, attrs) => `<select ${attrs}>${opts.map(o => `<option value="${esc(o[0])}" ${String(v) === String(o[0]) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
    const inp = (v, attrs, w) => `<input ${attrs} value="${esc(v == null ? '' : v)}" ${w ? `style="width:${w}px"` : ''}>`;
    const cell = (tbl, i, fd, v, type, w) => inp(v, `data-tb="${tbl}" data-i="${i}" data-f="${fd}" ${type === 'n' ? 'type="number" step="any" inputmode="decimal"' : ''}`, w);
    const del = (tb, i) => `<button class="icon-btn" data-act="an-del" data-tb="${tb}" data-i="${i}" aria-label="${T('Delete row', 'ลบแถว')}">×</button>`;
    const addBtn = (tb, lbl) => `<button class="linkbtn" data-act="an-add" data-tb="${tb}">+ ${lbl}</button>`;
    const fld = (lbl, html) => `<label class="an-f"><span>${lbl}</span>${html}</label>`;
    const ins = (k, v, type, w) => inp(v, `data-ins="${k}" ${type === 'n' ? 'type="number" step="any" inputmode="decimal"' : ''}`, w);
    const num = (id, v) => `<input id="${id}" type="number" step="any" inputmode="decimal" value="${v}">`;
    const secOpts = () => A.model.sections.map(s => [s.id, s.id + (s.name && s.name !== s.id ? ' · ' + s.name : '')]);
    const matOpts = () => A.model.materials.map(s => [s.id, s.id + (s.name ? ' · ' + s.name : '')]);
    const caseOpts = () => A.model.cases.map(c => [c.id, c.id + ' — ' + c.name]);
    const wrap = h => `<div class="tbl-wrap">${h}</div>`;
    const hint = h => `<p class="hint">${h}</p>`;
    const blk = (title, body, cls) => `<div class="an-blk ${cls || ''}">${title ? `<h4>${title}</h4>` : ''}${body}</div>`;
    const selCount = () => { const n = A.sel.n.length, m = A.sel.m.length; return n + m ? `<div class="an-ihead"><b>${(n ? n + ' ' + T(n > 1 ? 'nodes' : 'node', 'จุดต่อ') : '') + (n && m ? ' · ' : '') + (m ? m + ' ' + T(m > 1 ? 'elements' : 'element', 'ชิ้นส่วน') : '')} ${T('selected', 'ที่เลือก')}</b><span class="grow"></span><button class="btn btn-ghost xs" data-act="an-clear">${T('Clear', 'ยกเลิก')}</button><button class="btn btn-ghost xs danger" data-act="an-delsel">${T('Delete', 'ลบ')}</button></div>` : ''; };
    const nodeOpts = () => A.model.nodes.map(n => [n.id, n.id]);
    const big = n => (n > 300 ? hint(T('Showing the first 300 rows — select items in the view to edit the rest.', 'แสดง 300 แถวแรก — เลือกในมุมมองเพื่อแก้ไขส่วนที่เหลือ')) : '');

    // ------------------------------------------------------------------ compact lists (fit the tree without sideways scrolling)
    const OPEN = {};
    const isOpen = (k, id) => OPEN[k] === String(id);
    const liHead = (k, id, main, sub, extra) => `<button class="an-lih" data-act="an-open" data-k="${k}" data-id="${esc(String(id))}" aria-expanded="${isOpen(k, id)}"><span class="an-lim">${main}</span><span class="an-lis">${sub || ''}</span>${extra || ''}</button>`;
    const liDel = (tb, i) => `<button class="icon-btn an-lix" data-act="an-del" data-tb="${tb}" data-i="${i}" aria-label="${T('Delete', 'ลบ')}">×</button>`;
    const grid2 = h => `<div class="an-row2">${h}</div>`;
    const cf = (lbl, tb, i, fd, v, type) => fld(lbl, inp(v == null ? '' : v, `data-tb="${tb}" data-i="${i}" data-f="${fd}" ${type === 'n' ? 'type="number" step="any" inputmode="decimal"' : ''}`));
    const cs2 = (lbl, opts, v, tb, i, fd) => fld(lbl, sel(opts, v, `data-tb="${tb}" data-i="${i}" data-f="${fd}"`));
    function matTable() {
      const m = A.model;
      return `<div class="an-list">${m.materials.map((s, i) => `<div class="an-li ${isOpen('mat', s.id) ? 'open' : ''}" draggable="true" data-dnd="mat:${esc(s.id)}"><div class="an-lirow">${liHead('mat', s.id, '<span class="an-drag" aria-hidden="true">⠿</span>' + esc(s.id), esc(s.name || '') + ' · E ' + f(+s.E, 0) + (s.fc ? " · f'c " + f(+s.fc, 1) : s.fy ? ' · fy ' + f(+s.fy, 0) : ''))}${liDel('materials', i)}</div>
        ${isOpen('mat', s.id) ? `<div class="an-lied">${grid2(cf('ID', 'materials', i, 'id', s.id) + cf(T('Name', 'ชื่อ'), 'materials', i, 'name', s.name))}${`<div class="an-row3">${cf('E (MPa)', 'materials', i, 'E', s.E, 'n')}${cf('ν', 'materials', i, 'nu', s.nu === undefined ? 0.3 : s.nu, 'n')}${cf('γ (kN/m³)', 'materials', i, 'rho', s.rho, 'n')}</div>`}</div>` : ''}</div>`).join('')}</div>`;
    }
    function secTable() {
      const m = A.model, ser = stdInfo(m.std).series.filter(q => SL.LIB[q]);
      return `<div class="an-list">${m.sections.map((s, i) => {
        const p = F.secProps(s), open = isOpen('sec', s.id);
        const sub = ({ rect: 'b×h ' + s.b + '×' + s.h, circ: 'Ø' + s.D, std: s.size, tube: s.shape + ' ' + s.size, I: 'I ' + s.d + '×' + s.bf, user: T('user', 'กำหนดเอง') })[s.type] + ' · A ' + f(p.A, 0) + ' · I<sub>z</sub> ' + f(p.Iz / 1e6, 1) + 'e6';
        let ed = '';
        if (open) {
          const dims = s.type === 'rect' ? grid2(cf('b (mm)', 'sections', i, 'b', s.b, 'n') + cf('h (mm)', 'sections', i, 'h', s.h, 'n'))
            : s.type === 'circ' ? grid2(cf('D (mm)', 'sections', i, 'D', s.D, 'n') + '<span></span>')
              : s.type === 'I' ? `<div class="an-row4">${cf('d', 'sections', i, 'd', s.d, 'n')}${cf('bf', 'sections', i, 'bf', s.bf, 'n')}${cf('tf', 'sections', i, 'tf', s.tf, 'n')}${cf('tw', 'sections', i, 'tw', s.tw, 'n')}</div>`
                : s.type === 'std' ? grid2(cs2(T('Series', 'ชุด'), [...new Set(ser.concat([s.series]))].map(q => [q, q]), s.series, 'sections', i, 'series') + cs2(T('Size', 'ขนาด'), SL.sizes(s.series).map(z => [z, z]), s.size, 'sections', i, 'size'))
                  : s.type === 'tube' ? grid2(cs2(T('Shape', 'รูปตัด'), [['CHS', 'CHS'], ['SHS', 'SHS'], ['RHS', 'RHS']], s.shape || 'SHS', 'sections', i, 'shape') + cs2(T('Size', 'ขนาด'), (G.GANTRY ? G.GANTRY.sizeOptions(s.shape || 'SHS') : []).map(o => [o[0], o[1]]), s.size, 'sections', i, 'size'))
                    : `<div class="an-row4">${cf('A', 'sections', i, 'A', s.A, 'n')}${cf('I<sub>z</sub>', 'sections', i, 'Iz', s.Iz || s.I, 'n')}${cf('I<sub>y</sub>', 'sections', i, 'Iy', s.Iy, 'n')}${cf('J', 'sections', i, 'J', s.J, 'n')}</div>`;
          ed = `<div class="an-lied"><div class="an-secprev">${secSVG(s, 200, 150)}</div>${grid2(cf('ID', 'sections', i, 'id', s.id) + cs2(T('Type', 'ชนิด'), SECT(), s.type, 'sections', i, 'type'))}${dims}${hint(`A = ${f(p.A, 0)} mm² · I<sub>z</sub> = ${f(p.Iz / 1e6, 2)} · I<sub>y</sub> = ${f(p.Iy / 1e6, 2)} · J = ${f(p.J / 1e6, 3)} ×10⁶ mm⁴`)}</div>`;
        }
        return `<div class="an-li ${open ? 'open' : ''}" draggable="true" data-dnd="sec:${esc(s.id)}"><div class="an-lirow">${liHead('sec', s.id, '<span class="an-drag" aria-hidden="true">⠿</span>' + esc(s.id), sub)}${liDel('sections', i)}</div>${ed}</div>`;
      }).join('')}</div>`;
    }
    function nodeTable() {
      const m = A.model, sup = n => (n.sup && n.sup !== 'free' ? ((SUP().find(q => q[0] === n.sup) || [])[1] || n.sup).split(' (')[0] : '');
      return `<div class="an-list">${m.nodes.slice(0, 400).map(n => `<button class="an-lirow an-pickrow ${A.sel.n.includes(n.id) ? 'on' : ''}" data-act="an-pickn" data-n="${esc(n.id)}"><span class="an-lim">${esc(n.id)}</span><span class="an-lis mono">(${f(+n.x || 0, 2)}, ${f(+n.y || 0, 2)}, ${f(+n.z || 0, 2)})</span><span class="an-lit">${esc(sup(n))}</span></button>`).join('')}</div>` + (m.nodes.length > 400 ? hint(T('First 400 shown — select in the view for the rest.', 'แสดง 400 รายการแรก — เลือกในมุมมองสำหรับส่วนที่เหลือ')) : '');
    }
    function memTable() {
      const m = A.model, nd = nodeMap();
      return `<div class="an-list">${m.members.slice(0, 400).map(q => { const a = nd[q.i], b = nd[q.j], L = a && b ? Math.hypot(...sub(P3(b), P3(a))) : 0; return `<button class="an-lirow an-pickrow ${A.sel.m.includes(q.id) ? 'on' : ''}" data-act="an-pick" data-m="${esc(q.id)}"><span class="an-lim">${esc(q.id)}</span><span class="an-lis">${esc(q.i)}→${esc(q.j)} · ${esc(q.sec)} · ${esc(q.mat)}${q.type === 'truss' ? ' · ' + T('truss', 'โครงถัก') : ''}</span><span class="an-lit mono">${f(L, 2)} m</span></button>`; }).join('')}</div>` + (m.members.length > 400 ? hint(T('First 400 shown — select in the view for the rest.', 'แสดง 400 รายการแรก — เลือกในมุมมองสำหรับส่วนที่เหลือ')) : '');
    }
    function caseTable() {
      const m = A.model;
      return `<div class="an-list">${m.cases.map((c, i) => `<div class="an-li an-case ${A.lcase === c.id ? 'on' : ''}"><div class="an-caserow">${inp(c.id, `data-tb="cases" data-i="${i}" data-f="id" aria-label="ID"`)}${inp(c.name, `data-tb="cases" data-i="${i}" data-f="name" aria-label="${T('Description', 'คำอธิบาย')}"`)}${sel(CTYPES().map(q => [q[0], q[0]]), c.type, `data-tb="cases" data-i="${i}" data-f="type" aria-label="${T('Type', 'ประเภท')}" title="${esc((CTYPES().find(q => q[0] === c.type) || [])[1] || '')}"`)}<label class="an-sw" title="${T('Self-weight', 'น้ำหนักตัวเอง')}"><input type="checkbox" data-tb="cases" data-i="${i}" data-f="sw" ${c.sw ? 'checked' : ''}> SW</label><button class="linkbtn" data-act="an-gocase" data-c="${esc(c.id)}" title="${T('Loads in this case', 'แรงในกรณีนี้')}">${m.loads.filter(l => l.case === c.id).length}→</button>${liDel('cases', i)}</div></div>`).join('')}</div>` + hint(T('ID · description · type (G, Q, W, E, O) · SW = self-weight · number of loads.', 'ID · คำอธิบาย · ประเภท (G, Q, W, E, O) · SW = น้ำหนักตัวเอง · จำนวนแรง')) + addBtn('cases', T('Add load case', 'เพิ่มกรณีน้ำหนัก'));
    }
    function loadTable(cs) {
      const m = A.model, rows = m.loads.map((l, i) => [l, i]).filter(([l]) => l.case === cs);
      if (!rows.length) return hint(T('No loads in this case yet.', 'ยังไม่มีแรงในกรณีนี้'));
      const dl = l => ((l.kind === 'moment' ? MDIRS() : DIRS()).find(d => d[0] === (l.dir || (l.kind === 'moment' ? 'lz' : 'grav'))) || ['', ''])[1].split(' (')[0];
      const desc = l => l.kind === 'node' ? ['Fx', 'Fy', 'Fz', 'Mx', 'My', 'Mz'].filter(q => +l[q]).map(q => q + ' ' + f(+l[q], 2)).join(', ') || '0'
        : l.kind === 'udl' ? `w ${f(+l.w1 || 0, 2)}${l.w2 !== '' && l.w2 != null ? '→' + f(+l.w2, 2) : ''} kN/m · ${dl(l)}${+l.a || (l.b !== '' && l.b != null) ? ` · ${f(+l.a || 0, 2)}–${l.b !== '' && l.b != null ? f(+l.b, 2) : 'L'} m` : ''}`
          : l.kind === 'point' ? `P ${f(+l.P || 0, 2)} kN @ ${f(+l.a || 0, 2)} m · ${dl(l)}` : `M ${f(+l.M || 0, 2)} kNm @ ${f(+l.a || 0, 2)} m · ${dl(l)}`;
      return `<h4>${T('Loads in ', 'แรงในกรณี ')}${esc(cs)} (${rows.length})</h4><div class="an-list">${rows.slice(0, 400).map(([l, i]) => {
        const open = isOpen('load', i), tgt = l.kind === 'node' ? l.node : l.member, on = l.kind === 'node' ? A.sel.n.includes(l.node) : A.sel.m.includes(l.member);
        let ed = '';
        if (open) ed = l.kind === 'node' ? `<div class="an-lied"><div class="an-row3">${['Fx', 'Fy', 'Fz', 'Mx', 'My', 'Mz'].map(q => cf(q, 'loads', i, q, l[q] || 0, 'n')).join('')}</div></div>`
          : `<div class="an-lied">${grid2(cs2(T('Load', 'ชนิด'), LKIND(), l.kind, 'loads', i, 'kind') + cs2(T('Direction', 'ทิศทาง'), l.kind === 'moment' ? MDIRS() : DIRS(), l.dir || (l.kind === 'moment' ? 'lz' : 'grav'), 'loads', i, 'dir'))}<div class="an-row4">${cf(l.kind === 'udl' ? 'w₁' : l.kind === 'point' ? 'P' : 'M', 'loads', i, l.kind === 'udl' ? 'w1' : l.kind === 'point' ? 'P' : 'M', l.kind === 'udl' ? l.w1 : l.kind === 'point' ? l.P : l.M, 'n')}${l.kind === 'udl' ? cf('w₂', 'loads', i, 'w2', l.w2, 'n') : '<span></span>'}${cf('a (m)', 'loads', i, 'a', l.a, 'n')}${l.kind === 'udl' ? cf('b (m)', 'loads', i, 'b', l.b, 'n') : '<span></span>'}</div></div>`;
        return `<div class="an-li ${open ? 'open' : ''} ${on ? 'on' : ''}"><div class="an-lirow">${liHead('load', i, esc(tgt), desc(l))}${liDel('loads', i)}</div>${ed}</div>`;
      }).join('')}</div>`;
    }
    function comboTable() {
      const m = A.model;
      return `<div class="an-list">${m.combos.map((c, i) => {
        const open = isOpen('combo', c.id), txt = Object.entries(c.f || {}).map(([k, v]) => f(v, 2).replace(/\.?0+$/, '') + k).join(' + ');
        const ed = open ? `<div class="an-lied">${grid2(cf('ID', 'combos', i, 'id', c.id) + cs2(T('Type', 'ชนิด'), [['ULS', 'ULS'], ['SLS', 'SLS']], c.type, 'combos', i, 'type'))}${cf(T('Name', 'ชื่อ'), 'combos', i, 'name', c.name)}<div class="an-row4">${m.cases.map(cs => fld(esc(cs.id) + ' ×', inp((c.f || {})[cs.id] || '', `data-tb="combos" data-i="${i}" data-f="f.${esc(cs.id)}" type="number" step="any"`))).join('')}</div></div>` : '';
        return `<div class="an-li ${open ? 'open' : ''}"><div class="an-lirow">${liHead('combo', c.id, esc(c.id) + ` <span class="pill ${c.type === 'ULS' ? '' : 'free'}">${c.type}</span>`, esc(c.name !== txt ? c.name + ' = ' + txt : txt))}${liDel('combos', i)}</div>${ed}</div>`;
      }).join('')}</div>`;
    }

    // ------------------------------------------------------------------ selection editors
    function nodeEditor() {
      const m = A.model, nd = nodeMap(), nN = A.sel.n.length;
      if (nN === 1) { const n = nd[A.sel.n[0]]; if (!n) return ''; return blk(T('Node', 'จุดต่อ') + ' ' + esc(n.id), `<div class="an-row4">${fld('ID', ins('nid', n.id))}${fld('X (m)', ins('x', n.x, 'n'))}${fld('Y (m)', ins('y', n.y, 'n'))}${fld('Z (m)', ins('z', n.z, 'n'))}</div>${hint(T('Support: ', 'จุดรองรับ: ') + esc((SUP().find(q => q[0] === (n.sup || 'free')) || [])[1] || '') + ' — ' + T('change it in step 5.', 'แก้ไขในขั้นตอนที่ 5'))}`); }
      return blk(nN + ' ' + T('nodes — move by', 'จุดต่อ — เลื่อนไป'), `<div class="an-row4">${fld('ΔX', num('an-mx', 0))}${fld('ΔY', num('an-my', 0))}${fld('ΔZ', num('an-mz', 0))}<span class="an-f"><span>&nbsp;</span><button class="btn btn-ghost xs" data-act="an-move">${T('Move', 'เลื่อน')}</button></span></div>`);
    }
    function memEditor() {
      const m = A.model, nd = nodeMap(), nM = A.sel.m.length;
      if (nM === 1) {
        const q = m.members.find(z => z.id === A.sel.m[0]); if (!q) return '';
        const i0 = nd[q.i], j0 = nd[q.j], L = i0 && j0 ? Math.hypot(...sub(P3(j0), P3(i0))) : 0, s = m.sections.find(z => z.id === q.sec), p = s ? F.secProps(s) : null, no = nodeOpts();
        return blk(T('Element', 'ชิ้นส่วน') + ' ' + esc(q.id) + ` <span class="muted small">L = ${f(L, 3)} m</span>`, `<div class="an-row3">${fld('ID', ins('mid', q.id))}${fld(T('Node i', 'จุด i'), sel(no, q.i, 'data-ins="i"'))}${fld(T('Node j', 'จุด j'), sel(no, q.j, 'data-ins="j"'))}</div>
          <div class="an-row2">${fld(T('Section', 'หน้าตัด'), sel(secOpts(), q.sec, 'data-ins="sec"'))}${fld(T('Material', 'วัสดุ'), sel(matOpts(), q.mat, 'data-ins="mat"'))}</div>
          <div class="an-row2">${fld(T('Type', 'ชนิด'), sel([['frame', T('Frame', 'โครงข้อแข็ง')], ['truss', T('Truss (axial only)', 'โครงถัก (แรงตามแนวแกน)')]], q.type || 'frame', 'data-ins="type"'))}${fld(T('Rotation β (°)', 'มุมหมุน β (°)'), ins('beta', q.beta || 0, 'n'))}</div>
          ${p ? hint(`A = ${f(p.A, 0)} mm² · I<sub>z</sub> = ${f(p.Iz / 1e6, 1)} · I<sub>y</sub> = ${f(p.Iy / 1e6, 1)} · J = ${f(p.J / 1e6, 3)} ×10⁶ mm⁴ · ${T('local axes: x red, y green, z blue', 'แกนเฉพาะที่: x แดง y เขียว z น้ำเงิน')}`) : ''}
          <div class="an-row3">${fld(T('Split into', 'แบ่งเป็น'), `<input id="an-splitn" type="number" min="2" max="20" value="2">`)}<span class="an-f"><span>&nbsp;</span><button class="btn btn-ghost xs" data-act="an-split">${T('Split element', 'แบ่งชิ้นส่วน')}</button></span></div>`);
      }
      const keep = [['', T('— keep —', '— คงเดิม —')]];
      return blk(nM + ' ' + T('elements — assign', 'ชิ้นส่วน — กำหนดค่า'), `<div class="an-row2">${fld(T('Section', 'หน้าตัด'), sel(keep.concat(secOpts()), '', 'data-ins="sec"'))}${fld(T('Material', 'วัสดุ'), sel(keep.concat(matOpts()), '', 'data-ins="mat"'))}</div>
        <div class="an-row2">${fld(T('Type', 'ชนิด'), sel(keep.concat([['frame', T('Frame', 'โครงข้อแข็ง')], ['truss', T('Truss', 'โครงถัก')]]), '', 'data-ins="type"'))}${fld('β (°)', inp('', 'data-ins="beta" type="number" step="any" placeholder="—"'))}</div>`);
    }
    function repBlock() {
      if (!A.sel.n.length && !A.sel.m.length) return '';
      return `<details class="an-blk an-det" ${A.repOpen ? 'open' : ''} id="an-rep"><summary><b>${T('Replicate / extrude the selection', 'คัดลอก / ยืดส่วนที่เลือก')}</b></summary><div class="an-row4">${fld('ΔX', num('an-rx', A.rep ? A.rep[0] : 0))}${fld('ΔY', num('an-ry', A.rep ? A.rep[1] : 0))}${fld('ΔZ', num('an-rz', A.rep ? A.rep[2] : 3.5))}${fld(T('Copies', 'จำนวน'), `<input id="an-rn" type="number" min="1" max="50" value="${A.rep ? A.rep[3] : 1}">`)}</div>
        <label class="chkl"><input type="checkbox" id="an-rc" ${A.rep && A.rep[4] ? 'checked' : ''}> ${T('Connect the selected nodes to their copies (e.g. columns)', 'เชื่อมจุดต่อที่เลือกกับสำเนา (เช่น เสา)')}</label><label class="chkl"><input type="checkbox" id="an-rl" ${!A.rep || A.rep[5] ? 'checked' : ''}> ${T('Copy loads too', 'คัดลอกแรงด้วย')}</label>
        <button class="btn btn-ghost xs" data-act="an-replicate">${T('Replicate', 'คัดลอก')}</button></details>`;
    }

    // ------------------------------------------------------------------ section preview (SVG, local axes: y up, z left, x out of the page)
    function secDims(s) {
      if (s.type === 'rect') return { k: 'rect', b: +s.b, h: +s.h };
      if (s.type === 'circ') return { k: 'circ', D: +s.D };
      if (s.type === 'std') { const p = SL.find(s.series, s.size); return p ? { k: 'I', d: p.d, bf: p.bf, tf: p.tf, tw: p.tw, r: p.r } : null; }
      if (s.type === 'I') return { k: 'I', d: +s.d, bf: +s.bf, tf: +s.tf, tw: +s.tw, r: 0 };
      if (s.type === 'tube') { const q = String(s.size || '').split('x').map(Number); return s.shape === 'CHS' ? { k: 'chs', D: q[0], t: q[1] } : { k: 'box', h: q[0], b: q[1], t: q[2] }; }
      return null;
    }
    function secPoly(id) {
      const s = A.model.sections.find(q => q.id === id); if (!s) return null;
      const gd = secDims(s), R = (b, h) => [[-b / 2, -h / 2], [b / 2, -h / 2], [b / 2, h / 2], [-b / 2, h / 2]], C = D => Array.from({ length: 18 }, (_, i) => [D / 2 * Math.cos(2 * PI * i / 18), D / 2 * Math.sin(2 * PI * i / 18)]);
      if (!gd) { const a = Math.sqrt(Math.max(1, F.secProps(s).A)); return { pts: R(a, a) }; }
      if (gd.k === 'rect') return { pts: R(gd.b, gd.h) };
      if (gd.k === 'box') return { pts: R(gd.b, gd.h), steel: true };
      if (gd.k === 'circ' || gd.k === 'chs') return { pts: C(gd.D), round: true, steel: gd.k === 'chs' };
      const b = gd.bf / 2, d = gd.d / 2, w = gd.tw / 2, t = gd.tf;
      return { pts: [[-b, -d], [b, -d], [b, -d + t], [w, -d + t], [w, d - t], [b, d - t], [b, d], [-b, d], [-b, d - t], [-w, d - t], [-w, -d + t], [-b, -d + t]], steel: true };
    }
    function secSVG(s, W, H) {
      W = W || 220; H = H || 170;
      const g = secDims(s), cx = W / 2 + 8, cy = H / 2 - 4, n = v => (+v).toFixed(1);
      if (!g) { const p = F.secProps(s); return `<svg viewBox="0 0 ${W} ${H}" class="an-secsvg"><rect x="20" y="20" width="${W - 40}" height="${H - 50}" rx="8" class="sp-box"/><text x="${W / 2}" y="${H / 2 - 8}" text-anchor="middle" class="sp-t">A = ${f(p.A, 0)} mm²</text><text x="${W / 2}" y="${H / 2 + 10}" text-anchor="middle" class="sp-t">I<tspan dy="3" font-size="8">z</tspan><tspan dy="-3"> = ${f(p.Iz / 1e6, 1)}×10⁶</tspan></text></svg>`; }
      const bw = g.k === 'rect' || g.k === 'box' ? g.b : g.k === 'I' ? g.bf : g.D, bh = g.k === 'rect' || g.k === 'box' ? g.h : g.k === 'I' ? g.d : g.D;
      const sc = Math.min((W - 80) / bw, (H - 62) / bh), w = bw * sc, h = bh * sc, x0 = cx - w / 2, y0 = cy - h / 2;
      let body = '';
      if (g.k === 'rect') body = `<rect x="${n(x0)}" y="${n(y0)}" width="${n(w)}" height="${n(h)}" class="sp-fill"/>`;
      else if (g.k === 'circ') body = `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(w / 2)}" class="sp-fill"/>`;
      else if (g.k === 'chs') body = `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(w / 2)}" class="sp-fill"/><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(Math.max(1, w / 2 - g.t * sc))}" class="sp-hole"/>`;
      else if (g.k === 'box') { const t = Math.max(1.2, g.t * sc); body = `<rect x="${n(x0)}" y="${n(y0)}" width="${n(w)}" height="${n(h)}" rx="${n(Math.min(2.5 * t, w / 4))}" class="sp-fill"/><rect x="${n(x0 + t)}" y="${n(y0 + t)}" width="${n(w - 2 * t)}" height="${n(h - 2 * t)}" rx="${n(Math.min(1.5 * t, w / 5))}" class="sp-hole"/>`; }
      else { const tf = Math.max(1.5, g.tf * sc), tw = Math.max(1.2, g.tw * sc), r = Math.min(g.r * sc, (w - tw) / 2 - 0.5), xl = cx - tw / 2, xr = cx + tw / 2, yt = y0 + tf, yb = y0 + h - tf;
        body = `<path d="M${n(x0)} ${n(y0)}H${n(x0 + w)}V${n(yt)}H${n(xr + r)}${r > 0.5 ? `Q${n(xr)} ${n(yt)} ${n(xr)} ${n(yt + r)}` : `H${n(xr)}`}V${n(yb - r)}${r > 0.5 ? `Q${n(xr)} ${n(yb)} ${n(xr + r)} ${n(yb)}` : ''}H${n(x0 + w)}V${n(y0 + h)}H${n(x0)}V${n(yb)}H${n(xl - r)}${r > 0.5 ? `Q${n(xl)} ${n(yb)} ${n(xl)} ${n(yb - r)}` : `H${n(xl)}`}V${n(yt + r)}${r > 0.5 ? `Q${n(xl)} ${n(yt)} ${n(xl - r)} ${n(yt)}` : ''}H${n(x0)}Z" class="sp-fill"/>`; }
      const dimB = `<path d="M${n(x0)} ${n(y0 + h + 12)}H${n(x0 + w)}M${n(x0)} ${n(y0 + h + 8)}v8M${n(x0 + w)} ${n(y0 + h + 8)}v8" class="sp-dim"/><text x="${n(cx)}" y="${n(y0 + h + 25)}" text-anchor="middle" class="sp-t">${g.k === 'circ' || g.k === 'chs' ? 'D' : 'b'} = ${f(bw, 0)}</text>`;
      const dimH = g.k === 'circ' || g.k === 'chs' ? '' : `<path d="M${n(x0 - 12)} ${n(y0)}V${n(y0 + h)}M${n(x0 - 16)} ${n(y0)}h8M${n(x0 - 16)} ${n(y0 + h)}h8" class="sp-dim"/><text x="${n(x0 - 18)}" y="${n(cy)}" text-anchor="middle" class="sp-t" transform="rotate(-90 ${n(x0 - 18)} ${n(cy)})">h = ${f(bh, 0)}</text>`;
      const ax = `<path d="M${n(W - 24)} ${n(H - 18)}v-22M${n(W - 24)} ${n(H - 40)}l-3 5h6zM${n(W - 24)} ${n(H - 18)}h-22M${n(W - 46)} ${n(H - 18)}l5 -3v6z" class="sp-ax"/><text x="${n(W - 20)}" y="${n(H - 40)}" class="sp-ax-t">y</text><text x="${n(W - 52)}" y="${n(H - 8)}" class="sp-ax-t">z</text>`;
      return `<svg viewBox="0 0 ${W} ${H}" class="an-secsvg" role="img" aria-label="${T('Section preview', 'ภาพหน้าตัด')}"><path d="M${n(cx - w / 2 - 4)} ${n(cy)}H${n(cx + w / 2 + 4)}M${n(cx)} ${n(cy - h / 2 - 4)}V${n(cy + h / 2 + 4)}" class="sp-cl"/>${body}${dimB}${dimH}${ax}</svg>`;
    }

    // ------------------------------------------------------------------ floating "add" windows (movable)
    const WIN_T = () => ({ mat: T('Add material', 'เพิ่มวัสดุ'), sec: T('Add section', 'เพิ่มหน้าตัด'), node: T('Add node', 'เพิ่มจุดต่อ'), elem: T('Add element', 'เพิ่มชิ้นส่วน'), sup: T('Assign support', 'กำหนดจุดรองรับ'), case: T('Add load case', 'เพิ่มกรณีน้ำหนัก'), load: T('Add load', 'เพิ่มแรง'), combo: T('Add load combination', 'เพิ่มการรวมน้ำหนัก') });
    const WADD = ['mat', 'sec', 'node', 'elem', 'sup', 'case', 'load', 'combo'];
    A.wv = {};
    function wdef(k) {
      const m = A.model, d = stdInfo(m.std);
      if (A.wv[k]) return A.wv[k];
      const v = {
        mat: { kind: 'conc', grade: DEFS[m.std].conc, sgrade: DEFS[m.std].steel, id: '', name: '', E: 200000, nu: 0.3, rho: 78.5 },
        sec: { type: 'rect', b: 300, h: 600, D: 400, series: d.series[0], size: SL.LIB[d.series[0]] ? SL.sizes(d.series[0])[6] || SL.sizes(d.series[0])[0] : '', shape: 'SHS', tsize: '150x150x6', d: 400, bf: 200, tf: 12, tw: 8, A: 10000, Iz: 100e6, Iy: 50e6, J: 20e6, id: '' },
        node: { x: 0, y: 0, z: 0 },
        elem: { i: (m.nodes[0] || {}).id || '', j: (m.nodes[1] || {}).id || '', sec: A.lastSec || (m.sections[0] || {}).id || '', mat: A.lastMat || (m.materials[0] || {}).id || '', type: 'frame', beta: 0 },
        sup: { sup: 'fixed', ids: '' },
        case: { id: '', name: '', type: 'O', sw: false },
        load: { case: A.lcase || (m.cases[0] || {}).id || '', on: A.sel.n.length && !A.sel.m.length ? 'node' : 'elem', ids: '', kind: 'udl', dir: 'grav', w1: 10, w2: '', a: '', b: '', Fx: 0, Fy: 0, Fz: -10, Mx: 0, My: 0, Mz: 0 },
        combo: {}
      }[k];
      A.wv[k] = v; return v;
    }
    const wf = (k, lbl, v, type, attrs) => fld(lbl, inp(v == null ? '' : v, `data-w="${k}" ${type === 'n' ? 'type="number" step="any" inputmode="decimal"' : ''} ${attrs || ''}`));
    const ws = (k, lbl, opts, v) => fld(lbl, sel(opts, v, `data-w="${k}"`));
    function wsecObj(v) {
      return v.type === 'rect' ? { type: 'rect', b: +v.b, h: +v.h } : v.type === 'circ' ? { type: 'circ', D: +v.D } : v.type === 'std' ? { type: 'std', series: v.series, size: v.size } : v.type === 'tube' ? { type: 'tube', shape: v.shape, size: v.tsize } : v.type === 'I' ? { type: 'I', d: +v.d, bf: +v.bf, tf: +v.tf, tw: +v.tw } : { type: 'user', A: +v.A, Iz: +v.Iz, Iy: +v.Iy, J: +v.J };
    }
    function wsecProps(v) { const s = wsecObj(v), p = F.secProps(s); return `<dl class="an-wkv"><div><dt>A</dt><dd>${f(p.A, 0)} mm²</dd></div><div><dt>I<sub>z</sub></dt><dd>${f(p.Iz / 1e6, 2)} ×10⁶ mm⁴</dd></div><div><dt>I<sub>y</sub></dt><dd>${f(p.Iy / 1e6, 2)} ×10⁶ mm⁴</dd></div><div><dt>J</dt><dd>${f(p.J / 1e6, 3)} ×10⁶ mm⁴</dd></div>${s.type === 'std' || s.type === 'tube' ? `<div><dt>${T('Mass', 'มวล')}</dt><dd>${f(p.A * 7850e-6, 1)} kg/m</dd></div>` : ''}</dl>`; }
    function winBody(k) {
      const m = A.model, d = stdInfo(m.std), v = wdef(k), add = (lbl, extra) => `<div class="an-wfoot">${extra || ''}<span class="grow"></span><button class="btn btn-ghost sm" data-act="an-wclose">${T('Close', 'ปิด')}</button><button class="btn btn-hot sm" data-act="an-wadd">${lbl || T('Add', 'เพิ่ม')}</button></div>`;
      if (k === 'mat') {
        const g = v.kind === 'conc' ? concMat(m.std, v.grade) : v.kind === 'steel' ? steelMat(m.std, v.sgrade) : null;
        return `<div class="seg an-wseg">${[['conc', T('Concrete', 'คอนกรีต')], ['steel', T('Steel', 'เหล็ก')], ['custom', T('Custom', 'กำหนดเอง')]].map(([q, l]) => `<button data-act="an-wset" data-f="kind" data-v="${q}" aria-pressed="${v.kind === q}">${l}</button>`).join('')}</div>` +
          (v.kind === 'conc' ? ws('grade', T('Concrete grade — ', 'ชั้นคอนกรีต — ') + esc(d.codes.split(' · ')[0]), d.conc.map(q => [q[0], q[1]]), v.grade) : v.kind === 'steel' ? ws('sgrade', T('Steel grade', 'ชั้นเหล็ก'), d.steel.map(q => [q[0], q[1] + ' · fy ' + q[2]]), v.sgrade)
            : `<div class="an-row2">${wf('id', 'ID', v.id)}${wf('name', T('Name', 'ชื่อ'), v.name)}</div><div class="an-row3">${wf('E', 'E (MPa)', v.E, 'n')}${wf('nu', 'ν', v.nu, 'n')}${wf('rho', 'γ (kN/m³)', v.rho, 'n')}</div>`) +
          (g ? `<dl class="an-wkv"><div><dt>E</dt><dd>${f(g.E, 0)} MPa</dd></div><div><dt>ν</dt><dd>${g.nu}</dd></div><div><dt>γ</dt><dd>${g.rho} kN/m³</dd></div><div><dt>${g.fc ? "f'c" : 'f<sub>y</sub>'}</dt><dd>${f(g.fc || g.fy, g.fc ? 1 : 0)} MPa</dd></div></dl>` : '') + add();
      }
      if (k === 'sec') {
        const ser = d.series, tubes = ['CHS', 'SHS', 'RHS'];
        let form = '';
        if (v.type === 'rect') form = `<div class="an-row2">${wf('b', 'b (mm)', v.b, 'n')}${wf('h', 'h (mm)', v.h, 'n')}</div>`;
        else if (v.type === 'circ') form = wf('D', 'D (mm)', v.D, 'n');
        else if (v.type === 'std') { const sr = ser.filter(q => SL.LIB[q]).includes(v.series) ? v.series : ser.filter(q => SL.LIB[q])[0]; form = `<div class="an-row2">${ws('series', T('Series', 'ชุด'), ser.filter(q => SL.LIB[q]).map(q => [q, SL.SERIES[q] || q]), sr)}${ws('size', T('Size', 'ขนาด'), SL.sizes(sr).map(z => [z, z]), v.size)}</div>`; }
        else if (v.type === 'tube') form = `<div class="an-row2">${ws('shape', T('Shape', 'รูปตัด'), tubes.map(q => [q, q]), v.shape)}${ws('tsize', T('Size', 'ขนาด'), (G.GANTRY ? G.GANTRY.sizeOptions(v.shape) : []).map(o => [o[0], o[1]]), v.tsize)}</div>`;
        else if (v.type === 'I') form = `<div class="an-row4">${wf('d', 'd', v.d, 'n')}${wf('bf', 'b<sub>f</sub>', v.bf, 'n')}${wf('tf', 't<sub>f</sub>', v.tf, 'n')}${wf('tw', 't<sub>w</sub>', v.tw, 'n')}</div>`;
        else form = `<div class="an-row2">${wf('A', 'A (mm²)', v.A, 'n')}${wf('Iz', 'I<sub>z</sub> (mm⁴)', v.Iz, 'n')}${wf('Iy', 'I<sub>y</sub> (mm⁴)', v.Iy, 'n')}${wf('J', 'J (mm⁴)', v.J, 'n')}</div>`;
        return `<div class="an-wsec"><div class="an-wsecl">${ws('type', T('Section type', 'ชนิดหน้าตัด'), SECT(), v.type)}${form}${wf('id', T('ID (blank = automatic)', 'ID (ว่าง = อัตโนมัติ)'), v.id)}</div><div class="an-wprev" id="anWPrev">${secSVG(wsecObj(v))}${wsecProps(v)}</div></div>` + add(T('Add section', 'เพิ่มหน้าตัด'));
      }
      if (k === 'node') return `<div class="an-row3">${wf('x', 'X (m)', v.x, 'n')}${wf('y', 'Y (m)', v.y, 'n')}${wf('z', 'Z (m)', v.z, 'n')}</div>` + hint(T('The window stays open — change the coordinates and add the next node.', 'หน้าต่างยังเปิดอยู่ — แก้พิกัดแล้วเพิ่มจุดต่อถัดไปได้')) + add(T('Add node', 'เพิ่มจุดต่อ'));
      if (k === 'elem') { const no = nodeOpts(); return `<div class="an-row2">${ws('i', T('Node i', 'จุด i'), no, v.i)}${ws('j', T('Node j', 'จุด j'), no, v.j)}</div><div class="an-row2">${ws('sec', T('Section', 'หน้าตัด'), secOpts(), v.sec)}${ws('mat', T('Material', 'วัสดุ'), matOpts(), v.mat)}</div><div class="an-row2">${ws('type', T('Type', 'ชนิด'), [['frame', T('Frame', 'โครงข้อแข็ง')], ['truss', T('Truss', 'โครงถัก')]], v.type)}${wf('beta', 'β (°)', v.beta, 'n')}</div>` + add(T('Add element', 'เพิ่มชิ้นส่วน')); }
      if (k === 'sup') return ws('sup', T('Support', 'จุดรองรับ'), SUP().filter(q => q[0] !== 'custom'), v.sup) + wf('ids', T('Node IDs, comma separated (blank = selected nodes: ', 'ID จุดต่อ คั่นด้วยจุลภาค (ว่าง = จุดที่เลือก: ') + A.sel.n.length + ')', v.ids, '', 'placeholder="N1, N2"') + hint(T('Tip: you can also drag a support type from step 5 onto a node in the view.', 'เคล็ดลับ: ลากชนิดจุดรองรับจากขั้นที่ 5 ไปวางบนจุดต่อในมุมมองได้')) + add(T('Apply', 'กำหนด'));
      if (k === 'case') return `<div class="an-row2">${wf('id', T('Name (ID)', 'ชื่อ (ID)'), v.id, '', 'placeholder="' + nextId(m.cases, 'L') + '"')}${ws('type', T('Type', 'ประเภท'), CTYPES(), v.type)}</div>${wf('name', T('Description', 'คำอธิบาย'), v.name)}<label class="chkl"><input type="checkbox" data-w="sw" ${v.sw ? 'checked' : ''}> ${T('Include self-weight', 'รวมน้ำหนักตัวเอง')}</label>` + add(T('Add load case', 'เพิ่มกรณีน้ำหนัก'));
      if (k === 'load') {
        const isN = v.on === 'node', cnt = isN ? A.sel.n.length : A.sel.m.length;
        return `<div class="an-row2">${ws('case', T('Load case', 'กรณีน้ำหนัก'), caseOpts(), v.case)}${ws('on', T('Apply to', 'ใส่ที่'), [['elem', T('Elements', 'ชิ้นส่วน')], ['node', T('Nodes', 'จุดต่อ')]], v.on)}</div>` + wf('ids', (isN ? T('Node IDs', 'ID จุดต่อ') : T('Element IDs', 'ID ชิ้นส่วน')) + T(' (blank = selected: ', ' (ว่าง = ที่เลือก: ') + cnt + ')', v.ids, '', 'placeholder="' + (isN ? 'N1, N2' : 'M1, M2') + '"') +
          (isN ? `<div class="an-row3">${['Fx', 'Fy', 'Fz', 'Mx', 'My', 'Mz'].map(q => wf(q, q + (q[0] === 'F' ? ' (kN)' : ' (kNm)'), v[q], 'n')).join('')}</div>`
            : `<div class="an-row2">${ws('kind', T('Load', 'ชนิด'), LKIND(), v.kind)}${ws('dir', T('Direction', 'ทิศทาง'), v.kind === 'moment' ? MDIRS() : DIRS(), v.kind === 'moment' && !MDIRS().some(q => q[0] === v.dir) ? 'lz' : v.dir)}</div><div class="an-row4">${wf('w1', v.kind === 'udl' ? 'w₁ (kN/m)' : v.kind === 'point' ? 'P (kN)' : 'M (kNm)', v.w1, 'n')}${v.kind === 'udl' ? wf('w2', 'w₂', v.w2, 'n') : '<span></span>'}${wf('a', 'a (m)', v.a, 'n')}${v.kind === 'udl' ? wf('b', 'b (m)', v.b, 'n') : '<span></span>'}</div>`) + add(T('Add load', 'เพิ่มแรง'));
      }
      if (k === 'combo') {
        const cb = A.cb || (A.cb = { name: '', type: 'ULS', rows: m.cases.slice(0, 2).map((c, i) => ({ c: c.id, f: i ? 1.5 : 1.2 })) });
        const auto = cb.rows.filter(r => r.c && +r.f).map(r => f(+r.f, 2).replace(/\.?0+$/, '') + r.c).join(' + ');
        return `<div class="an-cbrows">${cb.rows.map((r, i) => `<div class="an-cbrow">${sel(m.cases.map(c => [c.id, c.id + ' — ' + c.name]), r.c, `data-cb="c" data-i="${i}"`)}<span>×</span>${inp(r.f, `data-cb="f" data-i="${i}" type="number" step="any"`, 70)}<button class="icon-btn" data-act="an-cbdel" data-i="${i}" aria-label="${T('Remove', 'ลบ')}">×</button></div>`).join('')}</div>
          <button class="linkbtn" data-act="an-cbadd">+ ${T('Add a load case', 'เพิ่มกรณีน้ำหนัก')}</button>
          <div class="an-row2">${fld(T('Name', 'ชื่อ'), inp(cb.name, `data-cb="name" placeholder="${esc(auto)}"`))}${fld(T('Type', 'ชนิด'), sel([['ULS', 'ULS'], ['SLS', 'SLS']], cb.type, 'data-cb="type"'))}</div><p class="an-cbprev mono">${esc(auto || '—')}</p>` +
          `<div class="an-wfoot"><span class="grow"></span><button class="btn btn-ghost sm" data-act="an-wclose">${T('Close', 'ปิด')}</button><button class="btn btn-hot sm" data-act="an-cbgo">${T('Add combination', 'เพิ่มการรวมน้ำหนัก')}</button></div>`;
      }
      return '';
    }
    function winRefresh() {
      const host = $('#anWinHost'); if (!host) return;
      if (!A.win) { host.innerHTML = ''; return; }
      const k = A.win.k;
      host.innerHTML = `<div class="an-win" id="anWin" role="dialog" aria-label="${esc(WIN_T()[k])}" style="left:${A.win.x}px;top:${A.win.y}px"><div class="an-winhead" title="${T('Drag to move', 'ลากเพื่อย้าย')}"><span class="an-grip" aria-hidden="true">⋮⋮</span><b>${esc(WIN_T()[k])}</b><span class="grow"></span><button class="icon-btn" data-act="an-wclose" aria-label="${T('Close', 'ปิด')}">×</button></div><div class="an-winbody">${winBody(k)}</div></div>`;
      const w = host.firstChild, hd = w.querySelector('.an-winhead');
      hd.addEventListener('pointerdown', e => {
        if (e.target.closest('button')) return;
        const r = w.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top; hd.setPointerCapture(e.pointerId);
        const mv = ev => { A.win.x = Math.max(0, Math.min(innerWidth - 80, ev.clientX - ox)); A.win.y = Math.max(0, Math.min(innerHeight - 40, ev.clientY - oy)); w.style.left = A.win.x + 'px'; w.style.top = A.win.y + 'px'; };
        const upf = () => { hd.removeEventListener('pointermove', mv); hd.removeEventListener('pointerup', upf); hd.removeEventListener('pointercancel', upf); };
        hd.addEventListener('pointermove', mv); hd.addEventListener('pointerup', upf); hd.addEventListener('pointercancel', upf);
      });
    }
    function openWin(k) { const W0 = Math.min(440, innerWidth - 20); A.win = { k, x: A.win ? A.win.x : Math.max(10, Math.min(innerWidth - W0 - 10, 400)), y: A.win ? A.win.y : 90 }; if (k === 'load') { delete A.wv.load; } winRefresh(); }
    const idList = s0 => String(s0 || '').split(/[,\s]+/).map(q => q.trim()).filter(Boolean);
    function winAdd() {
      const k = A.win.k, v = wdef(k), m = A.model;
      if (k === 'mat') {
        const g = v.kind === 'conc' ? concMat(m.std, v.grade) : v.kind === 'steel' ? steelMat(m.std, v.sgrade) : { id: (v.id || '').trim() || nextId(m.materials, 'MAT'), name: v.name || '', kind: 'other', E: +v.E || 200000, nu: +v.nu || 0.3, rho: +v.rho || 0 };
        if (m.materials.some(q => q.id === g.id)) { toast(T(g.id + ' is already in the list.', g.id + ' มีอยู่แล้ว'), ''); return; }
        snap(true); m.materials.push(g); A.lastMat = g.id; changed(true); toast(T('Added material ', 'เพิ่มวัสดุ ') + g.id, 'ok');
      } else if (k === 'sec') {
        const s0 = wsecObj(v), auto = { rect: 'R' + v.b + 'x' + v.h, circ: 'D' + v.D, std: String(v.size).replace(/\s+/g, ''), tube: v.shape + ' ' + v.tsize, I: 'I' + v.d + 'x' + v.bf, user: nextId(m.sections, 'S') }[v.type];
        s0.id = (v.id || '').trim() || auto; s0.name = v.type === 'std' ? v.size : v.type === 'tube' ? v.shape + ' ' + String(v.tsize).replace(/x/g, '×') : v.type === 'rect' ? v.b + '×' + v.h : v.type === 'circ' ? 'Ø' + v.D : '';
        if (m.sections.some(q => q.id === s0.id)) { toast(T(s0.id + ' is already in the list.', s0.id + ' มีอยู่แล้ว'), ''); return; }
        snap(true); m.sections.push(s0); A.lastSec = s0.id; changed(true); toast(T('Added section ', 'เพิ่มหน้าตัด ') + s0.id, 'ok');
      } else if (k === 'node') { snap(true); const id = ensureNode([+v.x || 0, +v.y || 0, +v.z || 0]); A.sel = { n: [id], m: [] }; changed(true); redraw(true); toast(T('Node ', 'จุดต่อ ') + id, 'ok'); }
      else if (k === 'elem') { if (!v.i || !v.j || v.i === v.j) { toast(T('Choose two different nodes.', 'เลือกจุดต่อสองจุดที่ต่างกัน'), 'bad'); return; } snap(true); const id = addMember(v.i, v.j, { sec: v.sec, mat: v.mat, type: v.type, beta: +v.beta || 0 }); if (!id) { toast(T('That element already exists.', 'มีชิ้นส่วนนี้แล้ว'), 'bad'); return; } A.sel = { n: [], m: [id] }; changed(true); toast(T('Element ', 'ชิ้นส่วน ') + id, 'ok'); }
      else if (k === 'sup') { const ids = idList(v.ids).length ? idList(v.ids) : A.sel.n, ns = ids.map(id => m.nodes.find(q => q.id === id)).filter(Boolean); if (!ns.length) { toast(T('Select nodes or type their IDs.', 'เลือกจุดต่อหรือพิมพ์ ID'), 'bad'); return; } snap(true); ns.forEach(n => { n.sup = v.sup; }); changed(true); toast(T('Support set on ' + ns.length + ' node(s)', 'กำหนดจุดรองรับ ' + ns.length + ' จุด'), 'ok'); }
      else if (k === 'case') { const id = (v.id || '').trim() || nextId(m.cases, 'L'); if (m.cases.some(c => c.id === id)) { toast(T(id + ' already exists.', id + ' มีอยู่แล้ว'), 'bad'); return; } snap(true); m.cases.push({ id, name: v.name || id, type: v.type, sw: !!v.sw }); A.lcase = id; A.wv.case = null; changed(true); toast(T('Load case ', 'กรณีน้ำหนัก ') + id, 'ok'); }
      else if (k === 'load') {
        const isN = v.on === 'node', ids = idList(v.ids).length ? idList(v.ids) : isN ? A.sel.n : A.sel.m, ok = ids.filter(id => (isN ? m.nodes : m.members).some(q => q.id === id));
        if (!ok.length) { toast(T('Select ' + (isN ? 'nodes' : 'elements') + ' or type their IDs.', 'เลือก' + (isN ? 'จุดต่อ' : 'ชิ้นส่วน') + 'หรือพิมพ์ ID'), 'bad'); return; }
        snap(true);
        ok.forEach(id => { if (isN) m.loads.push(nload(v.case, id, { Fx: +v.Fx || 0, Fy: +v.Fy || 0, Fz: +v.Fz || 0, Mx: +v.Mx || 0, My: +v.My || 0, Mz: +v.Mz || 0 })); else if (v.kind === 'udl') m.loads.push({ case: v.case, kind: 'udl', member: id, dir: v.dir, w1: +v.w1 || 0, w2: v.w2 === '' ? '' : +v.w2, a: v.a === '' ? '' : +v.a, b: v.b === '' ? '' : +v.b }); else m.loads.push(Object.assign({ case: v.case, member: id, a: v.a === '' ? 0 : +v.a }, v.kind === 'point' ? { kind: 'point', dir: v.dir, P: +v.w1 || 0 } : { kind: 'moment', dir: MDIRS().some(q => q[0] === v.dir) ? v.dir : 'lz', M: +v.w1 || 0 })); });
        A.lcase = v.case; changed(true); toast(T('Load added to ' + ok.length + ' item(s) in ' + v.case, 'เพิ่มแรง ' + ok.length + ' รายการ ในกรณี ' + v.case), 'ok');
      }
      winRefresh();
    }

    // ------------------------------------------------------------------ drag a property from the tree onto the model
    function dropApply(val, hit) {
      const m = A.model, i = val.indexOf(':'), k = val.slice(0, i), id = val.slice(i + 1);
      if (k === 'sec' || k === 'mat' || k === 'rel') {
        if (!hit || hit.k !== 'm') { toast(T('Drop it onto an element.', 'วางบนชิ้นส่วน'), ''); return; }
        const ids = A.sel.m.includes(hit.id) ? A.sel.m : [hit.id], mems = ids.map(q => m.members.find(z => z.id === q)).filter(Boolean);
        snap(true);
        mems.forEach(q => { if (k === 'sec') q.sec = id; else if (k === 'mat') q.mat = id; else if (id === 'truss') q.type = 'truss'; else { q.type = 'frame'; q.relI = id === 'i' || id === 'both'; q.relJ = id === 'j' || id === 'both'; } });
        A.sel = { n: [], m: ids }; changed(true);
        toast((k === 'sec' ? T('Section ', 'หน้าตัด ') : k === 'mat' ? T('Material ', 'วัสดุ ') : T('End release ', 'การปลดแรงปลาย ')) + id + T(' → ' + mems.length + ' element(s)', ' → ' + mems.length + ' ชิ้นส่วน'), 'ok');
      } else if (k === 'sup') {
        if (!hit || hit.k !== 'n') { toast(T('Drop it onto a node.', 'วางบนจุดต่อ'), ''); return; }
        const ids = A.sel.n.includes(hit.id) ? A.sel.n : [hit.id]; snap(true);
        ids.forEach(q => { const n = m.nodes.find(z => z.id === q); if (n) n.sup = id; }); A.sel = { n: ids, m: [] }; changed(true);
        toast(T('Support ', 'จุดรองรับ ') + id + T(' → ' + ids.length + ' node(s)', ' → ' + ids.length + ' จุด'), 'ok');
      }
    }
    const DRAG_SUPS = () => [['fixed', T('Fixed', 'ยึดแน่น')], ['pin', T('Pinned', 'หมุด')], ['roller', T('Roller Z', 'ล้อเลื่อน Z')], ['rollerX', T('Roller, X free', 'ล้อเลื่อน X')], ['rollerY', T('Roller, Y free', 'ล้อเลื่อน Y')], ['free', T('Free', 'อิสระ')]];
    const DRAG_RELS = () => [['none', T('Rigid', 'ยึดแน่น')], ['i', T('Pin at i', 'หมุดที่ i')], ['j', T('Pin at j', 'หมุดที่ j')], ['both', T('Pin both ends', 'หมุดสองปลาย')], ['truss', T('Truss', 'โครงถัก')]];
    const chips = (k, list) => `<div class="an-chips2">${list.map(([v, l]) => `<span class="an-chip" draggable="true" data-dnd="${k}:${esc(v)}" title="${T('Drag onto the model', 'ลากไปวางบนแบบจำลอง')}">⠿ ${l}</span>`).join('')}</div>`;

    // ------------------------------------------------------------------ model tree (left): steps 0–10
    const STEPS = () => {
      const m = A.model, nSup = m.nodes.filter(n => F.fixOf(n).some(Boolean)).length;
      return [
        ['std', T('Design standard', 'มาตรฐานการออกแบบ'), m.std],
        ['mat', T('Material properties', 'คุณสมบัติวัสดุ'), m.materials.length],
        ['sec', T('Section properties', 'คุณสมบัติหน้าตัด'), m.sections.length],
        ['node', T('Nodes', 'จุดต่อ'), m.nodes.length],
        ['elem', T('Elements', 'ชิ้นส่วน'), m.members.length],
        ['sup', T('Supports & end releases', 'จุดรองรับและการปลดแรงปลาย'), nSup],
        ['case', T('Load cases', 'กรณีน้ำหนัก'), m.cases.length],
        ['load', T('Apply loads', 'ใส่แรงกระทำ'), m.loads.length],
        ['combo', T('Load combinations', 'การรวมน้ำหนัก'), m.combos.length],
        ['run', T('Run analysis', 'วิเคราะห์โครงสร้าง'), fresh() ? '✓' : A.err && A.resVer === A.ver ? '!' : '—'],
        ['res', T('Results', 'ผลการวิเคราะห์'), fresh() ? '✓' : '—']
      ];
    };
    function treeHTML() {
      return `<nav class="an-tree" aria-label="${T('Main menu', 'เมนูหลัก')}"><div class="an-treehead">${T('MAIN MENU', 'เมนูหลัก')}</div>${STEPS().map(([k, l, c], i) => { const open = A.step === k, st = k === 'run' || k === 'res' ? (fresh() ? 'ok' : A.err && A.resVer === A.ver && k === 'run' ? 'bad' : '') : ''; return `<div class="an-node ${open ? 'open' : ''}"><div class="an-throw"><button class="an-th" data-act="an-step" data-s="${k}" aria-expanded="${open}"><span class="an-num">${i}</span><span class="an-tl">${l}</span><span class="an-cnt ${st}" data-s="${k}">${esc(String(c))}</span><span class="an-chev" aria-hidden="true">›</span></button>${WADD.includes(k) ? `<button class="an-plus" data-act="an-win" data-k="${k}" title="${esc(WIN_T()[k])}" aria-label="${esc(WIN_T()[k])}">+</button>` : '<span class="an-plus0"></span>'}</div>${open ? `<div class="an-panel">${panel(k)}</div>` : ''}</div>`; }).join('')}</nav>`;
    }
    function updCounts() { STEPS().forEach(([k, , c]) => { const e = document.querySelector('.an-cnt[data-s="' + k + '"]'); if (e) { e.textContent = String(c); e.classList.toggle('ok', (k === 'run' || k === 'res') && fresh()); } }); }
    function sideRefresh() { const s = $('#anSide'); if (!s) return; const sc = s.scrollTop; s.innerHTML = treeHTML(); s.scrollTop = sc; }
    function panel(k) {
      const m = A.model, d = stdInfo(m.std);
      if (k === 'std') return hint(T('Choose the design standard first. It sets the concrete and steel grades (step 1), the steel section tables (step 2) and the load combination rules (step 8).', 'เลือกมาตรฐานก่อน มาตรฐานจะกำหนดชั้นคุณภาพคอนกรีตและเหล็ก (ขั้นที่ 1) ตารางหน้าตัดเหล็ก (ขั้นที่ 2) และกฎการรวมน้ำหนัก (ขั้นที่ 8)')) +
        `<div class="an-stds">${STDS.map(q => { const v = stdInfo(q); return `<button class="an-std ${m.std === q ? 'on' : ''}" data-act="an-std" data-k="${q}" aria-pressed="${m.std === q}"><b>${T(v.name[0], v.name[1])}</b><span class="mono">${esc(v.codes)}</span><small>${T('Concrete', 'คอนกรีต')} ${esc(v.conc[0][0])}–${esc(v.conc[v.conc.length - 1][0])} · ${T('steel', 'เหล็ก')} ${v.steel.map(s => esc(s[0])).join(', ')} · ${v.series.join(', ')}</small></button>`; }).join('')}</div>` +
        hint(T('Units: kN, m, kNm (sections in mm, E in MPa). Global axes: X, Y horizontal, Z up.', 'หน่วย: kN, m, kNm (หน้าตัดเป็น มม., E เป็น MPa) แกนหลัก: X, Y แนวราบ, Z ชี้ขึ้น')) +
        `<div class="an-adds"><button class="btn btn-ghost xs" data-act="an-tplopen">${T('Start from a template…', 'เริ่มจากแม่แบบ…')}</button><button class="btn btn-ghost xs" data-act="an-gen" data-code="${d.combo}">${T('Use this standard’s load combinations', 'ใช้การรวมน้ำหนักตามมาตรฐานนี้')}</button><button class="btn btn-hot xs" data-act="an-step" data-s="mat">${T('Next: materials →', 'ถัดไป: วัสดุ →')}</button></div>`;
      if (k === 'mat') return hint(T('Drag a material onto an element in the view to assign it (onto a selected element: all selected).', 'ลากวัสดุไปวางบนชิ้นส่วนในมุมมองเพื่อกำหนด (วางบนชิ้นที่เลือก: กำหนดให้ทุกชิ้นที่เลือก)')) + matTable() +
        `<div class="an-adds"><button class="btn btn-ghost xs" data-act="an-win" data-k="mat">+ ${T('Add material…', 'เพิ่มวัสดุ…')}</button></div>` +
        hint(T('E for concrete follows the standard (AS 3600 Table 3.1.2, EN 1992-1-1 Table 3.1, EIT/ACI 15 100√f\'c). Unit weight γ is used for self-weight and mass.', 'ค่า E ของคอนกรีตตามมาตรฐาน (AS 3600 ตาราง 3.1.2, EN 1992-1-1 ตาราง 3.1, วสท./ACI 15,100√f\'c) หน่วยน้ำหนัก γ ใช้คำนวณน้ำหนักตัวเองและมวล'));
      if (k === 'sec') return hint(T('Drag a section onto an element in the view to assign it (onto a selected element: all selected).', 'ลากหน้าตัดไปวางบนชิ้นส่วนในมุมมองเพื่อกำหนด (วางบนชิ้นที่เลือก: กำหนดให้ทุกชิ้นที่เลือก)')) + secTable() +
        `<div class="an-adds"><button class="btn btn-ghost xs" data-act="an-win" data-k="sec">+ ${T('Add section…', 'เพิ่มหน้าตัด…')}</button></div>` +
        hint(T('Depth h (d, D) lies along the element local y axis, so I_z is the major axis. Rotate an element with β (step 4). Steel tables: ', 'ความลึก h (d, D) อยู่ตามแกน y เฉพาะที่ของชิ้นส่วน I_z จึงเป็นแกนหลัก หมุนชิ้นส่วนด้วย β (ขั้นที่ 4) ตารางเหล็ก: ') + ({ AS: 'AS/NZS 3679.1, AS/NZS 1163', EC: 'EN 10365, EN 10219', TH: 'TIS 1227 / JIS G 3192, AS/NZS 1163 sizes' })[m.std]);
      if (k === 'node') return hint(T('Pick the Node tool and click grid points in Plan or an Elevation (they snap to the grid), or type coordinates below. Click nodes in the view to select and edit them.', 'เลือกเครื่องมือจุดต่อแล้วคลิกตำแหน่งในแปลนหรือรูปด้าน (สแนปตามกริด) หรือพิมพ์พิกัดด้านล่าง คลิกจุดต่อในมุมมองเพื่อเลือกและแก้ไข')) +
        `<div class="an-adds"><button class="btn ${A.tool === 'node' ? 'btn-hot' : 'btn-ghost'} xs" data-act="an-tool" data-t="node">${T('Node tool', 'เครื่องมือจุดต่อ')}</button><button class="btn btn-ghost xs" data-act="an-cam" data-v="plan">${T('Plan view', 'มุมมองแปลน')}</button><label class="an-inl">${T('Snap', 'สแนป')} <input type="number" step="any" min="0" data-opt="snap" value="${A.opt.snap}"> m</label></div>` +
        blk(T('Add a node', 'เพิ่มจุดต่อ'), `<div class="an-row4">${fld('X', num('an-nx', 0))}${fld('Y', num('an-ny', 0))}${fld('Z', num('an-nz', 0))}<span class="an-f"><span>&nbsp;</span><button class="btn btn-ghost xs" data-act="an-addnode">+ ${T('Add', 'เพิ่ม')}</button></span></div>`) +
        selCount() + (A.sel.n.length ? nodeEditor() : '') + repBlock() +
        `<details class="an-blk an-det" ${m.nodes.length <= 40 ? 'open' : ''}><summary><b>${T('All nodes', 'จุดต่อทั้งหมด')} (${m.nodes.length})</b></summary>${nodeTable()}</details>`;
      if (k === 'elem') return hint(T('Set the properties for new elements, pick the Element tool and click node to node (Esc to finish). Click elements in the view to change their properties.', 'กำหนดคุณสมบัติของชิ้นส่วนใหม่ เลือกเครื่องมือชิ้นส่วนแล้วคลิกจากจุดต่อไปยังจุดต่อ (Esc เพื่อจบ) คลิกชิ้นส่วนในมุมมองเพื่อแก้ไขคุณสมบัติ')) +
        blk(T('New elements', 'ชิ้นส่วนใหม่'), `<div class="an-row3">${fld(T('Section', 'หน้าตัด'), sel(secOpts(), A.lastSec || (m.sections[0] || {}).id, 'data-def="sec"'))}${fld(T('Material', 'วัสดุ'), sel(matOpts(), A.lastMat || (m.materials[0] || {}).id, 'data-def="mat"'))}${fld(T('Type', 'ชนิด'), sel([['frame', T('Frame', 'โครงข้อแข็ง')], ['truss', T('Truss', 'โครงถัก')]], A.lastType || 'frame', 'data-def="type"'))}</div><div class="an-adds"><button class="btn ${A.tool === 'member' ? 'btn-hot' : 'btn-ghost'} xs" data-act="an-tool" data-t="member">${T('Draw elements', 'วาดชิ้นส่วน')}</button></div>`) +
        selCount() + (A.sel.m.length ? memEditor() : '') + repBlock() +
        `<details class="an-blk an-det" ${m.members.length <= 30 ? 'open' : ''}><summary><b>${T('All elements', 'ชิ้นส่วนทั้งหมด')} (${m.members.length})</b></summary>${memTable()}</details>`;
      if (k === 'sup') {
        const nd = nodeMap(), nodes = A.sel.n.map(id => nd[id]).filter(Boolean), mems = A.sel.m.map(id => m.members.find(q => q.id === id)).filter(Boolean);
        let ed = '';
        if (nodes.length) { const n = nodes[0], fx6 = F.fixOf(n), one = nodes.length === 1; ed += blk(T('Support of ', 'จุดรองรับของ ') + (one ? T('node ', 'จุดต่อ ') + esc(n.id) : nodes.length + ' ' + T('nodes', 'จุดต่อ')), `${fld(T('Support', 'จุดรองรับ'), sel((one ? [] : [['', T('— keep —', '— คงเดิม —')]]).concat(SUP()), one ? n.sup || 'free' : '', 'data-ins="sup"'))}
          ${one && n.sup === 'custom' ? `<div class="an-fix">${['Ux', 'Uy', 'Uz', 'Rx', 'Ry', 'Rz'].map((lb, dd) => `<label class="chkl"><input type="checkbox" data-ins="fix${dd}" ${fx6[dd] ? 'checked' : ''}> ${lb}</label>`).join('')}</div>` : ''}
          ${one ? `<details class="an-det"><summary>${T('Springs (kN/m, kNm/rad)', 'สปริง (kN/m, kNm/rad)')}</summary><div class="an-row3">${['kx', 'ky', 'kz', 'krx', 'kry', 'krz'].map(q => fld(q, ins(q, n[q] || '', 'n'))).join('')}</div></details>` : ''}`); }
        if (mems.length) { const q = mems[0], one = mems.length === 1; ed += blk(T('End releases of ', 'การปลดแรงปลายของ ') + (one ? T('element ', 'ชิ้นส่วน ') + esc(q.id) : mems.length + ' ' + T('elements', 'ชิ้นส่วน')), one ? `<div class="an-chk"><label class="chkl"><input type="checkbox" data-ins="relI" ${q.relI ? 'checked' : ''} ${q.type === 'truss' ? 'disabled' : ''}> ${T('Pin (moment release) at end i', 'หมุด (ปลดโมเมนต์) ที่ปลาย i')} — ${esc(q.i)}</label></div><div class="an-chk"><label class="chkl"><input type="checkbox" data-ins="relJ" ${q.relJ ? 'checked' : ''} ${q.type === 'truss' ? 'disabled' : ''}> ${T('Pin (moment release) at end j', 'หมุด (ปลดโมเมนต์) ที่ปลาย j')} — ${esc(q.j)}</label></div>${fld(T('Element type', 'ชนิดชิ้นส่วน'), sel([['frame', T('Frame', 'โครงข้อแข็ง')], ['truss', T('Truss — both ends pinned, axial force only', 'โครงถัก — หมุดทั้งสองปลาย รับแรงตามแนวแกน')]], q.type || 'frame', 'data-ins="type"'))}`
          : `<div class="an-row2">${fld(T('Moment releases', 'การปลดโมเมนต์'), sel([['', T('— keep —', '— คงเดิม —')], ['none', T('None (rigid)', 'ไม่มี (ยึดแน่น)')], ['i', T('End i', 'ปลาย i')], ['j', T('End j', 'ปลาย j')], ['both', T('Both ends', 'ทั้งสองปลาย')]], '', 'data-ins="hinge"'))}${fld(T('Type', 'ชนิด'), sel([['', T('— keep —', '— คงเดิม —')], ['frame', T('Frame', 'โครงข้อแข็ง')], ['truss', T('Truss', 'โครงถัก')]], '', 'data-ins="type"'))}</div>`); }
        const supN = m.nodes.filter(n => F.fixOf(n).some(Boolean)), relM = m.members.filter(q => q.relI || q.relJ || q.type === 'truss');
        return hint(T('Select nodes in the view (click, or drag a box) to set their support. Select elements to release their end moments (pins) or make them truss members.', 'เลือกจุดต่อในมุมมอง (คลิก หรือลากกรอบ) เพื่อกำหนดจุดรองรับ เลือกชิ้นส่วนเพื่อปลดโมเมนต์ที่ปลาย (หมุด) หรือกำหนดเป็นโครงถัก')) +
          `<h4>${T('Drag onto a node', 'ลากไปวางบนจุดต่อ')}</h4>` + chips('sup', DRAG_SUPS()) + `<h4>${T('Drag onto an element', 'ลากไปวางบนชิ้นส่วน')}</h4>` + chips('rel', DRAG_RELS()) +
          `<div class="an-adds"><button class="btn btn-ghost xs" data-act="an-selbase">${T('Select all base nodes', 'เลือกจุดต่อที่ฐานทั้งหมด')}</button></div>` + selCount() + ed +
          `<details class="an-blk an-det" open><summary><b>${T('Supports', 'จุดรองรับ')} (${supN.length})</b></summary>${supN.length ? wrap(`<table class="an-t"><thead><tr><th>${T('Node', 'จุดต่อ')}</th><th>${T('Support', 'จุดรองรับ')}</th><th>Ux Uy Uz Rx Ry Rz</th></tr></thead><tbody>${supN.slice(0, 200).map(n => `<tr><td><button class="linkbtn" data-act="an-pickn" data-n="${esc(n.id)}">${esc(n.id)}</button></td><td>${esc((SUP().find(q => q[0] === (n.sup || 'free')) || [])[1] || n.sup)}</td><td class="mono">${F.fixOf(n).map(v => (v ? '■' : '□')).join(' ')}</td></tr>`).join('')}</tbody></table>`) : hint(T('No supports yet.', 'ยังไม่มีจุดรองรับ'))}</details>` +
          `<details class="an-blk an-det"><summary><b>${T('Released / truss elements', 'ชิ้นส่วนที่ปลดแรง / โครงถัก')} (${relM.length})</b></summary>${relM.length ? wrap(`<table class="an-t"><thead><tr><th>${T('Element', 'ชิ้นส่วน')}</th><th>${T('Release', 'การปลด')}</th></tr></thead><tbody>${relM.slice(0, 200).map(q => `<tr><td><button class="linkbtn" data-act="an-pick" data-m="${esc(q.id)}">${esc(q.id)}</button></td><td>${q.type === 'truss' ? T('truss (axial only)', 'โครงถัก') : (q.relI ? T('pin at i ', 'หมุดที่ i ') : '') + (q.relJ ? T('pin at j', 'หมุดที่ j') : '')}</td></tr>`).join('')}</tbody></table>`) : hint(T('All elements are rigidly connected.', 'ชิ้นส่วนทั้งหมดต่อแบบยึดแน่น'))}</details>`;
      }
      if (k === 'case') return hint(T('Name each load case (e.g. G dead, Q live, W wind). Tick self-weight for the case that should include the elements’ own weight. Loads are applied in step 7.', 'ตั้งชื่อกรณีน้ำหนัก (เช่น G คงที่, Q จร, W ลม) ติ๊กน้ำหนักตัวเองให้กรณีที่ต้องรวมน้ำหนักชิ้นส่วน ใส่แรงในขั้นตอนที่ 7')) + caseTable();
      if (k === 'load') {
        const cs = m.cases.some(c => c.id === A.lcase) ? A.lcase : (m.cases[0] || {}).id;
        if (!cs) return hint(T('Add a load case first (step 6).', 'เพิ่มกรณีน้ำหนักก่อน (ขั้นที่ 6)'));
        let forms = '';
        if (A.sel.n.length) forms += blk(T('Nodal load on ', 'แรงที่จุดต่อ ') + A.sel.n.length + ' ' + T('selected node(s)', 'จุดที่เลือก') + ' <span class="muted small">kN, kNm · ' + T('global axes', 'แกนหลัก') + '</span>', `<div class="an-row3">${['Fx', 'Fy', 'Fz'].map(q => fld(q, num('an-n' + q, q === 'Fz' ? -10 : 0))).join('')}</div><div class="an-row3">${['Mx', 'My', 'Mz'].map(q => fld(q, num('an-n' + q, 0))).join('')}</div><div class="an-adds"><button class="btn btn-hot xs" data-act="an-nl">${T('Apply to ', 'ใส่แรงใน ') + esc(cs)}</button></div>`);
        if (A.sel.m.length) forms += blk(T('Element load on ', 'แรงบนชิ้นส่วน ') + A.sel.m.length + ' ' + T('selected element(s)', 'ชิ้นที่เลือก'), `<div class="an-row2">${fld(T('Load', 'ชนิด'), sel(LKIND(), A.mlk || 'udl', 'id="an-mlk"'))}${fld(T('Direction', 'ทิศทาง'), sel((A.mlk || 'udl') === 'moment' ? MDIRS() : DIRS(), (A.mlk || 'udl') === 'moment' ? 'lz' : 'grav', 'id="an-mld"'))}</div>
          <div class="an-row4">${fld((A.mlk || 'udl') === 'udl' ? 'w₁ (kN/m)' : (A.mlk === 'point' ? 'P (kN)' : 'M (kNm)'), num('an-mlv', 10))}${(A.mlk || 'udl') === 'udl' ? fld(T('w₂ (blank = w₁)', 'w₂ (ว่าง = w₁)'), `<input id="an-mlv2" type="number" step="any">`) : '<span></span>'}${fld(T('a (m from i)', 'a (ม. จาก i)'), `<input id="an-mla" type="number" step="any" placeholder="${(A.mlk || 'udl') === 'udl' ? '0' : T('mid', 'กึ่งกลาง')}">`)}${(A.mlk || 'udl') === 'udl' ? fld(T('b (blank = end j)', 'b (ว่าง = ปลาย j)'), `<input id="an-mlb" type="number" step="any">`) : '<span></span>'}</div>
          <div class="an-adds"><button class="btn btn-hot xs" data-act="an-ml">${T('Apply to ', 'ใส่แรงใน ') + esc(cs)}</button><button class="btn btn-ghost xs" data-act="an-mlclear">${T('Remove ', 'ลบแรง ') + esc(cs) + T(' loads from selection', ' ของส่วนที่เลือก')}</button></div>`);
        const pal0 = palette(), nIn = id => m.loads.filter(l => l.case === id).length, shown = A.loadsOn ? A.lcase : '';
        const cards = `<div class="an-lcards" role="listbox" aria-label="${T('Load cases', 'กรณีน้ำหนัก')}">${m.cases.map(c => `<button class="an-lcard ${shown === c.id || (shown === 'all') ? 'on' : ''} ${cs === c.id ? 'cur' : ''}" role="option" aria-selected="${cs === c.id}" data-act="an-lpick" data-c="${esc(c.id)}"><i style="background:${caseCol(pal0, c.id)}"></i><b>${esc(c.id)}</b><span>${esc(c.name)}</span><em>${c.type}${c.sw ? ' · SW' : ''}</em><small>${nIn(c.id)}</small></button>`).join('')}</div>`;
        const nl = nIn(cs);
        return `<div class="an-lhead"><b>${T('Load cases', 'กรณีน้ำหนัก')}</b><span class="muted small">${T('click one to show only its loads', 'คลิกเพื่อแสดงเฉพาะแรงของกรณีนั้น')}</span><button class="linkbtn" data-act="an-step" data-s="case">${T('Edit', 'แก้ไข')}</button></div>` + cards +
          `<div class="an-lnow">${T('Applying to ', 'ใส่แรงใน ')}<b>${esc(cs)}</b> — ${esc((m.cases.find(c => c.id === cs) || {}).name || '')} · ${nl} ${T('load(s)', 'แรง')}</div>` +
          (forms || hint(T('Select nodes or elements in the view (click, Shift-click or drag a box), then apply nodal loads, distributed loads, point loads or moments to this load case.', 'เลือกจุดต่อหรือชิ้นส่วนในมุมมอง (คลิก, Shift-คลิก หรือลากกรอบ) แล้วใส่แรงที่จุดต่อ แรงแผ่กระจาย แรงจุด หรือโมเมนต์ในกรณีน้ำหนักนี้'))) + selCount() +
          (nl ? `<button class="linkbtn an-llist" data-act="an-llist" aria-expanded="${!!A.llist}">${A.llist ? '▾ ' + T('Hide individual loads', 'ซ่อนรายการแรง') : '▸ ' + T('Show individual loads', 'แสดงรายการแรง')} (${nl})</button>${A.llist ? `<div class="an-blk">${loadTable(cs)}</div>` : ''}` : '');
      }
      if (k === 'combo') {
        const cb = A.cb || (A.cb = { name: '', type: 'ULS', rows: m.cases.slice(0, 2).map((c, i) => ({ c: c.id, f: i ? 1.5 : 1.2 })) });
        const auto = cb.rows.filter(r => r.c && +r.f).map(r => f(+r.f, 2).replace(/\.?0+$/, '') + r.c).join(' + ');
        return hint(T('Pick load cases from step 6, give each a factor, and add the combination. Or generate the standard set.', 'เลือกกรณีน้ำหนักจากขั้นที่ 6 ใส่ตัวคูณให้แต่ละกรณี แล้วเพิ่มการรวมน้ำหนัก หรือสร้างชุดตามมาตรฐาน')) +
          blk(T('New combination', 'การรวมน้ำหนักใหม่'), `<div class="an-cbrows">${cb.rows.map((r, i) => `<div class="an-cbrow">${sel(m.cases.map(c => [c.id, c.id + ' — ' + c.name]), r.c, `data-cb="c" data-i="${i}"`)}<span>×</span>${inp(r.f, `data-cb="f" data-i="${i}" type="number" step="any"`, 70)}<button class="icon-btn" data-act="an-cbdel" data-i="${i}" aria-label="${T('Remove', 'ลบ')}">×</button></div>`).join('')}</div>
            <button class="linkbtn" data-act="an-cbadd">+ ${T('Add a load case to this combination', 'เพิ่มกรณีน้ำหนักในการรวมนี้')}</button>
            <div class="an-row2">${fld(T('Name', 'ชื่อ'), inp(cb.name, `data-cb="name" placeholder="${esc(auto)}"`))}${fld(T('Type', 'ชนิด'), sel([['ULS', T('ULS — strength', 'ULS — กำลัง')], ['SLS', T('SLS — service', 'SLS — ใช้งาน')]], cb.type, 'data-cb="type"'))}</div>
            <p class="an-cbprev mono">${esc(auto || '—')}</p><div class="an-adds"><button class="btn btn-hot xs" data-act="an-cbgo">${T('Add combination', 'เพิ่มการรวมน้ำหนัก')}</button></div>`) +
          blk(T('Combinations', 'การรวมน้ำหนัก') + ` (${m.combos.length})`, comboTable() + `<div class="an-preset"><span>${T('Generate set from', 'สร้างชุดตาม')}</span>${sel([['AS', 'AS/NZS 1170.0'], ['EC', 'EN 1990'], ['TH', T('EIT 1008 / ACI (Thai)', 'วสท. 1008 / ACI (ไทย)')], ['ASCE', 'ASCE 7 (LRFD)']], stdInfo(m.std).combo, 'id="an-code"')}<button class="btn btn-ghost xs" data-act="an-gen">${T('Replace with standard set', 'แทนที่ด้วยชุดมาตรฐาน')}</button></div>`);
      }
      if (k === 'run') {
        const o = A.opt, lock = pro() ? '' : 'disabled', r = A.res;
        const status = fresh() ? `<p class="notice ok">✓ ${T('Analysed in ', 'วิเคราะห์เสร็จใน ')}${r.ms} ms · ${m.cases.length} ${T('cases', 'กรณี')}, ${m.combos.length} ${T('combinations', 'การรวม')}${r.warn.length ? ' · ' + r.warn.length + T(' warning(s)', ' คำเตือน') : ''}</p>${r.warn.length ? `<ul class="warn-list">${r.warn.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}`
          : A.err && A.resVer === A.ver ? `<p class="form-err">${esc(A.err)}</p>` : A.res || A.err ? `<p class="notice warn">${T('The model has changed since the last run.', 'แบบจำลองมีการเปลี่ยนแปลงหลังการวิเคราะห์ครั้งล่าสุด')}</p>` : '';
        return `<div class="an-set">${fld(T('Model type', 'ชนิดแบบจำลอง'), sel([['', T('3D frame (6 DOF per node)', 'โครง 3 มิติ (6 องศาอิสระต่อจุด)')], ['XZ', T('2D frame in the X–Z plane', 'โครง 2 มิติ ในระนาบ X–Z')]], m.plane || '', 'data-opt="plane"'))}
          <p><b>${T('Linear static', 'สถิตเชิงเส้น')}</b> — ${T('always: every load case, combinations, envelopes.', 'คำนวณเสมอ: ทุกกรณีน้ำหนัก การรวมน้ำหนัก และค่าสูงสุด/ต่ำสุด')}</p>
          ${pro() ? '' : `<p class="notice warn">${T('P-Delta, modal and buckling analyses, models over ' + FREE_MEMBERS + ' elements and the report are Pro features.', 'การวิเคราะห์ P-Delta โหมด และการโก่งเดาะ โมเดลเกิน ' + FREE_MEMBERS + ' ชิ้นส่วน และรายงาน สำหรับสมาชิก Pro')}</p>`}
          <label class="chkl"><input type="checkbox" data-opt="pdelta" ${o.pdelta ? 'checked' : ''} ${lock}> <span><b>P-Delta</b> — ${T('second-order analysis of every combination', 'การวิเคราะห์อันดับสองของทุกการรวมน้ำหนัก')}</span></label>
          <label class="chkl"><input type="checkbox" data-opt="modes" ${o.modes ? 'checked' : ''} ${lock}> <span><b>${T('Modal', 'โหมด')}</b> — ${T('frequencies, periods, mode shapes, mass participation', 'ความถี่ คาบ รูปโหมด สัดส่วนมวล')}</span></label>
          <div class="an-row3">${fld(T('Modes', 'จำนวนโหมด'), `<input type="number" min="1" max="20" data-opt="nmodes" value="${o.nmodes}" ${lock}>`)}${fld(T('Mass G ×', 'มวล G ×'), `<input type="number" step="any" data-opt="massG" value="${o.massG}" ${lock}>`)}${fld('Q ×', `<input type="number" step="any" data-opt="massQ" value="${o.massQ}" ${lock}>`)}</div>
          <label class="chkl"><input type="checkbox" data-opt="buckling" ${o.buckling ? 'checked' : ''} ${lock}> <span><b>${T('Elastic buckling', 'การโก่งเดาะแบบยืดหยุ่น')}</b> — ${T('λcr for every ULS combination', 'λcr ของทุกการรวม ULS')}</span></label>
          ${fld(T('Internal segments per element (P-Delta, modes, buckling)', 'จำนวนส่วนย่อยต่อชิ้นส่วน (P-Delta, โหมด, การโก่งเดาะ)'), `<input type="number" min="2" max="10" data-opt="nseg" value="${o.nseg}" ${lock}>`)}</div>
          <button class="btn btn-hot an-runbtn" data-act="an-run">▶ ${T('Run analysis', 'วิเคราะห์โครงสร้าง')}</button>${status}`;
      }
      // results
      if (!fresh()) return hint(T('Run the analysis (step 9) to see results.', 'วิเคราะห์โครงสร้าง (ขั้นที่ 9) เพื่อดูผลลัพธ์')) + `<button class="btn btn-hot an-runbtn" data-act="an-run">▶ ${T('Run analysis', 'วิเคราะห์โครงสร้าง')}</button>`;
      const rv = [['def', T('Deflected shape', 'รูปการโก่งตัว')], ['N', T('Axial N', 'แรงตามแนวแกน N')], ['Vy', T('Shear V_y', 'แรงเฉือน V_y')], ['Vz', T('Shear V_z', 'แรงเฉือน V_z')], ['T', T('Torsion T', 'แรงบิด T')], ['My', T('Moment M_y (minor)', 'โมเมนต์ M_y (แกนรอง)')], ['Mz', T('Moment M_z (major)', 'โมเมนต์ M_z (แกนหลัก)')], ['react', T('Reactions', 'แรงปฏิกิริยา')], ['mode', T('Mode shapes', 'รูปโหมด')], ['buck', T('Buckling', 'การโก่งเดาะ')]];
      return `<div class="an-rvs">${rv.map(([q, l]) => `<button data-act="an-rv" data-v="${q}" aria-pressed="${A.rview === q}">${l}</button>`).join('')}</div>` +
        (A.rview === 'mode' ? fld(T('Mode', 'โหมด'), sel((A.res.modal ? A.res.modal.modes : []).map((md, i) => [i, (i + 1) + ' · T = ' + f(md.T, 3) + ' s']), A.mode, 'id="an-modesel"')) : fld(T('Results for', 'ผลของ'), sel(srcList(), A.src, 'id="an-src"'))) +
        `<div class="an-row2">${fld(T('Diagram scale', 'มาตราส่วนแผนภาพ'), `<input type="range" min="0.2" max="4" step="0.1" value="${A.dscale}" id="an-scale">`)}<label class="chkl an-f"><span>&nbsp;</span><span><input type="checkbox" id="an-labels" ${A.labels ? 'checked' : ''}> ${T('Values and labels', 'ค่าและป้ายชื่อ')}</span></label></div>` +
        hint(T('Click an element in the view to see its N, V, T, M and deflection diagrams and to send its forces to RC design. Tables are below the view.', 'คลิกชิ้นส่วนในมุมมองเพื่อดูแผนภาพ N, V, T, M และการโก่ง และส่งแรงไปออกแบบ RC ตารางอยู่ใต้มุมมอง')) +
        `<div class="an-adds"><button class="btn ${pro() ? 'btn-ghost' : 'btn-lock'} xs" data-act="an-report">${pro() ? T('Analysis report', 'รายงานการวิเคราะห์') : '🔒 ' + T('Report (Pro)', 'รายงาน (Pro)')}</button></div>`;
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
        else if (/^fix\d$/.test(k)) { const dd = +k.slice(3); nodes.forEach(n => { n.fix = F.fixOf(n).slice(); n.sup = 'custom'; n.fix[dd] = v ? 1 : 0; }); }
        else nodes.forEach(n => { if (v === '' || !(+v)) delete n[k]; else n[k] = +v; });
      } else if (mems.length) {
        if (k === 'mid') { if (mems.length !== 1) return; const nid = String(v).trim(); if (!nid || m.members.some(q => q !== mems[0] && q.id === nid)) { t.classList.add('bad'); return; } t.classList.remove('bad'); renameRefs('members', mems[0].id, nid); mems[0].id = nid; }
        else if ((k === 'i' || k === 'j') && mems.length === 1) { mems[0][k] = v; side = true; }
        else if (k === 'sec' || k === 'mat') { if (!v) return; mems.forEach(q => { q[k] = v; }); side = mems.length === 1; }
        else if (k === 'type') { if (!v) return; mems.forEach(q => { q.type = v; }); side = true; }
        else if (k === 'relI' || k === 'relJ') { mems.forEach(q => { q[k] = !!v; }); side = true; }
        else if (k === 'hinge') { if (!v) return; mems.forEach(q => { q.relI = v === 'i' || v === 'both'; q.relJ = v === 'j' || v === 'both'; }); side = true; }
        else if (k === 'beta') { if (v === '' || !isFinite(+v)) return; mems.forEach(q => { q.beta = +v; }); }
      } else return;
      changed(side);
    }

    // ------------------------------------------------------------------ results panel (below the view)
    function resultsHTML() {
      if (!fresh()) return '';
      const r = A.res, cur = current(), m = A.model, env = cur && cur.kind === 'env';
      const rt = A.rtab, tabs = [['sum', T('Summary', 'สรุป')], ['react', T('Reactions', 'แรงปฏิกิริยา')], ['forces', T('Element forces', 'แรงในชิ้นส่วน')], ['disp', T('Displacements', 'การเคลื่อนตัว')], ['drift', T('Storey drift', 'การเคลื่อนตัวระหว่างชั้น')], ['modal', T('Modal', 'โหมด')], ['buck', T('Buckling', 'การโก่งเดาะ')]];
      const ext2 = (mm, q) => (env ? [Math.max(...mm[q + 'max']), Math.min(...mm[q + 'min'])] : [Math.max(...mm[q]), Math.min(...mm[q])]);
      const amax = (mm, q) => { const e = ext2(mm, q); return Math.max(Math.abs(e[0]), Math.abs(e[1])); };
      let body = '';
      if (rt === 'sum') {
        const best = {}; if (cur) cur.mem.forEach(mm => { ['N', 'Vy', 'Vz', 'T', 'My', 'Mz'].forEach(q => { const v = amax(mm, q); if (!best[q] || v > best[q][0]) best[q] = [v, mm.id]; }); const e = ext2(mm, 'N'); if (!best.Nt || e[0] > best.Nt[0]) best.Nt = [e[0], mm.id]; if (!best.Nc || e[1] < best.Nc[0]) best.Nc = [e[1], mm.id]; });
        let md = null; if (cur && !env) cur.mem.forEach(mm => mm.x.forEach((x, i) => { const dd = Math.hypot(mm.dx[i], mm.dy[i], mm.dz[i]); if (!md || dd > md.d) md = { d: dd, id: mm.id, x }; }));
        const kv = (k2, v, u) => `<div><dt>${k2}</dt><dd class="mono">${v} <span class="u">${u}</span></dd></div>`, bv = (q, u) => (best[q] ? kv('|' + COMPS.find(c => c[0] === q)[1] + '| max', fx(best[q][0]), u + ' · ' + esc(best[q][1])) : '');
        body = `<dl class="kv an-kv">${bv('Mz', 'kNm')}${bv('My', 'kNm')}${bv('Vy', 'kN')}${bv('Vz', 'kN')}${bv('T', 'kNm')}${best.Nt ? kv(T('Max tension', 'แรงดึงสูงสุด'), fx(best.Nt[0]), 'kN · ' + esc(best.Nt[1])) : ''}${best.Nc ? kv(T('Max compression', 'แรงอัดสูงสุด'), fx(best.Nc[0]), 'kN · ' + esc(best.Nc[1])) : ''}${md ? kv(T('Max displacement', 'การเคลื่อนตัวสูงสุด'), fx(md.d * 1000) + ' mm', '· ' + esc(md.id) + ' @ ' + f(md.x, 2) + ' m') : ''}${kv(T('Solved in', 'เวลาคำนวณ'), r.ms, 'ms')}</dl>
          ${r.modal && r.modal.modes.length ? `<p class="muted">${T('Fundamental period', 'คาบพื้นฐาน')} T₁ = <b class="mono">${f(r.modal.modes[0].T, 3)} s</b> (f₁ = ${f(r.modal.modes[0].f, 3)} Hz)</p>` : ''}
          ${r.buckling ? `<p class="muted">${T('Lowest buckling factor', 'ตัวคูณการโก่งเดาะต่ำสุด')} λcr = <b class="mono">${fx(Math.min(...Object.values(r.buckling).map(b => (b.modes && b.modes[0] ? b.modes[0].lam : Infinity))))}</b></p>` : ''}
          ${r.warn.length ? `<ul class="warn-list">${r.warn.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}`;
      } else if (rt === 'react') {
        const rows = m.nodes.map((n, i) => [n, i]).filter(([n]) => F.fixOf(n).some(Boolean) || ['kx', 'ky', 'kz', 'krx', 'kry', 'krz'].some(q => +n[q] > 0));
        body = !cur ? '' : wrap(`<table class="chk an-r"><thead><tr><th>${T('Node', 'จุดต่อ')}</th>${['Rx', 'Ry', 'Rz'].map(q => `<th class="num">${q} (kN)</th>`).join('')}${['Mx', 'My', 'Mz'].map(q => `<th class="num">${q} (kNm)</th>`).join('')}</tr></thead><tbody>${rows.map(([n, i]) => `<tr><td>${esc(n.id)}</td>${[0, 1, 2, 3, 4, 5].map(dd => `<td class="num mono">${env ? fx(cur.R[6 * i + dd][0], 1) + ' … ' + fx(cur.R[6 * i + dd][1], 1) : fx(cur.R[6 * i + dd])}</td>`).join('')}</tr>`).join('')}
          ${env ? '' : `<tr class="tot"><td>Σ</td>${[0, 1, 2].map(dd => `<td class="num mono">${fx(rows.reduce((s2, [, i]) => s2 + cur.R[6 * i + dd], 0))}</td>`).join('')}<td></td><td></td><td></td></tr>`}</tbody></table>`);
      } else if (rt === 'forces') {
        body = !cur ? '' : wrap(`<table class="chk an-r"><thead><tr><th>${T('Element', 'ชิ้นส่วน')}</th><th class="num">L</th><th class="num">N max</th><th class="num">N min</th><th class="num">|V<sub>y</sub>|</th><th class="num">|V<sub>z</sub>|</th><th class="num">|T|</th><th class="num">M<sub>y</sub> max</th><th class="num">M<sub>y</sub> min</th><th class="num">M<sub>z</sub> max</th><th class="num">M<sub>z</sub> min</th>${env ? '' : `<th class="num">δ (mm)</th><th class="num">L/δ</th>`}</tr></thead><tbody>${cur.mem.slice(0, 400).map(mm => { const dmax = env ? 0 : Math.max(...mm.drel.map(Math.abs), ...mm.drelz.map(Math.abs)); const N = ext2(mm, 'N'), My = ext2(mm, 'My'), Mz = ext2(mm, 'Mz'); return `<tr class="${A.sel.m.includes(mm.id) ? 'on' : ''}" data-act="an-pick" data-m="${esc(mm.id)}"><td>${esc(mm.id)}</td><td class="num mono">${f(mm.L, 2)}</td>${[N[0], N[1], amax(mm, 'Vy'), amax(mm, 'Vz'), amax(mm, 'T'), My[0], My[1], Mz[0], Mz[1]].map(v => `<td class="num mono">${fx(v)}</td>`).join('')}${env ? '' : `<td class="num mono">${fx(dmax * 1000)}</td><td class="num mono">${dmax > 1e-9 ? f(mm.L / dmax, 0) : '—'}</td>`}</tr>`; }).join('')}</tbody></table>`) + hint(T('δ = deflection relative to the line joining the element ends (local y and z). Click a row to show the element.', 'δ = การโก่งเทียบเส้นเชื่อมปลายชิ้นส่วน (แกน y และ z) คลิกแถวเพื่อแสดงชิ้นส่วน'));
      } else if (rt === 'disp') {
        body = !cur || env ? `<p class="muted">${T('Choose a load case or combination.', 'เลือกกรณีน้ำหนักหรือการรวมน้ำหนัก')}</p>` : wrap(`<table class="chk an-r"><thead><tr><th>${T('Node', 'จุดต่อ')}</th><th class="num">u<sub>x</sub> (mm)</th><th class="num">u<sub>y</sub> (mm)</th><th class="num">u<sub>z</sub> (mm)</th><th class="num">θ<sub>x</sub></th><th class="num">θ<sub>y</sub></th><th class="num">θ<sub>z</sub> (mrad)</th></tr></thead><tbody>${m.nodes.slice(0, 400).map((n, i) => `<tr class="${A.sel.n.includes(n.id) ? 'on' : ''}"><td>${esc(n.id)}</td>${[0, 1, 2, 3, 4, 5].map(dd => `<td class="num mono">${fx(cur.u[6 * i + dd] * 1000, 3)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      } else if (rt === 'drift') {
        if (!cur || env) body = `<p class="muted">${T('Choose a load case or combination.', 'เลือกกรณีน้ำหนักหรือการรวมน้ำหนัก')}</p>`;
        else {
          const lv = {}; m.nodes.forEach((n, i) => { const z = r4(+n.z || 0); (lv[z] = lv[z] || []).push([cur.u[6 * i], cur.u[6 * i + 1]]); });
          const zs = Object.keys(lv).map(Number).sort((a, b) => a - b), rows = []; let prev = null;
          zs.forEach(z => { const L = lv[z], ux = L.reduce((s2, v) => s2 + v[0], 0) / L.length, uy = L.reduce((s2, v) => s2 + v[1], 0) / L.length; if (prev) rows.push({ z, ux, uy, h: z - prev.z, dx: ux - prev.ux, dy: uy - prev.uy }); prev = { z, ux, uy }; });
          const rat = (dd, h) => (Math.abs(dd) > 1e-9 ? 'h / ' + f(h / Math.abs(dd), 0) : '—');
          body = rows.length ? `<table class="chk an-r"><thead><tr><th>${T('Level Z (m)', 'ระดับ Z (ม.)')}</th><th class="num">u<sub>x</sub> (mm)</th><th class="num">u<sub>y</sub> (mm)</th><th class="num">h (m)</th><th class="num">${T('Drift X', 'ดริฟต์ X')}</th><th class="num">${T('Drift Y', 'ดริฟต์ Y')}</th></tr></thead><tbody>${rows.map(rw => `<tr><td class="mono">${f(rw.z, 2)}</td><td class="num mono">${fx(rw.ux * 1000)}</td><td class="num mono">${fx(rw.uy * 1000)}</td><td class="num mono">${f(rw.h, 2)}</td><td class="num mono">${fx(rw.dx * 1000)} · ${rat(rw.dx, rw.h)}</td><td class="num mono">${fx(rw.dy * 1000)} · ${rat(rw.dy, rw.h)}</td></tr>`).join('')}</tbody></table>` + hint(T('Average horizontal displacement of the nodes at each level. Typical limits h/500, h/300 (portal frames under wind).', 'ค่าเฉลี่ยการเคลื่อนตัวแนวราบของจุดต่อในแต่ละระดับ ค่าจำกัดทั่วไป h/500, h/300 (โครงข้อแข็งรับลม)')) : `<p class="muted">${T('One level only.', 'มีระดับเดียว')}</p>`;
        }
      } else if (rt === 'modal') {
        body = r.modal ? wrap(`<table class="chk an-r"><thead><tr><th>${T('Mode', 'โหมด')}</th><th class="num">f (Hz)</th><th class="num">T (s)</th><th class="num">${T('Mass', 'มวล')} X</th><th class="num">Y</th><th class="num">Z</th><th class="num">Σ X</th><th class="num">Σ Y</th><th class="num">Σ Z</th><th></th></tr></thead><tbody>${r.modal.modes.map((md, i) => `<tr class="${A.rview === 'mode' && A.mode === i ? 'on' : ''}"><td>${i + 1}</td><td class="num mono">${f(md.f, 3)}</td><td class="num mono">${f(md.T, 3)}</td>${[md.mx, md.my, md.mz, md.cmx, md.cmy, md.cmz].map(v => `<td class="num mono">${f(v * 100, 1)}%</td>`).join('')}<td><button class="btn btn-ghost xs" data-act="an-mode" data-k="${i}">${T('Show', 'แสดง')}</button></td></tr>`).join('')}</tbody></table>`) + hint(T('Mass X / Y / Z', 'มวล X / Y / Z') + `: ${f(r.modal.massX, 2)} / ${f(r.modal.massY, 2)} / ${f(r.modal.massZ, 2)} t`) : `<p class="muted">${pro() ? T('Turn on modal analysis in step 9 and run again.', 'เปิดการวิเคราะห์โหมดในขั้นที่ 9 แล้ววิเคราะห์อีกครั้ง') : T('Modal analysis is a Pro feature.', 'การวิเคราะห์โหมดสำหรับสมาชิก Pro')}</p>`;
      } else if (rt === 'buck') {
        body = r.buckling ? `<table class="chk an-r"><thead><tr><th>${T('Combination', 'การรวมน้ำหนัก')}</th><th class="num">λcr,1</th><th class="num">λcr,2</th><th class="num">λcr,3</th><th>${T('Second-order effects', 'ผลอันดับสอง')}</th><th></th></tr></thead><tbody>${m.combos.filter(c => r.buckling[c.id]).map(c => { const b = r.buckling[c.id], l = b.modes ? b.modes.map(q => q.lam) : [], l1 = l[0]; return `<tr><td>${esc(c.id)} — ${esc(c.name)}</td>${[0, 1, 2].map(i => `<td class="num mono">${l[i] ? f(l[i], 2) : b.none && i === 0 ? '∞' : '—'}</td>`).join('')}<td>${l1 ? (l1 < 3 ? `<span class="pill st-bad">${T('λcr < 3: unstable / redesign', 'λcr < 3: ไม่มั่นคง ควรแก้ไข')}</span>` : l1 < 10 ? `<span class="pill st-warn">${T('3 ≤ λcr < 10: use second-order (P-Delta)', '3 ≤ λcr < 10: ใช้การวิเคราะห์อันดับสอง')}</span>` : `<span class="pill st-ok">${T('λcr ≥ 10: first-order OK', 'λcr ≥ 10: อันดับหนึ่งเพียงพอ')}</span>`) : b.error ? esc(b.error) : ''}</td><td>${l1 ? `<button class="btn btn-ghost xs" data-act="an-buck" data-c="${esc(c.id)}">${T('Show', 'แสดง')}</button>` : ''}</td></tr>`; }).join('')}</tbody></table>` : `<p class="muted">${pro() ? T('Turn on buckling analysis in step 9 and run again.', 'เปิดการวิเคราะห์การโก่งเดาะในขั้นที่ 9 แล้ววิเคราะห์อีกครั้ง') : T('Buckling analysis is a Pro feature.', 'การวิเคราะห์การโก่งเดาะสำหรับสมาชิก Pro')}</p>`;
      }
      return `<div class="tabs sm" role="tablist">${tabs.map(([k2, l]) => `<button role="tab" aria-selected="${rt === k2}" data-act="an-rtab" data-t="${k2}">${l}</button>`).join('')}</div><div class="an-rb">${body}</div>`;
    }
    function memberHTML() {
      const cur = current(); if (A.step !== 'res' || A.sel.m.length !== 1 || !cur) return '';
      const mm = memRes(cur, A.sel.m[0]); if (!mm) return '';
      const mb = A.model.members.find(q => q.id === mm.id), env = cur.kind === 'env'; if (!mb) return '';
      const chart = (lbl, unit, arrs, cls, flip) => {
        const Wc = 260, Hc = 96, all = arrs.flat(), mx = Math.max(1e-9, ...all.map(Math.abs)), X = x => 8 + (Wc - 16) * x / mm.L, Y = v => Hc / 2 - v / mx * (Hc / 2 - 12) * (flip ? -1 : 1);
        const paths = arrs.map((a, si) => `<path d="M${X(0)} ${Hc / 2} ${a.map((v, i) => `L${X(mm.x[i]).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ')} L${X(mm.L)} ${Hc / 2} Z" class="an-dg ${cls} ${si ? 'neg' : ''}"/>`).join('');
        return `<figure class="an-mc"><figcaption><span>${lbl}</span> <span class="mono">${f(Math.min(...all), 2)} … ${f(Math.max(...all), 2)} ${unit}</span></figcaption><svg viewBox="0 0 ${Wc} ${Hc}"><line x1="8" x2="${Wc - 8}" y1="${Hc / 2}" y2="${Hc / 2}" class="an-ax"/>${paths}</svg></figure>`;
      };
      const g = q => arr(mm, q, env), s = A.model.sections.find(q => q.id === mb.sec), p = s ? F.secProps(s) : null;
      return `<div class="card an-member"><div class="an-mh"><h3>${T('Element', 'ชิ้นส่วน')} ${esc(mm.id)} <span class="muted small">${esc(mb.i)} → ${esc(mb.j)} · L = ${f(mm.L, 3)} m · ${esc(mb.sec)}${p ? ' (A ' + f(p.A, 0) + ' mm²)' : ''}</span></h3>
        <div class="an-send"><button class="btn btn-ghost xs" data-act="an-send" data-e="beam">${T('Design as RC beam →', 'ออกแบบเป็นคาน คสล. →')}</button><button class="btn btn-ghost xs" data-act="an-send" data-e="column">${T('Design as RC column →', 'ออกแบบเป็นเสา คสล. →')}</button></div></div>
        <div class="an-mcs">${chart(T('Axial N', 'แรงตามแนวแกน N'), 'kN', g('N'), 'N')}${chart('V<sub>y</sub>', 'kN', g('Vy'), 'V')}${chart('V<sub>z</sub>', 'kN', g('Vz'), 'V')}${chart(T('Torsion T', 'แรงบิด T'), 'kNm', g('T'), 'T')}${chart('M<sub>y</sub>', 'kNm', g('My'), 'My', true)}${chart('M<sub>z</sub>', 'kNm', g('Mz'), 'M', true)}${env ? '' : chart(T('Deflection (local y)', 'การโก่ง (แกน y)'), 'mm', [mm.drel.map(v => v * 1000)], 'D') + chart(T('Deflection (local z)', 'การโก่ง (แกน z)'), 'mm', [mm.drelz.map(v => v * 1000)], 'D')}</div></div>`;
    }
    function sendToDesign(elem) {
      const cur = current(); if (!cur || A.sel.m.length !== 1) return;
      const mm = memRes(cur, A.sel.m[0]); if (!mm) return;
      const env = cur.kind === 'env', mxA = q => (env ? Math.max(...mm[q + 'max'].map(Math.abs), ...mm[q + 'min'].map(Math.abs)) : Math.max(...mm[q].map(Math.abs)));
      const hi = q => (env ? Math.max(...mm[q + 'max']) : Math.max(...mm[q])), lo = q => (env ? Math.min(...mm[q + 'min']) : Math.min(...mm[q]));
      const M = Math.abs(hi('Mz')) >= Math.abs(lo('Mz')) ? hi('Mz') : lo('Mz'), Nc = -lo('N');
      ctx.toDesign(elem, { M, My: mxA('My'), V: mxA('Vy'), Vz: mxA('Vz'), T: mxA('T'), N: Math.max(0, Nc), id: mm.id, src: A.src, code: ({ AS: 'AS', EC: 'EC2', TH: 'TH' })[A.model.std] });
    }

    // ------------------------------------------------------------------ page
    function view() {
      const lv = levels(), ax = cutAxis(), showRes = A.step === 'res' && fresh(), sd = stdInfo(A.model.std);
      return `<main class="an an-app">
          <aside class="an-side" id="anSide">${treeHTML()}</aside>
          <section class="an-work">
            <div class="an-tools">
              <div class="seg" role="group" aria-label="${T('Tool', 'เครื่องมือ')}">${[['select', T('Select', 'เลือก'), T('Click to pick · drag a box: → window, ← crossing · Shift adds · Ctrl removes', 'คลิกเพื่อเลือก · ลากกรอบ: → หน้าต่าง, ← ตัดผ่าน · Shift เพิ่ม · Ctrl ลบออก')], ['orbit', T('Orbit', 'หมุน'), T('Drag to rotate the 3D view', 'ลากเพื่อหมุนมุมมอง 3 มิติ')], ['node', T('Node', 'จุดต่อ'), ''], ['member', T('Element', 'ชิ้นส่วน'), '']].map(([k, l, tt]) => `<button data-act="an-tool" data-t="${k}" aria-pressed="${A.tool === k}" ${tt ? `title="${esc(tt)}"` : ''}>${l}</button>`).join('')}</div>
              ${sel([['', T('Select…', 'เลือก…')], ['all', T('All', 'ทั้งหมด')], ['none', T('None', 'ไม่เลือก')], ['inv', T('Invert', 'กลับการเลือก')], ['nodes', T('All nodes', 'จุดต่อทั้งหมด')], ['elems', T('All elements', 'ชิ้นส่วนทั้งหมด')], ['col', T('Columns', 'เสา')], ['beam', T('Beams', 'คาน')], ['brace', T('Bracing', 'ค้ำยัน')], ['sup', T('Supports', 'จุดรองรับ')], ['samesec', T('Same section as selected', 'หน้าตัดเดียวกับที่เลือก')], ['samemat', T('Same material as selected', 'วัสดุเดียวกับที่เลือก')]].concat(A.model.sections.map(q => ['sec:' + q.id, T('Section ', 'หน้าตัด ') + q.id])), '', `id="an-selby" class="an-selby" aria-label="${T('Select by', 'เลือกตาม')}"`)}
              <div class="seg" role="group" aria-label="${T('Display', 'การแสดงผล')}">${[['wire', T('Wire', 'เส้น'), T('Centre-line view', 'แสดงเส้นแกน')], ['solid', T('Solid', 'ทรงตัน'), T('Render the actual section shapes', 'แสดงรูปหน้าตัดจริง')]].map(([k, l, tt]) => `<button data-act="an-disp" data-d="${k}" aria-pressed="${(k === 'solid') === !!A.solid}" title="${esc(tt)}">${l}</button>`).join('')}</div>
              <div class="seg" role="group" aria-label="${T('View', 'มุมมอง')}">${[['3d', '3D'], ['plan', T('Plan', 'แปลน')], ['xz', 'X–Z'], ['yz', 'Y–Z']].map(([k, l]) => `<button data-act="an-cam" data-v="${k}" aria-pressed="${A.cam.v === k}">${l}</button>`).join('')}</div>
              ${ax ? `<label class="an-lv">${ax.toUpperCase()} = ${sel([['all', T('all', 'ทั้งหมด')]].concat(lv.map(v => [v, f(v, 2)])), A.cut, 'id="an-cut"')}</label>` : ''}
              ${sel([['', T('Loads: off', 'แรง: ปิด')]].concat(A.model.cases.map(c => [c.id, T('Loads: ', 'แรง: ') + c.id + ' — ' + c.name]), [['all', T('Loads: all cases', 'แรง: ทุกกรณี')]]), A.loadsOn ? A.lcase : '', `id="an-lshow" class="an-lshow" aria-label="${T('Show loads of', 'แสดงแรงของ')}"`)}
              <span class="grow"></span>
              <button class="btn btn-ghost xs" data-act="an-fit" title="${T('Zoom to fit', 'ซูมให้พอดี')}" aria-label="${T('Zoom to fit', 'ซูมให้พอดี')}">⤢</button><button class="btn btn-ghost xs" data-act="an-undo" ${A.hist.length ? '' : 'disabled'} title="Ctrl+Z" aria-label="Undo">↶</button><button class="btn btn-ghost xs" data-act="an-redo" ${A.fut.length ? '' : 'disabled'} title="Ctrl+Y" aria-label="Redo">↷</button>
              <span class="an-sep"></span>
              <button class="btn btn-ghost xs" data-act="an-tplopen">${T('Template', 'แม่แบบ')}</button><button class="btn btn-ghost xs" data-act="an-save">${T('Save', 'บันทึก')}</button><label class="btn btn-ghost xs an-open">${T('Open', 'เปิด')}<input type="file" accept=".json,application/json" id="an-file" hidden></label><button class="btn ${pro() ? 'btn-ghost' : 'btn-lock'} xs" data-act="an-report">${pro() ? T('Report', 'รายงาน') : '🔒 ' + T('Report', 'รายงาน')}</button>
              <button class="btn btn-hot xs" data-act="an-run">▶ ${T('Run', 'วิเคราะห์')}</button>
            </div>
            <div class="an-canvas"><canvas id="anCv" tabindex="0" aria-label="${T('3D model view', 'มุมมองแบบจำลอง 3 มิติ')}"></canvas><span class="an-tag" id="anViewTag">${viewTag()}</span>
              <p class="an-hintbar"><span id="anHint">${hintBar()}</span> · kN, m</p></div>
            <div class="an-drawer ${showRes ? 'on' : ''}" id="anDrawer">${drawerHTML()}</div>
          </section>
        ${A.tplOpen ? `<div class="modal-bg an-tplbg">${tplHTML()}</div>` : ''}
        <div id="anWinHost"></div>
        <div id="reportWrap" class="an-report"></div></main>`;
    }
    function syncLshow() { const e = $('#an-lshow'); if (e) e.value = A.loadsOn ? A.lcase : ''; }
    function hintBar() {
      const rot = A.cam.v === '3d' ? T('right-drag: rotate', 'ลากคลิกขวา: หมุน') : T('right-drag: pan', 'ลากคลิกขวา: เลื่อน');
      if (A.tool === 'select') return T('Drag box: → window / ← crossing · Shift: add · Ctrl: remove', 'ลากกรอบ: → หน้าต่าง / ← ตัดผ่าน · Shift: เพิ่ม · Ctrl: ลบออก') + ' · ' + rot + ' · ' + T('middle-drag: pan · wheel: zoom', 'ลากปุ่มกลาง: เลื่อน · ล้อเมาส์: ซูม');
      return (A.cam.v === '3d' ? T('Drag: rotate', 'ลาก: หมุน') : T('Drag: pan', 'ลาก: เลื่อน')) + ' · ' + T('Shift-drag: select area · middle/right-drag: pan · wheel: zoom', 'Shift-ลาก: เลือกพื้นที่ · ลากปุ่มกลาง/ขวา: เลื่อน · ล้อเมาส์: ซูม');
    }
    function drawerHTML() {
      if (!(A.step === 'res' && fresh())) return '';
      return `<div class="an-drawhead"><b>${T('Results', 'ผลลัพธ์')}</b><span class="muted small">${esc((srcList().find(q => q[0] === A.src) || [])[1] || '')}</span><span class="grow"></span><button class="btn btn-ghost xs" data-act="an-drawer">${A.drawerMin ? T('Show ▴', 'แสดง ▴') : T('Hide ▾', 'ซ่อน ▾')}</button></div>
        ${A.drawerMin ? '' : `<div class="an-drawbody"><div id="anMember">${memberHTML()}</div><div class="an-results" id="anRes">${resultsHTML()}</div></div>`}`;
    }
    function tplHTML() {
      const p = Object.assign({}, TPL[A.tpl].p, A.tplP || {});
      const fl = (k, lbl, type) => `<label>${lbl}<input data-tp="${k}" value="${esc(p[k])}" ${type === 'n' ? 'type="number" step="any"' : ''}></label>`;
      const form = A.tpl === 'building' ? fl('bx', T('Bays in X (m), comma separated', 'ช่วงแกน X (ม.) คั่นด้วยจุลภาค')) + fl('by', T('Bays in Y (m)', 'ช่วงแกน Y (ม.)')) + fl('st', T('Storey heights (m), bottom up', 'ความสูงชั้น (ม.) จากล่างขึ้นบน')) + fl('g', T('Beam dead UDL G (kN/m, plus self-weight)', 'น้ำหนักคงที่บนคาน G (kN/m ไม่รวมน้ำหนักตัวเอง)'), 'n') + fl('q', T('Beam live UDL Q (kN/m)', 'น้ำหนักจรบนคาน Q (kN/m)'), 'n') + fl('wind', T('Wind force per floor, each direction (kN)', 'แรงลมต่อชั้น แต่ละทิศ (kN)'), 'n')
        : A.tpl === 'shed' || A.tpl === 'portal' ? fl('span', T('Span (m)', 'ช่วงกว้าง (ม.)'), 'n') + fl('eave', T('Eave height (m)', 'ความสูงชายคา (ม.)'), 'n') + fl('rise', T('Apex rise (m)', 'ความสูงจั่ว (ม.)'), 'n') + fl('bay', T('Frame spacing (m)', 'ระยะห่างโครง (ม.)'), 'n') + (A.tpl === 'shed' ? fl('nb', T('Number of bays', 'จำนวนช่วง'), 'n') : '') + `<label>${T('Bases', 'ฐาน')}${sel([['pin', T('Pinned', 'หมุด')], ['fixed', T('Fixed', 'ยึดแน่น')]], p.base, 'data-tp="base"')}</label>`
          : A.tpl === 'beam' ? fl('spans', T('Spans (m), comma separated', 'ช่วงคาน (ม.) คั่นด้วยจุลภาค')) + fl('g', T('Dead UDL G (kN/m, plus self-weight)', 'น้ำหนักคงที่ G (kN/m ไม่รวมน้ำหนักตัวเอง)'), 'n') + fl('q', T('Live UDL Q (kN/m)', 'น้ำหนักจร Q (kN/m)'), 'n')
            : A.tpl === 'truss' ? `<label>${T('Type', 'ชนิด')}${sel([['pratt', 'Pratt'], ['howe', 'Howe'], ['warren', 'Warren']], p.kind, 'data-tp="kind"')}</label>` + fl('span', T('Span (m)', 'ช่วงกว้าง (ม.)'), 'n') + fl('depth', T('Depth (m)', 'ความลึก (ม.)'), 'n') + fl('panels', T('Panels (even)', 'จำนวนช่อง (คู่)'), 'n') + fl('load', T('Dead load per top node (kN)', 'น้ำหนักคงที่ต่อจุดต่อบน (kN)'), 'n')
              : `<p class="muted">${T('An empty 3D model with a concrete grade, a steel grade, a rectangle and a steel section from the chosen standard, and G and Q load cases.', 'โมเดล 3 มิติว่าง มีคอนกรีต เหล็ก หน้าตัดสี่เหลี่ยมและหน้าตัดเหล็กตามมาตรฐานที่เลือก และกรณีน้ำหนัก G และ Q')}</p>`;
      return `<div class="modal an-tpl" data-stop="1"><h3>${T('New model from a template', 'สร้างแบบจำลองจากแม่แบบ')}</h3><div class="seg" role="group">${Object.entries(TPL).map(([k, v]) => `<button data-act="an-tpl" data-t="${k}" aria-pressed="${A.tpl === k}">${T(v.n[0], v.n[1])}</button>`).join('')}</div><div class="mgrid an-tplf">${form}</div><div class="mfoot"><span class="muted small">${T('Uses the current design standard (' + A.model.std + ') for materials, sections and combinations. Replaces the current model — Undo brings it back.', 'ใช้มาตรฐานปัจจุบัน (' + A.model.std + ') สำหรับวัสดุ หน้าตัด และการรวมน้ำหนัก แทนที่แบบจำลองปัจจุบัน — กดย้อนกลับได้')}</span><span class="grow"></span><button class="btn btn-ghost sm" data-act="an-tplclose">${T('Cancel', 'ยกเลิก')}</button><button class="btn btn-hot sm" data-act="an-tplgo">${T('Create model', 'สร้างแบบจำลอง')}</button></div></div>`;
    }
    function drawAll() {
      redraw(); updCounts();
      const d = $('#anDrawer'); if (d) { const on = A.step === 'res' && fresh(); d.className = 'an-drawer' + (on ? ' on' : '') + (A.drawerMin ? ' min' : ''); d.innerHTML = drawerHTML(); }
      const u = document.querySelector('[data-act=an-undo]'), rd = document.querySelector('[data-act=an-redo]'); if (u) u.disabled = !A.hist.length; if (rd) rd.disabled = !A.fut.length;
    }
    let resizeBound = false, keyBound = false;
    function mount() {
      const cv = $('#anCv'); if (!cv) return;
      winRefresh();
      if (!cv._b) { cv._b = true; bindCanvas(cv); if (G.ResizeObserver) { let raf = 0; let last = [0, 0]; new G.ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (!cv.isConnected) return; const w = cv.clientWidth, h = cv.clientHeight; if (Math.abs(w - last[0]) > 30 || Math.abs(h - last[1]) > 30) { if (last[0]) A.cam.k = null; last = [w, h]; } redraw(); }); }).observe(cv); } }
      redraw();
      if (!resizeBound) { resizeBound = true; let rt = null; G.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if ($('#anCv')) redraw(); }, 120); }); }
      if (!keyBound) {
        keyBound = true;
        document.addEventListener('dragstart', e => { const t = e.target.closest && e.target.closest('[data-dnd]'); if (!t || S.view !== 'analysis') return; A.dnd = t.dataset.dnd; try { e.dataTransfer.setData('text/plain', A.dnd); e.dataTransfer.effectAllowed = 'copy'; } catch (er) { } document.body.classList.add('an-dragging'); });
        document.addEventListener('dragend', () => { A.dnd = null; document.body.classList.remove('an-dragging'); if (A.hover) { A.hover = null; redraw(); } });
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
      if (t.dataset.w && A.win) {
        const k = A.win.k, v = wdef(k), fd = t.dataset.w; v[fd] = t.type === 'checkbox' ? t.checked : t.value;
        if (k === 'sec' && fd === 'series') v.size = SL.sizes(v.series)[0] || '';
        if (k === 'sec' && fd === 'shape') { const o = G.GANTRY ? G.GANTRY.sizeOptions(v.shape) : []; v.tsize = o[0] ? o[0][0] : ''; }
        if (k === 'load' && fd === 'kind' && v.kind === 'moment') v.dir = 'lz'; else if (k === 'load' && fd === 'kind' && !DIRS().some(q => q[0] === v.dir)) v.dir = 'grav';
        if (['type', 'series', 'shape', 'kind', 'on', 'grade', 'sgrade', 'size', 'tsize'].includes(fd)) winRefresh();
        else if (k === 'sec') { const pv = $('#anWPrev'); if (pv) pv.innerHTML = secSVG(wsecObj(v)) + wsecProps(v); }
        return true;
      }
      if (t.dataset.def) { const k = t.dataset.def; if (k === 'sec') A.lastSec = t.value; else if (k === 'mat') A.lastMat = t.value; else A.lastType = t.value; return true; }
      if (t.dataset.cb) { const cb = A.cb, k = t.dataset.cb; if (k === 'name' || k === 'type') cb[k] = t.value; else { cb.rows[+t.dataset.i][k] = k === 'f' ? t.value : t.value; const pv = document.querySelector('.an-cbprev'); if (pv) pv.textContent = cb.rows.filter(r => r.c && +r.f).map(r => f(+r.f, 2).replace(/\.?0+$/, '') + r.c).join(' + ') || '—'; } return true; }
      if (t.dataset.opt) {
        const k = t.dataset.opt;
        if (k === 'plane') { snap(true); A.model.plane = t.value; changed(false); return true; }
        A.opt[k] = t.type === 'checkbox' ? t.checked : +t.value; persist(); if (k !== 'snap') { A.ver++; updCounts(); } return true;
      }
      if (t.id === 'an-ss') { A.ss = t.value; const z = $('#an-sz'); if (z) z.innerHTML = (SL.LIB[t.value] ? SL.sizes(t.value).map(q => [q, q]) : (G.GANTRY ? G.GANTRY.sizeOptions(t.value) : [])).map(o => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join(''); return true; }
      if (t.id === 'an-mlk') { A.mlk = t.value; sideRefresh(); return true; }
      if (t.id === 'an-src') { A.src = t.value; drawAll(); return true; }
      if (t.id === 'an-lcase') { A.lcase = t.value; A.loadsOn = true; syncLshow(); redraw(); sideRefresh(); return true; }
      if (t.id === 'an-lshow') { if (t.value) { A.lcase = t.value; A.loadsOn = true; } else A.loadsOn = false; redraw(); if (['case', 'load'].includes(A.step)) sideRefresh(); return true; }
      if (t.id === 'an-selby') { const v = t.value; t.value = ''; if (v) selectBy(v); return true; }
      if (t.id === 'an-modesel') { A.mode = +t.value; redraw(); return true; }
      if (t.id === 'an-scale') { A.dscale = +t.value; redraw(); return true; }
      if (t.id === 'an-labels') { A.labels = t.checked; redraw(); return true; }
      if (t.id === 'an-cut') { A.cut = t.value === 'all' ? 'all' : +t.value; A.cam.k = null; A.sel = { n: [], m: [] }; redraw(); sideRefresh(); return true; }
      if (t.id === 'an-file') {
        const fl = t.files[0]; if (!fl) return true;
        fl.text().then(txt => { try { const j = JSON.parse(txt), mm = migrate(j.model || j); if (!mm || !mm.nodes || !mm.members) throw 0; snap(true); A.model = Object.assign({ loads: [], combos: [], cases: [], sections: [], materials: [], std: 'AS' }, mm); if (j.opt) A.opt = Object.assign(A.opt, j.opt); afterNewModel(); toast(T('Model opened', 'เปิดแบบจำลองแล้ว'), 'ok'); } catch (e) { toast(T('That file is not a StructCap model.', 'ไฟล์นี้ไม่ใช่แบบจำลอง StructCap'), 'bad'); } });
        return true;
      }
      if (!t.dataset.tb) return false;
      const tb = t.dataset.tb, i = +t.dataset.i, fd = t.dataset.f, row = A.model[tb] && A.model[tb][i]; if (!row) return true;
      snap();
      const v = t.type === 'checkbox' ? t.checked : t.value;
      let side = false;
      if (fd.startsWith('f.')) { row.f = row.f || {}; const k = fd.slice(2); if (v === '' || +v === 0) delete row.f[k]; else row.f[k] = +v; }
      else if (fd === 'id') { const nid = String(v).trim(); if (!nid || A.model[tb].some((o, k) => k !== i && o.id === nid)) { t.classList.add('bad'); return true; } t.classList.remove('bad'); renameRefs(tb, row.id, nid); const ok = { materials: 'mat', sections: 'sec', combos: 'combo' }[tb]; if (ok && OPEN[ok] === String(row.id)) OPEN[ok] = nid; row.id = nid; }
      else if (['x', 'y', 'z', 'b', 'h', 'd', 'bf', 'tf', 'tw', 'D', 'A', 'I', 'Iz', 'Iy', 'J', 'E', 'nu', 'rho', 'Fx', 'Fy', 'Fz', 'Mx', 'My', 'Mz', 'w1', 'P', 'M', 'beta'].includes(fd)) row[fd] = v === '' ? '' : +v;
      else row[fd] = v;
      if (tb === 'nodes' && fd === 'sup' && v === 'custom' && !row.fix) row.fix = F.SUPS.pin.slice();
      if (tb === 'sections' && fd === 'shape') { const o = G.GANTRY ? G.GANTRY.sizeOptions(v) : []; row.size = o[0] ? o[0][0] : ''; side = true; }
      if (tb === 'sections' && fd === 'series') { row.size = SL.sizes(v)[0] || ''; row.name = row.size; side = true; }
      if (tb === 'sections' && fd === 'size' && row.type === 'std') row.name = v;
      if (tb === 'sections' && fd === 'type') { const ser0 = stdInfo(A.model.std).series[0]; Object.assign(row, { rect: { b: 300, h: 500 }, I: { d: 356, bf: 171, tf: 11.5, tw: 7.3 }, circ: { D: 400 }, std: { series: ser0, size: SL.sizes(ser0)[0] }, tube: { shape: 'SHS', size: (G.GANTRY ? G.GANTRY.sizeOptions('SHS')[0][0] : '') }, user: { A: 10000, Iz: 100e6, Iy: 50e6, J: 20e6 } }[v]); side = true; }
      if (tb === 'loads' && fd === 'kind') { Object.assign(row, v === 'udl' ? { w1: row.w1 || 5, dir: row.dir && !/^l?[xyz]$/.test(row.dir) || /^l[yz]$/.test(row.dir) ? row.dir : 'grav' } : v === 'point' ? { P: row.P || 10, a: row.a || 1, dir: GDIR[row.dir] || /^l[yz]$/.test(row.dir) ? row.dir : 'grav' } : { M: row.M || 10, a: row.a || 1, dir: 'lz' }); side = true; }
      if (tb === 'members' && (fd === 'type' || fd === 'i' || fd === 'j')) side = true;
      if ((tb === 'materials' || tb === 'sections') && ['E', 'nu', 'rho', 'b', 'h', 'D', 'd', 'bf', 'tf', 'tw', 'A', 'Iz', 'Iy', 'J'].includes(fd)) { const li = t.closest('.an-li'); if (li) { const sb = li.querySelector('.an-lis'); if (sb && tb === 'materials') sb.textContent = (row.name || '') + ' · E ' + f(+row.E || 0, 0); } }
      changed(side);
      return true;
    }
    function afterNewModel() { A.sel = { n: [], m: [] }; A.src = null; A.draw = null; A.cut = 'all'; A.cb = null; A.res = null; A.err = null; A.lcase = (A.model.cases[0] || {}).id || ''; setView(A.model.plane === 'XZ' ? 'xz' : '3d'); A.ver++; persist(); if (A.step === 'res' || A.step === 'run') A.step = 'node'; ctx.render(); }
    function doRun() {
      const ok = run();
      if (ok) { A.step = 'res'; if (!A.rview || (A.rview === 'mode' && !A.res.modal) || (A.rview === 'buck' && !A.res.buckling)) A.rview = 'Mz'; toast(T('Analysis complete — ', 'วิเคราะห์เสร็จ — ') + A.res.ms + ' ms', 'ok'); }
      else { A.step = 'run'; toast(A.err, 'bad'); }
      ctx.render();
    }
    function onClick(a, b) {
      const m = A.model;
      if (a === 'an-step') { const s0 = b.dataset.s; A.step = A.step === s0 && b.classList.contains('an-th') ? null : s0; if (A.step === 'load' && !m.cases.some(c => c.id === A.lcase)) A.lcase = (m.cases[0] || {}).id || ''; if (A.step === 'load' || A.step === 'case') A.loadsOn = true; ctx.render(); }
      else if (a === 'an-std') { const k = b.dataset.k; if (k === m.std) return true; snap(true); m.std = k; A.ss = null; changed(true); ctx.render(); toast(T('Design standard: ', 'มาตรฐาน: ') + T(stdInfo(k).name[0], stdInfo(k).name[1]) + T(' — new materials, sections and combinations follow it.', ' — วัสดุ หน้าตัด และการรวมน้ำหนักใหม่จะเป็นไปตามมาตรฐานนี้'), 'ok'); }
      else if (a === 'an-rtab') { A.rtab = b.dataset.t; const r = $('#anRes'); if (r) r.innerHTML = resultsHTML(); }
      else if (a === 'an-rv') { A.rview = b.dataset.v; if (A.rview === 'buck' && !(A.src || '').startsWith('combo:')) { const c = m.combos.find(q => q.type === 'ULS'); if (c) A.src = 'combo:' + c.id; } sideRefresh(); drawAll(); }
      else if (a === 'an-disp') { A.solid = b.dataset.d === 'solid'; document.querySelectorAll('.an-tools [data-act=an-disp]').forEach(x => x.setAttribute('aria-pressed', (x.dataset.d === 'solid') === A.solid)); if (A.solid && A.step === 'res') toast(T('Solid view shows in model mode; results are drawn on the centre-lines.', 'มุมมองทรงตันแสดงในโหมดแบบจำลอง ผลลัพธ์แสดงบนเส้นแกน'), ''); redraw(); }
      else if (a === 'an-lpick') { A.lcase = b.dataset.c; A.loadsOn = true; syncLshow(); sideRefresh(); redraw(); }
      else if (a === 'an-llist') { A.llist = !A.llist; sideRefresh(); }
      else if (a === 'an-tool') { A.tool = b.dataset.t === 'box' ? 'select' : b.dataset.t; const hb = $('#anHint'); if (hb) hb.textContent = hintBar(); A.draw = null; document.querySelectorAll('.an-tools [data-act=an-tool]').forEach(x => x.setAttribute('aria-pressed', x.dataset.t === A.tool)); if ((A.tool === 'node' || A.tool === 'member') && A.cam.v === '3d') toast(T('Tip: in Plan or an Elevation you can click empty grid points to create nodes.', 'เคล็ดลับ: ในแปลนหรือรูปด้าน คลิกตำแหน่งว่างเพื่อสร้างจุดต่อ'), ''); if (b.closest('.an-panel')) sideRefresh(); redraw(); }
      else if (a === 'an-cam') { setView(b.dataset.v); ctx.render(); }
      else if (a === 'an-fit') { A.cam.k = null; redraw(); }
      else if (a === 'an-undo') undo(false);
      else if (a === 'an-redo') undo(true);
      else if (a === 'an-run') doRun();
      else if (a === 'an-clear') { A.sel = { n: [], m: [] }; selChanged(); }
      else if (a === 'an-selbase') { const z0 = Math.min(...m.nodes.map(n => +n.z || 0)); A.sel = { n: m.nodes.filter(n => Math.abs((+n.z || 0) - z0) < 1e-4).map(n => n.id), m: [] }; selChanged(); }
      else if (a === 'an-pickn') { A.sel = { n: [b.dataset.n], m: [] }; selChanged(); }
      else if (a === 'an-delsel') deleteSel();
      else if (a === 'an-open') { const k = b.dataset.k, id = b.dataset.id; OPEN[k] = OPEN[k] === id ? null : id; if (k === 'load') { const l = m.loads[+id]; if (l && OPEN[k] !== null) A.sel = l.kind === 'node' ? { n: [l.node], m: [] } : { n: [], m: [l.member] }; redraw(); } sideRefresh(); }
      else if (a === 'an-gocase') { A.lcase = b.dataset.c; A.step = 'load'; A.loadsOn = true; ctx.render(); }
      else if (a === 'an-add') { snap(true); addRow(b.dataset.tb); changed(true); }
      else if (a === 'an-del') { snap(true); const tb = b.dataset.tb, i = +b.dataset.i, row = m[tb][i]; m[tb].splice(i, 1); if (tb === 'nodes') { m.members = m.members.filter(x => x.i !== row.id && x.j !== row.id); m.loads = m.loads.filter(l => l.node !== row.id); } if (tb === 'members') m.loads = m.loads.filter(l => l.member !== row.id); if (tb === 'cases') { m.loads = m.loads.filter(l => l.case !== row.id); m.combos.forEach(c => { if (c.f) delete c.f[row.id]; }); } A.sel = { n: A.sel.n.filter(id => m.nodes.some(q => q.id === id)), m: A.sel.m.filter(id => m.members.some(q => q.id === id)) }; changed(true); }
      else if (a === 'an-mat') { snap(true); const mt = clone(MAT[b.dataset.m]); let id = mt.id, k = 2; while (m.materials.some(q => q.id === id)) id = mt.id + k++; mt.id = id; m.materials.push(mt); changed(true); }
      else if (a === 'an-addconc' || a === 'an-addsteel') { const g = a === 'an-addconc' ? concMat(m.std, $('#an-cg').value) : steelMat(m.std, $('#an-sg').value); if (m.materials.some(q => q.id === g.id)) { toast(T(g.id + ' is already in the list.', g.id + ' มีอยู่แล้ว'), ''); return true; } snap(true); m.materials.push(g); A.lastMat = g.id; changed(true); toast(T('Added ', 'เพิ่ม ') + g.name, 'ok'); }
      else if (a === 'an-addrect' || a === 'an-addcirc' || a === 'an-addstd') {
        let s0;
        if (a === 'an-addrect') { const bb = +$('#an-sb').value || 300, hh = +$('#an-sh').value || 600; s0 = { id: 'R' + bb + 'x' + hh, name: bb + '×' + hh, type: 'rect', b: bb, h: hh }; }
        else if (a === 'an-addcirc') { const D0 = +$('#an-sd').value || 400; s0 = { id: 'D' + D0, name: 'Ø' + D0, type: 'circ', D: D0 }; }
        else { const sr = $('#an-ss').value, sz = $('#an-sz').value; if (!sz) return true; s0 = SL.LIB[sr] ? stdSec(sz.replace(/\s+/g, ''), sr, sz) : { id: sr + ' ' + sz, name: sr + ' ' + sz.replace(/x/g, '×'), type: 'tube', shape: sr, size: sz }; }
        if (m.sections.some(q => q.id === s0.id)) { toast(T(s0.id + ' is already in the list.', s0.id + ' มีอยู่แล้ว'), ''); return true; }
        snap(true); m.sections.push(s0); A.lastSec = s0.id; changed(true); toast(T('Added section ', 'เพิ่มหน้าตัด ') + s0.id, 'ok');
      }
      else if (a === 'an-gen') { snap(true); const el = $('#an-code'), code = b.dataset.code || (el ? el.value : stdInfo(m.std).combo); m.code = code; m.combos = preset(code, m.cases); A.src = null; changed(true); toast(T(m.combos.length + ' combinations generated', 'สร้างการรวมน้ำหนัก ' + m.combos.length + ' ชุด'), 'ok'); }
      else if (a === 'an-cbadd') { const used = A.cb.rows.map(r => r.c), c = m.cases.find(q => !used.includes(q.id)) || m.cases[0]; A.cb.rows.push({ c: c ? c.id : '', f: 1 }); sideRefresh(); winRefresh(); }
      else if (a === 'an-cbdel') { A.cb.rows.splice(+b.dataset.i, 1); sideRefresh(); winRefresh(); }
      else if (a === 'an-cbgo') {
        const cb = A.cb, fct = {}; cb.rows.forEach(r => { if (r.c && +r.f) fct[r.c] = r4((fct[r.c] || 0) + +r.f); });
        if (!Object.keys(fct).length) { toast(T('Add at least one load case with a factor.', 'เพิ่มกรณีน้ำหนักพร้อมตัวคูณอย่างน้อยหนึ่งกรณี'), 'bad'); return true; }
        snap(true); const id = nextId(m.combos, 'C'), name = cb.name.trim() || Object.entries(fct).map(([c, k]) => f(k, 2).replace(/\.?0+$/, '') + c).join(' + ');
        m.combos.push({ id, name, type: cb.type, f: fct }); A.cb = { name: '', type: cb.type, rows: cb.rows.map(r => Object.assign({}, r)) }; changed(true); winRefresh(); toast(T('Combination ' + id + ' added', 'เพิ่มการรวมน้ำหนัก ' + id + ' แล้ว'), 'ok');
      }
      else if (a === 'an-tplopen') { A.tplOpen = true; ctx.render(); }
      else if (a === 'an-tplclose') { A.tplOpen = false; ctx.render(); }
      else if (a === 'an-win') { openWin(b.dataset.k); }
      else if (a === 'an-wclose') { A.win = null; winRefresh(); }
      else if (a === 'an-wadd') winAdd();
      else if (a === 'an-wset') { wdef(A.win.k)[b.dataset.f] = b.dataset.v; winRefresh(); }
      else if (a === 'an-drawer') { A.drawerMin = !A.drawerMin; drawAll(); }
      else if (a === 'an-tpl') { A.tpl = b.dataset.t; A.tplP = null; ctx.render(); }
      else if (a === 'an-tplgo') { const p = Object.assign({}, TPL[A.tpl].p, A.tplP || {}); try { const nm = build(A.tpl, p, m.std); snap(true); A.model = nm; A.tplOpen = false; afterNewModel(); toast(T('Model created', 'สร้างแบบจำลองแล้ว'), 'ok'); } catch (e) { toast(T('Check the template values.', 'ตรวจสอบค่าที่กรอก'), 'bad'); } }
      else if (a === 'an-save') { const blob = new Blob([JSON.stringify({ app: 'StructCap', kind: 'frame3d', version: 4, model: m, opt: A.opt }, null, 1)], { type: 'application/json' }); ctx.saveFile((m.name || 'model').replace(/[^\w\-]+/g, '_') + '_' + today() + '.json', blob); }
      else if (a === 'an-pick') { A.sel = { n: [], m: [b.dataset.m] }; selChanged(); const r = $('#anRes'); if (r && fresh()) r.innerHTML = resultsHTML(); const mm = $('#anMember'); if (mm && mm.innerHTML) mm.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
      else if (a === 'an-mode') { A.mode = +b.dataset.k; A.rview = 'mode'; sideRefresh(); drawAll(); }
      else if (a === 'an-buck') { A.src = 'combo:' + b.dataset.c; A.rview = 'buck'; sideRefresh(); drawAll(); }
      else if (a === 'an-send') sendToDesign(b.dataset.e);
      else if (a === 'an-report') { if (!pro()) { toast(T('The analysis report is a Pro feature.', 'รายงานการวิเคราะห์สำหรับสมาชิก Pro'), 'bad'); return true; } if (!fresh() && !run()) { toast(A.err, 'bad'); return true; } renderReport(); const w = $('#reportWrap'); if (w) w.scrollIntoView({ behavior: 'smooth' }); }
      else if (a === 'an-addnode') { const p = ['an-nx', 'an-ny', 'an-nz'].map(id => +($('#' + id).value) || 0); snap(true); const id = ensureNode(p); A.sel = { n: [id], m: [] }; changed(true); redraw(true); }
      else if (a === 'an-move') { const dd = ['an-mx', 'an-my', 'an-mz'].map(id => +($('#' + id).value) || 0); snap(true); const nd = nodeMap(); A.sel.n.forEach(id => { const n = nd[id]; n.x = r4((+n.x || 0) + dd[0]); n.y = r4((+n.y || 0) + dd[1]); n.z = r4((+n.z || 0) + dd[2]); }); changed(true); redraw(true); }
      else if (a === 'an-nl') { const cs = A.lcase, o = {}; ['Fx', 'Fy', 'Fz', 'Mx', 'My', 'Mz'].forEach(q => { o[q] = +($('#an-n' + q).value) || 0; }); if (!Object.values(o).some(Boolean)) { toast(T('Enter a force or moment.', 'ใส่ค่าแรงหรือโมเมนต์'), 'bad'); return true; } snap(true); A.sel.n.forEach(id => m.loads.push(nload(cs, id, o))); changed(true); toast(T('Load added to ' + A.sel.n.length + ' node(s) in ' + cs, 'เพิ่มแรงให้ ' + A.sel.n.length + ' จุดต่อ ในกรณี ' + cs), 'ok'); }
      else if (a === 'an-ml') {
        const cs = A.lcase, kd = $('#an-mlk').value, dir = $('#an-mld').value, v = +$('#an-mlv').value || 0, v2 = $('#an-mlv2') ? $('#an-mlv2').value : '', aa = $('#an-mla').value, bb = $('#an-mlb') ? $('#an-mlb').value : '';
        if (!v && !(+v2)) { toast(T('Enter a load value.', 'ใส่ค่าแรง'), 'bad'); return true; }
        snap(true); const nd = nodeMap();
        A.sel.m.forEach(id => { const q = m.members.find(z => z.id === id); if (!q) return; const L = Math.hypot(...sub(P3(nd[q.j]), P3(nd[q.i]))); if (kd === 'udl') m.loads.push({ case: cs, kind: 'udl', member: id, dir, w1: v, w2: v2 === '' ? '' : +v2, a: aa === '' ? '' : +aa, b: bb === '' ? '' : +bb }); else if (kd === 'point') m.loads.push({ case: cs, kind: 'point', member: id, dir, P: v, a: aa === '' ? r4(L / 2) : +aa }); else m.loads.push({ case: cs, kind: 'moment', member: id, dir, M: v, a: aa === '' ? r4(L / 2) : +aa }); });
        changed(true); toast(T('Load added to ' + A.sel.m.length + ' element(s) in ' + cs, 'เพิ่มแรงให้ ' + A.sel.m.length + ' ชิ้นส่วน ในกรณี ' + cs), 'ok');
      }
      else if (a === 'an-mlclear') { const cs = A.lcase, sm = new Set(A.sel.m), sn = new Set(A.sel.n), n0 = m.loads.length; snap(true); m.loads = m.loads.filter(l => !(l.case === cs && (l.kind === 'node' ? sn.has(l.node) : sm.has(l.member)))); changed(true); toast(T((n0 - m.loads.length) + ' load(s) removed', 'ลบแรง ' + (n0 - m.loads.length) + ' รายการ'), 'ok'); }
      else if (a === 'an-split') { const n = Math.max(2, Math.min(20, +$('#an-splitn').value | 0)); snap(true); const segs = splitMember(A.sel.m[0], n); A.sel = { n: [], m: segs }; changed(true); }
      else if (a === 'an-replicate') { const dd = ['an-rx', 'an-ry', 'an-rz'].map(id => +($('#' + id).value) || 0), n = Math.max(1, Math.min(50, +$('#an-rn').value | 0)), c = $('#an-rc').checked, l = $('#an-rl').checked; A.rep = dd.concat([n, c, l]); A.repOpen = true; if (!dd.some(Boolean)) { toast(T('Enter a distance to copy by.', 'ใส่ระยะที่ต้องการคัดลอก'), 'bad'); return true; } replicate(dd, n, c, l); redraw(true); }
      else return false;
      return true;
    }

    // ------------------------------------------------------------------ report
    function renderReport() {
      const m = A.model, r = A.res; if (!r) { toast(A.err || T('Nothing to report yet.', 'ยังไม่มีผลลัพธ์'), 'bad'); return; }
      const Mt = S.meta, keep = { src: A.src };
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
      A.src = keep.src;
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
