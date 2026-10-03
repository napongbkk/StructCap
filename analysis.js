/* StructCap Analysis — 3D model editor (click to select and edit in the 3D view), load cases and combinations,
   results (diagrams, deflected shape, reactions, modes, buckling) and report.
   Engine: frame.js (FRAME.analyse). app.js creates this module with its helpers (ctx). */
(function (G) {
  'use strict';
  G.SC_ANALYSIS_UI = function (ctx) {
    const { T, esc, f, $, S, toast, isPro, COPY, logoMark, today } = ctx;
    const MODE = ctx.mode === 'bridge' ? 'bridge' : ctx.mode === 'building' ? 'building' : 'frame', VIEW = ctx.viewName || 'analysis', BRG = MODE === 'bridge', BLD = MODE === 'building', BR = G.BRIDGE, BD = G.BUILDING;
    const F = G.FRAME, KEY = BRG ? 'structcap.bridge.v1' : BLD ? 'structcap.building.v1' : 'structcap.analysis.v3', OLD = BRG ? 'structcap.bridge.v0' : BLD ? 'structcap.building.v0' : 'structcap.analysis.v2', FREE_MEMBERS = 80, HEAVY_PTS = 1500;
    const lsGet = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
    const lsSet = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { } };
    const clone = o => JSON.parse(JSON.stringify(o));
    // ---- display units: the model is stored in kN, m, °C; inputs and outputs are converted
    const UF = { kN: 1, N: 1e-3, kgf: 0.00980665, tf: 9.80665, kip: 4.4482216 }, UL = { m: 1, cm: 0.01, mm: 0.001, ft: 0.3048, in: 0.0254 }, UT = { C: 1, F: 5 / 9 };
    const UPRE = { SI: { F: 'kN', L: 'm', T: 'C' }, SImm: { F: 'N', L: 'mm', T: 'C' }, MKS: { F: 'tf', L: 'm', T: 'C' }, MKScm: { F: 'kgf', L: 'cm', T: 'C' }, US: { F: 'kip', L: 'ft', T: 'F' } };
    const UU = () => { try { return (A.opt && A.opt.u) || UPRE.SI; } catch (e) { return UPRE.SI; } };
    const dU = () => (UU().L === 'ft' || UU().L === 'in' ? ['in', 0.0254] : ['mm', 1e-3]);
    const ufac = q => { const u = UU(), Fq = UF[u.F] || 1, Lq = UL[u.L] || 1; return q === 'L' ? Lq : q === 'F' ? Fq : q === 'w' || q === 'kL' ? Fq / Lq : q === 'M' || q === 'kR' ? Fq * Lq : q === 'd' ? dU()[1] : q === 'T' ? UT[u.T] || 1 : q === 'al' ? 1 / (UT[u.T] || 1) : q === 'g' ? Fq / (Lq * Lq * Lq) : q === 'p' ? Fq / (Lq * Lq) : 1; };
    const ulab = q => { const u = UU(), M = u.F === 'kN' && u.L === 'm' ? 'kNm' : u.F + '·' + u.L; return { L: u.L, F: u.F, w: u.F + '/' + u.L, kL: u.F + '/' + u.L, M, kR: M + '/rad', d: dU()[0], T: '°' + u.T, al: '×10⁻⁶/°' + u.T, g: u.F + '/' + u.L + '³', p: u.F === 'kN' && u.L === 'm' ? 'kPa' : u.F + '/' + u.L + '²' }[q] || ''; };
    const toU = (v, q) => v / ufac(q), frU = (v, q) => v * ufac(q);
    const uv = (v, q) => (v === '' || v == null ? v : Number(toU(+v, q).toPrecision(10)));
    const udp = q => { const u = UU(); if (q === 'F') return { N: 0, kgf: 0 }[u.F] === 0 ? 0 : 2; if (q === 'M' || q === 'w') return u.F === 'N' || u.F === 'kgf' ? 0 : 2; if (q === 'L') return { m: 3, cm: 1, mm: 0, ft: 3, in: 2 }[u.L]; if (q === 'd') return 2; return 2; };
    const fu = (v, q, d) => fx(toU(v, q), d === undefined ? udp(q) : d);
    const ul = q => ' ' + ulab(q);
    const FQ = { nodes: { x: 'L', y: 'L', z: 'L', kx: 'kL', ky: 'kL', kz: 'kL', krx: 'kR', kry: 'kR', krz: 'kR' }, loads: { Fx: 'F', Fy: 'F', Fz: 'F', P: 'F', Mx: 'M', My: 'M', Mz: 'M', M: 'M', w1: 'w', w2: 'w', a: 'L', b: 'L', dT: 'T', dTy: 'T', dTz: 'T' }, materials: { rho: 'g', alpha: 'al' } };
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
    const BTPL = {
      girder: { n: ['Girder deck (grillage)', 'สะพานคานหลายตัว (กริลเลจ)'], p: { spans: '25, 30, 25', ng: 5, s: 2.4, cont: 'continuous', nseg: 8, pt: 3500 } },
      box: { n: ['Box girder (spine)', 'สะพานคานกล่อง'], p: { spans: '40, 55, 40', piers: '12, 12', width: 11, nseg: 10 } },
      btruss: { n: ['Truss bridge', 'สะพานโครงถัก'], p: { span: 60, panels: 10, height: 8, width: 9, kind: 'pratt' } },
      arch: { n: ['Tied arch', 'สะพานโค้งผูก'], p: { span: 80, rise: 16, panels: 16, width: 11 } },
      cable: { n: ['Cable-stayed', 'สะพานขึงด้วยเคเบิล'], p: { main: 120, side: 60, pylon: 45, spacing: 10, width: 12 } },
      blank: { n: ['Empty bridge model', 'โมเดลสะพานว่าง'], p: {} }
    };
    const BLDTPL = {
      rc: { n: ['RC frame building', 'อาคารโครงข้อแข็ง คสล.'], p: { bx: '8, 8, 8', by: '7, 7', st: '4, 3x3.5', col: '500x500', beam: '300x600', t: 150, sdl: 1.5, ll: 3, roof: 0.25, wind: 'on' } },
      steel: { n: ['Steel frame building', 'อาคารโครงเหล็ก'], p: { bx: '9, 9, 9', by: '7.5, 7.5', st: '4.2, 2x3.8', t: 130, sdl: 1, ll: 3, roof: 0.25, wind: 'on' } },
      tower: { n: ['RC tower (10 storeys)', 'อาคารสูง คสล. (10 ชั้น)'], p: { bx: '7, 7, 7, 7', by: '7, 7, 7', st: '4.5, 9x3.3', col: '700x700', beam: '350x650', t: 200, sdl: 2, ll: 3, roof: 0.25, wind: 'on' } },
      blank: { n: ['Grids and stories only', 'กริดและชั้นเท่านั้น'], p: { bx: '6, 6, 6', by: '6, 6', st: '3x3.5', t: 150, sdl: 1.5, ll: 3, wind: 'on' } }
    };
    if (BRG) { Object.keys(TPL).forEach(k => { delete TPL[k]; }); Object.assign(TPL, BTPL); }
    if (BLD) { Object.keys(TPL).forEach(k => { delete TPL[k]; }); Object.assign(TPL, BLDTPL); }
    const blankModel = (std, name, plane, secs, mats, cases) => ({ std, name, plane: plane || '', nodes: [], members: [], sections: secs, materials: mats, cases, loads: [], combos: [], code: stdInfo(std).combo });
    const GQ = () => [CASE('G', 'G', true, 'Dead', 'น้ำหนักบรรทุกคงที่'), CASE('Q', 'Q', false, 'Live', 'น้ำหนักบรรทุกจร')];
    const udl = (cs, member, w, dir) => ({ case: cs, kind: 'udl', member, dir: dir || 'grav', w1: r4(w), w2: '', a: '', b: '' });
    const nload = (cs, node, o) => Object.assign({ case: cs, kind: 'node', node, Fx: 0, Fy: 0, Fz: 0, Mx: 0, My: 0, Mz: 0 }, o);
    function build(kind, p, std) {
      if (BRG && BTPL[kind]) return buildBridge(kind, p, std);
      if (BLD && BLDTPL[kind]) return buildBuilding(kind, p, std);
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

    // ================================================================== bridge templates (bridge mode)
    const TCODE = { AS: 'AS', EC: 'EN', TH: 'HL93' }, LANEW = { AS: 3.2, EN: 3.0, HL93: 3.6, HS20: 3.6, USER: 3.5 };
    const concAt = (std, fc) => { const d = stdInfo(std), g = d.conc.filter(q => q[2] >= fc)[0] || d.conc[d.conc.length - 1]; return concMat(std, g[0]); };
    const numL = s => String(s).split(/[,\s]+/).map(Number).filter(v => v > 0);
    function bridgeDefaults(m, std, o) {
      const code = TCODE[std] || 'AS', lw = LANEW[code], pt = m.cases.some(c => c.id === 'PT');
      const MLC = { AS: { id: 'ML', name: T('M1600 / S1600 (AS 5100.2)', 'M1600 / S1600 (AS 5100.2)'), code: 'AS', veh: ['M1600', 'S1600'] }, EN: { id: 'ML', name: T('Load Model 1 (EN 1991-2)', 'Load Model 1 (EN 1991-2)'), code: 'EN', veh: ['LM1'] }, HL93: { id: 'ML', name: T('HL-93 truck / tandem + lane', 'HL-93 รถบรรทุก / เพลาคู่ + น้ำหนักช่องจราจร'), code: 'HL93', veh: ['HL93T', 'HL93D'] } }[code];
      const F0 = { AS: [1.2, 1.4, 1.8], EN: [1.35, 1.35, 1.35], HL93: [1.25, 1.5, 1.75] }[code];
      const f = (g, s2) => { const o2 = { G: g, SDL: s2 }; if (pt) o2.PT = 1; return o2; };
      m.bridge = Object.assign({ kind: o.kind, lanes: o.lanes || [], vehicles: [], mlc: [Object.assign({ lanes: [], dla: '' }, MLC)], stages: o.stages || [],
        bcombos: [{ id: 'BU1', name: T('ULS — ', 'ULS — ') + F0[0] + 'G + ' + F0[1] + 'SDL + ' + F0[2] + ' traffic', type: 'ULS', f: f(F0[0], F0[1]), ml: { ML: F0[2] } }, { id: 'BS1', name: T('SLS — G + SDL + traffic', 'SLS — G + SDL + จราจร'), type: 'SLS', f: f(1, 1), ml: { ML: 1 } }] }, o.extra || {});
      m.combos = preset(m.code, m.cases);
      return lw;
    }
    // lanes across a deck of girder lines at y = ys[] (members per line in order)
    function lanesOver(ys, lines, width, lw) {
      const nL = Math.max(1, Math.min(6, Math.floor(width / lw))), out = [];
      for (let k = 0; k < nL; k++) {
        const yc = (k - (nL - 1) / 2) * lw;
        if (ys.length === 1) { out.push({ id: 'L' + (k + 1), name: T('Lane ', 'ช่องจราจร ') + (k + 1), a: lines[0].slice(), b: null, w: 0, y: yc }); continue; }
        let g = 0; while (g < ys.length - 2 && ys[g + 1] < yc) g++;
        const w = Math.max(0, Math.min(1, (yc - ys[g]) / (ys[g + 1] - ys[g])));
        out.push({ id: 'L' + (k + 1), name: T('Lane ', 'ช่องจราจร ') + (k + 1), a: lines[g].slice(), b: lines[g + 1].slice(), w: r4(w), y: r4(yc) });
      }
      return out;
    }
    const parab = (Ls, ec) => x => 4 * ec * x * (Ls - x) / (Ls * Ls); // tendon eccentricity along a span (mm), zero at the supports
    function buildBridge(kind, p, std) {
      std = STDS.includes(std) ? std : 'AS';
      const D = DEFS[std], SM = steelMat(std, D.steel), m = blankModel(std, '', '', [], [], [CASE('G', 'G', true, 'Dead load (self-weight)', 'น้ำหนักบรรทุกคงที่ (น้ำหนักตัวเอง)'), CASE('SDL', 'G', false, 'Superimposed dead (surfacing, barriers)', 'น้ำหนักบรรทุกคงที่เพิ่มเติม (ผิวทาง ราวกันตก)')]);
      const code = TCODE[std] || 'AS', lw = LANEW[code], nd = (id, x, y, z, sup, fix) => { const n = { id, x: r4(x), y: r4(y), z: r4(z), sup: sup || 'free' }; if (fix) { n.sup = 'custom'; n.fix = fix; } m.nodes.push(n); return id; };
      const mb = (id, i, j, sec, mat, o) => { m.members.push(Object.assign({ id, i, j, sec, mat, type: 'frame', relI: false, relJ: false, beta: 0 }, o || {})); return id; };
      const udl = (cs, member, w) => m.loads.push({ case: cs, kind: 'udl', member, dir: 'grav', w1: r4(w), w2: '', a: '', b: '' });
      if (kind === 'girder') {
        const spans = numL(p.spans), ng = Math.max(2, Math.min(12, p.ng | 0)), s = +p.s || 2.4, ns = Math.max(4, Math.min(20, p.nseg | 0)), cont = p.cont !== 'simple';
        const CG = concAt(std, 40), CS = Object.assign({}, concAt(std, 32), { id: 'DECK', name: T('Deck slab (weight carried by the girders)', 'พื้นสะพาน (น้ำหนักรวมในคาน)'), rho: 0 });
        const avg = spans.reduce((a, b) => a + b, 0) / spans.length / ns;
        m.materials = [CG, CS]; m.sections = [{ id: 'PSC', name: T('PSC I-girder + slab (composite)', 'คานอัดแรง + พื้น (ส่วนประกอบ)'), type: 'user', A: 900000, Iz: 4.2e11, Iy: 4.0e10, J: 2.5e10, dd: 1900, ww: s * 1000 }, { id: 'SLAB', name: T('Deck slab strip', 'แถบพื้นสะพาน'), type: 'rect', b: r4(avg * 1000), h: 220 }, { id: 'DIA', name: T('Diaphragm 400×1500', 'คานขวาง 400×1500'), type: 'rect', b: 400, h: 1500 }];
        if (+p.pt > 0) m.cases.push(CASE('PT', 'G', false, 'Prestress (after losses)', 'แรงอัดล่วงหน้า (หลังสูญเสีย)'));
        m.cases.push(CASE('TG', 'O', false, 'Temperature gradient (top +10 °C)', 'ผลต่างอุณหภูมิ (ผิวบน +10 °C)'));
        const xs = [0], sup = [0], spanOf = [], xa = []; spans.forEach((L, j) => { const x0 = xs[xs.length - 1]; for (let k = 1; k <= ns; k++) { xs.push(r4(x0 + L * k / ns)); spanOf.push(j); xa.push(x0); } sup.push(xs.length - 1); });
        const ys = Array.from({ length: ng }, (_, g) => r4((g - (ng - 1) / 2) * s)), gm = Math.floor((ng - 1) / 2), lines = [];
        ys.forEach((y, g) => xs.forEach((x, k) => { const si = sup.indexOf(k); nd('G' + (g + 1) + '_' + k, x, y, 0, null, si >= 0 ? [si === 0 ? 1 : 0, g === gm ? 1 : 0, 1, 0, 0, 0] : null); }));
        ys.forEach((y, g) => { const ln = []; for (let k = 0; k < xs.length - 1; k++) { const atJ = sup.includes(k + 1) && k + 1 !== xs.length - 1, atI = sup.includes(k) && k !== 0; ln.push(mb('G' + (g + 1) + '.' + (k + 1), 'G' + (g + 1) + '_' + k, 'G' + (g + 1) + '_' + (k + 1), 'PSC', CG.id, { relJ: !cont && atJ, relI: !cont && atI })); } lines.push(ln); });
        xs.forEach((x, k) => { for (let g = 0; g < ng - 1; g++) mb('T' + k + '.' + (g + 1), 'G' + (g + 1) + '_' + k, 'G' + (g + 2) + '_' + k, sup.includes(k) ? 'DIA' : 'SLAB', sup.includes(k) ? CG.id : 'DECK'); });
        lines.forEach((ln, g) => ln.forEach((id, k) => {
          udl('SDL', id, 2.5 * s + (g === 0 || g === ng - 1 ? 7 : 0));
          if (+p.pt > 0) { const Ls = spans[spanOf[k]], e = parab(Ls, 600), a0 = xs[k] - xa[k], b0 = xs[k + 1] - xa[k]; m.loads.push({ case: 'PT', kind: 'pres', member: id, P: +p.pt, e1: r4(e(a0)), em: r4(e((a0 + b0) / 2)), e2: r4(e(b0)) }); }
          m.loads.push({ case: 'TG', kind: 'temp', member: id, dT: 0, dTy: 10, dTz: 0 });
        }));
        m.name = T('Girder deck bridge ', 'สะพานคาน ') + spans.join(' + ') + ' m';
        bridgeDefaults(m, std, { kind, lanes: lanesOver(ys, lines, ng * s, lw) });
      } else if (kind === 'box') {
        const spans = numL(p.spans), hs = numL(p.piers), W = +p.width || 11, ns = Math.max(4, Math.min(24, p.nseg | 0));
        const CD = concAt(std, 50), CP = concAt(std, 40);
        m.materials = CD.id === CP.id ? [CD] : [CD, CP];
        m.sections = [{ id: 'BOX', name: T('Concrete box girder', 'คานกล่องคอนกรีต'), type: 'user', A: 6.5e6, Iz: 4.5e12, Iy: 4.0e13, J: 9.0e12, dd: 2600, ww: W * 1000 }, { id: 'PIER', name: T('Pier 2000×4000', 'ตอม่อ 2000×4000'), type: 'rect', b: 4000, h: 2000 }];
        m.cases.push(CASE('PT', 'G', false, 'Prestress (after losses)', 'แรงอัดล่วงหน้า (หลังสูญเสีย)'), CASE('TG', 'O', false, 'Temperature gradient (top +10 °C)', 'ผลต่างอุณหภูมิ (ผิวบน +10 °C)'));
        const xs = [0], sup = [0], spanOf = [], xa = []; spans.forEach((L, j) => { const x0 = xs[xs.length - 1]; for (let k = 1; k <= ns; k++) { xs.push(r4(x0 + L * k / ns)); spanOf.push(j); xa.push(x0); } sup.push(xs.length - 1); });
        xs.forEach((x, k) => nd('D' + k, x, 0, 0, null, k === 0 ? [1, 1, 1, 1, 0, 0] : k === xs.length - 1 ? [0, 1, 1, 1, 0, 0] : null));
        const deck = []; for (let k = 0; k < xs.length - 1; k++) deck.push(mb('D' + (k + 1), 'D' + k, 'D' + (k + 1), 'BOX', CD.id));
        sup.slice(1, -1).forEach((k, j) => { const h = hs[j] || hs[hs.length - 1] || 12; nd('P' + (j + 1) + 'B', xs[k], 0, -h, 'fixed'); mb('P' + (j + 1), 'P' + (j + 1) + 'B', 'D' + k, 'PIER', CP.id, { relJ: true }); });
        deck.forEach((id, k) => { udl('SDL', id, 2.5 * W + 14); const Ls = spans[spanOf[k]], e = parab(Ls, 900), a0 = xs[k] - xa[k], b0 = xs[k + 1] - xa[k]; m.loads.push({ case: 'PT', kind: 'pres', member: id, P: 40000, e1: r4(e(a0)), em: r4(e((a0 + b0) / 2)), e2: r4(e(b0)) }); m.loads.push({ case: 'TG', kind: 'temp', member: id, dT: 0, dTy: 10, dTz: 0 }); });
        const s1 = deck.filter((_, k) => spanOf[k] === 0).concat(['P1']), s2 = m.members.map(q => q.id).filter(id => !s1.includes(id));
        m.name = T('Box girder bridge ', 'สะพานคานกล่อง ') + spans.join(' + ') + ' m';
        bridgeDefaults(m, std, { kind, lanes: lanesOver([0], [deck], W, lw), stages: spans.length > 1 ? [{ id: 'S1', name: T('Span 1 and pier 1', 'ช่วงที่ 1 และตอม่อ 1'), mems: s1, cases: [], sw: true }, { id: 'S2', name: T('Remaining spans, surfacing', 'ช่วงที่เหลือ ผิวทาง'), mems: s2, cases: ['SDL'], sw: true }] : [] });
      } else if (kind === 'btruss' || kind === 'arch') {
        const arch = kind === 'arch', L = +p.span || (arch ? 80 : 60), n = Math.max(4, (p.panels | 0) + ((p.panels | 0) % 2)), H = +p.height || 8, R = +p.rise || 16, W = +p.width || 10, dx = L / n;
        m.materials = [SM];
        m.sections = arch ? [{ id: 'ARCH', name: T('Arch rib (built-up I)', 'ซี่โค้ง (I ประกอบ)'), type: 'I', d: 1000, bf: 800, tf: 40, tw: 25 }, { id: 'TIE', name: T('Tie girder', 'คานผูก'), type: 'I', d: 1600, bf: 700, tf: 40, tw: 20 }, { id: 'HANG', name: T('Hanger bar Ø110', 'สลิงแขวน Ø110'), type: 'circ', D: 110 }]
          : [{ id: 'CH', name: T('Truss chord (built-up I)', 'คอร์ดโครงถัก (I ประกอบ)'), type: 'I', d: 700, bf: 600, tf: 36, tw: 24 }, { id: 'WEB', name: T('Web member', 'ชิ้นส่วนเอว'), type: 'I', d: 450, bf: 450, tf: 22, tw: 16 }];
        m.sections.push({ id: 'XG', name: T('Cross girder', 'คานขวาง'), type: 'I', d: 1200, bf: 450, tf: 30, tw: 16 }, { id: 'STR', name: T('Stringer', 'คานตามยาว'), type: 'I', d: 700, bf: 300, tf: 20, tw: 12 }, { id: 'BR', name: T('Bracing', 'ค้ำยัน'), type: 'I', d: 300, bf: 300, tf: 16, tw: 10 });
        const nL = Math.max(1, Math.min(4, Math.floor((W - 1) / lw))), sy = Array.from({ length: nL }, (_, k) => r4((k - (nL - 1) / 2) * lw)), yl = -W / 2, yr = W / 2;
        const zA = x => 4 * R * x * (L - x) / (L * L);
        for (let k = 0; k <= n; k++) {
          const x = k * dx, end = k === 0 || k === n;
          nd('BL' + k, x, yl, 0, null, k === 0 ? [1, 1, 1, 0, 0, 0] : k === n ? [0, 1, 1, 0, 0, 0] : null); nd('BR' + k, x, yr, 0, null, k === 0 ? [1, 0, 1, 0, 0, 0] : k === n ? [0, 0, 1, 0, 0, 0] : null);
          sy.forEach((y, j) => nd('S' + (j + 1) + '_' + k, x, y, 0));
          if (!end) { nd('TL' + k, x, yl, arch ? zA(x) : H); nd('TR' + k, x, yr, arch ? zA(x) : H); }
          // cross girder split at the stringers
          const pts = ['BL' + k].concat(sy.map((_, j) => 'S' + (j + 1) + '_' + k), ['BR' + k]); for (let j = 0; j < pts.length - 1; j++) mb('XG' + k + '.' + (j + 1), pts[j], pts[j + 1], 'XG', SM.id);
        }
        const lines = sy.map(() => []);
        for (let k = 0; k < n; k++) {
          ['L', 'R'].forEach(sd => mb((arch ? 'TI' : 'BC') + sd + (k + 1), 'B' + sd + k, 'B' + sd + (k + 1), arch ? 'TIE' : 'CH', SM.id));
          sy.forEach((_, j) => lines[j].push(mb('ST' + (j + 1) + '.' + (k + 1), 'S' + (j + 1) + '_' + k, 'S' + (j + 1) + '_' + (k + 1), 'STR', SM.id)));
          mb('BXa' + (k + 1), 'BL' + k, 'BR' + (k + 1), 'BR', SM.id, { type: 'truss' }); mb('BXb' + (k + 1), 'BR' + k, 'BL' + (k + 1), 'BR', SM.id, { type: 'truss' });
        }
        ['L', 'R'].forEach(sd => {
          const top = k => (k === 0 || k === n ? 'B' + sd + k : 'T' + sd + k);
          for (let k = 0; k < n; k++) { if (arch || (k > 0 && k < n - 1)) mb((arch ? 'AR' : 'TC') + sd + (k + 1), top(k), top(k + 1), arch ? 'ARCH' : 'CH', SM.id); }
          if (!arch) { mb('EP' + sd + '0', 'B' + sd + '0', 'T' + sd + '1', 'CH', SM.id); mb('EP' + sd + n, 'B' + sd + n, 'T' + sd + (n - 1), 'CH', SM.id); }
          for (let k = 1; k < n; k++) mb((arch ? 'H' : 'V') + sd + k, 'T' + sd + k, 'B' + sd + k, arch ? 'HANG' : 'WEB', SM.id, { type: 'truss' });
          if (!arch) for (let k = 1; k < n - 1; k++) { const pr = p.kind === 'warren' ? k % 2 === 1 : k < n / 2; mb('D' + sd + k, pr ? 'T' + sd + k : 'T' + sd + (k + 1), pr ? 'B' + sd + (k + 1) : 'B' + sd + k, 'WEB', SM.id, { type: 'truss' }); }
        });
        // top bracing (struts + X) where there is head room
        for (let k = 1; k < n; k++) { const x = k * dx, clear = !arch || zA(x) > 6.5; if (!clear) continue; mb('TS' + k, 'TL' + k, 'TR' + k, 'BR', SM.id); if (k < n - 1 && (!arch || zA(x + dx) > 6.5)) { mb('TXa' + k, 'TL' + k, 'TR' + (k + 1), 'BR', SM.id, { type: 'truss' }); mb('TXb' + k, 'TR' + k, 'TL' + (k + 1), 'BR', SM.id, { type: 'truss' }); } }
        lines.forEach(ln => ln.forEach(id => udl('SDL', id, (0.22 * 25 + 2.5) * W / Math.max(1, sy.length))));
        m.name = (arch ? T('Tied arch bridge ', 'สะพานโค้งผูก ') : T('Truss bridge ', 'สะพานโครงถัก ')) + L + ' m';
        bridgeDefaults(m, std, { kind, lanes: sy.map((y, j) => ({ id: 'L' + (j + 1), name: T('Lane ', 'ช่องจราจร ') + (j + 1), a: lines[j].slice(), b: null, w: 0, y })) });
      } else if (kind === 'cable') {
        const Lm = +p.main || 120, Ls = +p.side || 60, Hp = +p.pylon || 45, sp = +p.spacing || 10, W = +p.width || 12;
        const CD = concAt(std, 40), CP = concAt(std, 40), ST = { id: 'STRAND', name: T('Stay cable strand', 'ลวดเคเบิล'), kind: 'steel', E: 195000, nu: 0.3, rho: 78.5, alpha: 12 };
        m.materials = [CD, ST]; m.sections = [{ id: 'DECK', name: T('Composite deck girder', 'คานพื้นสะพานส่วนประกอบ'), type: 'user', A: 1.1e6, Iz: 1.5e12, Iy: 2.0e13, J: 3.0e12, dd: 2800, ww: W * 1000 }, { id: 'PYL', name: T('Pylon 4000×6000', 'เสาสะพาน 4000×6000'), type: 'rect', b: 6000, h: 4000 }, { id: 'CAB', name: T('Stay cable Ø90 (≈ 6360 mm²)', 'เคเบิล Ø90 (≈ 6360 mm²)'), type: 'circ', D: 90 }];
        m.cases.push(CASE('CT', 'G', false, 'Cable tensioning', 'แรงดึงเคเบิล'));
        const half = sp / 2, nx = Math.round((Ls + Lm) / half), xs = Array.from({ length: nx + 1 }, (_, k) => r4(k * half)), kp = Math.round(Ls / half);
        xs.forEach((x, k) => nd('D' + k, x, 0, 0, null, k === 0 || k === nx ? [0, 1, 1, 1, 0, 0] : null));
        const deck = []; for (let k = 0; k < nx; k++) deck.push(mb('D' + (k + 1), 'D' + k, 'D' + (k + 1), 'DECK', CD.id));
        nd('PB', Ls, 0, -20, 'fixed'); nd('PT', Ls, 0, Hp); mb('PY1', 'PB', 'D' + kp, 'PYL', CP.id); mb('PY2', 'D' + kp, 'PT', 'PYL', CP.id);
        const wD = 1.1 * 25 + 2.5 * W + 14, EA = 195e6 * Math.PI * 0.045 * 0.045, al = 12e-6;
        xs.forEach((x, k) => { const d = Math.abs(x - Ls); if (d < sp - 1e-6 || Math.abs(d / sp - Math.round(d / sp)) > 1e-6 || k === nx) return; /* the outermost back-span cable is the backstay, anchored at the abutment */ const id = mb((x < Ls ? 'CS' : 'CM') + Math.round(d / sp), 'D' + k, 'PT', 'CAB', 'STRAND', { type: 'truss' }); const sin = Hp / Math.hypot(Hp, d), P = wD * sp / sin; m.loads.push({ case: 'CT', kind: 'temp', member: id, dT: r4(-P / EA / al), dTy: 0, dTz: 0 }); });
        deck.forEach(id => udl('SDL', id, 2.5 * W + 14));
        m.name = T('Cable-stayed bridge ', 'สะพานขึงด้วยเคเบิล ') + Ls + ' + ' + Lm + ' m';
        bridgeDefaults(m, std, { kind, lanes: lanesOver([0], [deck], W, lw) });
      } else {
        m.materials = [concAt(std, 40), SM]; m.sections = [{ id: 'GIRD', name: T('Girder 600×1500', 'คาน 600×1500'), type: 'rect', b: 600, h: 1500 }];
        m.name = T('Empty bridge model', 'โมเดลสะพานว่าง'); bridgeDefaults(m, std, { kind: 'blank' });
      }
      return m;
    }
    // ---- building module: lists like "4, 3.5x4" or "4@3.5", grid labels A, B, … Z, AA
    const numR = s => { const out = []; String(s == null ? '' : s).split(/[,;\s]+/).forEach(t => { let q; if ((q = t.match(/^(\d+)@([\d.]+)$/))) for (let i = 0; i < Math.min(200, +q[1]); i++) out.push(+q[2]); else if ((q = t.match(/^(\d+)[x×*]([\d.]+)$/))) for (let i = 0; i < Math.min(200, +q[1]); i++) out.push(+q[2]); else if (+t > 0) out.push(+t); }); return out; };
    const dims2 = (s, d) => { const q = String(s || '').split(/[x×*\s]+/).map(Number).filter(v => v > 0); return q.length >= 2 ? q.slice(0, 2) : q.length === 1 ? [q[0], q[0]] : d; };
    const GLAB = i => { let s = ''; i++; while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; };
    const cumul = a => a.reduce((o, v) => { o.push(r4(o[o.length - 1] + v)); return o; }, [0]);
    const STEELB = { AS: [['UC', '310UC118'], ['UB', '460UB67.1']], EC: [['HEB', 'HEB 300'], ['IPE', 'IPE 450']], TH: [['H', 'H 350×350'], ['H', 'H 450×200']] };
    function buildBuilding(kind, p, std) {
      std = STDS.includes(std) ? std : 'AS';
      const D = DEFS[std], steel = kind === 'steel', CM = concMat(std, D.conc), SM = steelMat(std, D.steel);
      const cd = dims2(p.col, [500, 500]), bd = dims2(p.beam, [300, 600]), sb = STEELB[std];
      const secs = steel ? [Object.assign(stdSec('COL', sb[0][0], sb[0][1]), { name: sb[0][1] + T(' column', ' เสา') }), Object.assign(stdSec('BM', sb[1][0], sb[1][1]), { name: sb[1][1] + T(' beam', ' คาน') })]
        : [{ id: 'COL', name: cd[0] + '×' + cd[1] + T(' RC column', ' เสา คสล.'), type: 'rect', b: cd[0], h: cd[1] }, { id: 'BM', name: bd[0] + '×' + bd[1] + T(' RC beam', ' คาน คสล.'), type: 'rect', b: bd[0], h: bd[1] }];
      const wind = p.wind !== 'off', cases = GQ().concat(wind ? [CASE('WX', 'W', false, 'Wind +X', 'ลม +X'), CASE('WY', 'W', false, 'Wind +Y', 'ลม +Y'), CASE('WXN', 'W', false, 'Wind −X', 'ลม −X'), CASE('WYN', 'W', false, 'Wind −Y', 'ลม −Y')] : []);
      const m = blankModel(std, '', '', secs, steel ? [SM, CM] : [CM], cases), b = BD.bld(m);
      const xs = cumul(numR(p.bx).length ? numR(p.bx) : [6]), ys = cumul(numR(p.by).length ? numR(p.by) : [6]), zs = cumul(numR(p.st).length ? numR(p.st) : [3.5]);
      b.gx = xs.map((x, i) => ({ id: GLAB(i), x })); b.gy = ys.map((y, i) => ({ id: String(i + 1), y }));
      b.stories = zs.map((z, k) => ({ id: k === 0 ? 'Base' : k === zs.length - 1 && k > 1 ? 'Roof' : 'L' + k, z }));
      b.floor = { dl: 'G', ll: 'Q', sw: true, mat: CM.id, way: 'auto' }; b.dsec = { col: 'COL', beam: 'BM' };
      b.slabP = { t: +p.t || (steel ? 130 : 150), sdl: p.sdl === '' || p.sdl == null ? 1.5 : +p.sdl, ll: p.ll === '' || p.ll == null ? 3 : +p.ll };
      b.wind = BD.windDefaults(std); b.wind.on = wind; b.dia = true;
      if (kind !== 'blank') {
        const nx = xs.length, ny = ys.length, id = (i, j, k) => 'N' + (k * nx * ny + j * nx + i + 1);
        zs.forEach((z, k) => ys.forEach((y, j) => xs.forEach((x, i) => m.nodes.push({ id: id(i, j, k), x, y, z, sup: k ? 'free' : 'fixed' }))));
        let c = 0, bb = 0, s = 0; const mat = steel ? SM.id : CM.id;
        for (let k = 1; k < zs.length; k++) {
          ys.forEach((y, j) => xs.forEach((x, i) => m.members.push({ id: 'C' + (++c), i: id(i, j, k - 1), j: id(i, j, k), sec: 'COL', mat, type: 'frame', beta: 0 })));
          ys.forEach((y, j) => { for (let i = 0; i < nx - 1; i++) m.members.push({ id: 'B' + (++bb), i: id(i, j, k), j: id(i + 1, j, k), sec: 'BM', mat, type: 'frame', beta: 0 }); });
          xs.forEach((x, i) => { for (let j = 0; j < ny - 1; j++) m.members.push({ id: 'B' + (++bb), i: id(i, j, k), j: id(i, j + 1, k), sec: 'BM', mat, type: 'frame', beta: 0 }); });
          const roof = k === zs.length - 1 && zs.length > 2;
          for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) b.slabs.push({ id: 'S' + (++s), st: b.stories[k].id, x0: xs[i], x1: xs[i + 1], y0: ys[j], y1: ys[j + 1], t: b.slabP.t, sdl: b.slabP.sdl, ll: roof ? +p.roof || 0 : b.slabP.ll, way: 'auto' });
        }
      }
      m.combos = preset(m.code, m.cases);
      m.name = T(BLDTPL[kind] ? BLDTPL[kind].n[0] : 'Building', BLDTPL[kind] ? BLDTPL[kind].n[1] : 'อาคาร');
      BD.sync(m);
      return m;
    }
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
      model: saved && saved.model ? saved.model : BRG ? build('girder', TPL.girder.p, initStd) : BLD ? build('rc', TPL.rc.p, initStd) : build('building', TPL.building.p, initStd),
      opt: Object.assign({ pdelta: false, modes: false, nmodes: 6, buckling: false, nseg: 4, massG: 1, massQ: 0.3, snap: 0.5, u: { F: 'kN', L: 'm', T: 'C' } }, saved && saved.opt || {}),
      step: 'mat', rview: 'Mz', src: null, sel: { n: [], m: [] }, tool: 'select', draw: null, mode: 0, labels: true, loadsOn: false, dscale: 1,
      res: null, err: null, errNode: null, tpl: BRG ? 'girder' : BLD ? 'rc' : 'building', tplOpen: false, rtab: 'sum', lcase: 'G', cut: 'all', cb: null, ss: null,
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
        if (BLD) { const sy = BD.sync(m); A.bldWarn = sy.warn; }
        A.res = F.analyse(BLD ? BD.expand(m) : m, { pdelta: go && o.pdelta, modes: go && o.modes ? Math.max(1, Math.min(20, o.nmodes | 0)) : 0, buckling: go && o.buckling, nseg: Math.max(2, Math.min(10, o.nseg | 0)), massSrc: mass });
        if (BLD) { BD.stripRes(A.res); (A.bldWarn || []).forEach(w => A.res.warn.push(w)); }
        A.bres = null;
        if (BRG && m.bridge) { try { A.bres = BR.run(m, A.res); A.bres.warn.forEach(w => A.res.warn.push(w)); } catch (e) { A.res.warn.push(T('Bridge analysis: ', 'การวิเคราะห์สะพาน: ') + (e.message || e)); } }
        if (!A.src || !srcList().some(s => s[0] === A.src)) A.src = BRG && A.bres && Object.keys(A.bres.bc).length ? 'bc:' + Object.keys(A.bres.bc)[0] : m.combos.length ? 'combo:' + m.combos[0].id : 'case:' + m.cases[0].id;
      } catch (e) { A.err = e.message || String(e); A.errNode = e.node || null; }
      A.resVer = A.ver;
      return !A.err;
    }
    const fresh = () => !!A.res && A.resVer === A.ver;
    const curView = () => (A.step === 'res' && fresh() ? A.rview : 'model');
    function changed(side) { A.ver++; if (BLD && A.model.bld) { try { A.bldWarn = BD.sync(A.model).warn; } catch (e) { A.bldWarn = [String(e.message || e)]; } } persist(); redraw(); updCounts(); if (side) sideRefresh(); const u = $('#anRib [data-c=undo]'), r = $('#anRib [data-c=redo]'); if (u) u.disabled = !A.hist.length; if (r) r.disabled = !A.fut.length; }

    // ------------------------------------------------------------------ results
    const COMPS = [['N', 'N', 'kN'], ['Vy', 'V<sub>y</sub>', 'kN'], ['Vz', 'V<sub>z</sub>', 'kN'], ['T', 'T', 'kNm'], ['My', 'M<sub>y</sub>', 'kNm'], ['Mz', 'M<sub>z</sub>', 'kNm']];
    const isComp = v => COMPS.some(c => c[0] === v);
    function srcList() {
      const m = A.model, out = [];
      m.cases.forEach(c => out.push(['case:' + c.id, T('Case ', 'กรณี ') + c.id + ' — ' + c.name]));
      m.combos.forEach(c => out.push(['combo:' + c.id, c.id + ' — ' + c.name + ' (' + c.type + ')']));
      if (m.combos.some(c => c.type === 'ULS')) out.push(['env:ULS', T('Envelope — all ULS combinations', 'ค่าสูงสุด/ต่ำสุด — ULS ทั้งหมด')]);
      if (m.combos.some(c => c.type === 'SLS')) out.push(['env:SLS', T('Envelope — all SLS combinations', 'ค่าสูงสุด/ต่ำสุด — SLS ทั้งหมด')]);
      if (BRG && m.bridge) {
        (m.bridge.mlc || []).forEach(c => out.push(['ml:' + c.id, T('Moving load ', 'น้ำหนักเคลื่อนที่ ') + c.id + ' — ' + c.name + T(' (envelope)', ' (ค่าสูงสุด/ต่ำสุด)')]));
        (m.bridge.stages || []).forEach((st, i) => out.push(['st:' + st.id, T('Stage ', 'ขั้นที่ ') + (i + 1) + ' — ' + st.name + T(' (cumulative)', ' (สะสม)')]));
        (m.bridge.bcombos || []).forEach(c => out.push(['bc:' + c.id, c.id + ' — ' + c.name + ' (' + c.type + T(', with traffic)', ', รวมจราจร)')]));
      }
      return out;
    }
    function current() {
      const r = A.res; if (!r || !A.src || A.resVer !== A.ver) return null;
      const [k, id] = A.src.split(':');
      if (k === 'case') return r.cases[id] ? Object.assign({ kind: 'case' }, r.cases[id]) : null;
      if (k === 'combo') return r.combos[id] && !r.combos[id].failed ? Object.assign({ kind: 'combo' }, r.combos[id]) : null;
      if (k === 'ml' || k === 'bc') { const e = A.bres && A.bres[k][id]; return e ? Object.assign({ kind: 'env' }, e) : null; }
      if (k === 'st') { const e = A.bres && A.bres.st.find(q => q.id === id); return e && !e.empty ? Object.assign({ kind: 'case' }, e) : null; }
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
    function levels() { const ax = cutAxis(); if (!ax) return []; const s = new Set(A.model.nodes.map(n => r4(+n[ax] || 0))); if (BLD && ax === 'z' && A.model.bld) A.model.bld.stories.forEach(q => s.add(r4(q.z))); return [...s].sort((a, b) => a - b); }
    function nodeVisible(n) { if (A.hidN && A.hidN.has(n.id)) return false; const ax = cutAxis(); if (!ax || A.cut === 'all') return true; return Math.abs((+n[ax] || 0) - +A.cut) < 1e-3; }
    function setView(v) { const [y, p] = VIEWS[v]; Object.assign(A.cam, { v, yaw: y, pitch: p, k: null }); A.cut = 'all'; }
    function fit(W, H) {
      const c = A.cam, B = basis(c), ns = A.model.nodes.filter(nodeVisible).map(P3);
      // a building fits its grid lines and stories too (so an empty grid is visible)
      if (BLD && A.model.bld && A.model.bld.gx.length && A.model.bld.gy.length) { const bd = A.model.bld, X = bd.gx.map(g => g.x), Y = bd.gy.map(g => g.y), st = bd.stories.map(q => q.z), zs = A.cut !== 'all' && cutAxis() === 'z' ? [+A.cut] : st.length ? [Math.min(...st), Math.max(...st)] : [0]; [Math.min(...X), Math.max(...X)].forEach(x => [Math.min(...Y), Math.max(...Y)].forEach(y => zs.forEach(z => ns.push([x, y, z])))); }
      if (!ns.length) { c.t = [0, 0, 0]; c.k = Math.min(W, H) / 14; return; }
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      ns.forEach(p => { const a = dot(p, B.r), b = dot(p, B.u); x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); });
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, ctr = ns.reduce((s, p) => addv(s, p, 1 / ns.length), [0, 0, 0]);
      const dd = dot(ctr, B.d); c.t = addv(addv(addv([0, 0, 0], B.r, cx), B.u, cy), B.d, dd);
      c.k = Math.min((W - 110) / Math.max(x1 - x0, 1), (H - 120) / Math.max(y1 - y0, 1), 400);
    }
    function extent() { const ns = A.model.nodes; if (!ns.length) return 10; let mx = 0; const c = ns.reduce((s, n) => addv(s, P3(n), 1 / ns.length), [0, 0, 0]); ns.forEach(n => { mx = Math.max(mx, Math.hypot(...sub(P3(n), c))); }); return Math.max(2 * mx, 1); }
    function screenToWorld(x, y, W, H) { const c = A.cam, B = basis(c); return addv(addv(c.t.slice(), B.r, (x - W / 2) / c.k), B.u, (H / 2 - y) / c.k); }
    function planePoint(x, y, W, H) {
      const ax = cutAxis(); if (!ax) return null;
      if (BLD && ax === 'z' && A.model.bld) return gridSnap(x, y, W, H).p;
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
      const memVis = mb => visN.has(mb.i) && visN.has(mb.j) && !(A.hidM && A.hidM.has(mb.id));
      // structural grid on the base plane / elevation plane
      const xs = [...new Set(m.nodes.map(n => r4(+n.x || 0)))], ys = [...new Set(m.nodes.map(n => r4(+n.y || 0)))], zs = [...new Set(m.nodes.map(n => r4(+n.z || 0)))];
      const mm = a => [Math.min(...a), Math.max(...a)], pad = Math.max(1, 0.06 * ext);
      const bldO = BLD && m.bld ? { g, P, pal, line, text, rep, W, H } : null, bldGrid = bldO && (m.bld.gx.length || m.bld.gy.length);
      if (bldGrid) { drawBld(Object.assign({ stage: 'grid' }, bldO)); }
      else if ((rep || A.grid !== false) && xs.length && xs.length < 60 && ys.length < 60) {
        const [x0, x1] = mm(xs), [y0, y1] = mm(ys), [z0, z1] = mm(zs), v = c.v;
        g.save(); g.globalAlpha = 0.9;
        if (v === 'xz') { const yy = A.cut === 'all' ? y0 : +A.cut; xs.forEach(x => line(P([x, yy, z0 - pad]), P([x, yy, z1 + pad]), pal.grid, 1, [4, 4])); zs.forEach(z => line(P([x0 - pad, yy, z]), P([x1 + pad, yy, z]), pal.grid, 1, [4, 4])); }
        else if (v === 'yz') { const xx = A.cut === 'all' ? x0 : +A.cut; ys.forEach(y => line(P([xx, y, z0 - pad]), P([xx, y, z1 + pad]), pal.grid, 1, [4, 4])); zs.forEach(z => line(P([xx, y0 - pad, z]), P([xx, y1 + pad, z]), pal.grid, 1, [4, 4])); }
        else { const zz = v === 'plan' && A.cut !== 'all' ? +A.cut : z0; xs.forEach(x => line(P([x, y0 - pad, zz]), P([x, y1 + pad, zz]), pal.grid, 1, [4, 4])); ys.forEach(y => line(P([x0 - pad, y, zz]), P([x1 + pad, y, zz]), pal.grid, 1, [4, 4])); }
        g.restore();
      }
      // members
      const scr = { n: [], m: [] }, resMode = view !== 'model', solidOn = !!A.solid && !resMode && !rep;
      const RED = '#dc2626'; let nBad = 0;
      if (bldO && view === 'model') drawBld(Object.assign({ stage: 'slabs' }, bldO));
      if (solidOn) drawSolid();
      m.members.forEach(mb => {
        const a = nd[mb.i], b = nd[mb.j]; if (!a || !b) return;
        const pa = P(P3(a)), pb = P(P3(b)), vis = memVis(mb), sel = selM.has(mb.id), hov = !rep && A.hover && A.hover.k === 'm' && A.hover.id === mb.id;
        if (!vis) { g.save(); g.globalAlpha = A.hidM.has(mb.id) || A.hidN.has(mb.i) || A.hidN.has(mb.j) ? 0.07 : 0.14; line(pa, pb, pal.muted, 1.2); g.restore(); return; }
        const bad = !resMode && !memOK(mb); if (bad) nBad++;
        const col = sel ? pal.acc : hov ? pal.blue : resMode ? pal.soft : bad ? RED : mb.type === 'truss' ? pal.teal : pal.ink;
        if (solidOn && !(bad && !secPoly(mb.sec))) { scr.m.push({ id: mb.id, a: pa, b: pb }); return; }
        line(pa, pb, col, sel ? 4 : resMode ? 1.6 : mb.type === 'truss' ? 1.6 : 2.4);
        scr.m.push({ id: mb.id, a: pa, b: pb });
        if (mb.type !== 'truss' && !resMode) [[mb.relI, pa, pb], [mb.relJ, pb, pa]].forEach(([r, p, q]) => { if (!r) return; const L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, d = Math.min(11, L / 3); g.beginPath(); g.arc(p[0] + (q[0] - p[0]) / L * d, p[1] + (q[1] - p[1]) / L * d, 3.4, 0, 2 * PI); g.fillStyle = pal.bg; g.fill(); g.strokeStyle = col; g.lineWidth = 1.4; g.stroke(); });
      });
      // results
      const notes = [];
      if (!rep && (A.hidM.size || A.hidN.size)) notes.push(T('Active: ', 'แสดง: ') + m.members.filter(memVis).length + ' / ' + m.members.length + T(' elements (View › Activities › All to show everything)', ' ชิ้นส่วน (มุมมอง › ทั้งหมด เพื่อแสดงทั้งหมด)'));
      if (nBad && !rep) notes.push('● ' + nBad + T(' element(s) without section or material (red)', ' ชิ้นส่วนยังไม่มีหน้าตัดหรือวัสดุ (สีแดง)'));
      if (view !== 'model' && A.res && A.resVer === A.ver) drawResults();
      else if (view !== 'model' && A.resVer !== A.ver) notes.push(T('Updating…', 'กำลังคำนวณ…'));
      // nodes and supports
      m.nodes.forEach(n => {
        if (!visN.has(n.id)) return;
        const p = P(P3(n)), sel = selN.has(n.id), hov = !rep && A.hover && A.hover.k === 'n' && A.hover.id === n.id, fx6 = F.fixOf(n), nt = fx6[0] + fx6[1] + fx6[2], nr = fx6[3] + fx6[4] + fx6[5];
        const sc = pal.muted;
        if (nt + nr && (rep || A.showSup !== false)) {
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
      if (BRG && view === 'model' && !rep && A.showLanes !== false) drawLanesOn(g, P, pal);
      // loads
      if (view === 'model' && (A.loadsOn || rep)) { drawLoads(o.lcase || A.lcase || 'all'); if (BLD && o.lcase !== '__none') drawSlabLoads({ P, text, pal, g, notes }, o.lcase || A.lcase || 'all'); }
      // local axes of selected members
      if (!rep && ((selM.size && selM.size <= 24) || A.allAxes)) m.members.forEach(mb => {
        if (!(A.allAxes ? memVis(mb) : selM.has(mb.id))) return; const a = nd[mb.i], b = nd[mb.j]; if (!a || !b) return;
        const ax = F.axes(P3(a), P3(b), mb.beta), mid = addv(P3(a), sub(P3(b), P3(a)), 0.5), L = 34 / k, pm = P(mid);
        [[ax.ex, pal.pink, 'x'], [ax.ey, pal.ok, 'y'], [ax.ez, pal.blue, 'z']].forEach(([e, col, lb]) => { const q = P(addv(mid, e, L)); arrow(pm, q, col, 1.8); text(lb, q[0] + 3, q[1] - 3, col, { font: '600 11px ui-monospace, monospace' }); });
      });
      // labels
      if (A.labels || rep) {
        const vm = m.members.filter(memVis).length, many = vm > 70;
        if (rep || A.lblM !== false) m.members.forEach(mb => { if (!memVis(mb) || (many && !selM.has(mb.id))) return; const a = nd[mb.i], b = nd[mb.j]; if (!a || !b) return; const p = P(addv(P3(a), sub(P3(b), P3(a)), 0.5)); text(mb.id, p[0] + 4, p[1] - 4, pal.blue, { font: '10.5px ui-monospace, monospace' }); });
        if (rep || A.lblN !== false) m.nodes.forEach(n => { if (!visN.has(n.id) || (many && !selN.has(n.id))) return; const p = P(P3(n)); text(n.id, p[0] + 6, p[1] + 13, pal.muted, { font: '10.5px ui-monospace, monospace' }); });
      }
      // drawing a member: rubber band
      if (bldO) drawBld(Object.assign({ stage: 'tool' }, bldO));
      if (!rep && A.tool === 'member' && A.draw && A.mouse && nd[A.draw]) { const p = P(P3(nd[A.draw])); line(p, A.mouse, pal.acc, 1.5, [6, 4]); }
      if (!rep && A.box) { const cr = A.box[2] < A.box[0], bx = [Math.min(A.box[0], A.box[2]), Math.min(A.box[1], A.box[3]), Math.abs(A.box[2] - A.box[0]), Math.abs(A.box[3] - A.box[1])]; g.fillStyle = cr ? 'rgba(22,163,74,0.08)' : 'rgba(46,107,255,0.07)'; g.fillRect(...bx); g.strokeStyle = cr ? pal.ok : pal.blue; g.lineWidth = 1.2; g.setLineDash(cr ? [6, 4] : []); g.strokeRect(...bx); g.setLineDash([]); text(cr ? T('crossing', 'ตัดผ่าน') : T('window', 'หน้าต่าง'), bx[0] + 4, bx[1] - 5, cr ? pal.ok : pal.blue, { font: '10.5px system-ui, sans-serif' }) + (A.boxHow === 'add' ? text('+', bx[0] + bx[2] - 10, bx[1] - 5, pal.blue, { font: '700 12px system-ui' }) : A.boxHow === 'sub' ? text('−', bx[0] + bx[2] - 10, bx[1] - 5, pal.pink, { font: '700 12px system-ui' }) : 0); }
      // axis triad
      const o0 = [34, H - 30];
      [[[1, 0, 0], 'X', pal.pink], [[0, 1, 0], 'Y', pal.ok], [[0, 0, 1], 'Z', pal.blue]].forEach(([e, lb, col]) => { const dx = dot(e, B.r), dy = dot(e, B.u); if (Math.hypot(dx, dy) < 0.08) { text(lb, o0[0] + 2, o0[1] - 2, col, { font: '600 10px ui-monospace, monospace' }); return; } const q = [o0[0] + 22 * dx, o0[1] - 22 * dy]; arrow(o0, q, col, 1.6); text(lb, q[0] + 3, q[1] + 3, col, { font: '600 10px ui-monospace, monospace' }); });
      notes.forEach((s, i) => text(s, 14, 22 + i * 16, s[0] === '●' ? RED : pal.muted, { font: '12px system-ui, sans-serif' }));
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
          const rgb = selM.has(mb.id) ? BASE.sel : A.hover && A.hover.k === 'm' && A.hover.id === mb.id ? BASE.hov : !memOK(mb) ? [225, 45, 45] : BASE[kind === 'steel' ? 'steel' : 'conc'];
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
        const ls = m.loads.filter(l => (lc === 'all' || l.case === lc) && l.gen !== 'slab');
        const maxW = Math.max(1e-9, ...ls.filter(l => l.kind === 'udl').map(l => Math.max(Math.abs(+l.w1 || 0), Math.abs(l.w2 === '' || l.w2 == null ? 0 : +l.w2))));
        const maxP = Math.max(1e-9, ...ls.filter(l => l.kind !== 'udl').map(l => l.kind === 'node' ? Math.max(Math.abs(+l.Fx || 0), Math.abs(+l.Fy || 0), Math.abs(+l.Fz || 0)) : Math.abs(+l.P || 0)));
        const stack = {}, fewL = ls.length <= 40 || rep, tl = ls.filter(l => l.kind === 'temp'), nT = rep ? 0 : tl.length;
        if (nT > 8) { const grp = {}; tl.forEach(l => { const k0 = l.case + ': ' + loadDesc(l).replace(/ΔT uniform|ΔT สม่ำเสมอ/, 'ΔT'); grp[k0] = (grp[k0] || 0) + 1; }); Object.entries(grp).slice(0, 4).forEach(([k0, c0]) => notes.push('🌡 ' + k0 + ' — ' + c0 + T(' element(s)', ' ชิ้นส่วน'))); }
        ls.forEach(l => {
          const col = caseCol(pal, l.case);
          if (l.kind === 'settle') { const n = nd[l.node]; if (!n || !visN.has(n.id)) return; const pp = P(P3(n)); g.strokeStyle = col; g.lineWidth = 1.6; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(pp[0], pp[1] + 4); g.lineTo(pp[0], pp[1] + 26); g.stroke(); g.setLineDash([]); g.beginPath(); g.moveTo(pp[0] - 5, pp[1] + 20); g.lineTo(pp[0], pp[1] + 27); g.lineTo(pp[0] + 5, pp[1] + 20); g.stroke(); text(l.case + ' ' + fu(+l.dz || 0, 'd', 1) + ul('d'), pp[0] + 8, pp[1] + 30, col); return; }
          if (l.kind === 'pres') { const mb = m.members.find(q => q.id === l.member); if (!mb || !memVis(mb)) return; const a = nd[mb.i], b = nd[mb.j]; if (!a || !b) return; const pa = P3(a), pb = P3(b), ax = F.axes(pa, pb, mb.beta), e1 = +l.e1 || 0, e2 = +l.e2 || 0, em = l.em === '' || l.em == null ? (e1 + e2) / 2 : +l.em, ef = t => e1 + (e2 - e1) * t + 4 * (em - (e1 + e2) / 2) * t * (1 - t), sc2 = 0.04 * ext / Math.max(300, Math.abs(e1), Math.abs(e2), Math.abs(em)); g.strokeStyle = '#c92a2a'; g.lineWidth = 1.5; g.setLineDash([6, 3]); g.beginPath(); for (let i = 0; i <= 12; i++) { const t = i / 12, q = P(addv(addv(pa, sub(pb, pa), t), ax.ey, -ef(t) * sc2)); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); } g.stroke(); g.setLineDash([]); if (fewL || selM.has(mb.id)) { const q = P(addv(pa, sub(pb, pa), 0.5)); text(l.case + ' P ' + fu(+l.P || 0, 'F', 0), q[0] + 4, q[1] + 14, '#c92a2a'); } return; }
          if (l.kind === 'node') {
            const n = nd[l.node]; if (!n || !visN.has(n.id)) return; const p0 = P3(n), pp = P(p0);
            [['Fx', [1, 0, 0]], ['Fy', [0, 1, 0]], ['Fz', [0, 0, 1]]].forEach(([q, e]) => { const v = +l[q] || 0; if (!v) return; const len = (20 + 26 * Math.abs(v) / maxP) / k, d = e.map(c0 => c0 * Math.sign(v)), tail = P(addv(p0, d, -len - 5 / k)), head = P(addv(p0, d, -5 / k)); arrow(tail, head, col, 1.5); if (fewL || selN.has(n.id)) text(fu(Math.abs(v), 'F'), tail[0] + 3, tail[1] - 3, col); });
            const mtot = ['Mx', 'My', 'Mz'].filter(q => +l[q]).map(q => q + ' ' + fu(+l[q], 'M')).join(' ');
            if (mtot) { g.strokeStyle = col; g.lineWidth = 1.4; g.beginPath(); g.arc(pp[0], pp[1], 12, -PI * 0.9, PI * 0.4); g.stroke(); text(mtot, pp[0] + 14, pp[1] - 10, col); }
            return;
          }
          const mb = m.members.find(q => q.id === l.member); if (!mb || !memVis(mb)) return; const a = nd[mb.i], b = nd[mb.j]; if (!a || !b) return;
          if (l.kind === 'temp') {
            const hot = (+l.dT || 0) + Math.abs(+l.dTy || 0) / 2 + Math.abs(+l.dTz || 0) / 2 >= 0 && !((+l.dT || 0) < 0), tc = hot ? '#e8590c' : '#1c7ed6', pa2 = P(P3(a)), pb2 = P(P3(b));
            g.save(); g.globalAlpha = 0.35; line(pa2, pb2, tc, 9); g.restore(); line(pa2, pb2, tc, 1.4, [5, 4]);
            const mp = [(pa2[0] + pb2[0]) / 2, (pa2[1] + pb2[1]) / 2], k2 = mb.id + '|t', off = stack[k2] || 0; stack[k2] = off + 13;
            if (nT <= 8 || selM.has(mb.id)) text(l.case + ' ' + loadDesc(l).replace(/ΔT uniform|ΔT สม่ำเสมอ/, 'ΔT'), mp[0] + 6, mp[1] + 14 + off, tc);
            return;
          }
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
            const tm = tops[Math.floor(tops.length / 2)]; if (fewL || selM.has(mb.id)) text(l.case + ' ' + fu(Math.abs(w1), 'w') + (w2 !== w1 ? '→' + fu(Math.abs(w2), 'w') : ''), tm[0] + 4, tm[1] - 4, col);
          } else if (l.kind === 'point') {
            const v = +l.P || 0, sg = Math.sign(v || 1), base = at(Math.min(L, +l.a || 0)), len = (20 + 26 * Math.abs(v) / maxP) / k, tail = P(addv(base, e, -sg * len)), head = P(addv(base, e, -sg * 4 / k));
            arrow(tail, head, col, 1.5); text(l.case + ' ' + fu(Math.abs(v), 'F'), tail[0] + 4, tail[1] - 3, col);
          } else if (l.kind === 'moment') { const pp = P(at(Math.min(L, +l.a || 0))); g.strokeStyle = col; g.lineWidth = 1.4; g.beginPath(); g.arc(pp[0], pp[1], 11, -PI * 0.9, PI * 0.4); g.stroke(); text(l.case + ' M ' + fu(+l.M || 0, 'M'), pp[0] + 13, pp[1] - 9, col); }
        });
      }
      function drawResults() {
        const r = A.res;
        if (view === 'il') { drawILOn(g, P, pal, notes, ext, text); return; }
        if (view === 'mode' || view === 'buck') {
          let u, mesh, title;
          if (view === 'mode') { const md = r.modal && r.modal.modes[A.mode]; if (!md) { notes.push(r.modal ? T('No mode.', 'ไม่มีโหมด') : T('Turn on modal analysis (Pro) in the Analysis settings.', 'เปิดการวิเคราะห์โหมด (Pro) ในการตั้งค่าการวิเคราะห์')); return; } u = md.u; mesh = r.modal.mesh; title = T('Mode ', 'โหมด ') + (A.mode + 1) + ' · f = ' + f(md.f, 3) + ' Hz · T = ' + f(md.T, 3) + ' s'; }
          else { const bid = A.src && A.src.startsWith('combo:') ? A.src.slice(6) : null, bk = bid && r.buckling && r.buckling[bid], md = bk && bk.modes && bk.modes[0]; if (!md) { notes.push(bk && bk.none ? T('No compression in this combination — no buckling mode.', 'ไม่มีแรงอัดในกรณีนี้ — ไม่มีโหมดการโก่งเดาะ') : T('Turn on buckling analysis (Pro) and choose a ULS combination.', 'เปิดการวิเคราะห์การโก่งเดาะ (Pro) และเลือกกรณีรวมแรง ULS')); return; } u = md.u; mesh = bk.mesh; title = T('Buckling mode 1 · λcr = ', 'โหมดการโก่งเดาะ 1 · λcr = ') + f(md.lam, 2); }
          const sc = 0.1 * ext * A.dscale;
          mesh.els.forEach(el => { if (String(el.mem.id).startsWith('~')) return; const mb = m.members.find(q => q.id === el.mem.id); if (mb && !memVis(mb)) return; const a = mesh.pts[el.n1], b = mesh.pts[el.n2], i = 6 * el.n1, j = 6 * el.n2; line(P([a.x + u[i] * sc, a.y + u[i + 1] * sc, a.z + u[i + 2] * sc]), P([b.x + u[j] * sc, b.y + u[j + 1] * sc, b.z + u[j + 2] * sc]), pal.pink, 2); });
          notes.push(title); return;
        }
        if (!cur) { notes.push(T('Choose results in the list above.', 'เลือกผลลัพธ์จากรายการด้านบน')); return; }
        const env = cur.kind === 'env';
        if (view === 'def') {
          if (env) { notes.push(T('Choose a load case or combination to see the deflected shape.', 'เลือกกรณีน้ำหนักหรือกรณีรวมแรงเพื่อดูรูปการโก่งตัว')); return; }
          let mx = 0, best = null; cur.mem.forEach(q => q.dx.forEach((d, i) => { const v = Math.hypot(d, q.dy[i], q.dz[i]); if (v > mx) { mx = v; best = [q, i]; } }));
          const sc = mx > 0 ? 0.08 * ext / mx * A.dscale : 0;
          cur.mem.forEach(q => { const mb = m.members.find(z => z.id === q.id); if (!mb || !memVis(mb)) return; const pa = P3(nd[mb.i]), pb = P3(nd[mb.j]), ex = sub(pb, pa).map(v => v / q.L); g.strokeStyle = pal.pink; g.lineWidth = 2.2; g.beginPath(); q.x.forEach((x, i) => { const p = P([pa[0] + ex[0] * x + q.dx[i] * sc, pa[1] + ex[1] * x + q.dy[i] * sc, pa[2] + ex[2] * x + q.dz[i] * sc]); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }); g.stroke(); });
          if (best) { const [q, i] = best, mb = m.members.find(z => z.id === q.id), pa = P3(nd[mb.i]), pb = P3(nd[mb.j]), ex = sub(pb, pa).map(v => v / q.L), p = P([pa[0] + ex[0] * q.x[i] + q.dx[i] * sc, pa[1] + ex[1] * q.x[i] + q.dy[i] * sc, pa[2] + ex[2] * q.x[i] + q.dz[i] * sc]); g.beginPath(); g.arc(p[0], p[1], 4.5, 0, 2 * PI); g.fillStyle = pal.pink; g.fill(); text(fu(mx, 'd') + ul('d'), p[0] + 8, p[1] - 8, pal.ink, { font: '600 11px ui-monospace, monospace' }); }
          notes.push(T('Deflected shape · max ', 'รูปการโก่งตัว · สูงสุด ') + fu(mx, 'd') + ul('d')); return;
        }
        if (view === 'react') {
          const R = cur.R; let mx = 1e-9;
          m.nodes.forEach((n, i) => { for (let d = 0; d < 3; d++) { const v = env ? Math.max(Math.abs(R[6 * i + d][0]), Math.abs(R[6 * i + d][1])) : Math.abs(R[6 * i + d]); mx = Math.max(mx, v); } });
          m.nodes.forEach((n, i) => {
            const fx6 = F.fixOf(n); if (!fx6.some(Boolean) && !['kx', 'ky', 'kz', 'krx', 'kry', 'krz'].some(q => +n[q] > 0)) return; if (!visN.has(n.id)) return;
            const p0 = P3(n), pp = P(p0), lines = [];
            ['X', 'Y', 'Z'].forEach((lb, d) => { const v = env ? null : R[6 * i + d]; if (env) { const [a0, a1] = R[6 * i + d]; if (Math.abs(a0) > 1e-6 || Math.abs(a1) > 1e-6) lines.push('R' + lb.toLowerCase() + ' ' + fu(a0, 'F', 1) + '…' + fu(a1, 'F', 1)); return; } if (Math.abs(v) < 1e-6) return; const e = [0, 0, 0]; e[d] = Math.sign(v); const len = (18 + 30 * Math.abs(v) / mx) / k; arrow(P(addv(p0, e, -len - 8 / k)), P(addv(p0, e, -8 / k)), pal.ok, 1.8); lines.push('R' + lb.toLowerCase() + ' ' + fu(v, 'F', 1)); });
            ['X', 'Y', 'Z'].forEach((lb, d) => { const v = env ? R[6 * i + 3 + d] : R[6 * i + 3 + d]; if (env) { if (Math.abs(v[0]) > 1e-6 || Math.abs(v[1]) > 1e-6) lines.push('M' + lb.toLowerCase() + ' ' + fu(v[0], 'M', 1) + '…' + fu(v[1], 'M', 1)); } else if (Math.abs(v) > 1e-6) lines.push('M' + lb.toLowerCase() + ' ' + fu(v, 'M', 1)); });
            if (m.nodes.length <= 120 || selN.has(n.id)) lines.forEach((s, j) => text(s, pp[0] + 10, pp[1] + 26 + j * 13, pal.ok));
          });
          notes.push(T('Support reactions', 'แรงปฏิกิริยา') + ' (' + ulab('F') + ', ' + ulab('M') + T('), + along +X, +Y, +Z', ') + ตามแกน +X, +Y, +Z')); return;
        }
        if (!isComp(view)) return;
        const q = view, qU = ['T', 'My', 'Mz'].includes(q) ? 'M' : 'F', onY = ['N', 'Vy', 'T', 'Mz'].includes(q), sgn = q === 'Mz' || q === 'My' ? -1 : 1;
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
              [bi, bj].filter((x, i, a2) => a2.indexOf(x) === i).forEach(i => { if (Math.abs(vals[i]) < 0.04 * mx) return; const p = pts[i]; text(fu(vals[i], qU, 1), p[0] + 3, p[1] - 3, colQ); });
            }
          });
        });
        const uF = '(' + ulab('F') + ')', uM = '(' + ulab('M') + ')';
        notes.push({ N: T('Axial force N ' + uF + ' · tension +', 'แรงตามแนวแกน N ' + uF + ' · แรงดึง +'), Vy: T('Shear V_y ' + uF + ' · local y', 'แรงเฉือน V_y ' + uF + ' · แกน y'), Vz: T('Shear V_z ' + uF + ' · local z', 'แรงเฉือน V_z ' + uF + ' · แกน z'), T: T('Torsion T ' + uM, 'แรงบิด T ' + uM), My: T('Moment M_y ' + uM + ' · minor axis, tension side', 'โมเมนต์ M_y ' + uM + ' · แกนรอง ด้านรับแรงดึง'), Mz: T('Moment M_z ' + uM + ' · major axis, tension side', 'โมเมนต์ M_z ' + uM + ' · แกนหลัก ด้านรับแรงดึง') }[q] + ' · ' + T('max ', 'สูงสุด ') + fu(mx, qU) + (env ? T(' · envelope (dashed = min)', ' · ค่าสูงสุด/ต่ำสุด (เส้นประ = ต่ำสุด)') : ''));
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
    function viewTag() { return ({ '3d': '3D', plan: T('Plan', 'แปลน'), xz: T('Elevation X–Z', 'รูปด้าน X–Z'), yz: T('Elevation Y–Z', 'รูปด้าน Y–Z') }[A.cam.v]) + (A.cut !== 'all' && cutAxis() ? ' · ' + cutAxis().toUpperCase() + ' = ' + fu(+A.cut, 'L', 2) + ul('L') : ''); }
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
      const m = A.model, nd = nodeMap(), vis = new Set(m.nodes.filter(nodeVisible).map(n => n.id)), mv = m.members.filter(q => vis.has(q.i) && vis.has(q.j) && !A.hidM.has(q.id));
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
      const sc = { n: A.sel.n.slice(), m: A.sel.m.slice() }; if (A.selCur && (A.selCur.n.join() !== sc.n.join() || A.selCur.m.join() !== sc.m.join())) A.prevSel = A.selCur; A.selCur = sc;
      if (A.step !== 'res') { if (A.sel.n.length && !['node', 'sup', 'load', 'mat', 'sec'].includes(A.step)) A.step = 'node'; else if (!A.sel.n.length && A.sel.m.length && !['elem', 'sup', 'load', 'mat', 'sec'].includes(A.step)) A.step = 'elem'; }
      sideRefresh(); redraw(); const mm = $('#anMember'); if (mm) mm.innerHTML = memberHTML();
    }
    function bindCanvas(cv) {
      const pts = new Map(); let mode = null, sx = 0, sy = 0, lx = 0, ly = 0, moved = false, pd = 0;
      const rel = e => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
      cv.addEventListener('pointerdown', e => {
        cv.focus({ preventScroll: true }); cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, rel(e));
        const [x, y] = rel(e); sx = lx = x; sy = ly = y; moved = false;
        if (pts.size === 2) { const [a, b] = [...pts.values()]; pd = Math.hypot(a[0] - b[0], a[1] - b[1]); mode = 'pinch'; A.box = null; return; }
        const is3 = A.cam.v === '3d', touch = e.pointerType === 'touch'; A.camDown = camSnap();
        if (A.tool === 'pan' && e.button === 0) mode = 'pan';
        else if (A.tool === 'zoomw' && e.button === 0) mode = 'zbox';
        else if (e.button === 1 || (e.button === 2 && e.shiftKey)) mode = 'pan';
        else if (e.button === 2) mode = is3 ? 'rot' : 'pan';
        else if (e.shiftKey || A.tool === 'orbit') mode = is3 ? 'rot' : 'pan';
        else if (A.tool === 'select' || (!touch && (e.ctrlKey || e.metaKey || e.altKey))) mode = 'box';
        else mode = is3 ? 'rot' : 'pan';
        A.boxHow = e.ctrlKey || e.metaKey ? 'add' : e.altKey ? 'sub' : 'new';
      });
      cv.addEventListener('pointermove', e => {
        const [x, y] = rel(e); drawGuide(x, y);
        if (!pts.size) { A.mouse = [x, y]; const h = pickAt(x, y), same = (h && A.hover && h.k === A.hover.k && h.id === A.hover.id) || (!h && !A.hover); if (!same || (A.tool === 'member' && A.draw) || isBTool(A.tool)) { A.hover = h; cv.style.cursor = curFor(); redraw(); } return; }
        pts.set(e.pointerId, [x, y]);
        if (Math.hypot(x - sx, y - sy) > 4) moved = true; if (!moved) return;
        if (mode === 'pinch' && pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pd) zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, d / pd); pd = d; return; }
        const dx = x - lx, dy = y - ly; lx = x; ly = y;
        if (mode === 'rot') { const c = A.cam, pivot = c.t.slice(); c.yaw -= dx * 0.008; c.pitch = Math.max(-1.5, Math.min(1.5, c.pitch + dy * 0.008)); c.t = pivot; }
        else if (mode === 'pan') { const c = A.cam, B = basis(c); c.t = addv(addv(c.t, B.r, -dx / c.k), B.u, dy / c.k); }
        else if (mode === 'box' || mode === 'zbox') A.box = [sx, sy, x, y];
        redraw();
      });
      const up = e => {
        const [x, y] = rel(e), had = pts.has(e.pointerId); pts.delete(e.pointerId); if (!had) return;
        if (pts.size) return;
        if (mode === 'zbox') { const bx = A.box; A.box = null; mode = null; if (moved && bx) { zoomBox(bx); setTool('select'); } else redraw(); return; }
        if ((mode === 'rot' || mode === 'pan') && moved && A.camDown) camPush(A.camDown);
        if (mode === 'box' && moved && A.box) { boxSelect(A.box, A.boxHow); A.box = null; selChanged(); mode = null; return; }
        A.box = null;
        if (!moved && e.type === 'pointerup' && mode !== 'pinch') clickAt(x, y, e);
        mode = null;
      };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('pointerleave', () => { drawGuide(null); if (!pts.size && A.hover) { A.hover = null; A.mouse = null; redraw(); } });
      let wheelT = 0;
      cv.addEventListener('wheel', e => { e.preventDefault(); if (Date.now() - wheelT > 700) camPush(); wheelT = Date.now(); const [x, y] = rel(e); zoomAt(x, y, Math.exp(-e.deltaY * 0.0012)); }, { passive: false });
      cv.addEventListener('contextmenu', e => { e.preventDefault(); if (A.draw && !moved) { A.draw = null; redraw(); } if (A.drawP && !moved) { A.drawP = null; redraw(); } });
      // drop a property dragged from the tree
      cv.addEventListener('dragover', e => { if (!A.dnd) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; if ((A.dnd.startsWith('sup:') ? A.sel.n : A.sel.m).length) { if (A.hover) { A.hover = null; redraw(); } return; } const [x, y] = rel(e), h = pickAt(x, y), want = A.dnd.startsWith('sup:') ? 'n' : 'm', ok = h && h.k === want ? h : null; if ((ok && (!A.hover || A.hover.id !== ok.id || A.hover.k !== ok.k)) || (!ok && A.hover)) { A.hover = ok; redraw(); } });
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
      if (BLD && isBTool(A.tool)) { bldClick(x, y, W, H); return; }
      if (A.tool === 'qnode' || A.tool === 'qelem') {
        const want = A.tool === 'qnode' ? 'n' : 'm'; if (!hit || hit.k !== want) { toast(T('Click on a ' + (want === 'n' ? 'node' : 'element') + '.', 'คลิกบน' + (want === 'n' ? 'จุดต่อ' : 'ชิ้นส่วน')), ''); return; }
        A.qinfo = { k: want, id: hit.id }; A.sel = want === 'n' ? { n: [hit.id], m: [] } : { n: [], m: [hit.id] }; selChanged(); if (A.win && A.win.k === 'qinfo') winRefresh(); else openWin('qinfo'); return;
      }
      if (A.tool === 'pan' || A.tool === 'zoomw' || A.tool === 'orbit') { if (A.tool !== 'orbit' || !hit) return; }
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
    function replicate(d, nCopy, connect, withLoads, fn) {
      const m = A.model, nd = nodeMap(), nIds = new Set(A.sel.n); A.sel.m.forEach(id => { const q = m.members.find(z => z.id === id); if (q) { nIds.add(q.i); nIds.add(q.j); } });
      if (!nIds.size) return;
      snap(true);
      const newSel = { n: [], m: [] }; let prev = {}; nIds.forEach(id => { prev[id] = id; });
      for (let c = 1; c <= nCopy; c++) {
        const map = {};
        nIds.forEach(id => { const n = nd[id], p = fn ? fn(P3(n), c) : [(+n.x || 0) + d[0] * c, (+n.y || 0) + d[1] * c, (+n.z || 0) + d[2] * c], nid = ensureNode(p), nn = m.nodes.find(z => z.id === nid); if (n.sup && n.sup !== 'free' && nn.sup === 'free' && !connect) { nn.sup = n.sup; if (n.fix) nn.fix = n.fix.slice(); } map[id] = nid; newSel.n.push(nid); });
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
    const LKIND = () => [['udl', T('Distributed', 'แผ่กระจาย')], ['point', T('Point', 'แรงจุด')], ['moment', T('Moment', 'โมเมนต์')], ['temp', T('Temperature', 'อุณหภูมิ')]];
    const TEMPHINT = () => T('ΔT uniform heats the whole section (axial strain α·ΔT). ΔT_y = T(+y face) − T(−y face) bends about the major axis (for a beam: top minus bottom); ΔT_z = T(+z face) − T(−z face). α is set per material (step 1).', 'ΔT สม่ำเสมอ ทำให้ทั้งหน้าตัดร้อนขึ้น (ความเครียดตามแนวแกน α·ΔT) ΔT_y = T(ผิว +y) − T(ผิว −y) ทำให้ดัดรอบแกนหลัก (คาน: บนลบล่าง) ΔT_z = T(ผิว +z) − T(ผิว −z) ค่า α กำหนดที่วัสดุ (ขั้นที่ 1)');
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
    const cf = (lbl, tb, i, fd, v, type) => { const q = FQ[tb] && FQ[tb][fd]; return fld(q ? `${lbl} <span class="an-u">${ulab(q)}</span>` : lbl, inp(v == null ? '' : q ? uv(v, q) : v, `data-tb="${tb}" data-i="${i}" data-f="${fd}" ${type === 'n' ? 'type="number" step="any" inputmode="decimal"' : ''}`)); };
    const cs2 = (lbl, opts, v, tb, i, fd) => fld(lbl, sel(opts, v, `data-tb="${tb}" data-i="${i}" data-f="${fd}"`));
    function matTable() {
      const m = A.model;
      return `<div class="an-list">${m.materials.map((s, i) => `<div class="an-li ${isOpen('mat', s.id) ? 'open' : ''}" draggable="true" data-dnd="mat:${esc(s.id)}"><div class="an-lirow">${liHead('mat', s.id, '<span class="an-drag" aria-hidden="true">⠿</span>' + esc(s.id), esc(s.name || '') + ' · E ' + f(+s.E, 0) + (s.fc ? " · f'c " + f(+s.fc, 1) : s.fy ? ' · fy ' + f(+s.fy, 0) : ''))}${liDel('materials', i)}</div>
        ${isOpen('mat', s.id) ? `<div class="an-lied">${grid2(cf('ID', 'materials', i, 'id', s.id) + cf(T('Name', 'ชื่อ'), 'materials', i, 'name', s.name))}${`<div class="an-row3">${cf('E (MPa)', 'materials', i, 'E', s.E, 'n')}${cf('ν', 'materials', i, 'nu', s.nu === undefined ? 0.3 : s.nu, 'n')}${cf('γ', 'materials', i, 'rho', s.rho, 'n')}</div><div class="an-row3">${cf(T('Thermal α', 'สัมประสิทธิ์ α'), 'materials', i, 'alpha', s.alpha || F.alphaOf(s) * 1e6, 'n')}</div>`}</div>` : ''}</div>`).join('')}</div>`;
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
      return `<div class="an-list">${m.nodes.slice(0, 400).map(n => `<button class="an-lirow an-pickrow ${A.sel.n.includes(n.id) ? 'on' : ''}" data-act="an-pickn" data-n="${esc(n.id)}"><span class="an-lim">${esc(n.id)}</span><span class="an-lis mono">(${fu(+n.x || 0, 'L', 2)}, ${fu(+n.y || 0, 'L', 2)}, ${fu(+n.z || 0, 'L', 2)})</span><span class="an-lit">${esc(sup(n))}</span></button>`).join('')}</div>` + (m.nodes.length > 400 ? hint(T('First 400 shown — select in the view for the rest.', 'แสดง 400 รายการแรก — เลือกในมุมมองสำหรับส่วนที่เหลือ')) : '');
    }
    function memTable() {
      const m = A.model, nd = nodeMap();
      return `<div class="an-list">${m.members.slice(0, 400).map(q => { const a = nd[q.i], b = nd[q.j], L = a && b ? Math.hypot(...sub(P3(b), P3(a))) : 0; return `<button class="an-lirow an-pickrow ${A.sel.m.includes(q.id) ? 'on' : ''}" data-act="an-pick" data-m="${esc(q.id)}"><span class="an-lim">${esc(q.id)}</span><span class="an-lis">${esc(q.i)}→${esc(q.j)} · ${esc(q.sec)} · ${esc(q.mat)}${q.type === 'truss' ? ' · ' + T('truss', 'โครงถัก') : ''}</span><span class="an-lit mono">${fu(L, 'L', 2)}${ul('L')}</span></button>`; }).join('')}</div>` + (m.members.length > 400 ? hint(T('First 400 shown — select in the view for the rest.', 'แสดง 400 รายการแรก — เลือกในมุมมองสำหรับส่วนที่เหลือ')) : '');
    }
    function caseTable() {
      const m = A.model;
      return `<div class="an-list">${m.cases.map((c, i) => `<div class="an-li an-case ${A.lcase === c.id ? 'on' : ''}"><div class="an-caserow">${inp(c.id, `data-tb="cases" data-i="${i}" data-f="id" aria-label="ID"`)}${inp(c.name, `data-tb="cases" data-i="${i}" data-f="name" aria-label="${T('Description', 'คำอธิบาย')}"`)}${sel(CTYPES().map(q => [q[0], q[0]]), c.type, `data-tb="cases" data-i="${i}" data-f="type" aria-label="${T('Type', 'ประเภท')}" title="${esc((CTYPES().find(q => q[0] === c.type) || [])[1] || '')}"`)}<label class="an-sw" title="${T('Self-weight', 'น้ำหนักตัวเอง')}"><input type="checkbox" data-tb="cases" data-i="${i}" data-f="sw" ${c.sw ? 'checked' : ''}> SW</label><button class="linkbtn" data-act="an-gocase" data-c="${esc(c.id)}" title="${T('Loads in this case', 'แรงในกรณีนี้')}">${m.loads.filter(l => l.case === c.id).length}→</button>${liDel('cases', i)}</div></div>`).join('')}</div>` + hint(T('ID · description · type (G, Q, W, E, O) · SW = self-weight · number of loads.', 'ID · คำอธิบาย · ประเภท (G, Q, W, E, O) · SW = น้ำหนักตัวเอง · จำนวนแรง')) + addBtn('cases', T('Add load case', 'เพิ่มกรณีน้ำหนัก'));
    }
    function dirLabel(l) { return ((l.kind === 'moment' ? MDIRS() : DIRS()).find(d => d[0] === (l.dir || (l.kind === 'moment' ? 'lz' : 'grav'))) || ['', ''])[1].split(' (')[0]; }
    function loadDesc(l) {
      const span = () => (+l.a || (l.b !== '' && l.b != null) ? ` · ${fu(+l.a || 0, 'L', 2)}–${l.b !== '' && l.b != null ? fu(+l.b, 'L', 2) : 'L'}${ul('L')}` : '');
      if (l.kind === 'node') return ['Fx', 'Fy', 'Fz', 'Mx', 'My', 'Mz'].filter(q => +l[q]).map(q => q + ' ' + fu(+l[q], q[0] === 'F' ? 'F' : 'M') + ul(q[0] === 'F' ? 'F' : 'M')).join(', ') || '0';
      if (l.kind === 'udl') return `w ${fu(+l.w1 || 0, 'w')}${l.w2 !== '' && l.w2 != null ? '→' + fu(+l.w2, 'w') : ''}${ul('w')} · ${dirLabel(l)}${span()}`;
      if (l.kind === 'point') return `P ${fu(+l.P || 0, 'F')}${ul('F')} @ ${fu(+l.a || 0, 'L', 2)}${ul('L')} · ${dirLabel(l)}`;
      if (l.kind === 'pres') return T('tendon P ', 'ลวด P ') + fu(+l.P || 0, 'F') + ul('F') + ' · e ' + f(+l.e1 || 0, 0) + ' / ' + f(l.em === '' || l.em == null ? ((+l.e1 || 0) + (+l.e2 || 0)) / 2 : +l.em, 0) + ' / ' + f(+l.e2 || 0, 0) + ' mm';
      if (l.kind === 'settle') return T('settlement ', 'ทรุดตัว ') + ['dx', 'dy', 'dz'].filter(q => +l[q]).map(q => q + ' ' + fu(+l[q], 'd') + ul('d')).join(', ');
      if (l.kind === 'temp') return [['dT', T('ΔT uniform', 'ΔT สม่ำเสมอ')], ['dTy', 'ΔT_y'], ['dTz', 'ΔT_z']].filter(([q]) => +l[q]).map(([q, lb]) => lb + ' ' + (+l[q] > 0 ? '+' : '') + fu(+l[q], 'T', 1) + ul('T')).join(' · ') || 'ΔT 0';
      return `M ${fu(+l.M || 0, 'M')}${ul('M')} @ ${fu(+l.a || 0, 'L', 2)}${ul('L')} · ${dirLabel(l)}`;
    }
    function loadTable(cs) {
      const m = A.model, rows = m.loads.map((l, i) => [l, i]).filter(([l]) => l.case === cs && !l.gen), nGen = m.loads.filter(l => l.case === cs && l.gen).length;
      const genNote = nGen ? hint(nGen + T(' generated load(s) from floors and wind in this case — edit them in Building › Floor Loads / Wind Loads.', ' แรงที่สร้างอัตโนมัติจากพื้นและแรงลมในกรณีนี้ — แก้ไขได้ที่ อาคาร › น้ำหนักบนพื้น / แรงลม')) : '';
      if (!rows.length) return genNote || hint(T('No loads in this case yet.', 'ยังไม่มีแรงในกรณีนี้'));
      const desc = loadDesc;
      return genNote + `<h4>${T('Loads in ', 'แรงในกรณี ')}${esc(cs)} (${rows.length})</h4><div class="an-list">${rows.slice(0, 400).map(([l, i]) => {
        const open = isOpen('load', i), tgt = l.kind === 'node' ? l.node : l.member, on = l.kind === 'node' ? A.sel.n.includes(l.node) : A.sel.m.includes(l.member);
        let ed = '';
        if (open) ed = l.kind === 'node' ? `<div class="an-lied"><div class="an-row3">${['Fx', 'Fy', 'Fz', 'Mx', 'My', 'Mz'].map(q => cf(q, 'loads', i, q, l[q] || 0, 'n')).join('')}</div></div>`
          : l.kind === 'temp' ? `<div class="an-lied">${grid2(cs2(T('Load', 'ชนิด'), LKIND(), l.kind, 'loads', i, 'kind') + '<span></span>')}<div class="an-row3">${cf(T('ΔT uniform', 'ΔT สม่ำเสมอ'), 'loads', i, 'dT', l.dT || 0, 'n')}${cf('ΔT_y', 'loads', i, 'dTy', l.dTy || 0, 'n')}${cf('ΔT_z', 'loads', i, 'dTz', l.dTz || 0, 'n')}</div></div>`
          : `<div class="an-lied">${grid2(cs2(T('Load', 'ชนิด'), LKIND(), l.kind, 'loads', i, 'kind') + cs2(T('Direction', 'ทิศทาง'), l.kind === 'moment' ? MDIRS() : DIRS(), l.dir || (l.kind === 'moment' ? 'lz' : 'grav'), 'loads', i, 'dir'))}<div class="an-row4">${cf(l.kind === 'udl' ? 'w₁' : l.kind === 'point' ? 'P' : 'M', 'loads', i, l.kind === 'udl' ? 'w1' : l.kind === 'point' ? 'P' : 'M', l.kind === 'udl' ? l.w1 : l.kind === 'point' ? l.P : l.M, 'n')}${l.kind === 'udl' ? cf('w₂', 'loads', i, 'w2', l.w2, 'n') : '<span></span>'}${cf('a', 'loads', i, 'a', l.a, 'n')}${l.kind === 'udl' ? cf('b', 'loads', i, 'b', l.b, 'n') : '<span></span>'}</div></div>`;
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
      if (nN === 1) { const n = nd[A.sel.n[0]]; if (!n) return ''; return blk(T('Node', 'จุดต่อ') + ' ' + esc(n.id), `<div class="an-row4">${fld('ID', ins('nid', n.id))}${fld('X' + ul('L'), ins('x', uv(n.x, 'L'), 'n'))}${fld('Y' + ul('L'), ins('y', uv(n.y, 'L'), 'n'))}${fld('Z' + ul('L'), ins('z', uv(n.z, 'L'), 'n'))}</div>${hint(T('Support: ', 'จุดรองรับ: ') + esc((SUP().find(q => q[0] === (n.sup || 'free')) || [])[1] || '') + ' — ' + T('change it in step 5.', 'แก้ไขในขั้นตอนที่ 5'))}`); }
      return blk(nN + ' ' + T('nodes — move by', 'จุดต่อ — เลื่อนไป'), `<div class="an-row4">${fld('ΔX' + ul('L'), num('an-mx', 0))}${fld('ΔY' + ul('L'), num('an-my', 0))}${fld('ΔZ' + ul('L'), num('an-mz', 0))}<span class="an-f"><span>&nbsp;</span><button class="btn btn-ghost xs" data-act="an-move">${T('Move', 'เลื่อน')}</button></span></div>`);
    }
    function memEditor() {
      const m = A.model, nd = nodeMap(), nM = A.sel.m.length;
      if (nM === 1) {
        const q = m.members.find(z => z.id === A.sel.m[0]); if (!q) return '';
        const i0 = nd[q.i], j0 = nd[q.j], L = i0 && j0 ? Math.hypot(...sub(P3(j0), P3(i0))) : 0, s = m.sections.find(z => z.id === q.sec), p = s ? F.secProps(s) : null, no = nodeOpts();
        return blk(T('Element', 'ชิ้นส่วน') + ' ' + esc(q.id) + ` <span class="muted small">L = ${fu(L, 'L')}${ul('L')}</span>`, `<div class="an-row3">${fld('ID', ins('mid', q.id))}${fld(T('Node i', 'จุด i'), sel(no, q.i, 'data-ins="i"'))}${fld(T('Node j', 'จุด j'), sel(no, q.j, 'data-ins="j"'))}</div>
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
      return `<details class="an-blk an-det" ${A.repOpen ? 'open' : ''} id="an-rep"><summary><b>${T('Replicate / extrude the selection', 'คัดลอก / ยืดส่วนที่เลือก')}</b></summary><div class="an-row4">${fld('ΔX' + ul('L'), num('an-rx', A.rep ? uv(A.rep[0], 'L') : 0))}${fld('ΔY' + ul('L'), num('an-ry', A.rep ? uv(A.rep[1], 'L') : 0))}${fld('ΔZ' + ul('L'), num('an-rz', uv(A.rep ? A.rep[2] : 3.5, 'L')))}${fld(T('Copies', 'จำนวน'), `<input id="an-rn" type="number" min="1" max="50" value="${A.rep ? A.rep[3] : 1}">`)}</div>
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
    function memOK(mb) { const m = A.model; return !!mb.sec && !!mb.mat && m.sections.some(q => q.id === mb.sec) && m.materials.some(q => q.id === mb.mat); }
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
    const WIN_T = () => ({ mat: T('Add material', 'เพิ่มวัสดุ'), sec: T('Add section', 'เพิ่มหน้าตัด'), node: T('Add node', 'เพิ่มจุดต่อ'), elem: T('Add element', 'เพิ่มชิ้นส่วน'), sup: T('Assign support', 'กำหนดจุดรองรับ'), case: T('Add load case', 'เพิ่มกรณีน้ำหนัก'), load: T('Add load', 'เพิ่มแรง'), combo: T('Add load combination', 'เพิ่มการรวมน้ำหนัก'), help: T('Help — shortcuts and mouse', 'วิธีใช้ — ปุ่มลัดและเมาส์') });
    const winTitle = k => (RW[k] ? RW[k].t() : WIN_T()[k] || '');
    const WADD = ['mat', 'sec', 'node', 'elem', 'sup', 'case', 'load', 'combo'];
    A.wv = {};
    function wdef(k) {
      const m = A.model, d = stdInfo(m.std);
      if (A.wv[k]) return A.wv[k];
      if (RW[k]) { A.wv[k] = RW[k].def ? RW[k].def() : {}; return A.wv[k]; }
      const v = {
        mat: { kind: 'conc', grade: DEFS[m.std].conc, sgrade: DEFS[m.std].steel, id: '', name: '', E: 200000, nu: 0.3, rho: 78.5 },
        sec: { type: 'rect', b: 300, h: 600, D: 400, series: d.series[0], size: SL.LIB[d.series[0]] ? SL.sizes(d.series[0])[6] || SL.sizes(d.series[0])[0] : '', shape: 'SHS', tsize: '150x150x6', d: 400, bf: 200, tf: 12, tw: 8, A: 10000, Iz: 100e6, Iy: 50e6, J: 20e6, id: '' },
        node: { x: 0, y: 0, z: 0 },
        elem: { i: (m.nodes[0] || {}).id || '', j: (m.nodes[1] || {}).id || '', sec: A.lastSec || (m.sections[0] || {}).id || '', mat: A.lastMat || (m.materials[0] || {}).id || '', type: 'frame', beta: 0 },
        sup: { sup: 'fixed', ids: '' },
        case: { id: '', name: '', type: 'O', sw: false },
        load: { case: A.lcase || (m.cases[0] || {}).id || '', on: A.sel.n.length && !A.sel.m.length ? 'node' : 'elem', ids: '', kind: 'udl', dir: 'grav', w1: 10, w2: '', a: '', b: '', Fx: 0, Fy: 0, Fz: -10, Mx: 0, My: 0, Mz: 0, dT: 20, dTy: 0, dTz: 0 },
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
    function helpHTML() {
      const K = s => (s === '+' ? ['+'] : s.split('+')).map(q => `<kbd>${esc(q)}</kbd>`).join('+'), rows = (h, list) => `<h4>${h}</h4><dl class="an-keys">${list.map(([k, d]) => `<div><dt>${k.split(' / ').map(K).join(' / ')}</dt><dd>${d}</dd></div>`).join('')}</dl>`;
      return `<div class="an-help">` +
        rows(T('Mouse — Select tool', 'เมาส์ — เครื่องมือเลือก'), [
          [T('Click', 'คลิก'), T('Pick a node or element', 'เลือกจุดต่อหรือชิ้นส่วน')],
          [T('Shift+Click', 'Shift+คลิก'), T('Add / remove one item', 'เพิ่ม / ลบทีละรายการ')],
          [T('Drag →', 'ลาก →'), T('Window box — only items fully inside', 'กรอบหน้าต่าง — เฉพาะที่อยู่ในกรอบทั้งหมด')],
          [T('Drag ←', 'ลาก ←'), T('Crossing box — anything the box touches', 'กรอบตัดผ่าน — ทุกอย่างที่กรอบสัมผัส')],
          [T('Ctrl+Drag', 'Ctrl+ลาก'), T('Add a box to the selection', 'เพิ่มกรอบในการเลือก')],
          [T('Alt+Drag', 'Alt+ลาก'), T('Remove a box from the selection', 'ลบกรอบออกจากการเลือก')],
          [T('Click empty space', 'คลิกที่ว่าง'), T('Clear the selection', 'ล้างการเลือก')]]) +
        rows(T('Mouse — view', 'เมาส์ — มุมมอง'), [
          [T('Shift+Drag', 'Shift+ลาก'), T('Rotate (3D) · pan (plan / elevation)', 'หมุน (3D) · เลื่อน (แปลน / รูปด้าน)')],
          [T('Right-drag', 'ลากคลิกขวา'), T('Rotate (3D) · pan (plan / elevation)', 'หมุน (3D) · เลื่อน (แปลน / รูปด้าน)')],
          [T('Middle-drag / Shift+Right-drag', 'ลากปุ่มกลาง / Shift+ลากคลิกขวา'), T('Pan', 'เลื่อน')],
          [T('Wheel', 'ล้อเมาส์'), T('Zoom at the cursor', 'ซูมที่ตำแหน่งเมาส์')],
          [T('Two fingers', 'สองนิ้ว'), T('Pinch to zoom (touch)', 'บีบเพื่อซูม (หน้าจอสัมผัส)')],
          [T('Drag from tree', 'ลากจากเมนู'), T('Drop a material / section / release onto an element, a support onto a node', 'วางวัสดุ / หน้าตัด / การปลดแรงบนชิ้นส่วน หรือจุดรองรับบนจุดต่อ')]]) +
        rows(T('Keyboard', 'แป้นพิมพ์'), [
          ['? / F1', T('Open this help', 'เปิดหน้าวิธีใช้นี้')],
          ['S', T('Select tool', 'เครื่องมือเลือก')], ['O', T('Orbit tool', 'เครื่องมือหมุน')], ['N', T('Node tool — click to place nodes', 'เครื่องมือจุดต่อ — คลิกเพื่อวางจุดต่อ')], ['E', T('Element tool — click node to node', 'เครื่องมือชิ้นส่วน — คลิกจากจุดต่อไปจุดต่อ')],
          ['3', T('3D view', 'มุมมอง 3D')], ['P', T('Plan view', 'แปลน')], ['X', T('Elevation X–Z', 'รูปด้าน X–Z')], ['Y', T('Elevation Y–Z', 'รูปด้าน Y–Z')],
          ['F', T('Zoom to fit', 'ซูมให้พอดี')], ['+ / -', T('Zoom in / out', 'ซูมเข้า / ออก')], ['← / → / ↑ / ↓', T('Rotate the 3D view (pan in 2D)', 'หมุนมุมมอง 3D (เลื่อนใน 2D)')],
          ['W', T('Toggle wire / solid sections', 'สลับเส้น / หน้าตัดทรงตัน')], ['L', T('Loads on / off', 'แสดง / ซ่อนแรง')], ['T', T('Labels on / off', 'แสดง / ซ่อนป้ายชื่อ')],
          ['Ctrl+A', T('Select all', 'เลือกทั้งหมด')], ['I', T('Invert the selection', 'กลับการเลือก')], ['Esc', T('Cancel all: the whole selection, drawing and temporary tools (press again to close the window)', 'ยกเลิกทั้งหมด: การเลือก การวาด และเครื่องมือชั่วคราว (กดอีกครั้งเพื่อปิดหน้าต่าง)')],
          ['Delete / Backspace', T('Delete the selection', 'ลบรายการที่เลือก')],
          ['Ctrl+Z', T('Undo', 'เลิกทำ')], ['Ctrl+Y / Ctrl+Shift+Z', T('Redo', 'ทำซ้ำ')],
          ['Ctrl+Enter', T('Run the analysis', 'วิเคราะห์โครงสร้าง')]]) +
        rows(T('Workflow', 'ขั้นตอนการทำงาน'), [
          ['0 → 10', T('Work down the MAIN MENU: standard, materials, sections, nodes, elements, supports, load cases, loads, combinations, run, results.', 'ทำตาม MAIN MENU จากบนลงล่าง: มาตรฐาน วัสดุ หน้าตัด จุดต่อ ชิ้นส่วน จุดรองรับ กรณีน้ำหนัก แรง การรวมน้ำหนัก วิเคราะห์ ผลลัพธ์')],
          ['+', T('The + beside a step opens a movable window to add items.', 'ปุ่ม + ข้างแต่ละขั้นเปิดหน้าต่างที่ย้ายได้เพื่อเพิ่มรายการ')],
          [T('Loads:', 'แรง:'), T('Pick a load case to show only its loads in the view.', 'เลือกกรณีน้ำหนักเพื่อแสดงเฉพาะแรงของกรณีนั้น')]]) +
        `<p class="muted small">${T('Units: change force, length and temperature at the bottom right of the view (now ' + ulab('F') + ', ' + ulab('L') + ', ' + ulab('T') + '). Sections are always in mm and E in MPa. Global axes X, Y horizontal, Z up. On a Mac use ⌘ for Ctrl and ⌥ for Alt.', 'หน่วย: เปลี่ยนหน่วยแรง ความยาว และอุณหภูมิได้ที่มุมขวาล่างของมุมมอง หน้าตัดเป็น mm · E เป็น MPa แกน X, Y แนวนอน Z ขึ้น บน Mac ใช้ ⌘ แทน Ctrl และ ⌥ แทน Alt')}</p></div>`;
    }
    function winBody(k) {
      if (k === 'help') return helpHTML();
      if (RW[k]) return RW[k].body(wdef(k));
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
      if (k === 'node') return `<div class="an-row3">${wf('x', 'X' + ul('L'), v.x, 'n')}${wf('y', 'Y' + ul('L'), v.y, 'n')}${wf('z', 'Z' + ul('L'), v.z, 'n')}</div>` + hint(T('The window stays open — change the coordinates and add the next node.', 'หน้าต่างยังเปิดอยู่ — แก้พิกัดแล้วเพิ่มจุดต่อถัดไปได้')) + add(T('Add node', 'เพิ่มจุดต่อ'));
      if (k === 'elem') { const no = nodeOpts(); return `<div class="an-row2">${ws('i', T('Node i', 'จุด i'), no, v.i)}${ws('j', T('Node j', 'จุด j'), no, v.j)}</div><div class="an-row2">${ws('sec', T('Section', 'หน้าตัด'), secOpts(), v.sec)}${ws('mat', T('Material', 'วัสดุ'), matOpts(), v.mat)}</div><div class="an-row2">${ws('type', T('Type', 'ชนิด'), [['frame', T('Frame', 'โครงข้อแข็ง')], ['truss', T('Truss', 'โครงถัก')]], v.type)}${wf('beta', 'β (°)', v.beta, 'n')}</div>` + add(T('Add element', 'เพิ่มชิ้นส่วน')); }
      if (k === 'sup') return ws('sup', T('Support', 'จุดรองรับ'), SUP().filter(q => q[0] !== 'custom'), v.sup) + wf('ids', T('Node IDs, comma separated (blank = selected nodes: ', 'ID จุดต่อ คั่นด้วยจุลภาค (ว่าง = จุดที่เลือก: ') + A.sel.n.length + ')', v.ids, '', 'placeholder="N1, N2"') + hint(T('Tip: you can also drag a support type from step 5 onto a node in the view.', 'เคล็ดลับ: ลากชนิดจุดรองรับจากขั้นที่ 5 ไปวางบนจุดต่อในมุมมองได้')) + add(T('Apply', 'กำหนด'));
      if (k === 'case') return `<div class="an-row2">${wf('id', T('Name (ID)', 'ชื่อ (ID)'), v.id, '', 'placeholder="' + nextId(m.cases, 'L') + '"')}${ws('type', T('Type', 'ประเภท'), CTYPES(), v.type)}</div>${wf('name', T('Description', 'คำอธิบาย'), v.name)}<label class="chkl"><input type="checkbox" data-w="sw" ${v.sw ? 'checked' : ''}> ${T('Include self-weight', 'รวมน้ำหนักตัวเอง')}</label>` + add(T('Add load case', 'เพิ่มกรณีน้ำหนัก'));
      if (k === 'load') {
        const isN = v.on === 'node', cnt = isN ? A.sel.n.length : A.sel.m.length;
        return `<div class="an-row2">${ws('case', T('Load case', 'กรณีน้ำหนัก'), caseOpts(), v.case)}${ws('on', T('Apply to', 'ใส่ที่'), [['elem', T('Elements', 'ชิ้นส่วน')], ['node', T('Nodes', 'จุดต่อ')]], v.on)}</div>` + wf('ids', (isN ? T('Node IDs', 'ID จุดต่อ') : T('Element IDs', 'ID ชิ้นส่วน')) + T(' (blank = selected: ', ' (ว่าง = ที่เลือก: ') + cnt + ')', v.ids, '', 'placeholder="' + (isN ? 'N1, N2' : 'M1, M2') + '"') +
          (isN ? `<div class="an-row3">${['Fx', 'Fy', 'Fz', 'Mx', 'My', 'Mz'].map(q => wf(q, q + ul(q[0] === 'F' ? 'F' : 'M'), v[q], 'n')).join('')}</div>`
            : v.kind === 'temp' ? `<div class="an-row2">${ws('kind', T('Load', 'ชนิด'), LKIND(), v.kind)}<span></span></div><div class="an-row3">${wf('dT', T('ΔT uniform', 'ΔT สม่ำเสมอ') + ul('T'), v.dT, 'n')}${wf('dTy', 'ΔT_y' + ul('T'), v.dTy, 'n')}${wf('dTz', 'ΔT_z' + ul('T'), v.dTz, 'n')}</div>` + hint(TEMPHINT())
            : `<div class="an-row2">${ws('kind', T('Load', 'ชนิด'), LKIND(), v.kind)}${ws('dir', T('Direction', 'ทิศทาง'), v.kind === 'moment' ? MDIRS() : DIRS(), v.kind === 'moment' && !MDIRS().some(q => q[0] === v.dir) ? 'lz' : v.dir)}</div><div class="an-row4">${wf('w1', v.kind === 'udl' ? 'w₁' + ul('w') : v.kind === 'point' ? 'P' + ul('F') : 'M' + ul('M'), v.w1, 'n')}${v.kind === 'udl' ? wf('w2', 'w₂', v.w2, 'n') : '<span></span>'}${wf('a', 'a' + ul('L'), v.a, 'n')}${v.kind === 'udl' ? wf('b', 'b' + ul('L'), v.b, 'n') : '<span></span>'}</div>`) + add(T('Add load', 'เพิ่มแรง'));
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
      host.innerHTML = `<div class="an-win" id="anWin" role="dialog" aria-label="${esc(winTitle(k))}" data-k="${k}" style="left:${A.win.x}px;top:${A.win.y}px"><div class="an-winhead" title="${T('Drag to move', 'ลากเพื่อย้าย')}"><span class="an-grip" aria-hidden="true">⋮⋮</span><b>${esc(winTitle(k))}</b><span class="grow"></span><button class="icon-btn" data-act="an-wclose" aria-label="${T('Close', 'ปิด')}">×</button></div><div class="an-winbody">${winBody(k)}</div></div>`;
      const w = host.firstChild, hd = w.querySelector('.an-winhead');
      hd.addEventListener('pointerdown', e => {
        if (e.target.closest('button')) return;
        const r = w.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top; hd.setPointerCapture(e.pointerId);
        const mv = ev => { A.win.x = Math.max(0, Math.min(innerWidth - 80, ev.clientX - ox)); A.win.y = Math.max(0, Math.min(innerHeight - 40, ev.clientY - oy)); w.style.left = A.win.x + 'px'; w.style.top = A.win.y + 'px'; };
        const upf = () => { hd.removeEventListener('pointermove', mv); hd.removeEventListener('pointerup', upf); hd.removeEventListener('pointercancel', upf); };
        hd.addEventListener('pointermove', mv); hd.addEventListener('pointerup', upf); hd.addEventListener('pointercancel', upf);
      });
    }
    const WIDE = ['stdw', 'ntab', 'etab', 'ltab', 'lsum', 'qnt', 'qet', 'qwt', 'qms', 'pmt', 'pst', 'btab', 'actl', 'qinfo', 'stat', 'sw'];
    function openWin(k) { const W0 = Math.min(WIDE.includes(k) ? (['actl', 'qinfo', 'stat', 'sw', 'stdw'].includes(k) ? 520 : 820) : k === 'help' ? 520 : 440, innerWidth - 20); A.win = { k, x: A.win ? A.win.x : Math.max(10, Math.min(innerWidth - W0 - 10, 400)), y: A.win ? A.win.y : (() => { const r = $('#anRib'); return r ? Math.round(r.getBoundingClientRect().bottom + 8) : 90; })() }; if (k === 'load') { delete A.wv.load; } winRefresh(); }
    const idList = s0 => String(s0 || '').split(/[,\s]+/).map(q => q.trim()).filter(Boolean);
    function winAdd() {
      const k = A.win.k, v = wdef(k), m = A.model;
      if (RW[k] && RW[k].add) { RW[k].add(v); if (A.win) winRefresh(); return; }
      if (k === 'mat') {
        const g = v.kind === 'conc' ? concMat(m.std, v.grade) : v.kind === 'steel' ? steelMat(m.std, v.sgrade) : { id: (v.id || '').trim() || nextId(m.materials, 'MAT'), name: v.name || '', kind: 'other', E: +v.E || 200000, nu: +v.nu || 0.3, rho: +v.rho || 0 };
        if (m.materials.some(q => q.id === g.id)) { toast(T(g.id + ' is already in the list.', g.id + ' มีอยู่แล้ว'), ''); return; }
        snap(true); m.materials.push(g); A.lastMat = g.id; changed(true); toast(T('Added material ', 'เพิ่มวัสดุ ') + g.id, 'ok');
      } else if (k === 'sec') {
        const s0 = wsecObj(v), auto = { rect: 'R' + v.b + 'x' + v.h, circ: 'D' + v.D, std: String(v.size).replace(/\s+/g, ''), tube: v.shape + ' ' + v.tsize, I: 'I' + v.d + 'x' + v.bf, user: nextId(m.sections, 'S') }[v.type];
        s0.id = (v.id || '').trim() || auto; s0.name = v.type === 'std' ? v.size : v.type === 'tube' ? v.shape + ' ' + String(v.tsize).replace(/x/g, '×') : v.type === 'rect' ? v.b + '×' + v.h : v.type === 'circ' ? 'Ø' + v.D : '';
        if (m.sections.some(q => q.id === s0.id)) { toast(T(s0.id + ' is already in the list.', s0.id + ' มีอยู่แล้ว'), ''); return; }
        snap(true); m.sections.push(s0); A.lastSec = s0.id; changed(true); toast(T('Added section ', 'เพิ่มหน้าตัด ') + s0.id, 'ok');
      } else if (k === 'node') { snap(true); const id = ensureNode([frU(+v.x || 0, 'L'), frU(+v.y || 0, 'L'), frU(+v.z || 0, 'L')]); A.sel = { n: [id], m: [] }; changed(true); redraw(true); toast(T('Node ', 'จุดต่อ ') + id, 'ok'); }
      else if (k === 'elem') { if (!v.i || !v.j || v.i === v.j) { toast(T('Choose two different nodes.', 'เลือกจุดต่อสองจุดที่ต่างกัน'), 'bad'); return; } snap(true); const id = addMember(v.i, v.j, { sec: v.sec, mat: v.mat, type: v.type, beta: +v.beta || 0 }); if (!id) { toast(T('That element already exists.', 'มีชิ้นส่วนนี้แล้ว'), 'bad'); return; } A.sel = { n: [], m: [id] }; changed(true); toast(T('Element ', 'ชิ้นส่วน ') + id, 'ok'); }
      else if (k === 'sup') { const ids = idList(v.ids).length ? idList(v.ids) : A.sel.n, ns = ids.map(id => m.nodes.find(q => q.id === id)).filter(Boolean); if (!ns.length) { toast(T('Select nodes or type their IDs.', 'เลือกจุดต่อหรือพิมพ์ ID'), 'bad'); return; } snap(true); ns.forEach(n => { n.sup = v.sup; }); changed(true); toast(T('Support set on ' + ns.length + ' node(s)', 'กำหนดจุดรองรับ ' + ns.length + ' จุด'), 'ok'); }
      else if (k === 'case') { const id = (v.id || '').trim() || nextId(m.cases, 'L'); if (m.cases.some(c => c.id === id)) { toast(T(id + ' already exists.', id + ' มีอยู่แล้ว'), 'bad'); return; } snap(true); m.cases.push({ id, name: v.name || id, type: v.type, sw: !!v.sw }); A.lcase = id; A.wv.case = null; changed(true); toast(T('Load case ', 'กรณีน้ำหนัก ') + id, 'ok'); }
      else if (k === 'load') {
        const isN = v.on === 'node', ids = idList(v.ids).length ? idList(v.ids) : isN ? A.sel.n : A.sel.m, ok = ids.filter(id => (isN ? m.nodes : m.members).some(q => q.id === id));
        if (!ok.length) { toast(T('Select ' + (isN ? 'nodes' : 'elements') + ' or type their IDs.', 'เลือก' + (isN ? 'จุดต่อ' : 'ชิ้นส่วน') + 'หรือพิมพ์ ID'), 'bad'); return; }
        snap(true);
        const cF = x => frU(+x || 0, 'F'), cM = x => frU(+x || 0, 'M'), cL = x => (x === '' || x == null ? '' : frU(+x, 'L')), cW = x => (x === '' || x == null ? '' : frU(+x, 'w'));
        ok.forEach(id => { if (isN) m.loads.push(nload(v.case, id, { Fx: cF(v.Fx), Fy: cF(v.Fy), Fz: cF(v.Fz), Mx: cM(v.Mx), My: cM(v.My), Mz: cM(v.Mz) })); else if (v.kind === 'temp') m.loads.push({ case: v.case, kind: 'temp', member: id, dT: frU(+v.dT || 0, 'T'), dTy: frU(+v.dTy || 0, 'T'), dTz: frU(+v.dTz || 0, 'T') }); else if (v.kind === 'udl') m.loads.push({ case: v.case, kind: 'udl', member: id, dir: v.dir, w1: cW(v.w1) || 0, w2: cW(v.w2), a: cL(v.a), b: cL(v.b) }); else m.loads.push(Object.assign({ case: v.case, member: id, a: v.a === '' ? 0 : cL(v.a) }, v.kind === 'point' ? { kind: 'point', dir: v.dir, P: cF(v.w1) } : { kind: 'moment', dir: MDIRS().some(q => q[0] === v.dir) ? v.dir : 'lz', M: cM(v.w1) })); });
        A.lcase = v.case; changed(true); toast(T('Load added to ' + ok.length + ' item(s) in ' + v.case, 'เพิ่มแรง ' + ok.length + ' รายการ ในกรณี ' + v.case), 'ok');
      }
      winRefresh();
    }

    // ------------------------------------------------------------------ drag a property from the tree onto the model
    function dropApply(val, hit) {
      const m = A.model, i = val.indexOf(':'), k = val.slice(0, i), id = val.slice(i + 1);
      if (k === 'sec' || k === 'mat' || k === 'rel') {
        const ids = A.sel.m.length ? A.sel.m.slice() : hit && hit.k === 'm' ? [hit.id] : null;
        if (!ids) { toast(T('Select elements first, then drag the property onto the view.', 'เลือกชิ้นส่วนก่อน แล้วลากคุณสมบัติไปวางบนมุมมอง'), 'bad'); return; }
        const mems = ids.map(q => m.members.find(z => z.id === q)).filter(Boolean);
        snap(true);
        mems.forEach(q => { if (k === 'sec') q.sec = id; else if (k === 'mat') q.mat = id; else if (id === 'truss') q.type = 'truss'; else { q.type = 'frame'; q.relI = id === 'i' || id === 'both'; q.relJ = id === 'j' || id === 'both'; } });
        A.sel = { n: [], m: ids }; changed(true);
        toast((k === 'sec' ? T('Section ', 'หน้าตัด ') : k === 'mat' ? T('Material ', 'วัสดุ ') : T('End release ', 'การปลดแรงปลาย ')) + id + T(' → ' + mems.length + ' element(s)', ' → ' + mems.length + ' ชิ้นส่วน'), 'ok');
      } else if (k === 'sup') {
        const ids = A.sel.n.length ? A.sel.n.slice() : hit && hit.k === 'n' ? [hit.id] : null;
        if (!ids) { toast(T('Select nodes first, then drag the support onto the view.', 'เลือกจุดต่อก่อน แล้วลากจุดรองรับไปวางบนมุมมอง'), 'bad'); return; }
        snap(true);
        ids.forEach(q => { const n = m.nodes.find(z => z.id === q); if (n) n.sup = id; }); A.sel = { n: ids, m: [] }; changed(true);
        toast(T('Support ', 'จุดรองรับ ') + id + T(' → ' + ids.length + ' node(s)', ' → ' + ids.length + ' จุด'), 'ok');
      }
    }
    function dndHint(k) {
      const n = k === 'sup' ? A.sel.n.length : A.sel.m.length, what = { mat: T('material', 'วัสดุ'), sec: T('section', 'หน้าตัด'), sup: T('support', 'จุดรองรับ'), rel: T('end release', 'การปลดแรงปลาย') }[k];
      const miss = k === 'mat' || k === 'sec' ? A.model.members.filter(q => !memOK(q)).length : 0;
      return `<div class="an-dnd ${n ? 'on' : ''}">${n ? `<b>${n} ${k === 'sup' ? T('node(s)', 'จุดต่อ') : T('element(s)', 'ชิ้นส่วน')} ${T('selected', 'ที่เลือก')}</b> — ${T('drag a ' + what + ' from the list and drop it anywhere on the view to apply it to them.', 'ลาก' + what + 'จากรายการไปวางที่ใดก็ได้บนมุมมองเพื่อกำหนดให้')}` : `1. ${T('Select ' + (k === 'sup' ? 'nodes' : 'elements') + ' in the view (click, Shift-click or drag a box).', 'เลือก' + (k === 'sup' ? 'จุดต่อ' : 'ชิ้นส่วน') + 'ในมุมมอง (คลิก Shift-คลิก หรือลากกรอบ)')}<br>2. ${T('Drag a ' + what + ' from the list and drop it on the view.', 'ลาก' + what + 'จากรายการไปวางบนมุมมอง')}`}${miss ? `<br><span class="an-miss">● ${miss} ${T('element(s) without section or material are shown in red.', 'ชิ้นส่วนที่ยังไม่มีหน้าตัดหรือวัสดุแสดงเป็นสีแดง')}</span>` : ''}</div>`;
    }
    const DRAG_SUPS = () => [['fixed', T('Fixed', 'ยึดแน่น')], ['pin', T('Pinned', 'หมุด')], ['roller', T('Roller Z', 'ล้อเลื่อน Z')], ['rollerX', T('Roller, X free', 'ล้อเลื่อน X')], ['rollerY', T('Roller, Y free', 'ล้อเลื่อน Y')], ['free', T('Free', 'อิสระ')]];
    const DRAG_RELS = () => [['none', T('Rigid', 'ยึดแน่น')], ['i', T('Pin at i', 'หมุดที่ i')], ['j', T('Pin at j', 'หมุดที่ j')], ['both', T('Pin both ends', 'หมุดสองปลาย')], ['truss', T('Truss', 'โครงถัก')]];
    const chips = (k, list) => `<div class="an-chips2">${list.map(([v, l]) => `<span class="an-chip" draggable="true" data-dnd="${k}:${esc(v)}" title="${T('Drag onto the view to apply to the selection', 'ลากไปวางบนมุมมองเพื่อกำหนดให้ส่วนที่เลือก')}">⠿ ${l}</span>`).join('')}</div>`;

    // ------------------------------------------------------------------ model tree (left): steps 0–10
    const STEPS = () => {
      const m = A.model, nSup = m.nodes.filter(n => F.fixOf(n).some(Boolean)).length;
      return [
        ['mat', T('Material properties', 'คุณสมบัติวัสดุ'), m.materials.length],
        ['sec', T('Section properties', 'คุณสมบัติหน้าตัด'), m.sections.length],
        ['node', T('Nodes', 'จุดต่อ'), m.nodes.length],
        ['elem', T('Elements', 'ชิ้นส่วน'), m.members.length],
        ['sup', T('Supports & end releases', 'จุดรองรับและการปลดแรงปลาย'), nSup],
        ['case', T('Load cases', 'กรณีน้ำหนัก'), m.cases.length],
        ['load', T('Apply loads', 'ใส่แรงกระทำ'), m.loads.length],
        ['combo', T('Load combinations', 'การรวมน้ำหนัก'), m.combos.length],
        ...(BLD ? [['bld', T('Building: grids, floors & wind', 'อาคาร: กริด พื้น และแรงลม'), ((m.bld || {}).slabs || []).length]] : []),
        ...(BRG ? [['brg', T('Bridge loads & stages', 'น้ำหนักสะพานและขั้นตอน'), ((m.bridge || {}).mlc || []).length + ((m.bridge || {}).stages || []).length]] : []),
        ['run', T('Run analysis', 'วิเคราะห์โครงสร้าง'), fresh() ? '✓' : A.err && A.resVer === A.ver ? '!' : '—'],
        ['res', T('Results', 'ผลการวิเคราะห์'), fresh() ? '✓' : '—']
      ];
    };
    function treeHTML() {
      return `<nav class="an-tree" aria-label="${T('Main menu', 'เมนูหลัก')}"><div class="an-treehead">${T('MAIN MENU', 'เมนูหลัก')}${BRG ? `<span class="an-modechip">${T('BRIDGE', 'สะพาน')}</span>` : BLD ? `<span class="an-modechip">${T('BUILDING', 'อาคาร')}</span>` : ''}<span class="grow"></span><button class="an-stdchip" data-act="an-rb" data-c="gostd" title="${T('Design standard — change it in the ribbon: Structure › Design Standard', 'มาตรฐานการออกแบบ — เปลี่ยนได้ที่ริบบอน: โครงสร้าง › มาตรฐาน')}">${icon('book')}${esc(A.model.std)} · ${esc(T(stdInfo(A.model.std).name[0], stdInfo(A.model.std).name[1]))}</button></div>${STEPS().map(([k, l, c], i) => { const open = A.step === k, st = k === 'run' || k === 'res' ? (fresh() ? 'ok' : A.err && A.resVer === A.ver && k === 'run' ? 'bad' : '') : ''; return `<div class="an-node ${open ? 'open' : ''}"><div class="an-throw"><button class="an-th" data-act="an-step" data-s="${k}" aria-expanded="${open}"><span class="an-num">${i + 1}</span><span class="an-tl">${l}</span><span class="an-cnt ${st}" data-s="${k}">${esc(String(c))}</span><span class="an-chev" aria-hidden="true">›</span></button>${WADD.includes(k) ? `<button class="an-plus" data-act="an-win" data-k="${k}" title="${esc(winTitle(k))}" aria-label="${esc(winTitle(k))}">+</button>` : '<span class="an-plus0"></span>'}</div>${open ? `<div class="an-panel">${panel(k)}</div>` : ''}</div>`; }).join('')}</nav>`;
    }
    function updCounts() { STEPS().forEach(([k, , c]) => { const e = document.querySelector('.an-cnt[data-s="' + k + '"]'); if (e) { e.textContent = String(c); e.classList.toggle('ok', (k === 'run' || k === 'res') && fresh()); } }); }
    function sideRefresh() { const s = $('#anSide'); if (!s) return; const sc = s.scrollTop; s.innerHTML = treeHTML(); s.scrollTop = sc; }
    function panel(k) {
      const m = A.model, d = stdInfo(m.std);
      if (k === 'std') return hint(T('Choose the design standard first. It sets the concrete and steel grades (step 1), the steel section tables (step 2) and the load combination rules (step 8).', 'เลือกมาตรฐานก่อน มาตรฐานจะกำหนดชั้นคุณภาพคอนกรีตและเหล็ก (ขั้นที่ 1) ตารางหน้าตัดเหล็ก (ขั้นที่ 2) และกฎการรวมน้ำหนัก (ขั้นที่ 8)')) +
        `<div class="an-stds">${STDS.map(q => { const v = stdInfo(q); return `<button class="an-std ${m.std === q ? 'on' : ''}" data-act="an-std" data-k="${q}" aria-pressed="${m.std === q}"><b>${T(v.name[0], v.name[1])}</b><span class="mono">${esc(v.codes)}</span><small>${T('Concrete', 'คอนกรีต')} ${esc(v.conc[0][0])}–${esc(v.conc[v.conc.length - 1][0])} · ${T('steel', 'เหล็ก')} ${v.steel.map(s => esc(s[0])).join(', ')} · ${v.series.join(', ')}</small></button>`; }).join('')}</div>` +
        hint(T('Units: ', 'หน่วย: ') + ulab('F') + ', ' + ulab('L') + ', ' + ulab('M') + ', ' + ulab('T') + T(' (change them at the bottom right of the view; sections in mm, E in MPa). Global axes: X, Y horizontal, Z up.', ' (เปลี่ยนได้ที่มุมขวาล่างของมุมมอง; หน้าตัดเป็น มม., E เป็น MPa) แกนหลัก: X, Y แนวราบ, Z ชี้ขึ้น')) +
        `<div class="an-quick"><span>${T('Quick start', 'เริ่มต้นด่วน')}</span><button class="btn btn-hot xs" data-act="an-rb" data-c="sample">${T('Load sample building', 'โหลดอาคารตัวอย่าง')}</button>${[['shed', T('Steel shed', 'โรงงานเหล็ก')], ['portal', T('Portal frame', 'โครงข้อแข็ง')], ['beam', T('Continuous beam', 'คานต่อเนื่อง')], ['truss', T('Truss', 'โครงถัก')], ['blank', T('Empty', 'ว่าง')]].map(([k, l]) => `<button class="btn btn-ghost xs" data-act="an-rb" data-c="qt" data-v="${k}">${l}</button>`).join('')}</div>` +
        `<div class="an-adds"><button class="btn btn-ghost xs" data-act="an-tplopen">${T('Start from a template…', 'เริ่มจากแม่แบบ…')}</button><button class="btn btn-ghost xs" data-act="an-gen" data-code="${d.combo}">${T('Use this standard’s load combinations', 'ใช้การรวมน้ำหนักตามมาตรฐานนี้')}</button><button class="btn btn-hot xs" data-act="an-step" data-s="mat">${T('Next: materials →', 'ถัดไป: วัสดุ →')}</button></div>`;
      if (k === 'mat') return dndHint('mat') + matTable() +
        `<div class="an-adds"><button class="btn btn-ghost xs" data-act="an-win" data-k="mat">+ ${T('Add material…', 'เพิ่มวัสดุ…')}</button></div>` +
        hint(T('E for concrete follows the standard (AS 3600 Table 3.1.2, EN 1992-1-1 Table 3.1, EIT/ACI 15 100√f\'c). Unit weight γ is used for self-weight and mass.', 'ค่า E ของคอนกรีตตามมาตรฐาน (AS 3600 ตาราง 3.1.2, EN 1992-1-1 ตาราง 3.1, วสท./ACI 15,100√f\'c) หน่วยน้ำหนัก γ ใช้คำนวณน้ำหนักตัวเองและมวล'));
      if (k === 'sec') return dndHint('sec') + secTable() +
        `<div class="an-adds"><button class="btn btn-ghost xs" data-act="an-win" data-k="sec">+ ${T('Add section…', 'เพิ่มหน้าตัด…')}</button></div>` +
        hint(T('Depth h (d, D) lies along the element local y axis, so I_z is the major axis. Rotate an element with β (step 4). Steel tables: ', 'ความลึก h (d, D) อยู่ตามแกน y เฉพาะที่ของชิ้นส่วน I_z จึงเป็นแกนหลัก หมุนชิ้นส่วนด้วย β (ขั้นที่ 4) ตารางเหล็ก: ') + ({ AS: 'AS/NZS 3679.1, AS/NZS 1163', EC: 'EN 10365, EN 10219', TH: 'TIS 1227 / JIS G 3192, AS/NZS 1163 sizes' })[m.std]);
      if (k === 'node') return hint(T('Pick the Node tool and click grid points in Plan or an Elevation (they snap to the grid), or type coordinates below. Click nodes in the view to select and edit them.', 'เลือกเครื่องมือจุดต่อแล้วคลิกตำแหน่งในแปลนหรือรูปด้าน (สแนปตามกริด) หรือพิมพ์พิกัดด้านล่าง คลิกจุดต่อในมุมมองเพื่อเลือกและแก้ไข')) +
        `<div class="an-adds"><button class="btn ${A.tool === 'node' ? 'btn-hot' : 'btn-ghost'} xs" data-act="an-tool" data-t="node">${T('Node tool', 'เครื่องมือจุดต่อ')}</button><button class="btn btn-ghost xs" data-act="an-cam" data-v="plan">${T('Plan view', 'มุมมองแปลน')}</button><label class="an-inl">${T('Snap', 'สแนป')} <input type="number" step="any" min="0" data-opt="snap" value="${uv(A.opt.snap, 'L')}"> ${ulab('L')}</label></div>` +
        blk(T('Add a node', 'เพิ่มจุดต่อ') + ' <span class="muted small">' + ulab('L') + '</span>', `<div class="an-row4">${fld('X', num('an-nx', 0))}${fld('Y', num('an-ny', 0))}${fld('Z', num('an-nz', 0))}<span class="an-f"><span>&nbsp;</span><button class="btn btn-ghost xs" data-act="an-addnode">+ ${T('Add', 'เพิ่ม')}</button></span></div>`) +
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
          ${one ? `<details class="an-det"><summary>${T('Springs', 'สปริง')} (${ulab('kL')}, ${ulab('kR')})</summary><div class="an-row3">${['kx', 'ky', 'kz', 'krx', 'kry', 'krz'].map(q => fld(q, ins(q, n[q] ? uv(n[q], q[1] === 'r' ? 'kR' : 'kL') : '', 'n'))).join('')}</div></details>` : ''}`); }
        if (mems.length) { const q = mems[0], one = mems.length === 1; ed += blk(T('End releases of ', 'การปลดแรงปลายของ ') + (one ? T('element ', 'ชิ้นส่วน ') + esc(q.id) : mems.length + ' ' + T('elements', 'ชิ้นส่วน')), one ? `<div class="an-chk"><label class="chkl"><input type="checkbox" data-ins="relI" ${q.relI ? 'checked' : ''} ${q.type === 'truss' ? 'disabled' : ''}> ${T('Pin (moment release) at end i', 'หมุด (ปลดโมเมนต์) ที่ปลาย i')} — ${esc(q.i)}</label></div><div class="an-chk"><label class="chkl"><input type="checkbox" data-ins="relJ" ${q.relJ ? 'checked' : ''} ${q.type === 'truss' ? 'disabled' : ''}> ${T('Pin (moment release) at end j', 'หมุด (ปลดโมเมนต์) ที่ปลาย j')} — ${esc(q.j)}</label></div>${fld(T('Element type', 'ชนิดชิ้นส่วน'), sel([['frame', T('Frame', 'โครงข้อแข็ง')], ['truss', T('Truss — both ends pinned, axial force only', 'โครงถัก — หมุดทั้งสองปลาย รับแรงตามแนวแกน')]], q.type || 'frame', 'data-ins="type"'))}`
          : `<div class="an-row2">${fld(T('Moment releases', 'การปลดโมเมนต์'), sel([['', T('— keep —', '— คงเดิม —')], ['none', T('None (rigid)', 'ไม่มี (ยึดแน่น)')], ['i', T('End i', 'ปลาย i')], ['j', T('End j', 'ปลาย j')], ['both', T('Both ends', 'ทั้งสองปลาย')]], '', 'data-ins="hinge"'))}${fld(T('Type', 'ชนิด'), sel([['', T('— keep —', '— คงเดิม —')], ['frame', T('Frame', 'โครงข้อแข็ง')], ['truss', T('Truss', 'โครงถัก')]], '', 'data-ins="type"'))}</div>`); }
        const supN = m.nodes.filter(n => F.fixOf(n).some(Boolean)), relM = m.members.filter(q => q.relI || q.relJ || q.type === 'truss');
        return hint(T('Select nodes in the view (click, or drag a box) to set their support. Select elements to release their end moments (pins) or make them truss members.', 'เลือกจุดต่อในมุมมอง (คลิก หรือลากกรอบ) เพื่อกำหนดจุดรองรับ เลือกชิ้นส่วนเพื่อปลดโมเมนต์ที่ปลาย (หมุด) หรือกำหนดเป็นโครงถัก')) +
          dndHint(A.sel.n.length || !A.sel.m.length ? 'sup' : 'rel') + `<h4>${T('Supports — for selected nodes', 'จุดรองรับ — สำหรับจุดต่อที่เลือก')}</h4>` + chips('sup', DRAG_SUPS()) + `<h4>${T('End releases — for selected elements', 'การปลดแรงปลาย — สำหรับชิ้นส่วนที่เลือก')}</h4>` + chips('rel', DRAG_RELS()) +
          `<div class="an-adds"><button class="btn btn-ghost xs" data-act="an-selbase">${T('Select all base nodes', 'เลือกจุดต่อที่ฐานทั้งหมด')}</button></div>` + selCount() + ed +
          `<details class="an-blk an-det" open><summary><b>${T('Supports', 'จุดรองรับ')} (${supN.length})</b></summary>${supN.length ? wrap(`<table class="an-t"><thead><tr><th>${T('Node', 'จุดต่อ')}</th><th>${T('Support', 'จุดรองรับ')}</th><th>Ux Uy Uz Rx Ry Rz</th></tr></thead><tbody>${supN.slice(0, 200).map(n => `<tr><td><button class="linkbtn" data-act="an-pickn" data-n="${esc(n.id)}">${esc(n.id)}</button></td><td>${esc((SUP().find(q => q[0] === (n.sup || 'free')) || [])[1] || n.sup)}</td><td class="mono">${F.fixOf(n).map(v => (v ? '■' : '□')).join(' ')}</td></tr>`).join('')}</tbody></table>`) : hint(T('No supports yet.', 'ยังไม่มีจุดรองรับ'))}</details>` +
          `<details class="an-blk an-det"><summary><b>${T('Released / truss elements', 'ชิ้นส่วนที่ปลดแรง / โครงถัก')} (${relM.length})</b></summary>${relM.length ? wrap(`<table class="an-t"><thead><tr><th>${T('Element', 'ชิ้นส่วน')}</th><th>${T('Release', 'การปลด')}</th></tr></thead><tbody>${relM.slice(0, 200).map(q => `<tr><td><button class="linkbtn" data-act="an-pick" data-m="${esc(q.id)}">${esc(q.id)}</button></td><td>${q.type === 'truss' ? T('truss (axial only)', 'โครงถัก') : (q.relI ? T('pin at i ', 'หมุดที่ i ') : '') + (q.relJ ? T('pin at j', 'หมุดที่ j') : '')}</td></tr>`).join('')}</tbody></table>`) : hint(T('All elements are rigidly connected.', 'ชิ้นส่วนทั้งหมดต่อแบบยึดแน่น'))}</details>`;
      }
      if (k === 'case') return hint(T('Name each load case (e.g. G dead, Q live, W wind). Tick self-weight for the case that should include the elements’ own weight. Loads are applied in step 7.', 'ตั้งชื่อกรณีน้ำหนัก (เช่น G คงที่, Q จร, W ลม) ติ๊กน้ำหนักตัวเองให้กรณีที่ต้องรวมน้ำหนักชิ้นส่วน ใส่แรงในขั้นตอนที่ 7')) + caseTable();
      if (k === 'load') {
        const cs = m.cases.some(c => c.id === A.lcase) ? A.lcase : (m.cases[0] || {}).id;
        if (!cs) return hint(T('Add a load case first (step 6).', 'เพิ่มกรณีน้ำหนักก่อน (ขั้นที่ 6)'));
        let forms = '';
        if (A.sel.n.length) forms += blk(T('Nodal load on ', 'แรงที่จุดต่อ ') + A.sel.n.length + ' ' + T('selected node(s)', 'จุดที่เลือก') + ' <span class="muted small">' + ulab('F') + ', ' + ulab('M') + ' · ' + T('global axes', 'แกนหลัก') + '</span>', `<div class="an-row3">${['Fx', 'Fy', 'Fz'].map(q => fld(q, num('an-n' + q, q === 'Fz' ? -10 : 0))).join('')}</div><div class="an-row3">${['Mx', 'My', 'Mz'].map(q => fld(q, num('an-n' + q, 0))).join('')}</div><div class="an-adds"><button class="btn btn-hot xs" data-act="an-nl">${T('Apply to ', 'ใส่แรงใน ') + esc(cs)}</button></div>`);
        if (A.sel.m.length && A.mlk === 'temp') forms += blk(T('Temperature load on ', 'แรงจากอุณหภูมิบน ') + A.sel.m.length + ' ' + T('selected element(s)', 'ชิ้นที่เลือก'), `<div class="an-row2">${fld(T('Load', 'ชนิด'), sel(LKIND(), 'temp', 'id="an-mlk"'))}<span></span></div>
          <div class="an-row3">${fld(T('ΔT uniform', 'ΔT สม่ำเสมอ') + ul('T'), num('an-tu', 20))}${fld('ΔT_y' + ul('T'), num('an-ty', 0))}${fld('ΔT_z' + ul('T'), num('an-tz', 0))}</div>${hint(TEMPHINT())}
          <div class="an-adds"><button class="btn btn-hot xs" data-act="an-ml">${T('Apply to ', 'ใส่แรงใน ') + esc(cs)}</button><button class="btn btn-ghost xs" data-act="an-mlclear">${T('Remove ', 'ลบแรง ') + esc(cs) + T(' loads from selection', ' ของส่วนที่เลือก')}</button></div>`);
        else if (A.sel.m.length) forms += blk(T('Element load on ', 'แรงบนชิ้นส่วน ') + A.sel.m.length + ' ' + T('selected element(s)', 'ชิ้นที่เลือก'), `<div class="an-row2">${fld(T('Load', 'ชนิด'), sel(LKIND(), A.mlk || 'udl', 'id="an-mlk"'))}${fld(T('Direction', 'ทิศทาง'), sel((A.mlk || 'udl') === 'moment' ? MDIRS() : DIRS(), (A.mlk || 'udl') === 'moment' ? 'lz' : 'grav', 'id="an-mld"'))}</div>
          <div class="an-row4">${fld((A.mlk || 'udl') === 'udl' ? 'w₁' + ul('w') : (A.mlk === 'point' ? 'P' + ul('F') : 'M' + ul('M')), num('an-mlv', 10))}${(A.mlk || 'udl') === 'udl' ? fld(T('w₂ (blank = w₁)', 'w₂ (ว่าง = w₁)'), `<input id="an-mlv2" type="number" step="any">`) : '<span></span>'}${fld(T('a from i', 'a จาก i') + ul('L'), `<input id="an-mla" type="number" step="any" placeholder="${(A.mlk || 'udl') === 'udl' ? '0' : T('mid', 'กึ่งกลาง')}">`)}${(A.mlk || 'udl') === 'udl' ? fld(T('b (blank = end j)', 'b (ว่าง = ปลาย j)'), `<input id="an-mlb" type="number" step="any">`) : '<span></span>'}</div>
          <div class="an-adds"><button class="btn btn-hot xs" data-act="an-ml">${T('Apply to ', 'ใส่แรงใน ') + esc(cs)}</button><button class="btn btn-ghost xs" data-act="an-mlclear">${T('Remove ', 'ลบแรง ') + esc(cs) + T(' loads from selection', ' ของส่วนที่เลือก')}</button></div>`);
        const pal0 = palette(), nIn = id => m.loads.filter(l => l.case === id).length, shown = A.loadsOn ? A.lcase : '';
        const cards = `<div class="an-lcards" role="listbox" aria-label="${T('Load cases', 'กรณีน้ำหนัก')}">${m.cases.map(c => `<button class="an-lcard ${shown === c.id || (shown === 'all') ? 'on' : ''} ${cs === c.id ? 'cur' : ''}" role="option" aria-selected="${cs === c.id}" data-act="an-lpick" data-c="${esc(c.id)}"><i style="background:${caseCol(pal0, c.id)}"></i><b>${esc(c.id)}</b><span>${esc(c.name)}</span><em>${c.type}${c.sw ? ' · SW' : ''}</em><small>${nIn(c.id)}</small></button>`).join('')}</div>`;
        const nl = nIn(cs);
        return `<div class="an-lhead"><b>${T('Load cases', 'กรณีน้ำหนัก')}</b><span class="muted small">${T('click one to show only its loads', 'คลิกเพื่อแสดงเฉพาะแรงของกรณีนั้น')}</span><button class="linkbtn" data-act="an-step" data-s="case">${T('Edit', 'แก้ไข')}</button></div>` + cards +
          `<div class="an-lnow">${T('Applying to ', 'ใส่แรงใน ')}<b>${esc(cs)}</b> — ${esc((m.cases.find(c => c.id === cs) || {}).name || '')} · ${nl} ${T('load(s)', 'แรง')}</div>` +
          (forms || hint(T('Select nodes or elements in the view (click, Shift-click or drag a box), then apply nodal loads, distributed loads, point loads or moments to this load case.', 'เลือกจุดต่อหรือชิ้นส่วนในมุมมอง (คลิก, Shift-คลิก หรือลากกรอบ) แล้วใส่แรงที่จุดต่อ แรงแผ่กระจาย แรงจุด หรือโมเมนต์ในกรณีน้ำหนักนี้'))) + selCount() +
          (nl ? `<button class="linkbtn an-llist" data-act="an-llist" aria-expanded="${!!A.llist}">${A.llist ? '▾ ' + T('Hide individual loads', 'ซ่อนรายการแรง') : '▸ ' + T('Show individual loads', 'แสดงรายการแรง')} (${nl})</button>${A.llist ? `<div class="an-blk">${loadTable(cs)}</div>` : ''}` : '');
      }
      if (k === 'brg') return bridgePanel();
      if (k === 'bld') return bldPanel();
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
      const rv = [['def', T('Deflected shape', 'รูปการโก่งตัว')], ['N', T('Axial N', 'แรงตามแนวแกน N')], ['Vy', T('Shear V_y', 'แรงเฉือน V_y')], ['Vz', T('Shear V_z', 'แรงเฉือน V_z')], ['T', T('Torsion T', 'แรงบิด T')], ['My', T('Moment M_y (minor)', 'โมเมนต์ M_y (แกนรอง)')], ['Mz', T('Moment M_z (major)', 'โมเมนต์ M_z (แกนหลัก)')], ['react', T('Reactions', 'แรงปฏิกิริยา')], ['mode', T('Mode shapes', 'รูปโหมด')], ['buck', T('Buckling', 'การโก่งเดาะ')]].concat(BRG ? [['il', T('Influence line', 'เส้นอิทธิพล')]] : []);
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
        else if (['x', 'y', 'z'].includes(k)) { if (v === '' || !isFinite(+v)) return; nodes.forEach(n => { n[k] = r4(frU(+v, 'L')); }); }
        else if (k === 'sup') { if (!v) return; nodes.forEach(n => { n.sup = v; if (v === 'custom' && !n.fix) n.fix = F.SUPS.pin.slice(); }); side = true; }
        else if (/^fix\d$/.test(k)) { const dd = +k.slice(3); nodes.forEach(n => { n.fix = F.fixOf(n).slice(); n.sup = 'custom'; n.fix[dd] = v ? 1 : 0; }); }
        else nodes.forEach(n => { if (v === '' || !(+v)) delete n[k]; else n[k] = frU(+v, k[1] === 'r' ? 'kR' : 'kL'); });
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
      if (BLD) tabs.splice(4, 1, ['story', T('Stories', 'รายชั้น')]);
      const ext2 = (mm, q) => (env ? [Math.max(...mm[q + 'max']), Math.min(...mm[q + 'min'])] : [Math.max(...mm[q]), Math.min(...mm[q])]);
      const amax = (mm, q) => { const e = ext2(mm, q); return Math.max(Math.abs(e[0]), Math.abs(e[1])); };
      let body = '';
      if (rt === 'sum') {
        const best = {}; if (cur) cur.mem.forEach(mm => { ['N', 'Vy', 'Vz', 'T', 'My', 'Mz'].forEach(q => { const v = amax(mm, q); if (!best[q] || v > best[q][0]) best[q] = [v, mm.id]; }); const e = ext2(mm, 'N'); if (!best.Nt || e[0] > best.Nt[0]) best.Nt = [e[0], mm.id]; if (!best.Nc || e[1] < best.Nc[0]) best.Nc = [e[1], mm.id]; });
        let md = null; if (cur && !env) cur.mem.forEach(mm => mm.x.forEach((x, i) => { const dd = Math.hypot(mm.dx[i], mm.dy[i], mm.dz[i]); if (!md || dd > md.d) md = { d: dd, id: mm.id, x }; }));
        const kv = (k2, v, u) => `<div><dt>${k2}</dt><dd class="mono">${v} <span class="u">${u}</span></dd></div>`, bv = (q, uq) => (best[q] ? kv('|' + COMPS.find(c => c[0] === q)[1] + '| max', fu(best[q][0], uq), ulab(uq) + ' · ' + esc(best[q][1])) : '');
        body = `<dl class="kv an-kv">${bv('Mz', 'M')}${bv('My', 'M')}${bv('Vy', 'F')}${bv('Vz', 'F')}${bv('T', 'M')}${best.Nt ? kv(T('Max tension', 'แรงดึงสูงสุด'), fu(best.Nt[0], 'F'), ulab('F') + ' · ' + esc(best.Nt[1])) : ''}${best.Nc ? kv(T('Max compression', 'แรงอัดสูงสุด'), fu(best.Nc[0], 'F'), ulab('F') + ' · ' + esc(best.Nc[1])) : ''}${md ? kv(T('Max displacement', 'การเคลื่อนตัวสูงสุด'), fu(md.d, 'd') + ul('d'), '· ' + esc(md.id) + ' @ ' + fu(md.x, 'L', 2) + ul('L')) : ''}${kv(T('Solved in', 'เวลาคำนวณ'), r.ms, 'ms')}</dl>
          ${r.modal && r.modal.modes.length ? `<p class="muted">${T('Fundamental period', 'คาบพื้นฐาน')} T₁ = <b class="mono">${f(r.modal.modes[0].T, 3)} s</b> (f₁ = ${f(r.modal.modes[0].f, 3)} Hz)</p>` : ''}
          ${r.buckling ? `<p class="muted">${T('Lowest buckling factor', 'ตัวคูณการโก่งเดาะต่ำสุด')} λcr = <b class="mono">${fx(Math.min(...Object.values(r.buckling).map(b => (b.modes && b.modes[0] ? b.modes[0].lam : Infinity))))}</b></p>` : ''}
          ${r.warn.length ? `<ul class="warn-list">${r.warn.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}`;
      } else if (rt === 'react') {
        const rows = m.nodes.map((n, i) => [n, i]).filter(([n]) => F.fixOf(n).some(Boolean) || ['kx', 'ky', 'kz', 'krx', 'kry', 'krz'].some(q => +n[q] > 0));
        body = !cur ? '' : wrap(`<table class="chk an-r"><thead><tr><th>${T('Node', 'จุดต่อ')}</th>${['Rx', 'Ry', 'Rz'].map(q => `<th class="num">${q} (${ulab('F')})</th>`).join('')}${['Mx', 'My', 'Mz'].map(q => `<th class="num">${q} (${ulab('M')})</th>`).join('')}</tr></thead><tbody>${rows.map(([n, i]) => `<tr><td>${esc(n.id)}</td>${[0, 1, 2, 3, 4, 5].map(dd => `<td class="num mono">${env ? fu(cur.R[6 * i + dd][0], dd < 3 ? 'F' : 'M', 1) + ' … ' + fu(cur.R[6 * i + dd][1], dd < 3 ? 'F' : 'M', 1) : fu(cur.R[6 * i + dd], dd < 3 ? 'F' : 'M')}</td>`).join('')}</tr>`).join('')}
          ${env ? '' : `<tr class="tot"><td>Σ</td>${[0, 1, 2].map(dd => `<td class="num mono">${fu(rows.reduce((s2, [, i]) => s2 + cur.R[6 * i + dd], 0), 'F')}</td>`).join('')}<td></td><td></td><td></td></tr>`}</tbody></table>`);
      } else if (rt === 'forces') {
        body = !cur ? '' : wrap(`<table class="chk an-r"><thead><tr><th>${T('Element', 'ชิ้นส่วน')}</th><th class="num">L (${ulab('L')})</th><th class="num">N max</th><th class="num">N min</th><th class="num">|V<sub>y</sub>|</th><th class="num">|V<sub>z</sub>|</th><th class="num">|T|</th><th class="num">M<sub>y</sub> max</th><th class="num">M<sub>y</sub> min</th><th class="num">M<sub>z</sub> max</th><th class="num">M<sub>z</sub> min</th>${env ? '' : `<th class="num">δ (${ulab('d')})</th><th class="num">L/δ</th>`}</tr></thead><tbody class="an-uh"><tr><td></td><td></td>${['F', 'F', 'F', 'F', 'M', 'M', 'M', 'M', 'M'].map(q => `<td class="num muted small">${ulab(q)}</td>`).join('')}${env ? '' : '<td></td><td></td>'}</tr></tbody><tbody>${cur.mem.slice(0, 400).map(mm => { const dmax = env ? 0 : Math.max(...mm.drel.map(Math.abs), ...mm.drelz.map(Math.abs)); const N = ext2(mm, 'N'), My = ext2(mm, 'My'), Mz = ext2(mm, 'Mz'); return `<tr class="${A.sel.m.includes(mm.id) ? 'on' : ''}" data-act="an-pick" data-m="${esc(mm.id)}"><td>${esc(mm.id)}</td><td class="num mono">${fu(mm.L, 'L', 2)}</td>${[N[0], N[1], amax(mm, 'Vy'), amax(mm, 'Vz'), amax(mm, 'T'), My[0], My[1], Mz[0], Mz[1]].map((v, j) => `<td class="num mono">${fu(v, j < 4 ? 'F' : 'M')}</td>`).join('')}${env ? '' : `<td class="num mono">${fu(dmax, 'd')}</td><td class="num mono">${dmax > 1e-9 ? f(mm.L / dmax, 0) : '—'}</td>`}</tr>`; }).join('')}</tbody></table>`) + hint(T('δ = deflection relative to the line joining the element ends (local y and z). Click a row to show the element.', 'δ = การโก่งเทียบเส้นเชื่อมปลายชิ้นส่วน (แกน y และ z) คลิกแถวเพื่อแสดงชิ้นส่วน'));
      } else if (rt === 'disp') {
        body = !cur || env ? `<p class="muted">${T('Choose a load case or combination.', 'เลือกกรณีน้ำหนักหรือการรวมน้ำหนัก')}</p>` : wrap(`<table class="chk an-r"><thead><tr><th>${T('Node', 'จุดต่อ')}</th><th class="num">u<sub>x</sub> (${ulab('d')})</th><th class="num">u<sub>y</sub> (${ulab('d')})</th><th class="num">u<sub>z</sub> (${ulab('d')})</th><th class="num">θ<sub>x</sub></th><th class="num">θ<sub>y</sub></th><th class="num">θ<sub>z</sub> (mrad)</th></tr></thead><tbody>${m.nodes.slice(0, 400).map((n, i) => `<tr class="${A.sel.n.includes(n.id) ? 'on' : ''}"><td>${esc(n.id)}</td>${[0, 1, 2, 3, 4, 5].map(dd => `<td class="num mono">${dd < 3 ? fu(cur.u[6 * i + dd], 'd', 3) : fx(cur.u[6 * i + dd] * 1000, 3)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      } else if (rt === 'story') { body = storyResHTML(cur);
      } else if (rt === 'drift') {
        if (!cur || env) body = `<p class="muted">${T('Choose a load case or combination.', 'เลือกกรณีน้ำหนักหรือการรวมน้ำหนัก')}</p>`;
        else {
          const lv = {}; m.nodes.forEach((n, i) => { const z = r4(+n.z || 0); (lv[z] = lv[z] || []).push([cur.u[6 * i], cur.u[6 * i + 1]]); });
          const zs = Object.keys(lv).map(Number).sort((a, b) => a - b), rows = []; let prev = null;
          zs.forEach(z => { const L = lv[z], ux = L.reduce((s2, v) => s2 + v[0], 0) / L.length, uy = L.reduce((s2, v) => s2 + v[1], 0) / L.length; if (prev) rows.push({ z, ux, uy, h: z - prev.z, dx: ux - prev.ux, dy: uy - prev.uy }); prev = { z, ux, uy }; });
          const rat = (dd, h) => (Math.abs(dd) > 1e-9 ? 'h / ' + f(h / Math.abs(dd), 0) : '—');
          body = rows.length ? `<table class="chk an-r"><thead><tr><th>${T('Level Z', 'ระดับ Z')} (${ulab('L')})</th><th class="num">u<sub>x</sub> (${ulab('d')})</th><th class="num">u<sub>y</sub> (${ulab('d')})</th><th class="num">h (${ulab('L')})</th><th class="num">${T('Drift X', 'ดริฟต์ X')}</th><th class="num">${T('Drift Y', 'ดริฟต์ Y')}</th></tr></thead><tbody>${rows.map(rw => `<tr><td class="mono">${fu(rw.z, 'L', 2)}</td><td class="num mono">${fu(rw.ux, 'd')}</td><td class="num mono">${fu(rw.uy, 'd')}</td><td class="num mono">${fu(rw.h, 'L', 2)}</td><td class="num mono">${fu(rw.dx, 'd')} · ${rat(rw.dx, rw.h)}</td><td class="num mono">${fu(rw.dy, 'd')} · ${rat(rw.dy, rw.h)}</td></tr>`).join('')}</tbody></table>` + hint(T('Average horizontal displacement of the nodes at each level. Typical limits h/500, h/300 (portal frames under wind).', 'ค่าเฉลี่ยการเคลื่อนตัวแนวราบของจุดต่อในแต่ละระดับ ค่าจำกัดทั่วไป h/500, h/300 (โครงข้อแข็งรับลม)')) : `<p class="muted">${T('One level only.', 'มีระดับเดียว')}</p>`;
        }
      } else if (rt === 'modal') {
        body = r.modal ? wrap(`<table class="chk an-r"><thead><tr><th>${T('Mode', 'โหมด')}</th><th class="num">f (Hz)</th><th class="num">T (s)</th><th class="num">${T('Mass', 'มวล')} X</th><th class="num">Y</th><th class="num">Z</th><th class="num">Σ X</th><th class="num">Σ Y</th><th class="num">Σ Z</th><th></th></tr></thead><tbody>${r.modal.modes.map((md, i) => `<tr class="${A.rview === 'mode' && A.mode === i ? 'on' : ''}"><td>${i + 1}</td><td class="num mono">${f(md.f, 3)}</td><td class="num mono">${f(md.T, 3)}</td>${[md.mx, md.my, md.mz, md.cmx, md.cmy, md.cmz].map(v => `<td class="num mono">${f(v * 100, 1)}%</td>`).join('')}<td><button class="btn btn-ghost xs" data-act="an-mode" data-k="${i}">${T('Show', 'แสดง')}</button></td></tr>`).join('')}</tbody></table>`) + hint(T('Mass X / Y / Z', 'มวล X / Y / Z') + `: ${f(r.modal.massX, 2)} / ${f(r.modal.massY, 2)} / ${f(r.modal.massZ, 2)} t`) : `<p class="muted">${pro() ? T('Turn on modal analysis in step 9 and run again.', 'เปิดการวิเคราะห์โหมดในขั้นที่ 9 แล้ววิเคราะห์อีกครั้ง') : T('Modal analysis is a Pro feature.', 'การวิเคราะห์โหมดสำหรับสมาชิก Pro')}</p>`;
      } else if (rt === 'buck') {
        body = r.buckling ? `<table class="chk an-r"><thead><tr><th>${T('Combination', 'การรวมน้ำหนัก')}</th><th class="num">λcr,1</th><th class="num">λcr,2</th><th class="num">λcr,3</th><th>${T('Second-order effects', 'ผลอันดับสอง')}</th><th></th></tr></thead><tbody>${m.combos.filter(c => r.buckling[c.id]).map(c => { const b = r.buckling[c.id], l = b.modes ? b.modes.map(q => q.lam) : [], l1 = l[0]; return `<tr><td>${esc(c.id)} — ${esc(c.name)}</td>${[0, 1, 2].map(i => `<td class="num mono">${l[i] ? f(l[i], 2) : b.none && i === 0 ? '∞' : '—'}</td>`).join('')}<td>${l1 ? (l1 < 3 ? `<span class="pill st-bad">${T('λcr < 3: unstable / redesign', 'λcr < 3: ไม่มั่นคง ควรแก้ไข')}</span>` : l1 < 10 ? `<span class="pill st-warn">${T('3 ≤ λcr < 10: use second-order (P-Delta)', '3 ≤ λcr < 10: ใช้การวิเคราะห์อันดับสอง')}</span>` : `<span class="pill st-ok">${T('λcr ≥ 10: first-order OK', 'λcr ≥ 10: อันดับหนึ่งเพียงพอ')}</span>`) : b.error ? esc(b.error) : ''}</td><td>${l1 ? `<button class="btn btn-ghost xs" data-act="an-buck" data-c="${esc(c.id)}">${T('Show', 'แสดง')}</button>` : ''}</td></tr>`; }).join('')}</tbody></table>` : `<p class="muted">${pro() ? T('Turn on buckling analysis in step 9 and run again.', 'เปิดการวิเคราะห์การโก่งเดาะในขั้นที่ 9 แล้ววิเคราะห์อีกครั้ง') : T('Buckling analysis is a Pro feature.', 'การวิเคราะห์การโก่งเดาะสำหรับสมาชิก Pro')}</p>`;
      }
      return `<div class="tabs sm" role="tablist">${tabs.map(([k2, l]) => `<button role="tab" aria-selected="${rt === k2}" data-act="an-rtab" data-t="${k2}">${l}</button>`).join('')}</div><div class="an-rbody">${body}</div>`;
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
      const g = q => arr(mm, q, env).map(a2 => a2.map(v => toU(v, ['T', 'My', 'Mz'].includes(q) ? 'M' : 'F'))), s = A.model.sections.find(q => q.id === mb.sec), p = s ? F.secProps(s) : null;
      return `<div class="card an-member"><div class="an-mh"><h3>${T('Element', 'ชิ้นส่วน')} ${esc(mm.id)} <span class="muted small">${esc(mb.i)} → ${esc(mb.j)} · L = ${fu(mm.L, 'L')}${ul('L')} · ${esc(mb.sec)}${p ? ' (A ' + f(p.A, 0) + ' mm²)' : ''}</span></h3>
        <div class="an-send"><button class="btn btn-ghost xs" data-act="an-send" data-e="beam">${T('Design as RC beam →', 'ออกแบบเป็นคาน คสล. →')}</button><button class="btn btn-ghost xs" data-act="an-send" data-e="column">${T('Design as RC column →', 'ออกแบบเป็นเสา คสล. →')}</button></div></div>
        <div class="an-mcs">${chart(T('Axial N', 'แรงตามแนวแกน N'), ulab('F'), g('N'), 'N')}${chart('V<sub>y</sub>', ulab('F'), g('Vy'), 'V')}${chart('V<sub>z</sub>', ulab('F'), g('Vz'), 'V')}${chart(T('Torsion T', 'แรงบิด T'), ulab('M'), g('T'), 'T')}${chart('M<sub>y</sub>', ulab('M'), g('My'), 'My', true)}${chart('M<sub>z</sub>', ulab('M'), g('Mz'), 'M', true)}${env ? '' : chart(T('Deflection (local y)', 'การโก่ง (แกน y)'), ulab('d'), [mm.drel.map(v => toU(v, 'd'))], 'D') + chart(T('Deflection (local z)', 'การโก่ง (แกน z)'), ulab('d'), [mm.drelz.map(v => toU(v, 'd'))], 'D')}</div></div>`;
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
          ${ribHTML()}
          <aside class="an-side" id="anSide">${treeHTML()}</aside>
          <section class="an-work">
            <div class="an-canvas"><canvas id="anGuide" class="an-guide" aria-hidden="true"></canvas><canvas id="anCv" tabindex="0" aria-label="${T('3D model view', 'มุมมองแบบจำลอง 3 มิติ')}"></canvas><span class="an-tag" id="anViewTag">${viewTag()}</span>${ax ? `<label class="an-lv an-lvbox">${T('Level', 'ระดับ')} ${ax.toUpperCase()} = ${sel([['all', T('all', 'ทั้งหมด')]].concat(lv.map(v => [v, (BLD && ax === 'z' && storyOfZ(v) ? storyOfZ(v).id + ' · ' : '') + fu(v, 'L', 2)])), A.cut, 'id="an-cut"')}</label>` : ''}
              <p class="an-hintbar"><span id="anHint">${hintBar()}</span></p>${unitBar()}</div>
            <div class="an-drawer ${showRes ? 'on' : ''} ${A.drawerMin ? 'min' : ''}" id="anDrawer" ${drawerStyle()}>${drawerHTML()}</div>
          </section>
        ${A.tplOpen ? `<div class="modal-bg an-tplbg">${tplHTML()}</div>` : ''}
        <div id="anWinHost"></div><div id="anRibMenu"></div>
        <div id="reportWrap" class="an-report"></div></main>`;
    }
    function unitBar() {
      const u = UU(), pre = Object.keys(UPRE).find(k => ['F', 'L', 'T'].every(q => UPRE[k][q] === u[q])) || '';
      return `<div class="an-ubar" role="group" aria-label="${T('Units', 'หน่วย')}"><span>${T('Units', 'หน่วย')}</span>
        ${sel([['', T('Custom', 'กำหนดเอง')], ['SI', 'kN · m'], ['SImm', 'N · mm'], ['MKS', 'tf · m'], ['MKScm', 'kgf · cm'], ['US', 'kip · ft · °F']], pre, `id="an-upre" title="${T('Unit system', 'ระบบหน่วย')}"`)}
        ${sel(Object.keys(UF).map(k => [k, k]), u.F, `id="an-uF" title="${T('Force', 'แรง')}"`)}${sel(Object.keys(UL).map(k => [k, k]), u.L, `id="an-uL" title="${T('Length', 'ความยาว')}"`)}${sel([['C', '°C'], ['F', '°F']], u.T, `id="an-uT" title="${T('Temperature', 'อุณหภูมิ')}"`)}</div>`;
    }
    function syncLshow() { const e = $('#an-lshow'); if (e) e.value = A.loadsOn ? A.lcase : ''; }
    function hintBar() {
      const rot = A.cam.v === '3d' ? T('right-drag: rotate', 'ลากคลิกขวา: หมุน') : T('right-drag: pan', 'ลากคลิกขวา: เลื่อน');
      const sh = A.cam.v === '3d' ? T('Shift-drag: rotate', 'Shift-ลาก: หมุน') : T('Shift-drag: pan', 'Shift-ลาก: เลื่อน');
      if (isBTool(A.tool)) return (A.bmsg ? A.bmsg + '  ·  ' : '') + ({ bcol: T('Columns: click grid intersections', 'เสา: คลิกจุดตัดกริด'), bbeam: T('Beams: click start and end points (chain) · right-click: stop', 'คาน: คลิกจุดเริ่มและจุดปลาย (ต่อเนื่อง) · คลิกขวา: หยุด'), bslab: T('Slabs: click a bay to add, click a slab to remove', 'แผ่นพื้น: คลิกช่องเพื่อเพิ่ม คลิกแผ่นพื้นเพื่อลบ') }[A.tool]) + ' · ' + T('PageUp / PageDown: story · Esc: done', 'PageUp / PageDown: เปลี่ยนชั้น · Esc: เสร็จ');
      if (A.tool === 'pan') return T('Pan tool: drag to move the view · wheel: zoom · Esc: back to Select', 'เครื่องมือเลื่อน: ลากเพื่อเลื่อน · ล้อเมาส์: ซูม · Esc: กลับไปเลือก');
      if (A.tool === 'zoomw') return T('Zoom window: drag a box around the area · Esc: cancel', 'ซูมกรอบ: ลากกรอบรอบพื้นที่ · Esc: ยกเลิก');
      if (A.tool === 'qnode' || A.tool === 'qelem') return T('Query: click a ' + (A.tool === 'qnode' ? 'node' : 'element') + ' to see its data · drag: rotate · Esc: back to Select', 'สอบถาม: คลิก' + (A.tool === 'qnode' ? 'จุดต่อ' : 'ชิ้นส่วน') + 'เพื่อดูข้อมูล · ลาก: หมุน · Esc: กลับไปเลือก');
      if (A.tool === 'select') return T('Drag box: → window / ← crossing · Ctrl: add · Alt: remove · Shift-click: add/remove', 'ลากกรอบ: → หน้าต่าง / ← ตัดผ่าน · Ctrl: เพิ่ม · Alt: ลบออก · Shift-คลิก: เพิ่ม/ลบ') + ' · ' + sh + ' · ' + T('middle-drag: pan · wheel: zoom', 'ลากปุ่มกลาง: เลื่อน · ล้อเมาส์: ซูม');
      return (A.cam.v === '3d' ? T('Drag: rotate', 'ลาก: หมุน') : T('Drag: pan', 'ลาก: เลื่อน')) + ' · ' + T('Ctrl-drag: select area · middle-drag: pan · wheel: zoom', 'Ctrl-ลาก: เลือกพื้นที่ · ลากปุ่มกลาง: เลื่อน · ล้อเมาส์: ซูม');
    }
    const drawerStyle = () => (A.step === 'res' && fresh() && !A.drawerMin && A.opt.drawerH ? `style="height:${A.opt.drawerH}px"` : '');
    // drag the top edge of the results panel to change its height (kept between sessions)
    function bindDrawerGrip() {
      if (A._gripBound) return; A._gripBound = true;
      const limits = () => { const w = $('.an-work'), H = w ? w.getBoundingClientRect().height : innerHeight; return [90, Math.max(140, H - 140)]; };
      const setH = h => { const [lo, hi] = limits(), d = $('#anDrawer'); A.opt.drawerH = Math.round(Math.max(lo, Math.min(hi, h))); if (d) d.style.height = A.opt.drawerH + 'px'; };
      document.addEventListener('pointerdown', e => {
        const gp = e.target.closest && e.target.closest('.an-drawgrip'); if (!gp) return;
        e.preventDefault(); const d = $('#anDrawer'); if (!d) return;
        const y0 = e.clientY, h0 = d.getBoundingClientRect().height; A.noRefit = true; document.body.classList.add('an-resizing'); gp.setPointerCapture(e.pointerId);
        const mv = ev => setH(h0 + (y0 - ev.clientY));
        const up = () => { gp.removeEventListener('pointermove', mv); gp.removeEventListener('pointerup', up); gp.removeEventListener('pointercancel', up); document.body.classList.remove('an-resizing'); persist(); setTimeout(() => { A.noRefit = false; }, 400); redraw(); };
        gp.addEventListener('pointermove', mv); gp.addEventListener('pointerup', up); gp.addEventListener('pointercancel', up);
      });
      document.addEventListener('dblclick', e => { if (!(e.target.closest && e.target.closest('.an-drawgrip'))) return; delete A.opt.drawerH; persist(); const d = $('#anDrawer'); if (d) d.style.height = ''; redraw(); });
      document.addEventListener('keydown', e => { const gp = e.target.closest && e.target.closest('.an-drawgrip'); if (!gp || !['ArrowUp', 'ArrowDown'].includes(e.key)) return; e.preventDefault(); const d = $('#anDrawer'); if (!d) return; A.noRefit = true; setH(d.getBoundingClientRect().height + (e.key === 'ArrowUp' ? 30 : -30)); persist(); setTimeout(() => { A.noRefit = false; }, 400); });
    }
    function drawerHTML() {
      if (!(A.step === 'res' && fresh())) return '';
      return `${A.drawerMin ? '' : `<div class="an-drawgrip" role="separator" aria-orientation="horizontal" tabindex="0" aria-label="${T('Drag to resize the results panel', 'ลากเพื่อปรับความสูงแผงผลลัพธ์')}" title="${T('Drag to resize · double-click to reset', 'ลากเพื่อปรับขนาด · ดับเบิลคลิกเพื่อคืนค่า')}"><i></i></div>`}<div class="an-drawhead"><b>${T('Results', 'ผลลัพธ์')}</b><span class="muted small">${esc((srcList().find(q => q[0] === A.src) || [])[1] || '')}</span><span class="grow"></span><button class="btn btn-ghost xs" data-act="an-drawer">${A.drawerMin ? T('Show ▴', 'แสดง ▴') : T('Hide ▾', 'ซ่อน ▾')}</button></div>
        ${A.drawerMin ? '' : `<div class="an-drawbody"><div id="anMember">${memberHTML()}</div><div class="an-results" id="anRes">${resultsHTML()}</div></div>`}`;
    }
    function tplHTML() {
      const p = Object.assign({}, TPL[A.tpl].p, A.tplP || {});
      const fl = (k, lbl, type) => `<label>${lbl}<input data-tp="${k}" value="${esc(p[k])}" ${type === 'n' ? 'type="number" step="any"' : ''}></label>`;
      const form = BLD ? fl('bx', T('Grid spacings in X (m), e.g. 8, 8, 2@6', 'ระยะกริดแกน X (ม.) เช่น 8, 8, 2@6')) + fl('by', T('Grid spacings in Y (m)', 'ระยะกริดแกน Y (ม.)')) + fl('st', T('Story heights (m), bottom up — 4, 3x3.5 = 4 then three of 3.5', 'ความสูงชั้น (ม.) จากล่างขึ้นบน — 4, 3x3.5')) + (A.tpl === 'steel' || A.tpl === 'blank' ? '' : fl('col', T('Column b×h (mm)', 'เสา b×h (มม.)')) + fl('beam', T('Beam b×h (mm)', 'คาน b×h (มม.)'))) + fl('t', T('Slab thickness (mm)', 'ความหนาพื้น (มม.)'), 'n') + fl('sdl', T('Superimposed dead load (kPa)', 'น้ำหนักบรรทุกคงที่เพิ่ม (kPa)'), 'n') + fl('ll', T('Floor live load (kPa)', 'น้ำหนักจรบนพื้น (kPa)'), 'n') + (A.tpl === 'blank' ? '' : fl('roof', T('Roof live load (kPa)', 'น้ำหนักจรหลังคา (kPa)'), 'n')) + `<label>${T('Wind loads', 'แรงลม')}${sel([['on', T('Automatic, to the design standard', 'อัตโนมัติ ตามมาตรฐาน')], ['off', T('None', 'ไม่มี')]], p.wind, 'data-tp="wind"')}</label>`
        : BRG ? (A.tpl === 'girder' ? fl('spans', T('Spans (m), comma separated', 'ช่วงสะพาน (ม.) คั่นด้วยจุลภาค')) + fl('ng', T('Number of girders', 'จำนวนคาน'), 'n') + fl('s', T('Girder spacing (m)', 'ระยะห่างคาน (ม.)'), 'n') + `<label>${T('Continuity', 'ความต่อเนื่อง')}${sel([['continuous', T('Continuous over the piers', 'ต่อเนื่องเหนือตอม่อ')], ['simple', T('Simply supported spans', 'ช่วงอิสระ')]], p.cont, 'data-tp="cont"')}</label>` + fl('nseg', T('Segments per span', 'จำนวนช่วงย่อยต่อช่วง'), 'n') + fl('pt', T('Prestress per girder (kN, 0 = none)', 'แรงอัดล่วงหน้าต่อคาน (kN, 0 = ไม่มี)'), 'n')
        : A.tpl === 'box' ? fl('spans', T('Spans (m), comma separated', 'ช่วงสะพาน (ม.) คั่นด้วยจุลภาค')) + fl('piers', T('Pier heights (m)', 'ความสูงตอม่อ (ม.)')) + fl('width', T('Deck width (m)', 'ความกว้างพื้น (ม.)'), 'n') + fl('nseg', T('Segments per span', 'จำนวนช่วงย่อยต่อช่วง'), 'n')
          : A.tpl === 'btruss' ? `<label>${T('Type', 'ชนิด')}${sel([['pratt', 'Pratt'], ['warren', 'Warren']], p.kind, 'data-tp="kind"')}</label>` + fl('span', T('Span (m)', 'ช่วง (ม.)'), 'n') + fl('panels', T('Panels (even)', 'จำนวนช่อง (คู่)'), 'n') + fl('height', T('Truss height (m)', 'ความสูงโครงถัก (ม.)'), 'n') + fl('width', T('Width between trusses (m)', 'ระยะห่างโครงถัก (ม.)'), 'n')
            : A.tpl === 'arch' ? fl('span', T('Span (m)', 'ช่วง (ม.)'), 'n') + fl('rise', T('Arch rise (m)', 'ความสูงโค้ง (ม.)'), 'n') + fl('panels', T('Hanger panels (even)', 'จำนวนช่องสลิง (คู่)'), 'n') + fl('width', T('Width between arches (m)', 'ระยะห่างซี่โค้ง (ม.)'), 'n')
              : A.tpl === 'cable' ? fl('side', T('Back span (m)', 'ช่วงหลัง (ม.)'), 'n') + fl('main', T('Main span (m)', 'ช่วงหลัก (ม.)'), 'n') + fl('pylon', T('Pylon height above deck (m)', 'ความสูงเสาเหนือพื้น (ม.)'), 'n') + fl('spacing', T('Cable spacing on the deck (m)', 'ระยะเคเบิลบนพื้น (ม.)'), 'n') + fl('width', T('Deck width (m)', 'ความกว้างพื้น (ม.)'), 'n')
                : `<p class="muted">${T('An empty bridge model with concrete and steel of the chosen standard, dead and superimposed-dead cases, and the code traffic model ready for your lanes.', 'โมเดลสะพานว่าง มีคอนกรีตและเหล็กตามมาตรฐาน กรณีน้ำหนักคงที่ และแบบจำลองจราจรตามมาตรฐาน')}</p>`)
        : A.tpl === 'building' ? fl('bx', T('Bays in X (m), comma separated', 'ช่วงแกน X (ม.) คั่นด้วยจุลภาค')) + fl('by', T('Bays in Y (m)', 'ช่วงแกน Y (ม.)')) + fl('st', T('Storey heights (m), bottom up', 'ความสูงชั้น (ม.) จากล่างขึ้นบน')) + fl('g', T('Beam dead UDL G (kN/m, plus self-weight)', 'น้ำหนักคงที่บนคาน G (kN/m ไม่รวมน้ำหนักตัวเอง)'), 'n') + fl('q', T('Beam live UDL Q (kN/m)', 'น้ำหนักจรบนคาน Q (kN/m)'), 'n') + fl('wind', T('Wind force per floor, each direction (kN)', 'แรงลมต่อชั้น แต่ละทิศ (kN)'), 'n')
        : A.tpl === 'shed' || A.tpl === 'portal' ? fl('span', T('Span (m)', 'ช่วงกว้าง (ม.)'), 'n') + fl('eave', T('Eave height (m)', 'ความสูงชายคา (ม.)'), 'n') + fl('rise', T('Apex rise (m)', 'ความสูงจั่ว (ม.)'), 'n') + fl('bay', T('Frame spacing (m)', 'ระยะห่างโครง (ม.)'), 'n') + (A.tpl === 'shed' ? fl('nb', T('Number of bays', 'จำนวนช่วง'), 'n') : '') + `<label>${T('Bases', 'ฐาน')}${sel([['pin', T('Pinned', 'หมุด')], ['fixed', T('Fixed', 'ยึดแน่น')]], p.base, 'data-tp="base"')}</label>`
          : A.tpl === 'beam' ? fl('spans', T('Spans (m), comma separated', 'ช่วงคาน (ม.) คั่นด้วยจุลภาค')) + fl('g', T('Dead UDL G (kN/m, plus self-weight)', 'น้ำหนักคงที่ G (kN/m ไม่รวมน้ำหนักตัวเอง)'), 'n') + fl('q', T('Live UDL Q (kN/m)', 'น้ำหนักจร Q (kN/m)'), 'n')
            : A.tpl === 'truss' ? `<label>${T('Type', 'ชนิด')}${sel([['pratt', 'Pratt'], ['howe', 'Howe'], ['warren', 'Warren']], p.kind, 'data-tp="kind"')}</label>` + fl('span', T('Span (m)', 'ช่วงกว้าง (ม.)'), 'n') + fl('depth', T('Depth (m)', 'ความลึก (ม.)'), 'n') + fl('panels', T('Panels (even)', 'จำนวนช่อง (คู่)'), 'n') + fl('load', T('Dead load per top node (kN)', 'น้ำหนักคงที่ต่อจุดต่อบน (kN)'), 'n')
              : `<p class="muted">${T('An empty 3D model with a concrete grade, a steel grade, a rectangle and a steel section from the chosen standard, and G and Q load cases.', 'โมเดล 3 มิติว่าง มีคอนกรีต เหล็ก หน้าตัดสี่เหลี่ยมและหน้าตัดเหล็กตามมาตรฐานที่เลือก และกรณีน้ำหนัก G และ Q')}</p>`;
      return `<div class="modal an-tpl" data-stop="1"><h3>${T('New model from a template', 'สร้างแบบจำลองจากแม่แบบ')}</h3><div class="seg" role="group">${Object.entries(TPL).map(([k, v]) => `<button data-act="an-tpl" data-t="${k}" aria-pressed="${A.tpl === k}">${T(v.n[0], v.n[1])}</button>`).join('')}</div><div class="mgrid an-tplf">${form}</div><div class="mfoot"><span class="muted small">${T('Uses the current design standard (' + A.model.std + ') for materials, sections and combinations. Replaces the current model — Undo brings it back.', 'ใช้มาตรฐานปัจจุบัน (' + A.model.std + ') สำหรับวัสดุ หน้าตัด และการรวมน้ำหนัก แทนที่แบบจำลองปัจจุบัน — กดย้อนกลับได้')}</span><span class="grow"></span><button class="btn btn-ghost sm" data-act="an-tplclose">${T('Cancel', 'ยกเลิก')}</button><button class="btn btn-hot sm" data-act="an-tplgo">${T('Create model', 'สร้างแบบจำลอง')}</button></div></div>`;
    }
    function drawAll() {
      redraw(); updCounts();
      const d = $('#anDrawer'); if (d) { const on = A.step === 'res' && fresh(); d.className = 'an-drawer' + (on ? ' on' : '') + (A.drawerMin ? ' min' : ''); d.style.height = on && !A.drawerMin && A.opt.drawerH ? A.opt.drawerH + 'px' : ''; d.innerHTML = drawerHTML(); }
      const u = document.querySelector('[data-act=an-undo]'), rd = document.querySelector('[data-act=an-redo]'); if (u) u.disabled = !A.hist.length; if (rd) rd.disabled = !A.fut.length;
    }
    let resizeBound = false, keyBound = false;
    function mount() {
      const cv = $('#anCv'); if (!cv) return;
      winRefresh(); bindDrawerGrip();
      if (!cv._b) { cv._b = true; bindCanvas(cv); if (G.ResizeObserver) { let raf = 0; let last = [0, 0]; new G.ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (!cv.isConnected) return; const w = cv.clientWidth, h = cv.clientHeight; if (Math.abs(w - last[0]) > 30 || Math.abs(h - last[1]) > 30) { if (last[0]) if (!A.noRefit) A.cam.k = null; last = [w, h]; } redraw(); }); }).observe(cv); } }
      redraw();
      if (!resizeBound) { resizeBound = true; let rt = null; G.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if ($('#anCv')) redraw(); }, 120); }); }
      if (!keyBound) {
        keyBound = true;
        document.addEventListener('mousedown', e => { if (A.ribMenu && !(e.target.closest && (e.target.closest('.an-rmenu') || e.target.closest('[data-m]')))) closeMenu(); });
        G.addEventListener('resize', () => closeMenu());
        document.addEventListener('dragstart', e => { const t = e.target.closest && e.target.closest('[data-dnd]'); if (!t || S.view !== VIEW) return; A.dnd = t.dataset.dnd; try { e.dataTransfer.setData('text/plain', A.dnd); e.dataTransfer.effectAllowed = 'copy'; } catch (er) { } document.body.classList.add('an-dragging'); });
        document.addEventListener('dragend', () => { A.dnd = null; document.body.classList.remove('an-dragging'); if (A.hover) { A.hover = null; redraw(); } });
        document.addEventListener('keydown', e => {
          if (S.view !== VIEW || !$('#anCv')) return;
          const tg = e.target, typing = tg && (tg.tagName === 'INPUT' || tg.tagName === 'SELECT' || tg.tagName === 'TEXTAREA');
          if ((e.ctrlKey || e.metaKey) && !typing && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo(e.shiftKey); return; }
          if ((e.ctrlKey || e.metaKey) && !typing && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); undo(true); return; }
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); doRun(); return; }
          if (e.key === 'F1') { e.preventDefault(); openWin('help'); return; }
          if (e.key === 'Escape') { if (typing && tg.blur) tg.blur(); escAll(); return; }
          if (typing) return;
          if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) { e.preventDefault(); selectBy('all'); return; }
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          const tool = t => setTool(t);
          const k = e.key.length === 1 ? e.key.toLowerCase() : e.key, c = A.cam, is3 = c.v === '3d';
          if (k === 'Escape' && A.ribMenu) { closeMenu(); return; }
          if (k === 'Escape' && ['pan', 'zoomw', 'qnode', 'qelem', 'orbit'].includes(A.tool)) { setTool('select'); return; }
          if (k === 'Escape') { if (A.draw) { A.draw = null; redraw(); } else if (A.sel.n.length || A.sel.m.length) { A.sel = { n: [], m: [] }; selChanged(); } else if (A.win) { A.win = null; winRefresh(); } }
          else if ((k === 'Delete' || k === 'Backspace') && (A.sel.n.length || A.sel.m.length)) { e.preventDefault(); deleteSel(); }
          else if (k === '?') openWin('help');
          else if (k === 's') tool('select'); else if (k === 'o') tool('orbit'); else if (k === 'n') tool('node'); else if (k === 'e') tool('member');
          else if (k === '3' || k === 'p' || k === 'x' || k === 'y') { camPush(); setView({ 3: '3d', p: 'plan', x: 'xz', y: 'yz' }[k]); ctx.render(); }
          else if (k === 'f') { camPush(); A.cam.k = null; redraw(); }
          else if (k === '+' || k === '=' || k === '-' || k === '_') { const cv = $('#anCv'); zoomAt(cv.clientWidth / 2, cv.clientHeight / 2, k === '+' || k === '=' ? 1.2 : 1 / 1.2); }
          else if (k.startsWith('Arrow')) { e.preventDefault(); const dx = k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : 0, dy = k === 'ArrowUp' ? -1 : k === 'ArrowDown' ? 1 : 0; if (is3) { c.yaw -= dx * 0.12; c.pitch = Math.max(-1.5, Math.min(1.5, c.pitch - dy * 0.12)); } else { const B = basis(c), st = 40 / c.k; c.t = addv(addv(c.t, B.r, dx * st), B.u, -dy * st); } redraw(); }
          else if (BLD && (k === 'PageUp' || k === 'PageDown')) { e.preventDefault(); stepStory(k === 'PageUp' ? 1 : -1); }
          else if (k === 'w') { A.solid = !A.solid; ribRefresh(); redraw(); }
          else if (k === 'l') { if (!A.loadsOn && !A.model.cases.some(q => q.id === A.lcase) && A.lcase !== 'all') A.lcase = (A.model.cases[0] || {}).id || ''; A.loadsOn = !A.loadsOn; syncLshow(); redraw(); }
          else if (k === 't') { A.labels = !A.labels; redraw(); }
          else if (k === 'i') selectBy('inv');
        });
      }
    }

    // ------------------------------------------------------------------ input handlers
    function onInput(t) {
      if (BRG && (bridgeInput(t) || ilInput(t))) return true;
      if (bldInput(t)) return true;
      if (t.dataset.tp) { A.tplP = Object.assign({}, TPL[A.tpl].p, A.tplP || {}); A.tplP[t.dataset.tp] = t.value; return true; }
      if (t.dataset.ins) { applyIns(t); return true; }
      if (t.dataset.w && A.win) {
        const k = A.win.k, v = wdef(k), fd = t.dataset.w; v[fd] = t.type === 'checkbox' ? t.checked : t.value;
        if (k === 'sec' && fd === 'series') v.size = SL.sizes(v.series)[0] || '';
        if (k === 'sec' && fd === 'shape') { const o = G.GANTRY ? G.GANTRY.sizeOptions(v.shape) : []; v.tsize = o[0] ? o[0][0] : ''; }
        if (k === 'load' && fd === 'kind' && v.kind === 'moment') v.dir = 'lz'; else if (k === 'load' && fd === 'kind' && !DIRS().some(q => q[0] === v.dir)) v.dir = 'grav';
        if (['type', 'series', 'shape', 'kind', 'on', 'grade', 'sgrade', 'size', 'tsize'].includes(fd)) winRefresh();
        else if (k === 'sec') { const pv = $('#anWPrev'); if (pv) pv.innerHTML = secSVG(wsecObj(v)) + wsecProps(v); }
        else if (RW[k] && RW[k].live && RW[k].live.includes(fd)) winRefresh();
        return true;
      }
      if (t.dataset.def) { const k = t.dataset.def; if (k === 'sec') A.lastSec = t.value; else if (k === 'mat') A.lastMat = t.value; else A.lastType = t.value; return true; }
      if (t.dataset.cb) { const cb = A.cb, k = t.dataset.cb; if (k === 'name' || k === 'type') cb[k] = t.value; else { cb.rows[+t.dataset.i][k] = k === 'f' ? t.value : t.value; const pv = document.querySelector('.an-cbprev'); if (pv) pv.textContent = cb.rows.filter(r => r.c && +r.f).map(r => f(+r.f, 2).replace(/\.?0+$/, '') + r.c).join(' + ') || '—'; } return true; }
      if (t.dataset.opt) {
        const k = t.dataset.opt;
        if (k === 'plane') { snap(true); A.model.plane = t.value; changed(false); return true; }
        A.opt[k] = t.type === 'checkbox' ? t.checked : k === 'snap' ? frU(+t.value, 'L') : +t.value; persist(); if (k !== 'snap') { A.ver++; updCounts(); } return true;
      }
      if (t.id === 'an-ss') { A.ss = t.value; const z = $('#an-sz'); if (z) z.innerHTML = (SL.LIB[t.value] ? SL.sizes(t.value).map(q => [q, q]) : (G.GANTRY ? G.GANTRY.sizeOptions(t.value) : [])).map(o => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join(''); return true; }
      if (t.id === 'an-mlk') { A.mlk = t.value; sideRefresh(); return true; }
      if (t.id === 'an-src') { A.src = t.value; drawAll(); return true; }
      if (t.id === 'an-lcase') { A.lcase = t.value; A.loadsOn = true; syncLshow(); redraw(); sideRefresh(); return true; }
      if (t.id === 'an-lshow') { if (t.value) { A.lcase = t.value; A.loadsOn = true; } else A.loadsOn = false; redraw(); if (['case', 'load'].includes(A.step)) sideRefresh(); return true; }
      if (t.id === 'an-upre' || t.id === 'an-uF' || t.id === 'an-uL' || t.id === 'an-uT') {
        const u = Object.assign({}, UU()); if (t.id === 'an-upre') { if (!UPRE[t.value]) return true; Object.assign(u, UPRE[t.value]); } else u[t.id.slice(4)] = t.value;
        A.opt.u = u; persist(); ctx.render(); if (A.win) winRefresh(); const rw = $('#reportWrap'); if (rw && rw.innerHTML) renderReport();
        toast(T('Units: ', 'หน่วย: ') + ulab('F') + ', ' + ulab('L') + ', ' + ulab('M') + ', ' + ulab('T'), ''); return true;
      }
      if (t.id === 'an-selby') { const v = t.value; t.value = ''; if (v) selectBy(v); return true; }
      if (t.id === 'an-modesel') { A.mode = +t.value; redraw(); return true; }
      if (t.id === 'an-scale') { A.dscale = +t.value; redraw(); return true; }
      if (t.id === 'an-labels') { A.labels = t.checked; redraw(); return true; }
      if (t.id === 'an-cut') { A.cut = t.value === 'all' ? 'all' : +t.value; if (BLD && A.cut !== 'all' && storyOfZ(A.cut)) A.story = storyOfZ(A.cut).id; A.cam.k = null; A.sel = { n: [], m: [] }; redraw(); sideRefresh(); return true; }
      if (t.id === 'an-file') {
        const fl = t.files[0]; if (!fl) return true;
        fl.text().then(txt => { try { const j = JSON.parse(txt), mm = migrate(j.model || j); if (!mm || !mm.nodes || !mm.members) throw 0; snap(true); A.model = Object.assign({ loads: [], combos: [], cases: [], sections: [], materials: [], std: 'AS' }, mm); if (j.opt) A.opt = Object.assign(A.opt, j.opt); afterNewModel(); toast(T('Model opened', 'เปิดแบบจำลองแล้ว'), 'ok'); } catch (e) { toast(T('That file is not a StructCap model.', 'ไฟล์นี้ไม่ใช่แบบจำลอง StructCap'), 'bad'); } });
        return true;
      }
      if (!t.dataset.tb) return false;
      const tb = t.dataset.tb, i = +t.dataset.i, fd = t.dataset.f, row = A.model[tb] && A.model[tb][i]; if (!row) return true;
      snap();
      const v = t.type === 'checkbox' ? t.checked : t.value, uq = FQ[tb] && FQ[tb][fd];
      let side = false;
      if (uq) row[fd] = v === '' ? '' : frU(+v, uq);
      else if (fd.startsWith('f.')) { row.f = row.f || {}; const k = fd.slice(2); if (v === '' || +v === 0) delete row.f[k]; else row.f[k] = +v; }
      else if (fd === 'id') { const nid = String(v).trim(); if (!nid || A.model[tb].some((o, k) => k !== i && o.id === nid)) { t.classList.add('bad'); return true; } t.classList.remove('bad'); renameRefs(tb, row.id, nid); const ok = { materials: 'mat', sections: 'sec', combos: 'combo' }[tb]; if (ok && OPEN[ok] === String(row.id)) OPEN[ok] = nid; row.id = nid; }
      else if (['x', 'y', 'z', 'b', 'h', 'd', 'bf', 'tf', 'tw', 'D', 'A', 'I', 'Iz', 'Iy', 'J', 'E', 'nu', 'rho', 'Fx', 'Fy', 'Fz', 'Mx', 'My', 'Mz', 'w1', 'P', 'M', 'beta'].includes(fd)) row[fd] = v === '' ? '' : +v;
      else row[fd] = v;
      if (tb === 'nodes' && fd === 'sup' && v === 'custom' && !row.fix) row.fix = F.SUPS.pin.slice();
      if (tb === 'sections' && fd === 'shape') { const o = G.GANTRY ? G.GANTRY.sizeOptions(v) : []; row.size = o[0] ? o[0][0] : ''; side = true; }
      if (tb === 'sections' && fd === 'series') { row.size = SL.sizes(v)[0] || ''; row.name = row.size; side = true; }
      if (tb === 'sections' && fd === 'size' && row.type === 'std') row.name = v;
      if (tb === 'sections' && fd === 'type') { const ser0 = stdInfo(A.model.std).series[0]; Object.assign(row, { rect: { b: 300, h: 500 }, I: { d: 356, bf: 171, tf: 11.5, tw: 7.3 }, circ: { D: 400 }, std: { series: ser0, size: SL.sizes(ser0)[0] }, tube: { shape: 'SHS', size: (G.GANTRY ? G.GANTRY.sizeOptions('SHS')[0][0] : '') }, user: { A: 10000, Iz: 100e6, Iy: 50e6, J: 20e6 } }[v]); side = true; }
      if (tb === 'loads' && fd === 'kind' && v === 'temp') { Object.assign(row, { dT: row.dT || 20, dTy: row.dTy || 0, dTz: row.dTz || 0 }); side = true; }
      else if (tb === 'loads' && fd === 'kind') { Object.assign(row, v === 'udl' ? { w1: row.w1 || 5, dir: row.dir && !/^l?[xyz]$/.test(row.dir) || /^l[yz]$/.test(row.dir) ? row.dir : 'grav' } : v === 'point' ? { P: row.P || 10, a: row.a || 1, dir: GDIR[row.dir] || /^l[yz]$/.test(row.dir) ? row.dir : 'grav' } : { M: row.M || 10, a: row.a || 1, dir: 'lz' }); side = true; }
      if (tb === 'members' && (fd === 'type' || fd === 'i' || fd === 'j')) side = true;
      if ((tb === 'materials' || tb === 'sections') && ['E', 'nu', 'rho', 'b', 'h', 'D', 'd', 'bf', 'tf', 'tw', 'A', 'Iz', 'Iy', 'J'].includes(fd)) { const li = t.closest('.an-li'); if (li) { const sb = li.querySelector('.an-lis'); if (sb && tb === 'materials') sb.textContent = (row.name || '') + ' · E ' + f(+row.E || 0, 0); } }
      changed(side);
      return true;
    }
    function afterNewModel() { A.sel = { n: [], m: [] }; A.src = null; A.draw = null; A.cut = 'all'; A.cb = null; A.res = null; A.err = null; A.lcase = (A.model.cases[0] || {}).id || ''; setView(A.model.plane === 'XZ' ? 'xz' : '3d'); A.ver++; persist(); if (A.step === 'res' || A.step === 'run') A.step = 'node'; ctx.render(); }
    function doRun() {
      if (BRG && !A._busy && ((A.model.bridge || {}).mlc || []).length) { A._busy = true; toast(T('Analysing the bridge — moving loads and stages…', 'กำลังวิเคราะห์สะพาน — น้ำหนักเคลื่อนที่และขั้นตอน…'), ''); setTimeout(() => { try { doRun(); } finally { A._busy = false; } }, 40); return; }
      const ok = run();
      if (ok) { A.step = 'res'; if (!A.rview || (A.rview === 'mode' && !A.res.modal) || (A.rview === 'buck' && !A.res.buckling)) A.rview = 'Mz'; toast(T('Analysis complete — ', 'วิเคราะห์เสร็จ — ') + A.res.ms + ' ms', 'ok'); }
      else { A.step = 'run'; toast(A.err, 'bad'); }
      ctx.render();
    }
    function onClick(a, b) {
      const m = A.model;
      if (a === 'an-rb') { ribCmd(b.dataset.c, b.dataset.v, b); return true; }
      if (a === 'an-ribtab') { closeMenu(); A.rib = b.dataset.t; A.ribMin = false; ribRefresh(); return true; }
      if (a === 'an-ribmin') { closeMenu(); A.ribMin = !A.ribMin; ribRefresh(); return true; }
      closeMenu();
      if (a === 'an-step') { const s0 = b.dataset.s; A.step = A.step === s0 && b.classList.contains('an-th') ? null : s0; if (A.step === 'load' && !m.cases.some(c => c.id === A.lcase)) A.lcase = (m.cases[0] || {}).id || ''; if (A.step === 'load' || A.step === 'case') A.loadsOn = true; ctx.render(); }
      else if (a === 'an-std') { const k = b.dataset.k; if (k === m.std) return true; snap(true); m.std = k; A.ss = null; changed(true); ctx.render(); toast(T('Design standard: ', 'มาตรฐาน: ') + T(stdInfo(k).name[0], stdInfo(k).name[1]) + T(' — new materials, sections and combinations follow it.', ' — วัสดุ หน้าตัด และการรวมน้ำหนักใหม่จะเป็นไปตามมาตรฐานนี้'), 'ok'); }
      else if (a === 'an-rtab') { A.rtab = b.dataset.t; const r = $('#anRes'); if (r) r.innerHTML = resultsHTML(); }
      else if (a === 'an-rv') { A.rview = b.dataset.v; if (A.rview === 'buck' && !(A.src || '').startsWith('combo:')) { const c = m.combos.find(q => q.type === 'ULS'); if (c) A.src = 'combo:' + c.id; } sideRefresh(); drawAll(); }
      else if (a === 'an-disp') { A.solid = b.dataset.d === 'solid'; document.querySelectorAll('.an-tools [data-act=an-disp]').forEach(x => x.setAttribute('aria-pressed', (x.dataset.d === 'solid') === A.solid)); if (A.solid && A.step === 'res') toast(T('Solid view shows in model mode; results are drawn on the centre-lines.', 'มุมมองทรงตันแสดงในโหมดแบบจำลอง ผลลัพธ์แสดงบนเส้นแกน'), ''); redraw(); }
      else if (a === 'an-lpick') { A.lcase = b.dataset.c; A.loadsOn = true; syncLshow(); sideRefresh(); redraw(); }
      else if (a === 'an-llist') { A.llist = !A.llist; sideRefresh(); }
      else if (a === 'an-tool') { A.tool = b.dataset.t === 'box' ? 'select' : b.dataset.t; ribRefresh(); A.draw = null; document.querySelectorAll('.an-tools [data-act=an-tool]').forEach(x => x.setAttribute('aria-pressed', x.dataset.t === A.tool)); if ((A.tool === 'node' || A.tool === 'member') && A.cam.v === '3d') toast(T('Tip: in Plan or an Elevation you can click empty grid points to create nodes.', 'เคล็ดลับ: ในแปลนหรือรูปด้าน คลิกตำแหน่งว่างเพื่อสร้างจุดต่อ'), ''); if (b.closest('.an-panel')) sideRefresh(); redraw(); }
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
      if (a === 'an-del' && A.win) winRefresh();
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
      else if (a === 'an-addnode') { const p = ['an-nx', 'an-ny', 'an-nz'].map(id => frU(+($('#' + id).value) || 0, 'L')); snap(true); const id = ensureNode(p); A.sel = { n: [id], m: [] }; changed(true); redraw(true); }
      else if (a === 'an-move') { const dd = ['an-mx', 'an-my', 'an-mz'].map(id => frU(+($('#' + id).value) || 0, 'L')); snap(true); const nd = nodeMap(); A.sel.n.forEach(id => { const n = nd[id]; n.x = r4((+n.x || 0) + dd[0]); n.y = r4((+n.y || 0) + dd[1]); n.z = r4((+n.z || 0) + dd[2]); }); changed(true); redraw(true); }
      else if (a === 'an-nl') { const cs = A.lcase, o = {}; ['Fx', 'Fy', 'Fz', 'Mx', 'My', 'Mz'].forEach(q => { o[q] = frU(+($('#an-n' + q).value) || 0, q[0] === 'F' ? 'F' : 'M'); }); if (!Object.values(o).some(Boolean)) { toast(T('Enter a force or moment.', 'ใส่ค่าแรงหรือโมเมนต์'), 'bad'); return true; } snap(true); A.sel.n.forEach(id => m.loads.push(nload(cs, id, o))); changed(true); toast(T('Load added to ' + A.sel.n.length + ' node(s) in ' + cs, 'เพิ่มแรงให้ ' + A.sel.n.length + ' จุดต่อ ในกรณี ' + cs), 'ok'); }
      else if (a === 'an-ml' && $('#an-mlk') && $('#an-mlk').value === 'temp') {
        const cs = A.lcase, o = { dT: frU(+$('#an-tu').value || 0, 'T'), dTy: frU(+$('#an-ty').value || 0, 'T'), dTz: frU(+$('#an-tz').value || 0, 'T') };
        if (!o.dT && !o.dTy && !o.dTz) { toast(T('Enter a temperature change.', 'ใส่ค่าการเปลี่ยนแปลงอุณหภูมิ'), 'bad'); return true; }
        snap(true); A.sel.m.forEach(id => { if (m.members.some(z => z.id === id)) m.loads.push(Object.assign({ case: cs, kind: 'temp', member: id }, o)); });
        changed(true); toast(T('Temperature load added to ' + A.sel.m.length + ' element(s) in ' + cs, 'เพิ่มแรงจากอุณหภูมิให้ ' + A.sel.m.length + ' ชิ้นส่วน ในกรณี ' + cs), 'ok');
      }
      else if (a === 'an-ml') {
        const cs = A.lcase, kd = $('#an-mlk').value, dir = $('#an-mld').value, uq = kd === 'udl' ? 'w' : kd === 'point' ? 'F' : 'M', v = frU(+$('#an-mlv').value || 0, uq), v2r = $('#an-mlv2') ? $('#an-mlv2').value : '', v2 = v2r === '' ? '' : frU(+v2r, uq), aa0 = $('#an-mla').value, bb0 = $('#an-mlb') ? $('#an-mlb').value : '', aa = aa0 === '' ? '' : frU(+aa0, 'L'), bb = bb0 === '' ? '' : frU(+bb0, 'L');
        if (!v && !(+v2)) { toast(T('Enter a load value.', 'ใส่ค่าแรง'), 'bad'); return true; }
        snap(true); const nd = nodeMap();
        A.sel.m.forEach(id => { const q = m.members.find(z => z.id === id); if (!q) return; const L = Math.hypot(...sub(P3(nd[q.j]), P3(nd[q.i]))); if (kd === 'udl') m.loads.push({ case: cs, kind: 'udl', member: id, dir, w1: v, w2: v2 === '' ? '' : +v2, a: aa === '' ? '' : +aa, b: bb === '' ? '' : +bb }); else if (kd === 'point') m.loads.push({ case: cs, kind: 'point', member: id, dir, P: v, a: aa === '' ? r4(L / 2) : +aa }); else m.loads.push({ case: cs, kind: 'moment', member: id, dir, M: v, a: aa === '' ? r4(L / 2) : +aa }); });
        changed(true); toast(T('Load added to ' + A.sel.m.length + ' element(s) in ' + cs, 'เพิ่มแรงให้ ' + A.sel.m.length + ' ชิ้นส่วน ในกรณี ' + cs), 'ok');
      }
      else if (a === 'an-mlclear') { const cs = A.lcase, sm = new Set(A.sel.m), sn = new Set(A.sel.n), n0 = m.loads.length; snap(true); m.loads = m.loads.filter(l => !(l.case === cs && (l.kind === 'node' ? sn.has(l.node) : sm.has(l.member)))); changed(true); toast(T((n0 - m.loads.length) + ' load(s) removed', 'ลบแรง ' + (n0 - m.loads.length) + ' รายการ'), 'ok'); }
      else if (a === 'an-split') { const n = Math.max(2, Math.min(20, +$('#an-splitn').value | 0)); snap(true); const segs = splitMember(A.sel.m[0], n); A.sel = { n: [], m: segs }; changed(true); }
      else if (a === 'an-replicate') { const dd = ['an-rx', 'an-ry', 'an-rz'].map(id => frU(+($('#' + id).value) || 0, 'L')), n = Math.max(1, Math.min(50, +$('#an-rn').value | 0)), c = $('#an-rc').checked, l = $('#an-rl').checked; A.rep = dd.concat([n, c, l]); A.repOpen = true; if (!dd.some(Boolean)) { toast(T('Enter a distance to copy by.', 'ใส่ระยะที่ต้องการคัดลอก'), 'bad'); return true; } replicate(dd, n, c, l); redraw(true); }
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
        tbl([T('Node', 'จุดต่อ'), 'X (' + ulab('L') + ')', 'Y (' + ulab('L') + ')', 'Z (' + ulab('L') + ')', T('Support', 'จุดรองรับ')], lim(m.nodes, 200).map(n => [esc(n.id), fu(+n.x || 0, 'L'), fu(+n.y || 0, 'L'), fu(+n.z || 0, 'L'), esc(supName(n))])) + more(m.nodes, 200) +
        tbl([T('Member', 'ชิ้นส่วน'), 'i', 'j', T('Section', 'หน้าตัด'), T('Material', 'วัสดุ'), T('Type', 'ชนิด'), T('Hinges', 'บานพับ'), 'β°', 'L (' + ulab('L') + ')'], lim(m.members, 200).map(x => { const a2 = nd[x.i], b2 = nd[x.j]; return [esc(x.id), esc(x.i), esc(x.j), esc(x.sec), esc(x.mat), x.type === 'truss' ? T('truss', 'โครงถัก') : T('frame', 'โครงข้อแข็ง'), (x.relI ? 'i ' : '') + (x.relJ ? 'j' : ''), f(+x.beta || 0, 0), a2 && b2 ? fu(Math.hypot(...sub(P3(b2), P3(a2))), 'L') : '']; })) + more(m.members, 200) +
        tbl([T('Section', 'หน้าตัด'), T('Name', 'ชื่อ'), 'A (mm²)', 'I<sub>z</sub> (×10⁶ mm⁴)', 'I<sub>y</sub> (×10⁶ mm⁴)', 'J (×10⁶ mm⁴)'], m.sections.map(s => { const p = F.secProps(s); return [esc(s.id), esc(s.name || s.type), f(p.A, 0), f(p.Iz / 1e6, 2), f(p.Iy / 1e6, 2), f(p.J / 1e6, 3)]; })) +
        tbl([T('Material', 'วัสดุ'), 'E (MPa)', 'ν', T('Unit weight', 'หน่วยน้ำหนัก') + ' (' + ulab('g') + ')', 'α (' + ulab('al') + ')'], m.materials.map(x => [esc(x.id + (x.name ? ' — ' + x.name : '')), f(+x.E, 0), f(x.nu === undefined ? 0.3 : +x.nu, 2), fu(+x.rho, 'g', UU().F === 'kN' ? 1 : 3), fx(toU(+x.alpha || F.alphaOf(x) * 1e6, 'al'), 2)])));
      html += sec(2, T('Loads and combinations', 'แรงและกรณีรวมแรง'), m.cases.filter(c => m.loads.some(l => l.case === c.id)).map(c => fig('model', c.id, '<b>' + esc(c.id) + '</b> — ' + esc(c.name))).join('') +
        tbl([T('Case', 'กรณี'), T('Name', 'ชื่อ'), T('Type', 'ประเภท'), T('Self-weight', 'น้ำหนักตัวเอง')], m.cases.map(c => [esc(c.id), esc(c.name), c.type, c.sw ? '✓' : ''])) +
        tbl([T('Case', 'กรณี'), T('On', 'ที่'), T('Load', 'แรง'), T('Values', 'ค่า')], lim(m.loads.filter(l => !l.gen), 300).map(l => [esc(l.case), esc(l.kind === 'node' ? l.node : l.member), l.kind === 'node' ? T('nodal', 'ที่จุดต่อ') : l.kind === 'temp' ? T('temperature', 'อุณหภูมิ') : l.kind, esc(loadDesc(l))])) + more(m.loads, 300) +
        tbl([T('Combination', 'กรณีรวมแรง'), T('Type', 'ชนิด'), T('Factors', 'ตัวคูณ')], m.combos.map(c => [esc(c.id + ' — ' + c.name), c.type, Object.entries(c.f || {}).map(([k2, v]) => f(v, 2) + '·' + esc(k2)).join(' + ')])));
      html += sec(3, T('Analysis', 'การวิเคราะห์'), `<p class="rp-txt">${T('Finite-element stiffness method, ' + (m.plane === 'XZ' ? '2D frame elements in the X–Z plane' : '3D frame elements with 6 degrees of freedom per node (axial, two shears, torsion, two bending moments)') + ', exact fixed-end actions for member loads, member end releases by static condensation.', 'วิธีสติฟเนสไฟไนต์เอลิเมนต์ ' + (m.plane === 'XZ' ? 'ชิ้นส่วนโครงข้อแข็ง 2 มิติในระนาบ X–Z' : 'ชิ้นส่วนโครงข้อแข็ง 3 มิติ 6 องศาอิสระต่อจุด (แรงตามแนวแกน แรงเฉือนสองทิศ แรงบิด โมเมนต์ดัดสองแกน)') + ' ใช้แรงปลายยึดแน่นที่แม่นตรง และปลดแรงปลายชิ้นส่วนด้วย static condensation')} ${A.opt.pdelta && pro() ? T('Second-order P-Delta analysis of every combination (members subdivided into ' + A.opt.nseg + ' segments).', 'วิเคราะห์อันดับสอง P-Delta ทุกกรณีรวมแรง (แบ่งชิ้นส่วนเป็น ' + A.opt.nseg + ' ส่วน)') : T('First-order (linear) analysis; combinations by superposition.', 'วิเคราะห์อันดับหนึ่ง (เชิงเส้น) รวมแรงโดยการซ้อนทับ')} ${T('Sign convention: N tension +; M_z + = tension on the −y side, M_y + = tension on the −z side of the member local axes.', 'เครื่องหมาย: N แรงดึง +; M_z + ดึงด้าน −y, M_y + ดึงด้าน −z ของแกนเฉพาะที่')}</p>`);
      let n = 4;
      m.combos.filter(c => r.combos[c.id] && !r.combos[c.id].failed).forEach(c => {
        A.src = 'combo:' + c.id; const rc = current(); if (!rc) return;
        const sums = lim(rc.mem, 200).map(mm => { const e = q => [Math.max(...mm[q]), Math.min(...mm[q])], am = q => Math.max(...mm[q].map(Math.abs)); const N = e('N'), My = e('My'), Mz = e('Mz'); return [esc(mm.id), fu(N[0], 'F', 1), fu(N[1], 'F', 1), fu(am('Vy'), 'F', 1), fu(am('Vz'), 'F', 1), fu(am('T'), 'M', 1), fu(My[0], 'M', 1), fu(My[1], 'M', 1), fu(Mz[0], 'M', 1), fu(Mz[1], 'M', 1), fu(Math.max(...mm.drel.map(Math.abs), ...mm.drelz.map(Math.abs)), 'd', 1)]; });
        const ri = m.nodes.map((nn, i) => [nn, i]).filter(([nn]) => supN.includes(nn));
        html += sec(n++, esc(c.id + ' — ' + c.name) + ' <span class="rp-cl">' + c.type + '</span>', (c.type === 'ULS' ? `<div class="an-figs">${fig('Mz', null, 'M<sub>z</sub> (' + ulab('M') + ')')}${m.plane === 'XZ' ? fig('N', null, 'N (' + ulab('F') + ')') : fig('My', null, 'M<sub>y</sub> (' + ulab('M') + ')')}</div>` : `<div class="an-figs">${fig('def', null, T('Deflected shape', 'รูปการโก่งตัว'))}</div>`) +
          tbl([T('Node', 'จุดต่อ'), 'Rx', 'Ry', 'Rz (' + ulab('F') + ')', 'Mx', 'My', 'Mz (' + ulab('M') + ')'], ri.map(([nn, i]) => [esc(nn.id)].concat([0, 1, 2, 3, 4, 5].map(d => fu(rc.R[6 * i + d], d < 3 ? 'F' : 'M'))))) +
          tbl([T('Member', 'ชิ้นส่วน'), 'N max', 'N min', '|V<sub>y</sub>|', '|V<sub>z</sub>|', '|T| (' + ulab('M') + ')', 'M<sub>y</sub> max', 'M<sub>y</sub> min', 'M<sub>z</sub> max', 'M<sub>z</sub> min', 'δ (' + ulab('d') + ')'], sums) + more(rc.mem, 200));
      });
      A.src = keep.src;
      if (r.modal) html += sec(n++, T('Modal analysis', 'การวิเคราะห์โหมด'), tbl([T('Mode', 'โหมด'), 'f (Hz)', 'T (s)', T('Mass X', 'มวล X'), 'Y', 'Z'], r.modal.modes.map((md, i) => [i + 1, f(md.f, 3), f(md.T, 3), f(md.mx * 100, 1) + '%', f(md.my * 100, 1) + '%', f(md.mz * 100, 1) + '%'])));
      if (r.buckling) html += sec(n++, T('Elastic buckling', 'การโก่งเดาะแบบยืดหยุ่น'), tbl([T('Combination', 'กรณีรวมแรง'), 'λcr,1', 'λcr,2', 'λcr,3'], m.combos.filter(c => r.buckling[c.id]).map(c => { const b2 = r.buckling[c.id], l = b2.modes ? b2.modes.map(q => f(q.lam, 2)) : []; return [esc(c.id + ' — ' + c.name), l[0] || (b2.none ? '∞' : '—'), l[1] || '—', l[2] || '—']; })));
      if (BLD) { const bo = bldReport(sec, tbl, n); html += bo.html; n = bo.n; }
      { const qo = qtoReport(sec, tbl, n); html += qo.html; n = qo.n; }
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
          <p class="rp-foot"><b>${COPY}</b> · ${T('Generated by StructCap. Units ' + ulab('F') + ', ' + ulab('L') + ', ' + ulab('M') + ', ' + ulab('T') + '. The engineer remains responsible for the model, loads and interpretation of results.', 'จัดทำโดย StructCap หน่วย ' + ulab('F') + ', ' + ulab('L') + ', ' + ulab('M') + '  วิศวกรต้องรับผิดชอบต่อแบบจำลอง แรง และการตีความผลลัพธ์')}</p>
        </article>`;
    }


    // ================================================================== ribbon menu (top) — tabs, groups, commands
    Object.assign(A, { rib: 'struct', ribMin: false, ribMenu: null, camHist: [], hidN: new Set(), hidM: new Set(), grid: true, lblN: true, lblM: true, showSup: true, allAxes: false, prevSel: null, selCur: null, ltype: 'static', qinfo: null });
    if (!A.opt.views) A.opt.views = [];
    // ---- icons (own drawings, 24 × 24, stroke = currentColor, .ac = accent)
    const IC = {
      slab: '<path d="M3 15l9-5 9 5-9 5z"/><path class="ac" d="M3 15v2l9 5 9-5v-2"/><path d="M7.5 12.5l9 5M16.5 12.5l-9 5"/><path d="M12 3v5M9.5 5.5L12 8l2.5-2.5"/>',
      wind: '<path d="M3 8h11a3 3 0 1 0-3-3"/><path class="ac" d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h7"/><path d="M21 4v16" stroke-dasharray="2 2"/>',
      qto: '<path d="M4 17l6-3 6 3-6 3z"/><path d="M4 17V9l6-3 6 3v8M10 14V6"/><rect class="ac" x="16.5" y="3" width="5" height="8" rx="1"/><path class="ac" d="M18 6h2M18 8.5h2"/>',
      redraw: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path class="ac" d="M20.5 4v5h-5"/>',
      home: '<rect x="3" y="4" width="18" height="13" rx="1.5"/><path d="M8 21h8M12 17v4"/><path class="ac" d="M8 12.5l4-3.5 4 3.5M9.5 11.5V15h5v-3.5"/>',
      back: '<rect x="3" y="4" width="18" height="13" rx="1.5"/><path d="M8 21h8M12 17v4"/><path class="ac" d="M14 7.5l-4 3 4 3"/>',
      orbit: '<ellipse cx="12" cy="12" rx="9" ry="3.8"/><path d="M12 3v18"/><path class="ac" d="M17.5 6.5l2 1.8-2.4 1.2"/>',
      zoom: '<circle cx="10" cy="10" r="6"/><path d="M14.5 14.5L21 21"/><path class="ac" d="M10 7v6M7 10h6"/>',
      pan: '<path d="M12 3v18M3 12h18"/><path class="ac" d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
      cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path class="ac" d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
      mark: '<path d="M6 3h12v18l-6-4.2L6 21z"/><path class="ac" d="M9 8h6"/>',
      solid: '<path class="acf" d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
      wire: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path class="ac" stroke-dasharray="2 2" d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
      tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle class="ac" cx="7.5" cy="8" r="1.6"/>',
      cursor: '<path class="acf" d="M5 3l14 8-6.2 1.8L10 19z"/><path d="M5 3l14 8-6.2 1.8L10 19z"/>',
      unsel: '<path d="M4 3l12 7-5.3 1.5L8.5 17z"/><path class="ac" d="M15 15l6 6M21 15l-6 6"/>',
      prevsel: '<path d="M4 3l12 7-5.3 1.5L8.5 17z"/><path class="ac" d="M21 18a4 4 0 1 1-1.2-2.9M20.5 13.5v2.2h-2.2"/>',
      eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle class="ac" cx="12" cy="12" r="3"/>',
      eyeoff: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><path class="ac" d="M4 4l16 16"/>',
      all: '<rect x="3" y="3" width="7.5" height="7.5" rx="1"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1"/><rect class="ac" x="13.5" y="13.5" width="7.5" height="7.5" rx="1"/>',
      swap: '<path d="M4 8h15l-3.5-3.5"/><path class="ac" d="M20 16H5l3.5 3.5"/>',
      grid: '<path d="M4 4h16v16H4zM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16"/>',
      magnet: '<path d="M6 4v8a6 6 0 0 0 12 0V4h-4v8a2 2 0 0 1-4 0V4z"/><path class="ac" d="M6 7h4M14 7h4"/>',
      palette: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-2s-1-1.6-1-2.6c0-1 .8-1.6 2-1.6h2.5A3.5 3.5 0 0 0 21 11.5C21 6.8 17 3 12 3z"/><circle class="acf" cx="7.5" cy="11" r="1.4"/><circle class="acf" cx="10" cy="7" r="1.4"/><circle class="acf" cx="15" cy="7" r="1.4"/>',
      wand: '<path d="M4 20L15 9"/><path class="ac" d="M15 3v3M18 6h3M19.5 3.5l-2 2M12.5 6h1.5M18 10.5V12"/>',
      plane: '<rect x="3" y="5" width="18" height="14" rx="1"/><path class="ac" d="M6 16V9l6 4 6-4v7"/>',
      book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/><path class="ac" d="M9 7h6"/>',
      node: '<circle class="acf" cx="10" cy="14" r="4"/><circle cx="10" cy="14" r="4"/><path d="M17 3v6M14 6h6"/>',
      elem: '<path d="M5 19L17 7"/><circle class="acf" cx="5" cy="19" r="2.4"/><circle class="acf" cx="17" cy="7" r="2.4"/><path d="M19 15v6M16 18h6"/>',
      move: '<circle class="acf" cx="6" cy="18" r="2.5"/><path d="M8.5 15.5L18 6"/><path class="ac" d="M12.5 6H18v5.5"/>',
      divide: '<path d="M3 12h18"/><circle class="acf" cx="4" cy="12" r="1.8"/><circle class="acf" cx="12" cy="12" r="1.8"/><circle class="acf" cx="20" cy="12" r="1.8"/><path class="ac" d="M8 7v3M16 7v3M8 14v3M16 14v3"/>',
      merge: '<path d="M3 6l7 6-7 6"/><path d="M21 6l-7 6 7 6"/><circle class="acf" cx="12" cy="12" r="2"/>',
      del: '<path class="ac" d="M6 6l12 12M18 6L6 18"/>',
      rotate: '<path d="M20 12a8 8 0 1 1-8-8"/><path class="ac" d="M11 1l3 3-3 3"/>',
      mirror: '<path class="ac" stroke-dasharray="2 2" d="M12 2v20"/><path d="M9 7L4 17h5zM15 7l5 10h-5z"/>',
      scale: '<rect x="3" y="12" width="9" height="9"/><path stroke-dasharray="2 2" d="M3 12V3h18v18h-9"/><path class="ac" d="M12 12l7-7M14 5h5v5"/>',
      table: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9h18M3 14h18M9 9v11M15 9v11"/><path class="ac" d="M3 9h18"/>',
      extrude: '<circle class="acf" cx="6" cy="19" r="2.2"/><path d="M6 17V5"/><path class="ac" d="M3.5 8L6 5l2.5 3"/><path d="M12 19h8M12 5h8M12 5v14M20 5v14"/>',
      intersect: '<path d="M4 4l16 16M20 4L4 20"/><circle class="acf" cx="12" cy="12" r="2.6"/>',
      params: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle class="ac" cx="15" cy="7" r="2"/><circle class="ac" cx="9" cy="17" r="2"/>',
      mat: '<path d="M3 8l9-5 9 5-9 5z"/><path class="ac" d="M3 12l9 5 9-5"/><path d="M3 16l9 5 9-5"/>',
      sec: '<path class="acf" d="M5 4h14v3h-5v10h5v3H5v-3h5V7H5z"/><path d="M5 4h14v3h-5v10h5v3H5v-3h5V7H5z"/>',
      secm: '<path d="M3 5h10v3H9.5v8H13v3H3v-3h3.5V8H3z"/><path class="ac" d="M16 7h5M16 12h5M16 17h5"/>',
      support: '<path d="M12 4l7 11H5z"/><path class="ac" d="M3 19h18M6 19l-2 2.5M10 19l-2 2.5M14 19l-2 2.5M18 19l-2 2.5"/>',
      spring: '<circle class="acf" cx="12" cy="3.5" r="1.8"/><path d="M12 5.5v2l5 1.5-10 3 10 3-10 3 5 1.5V21"/><path class="ac" d="M7 21h10"/>',
      release: '<path d="M2 12h7M15 12h7"/><circle class="ac" cx="12" cy="12" r="3"/>',
      beta: '<path d="M4 20h16M4 20V4"/><path class="ac" d="M4 20L17 9"/><path d="M11 20a7 7 0 0 0-1.5-4.4"/>',
      lc: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8"/><path class="ac" d="M8 16h5"/>',
      lcc: '<rect x="3" y="5" width="12" height="15" rx="1.5"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/><path class="ac" d="M9 9.5v6M6 12.5h6"/>',
      weight: '<path d="M8.5 8a3.5 3.5 0 1 1 7 0"/><path d="M5 8h14l2 12H3z"/><path class="ac" d="M12 11v5M10 14l2 2 2-2"/>',
      nload: '<path class="ac" d="M12 2v11M8 9l4 4 4-4"/><circle class="acf" cx="12" cy="18.5" r="2.5"/><path d="M5 22h14"/>',
      udl: '<path d="M3 20h18"/><path class="ac" d="M3 4h18M5 4v10M9.7 4v10M14.3 4v10M19 4v10M3.5 12l1.5 2.5L6.5 12M8.2 12l1.5 2.5 1.5-2.5M12.8 12l1.5 2.5 1.5-2.5M17.5 12l1.5 2.5 1.5-2.5"/>',
      pload: '<path d="M3 20h18"/><path class="ac" d="M12 3v13M8.5 12.5L12 16l3.5-3.5"/>',
      moment: '<path d="M3 20h18"/><path class="ac" d="M8 13a4.5 4.5 0 1 1 6.5 3.9M14 13.5v3.6h3.6"/>',
      thermo: '<path d="M10 4a2 2 0 0 1 4 0v10.2a4 4 0 1 1-4 0z"/><circle class="acf" cx="12" cy="17" r="1.8"/><path class="ac" d="M12 8v7.5"/>',
      tgrad: '<path d="M7 4a2 2 0 0 1 4 0v10.2a4 4 0 1 1-4 0z"/><circle class="acf" cx="9" cy="17" r="1.8"/><path class="ac" d="M15 5h6M15 9h5M15 13h4M15 17h3"/>',
      play: '<path class="acf" d="M7 4l13 8-13 8z"/><path d="M7 4l13 8-13 8z"/>',
      clear: '<path d="M4 7h16M9.5 7V4h5v3M6 7l1 13h10l1-13"/><path class="ac" d="M10 11v6M14 11v6"/>',
      gear: '<circle class="ac" cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
      react: '<path d="M12 9l6 9H6z"/><path d="M3 21h18"/><path class="ac" d="M12 8V2M9 5l3-3 3 3"/>',
      deform: '<path stroke-dasharray="2 2" d="M3 17h18"/><path class="ac" d="M3 17c4-10 14-10 18 0"/><path d="M3 20v-6M21 20v-6"/>',
      forces: '<path d="M3 17h18"/><path class="acf" d="M3 17V9h18v8"/><path d="M3 17V9h18v8"/>',
      diagram: '<path d="M3 8h18"/><path class="acf" d="M3 8c3 11 15 11 18 0z"/><path d="M3 8c3 11 15 11 18 0"/>',
      detail: '<path d="M2 18h12"/><circle cx="16" cy="9" r="5"/><path d="M19.5 12.5L22 15"/><path class="ac" d="M13.5 10.5c1.5-3 3.5-3 5 0"/>',
      mode: '<path d="M3 20h18"/><path class="ac" d="M6 20c-3-6 3-10 0-16M18 20c-3-6 3-10 0-16"/><path d="M6 4h12"/>',
      buckle: '<path d="M3 21h18M3 3h18"/><path class="ac" d="M12 3c-6 6-6 12 0 18"/><path stroke-dasharray="2 2" d="M12 3v18"/>',
      doc: '<path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/><path class="ac" d="M9 12h8M9 16h8"/>',
      status: '<rect x="3" y="3" width="18" height="18" rx="2"/><path class="ac" d="M7 15l3-4 3 2.5 4-6"/>',
      qnode: '<circle class="acf" cx="8" cy="16" r="3.5"/><path class="ac" d="M14 7a3 3 0 1 1 4 2.8c-.6.3-1 .8-1 1.5V13M17 16.5v.5"/>',
      qelem: '<path d="M3 21L12 12"/><circle class="acf" cx="3.5" cy="20.5" r="1.8"/><circle class="acf" cx="12" cy="12" r="1.8"/><path class="ac" d="M14 5a3 3 0 1 1 4 2.8c-.6.3-1 .8-1 1.5V11M17 14.5v.5"/>',
      units: '<rect x="2" y="8" width="20" height="8" rx="1.2"/><path class="ac" d="M6 8v3M10 8v4.5M14 8v3M18 8v4.5"/>',
      help: '<circle cx="12" cy="12" r="9"/><path class="ac" d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5V14M12 17v.5"/>',
      save: '<path d="M4 4h12l4 4v12H4z"/><path d="M7 4v5h8V4"/><rect class="ac" x="7" y="13" width="10" height="7"/>',
      open: '<path d="M3 6h6l2 2h10v11H3z"/><path class="ac" d="M3 11h18"/>',
      undo: '<path d="M9 14L4 9l5-5"/><path class="ac" d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
      redo: '<path d="M15 14l5-5-5-5"/><path class="ac" d="M20 9H10a6 6 0 0 0 0 12h3"/>',
      beam: '<rect x="2" y="8" width="20" height="8" rx="1"/><circle class="acf" cx="6" cy="13.5" r="1.2"/><circle class="acf" cx="12" cy="13.5" r="1.2"/><circle class="acf" cx="18" cy="13.5" r="1.2"/>',
      column: '<rect x="8" y="2" width="8" height="20" rx="1"/><path class="ac" d="M10.5 4v16M13.5 4v16"/>',
      pencil: '<path d="M4 20l1-5L16 4l4 4L9 19z"/><path class="ac" d="M14 6l4 4"/>',
      range: '<path d="M3 20L20 3"/><path class="ac" d="M3 20l5-1M3 20l1-5"/><circle class="acf" cx="20" cy="3" r="1.6"/>',
      list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle class="acf" cx="4" cy="6" r="1.4"/><circle class="acf" cx="4" cy="12" r="1.4"/><circle class="acf" cx="4" cy="18" r="1.4"/>',
      fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><rect class="ac" x="8" y="8" width="8" height="8" rx="1"/>',
      bldg: '<path d="M3 21h18"/><path d="M5 21V5h9v16M14 9h5v12"/><path class="ac" d="M5 10h9M5 15h9M14 14h5M9.5 5v16"/>',
      sample: '<path d="M3 21h18"/><path d="M5 21V7h8v14M13 11h6v10"/><path class="ac" d="M5 12h8M5 16.5h8"/><circle class="acf" cx="18" cy="5" r="3"/><path class="ac" d="M16.8 5l.9.9 1.6-1.8"/>',
      shed: '<path d="M2 20h20"/><path d="M4 20V10l8-5 8 5v10"/><path class="ac" d="M8 20V12M16 20V12M4 10h16"/>',
      portal: '<path d="M2 20h20"/><path d="M4 20V9l8-4 8 4v11"/><path class="ac" d="M3 21.5l1-1.5 1 1.5M19 21.5l1-1.5 1 1.5"/>',
      cbeam: '<path d="M2 11h20"/><path class="ac" d="M3 14l1.5-3 1.5 3zM10.5 14l1.5-3 1.5 3zM18 14l1.5-3 1.5 3z"/><path d="M2 7h20" stroke-dasharray="1.5 2"/>',
      truss: '<path d="M2 17h20M5 9h14"/><path d="M2 17L5 9M22 17l-3-8"/><path class="ac" d="M5 9l3 8 3-8 3 8 3-8 2 8"/>',
      blank: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" stroke-dasharray="2 2"/><path class="ac" d="M12 9v6M9 12h6"/>',
      guide: '<path class="ac" d="M12 2v20M2 12h20" stroke-dasharray="2 2"/><path d="M8 4l8 8-3.5 1L11 17z"/>'
    };
    const icon = (k, big) => `<svg class="an-ic ${big ? 'big' : ''}" viewBox="0 0 24 24" aria-hidden="true">${IC[k] || IC.list}</svg>`;

    // ---- ribbon content: [id, label, groups]; group = [title, items]; item = button {c, i, l, m (menu), on} or {col: [...]}
    const B = (c, i, l, o) => Object.assign({ c, i, l }, o || {});
    const COL = (...items) => ({ col: items });
    function RIB() {
      const tool = t => () => A.tool === t, o = A.opt, temp = A.ltype === 'temp';
      return [
        ['view', T('View', 'มุมมอง'), [
          [T('Dynamic View', 'มุมมองไดนามิก'), [B('redraw', 'redraw', T('Redraw', 'วาดใหม่')), B('initv', 'home', T('Initial View', 'มุมมองเริ่มต้น')), B('prevv', 'back', T('Previous View', 'มุมมองก่อนหน้า')),
            COL(B('orbit', 'orbit', T('Dynamic', 'หมุนอิสระ'), { on: tool('orbit') }), B('zoomm', 'zoom', T('Zoom', 'ซูม'), { m: 1, on: tool('zoomw') }), B('pan', 'pan', T('Pan', 'เลื่อน'), { on: tool('pan') })),
            COL(B('vpm', 'cube', T('View Point', 'จุดมอง'), { m: 1 }), B('namedv', 'mark', T('Named View', 'มุมมองที่บันทึก')), B('zfit', 'fit', T('Zoom Fit', 'ซูมพอดี')))]],
          [T('Render View', 'การแสดงผล'), [B('hidden', 'solid', T('Hidden', 'ทรงตัน'), { on: () => !!A.solid }), COL(B('wire', 'wire', T('Wireframe', 'เส้นโครง'), { on: () => !A.solid }), B('lbls', 'tag', T('Labels', 'ป้ายชื่อ'), { on: () => A.lblN !== false || A.lblM !== false }))]],
          [T('Select', 'การเลือก'), [COL(B('selm', 'cursor', T('Select', 'เลือก'), { m: 1, on: tool('select') }), B('unselm', 'unsel', T('Unselect', 'ยกเลิกการเลือก'), { m: 1 }), B('selprev', 'prevsel', T('Select Previous', 'เลือกชุดก่อนหน้า')))]],
          [T('Activities', 'การแสดงบางส่วน'), [B('active', 'eye', T('Active', 'แสดงเฉพาะ')), B('inactive', 'eyeoff', T('Inactive', 'ซ่อน')), B('actall', 'all', T('All', 'ทั้งหมด'), { on: () => !A.hidN.size && !A.hidM.size }), B('inverse', 'swap', T('Inverse Active', 'สลับการแสดง'))]],
          [T('Grids/Snap', 'กริด/สแนป'), [COL(B('grid', 'grid', T('Grids', 'กริด'), { on: () => A.grid !== false }), B('snapm', 'magnet', T('Snap', 'สแนป') + ' ' + (+o.snap > 0 ? fu(+o.snap, 'L', 2) : T('off', 'ปิด')), { m: 1 }))]],
          [T('Display', 'การแสดง'), [B('dispm', 'palette', T('Display', 'ตัวเลือกการแสดง'), { m: 1 })]]
        ]],
        ['struct', T('Structure', 'โครงสร้าง'), [
          [T('Sample', 'ตัวอย่าง'), [B('sample', 'sample', BRG ? T('Sample Bridge', 'สะพานตัวอย่าง') : T('Sample Building', 'อาคารตัวอย่าง'))]],
          [T('Quick Templates', 'แม่แบบด่วน'), BLD ? [B('qt', 'bldg', T('RC Building', 'อาคาร คสล.'), { v: 'rc' }), B('qt', 'shed', T('Steel Building', 'อาคารเหล็ก'), { v: 'steel' }), B('qt', 'column', T('RC Tower', 'อาคารสูง'), { v: 'tower' }), B('qt', 'grid', T('Grids Only', 'กริดอย่างเดียว'), { v: 'blank' })] : BRG ? [B('qt', 'beam', T('Girder Deck', 'สะพานคาน'), { v: 'girder' }), B('qt', 'column', T('Box Girder', 'คานกล่อง'), { v: 'box' }), B('qt', 'truss', T('Truss Bridge', 'สะพานโครงถัก'), { v: 'btruss' }), B('qt', 'portal', T('Tied Arch', 'สะพานโค้ง'), { v: 'arch' }), B('qt', 'shed', T('Cable-Stayed', 'สะพานขึงเคเบิล'), { v: 'cable' }), B('qt', 'blank', T('Empty Model', 'โมเดลว่าง'), { v: 'blank' })] : [B('qt', 'bldg', T('Building 3D', 'อาคาร 3 มิติ'), { v: 'building' }), B('qt', 'shed', T('Steel Shed', 'โรงงานเหล็ก'), { v: 'shed' }), B('qt', 'portal', T('Portal Frame', 'โครงข้อแข็ง'), { v: 'portal' }), B('qt', 'cbeam', T('Continuous Beam', 'คานต่อเนื่อง'), { v: 'beam' }), B('qt', 'truss', T('Truss', 'โครงถัก'), { v: 'truss' }), B('qt', 'blank', T('Empty Model', 'โมเดลว่าง'), { v: 'blank' })]],
          [T('Wizard', 'ตัวช่วยสร้าง'), [B('wizard', 'wand', T('Structure Wizard', 'สร้างจากแม่แบบ'))]],
          [T('Structure Type', 'ชนิดโครงสร้าง'), [B('type3d', 'cube', T('3D Frame', 'โครง 3 มิติ'), { on: () => A.model.plane !== 'XZ' }), B('type2d', 'plane', T('2D Frame (X–Z)', 'โครง 2 มิติ (X–Z)'), { on: () => A.model.plane === 'XZ' })]],
          [T('Design Standard', 'มาตรฐานการออกแบบ'), [...STDS.map(k => B('std', 'book', { AS: T('Australian (AS)', 'ออสเตรเลีย (AS)'), EC: T('Eurocodes (EN)', 'ยูโรโค้ด (EN)'), TH: T('Thai (EIT / TIS)', 'ไทย (วสท. / มอก.)') }[k] || k, { v: k, on: () => A.model.std === k })),
            COL(B('stdcombo', 'lcc', T('Standard Combinations', 'การรวมน้ำหนักตามมาตรฐาน')), B('stdinfo', 'list', T('Standard Details', 'รายละเอียดมาตรฐาน')))]],
          [T('Model', 'แบบจำลอง'), [B('save', 'save', T('Save', 'บันทึก')), B('open', 'open', T('Open', 'เปิด'), { file: 1 }), B('report', 'doc', T('Report', 'รายงาน'))]]
        ]],
        ...(BRG ? [bridgeTab()] : []),
        ...(BLD ? [bldTab()] : []),
        ['node', T('Node/Element', 'จุดต่อ/ชิ้นส่วน'), [
          [T('Nodes', 'จุดต่อ'), [B('cnode', 'node', T('Create Nodes', 'สร้างจุดต่อ'), { on: tool('node') }), B('ntrans', 'move', T('Translate', 'เลื่อน/คัดลอก')), B('ndiv', 'divide', T('Divide', 'แบ่ง')), B('nmerge', 'merge', T('Merge', 'รวมจุด')),
            COL(B('del', 'del', T('Delete', 'ลบ')), B('rot', 'rotate', T('Rotate', 'หมุน')), B('mir', 'mirror', T('Mirror', 'สะท้อน'))), COL(B('scl', 'scale', T('Scale', 'ปรับขนาด')), B('ext', 'extrude', T('Extrude', 'ยืดเป็นชิ้นส่วน'))), B('ntab', 'table', T('Nodes Table', 'ตารางจุดต่อ'))]],
          [T('Elements', 'ชิ้นส่วน'), [B('celem', 'elem', T('Create Elements', 'สร้างชิ้นส่วน'), { on: tool('member') }), B('etrans', 'move', T('Translate', 'เลื่อน/คัดลอก')), B('ediv', 'divide', T('Divide', 'แบ่ง')), B('emerge', 'merge', T('Merge', 'รวม')), B('eint', 'intersect', T('Intersect', 'ตัดกัน')),
            COL(B('del', 'del', T('Delete', 'ลบ')), B('rot', 'rotate', T('Rotate', 'หมุน')), B('mir', 'mirror', T('Mirror', 'สะท้อน'))), B('chg', 'params', T('Change Parameters', 'เปลี่ยนคุณสมบัติ')), B('etab', 'table', T('Elements Table', 'ตารางชิ้นส่วน'))]]
        ]],
        ['prop', T('Properties', 'คุณสมบัติ'), [
          [T('Material', 'วัสดุ'), [B('pmat', 'mat', T('Material Properties', 'คุณสมบัติวัสดุ')), B('pmatl', 'list', T('Material List', 'รายการวัสดุ'))]],
          [T('Section', 'หน้าตัด'), [B('psec', 'sec', T('Section Properties', 'คุณสมบัติหน้าตัด')), B('psecm', 'secm', T('Section Manager', 'จัดการหน้าตัด')), B('chg', 'params', T('Assign to Elements', 'กำหนดให้ชิ้นส่วน'))]],
          [T('Tables', 'ตาราง'), [B('ptabm', 'table', T('Property Tables', 'ตารางคุณสมบัติ'), { m: 1 })]]
        ]],
        ['bnd', T('Boundary', 'เงื่อนไขขอบเขต'), [
          [T('Supports', 'จุดรองรับ'), [B('bsup', 'support', T('Define Supports', 'กำหนดจุดรองรับ'))]],
          [T('Spring Supports', 'สปริง'), [B('bspr', 'spring', T('Point Spring', 'สปริงที่จุด'))]],
          [T('Release/Orientation', 'การปลดแรง/ทิศทาง'), [B('brel', 'release', T('Beam End Release', 'ปลดแรงปลายคาน')), B('bbeta', 'beta', T('Beta Angle', 'มุม β'))]],
          [T('Tables', 'ตาราง'), [B('btab', 'table', T('Boundary Tables', 'ตารางจุดรองรับ'))]]
        ]],
        ['load', T('Load', 'น้ำหนัก'), [
          [T('Load Type', 'ชนิดแรง'), [COL(B('ltype', null, T('Static Loads', 'แรงสถิต'), { v: 'static', radio: 1, on: () => !temp }), B('ltype', null, T('Temp. Loads', 'แรงจากอุณหภูมิ'), { v: 'temp', radio: 1, on: () => temp }))]],
          [T('Create Load Cases', 'กรณีน้ำหนัก'), [B('lcases', 'lc', T('Static Load Cases', 'กรณีน้ำหนัก')), B('lcombo', 'lcc', T('Load Combinations', 'การรวมน้ำหนัก'))]],
          temp ? [T('Temperature Loads', 'แรงจากอุณหภูมิ'), [B('ltemp', 'thermo', T('Element Temperature', 'อุณหภูมิชิ้นส่วน')), B('ltgrad', 'tgrad', T('Temperature Gradient', 'ผลต่างอุณหภูมิ'))]]
            : [T('Structure Loads', 'แรงบนโครงสร้าง'), [B('lsw', 'weight', T('Self Weight', 'น้ำหนักตัวเอง')), B('lnode', 'nload', T('Nodal Loads', 'แรงที่จุดต่อ'))]],
          ...(temp ? [] : [[T('Beam Load', 'แรงบนคาน'), [B('lbeam', 'udl', T('Element', 'แผ่กระจาย')), B('lpoint', 'pload', T('Point', 'แรงจุด')), B('lmom', 'moment', T('Moment', 'โมเมนต์'))]]]),
          [T('Display', 'การแสดง'), [B('lshowm', 'eye', A.loadsOn ? T('Loads: ', 'แรง: ') + (A.lcase === 'all' ? T('all', 'ทั้งหมด') : A.lcase) : T('Show Loads', 'แสดงแรง'), { m: 1, on: () => !!A.loadsOn })]],
          [T('Tables', 'ตาราง'), [B('ltab', 'table', T('Load Tables', 'ตารางแรง')), B('lsum', 'list', T('Load Summary', 'สรุปแรง'))]]
        ]],
        ['anl', T('Analysis', 'การวิเคราะห์'), [
          [T('Perform', 'ดำเนินการ'), [B('run', 'play', T('Perform Analysis', 'วิเคราะห์')), B('clear', 'clear', T('Clear Results', 'ล้างผล'))]],
          [T('Analysis Control', 'การควบคุมการวิเคราะห์'), [B('actl', 'gear', T('Main Control', 'ตั้งค่าหลัก')), COL(B('tpd', 'range', 'P-Delta', { on: () => !!o.pdelta }), B('tmode', 'mode', T('Modal', 'โหมด'), { on: () => !!o.modes }), B('tbuck', 'buckle', T('Buckling', 'การโก่งเดาะ'), { on: () => !!o.buckling }))]]
        ]],
        ['res', T('Results', 'ผลลัพธ์'), [
          [T('Combination', 'การรวม'), [B('lcombo', 'lcc', T('Load Combination', 'การรวมน้ำหนัก')), B('rsrcm', 'list', T('Result for', 'ผลของ') + (A.src ? ': ' + A.src.split(':')[1] : ''), { m: 1 })]],
          [T('Results', 'ผลลัพธ์'), [COL(B('rreact', 'react', T('Reactions', 'แรงปฏิกิริยา'), { on: () => A.step === 'res' && A.rview === 'react' }), B('rdef', 'deform', T('Deformations', 'การเสียรูป'), { on: () => A.step === 'res' && A.rview === 'def' }), B('rforce', 'forces', T('Forces', 'แรง'), { m: 1, on: () => A.step === 'res' && ['N', 'Vy', 'Vz', 'T'].includes(A.rview) })),
            COL(B('rmom', 'diagram', T('Moments', 'โมเมนต์'), { m: 1, on: () => A.step === 'res' && ['My', 'Mz'].includes(A.rview) }), B('rscale', 'scale', T('Diagram Scale', 'มาตราส่วน'), { m: 1 }), B('rvals', 'tag', T('Values', 'ค่าตัวเลข'), { on: () => !!A.labels }))]],
          [T('Detail', 'รายละเอียด'), [B('rdet', 'detail', T('Beam Detail', 'รายละเอียดคาน'))]],
          [T('Mode Shape', 'รูปโหมด'), [B('rmode', 'mode', T('Mode Shapes', 'รูปโหมด'), { on: () => A.step === 'res' && A.rview === 'mode' }), B('rbuck', 'buckle', T('Buckling Modes', 'โหมดการโก่งเดาะ'), { on: () => A.step === 'res' && A.rview === 'buck' })]],
          [T('Text', 'ข้อความ'), [B('report', 'doc', T('Text Output', 'รายงาน'))]],
          [T('Tables', 'ตาราง'), [B('rtabm', 'table', T('Results Tables', 'ตารางผลลัพธ์'), { m: 1 })]]
        ]],
        ['design', T('Design', 'ออกแบบ'), [
          [T('RC Design', 'ออกแบบ คสล.'), [B('dbeam', 'beam', T('RC Beam', 'คาน คสล.')), B('dcol', 'column', T('RC Column', 'เสา คสล.'))]],
          [T('Code', 'มาตรฐาน'), [B('stdm', 'book', T('Design Code', 'มาตรฐานการออกแบบ'), { m: 1 })]]
        ]],
        ['query', T('Query', 'สอบถาม'), [
          [T('Status', 'สถานะ'), [B('qstat', 'status', T('Project Status', 'สถานะโครงการ'))]],
          [T('Query', 'สอบถาม'), [B('qnode', 'qnode', T('Query Nodes', 'สอบถามจุดต่อ'), { on: tool('qnode') }), B('qelem', 'qelem', T('Query Elements', 'สอบถามชิ้นส่วน'), { on: tool('qelem') })]],
          [T('Detail Table', 'ตารางรายละเอียด'), [COL(B('qnt', 'table', T('Node Detail Table', 'ตารางจุดต่อ')), B('qet', 'table', T('Element Detail Table', 'ตารางชิ้นส่วน')), B('qwt', 'table', T('Element Weight Table', 'ตารางน้ำหนักชิ้นส่วน')))]],
          [T('Mass/Load Table', 'ตารางมวล/แรง'), [COL(B('qms', 'table', T('Mass Summary Table', 'สรุปมวล')), B('lsum', 'table', T('Load Summary Table', 'สรุปแรง')))]],
          [T('Quantities', 'ปริมาณ'), [B('qto', 'qto', T('Quantity Take-off', 'ถอดปริมาณวัสดุ'))]]
        ]],
        ['tools', T('Tools', 'เครื่องมือ'), [
          [T('Setting', 'ตั้งค่า'), [B('unitm', 'units', T('Unit System', 'ระบบหน่วย') + ' · ' + ulab('F') + ', ' + ulab('L'), { m: 1 })]],
          [T('Model File', 'ไฟล์แบบจำลอง'), [B('save', 'save', T('Save', 'บันทึก')), B('open', 'open', T('Open', 'เปิด'), { file: 1 }), B('sample', 'sample', BRG ? T('Sample Bridge', 'สะพานตัวอย่าง') : T('Sample Building', 'อาคารตัวอย่าง')), B('wizard', 'wand', T('Template', 'แม่แบบ'))]],
          [T('Quantities', 'ปริมาณ'), [B('qto', 'qto', T('Quantity Take-off', 'ถอดปริมาณวัสดุ'))]],
          [T('Help', 'วิธีใช้'), [B('help', 'help', T('Shortcuts & Help', 'ปุ่มลัดและวิธีใช้'))]]
        ]]
      ];
    }
    function rbtn(it, big) {
      const on = it.on ? it.on() : false, lab = esc(it.l) + (it.m ? ' <i class="an-rdd">▾</i>' : '');
      if (it.file) return `<label class="an-rb ${big ? 'big' : 'sm'}" title="${esc(it.l)}">${icon(it.i, big)}<span>${lab}</span><input type="file" accept=".json,application/json" id="an-file" hidden></label>`;
      if (it.radio) return `<button class="an-rb sm an-rradio" data-act="an-rb" data-c="${it.c}" data-v="${it.v}" aria-pressed="${on}"><i class="an-rdot"></i><span>${lab}</span></button>`;
      return `<button class="an-rb ${big ? 'big' : 'sm'} ${it.m ? 'dd' : ''}" data-act="an-rb" data-c="${it.c}" ${it.v ? `data-v="${esc(it.v)}"` : ''} ${it.m ? 'data-m="1" aria-haspopup="menu"' : ''} aria-pressed="${on}" title="${esc(it.l)}">${icon(it.i, big)}<span>${lab}</span></button>`;
    }
    function ribHTML() {
      const tabs = RIB(), cur = tabs.find(t => t[0] === A.rib) || tabs[0];
      const qat = [['undo', 'undo', T('Undo (Ctrl+Z)', 'เลิกทำ')], ['redo', 'redo', T('Redo (Ctrl+Y)', 'ทำซ้ำ')], ['save', 'save', T('Save', 'บันทึก')], ['run', 'play', T('Run analysis (Ctrl+Enter)', 'วิเคราะห์')], ['help', 'help', T('Help (?)', 'วิธีใช้')]];
      return `<div class="an-rib ${A.ribMin ? 'min' : ''}" id="anRib"><div class="an-ribtabs" role="tablist" aria-label="${T('Ribbon', 'ริบบอน')}">${tabs.map(t => `<button role="tab" class="an-rtab" data-act="an-ribtab" data-t="${t[0]}" aria-selected="${t[0] === cur[0]}">${t[1]}</button>`).join('')}<span class="grow"></span>
          <span class="an-qat">${qat.map(([c, i, l]) => `<button class="an-qb ${c === 'run' ? 'hot' : ''}" data-act="an-rb" data-c="${c}" title="${esc(l)}" aria-label="${esc(l)}" ${c === 'undo' && !A.hist.length || c === 'redo' && !A.fut.length ? 'disabled' : ''}>${icon(i)}</button>`).join('')}<button class="an-qb" data-act="an-ribmin" title="${A.ribMin ? T('Show the ribbon', 'แสดงริบบอน') : T('Collapse the ribbon', 'ย่อริบบอน')}" aria-label="${T('Collapse the ribbon', 'ย่อริบบอน')}">${A.ribMin ? '▾' : '▴'}</button></span></div>
        ${A.ribMin ? '' : `<div class="an-ribbar" role="toolbar">${cur[2].map(([title, items]) => `<div class="an-rg"><div class="an-rgi">${items.map(it => (it.col ? `<div class="an-rcol">${it.col.map(x => rbtn(x, false)).join('')}</div>` : rbtn(it, true))).join('')}</div><div class="an-rgt">${title}</div></div>`).join('')}</div>`}</div>`;
    }
    function ribRefresh() { const r = $('#anRib'); if (r) r.outerHTML = ribHTML(); const hb = $('#anHint'); if (hb) hb.textContent = hintBar(); }

    // ---- dropdown menus
    function MENU(id) {
      if (BRG) { const bm = bridgeMenu(id); if (bm) return bm; }
      if (BLD) { const bm = bldMenu(id); if (bm) return bm; }
      const it = (c, l, v, on) => ({ c, l, v, on }), sep = { sep: 1 };
      const VPS = [['3d', T('Isometric (default)', 'ไอโซเมตริก')], ['plan', T('Top (plan)', 'ด้านบน (แปลน)')], ['xz', T('Front (X–Z)', 'ด้านหน้า (X–Z)')], ['yz', T('Right (Y–Z)', 'ด้านขวา (Y–Z)')], ['back', T('Back', 'ด้านหลัง')], ['left', T('Left', 'ด้านซ้าย')], ['bottom', T('Bottom', 'ด้านล่าง')], ['ne', T('Isometric NE', 'ไอโซเมตริก NE')], ['nw', T('Isometric NW', 'ไอโซเมตริก NW')], ['sw', T('Isometric SW', 'ไอโซเมตริก SW')]];
      switch (id) {
        case 'zoomm': return [it('zfit', T('Zoom to fit (F)', 'ซูมพอดี (F)')), it('zin', T('Zoom in (+)', 'ซูมเข้า (+)')), it('zout', T('Zoom out (−)', 'ซูมออก (−)')), sep, it('zwin', T('Zoom window — drag a box', 'ซูมกรอบ — ลากกรอบ'), '', A.tool === 'zoomw')];
        case 'vpm': return VPS.map(([v, l]) => it('vp', l, v)).concat([sep, ...A.opt.views.map((q, i) => it('vrestore', '★ ' + q.n, String(i))), it('namedv', T('Named views…', 'มุมมองที่บันทึก…'))]);
        case 'selm': return [it('tsel', T('Select tool — click / drag box', 'เครื่องมือเลือก — คลิก / ลากกรอบ'), '', A.tool === 'select'), sep, ...[['all', T('All', 'ทั้งหมด')], ['nodes', T('All nodes', 'จุดต่อทั้งหมด')], ['elems', T('All elements', 'ชิ้นส่วนทั้งหมด')], ['col', T('Columns', 'เสา')], ['beam', T('Beams', 'คาน')], ['brace', T('Bracing', 'ค้ำยัน')], ['sup', T('Supported nodes', 'จุดรองรับ')], ['samesec', T('Same section as selected', 'หน้าตัดเดียวกับที่เลือก')], ['samemat', T('Same material as selected', 'วัสดุเดียวกับที่เลือก')], ['inv', T('Invert selection', 'กลับการเลือก')]].map(([v, l]) => it('sby', l, v)), sep, ...A.model.sections.map(s => it('sby', T('Section ', 'หน้าตัด ') + s.id, 'sec:' + s.id))];
        case 'unselm': return [it('sby', T('Unselect all (Esc)', 'ยกเลิกทั้งหมด (Esc)'), 'none'), it('unsn', T('Unselect nodes', 'ยกเลิกจุดต่อ')), it('unsm', T('Unselect elements', 'ยกเลิกชิ้นส่วน'))];
        case 'snapm': return [0, 0.05, 0.1, 0.25, 0.5, 1].map(v => it('snap', v ? fu(v, 'L', 3) + ul('L') : T('Off', 'ปิด'), String(v), Math.abs((+A.opt.snap || 0) - v) < 1e-9));
        case 'dispm': return [it('tog', T('Node numbers', 'หมายเลขจุดต่อ'), 'lblN', A.lblN !== false), it('tog', T('Element numbers', 'หมายเลขชิ้นส่วน'), 'lblM', A.lblM !== false), it('tog', T('Supports', 'จุดรองรับ'), 'showSup', A.showSup !== false), it('tog', T('Local axes of all elements', 'แกนเฉพาะที่ทุกชิ้นส่วน'), 'allAxes', !!A.allAxes), it('tog', T('Grid lines', 'เส้นกริด'), 'grid', A.grid !== false), it('tog', T('Loads', 'แรง'), 'loadsOn', !!A.loadsOn), it('tog', T('Solid sections (W)', 'หน้าตัดทรงตัน (W)'), 'solid', !!A.solid), it('tog', T('Result values', 'ค่าผลลัพธ์'), 'labels', !!A.labels), it('guides', T('Cursor guide lines', 'เส้นนำเคอร์เซอร์'), '', A.guides !== false)];
        case 'stdm': return STDS.map(k => it('std', T(stdInfo(k).name[0], stdInfo(k).name[1]), k, A.model.std === k));
        case 'ptabm': return [it('ptab', T('Material table', 'ตารางวัสดุ'), 'mat'), it('ptab', T('Section table', 'ตารางหน้าตัด'), 'sec')];
        case 'lshowm': return [it('lshow', T('Off', 'ปิด'), '', !A.loadsOn), ...A.model.cases.map(c => it('lshow', c.id + ' — ' + c.name, c.id, A.loadsOn && A.lcase === c.id)), it('lshow', T('All cases', 'ทุกกรณี'), 'all', A.loadsOn && A.lcase === 'all')];
        case 'rforce': return [['N', T('Axial force N', 'แรงตามแนวแกน N')], ['Vy', T('Shear V_y', 'แรงเฉือน V_y')], ['Vz', T('Shear V_z', 'แรงเฉือน V_z')], ['T', T('Torsion T', 'แรงบิด T')]].map(([v, l]) => it('rv', l, v, A.step === 'res' && A.rview === v));
        case 'rmom': return [['Mz', T('Moment M_z (major)', 'โมเมนต์ M_z (แกนหลัก)')], ['My', T('Moment M_y (minor)', 'โมเมนต์ M_y (แกนรอง)')]].map(([v, l]) => it('rv', l, v, A.step === 'res' && A.rview === v));
        case 'rscale': return [0.25, 0.5, 1, 1.5, 2, 3, 4].map(v => it('dscale', '× ' + v, String(v), Math.abs(A.dscale - v) < 1e-9));
        case 'rsrcm': return srcList().map(([v, l]) => it('src', l, v, A.src === v));
        case 'rtabm': return [['sum', T('Summary', 'สรุป')], ['react', T('Reactions', 'แรงปฏิกิริยา')], ['forces', T('Element forces', 'แรงในชิ้นส่วน')], ['disp', T('Displacements', 'การเคลื่อนตัว')], ['drift', T('Storey drift', 'การเคลื่อนตัวระหว่างชั้น')], ['modal', T('Modal', 'โหมด')], ['buck', T('Buckling', 'การโก่งเดาะ')]].map(([v, l]) => it('rtab', l, v));
        case 'unitm': return [['SI', 'kN · m · °C'], ['SImm', 'N · mm · °C'], ['MKS', 'tf · m · °C'], ['MKScm', 'kgf · cm · °C'], ['US', 'kip · ft · °F']].map(([v, l]) => it('units', l, v, ['F', 'L', 'T'].every(q => UPRE[v][q] === UU()[q])));
      }
      return [];
    }
    // Esc: close menus, stop drawing, leave temporary tools and cancel the whole selection
    function escAll() {
      const had = A.sel.n.length || A.sel.m.length;
      closeMenu(); A.draw = null; A.drawP = null; A.box = null; A.dnd = null;
      if (['pan', 'zoomw', 'qnode', 'qelem', 'orbit', 'node', 'member', 'bcol', 'bbeam', 'bslab'].includes(A.tool)) A.tool = 'select';
      if (had) { A.sel = { n: [], m: [] }; selChanged(); toast(T('Selection cancelled', 'ยกเลิกการเลือกแล้ว'), ''); }
      else if (A.win) { A.win = null; winRefresh(); }
      else if (A.tplOpen) { A.tplOpen = false; ctx.render(); return; }
      const cv = $('#anCv'); if (cv) cv.style.cursor = 'default';
      ribRefresh(); redraw();
    }
    const curFor = () => (A.tool === 'pan' ? 'move' : A.tool === 'zoomw' || A.tool === 'node' || A.tool === 'member' || isBTool(A.tool) ? 'crosshair' : A.tool === 'qnode' || A.tool === 'qelem' ? 'help' : 'default');
    // cursor guide lines (overlay canvas, so the model is not redrawn on every mouse move)
    function drawGuide(x, y) {
      const cv = $('#anCv'), gc = $('#anGuide'); if (!cv || !gc) return;
      const W = cv.clientWidth, H = cv.clientHeight, dpr = Math.min(2, G.devicePixelRatio || 1);
      Object.assign(gc.style, { left: cv.offsetLeft + 'px', top: cv.offsetTop + 'px', width: W + 'px', height: H + 'px' });
      if (gc.width !== Math.round(W * dpr) || gc.height !== Math.round(H * dpr)) { gc.width = Math.round(W * dpr); gc.height = Math.round(H * dpr); }
      const g = gc.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      if (x == null || A.guides === false) return;
      const pal = palette(); x = Math.round(x) + 0.5; y = Math.round(y) + 0.5;
      g.strokeStyle = pal.blue; g.globalAlpha = 0.55; g.lineWidth = 1; g.setLineDash([6, 4]);
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
      if (A.cam.v !== '3d') {
        const p = planePoint(x, y, W, H); if (!p) return;
        const ax = { plan: ['X', 0, 'Y', 1], xz: ['X', 0, 'Z', 2], yz: ['Y', 1, 'Z', 2] }[A.cam.v], lab = ax[0] + ' ' + fu(p[ax[1]], 'L', 2) + '   ' + ax[2] + ' ' + fu(p[ax[3]], 'L', 2) + ul('L');
        g.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace'; const tw = g.measureText(lab).width, lx = Math.min(x + 12, W - tw - 10), ly = y + 20 > H - 6 ? y - 10 : y + 20;
        g.fillStyle = pal.bg; g.globalAlpha = 0.9; g.fillRect(lx - 4, ly - 12, tw + 8, 16); g.globalAlpha = 1; g.fillStyle = pal.ink; g.fillText(lab, lx, ly);
      }
    }
    function quickModel(kind) {
      if (!TPL[kind]) return;
      try {
        const nm = build(kind, Object.assign({}, TPL[kind].p), A.model.std); snap(true); A.model = nm; A.tpl = kind; A.tplP = null; A.tplOpen = false; A.hidN = new Set(); A.hidM = new Set(); afterNewModel();
        toast(T(TPL[kind].n[0] + ' loaded — ' + nm.nodes.length + ' nodes, ' + nm.members.length + ' elements. Ctrl+Z to undo; Structure Wizard to change its size.', 'โหลด' + TPL[kind].n[1] + 'แล้ว — ' + nm.nodes.length + ' จุดต่อ ' + nm.members.length + ' ชิ้นส่วน กด Ctrl+Z เพื่อย้อนกลับ'), 'ok');
      } catch (e) { toast(e.message || String(e), 'bad'); }
    }
    function closeMenu() { if (!A.ribMenu) return; A.ribMenu = null; const h = $('#anRibMenu'); if (h) h.innerHTML = ''; }
    function openMenu(id, btn) {
      if (A.ribMenu === id) { closeMenu(); return; }
      const h = $('#anRibMenu'); if (!h) return; A.ribMenu = id;
      const r = btn.getBoundingClientRect(), items = MENU(id), left = Math.max(6, Math.min(r.left, innerWidth - 270));
      h.innerHTML = `<div class="an-rmenu" role="menu" style="left:${left}px;top:${r.bottom + 3}px;max-height:${Math.max(160, innerHeight - r.bottom - 20)}px">${items.length ? items.map(q => (q.sep ? '<hr>' : `<button role="menuitemcheckbox" aria-checked="${!!q.on}" data-act="an-rb" data-c="${q.c}" data-v="${esc(q.v == null ? '' : q.v)}" class="${q.on ? 'on' : ''}"><i>${q.on ? '✓' : ''}</i>${esc(q.l)}</button>`)).join('') : `<p class="muted small">${T('Nothing to show.', 'ไม่มีรายการ')}</p>`}</div>`;
    }

    // ---- view helpers
    const camSnap = () => ({ v: A.cam.v, yaw: A.cam.yaw, pitch: A.cam.pitch, k: A.cam.k, t: A.cam.t.slice() });
    function camPush(s) { const c = s || camSnap(), h = A.camHist, l = h[h.length - 1]; if (l && l.v === c.v && l.yaw === c.yaw && l.pitch === c.pitch && l.k === c.k && l.t.every((x, i) => x === c.t[i])) return; h.push(c); if (h.length > 40) h.shift(); }
    function camApply(c) { const v0 = A.cam.v; Object.assign(A.cam, c, { t: c.t.slice() }); if (v0 !== c.v) { A.cut = 'all'; ctx.render(); } else { redraw(); ribRefresh(); } }
    function camPrev() { const c = A.camHist.pop(); if (!c) { toast(T('No previous view.', 'ไม่มีมุมมองก่อนหน้า'), ''); return; } camApply(c); }
    function viewPoint(v) {
      camPush();
      const VP = { back: [PI / 2, 0], left: [PI, 0], bottom: [-PI / 2 - 0.72, -0.42], ne: [-PI / 2 + 0.72 + PI / 2, 0.42], nw: [PI / 2 + 0.72, 0.42], sw: [PI + 0.72 + PI / 2, 0.42] };
      if (VIEWS[v]) setView(v); else { const q = VP[v] || VIEWS['3d']; Object.assign(A.cam, { v: '3d', yaw: q[0], pitch: q[1], k: null }); A.cut = 'all'; }
      ctx.render();
    }
    function setTool(t) {
      A.tool = t; A.draw = null; A.box = null;
      const cv = $('#anCv'); if (cv) cv.style.cursor = curFor();
      if ((t === 'node' || t === 'member') && A.cam.v === '3d') toast(T('Tip: in Plan or an Elevation you can click empty grid points to create nodes.', 'เคล็ดลับ: ในแปลนหรือรูปด้าน คลิกตำแหน่งว่างเพื่อสร้างจุดต่อ'), '');
      if (t === 'qnode' || t === 'qelem') toast(T('Click a ' + (t === 'qnode' ? 'node' : 'element') + ' in the view to see its data.', 'คลิก' + (t === 'qnode' ? 'จุดต่อ' : 'ชิ้นส่วน') + 'ในมุมมองเพื่อดูข้อมูล'), '');
      ribRefresh(); sideRefresh(); redraw();
    }
    function zoomStep(s) { const cv = $('#anCv'); if (!cv) return; camPush(); zoomAt(cv.clientWidth / 2, cv.clientHeight / 2, s); }
    function zoomBox(b) {
      const cv = $('#anCv'); if (!cv) return; const W = cv.clientWidth, H = cv.clientHeight, bw = Math.abs(b[2] - b[0]), bh = Math.abs(b[3] - b[1]); if (bw < 6 || bh < 6) return;
      camPush(); const wp = screenToWorld((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, W, H); A.cam.k = Math.max(0.5, Math.min(5000, A.cam.k * Math.min(W / bw, H / bh) * 0.95)); A.cam.t = wp; redraw();
    }
    // ---- activities (show only part of the model)
    function setActive(how) {
      const m = A.model;
      if (how === 'all') { A.hidN = new Set(); A.hidM = new Set(); }
      else if (how === 'inverse') {
        if (!A.hidN.size && !A.hidM.size) { toast(T('Everything is active.', 'ทุกส่วนแสดงอยู่แล้ว'), ''); return; }
        const actM = new Set(m.members.filter(q => A.hidM.has(q.id) || A.hidN.has(q.i) || A.hidN.has(q.j)).map(q => q.id)), actN = new Set();
        m.members.forEach(q => { if (actM.has(q.id)) { actN.add(q.i); actN.add(q.j); } });
        A.hidN.forEach(id => { if (!m.members.some(q => q.i === id || q.j === id)) actN.add(id); });
        A.hidM = new Set(m.members.filter(q => !actM.has(q.id)).map(q => q.id)); A.hidN = new Set(m.nodes.filter(n => !actN.has(n.id)).map(n => n.id));
      } else {
        if (!A.sel.n.length && !A.sel.m.length) { toast(T('Select nodes or elements first.', 'เลือกจุดต่อหรือชิ้นส่วนก่อน'), 'bad'); return; }
        const sn = new Set(A.sel.n), sm = new Set(A.sel.m), used = new Set(sn);
        m.members.forEach(q => { if (sn.has(q.i) && sn.has(q.j)) sm.add(q.id); });
        m.members.forEach(q => { if (sm.has(q.id)) { used.add(q.i); used.add(q.j); } });
        if (how === 'active') { A.hidM = new Set(m.members.filter(q => !sm.has(q.id)).map(q => q.id)); A.hidN = new Set(m.nodes.filter(n => !used.has(n.id)).map(n => n.id)); }
        else { sm.forEach(id => A.hidM.add(id)); sn.forEach(id => A.hidN.add(id)); const vis = new Set(); m.members.forEach(q => { if (!A.hidM.has(q.id) && !A.hidN.has(q.i) && !A.hidN.has(q.j)) { vis.add(q.i); vis.add(q.j); } }); used.forEach(id => { if (!vis.has(id)) A.hidN.add(id); }); }
      }
      A.sel = { n: [], m: [] }; A.cam.k = null; selChanged(); ribRefresh();
      if (A.hidM.size || A.hidN.size) toast(T('Showing ', 'แสดง ') + (m.members.length - A.hidM.size) + T(' of ' + m.members.length + ' elements', ' จาก ' + m.members.length + ' ชิ้นส่วน'), '');
    }

    // ---- geometry operations on the selection
    function selNodeIds() { const m = A.model, s = new Set(A.sel.n); A.sel.m.forEach(id => { const q = m.members.find(z => z.id === id); if (q) { s.add(q.i); s.add(q.j); } }); return s; }
    function selCentre() { const nd = nodeMap(), ids = [...selNodeIds()].filter(id => nd[id]); if (!ids.length) return [0, 0, 0]; const c = ids.reduce((s, id) => addv(s, P3(nd[id]), 1 / ids.length), [0, 0, 0]); return c.map(v => Number(v.toFixed(4))); }
    function needSel(nodesOk) { if (A.sel.m.length || (nodesOk && A.sel.n.length)) return true; toast(nodesOk ? T('Select nodes or elements first.', 'เลือกจุดต่อหรือชิ้นส่วนก่อน') : T('Select elements first.', 'เลือกชิ้นส่วนก่อน'), 'bad'); return false; }
    const rotFn = (ax, deg, c0) => (p, c) => { const t = deg * c * PI / 180, cs = Math.cos(t), sn = Math.sin(t), q = sub(p, c0); const r = ax === 'z' ? [q[0] * cs - q[1] * sn, q[0] * sn + q[1] * cs, q[2]] : ax === 'x' ? [q[0], q[1] * cs - q[2] * sn, q[1] * sn + q[2] * cs] : [q[0] * cs + q[2] * sn, q[1], -q[0] * sn + q[2] * cs]; return addv(c0, r, 1); };
    const mirFn = (ax, v) => p => { const q = p.slice(), i = { x: 0, y: 1, z: 2 }[ax]; q[i] = 2 * v - q[i]; return q; };
    const sclFn = (s, c0) => (p, c) => addv(c0, sub(p, c0), Math.pow(s, c));
    function moveNodes(fn) {
      const ids = selNodeIds(); if (!ids.size) return false;
      snap(true); const nd = nodeMap(); ids.forEach(id => { const n = nd[id]; if (!n) return; const p = fn(P3(n), 1); n.x = r4(p[0]); n.y = r4(p[1]); n.z = r4(p[2]); });
      changed(true); redraw(true); toast(T(ids.size + ' node(s) moved', 'ย้าย ' + ids.size + ' จุดต่อ'), 'ok'); return true;
    }
    function mergeNodes(scope, tol) {
      const m = A.model, ids = scope === 'sel' ? selNodeIds() : new Set(m.nodes.map(n => n.id)); tol = Math.max(1e-6, +tol || 1e-3);
      const list = m.nodes.filter(n => ids.has(n.id)), keep = {}, map = {};
      list.forEach(n => { const k = [n.x, n.y, n.z].map(v => Math.round((+v || 0) / tol)).join(','); const a = keep[k]; if (!a) { keep[k] = n; return; } const sup = F.fixOf(n).some(Boolean) && !F.fixOf(a).some(Boolean); if (sup) { map[a.id] = n.id; keep[k] = n; } else map[n.id] = a.id; });
      Object.keys(map).forEach(k => { let t = map[k]; while (map[t]) t = map[t]; map[k] = t; });
      const n0 = Object.keys(map).length; if (!n0) { toast(T('No coincident nodes found.', 'ไม่พบจุดต่อที่ซ้อนกัน'), ''); return; }
      snap(true);
      m.members.forEach(q => { if (map[q.i]) q.i = map[q.i]; if (map[q.j]) q.j = map[q.j]; });
      m.loads.forEach(l => { if (l.node && map[l.node]) l.node = map[l.node]; });
      const seen = new Set(), dropM = new Set();
      m.members.forEach(q => { const k = [q.i, q.j].sort().join('|'); if (q.i === q.j || seen.has(k)) dropM.add(q.id); else seen.add(k); });
      m.members = m.members.filter(q => !dropM.has(q.id)); m.loads = m.loads.filter(l => l.kind === 'node' || !dropM.has(l.member));
      m.nodes = m.nodes.filter(n => !map[n.id]);
      A.sel = { n: [], m: [] }; changed(true);
      toast(T(n0 + ' node(s) merged' + (dropM.size ? ', ' + dropM.size + ' duplicate element(s) removed' : ''), 'รวม ' + n0 + ' จุดต่อ' + (dropM.size ? ' ลบชิ้นส่วนซ้ำ ' + dropM.size : '')), 'ok');
    }
    function divideNodes(n) {
      if (A.sel.n.length !== 2) { toast(T('Select exactly two nodes.', 'เลือกจุดต่อ 2 จุด'), 'bad'); return; }
      const nd = nodeMap(), a = P3(nd[A.sel.n[0]]), b = P3(nd[A.sel.n[1]]); n = Math.max(2, Math.min(100, n | 0)); snap(true);
      const ids = []; for (let k = 1; k < n; k++) ids.push(ensureNode(a.map((v, i) => v + (b[i] - v) * k / n)));
      A.sel = { n: ids, m: [] }; changed(true); toast(T(ids.length + ' node(s) created between them', 'สร้างจุดต่อ ' + ids.length + ' จุดระหว่างกัน'), 'ok');
    }
    function splitAt(id, fr) { // split an element at fractions 0 < t < 1 (sorted, unique)
      const m = A.model, q = m.members.find(z => z.id === id); if (!q) return [id];
      const ts = [...new Set(fr.filter(t => t > 1e-6 && t < 1 - 1e-6).map(t => Math.round(t * 1e9) / 1e9))].sort((x, y) => x - y); if (!ts.length) return [id];
      const nd = nodeMap(), a = P3(nd[q.i]), b = P3(nd[q.j]), L = Math.hypot(...sub(b, a)), cut = [0, ...ts, 1];
      const ids = [q.i, ...ts.map(t => ensureNode(a.map((v, i) => v + (b[i] - v) * t))), q.j], n = cut.length - 1;
      const segs = [], loads = m.loads.filter(l => l.member === id); m.loads = m.loads.filter(l => l.member !== id);
      const idx = m.members.indexOf(q); m.members.splice(idx, 1);
      for (let k = 0; k < n; k++) {
        const s0 = L * cut[k], s1 = L * cut[k + 1], nid = k === 0 ? q.id : nextId(m.members, q.id + '_'), nm = Object.assign({}, q, { id: nid, i: ids[k], j: ids[k + 1], relI: k === 0 ? q.relI : false, relJ: k === n - 1 ? q.relJ : false });
        m.members.splice(idx + k, 0, nm); segs.push(nid);
        loads.forEach(l => {
          if (l.kind === 'temp') { m.loads.push(Object.assign({}, l, { member: nid })); return; }
          if (l.kind === 'udl') {
            const a0 = +l.a || 0, b0 = l.b === '' || l.b == null || +l.b <= 0 ? L : +l.b, w1 = +l.w1 || 0, w2 = l.w2 === '' || l.w2 == null ? w1 : +l.w2, lo = Math.max(a0, s0), hi = Math.min(b0, s1); if (hi - lo < 1e-6) return;
            const w = s => w1 + (w2 - w1) * (s - a0) / ((b0 - a0) || 1), full = Math.abs(lo - s0) < 1e-6 && Math.abs(hi - s1) < 1e-6;
            m.loads.push(Object.assign({}, l, { member: nid, w1: r4(w(lo)), w2: w1 === w2 ? '' : r4(w(hi)), a: full ? '' : r4(lo - s0), b: full ? '' : r4(hi - s0) }));
          } else { const p = +l.a || 0; if (p >= s0 - 1e-9 && (p < s1 - 1e-9 || (k === n - 1 && p <= s1 + 1e-9))) m.loads.push(Object.assign({}, l, { member: nid, a: r4(p - s0) })); }
        });
      }
      return segs;
    }
    function divideElems(n) {
      if (!needSel(false)) return; n = Math.max(2, Math.min(50, n | 0)); snap(true); const out = [];
      A.sel.m.slice().forEach(id => { out.push(...splitAt(id, Array.from({ length: n - 1 }, (_, k) => (k + 1) / n))); });
      A.sel = { n: [], m: out }; changed(true); toast(T('Divided into ' + out.length + ' elements', 'แบ่งเป็น ' + out.length + ' ชิ้นส่วน'), 'ok');
    }
    function intersectElems() {
      const m = A.model, nd = nodeMap(), ids = A.sel.m.length ? A.sel.m.slice() : m.members.map(q => q.id), set = new Set(ids), segs = m.members.filter(q => set.has(q.id) && nd[q.i] && nd[q.j]);
      const ext = Math.max(1, extent()), tol = 1e-6 * ext + 1e-5, cuts = {};
      const add = (id, t) => { (cuts[id] = cuts[id] || []).push(t); };
      for (let x = 0; x < segs.length; x++) for (let y = x + 1; y < segs.length; y++) {
        const p = segs[x], q = segs[y], a = P3(nd[p.i]), b = P3(nd[p.j]), c = P3(nd[q.i]), d = P3(nd[q.j]), u = sub(b, a), v = sub(d, c), w = sub(a, c);
        const A2 = dot(u, u), B2 = dot(u, v), C2 = dot(v, v), D2 = dot(u, w), E2 = dot(v, w), den = A2 * C2 - B2 * B2; if (den < 1e-12 * A2 * C2) continue; // parallel
        const s = (B2 * E2 - C2 * D2) / den, t = (A2 * E2 - B2 * D2) / den; if (s < -1e-9 || s > 1 + 1e-9 || t < -1e-9 || t > 1 + 1e-9) continue;
        const pp = addv(a, u, s), qq = addv(c, v, t); if (Math.hypot(...sub(pp, qq)) > tol) continue;
        add(p.id, s); add(q.id, t);
      }
      // existing nodes lying on an element
      m.nodes.forEach(n => { const P0 = P3(n); segs.forEach(q => { if (n.id === q.i || n.id === q.j) return; const a = P3(nd[q.i]), u = sub(P3(nd[q.j]), a), L2 = dot(u, u), t = dot(sub(P0, a), u) / L2; if (t <= 1e-6 || t >= 1 - 1e-6) return; if (Math.hypot(...sub(addv(a, u, t), P0)) < tol) add(q.id, t); }); });
      const ks = Object.keys(cuts).filter(id => cuts[id].some(t => t > 1e-6 && t < 1 - 1e-6)); if (!ks.length) { toast(T('No intersections found.', 'ไม่พบจุดตัด'), ''); return; }
      snap(true); const out = []; ks.forEach(id => out.push(...splitAt(id, cuts[id]))); A.sel = { n: [], m: out }; changed(true);
      toast(T(ks.length + ' element(s) split at intersections', 'แบ่ง ' + ks.length + ' ชิ้นส่วนที่จุดตัด'), 'ok');
    }
    function mergeElems() {
      if (A.sel.m.length < 2) { toast(T('Select two or more connected, collinear elements.', 'เลือกชิ้นส่วนที่ต่อกันและอยู่แนวเดียวกันอย่างน้อย 2 ชิ้น'), 'bad'); return; }
      const m = A.model; let nm = 0; const sel = new Set(A.sel.m); snap(true);
      for (let guard = 0; guard < 500; guard++) {
        const nd = nodeMap(); let done = false;
        for (const n of m.nodes) {
          const at = m.members.filter(q => q.i === n.id || q.j === n.id); if (at.length !== 2 || !at.every(q => sel.has(q.id))) continue;
          if (F.fixOf(n).some(Boolean) || m.loads.some(l => l.node === n.id)) continue;
          const [p, q] = at; if (p.sec !== q.sec || p.mat !== q.mat || (p.type || 'frame') !== (q.type || 'frame') || (+p.beta || 0) !== (+q.beta || 0)) continue;
          const far = (r, x) => (r.i === x ? r.j : r.i), A0 = far(p, n.id), B0 = far(q, n.id), u = sub(P3(nd[n.id]), P3(nd[A0])), v = sub(P3(nd[B0]), P3(nd[n.id]));
          const revP = p.i !== A0, revQ = q.i !== n.id; if ((revP || revQ) && (+p.beta || 0)) continue;
          if (Math.hypot(...cross(u, v)) > 1e-6 * Math.hypot(...u) * Math.hypot(...v) || dot(u, v) <= 0) continue;
          if ((p.i === n.id ? p.relI : p.relJ) || (q.i === n.id ? q.relI : q.relJ)) continue;
          const relA = p.i === A0 ? p.relI : p.relJ, relB = q.i === B0 ? q.relI : q.relJ;
          // carry the element loads over to the merged element (positions measured from its new end i)
          const Lp = Math.hypot(...u), Lq = Math.hypot(...v), moved = [];
          [[p, revP, 0, Lp], [q, revQ, Lp, Lq]].forEach(([r, rev, off, L]) => m.loads.filter(l => l.member === r.id).forEach(l => {
            const o2 = Object.assign({}, l, { member: p.id }), flip = rev && ['lx', 'lz'].includes(l.dir || (l.kind === 'moment' ? 'lz' : 'grav'));
            if (l.kind === 'temp') { if (rev) o2.dTz = -(+l.dTz || 0); }
            else if (l.kind === 'udl') { const a0 = +l.a || 0, b0 = l.b === '' || l.b == null || +l.b <= 0 ? L : +l.b, w1 = +l.w1 || 0, w2 = l.w2 === '' || l.w2 == null ? w1 : +l.w2, sg = flip ? -1 : 1;
              Object.assign(o2, rev ? { a: r4(off + L - b0), b: r4(off + L - a0), w1: sg * w2, w2: w1 === w2 ? '' : sg * w1 } : { a: r4(off + a0), b: r4(off + b0), w1: sg * w1, w2: l.w2 === '' || l.w2 == null ? '' : sg * w2 }); }
            else { const a0 = +l.a || 0; o2.a = r4(off + (rev ? L - a0 : a0)); if (flip) { if (l.kind === 'point') o2.P = -(+l.P || 0); else o2.M = -(+l.M || 0); } }
            moved.push([l, o2]);
          }));
          moved.forEach(([l, o2]) => { const ix = m.loads.indexOf(l); if (ix >= 0) m.loads[ix] = o2; });
          Object.assign(p, { i: A0, j: B0, relI: !!relA, relJ: !!relB }); m.members = m.members.filter(r => r !== q); m.nodes = m.nodes.filter(r => r.id !== n.id); sel.delete(q.id); nm++; done = true; break;
        }
        if (!done) break;
      }
      if (!nm) { A.hist.pop(); toast(T('Nothing merged — elements must be collinear, share a node with no support, nodal load or other element, and have the same properties.', 'ไม่สามารถรวม — ชิ้นส่วนต้องอยู่แนวเดียวกัน ใช้จุดต่อร่วมที่ไม่มีจุดรองรับ แรงที่จุด หรือชิ้นส่วนอื่น และมีคุณสมบัติเหมือนกัน'), 'bad'); return; }
      A.sel = { n: [], m: [...sel] }; changed(true); toast(T(nm + ' joint(s) removed — elements merged', 'รวมชิ้นส่วนแล้ว ' + nm + ' จุด'), 'ok');
    }
    // ---- load / weight summaries
    function memGeom(q) { const nd = nodeMap(), a = nd[q.i], b = nd[q.j]; if (!a || !b) return null; const pa = P3(a), pb = P3(b); return { pa, pb, L: Math.hypot(...sub(pb, pa)), ax: F.axes(pa, pb, q.beta) }; }
    function memWeight(q) { const m = A.model, s = m.sections.find(z => z.id === q.sec), t = m.materials.find(z => z.id === q.mat), g = memGeom(q); if (!s || !t || !g) return null; const Am = F.secProps(s).A * 1e-6; return { L: g.L, A: Am, gam: +t.rho || 0, W: Am * (+t.rho || 0) * g.L }; }
    function caseSum(cid) {
      const m = A.model, R = [0, 0, 0], cs = m.cases.find(c => c.id === cid) || {}, byId = new Map(m.members.map(q => [q.id, q])); let sw = 0, nT = 0;
      m.loads.filter(l => l.case === cid).forEach(l => {
        if (l.kind === 'node') { R[0] += +l.Fx || 0; R[1] += +l.Fy || 0; R[2] += +l.Fz || 0; return; }
        if (l.kind === 'temp') { nT++; return; } if (l.kind === 'moment') return;
        const q = byId.get(l.member), g = q && memGeom(q); if (!g) return;
        const dir = l.dir || 'grav', e = dir === 'lx' ? g.ax.ex : dir === 'ly' ? g.ax.ey : dir === 'lz' ? g.ax.ez : ({ gx: [1, 0, 0], gy: [0, 1, 0], gz: [0, 0, 1] })[dir] || [0, 0, -1];
        let P; if (l.kind === 'udl') { const a0 = Math.max(0, +l.a || 0), b0 = l.b === '' || l.b == null || +l.b <= 0 ? g.L : Math.min(g.L, +l.b), w1 = +l.w1 || 0, w2 = l.w2 === '' || l.w2 == null ? w1 : +l.w2; P = (w1 + w2) / 2 * Math.max(0, b0 - a0) * (dir === 'gravp' ? Math.hypot(g.ax.ex[0], g.ax.ex[1]) : 1); } else P = +l.P || 0;
        for (let k = 0; k < 3; k++) R[k] += P * e[k];
      });
      if (cs.sw) m.members.forEach(q => { const w = memWeight(q); if (w) { sw += w.W; R[2] -= w.W; } });
      return { R, sw, nT, n: m.loads.filter(l => l.case === cid).length };
    }

    // ---- extra windows (registered with the movable window system)
    const tblw = (head, rows, cls) => `<div class="an-wtbl ${cls || ''}"><table class="an-t"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
    const wfoot = (lbl, extra) => `<div class="an-wfoot">${extra || ''}<span class="grow"></span><button class="btn btn-ghost sm" data-act="an-wclose">${T('Close', 'ปิด')}</button>${lbl ? `<button class="btn btn-hot sm" data-act="an-wadd">${lbl}</button>` : ''}</div>`;
    const wck = (k, lbl, v) => `<label class="chkl"><input type="checkbox" data-w="${k}" ${v ? 'checked' : ''}> ${lbl}</label>`;
    const selInfo = () => `<p class="an-wsel">${A.sel.n.length || A.sel.m.length ? T('Selection: ', 'ที่เลือก: ') + (A.sel.n.length ? A.sel.n.length + T(' node(s) ', ' จุดต่อ ') : '') + (A.sel.m.length ? A.sel.m.length + T(' element(s)', ' ชิ้นส่วน') : '') : T('Nothing selected — select in the view first (the window stays open).', 'ยังไม่ได้เลือก — เลือกในมุมมองก่อน (หน้าต่างยังเปิดอยู่)')}</p>`;
    const modeSel = v => ws('mode', T('Mode', 'โหมด'), [['move', T('Move', 'ย้าย')], ['copy', T('Copy', 'คัดลอก')]], v.mode);
    const xyz = (v, p, lbl) => `<div class="an-row3">${['x', 'y', 'z'].map(a => wf(p + a, (lbl || '') + a.toUpperCase() + ul('L'), v[p + a], 'n')).join('')}</div>`;
    const cen = () => { const c = selCentre(); return { cx: uv(c[0], 'L'), cy: uv(c[1], 'L'), cz: uv(c[2], 'L') }; };
    const RW = {
      tr: { t: () => T('Translate nodes / elements', 'เลื่อน / คัดลอก'), def: () => ({ mode: 'copy', dx: 0, dy: 0, dz: uv(3.5, 'L'), n: 1, con: false, lds: true }), live: ['mode'],
        body: v => selInfo() + `<div class="an-row2">${modeSel(v)}${v.mode === 'copy' ? wf('n', T('Number of copies', 'จำนวนสำเนา'), v.n, 'n') : '<span></span>'}</div>` + xyz(v, 'd', 'Δ') + (v.mode === 'copy' ? wck('con', T('Connect each node to its copy (extrude — e.g. columns)', 'เชื่อมจุดต่อกับสำเนา (ยืด — เช่น เสา)'), v.con) + wck('lds', T('Copy loads too', 'คัดลอกแรงด้วย'), v.lds) : '') + wfoot(T('Apply', 'ดำเนินการ')),
        add: v => { if (!needSel(true)) return; const d = ['dx', 'dy', 'dz'].map(k => frU(+v[k] || 0, 'L')); if (!d.some(Boolean)) { toast(T('Enter a distance.', 'ใส่ระยะ'), 'bad'); return; } if (v.mode === 'move') moveNodes(p => addv(p, d, 1)); else { replicate(d, Math.max(1, Math.min(50, +v.n | 0)), !!v.con, !!v.lds); redraw(true); } } },
      ext: { t: () => T('Extrude nodes into elements', 'ยืดจุดต่อเป็นชิ้นส่วน'), def: () => ({ dx: 0, dy: 0, dz: uv(3.5, 'L'), n: 1 }),
        body: v => selInfo() + hint(T('Each selected node is copied by the distance and joined to its copy with a new element (section and material of the Elements step).', 'คัดลอกจุดต่อที่เลือกตามระยะ และเชื่อมกับสำเนาด้วยชิ้นส่วนใหม่ (หน้าตัดและวัสดุตามขั้นชิ้นส่วน)')) + xyz(v, 'd', 'Δ') + wf('n', T('Number of times', 'จำนวนครั้ง'), v.n, 'n') + wfoot(T('Extrude', 'ยืด')),
        add: v => { if (!A.sel.n.length) { toast(T('Select nodes first.', 'เลือกจุดต่อก่อน'), 'bad'); return; } const d = ['dx', 'dy', 'dz'].map(k => frU(+v[k] || 0, 'L')); if (!d.some(Boolean)) { toast(T('Enter a distance.', 'ใส่ระยะ'), 'bad'); return; } const keep = A.sel.m; A.sel.m = []; replicate(d, Math.max(1, Math.min(50, +v.n | 0)), true, false); if (!A.sel.m.length) A.sel.m = keep; redraw(true); } },
      rot: { t: () => T('Rotate nodes / elements', 'หมุน'), def: () => Object.assign({ mode: 'move', ax: 'z', ang: 90, n: 1, con: false, lds: true }, cen()), live: ['mode'],
        body: v => selInfo() + `<div class="an-row3">${modeSel(v)}${ws('ax', T('About axis', 'รอบแกน'), [['z', 'Z'], ['x', 'X'], ['y', 'Y']], v.ax)}${wf('ang', T('Angle (°)', 'มุม (°)'), v.ang, 'n')}</div>` + xyz(v, 'c', T('Centre ', 'จุดหมุน ')) + `<div class="an-adds"><button class="btn btn-ghost xs" data-act="an-rb" data-c="wcen">${T('Use centre of selection', 'ใช้จุดกึ่งกลางของที่เลือก')}</button></div>` + (v.mode === 'copy' ? wf('n', T('Number of copies', 'จำนวนสำเนา'), v.n, 'n') + wck('con', T('Connect nodes to their copies', 'เชื่อมจุดต่อกับสำเนา'), v.con) + wck('lds', T('Copy loads too', 'คัดลอกแรงด้วย'), v.lds) : '') + wfoot(T('Apply', 'ดำเนินการ')),
        add: v => { if (!needSel(true)) return; const fn = rotFn(v.ax, +v.ang || 0, ['cx', 'cy', 'cz'].map(k => frU(+v[k] || 0, 'L'))); if (!(+v.ang)) { toast(T('Enter an angle.', 'ใส่มุม'), 'bad'); return; } if (v.mode === 'move') moveNodes(fn); else { replicate([0, 0, 0], Math.max(1, Math.min(50, +v.n | 0)), !!v.con, !!v.lds, fn); redraw(true); } } },
      mir: { t: () => T('Mirror nodes / elements', 'สะท้อน'), def: () => { const c = cen(); return { mode: 'copy', ax: 'x', at: c.cx, lds: true }; }, live: ['mode', 'ax'],
        body: v => selInfo() + `<div class="an-row3">${modeSel(v)}${ws('ax', T('Mirror plane', 'ระนาบสะท้อน'), [['x', 'X = …  (Y–Z plane)'], ['y', 'Y = …  (X–Z plane)'], ['z', 'Z = …  (X–Y plane)']], v.ax)}${wf('at', v.ax.toUpperCase() + ul('L'), v.at, 'n')}</div>` + (v.mode === 'copy' ? wck('lds', T('Copy loads too', 'คัดลอกแรงด้วย'), v.lds) : '') + wfoot(T('Apply', 'ดำเนินการ')),
        add: v => { if (!needSel(true)) return; const fn = mirFn(v.ax, frU(+v.at || 0, 'L')); if (v.mode === 'move') moveNodes(fn); else { replicate([0, 0, 0], 1, false, !!v.lds, fn); redraw(true); } } },
      scl: { t: () => T('Scale node coordinates', 'ปรับขนาดพิกัด'), def: () => Object.assign({ s: 1.5 }, cen()),
        body: v => selInfo() + wf('s', T('Scale factor', 'ตัวคูณขนาด'), v.s, 'n') + xyz(v, 'c', T('About ', 'อ้างอิง ')) + `<div class="an-adds"><button class="btn btn-ghost xs" data-act="an-rb" data-c="wcen">${T('Use centre of selection', 'ใช้จุดกึ่งกลางของที่เลือก')}</button></div>` + wfoot(T('Scale', 'ปรับขนาด')),
        add: v => { if (!needSel(true)) return; const s = +v.s; if (!(s > 0)) { toast(T('The factor must be positive.', 'ตัวคูณต้องเป็นบวก'), 'bad'); return; } moveNodes(sclFn(s, ['cx', 'cy', 'cz'].map(k => frU(+v[k] || 0, 'L')))); } },
      ndiv: { t: () => T('Divide between two nodes', 'แบ่งระหว่างจุดต่อ'), def: () => ({ n: 4 }),
        body: v => selInfo() + hint(T('Creates equally spaced nodes between the two selected nodes.', 'สร้างจุดต่อระยะเท่ากันระหว่างจุดต่อ 2 จุดที่เลือก')) + wf('n', T('Number of divisions', 'จำนวนช่วง'), v.n, 'n') + wfoot(T('Divide', 'แบ่ง')), add: v => divideNodes(+v.n) },
      ediv: { t: () => T('Divide elements', 'แบ่งชิ้นส่วน'), def: () => ({ n: 2 }),
        body: v => selInfo() + hint(T('Each selected element is split into equal parts; element loads are carried over.', 'แบ่งชิ้นส่วนที่เลือกเป็นส่วนเท่า ๆ กัน แรงบนชิ้นส่วนถูกย้ายไปด้วย')) + wf('n', T('Number of parts', 'จำนวนส่วน'), v.n, 'n') + wfoot(T('Divide', 'แบ่ง')), add: v => divideElems(+v.n) },
      nmrg: { t: () => T('Merge coincident nodes', 'รวมจุดต่อที่ซ้อนกัน'), def: () => ({ scope: 'all', tol: uv(0.001, 'L') }),
        body: v => `<div class="an-row2">${ws('scope', T('Nodes', 'จุดต่อ'), [['all', T('All nodes', 'ทั้งหมด')], ['sel', T('Selected only', 'เฉพาะที่เลือก')]], v.scope)}${wf('tol', T('Tolerance', 'ระยะยอมรับ') + ul('L'), v.tol, 'n')}</div>` + hint(T('Nodes closer than the tolerance become one; elements are reconnected and duplicates removed.', 'จุดต่อที่ห่างน้อยกว่าระยะยอมรับรวมเป็นจุดเดียว ชิ้นส่วนเชื่อมใหม่และลบชิ้นซ้ำ')) + wfoot(T('Merge', 'รวม')), add: v => mergeNodes(v.scope, frU(+v.tol || 0, 'L')) },
      chg: { t: () => T('Change element parameters', 'เปลี่ยนคุณสมบัติชิ้นส่วน'), def: () => ({ sec: '', mat: '', type: '', beta: '' }),
        body: v => { const keep = [['', T('— keep —', '— คงเดิม —')]]; return selInfo() + `<div class="an-row2">${ws('sec', T('Section', 'หน้าตัด'), keep.concat(secOpts()), v.sec)}${ws('mat', T('Material', 'วัสดุ'), keep.concat(matOpts()), v.mat)}</div><div class="an-row2">${ws('type', T('Type', 'ชนิด'), keep.concat([['frame', T('Frame', 'โครงข้อแข็ง')], ['truss', T('Truss', 'โครงถัก')]]), v.type)}${wf('beta', T('Beta angle β (°)', 'มุม β (°)'), v.beta, 'n', 'placeholder="—"')}</div>` + wfoot(T('Apply', 'กำหนด')); },
        add: v => { if (!needSel(false)) return; snap(true); const m = A.model; A.sel.m.forEach(id => { const q = m.members.find(z => z.id === id); if (!q) return; if (v.sec) q.sec = v.sec; if (v.mat) q.mat = v.mat; if (v.type) q.type = v.type; if (v.beta !== '' && isFinite(+v.beta)) q.beta = +v.beta; }); changed(true); toast(T('Parameters applied to ' + A.sel.m.length + ' element(s)', 'กำหนดให้ ' + A.sel.m.length + ' ชิ้นส่วน'), 'ok'); } },
      bbeta: { t: () => T('Beta angle', 'มุม β'), def: () => ({ beta: 90 }),
        body: v => selInfo() + hint(T('Rotates the element about its own axis: local y turns towards local z. For a column, β = 90° puts the major axis along global Y.', 'หมุนชิ้นส่วนรอบแกนตัวเอง แกน y หมุนไปทาง z สำหรับเสา β = 90° ทำให้แกนหลักอยู่ตามแกน Y')) + wf('beta', 'β (°)', v.beta, 'n') + wfoot(T('Apply', 'กำหนด')),
        add: v => { if (!needSel(false)) return; snap(true); A.sel.m.forEach(id => { const q = A.model.members.find(z => z.id === id); if (q) q.beta = +v.beta || 0; }); changed(true); toast('β → ' + A.sel.m.length, 'ok'); } },
      spr: { t: () => T('Point spring supports', 'สปริงที่จุดต่อ'), def: () => ({ kx: '', ky: '', kz: '', krx: '', kry: '', krz: '' }),
        body: v => selInfo() + `<div class="an-row3">${['kx', 'ky', 'kz'].map(q => wf(q, q + ul('kL'), v[q], 'n')).join('')}</div><div class="an-row3">${['krx', 'kry', 'krz'].map(q => wf(q, q + ul('kR'), v[q], 'n')).join('')}</div>` + hint(T('Blank or 0 removes that spring. Springs act in global axes and add to any support.', 'ว่างหรือ 0 คือไม่มีสปริง สปริงทำงานตามแกนหลักและรวมกับจุดรองรับ')) + wfoot(T('Apply', 'กำหนด')),
        add: v => { if (!A.sel.n.length) { toast(T('Select nodes first.', 'เลือกจุดต่อก่อน'), 'bad'); return; } snap(true); const nd = nodeMap(); A.sel.n.forEach(id => { const n = nd[id]; ['kx', 'ky', 'kz', 'krx', 'kry', 'krz'].forEach(q => { const x = +v[q]; if (!x) delete n[q]; else n[q] = frU(x, q[1] === 'r' ? 'kR' : 'kL'); }); }); changed(true); toast(T('Springs set on ' + A.sel.n.length + ' node(s)', 'กำหนดสปริง ' + A.sel.n.length + ' จุด'), 'ok'); } },
      rel: { t: () => T('Beam end release', 'ปลดแรงปลายคาน'), def: () => ({ h: 'both' }),
        body: v => selInfo() + ws('h', T('Moment release', 'การปลดโมเมนต์'), [['none', T('None — rigid', 'ไม่มี — ยึดแน่น')], ['i', T('Pin at end i', 'หมุดที่ปลาย i')], ['j', T('Pin at end j', 'หมุดที่ปลาย j')], ['both', T('Pin both ends', 'หมุดทั้งสองปลาย')], ['truss', T('Truss (axial only)', 'โครงถัก (แรงตามแนวแกน)')]], v.h) + wfoot(T('Apply', 'กำหนด')),
        add: v => { if (!needSel(false)) return; dropApply('rel:' + v.h, null); } },
      sw: { t: () => T('Self weight', 'น้ำหนักตัวเอง'), body: () => hint(T('Tick the load case that carries the self weight of the elements (area × unit weight γ of the material).', 'ติ๊กกรณีน้ำหนักที่รวมน้ำหนักตัวเองของชิ้นส่วน (พื้นที่ × หน่วยน้ำหนัก γ ของวัสดุ)')) + tblw([T('Case', 'กรณี'), T('Name', 'ชื่อ'), T('Type', 'ประเภท'), T('Self weight', 'น้ำหนักตัวเอง')], A.model.cases.map((c, i) => `<tr><td><b>${esc(c.id)}</b></td><td>${esc(c.name)}</td><td>${c.type}</td><td><input type="checkbox" data-tb="cases" data-i="${i}" data-f="sw" ${c.sw ? 'checked' : ''}></td></tr>`)) + `<p class="muted small">${T('Total self weight', 'น้ำหนักตัวเองรวม')}: <b>${fu(A.model.members.reduce((s, q) => s + ((memWeight(q) || {}).W || 0), 0), 'F')}${ul('F')}</b></p>` + wfoot('') },
      actl: { t: () => T('Analysis control', 'การควบคุมการวิเคราะห์'), body: () => panel('run') + wfoot('') },
      vname: { t: () => T('Named views', 'มุมมองที่บันทึก'), def: () => ({ n: '' }),
        body: v => `<div class="an-row2">${wf('n', T('Name for the current view', 'ชื่อมุมมองปัจจุบัน'), v.n, '', 'placeholder="' + T('e.g. South elevation', 'เช่น รูปด้านทิศใต้') + '"')}<span class="an-f"><span>&nbsp;</span><button class="btn btn-hot xs" data-act="an-wadd">${T('Save view', 'บันทึกมุมมอง')}</button></span></div>` +
          (A.opt.views.length ? tblw([T('View', 'มุมมอง'), ''], A.opt.views.map((q, i) => `<tr><td>${esc(q.n)} <span class="muted small">${q.c.v === '3d' ? '3D' : q.c.v.toUpperCase()}</span></td><td class="num"><button class="btn btn-ghost xs" data-act="an-rb" data-c="vrestore" data-v="${i}">${T('Show', 'แสดง')}</button> <button class="icon-btn" data-act="an-rb" data-c="vdel" data-v="${i}" aria-label="${T('Delete', 'ลบ')}">×</button></td></tr>`)) : hint(T('No saved views yet.', 'ยังไม่มีมุมมองที่บันทึก'))) + wfoot(''),
        add: v => { const n = String(v.n || '').trim() || T('View ', 'มุมมอง ') + (A.opt.views.length + 1); A.opt.views.push({ n, c: camSnap(), cut: A.cut }); v.n = ''; persist(); toast(T('View saved: ', 'บันทึกมุมมอง: ') + n, 'ok'); } },
      ntab: { t: () => T('Nodes table', 'ตารางจุดต่อ'), body: () => { const m = A.model; return tblw(['ID', 'X' + ul('L'), 'Y' + ul('L'), 'Z' + ul('L'), T('Support', 'จุดรองรับ'), ''], m.nodes.slice(0, 600).map((n, i) => `<tr class="${A.sel.n.includes(n.id) ? 'on' : ''}"><td><button class="linkbtn" data-act="an-pickn" data-n="${esc(n.id)}">${esc(n.id)}</button></td>${['x', 'y', 'z'].map(q => `<td>${inp(uv(+n[q] || 0, 'L'), `data-tb="nodes" data-i="${i}" data-f="${q}" type="number" step="any"`)}</td>`).join('')}<td>${sel(SUP(), n.sup || 'free', `data-tb="nodes" data-i="${i}" data-f="sup"`)}</td><td>${liDel('nodes', i)}</td></tr>`), 'edit') + (m.nodes.length > 600 ? hint(T('First 600 rows.', 'แสดง 600 แถวแรก')) : '') + wfoot('', `<button class="btn btn-ghost sm" data-act="an-rb" data-c="csv" data-v="nodes">CSV</button>`); } },
      etab: { t: () => T('Elements table', 'ตารางชิ้นส่วน'), body: () => { const m = A.model, so = secOpts(), mo = matOpts(); return tblw(['ID', T('Node i', 'จุด i'), T('Node j', 'จุด j'), T('Section', 'หน้าตัด'), T('Material', 'วัสดุ'), T('Type', 'ชนิด'), 'β°', 'L' + ul('L'), ''], m.members.slice(0, 500).map((q, i) => { const g = memGeom(q); return `<tr class="${A.sel.m.includes(q.id) ? 'on' : ''} ${memOK(q) ? '' : 'bad'}"><td><button class="linkbtn" data-act="an-pick" data-m="${esc(q.id)}">${esc(q.id)}</button></td><td>${inp(q.i, `data-tb="members" data-i="${i}" data-f="i"`)}</td><td>${inp(q.j, `data-tb="members" data-i="${i}" data-f="j"`)}</td><td>${sel(so, q.sec, `data-tb="members" data-i="${i}" data-f="sec"`)}</td><td>${sel(mo, q.mat, `data-tb="members" data-i="${i}" data-f="mat"`)}</td><td>${sel([['frame', T('Frame', 'โครงข้อแข็ง')], ['truss', T('Truss', 'โครงถัก')]], q.type || 'frame', `data-tb="members" data-i="${i}" data-f="type"`)}</td><td>${inp(+q.beta || 0, `data-tb="members" data-i="${i}" data-f="beta" type="number" step="any"`)}</td><td class="num mono">${g ? fu(g.L, 'L') : '—'}</td><td>${liDel('members', i)}</td></tr>`; }), 'edit') + (m.members.length > 500 ? hint(T('First 500 rows.', 'แสดง 500 แถวแรก')) : '') + wfoot('', `<button class="btn btn-ghost sm" data-act="an-rb" data-c="csv" data-v="members">CSV</button>`); } },
      pmt: { t: () => T('Material table', 'ตารางวัสดุ'), body: () => tblw(['ID', T('Name', 'ชื่อ'), 'E (MPa)', 'ν', 'γ' + ul('g'), 'α' + ul('al'), "f'c / fy (MPa)"], A.model.materials.map(x => `<tr><td><b>${esc(x.id)}</b></td><td>${esc(x.name || '')}</td><td class="num mono">${f(+x.E, 0)}</td><td class="num mono">${f(x.nu === undefined ? 0.3 : +x.nu, 2)}</td><td class="num mono">${fu(+x.rho || 0, 'g', UU().F === 'kN' ? 1 : 4)}</td><td class="num mono">${fx(toU(+x.alpha || F.alphaOf(x) * 1e6, 'al'), 2)}</td><td class="num mono">${x.fc ? f(+x.fc, 1) : x.fy ? f(+x.fy, 0) : '—'}</td></tr>`)) + wfoot('') },
      pst: { t: () => T('Section table', 'ตารางหน้าตัด'), body: () => tblw(['ID', T('Shape', 'รูปทรง'), 'A (mm²)', 'I<sub>z</sub> (×10⁶ mm⁴)', 'I<sub>y</sub> (×10⁶ mm⁴)', 'J (×10⁶ mm⁴)', T('Used by', 'ใช้ใน')], A.model.sections.map(s => { const p = F.secProps(s); return `<tr><td><b>${esc(s.id)}</b></td><td>${esc(s.name || s.type)}</td><td class="num mono">${f(p.A, 0)}</td><td class="num mono">${f(p.Iz / 1e6, 2)}</td><td class="num mono">${f(p.Iy / 1e6, 2)}</td><td class="num mono">${f(p.J / 1e6, 3)}</td><td class="num mono">${A.model.members.filter(q => q.sec === s.id).length}</td></tr>`; })) + wfoot('') },
      btab: { t: () => T('Boundary table', 'ตารางจุดรองรับ'), body: () => { const m = A.model, rows = m.nodes.filter(n => F.fixOf(n).some(Boolean) || ['kx', 'ky', 'kz', 'krx', 'kry', 'krz'].some(q => +n[q] > 0)); return (rows.length ? tblw([T('Node', 'จุดต่อ'), T('Support', 'จุดรองรับ'), 'Ux Uy Uz Rx Ry Rz', T('Springs', 'สปริง')], rows.map(n => `<tr><td><button class="linkbtn" data-act="an-pickn" data-n="${esc(n.id)}">${esc(n.id)}</button></td><td>${esc((SUP().find(q => q[0] === (n.sup || 'free')) || [])[1] || n.sup)}</td><td class="mono">${F.fixOf(n).map(x => (x ? '■' : '□')).join(' ')}</td><td class="mono small">${['kx', 'ky', 'kz', 'krx', 'kry', 'krz'].filter(q => +n[q] > 0).map(q => q + ' ' + fu(+n[q], q[1] === 'r' ? 'kR' : 'kL', 0)).join(', ') || '—'}</td></tr>`)) : hint(T('No supports yet.', 'ยังไม่มีจุดรองรับ'))) + `<p class="muted small">${T('Released / truss elements', 'ชิ้นส่วนที่ปลดแรง / โครงถัก')}: ${m.members.filter(q => q.relI || q.relJ || q.type === 'truss').map(q => esc(q.id) + (q.type === 'truss' ? ' (T)' : ' (' + (q.relI ? 'i' : '') + (q.relJ ? 'j' : '') + ')')).join(', ') || '—'}</p>` + wfoot(''); } },
      ltab: { t: () => T('Load table', 'ตารางแรง'), body: () => { const m = A.model; return m.loads.length ? tblw([T('Case', 'กรณี'), T('On', 'ที่'), T('Type', 'ชนิด'), T('Values', 'ค่า'), ''], m.loads.slice(0, 600).map((l, i) => `<tr><td><b>${esc(l.case)}</b></td><td>${esc(l.kind === 'node' || l.kind === 'settle' ? l.node : l.member)}</td><td>${{ node: T('nodal', 'ที่จุดต่อ'), udl: T('distributed', 'แผ่กระจาย'), point: T('point', 'แรงจุด'), moment: T('moment', 'โมเมนต์'), temp: T('temperature', 'อุณหภูมิ'), pres: T('prestress', 'แรงอัดล่วงหน้า'), settle: T('settlement', 'การทรุดตัว') }[l.kind] || l.kind}</td><td class="small">${esc(loadDesc(l))}</td><td>${liDel('loads', i)}</td></tr>`)) + wfoot('', `<button class="btn btn-ghost sm" data-act="an-rb" data-c="csv" data-v="loads">CSV</button>`) : hint(T('No loads yet.', 'ยังไม่มีแรง')) + wfoot(''); } },
      lsum: { t: () => T('Load summary', 'สรุปแรง'), body: () => tblw([T('Case', 'กรณี'), T('Loads', 'จำนวน'), 'ΣFx' + ul('F'), 'ΣFy' + ul('F'), 'ΣFz' + ul('F'), T('of which self weight', 'น้ำหนักตัวเอง') + ul('F'), T('Temperature', 'อุณหภูมิ')], A.model.cases.map(c => { const s = caseSum(c.id); return `<tr><td><b>${esc(c.id)}</b> <span class="muted small">${esc(c.name)}</span></td><td class="num mono">${s.n}</td>${s.R.map(v => `<td class="num mono">${fu(v, 'F')}</td>`).join('')}<td class="num mono">${s.sw ? fu(-s.sw, 'F') : '—'}</td><td class="num mono">${s.nT || '—'}</td></tr>`; })) + hint(T('Resultants of the applied loads in global axes (Z up, so gravity is negative). Moments and temperature loads have no force resultant.', 'ผลรวมแรงตามแกนหลัก (Z ขึ้น แรงโน้มถ่วงเป็นลบ) โมเมนต์และแรงจากอุณหภูมิไม่มีผลรวมแรง')) + wfoot('') },
      qms: { t: () => T('Mass summary', 'สรุปมวล'), body: () => { const m = A.model, by = {}; let tot = 0; m.members.forEach(q => { const w = memWeight(q); if (!w) return; const k = q.mat + ' · ' + q.sec, o = by[k] || (by[k] = { n: 0, L: 0, W: 0 }); o.n++; o.L += w.L; o.W += w.W; tot += w.W; }); return tblw([T('Material · section', 'วัสดุ · หน้าตัด'), T('Elements', 'จำนวน'), T('Length', 'ความยาว') + ul('L'), T('Weight', 'น้ำหนัก') + ul('F'), T('Mass (t)', 'มวล (ตัน)')], Object.entries(by).map(([k, o]) => `<tr><td>${esc(k)}</td><td class="num mono">${o.n}</td><td class="num mono">${fu(o.L, 'L', 2)}</td><td class="num mono">${fu(o.W, 'F')}</td><td class="num mono">${f(o.W / 9.81, 2)}</td></tr>`).concat([`<tr class="tot"><td>Σ</td><td></td><td></td><td class="num mono">${fu(tot, 'F')}</td><td class="num mono">${f(tot / 9.81, 2)}</td></tr>`])) + wfoot(''); } },
      qwt: { t: () => T('Element weight table', 'ตารางน้ำหนักชิ้นส่วน'), body: () => { let tot = 0; const rows = A.model.members.slice(0, 600).map(q => { const w = memWeight(q); if (w) tot += w.W; return `<tr><td>${esc(q.id)}</td><td>${esc(q.sec)}</td><td>${esc(q.mat)}</td><td class="num mono">${w ? fu(w.L, 'L', 2) : '—'}</td><td class="num mono">${w ? f(w.A * 1e6, 0) : '—'}</td><td class="num mono">${w ? fu(w.gam, 'g', UU().F === 'kN' ? 1 : 4) : '—'}</td><td class="num mono">${w ? fu(w.W, 'F') : '—'}</td></tr>`; }); return tblw([T('Element', 'ชิ้นส่วน'), T('Section', 'หน้าตัด'), T('Material', 'วัสดุ'), 'L' + ul('L'), 'A (mm²)', 'γ' + ul('g'), T('Weight', 'น้ำหนัก') + ul('F')], rows.concat([`<tr class="tot"><td>Σ</td><td></td><td></td><td></td><td></td><td></td><td class="num mono">${fu(tot, 'F')}</td></tr>`])) + wfoot(''); } },
      qnt: { t: () => T('Node detail table', 'ตารางรายละเอียดจุดต่อ'), body: () => { const m = A.model, cur = fresh() ? current() : null, env = cur && cur.kind === 'env'; return (cur ? `<p class="muted small">${T('Results for ', 'ผลของ ')}${esc((srcList().find(q => q[0] === A.src) || [])[1] || '')}</p>` : hint(T('Run the analysis to add displacements and reactions.', 'วิเคราะห์เพื่อแสดงการเคลื่อนตัวและแรงปฏิกิริยา'))) + tblw(['ID', 'X', 'Y', 'Z' + ul('L'), T('Support', 'จุดรองรับ')].concat(cur && !env ? ['u<sub>x</sub>', 'u<sub>y</sub>', 'u<sub>z</sub>' + ul('d'), 'R<sub>x</sub>', 'R<sub>y</sub>', 'R<sub>z</sub>' + ul('F')] : []), m.nodes.slice(0, 600).map((n, i) => `<tr class="${A.sel.n.includes(n.id) ? 'on' : ''}"><td>${esc(n.id)}</td>${['x', 'y', 'z'].map(q => `<td class="num mono">${fu(+n[q] || 0, 'L')}</td>`).join('')}<td>${n.sup && n.sup !== 'free' ? esc(n.sup) : ''}</td>${cur && !env ? [0, 1, 2].map(d => `<td class="num mono">${fu(cur.u[6 * i + d], 'd', 3)}</td>`).join('') + [0, 1, 2].map(d => `<td class="num mono">${F.fixOf(n)[d] || +n[['kx', 'ky', 'kz'][d]] ? fu(cur.R[6 * i + d], 'F') : ''}</td>`).join('') : ''}</tr>`)) + wfoot(''); } },
      qet: { t: () => T('Element detail table', 'ตารางรายละเอียดชิ้นส่วน'), body: () => { const m = A.model, cur = fresh() ? current() : null; return (cur ? `<p class="muted small">${T('Results for ', 'ผลของ ')}${esc((srcList().find(q => q[0] === A.src) || [])[1] || '')}</p>` : hint(T('Run the analysis to add the member forces.', 'วิเคราะห์เพื่อแสดงแรงในชิ้นส่วน'))) + tblw(['ID', 'i', 'j', T('Section', 'หน้าตัด'), T('Material', 'วัสดุ'), T('Type', 'ชนิด'), T('Release', 'ปลดแรง'), 'β°', 'L' + ul('L')].concat(cur ? ['|N|' + ul('F'), '|V|' + ul('F'), '|M|' + ul('M')] : []), m.members.slice(0, 600).map(q => { const g = memGeom(q), r = cur ? memRes(cur, q.id) : null, mx = k => r ? Math.max(...(cur.kind === 'env' ? r[k + 'max'].concat(r[k + 'min']) : r[k]).map(Math.abs)) : 0; return `<tr class="${A.sel.m.includes(q.id) ? 'on' : ''}"><td>${esc(q.id)}</td><td>${esc(q.i)}</td><td>${esc(q.j)}</td><td>${esc(q.sec)}</td><td>${esc(q.mat)}</td><td>${q.type === 'truss' ? T('truss', 'โครงถัก') : T('frame', 'โครงข้อแข็ง')}</td><td>${(q.relI ? 'i ' : '') + (q.relJ ? 'j' : '') || '—'}</td><td class="num mono">${f(+q.beta || 0, 0)}</td><td class="num mono">${g ? fu(g.L, 'L', 2) : '—'}</td>${r ? `<td class="num mono">${fu(mx('N'), 'F')}</td><td class="num mono">${fu(Math.max(mx('Vy'), mx('Vz')), 'F')}</td><td class="num mono">${fu(Math.max(mx('My'), mx('Mz')), 'M')}</td>` : cur ? '<td></td><td></td><td></td>' : ''}</tr>`; })) + wfoot(''); } },
      stat: { t: () => T('Project status', 'สถานะโครงการ'), body: () => { const m = A.model, sd = stdInfo(m.std), tot = m.members.reduce((s, q) => s + ((memWeight(q) || {}).W || 0), 0), Lt = m.members.reduce((s, q) => s + ((memGeom(q) || {}).L || 0), 0), bad = m.members.filter(q => !memOK(q)).length;
        const kv = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
        return `<dl class="an-wkv an-stat">${kv(T('Design standard', 'มาตรฐาน'), esc(T(sd.name[0], sd.name[1])))}${kv(T('Model type', 'ชนิดแบบจำลอง'), m.plane === 'XZ' ? T('2D frame (X–Z)', 'โครง 2 มิติ (X–Z)') : T('3D frame', 'โครง 3 มิติ'))}${kv(T('Nodes', 'จุดต่อ'), m.nodes.length)}${kv(T('Elements', 'ชิ้นส่วน'), m.members.length + (bad ? ` <span class="an-miss">(${bad} ${T('without property', 'ไม่มีคุณสมบัติ')})</span>` : ''))}${kv(T('Total element length', 'ความยาวรวม'), fu(Lt, 'L', 2) + ul('L'))}${kv(T('Materials / sections', 'วัสดุ / หน้าตัด'), m.materials.length + ' / ' + m.sections.length)}${kv(T('Supported nodes', 'จุดรองรับ'), m.nodes.filter(n => F.fixOf(n).some(Boolean)).length)}${kv(T('Load cases / loads', 'กรณีน้ำหนัก / แรง'), m.cases.length + ' / ' + m.loads.length)}${kv(T('Combinations', 'การรวมน้ำหนัก'), m.combos.length)}${kv(T('Self weight', 'น้ำหนักตัวเอง'), fu(tot, 'F') + ul('F') + ' (' + f(tot / 9.81, 1) + ' t)')}${kv(T('Units', 'หน่วย'), ulab('F') + ', ' + ulab('L') + ', ' + ulab('M') + ', ' + ulab('T'))}${kv(T('Analysis', 'การวิเคราะห์'), fresh() ? T('up to date', 'เป็นปัจจุบัน') + ' · ' + A.res.ms + ' ms' : A.err ? `<span class="an-miss">${esc(A.err)}</span>` : T('not run since the last change', 'ยังไม่ได้วิเคราะห์หลังแก้ไขล่าสุด'))}${kv(T('Options', 'ตัวเลือก'), [A.opt.pdelta ? 'P-Delta' : '', A.opt.modes ? T('modal', 'โหมด') : '', A.opt.buckling ? T('buckling', 'การโก่งเดาะ') : ''].filter(Boolean).join(', ') || T('linear static', 'สถิตเชิงเส้น'))}</dl>` + wfoot(''); } },
      qinfo: { t: () => T('Query', 'สอบถาม'), body: () => queryHTML() + wfoot('') },
      stdw: { t: () => T('Design standard', 'มาตรฐานการออกแบบ'), body: () => panel('std').replace(/<button class="btn btn-hot xs" data-act="an-step" data-s="mat">[^<]*<\/button>/, '') + wfoot('') }
    };
    function queryHTML() {
      const q = A.qinfo, m = A.model; if (!q) return hint(T('Pick Query Nodes or Query Elements, then click in the view.', 'เลือกสอบถามจุดต่อหรือชิ้นส่วน แล้วคลิกในมุมมอง'));
      const cur = fresh() ? current() : null, env = cur && cur.kind === 'env', kv = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`, srcL = cur ? esc((srcList().find(z => z[0] === A.src) || [])[1] || '') : '';
      if (q.k === 'n') {
        const i = m.nodes.findIndex(n => n.id === q.id), n = m.nodes[i]; if (!n) return hint(T('That node no longer exists.', 'ไม่มีจุดต่อนี้แล้ว'));
        const ms = m.members.filter(z => z.i === n.id || z.j === n.id).map(z => z.id), ls = m.loads.filter(l => l.node === n.id);
        let r = '';
        if (cur && !env) r = kv(T('Displacement', 'การเคลื่อนตัว') + ' (' + ulab('d') + ')', [0, 1, 2].map(d => 'xyz'[d] + ' ' + fu(cur.u[6 * i + d], 'd', 3)).join(' · ')) + kv(T('Rotation (mrad)', 'การหมุน (mrad)'), [3, 4, 5].map(d => 'xyz'[d - 3] + ' ' + fx(cur.u[6 * i + d] * 1000, 3)).join(' · ')) + (F.fixOf(n).some(Boolean) ? kv(T('Reaction', 'แรงปฏิกิริยา'), [0, 1, 2].map(d => 'R' + 'xyz'[d] + ' ' + fu(cur.R[6 * i + d], 'F')).join(' · ') + ul('F') + '<br>' + [3, 4, 5].map(d => 'M' + 'xyz'[d - 3] + ' ' + fu(cur.R[6 * i + d], 'M')).join(' · ') + ul('M')) : '');
        else if (cur && env && F.fixOf(n).some(Boolean)) r = kv(T('Reaction range', 'ช่วงแรงปฏิกิริยา'), [0, 1, 2].map(d => 'R' + 'xyz'[d] + ' ' + fu(cur.R[6 * i + d][1], 'F') + '…' + fu(cur.R[6 * i + d][0], 'F')).join('<br>') + ul('F'));
        return `<h4>${T('Node', 'จุดต่อ')} ${esc(n.id)}</h4><dl class="an-wkv an-stat">${kv(T('Coordinates', 'พิกัด') + ' (' + ulab('L') + ')', ['x', 'y', 'z'].map(a => fu(+n[a] || 0, 'L')).join(', '))}${kv(T('Support', 'จุดรองรับ'), esc((SUP().find(s => s[0] === (n.sup || 'free')) || [])[1] || n.sup) + ' · ' + F.fixOf(n).map(x => (x ? '■' : '□')).join(''))}${kv(T('Elements', 'ชิ้นส่วน'), ms.map(esc).join(', ') || '—')}${kv(T('Loads', 'แรง'), ls.map(l => '<b>' + esc(l.case) + '</b> ' + esc(loadDesc(l))).join('<br>') || '—')}${r}</dl>${cur ? `<p class="muted small">${srcL}</p>` : ''}`;
      }
      const e = m.members.find(z => z.id === q.id); if (!e) return hint(T('That element no longer exists.', 'ไม่มีชิ้นส่วนนี้แล้ว'));
      const g = memGeom(e), w = memWeight(e), s = m.sections.find(z => z.id === e.sec), p = s ? F.secProps(s) : null, ls = m.loads.filter(l => l.member === e.id), r = cur ? memRes(cur, e.id) : null;
      const ext = k => { if (!r) return ''; const a = env ? r[k + 'max'] : r[k], b = env ? r[k + 'min'] : r[k]; return fu(Math.min(...b), ['T', 'My', 'Mz'].includes(k) ? 'M' : 'F') + ' … ' + fu(Math.max(...a), ['T', 'My', 'Mz'].includes(k) ? 'M' : 'F'); };
      return `<h4>${T('Element', 'ชิ้นส่วน')} ${esc(e.id)} <span class="muted small">${esc(e.i)} → ${esc(e.j)}</span></h4><dl class="an-wkv an-stat">${kv(T('Length', 'ความยาว'), g ? fu(g.L, 'L') + ul('L') : '—')}${kv(T('Section', 'หน้าตัด'), esc(e.sec) + (p ? ` · A ${f(p.A, 0)} mm² · I<sub>z</sub> ${f(p.Iz / 1e6, 1)}×10⁶` : ` <span class="an-miss">${T('missing', 'ไม่มี')}</span>`))}${kv(T('Material', 'วัสดุ'), esc(e.mat) + (m.materials.some(z => z.id === e.mat) ? '' : ` <span class="an-miss">${T('missing', 'ไม่มี')}</span>`))}${kv(T('Type / release / β', 'ชนิด / ปลดแรง / β'), (e.type === 'truss' ? T('truss', 'โครงถัก') : T('frame', 'โครงข้อแข็ง')) + ' · ' + ((e.relI ? 'i ' : '') + (e.relJ ? 'j' : '') || T('rigid', 'ยึดแน่น')) + ' · ' + f(+e.beta || 0, 0) + '°')}${kv(T('Weight', 'น้ำหนัก'), w ? fu(w.W, 'F') + ul('F') : '—')}${kv(T('Loads', 'แรง'), ls.map(l => '<b>' + esc(l.case) + '</b> ' + esc(loadDesc(l))).join('<br>') || '—')}${r ? ['N', 'Vy', 'Vz', 'T', 'My', 'Mz'].map(k => kv(k, ext(k))).join('') : ''}</dl>${cur ? `<p class="muted small">${srcL} · ${ulab('F')}, ${ulab('M')}</p>` : hint(T('Run the analysis to see the forces.', 'วิเคราะห์เพื่อดูแรง'))}`;
    }
    function csvOut(tb) {
      const m = A.model, esc2 = v => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
      const rows = tb === 'nodes' ? [['id', 'x (' + ulab('L') + ')', 'y', 'z', 'support']].concat(m.nodes.map(n => [n.id, uv(+n.x || 0, 'L'), uv(+n.y || 0, 'L'), uv(+n.z || 0, 'L'), n.sup || 'free']))
        : tb === 'members' ? [['id', 'i', 'j', 'section', 'material', 'type', 'relI', 'relJ', 'beta']].concat(m.members.map(q => [q.id, q.i, q.j, q.sec, q.mat, q.type || 'frame', q.relI ? 1 : 0, q.relJ ? 1 : 0, +q.beta || 0]))
          : [['case', 'on', 'kind', 'values']].concat(m.loads.map(l => [l.case, l.kind === 'node' ? l.node : l.member, l.kind, loadDesc(l)]));
      ctx.saveFile((m.name || 'model').replace(/[^\w\-]+/g, '_') + '_' + tb + '.csv', new Blob([rows.map(r => r.map(esc2).join(',')).join('\n')], { type: 'text/csv' }));
    }

    // ---- results access
    function needRes() { if (fresh()) return true; if (!run()) { toast(A.err || T('The analysis failed.', 'การวิเคราะห์ล้มเหลว'), 'bad'); return false; } return true; }
    function showRes(rv, tab) {
      if (!needRes()) return; A.step = 'res'; A.drawerMin = false;
      if (rv) { A.rview = rv; if (rv === 'buck' && !(A.src || '').startsWith('combo:')) { const c = A.model.combos.find(q => q.type === 'ULS'); if (c) A.src = 'combo:' + c.id; } }
      if (tab) A.rtab = tab; ctx.render();
    }
    function openLoadWin(o) { openWin('load'); Object.assign(wdef('load'), o); winRefresh(); }

    // ---- command dispatcher
    function ribCmd(c, v, b) {
      if (b && b.dataset.m) { openMenu(c, b); return; }
      closeMenu();
      if (BRG && bridgeCmd(c, v)) return;
      if ((BLD || c === 'qto' || c === 'qtocsv' || c === 'qtab') && bldCmd(c, v)) return;
      const m = A.model, o = A.opt;
      switch (c) {
        // view
        case 'redraw': A.box = null; redraw(); toast(T('Redrawn', 'วาดใหม่แล้ว'), ''); return;
        case 'initv': camPush(); A.cut = 'all'; setView(m.plane === 'XZ' ? 'xz' : '3d'); setActive('all'); ctx.render(); return;
        case 'prevv': camPrev(); return;
        case 'orbit': setTool(A.tool === 'orbit' ? 'select' : 'orbit'); return;
        case 'pan': setTool(A.tool === 'pan' ? 'select' : 'pan'); return;
        case 'zfit': camPush(); A.cam.k = null; redraw(); return;
        case 'zin': zoomStep(1.25); return;
        case 'zout': zoomStep(0.8); return;
        case 'zwin': setTool('zoomw'); toast(T('Drag a box around the area to zoom to.', 'ลากกรอบรอบพื้นที่ที่ต้องการซูม'), ''); return;
        case 'vp': case 'vpc': viewPoint(v); return;
        case 'namedv': openWin('vname'); return;
        case 'vrestore': { const q = A.opt.views[+v]; if (!q) return; camPush(); A.cam.v = A.cam.v; camApply(Object.assign({}, q.c)); if (q.cut !== undefined) { A.cut = q.cut; redraw(); } return; }
        case 'vdel': A.opt.views.splice(+v, 1); persist(); winRefresh(); return;
        case 'hidden': A.solid = !A.solid; ribRefresh(); redraw(); return;
        case 'wire': A.solid = false; ribRefresh(); redraw(); return;
        case 'lbls': { const on = !(A.lblN !== false || A.lblM !== false); A.lblN = A.lblM = on; ribRefresh(); redraw(); return; }
        case 'tsel': setTool('select'); return;
        case 'sby': selectBy(v); ribRefresh(); return;
        case 'unsn': A.sel.n = []; selChanged(); return;
        case 'unsm': A.sel.m = []; selChanged(); return;
        case 'selprev': if (!A.prevSel) { toast(T('No previous selection.', 'ไม่มีการเลือกก่อนหน้า'), ''); return; } { const nsN = new Set(m.nodes.map(n => n.id)), nsM = new Set(m.members.map(q => q.id)); A.sel = { n: A.prevSel.n.filter(id => nsN.has(id)), m: A.prevSel.m.filter(id => nsM.has(id)) }; } selChanged(); return;
        case 'active': case 'inactive': case 'inverse': setActive(c); return;
        case 'actall': setActive('all'); return;
        case 'grid': A.grid = A.grid === false; ribRefresh(); redraw(); return;
        case 'snap': A.opt.snap = +v || 0; persist(); ribRefresh(); sideRefresh(); toast(T('Snap: ', 'สแนป: ') + (+v ? fu(+v, 'L', 3) + ul('L') : T('off', 'ปิด')), ''); return;
        case 'tog': if (v === 'solid' || v === 'labels' || v === 'loadsOn' || v === 'allAxes') A[v] = !A[v]; else A[v] = A[v] === false; if (v === 'loadsOn') syncLshow(); ribRefresh(); redraw(); return;
        // structure
        case 'wizard': A.tplOpen = true; ctx.render(); return;
        case 'sample': case 'qt': quickModel(c === 'sample' ? (BRG ? 'girder' : BLD ? 'rc' : 'building') : v); return;
        case 'guides': A.guides = A.guides === false; drawGuide(null); ribRefresh(); return;
        case 'type3d': case 'type2d': { const p = c === 'type2d' ? 'XZ' : ''; if ((m.plane || '') === p) return; snap(true); m.plane = p; changed(false); setView(p ? 'xz' : '3d'); ctx.render(); toast(p ? T('2D frame in the X–Z plane', 'โครง 2 มิติ ระนาบ X–Z') : T('3D frame', 'โครง 3 มิติ'), ''); return; }
        case 'gostd': A.rib = 'struct'; A.ribMin = false; ribRefresh(); { const g = [...document.querySelectorAll('#anRib .an-rgt')].find(e => /Design Standard|มาตรฐานการออกแบบ/.test(e.textContent)); if (g) { const r = g.parentElement; r.classList.add('an-flash'); setTimeout(() => r.classList.remove('an-flash'), 1200); } } return;
        case 'stdcombo': onClick('an-gen', { dataset: { code: stdInfo(m.std).combo }, classList: { contains: () => false }, closest: () => null }); return;
        case 'stdinfo': openWin('stdw'); return;
        case 'std': if (m.std === v) { toast(T('Already using ', 'ใช้อยู่แล้ว: ') + T(stdInfo(v).name[0], stdInfo(v).name[1]), ''); return; } onClick('an-std', { dataset: { k: v }, classList: { contains: () => false }, closest: () => null }); return;
        case 'save': onClick('an-save', { dataset: {}, classList: { contains: () => false }, closest: () => null }); return;
        case 'report': onClick('an-report', { dataset: {}, classList: { contains: () => false }, closest: () => null }); return;
        // node / element
        case 'cnode': if (A.tool === 'node') { setTool('select'); return; } setTool('node'); openWin('node'); return;
        case 'celem': setTool(A.tool === 'member' ? 'select' : 'member'); return;
        case 'ntrans': case 'etrans': openWin('tr'); return;
        case 'ndiv': openWin('ndiv'); return;
        case 'ediv': openWin('ediv'); return;
        case 'nmerge': openWin('nmrg'); return;
        case 'emerge': mergeElems(); return;
        case 'eint': intersectElems(); return;
        case 'del': if (!A.sel.n.length && !A.sel.m.length) { toast(T('Select something to delete.', 'เลือกสิ่งที่จะลบ'), 'bad'); return; } deleteSel(); return;
        case 'rot': openWin('rot'); return;
        case 'mir': openWin('mir'); return;
        case 'scl': openWin('scl'); return;
        case 'ext': openWin('ext'); return;
        case 'ntab': openWin('ntab'); return;
        case 'etab': openWin('etab'); return;
        case 'chg': openWin('chg'); return;
        case 'wcen': { const w = A.win && wdef(A.win.k); if (w) { Object.assign(w, cen()); winRefresh(); } return; }
        // properties
        case 'pmat': openWin('mat'); return;
        case 'pmatl': A.step = 'mat'; ctx.render(); return;
        case 'psec': openWin('sec'); return;
        case 'psecm': A.step = 'sec'; ctx.render(); return;
        case 'ptab': openWin(v === 'sec' ? 'pst' : 'pmt'); return;
        // boundary
        case 'bsup': openWin('sup'); return;
        case 'bspr': openWin('spr'); return;
        case 'brel': openWin('rel'); return;
        case 'bbeta': openWin('bbeta'); return;
        case 'btab': openWin('btab'); return;
        // load
        case 'ltype': A.ltype = v; ribRefresh(); return;
        case 'lcases': openWin('case'); return;
        case 'lcombo': openWin('combo'); return;
        case 'lsw': openWin('sw'); return;
        case 'lnode': openLoadWin({ on: 'node' }); return;
        case 'lbeam': openLoadWin({ on: 'elem', kind: 'udl', dir: 'grav' }); return;
        case 'lpoint': openLoadWin({ on: 'elem', kind: 'point', dir: 'grav', w1: 10, a: '' }); return;
        case 'lmom': openLoadWin({ on: 'elem', kind: 'moment', dir: 'lz', w1: 10, a: '' }); return;
        case 'ltemp': openLoadWin({ on: 'elem', kind: 'temp', dT: 20, dTy: 0, dTz: 0 }); return;
        case 'ltgrad': openLoadWin({ on: 'elem', kind: 'temp', dT: 0, dTy: 10, dTz: 0 }); return;
        case 'lshow': if (!v) A.loadsOn = false; else { A.lcase = v; A.loadsOn = true; } syncLshow(); ribRefresh(); redraw(); if (['case', 'load'].includes(A.step)) sideRefresh(); return;
        case 'ltab': openWin('ltab'); return;
        case 'lsum': openWin('lsum'); return;
        // analysis
        case 'run': doRun(); return;
        case 'clear': A.res = null; A.err = null; A.errNode = null; A.resVer = -1; if (A.step === 'res') A.step = 'run'; ctx.render(); toast(T('Results cleared', 'ล้างผลแล้ว'), ''); return;
        case 'actl': openWin('actl'); return;
        case 'tpd': case 'tmode': case 'tbuck': { if (!pro()) { toast(T('P-Delta, modal and buckling analyses are Pro features.', 'การวิเคราะห์ P-Delta โหมด และการโก่งเดาะสำหรับสมาชิก Pro'), 'bad'); return; } const k = { tpd: 'pdelta', tmode: 'modes', tbuck: 'buckling' }[c]; o[k] = !o[k]; persist(); A.ver++; updCounts(); ribRefresh(); if (A.step === 'run') sideRefresh(); toast((o[k] ? '✓ ' : '✗ ') + ({ pdelta: 'P-Delta', modes: T('Modal analysis', 'การวิเคราะห์โหมด'), buckling: T('Buckling analysis', 'การวิเคราะห์การโก่งเดาะ') })[k] + T(' — run again', ' — วิเคราะห์อีกครั้ง'), ''); return; }
        // results
        case 'rreact': showRes('react'); return;
        case 'rdef': showRes('def'); return;
        case 'rv': showRes(v); return;
        case 'src': if (!needRes()) return; A.src = v; A.step = 'res'; ctx.render(); return;
        case 'dscale': A.dscale = +v; redraw(); return;
        case 'rvals': A.labels = !A.labels; ribRefresh(); redraw(); return;
        case 'rdet': if (A.sel.m.length !== 1) { toast(T('Select one element, then press Beam Detail.', 'เลือกชิ้นส่วน 1 ชิ้น แล้วกดรายละเอียดคาน'), 'bad'); return; } showRes(A.rview && A.rview !== 'mode' && A.rview !== 'buck' ? A.rview : 'Mz'); return;
        case 'rmode': if (!A.opt.modes) { toast(T('Turn on Modal in Analysis Control, then run.', 'เปิดการวิเคราะห์โหมดในการควบคุมการวิเคราะห์ แล้ววิเคราะห์'), 'bad'); return; } showRes('mode'); return;
        case 'rbuck': if (!A.opt.buckling) { toast(T('Turn on Buckling in Analysis Control, then run.', 'เปิดการวิเคราะห์การโก่งเดาะในการควบคุมการวิเคราะห์ แล้ววิเคราะห์'), 'bad'); return; } showRes('buck'); return;
        case 'rtab': showRes(null, v); return;
        // design
        case 'dbeam': case 'dcol': if (A.sel.m.length !== 1) { toast(T('Select one element in the view first.', 'เลือกชิ้นส่วน 1 ชิ้นในมุมมองก่อน'), 'bad'); return; } if (!needRes()) return; if (!A.src) { const cb = m.combos.find(q => q.type === 'ULS'); A.src = cb ? 'env:ULS' : null; } sendToDesign(c === 'dbeam' ? 'beam' : 'column'); return;
        // query
        case 'qstat': openWin('stat'); return;
        case 'qnode': case 'qelem': setTool(A.tool === c ? 'select' : c); return;
        case 'qnt': case 'qet': case 'qwt': case 'qms': openWin(c); return;
        // tools
        case 'units': { A.opt.u = Object.assign({}, UPRE[v]); persist(); ctx.render(); if (A.win) winRefresh(); toast(T('Units: ', 'หน่วย: ') + ulab('F') + ', ' + ulab('L') + ', ' + ulab('M') + ', ' + ulab('T'), ''); return; }
        case 'help': openWin('help'); return;
        case 'undo': undo(false); return;
        case 'redo': undo(true); return;
        case 'csv': csvOut(v); return;
      }
    }


    // ================================================================== bridge mode: ribbon tab, windows, lanes, influence lines
    const BRD = () => { const m = A.model; if (!m.bridge) m.bridge = { kind: 'blank', lanes: [], vehicles: [], mlc: [], stages: [], bcombos: [] }; ['lanes', 'vehicles', 'mlc', 'stages', 'bcombos'].forEach(k => { if (!Array.isArray(m.bridge[k])) m.bridge[k] = []; }); return m.bridge; };
    const CODEL = () => [['AS', 'AS 5100.2'], ['EN', 'EN 1991-2'], ['HL93', 'AASHTO LRFD HL-93'], ['HS20', T('AASHTO HS20-44 (Thai DOH)', 'AASHTO HS20-44 (กรมทางหลวง)')], ['USER', T('User', 'กำหนดเอง')]];
    const vehList = () => Object.entries(BR.VEH).map(([k, v]) => [k, v.name]).concat(BRD().vehicles.map(v => [v.id, v.name || v.id]));
    function bridgeTab() {
      const tool = t => () => A.tool === t, b = BRD();
      return ['bridge', T('Bridge', 'สะพาน'), [
        [T('Bridge Wizard', 'ตัวช่วยสร้างสะพาน'), [B('qt', 'beam', T('Girder Deck', 'สะพานคาน'), { v: 'girder' }), B('qt', 'column', T('Box Girder', 'คานกล่อง'), { v: 'box' }), B('qt', 'truss', T('Truss Bridge', 'โครงถัก'), { v: 'btruss' }), B('qt', 'portal', T('Tied Arch', 'โค้งผูก'), { v: 'arch' }), B('qt', 'shed', T('Cable-Stayed', 'ขึงเคเบิล'), { v: 'cable' }), B('wizard', 'wand', T('Wizard…', 'กำหนดขนาด…'))]],
        [T('Traffic', 'การจราจร'), [B('blanes', 'list', T('Traffic Lanes', 'ช่องจราจร') + ' (' + b.lanes.length + ')'), B('bveh', 'pload', T('Vehicles', 'ยานพาหนะ')), B('bmlc', 'udl', T('Moving Load Cases', 'กรณีน้ำหนักเคลื่อนที่') + ' (' + b.mlc.length + ')')]],
        [T('Construction & Effects', 'การก่อสร้างและผลกระทบ'), [B('bstg', 'extrude', T('Construction Stages', 'ขั้นตอนก่อสร้าง') + ' (' + b.stages.length + ')'), COL(B('bpres', 'range', T('Prestress Tendon', 'แรงอัดล่วงหน้า')), B('bset', 'support', T('Support Settlement', 'การทรุดตัว')), B('ltemp', 'thermo', T('Temperature', 'อุณหภูมิ')))]],
        [T('Combination', 'การรวม'), [B('bcomb', 'lcc', T('Bridge Combinations', 'การรวมน้ำหนักสะพาน') + ' (' + b.bcombos.length + ')')]],
        [T('Bridge Results', 'ผลสะพาน'), [B('bil', 'mode', T('Influence Lines', 'เส้นอิทธิพล'), { on: () => A.step === 'res' && A.rview === 'il' }), B('bmlr', 'diagram', T('Moving Load Envelope', 'ค่าสูงสุด/ต่ำสุดน้ำหนักเคลื่อนที่'), { m: 1 }), B('bstr', 'deform', T('Stage Results', 'ผลตามขั้นตอน'), { m: 1 }), COL(B('tog', 'eye', T('Show lanes', 'แสดงช่องจราจร'), { v: 'showLanes', on: () => A.showLanes !== false }))]]
      ]];
    }
    function bridgeMenu(id) {
      const it = (c, l, v, on) => ({ c, l, v, on });
      if (id === 'bmlr') return BRD().mlc.map(c => it('src', c.id + ' — ' + c.name, 'ml:' + c.id, A.src === 'ml:' + c.id)).concat(BRD().bcombos.map(c => it('src', c.id + ' — ' + c.name, 'bc:' + c.id, A.src === 'bc:' + c.id)));
      if (id === 'bstr') return BRD().stages.map((s, i) => it('src', T('Stage ', 'ขั้นที่ ') + (i + 1) + ' — ' + s.name, 'st:' + s.id, A.src === 'st:' + s.id));
      return null;
    }
    // ---- member chains (paths) and their geometry
    function chainOf(ids) { // order a set of connected members into a path
      const m = A.model, mem = ids.map(id => m.members.find(q => q.id === id)).filter(Boolean); if (mem.length < 2) return mem.map(q => q.id);
      const deg = {}; mem.forEach(q => { deg[q.i] = (deg[q.i] || 0) + 1; deg[q.j] = (deg[q.j] || 0) + 1; });
      let at = Object.keys(deg).find(k => deg[k] === 1) || mem[0].i; const left = new Set(mem.map(q => q.id)), out = [];
      while (left.size) { const q = mem.find(z => left.has(z.id) && (z.i === at || z.j === at)); if (!q) return null; out.push(q.id); left.delete(q.id); at = q.i === at ? q.j : q.i; }
      return out;
    }
    function pathGeom(ids) { // s → point along the chain
      const m = A.model, nd = nodeMap(), segs = []; let at = null, L = 0;
      ids.forEach((id, k) => { const q = m.members.find(z => z.id === id); if (!q || !nd[q.i] || !nd[q.j]) return; let rev = false; if (k === 0) { const nx = m.members.find(z => z.id === ids[1]); rev = !!(nx && (q.i === nx.i || q.i === nx.j) && !(q.j === nx.i || q.j === nx.j)); } else rev = q.j === at; at = rev ? q.i : q.j; const a = P3(nd[rev ? q.j : q.i]), b = P3(nd[rev ? q.i : q.j]), l = Math.hypot(...sub(b, a)); segs.push({ a, b, l, s0: L }); L += l; });
      return { L, at: s => { const g = segs.find(q => s <= q.s0 + q.l + 1e-9) || segs[segs.length - 1]; if (!g) return [0, 0, 0]; const t = g.l ? Math.max(0, Math.min(1, (s - g.s0) / g.l)) : 0; return addv(g.a, sub(g.b, g.a), t); } };
    }
    function laneGeom(l) { const ga = pathGeom(l.a || []); if (!l.b || !l.b.length) return ga; const gb = pathGeom(l.b), w = +l.w || 0; return { L: ga.L, at: s => addv(ga.at(s), sub(gb.at(s / (ga.L || 1) * gb.L), ga.at(s)), w) }; }
    const LCOL = ['#e8590c', '#1c7ed6', '#2f9e44', '#ae3ec9', '#f08c00', '#0c8599'];
    // drawn by render() in model view
    function drawLanesOn(g, P, pal) {
      const b = A.model.bridge; if (!b || !b.lanes || !b.lanes.length) return;
      g.save(); b.lanes.forEach((l, k) => {
        const ge = laneGeom(l); if (!ge.L) return; const col = LCOL[k % LCOL.length], n = 40; g.strokeStyle = col; g.lineWidth = 6; g.globalAlpha = 0.28; g.beginPath();
        for (let i = 0; i <= n; i++) { const p = P(ge.at(ge.L * i / n)); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } g.stroke(); g.globalAlpha = 1;
        const p0 = P(ge.at(0)), p1 = P(ge.at(Math.min(ge.L, 1.5))); const an = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
        g.fillStyle = col; g.font = '700 11px system-ui, sans-serif'; g.fillText(l.id, p0[0] - 18 * Math.cos(an) - 6, p0[1] - 18 * Math.sin(an) + 4);
        const pm = P(ge.at(ge.L * 0.5)), pn = P(ge.at(ge.L * 0.5 + Math.min(1, ge.L / 20))), a2 = Math.atan2(pn[1] - pm[1], pn[0] - pm[0]);
        g.beginPath(); g.moveTo(pm[0] + 8 * Math.cos(a2), pm[1] + 8 * Math.sin(a2)); g.lineTo(pm[0] - 6 * Math.cos(a2 - 0.6), pm[1] - 6 * Math.sin(a2 - 0.6)); g.lineTo(pm[0] - 6 * Math.cos(a2 + 0.6), pm[1] - 6 * Math.sin(a2 + 0.6)); g.closePath(); g.fill();
      }); g.restore();
    }
    // ---- influence lines
    function ilInf() {
      if (A.bres && A.bres.inf && A.resVer === A.ver) return A.bres.inf;
      if (A.ilCache && A.ilCache.ver === A.ver) return A.ilCache.inf;
      try { const inf = BR.influence(A.model); A.ilCache = { ver: A.ver, inf }; return inf; } catch (e) { toast(e.message, 'bad'); return null; }
    }
    function ilData() {
      const b = BRD(), lane = b.lanes.find(l => l.id === (A.ilLane || (b.lanes[0] || {}).id)); if (!lane) return null;
      const inf = ilInf(); if (!inf) return null; const tg = A.ilT || defaultIL(); if (!tg) return null;
      const r = BR.lineOf(A.model, inf, lane, tg); return r ? Object.assign(r, { lane, tg }) : null;
    }
    function defaultIL() { const b = BRD(), l = b.lanes[0]; if (!l || !l.a || !l.a.length) return null; return { k: 'm', mem: l.a[Math.floor(l.a.length / 2)], comp: 'Mz', pt: 0 }; }
    function drawILOn(g, P, pal, notes, ext, text) {
      const d = ilData(); if (!d) { notes.push(T('Define a traffic lane to see influence lines (Bridge › Traffic Lanes).', 'กำหนดช่องจราจรเพื่อดูเส้นอิทธิพล (สะพาน › ช่องจราจร)')); return; }
      const ge = laneGeom(d.lane), mx = Math.max(1e-12, ...d.y.map(Math.abs)), sc = 0.16 * ext / mx;
      const base = d.s.map(s => ge.at(s)), top = base.map((p, i) => addv(p, [0, 0, 1], d.y[i] * sc));
      g.save(); g.beginPath(); base.forEach((p, i) => { const q = P(p); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); for (let i = top.length - 1; i >= 0; i--) { const q = P(top[i]); g.lineTo(q[0], q[1]); } g.closePath(); g.globalAlpha = 0.22; g.fillStyle = pal.acc; g.fill(); g.globalAlpha = 1;
      g.strokeStyle = pal.acc; g.lineWidth = 2; g.beginPath(); top.forEach((p, i) => { const q = P(p); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.stroke(); g.restore();
      let iM = 0, im = 0; d.y.forEach((v, i) => { if (v > d.y[iM]) iM = i; if (v < d.y[im]) im = i; });
      [iM, im].filter((x, k, a) => a.indexOf(x) === k).forEach(i => { if (Math.abs(d.y[i]) < 1e-9) return; const q = P(top[i]); g.beginPath(); g.arc(q[0], q[1], 3.5, 0, 2 * PI); g.fillStyle = pal.acc; g.fill(); text(fx(d.y[i], 3) + ' @ ' + fu(d.s[i], 'L', 1) + ul('L'), q[0] + 6, q[1] - 6, pal.ink, { font: '600 11px ui-monospace, monospace' }); });
      notes.push(T('Influence line — ', 'เส้นอิทธิพล — ') + ilName(d.tg) + T(' for a unit load moving along ', ' สำหรับแรง 1 หน่วยเคลื่อนตาม ') + d.lane.id);
      const mk = d.tg.k === 'm' ? A.model.members.find(q => q.id === d.tg.mem) : null, nd = nodeMap();
      if (mk && nd[mk.i] && nd[mk.j]) { const pa = P3(nd[mk.i]), pb = P3(nd[mk.j]), q = P(addv(pa, sub(pb, pa), (+d.tg.pt || 0) / 10)); g.beginPath(); g.arc(q[0], q[1], 7, 0, 2 * PI); g.strokeStyle = pal.pink; g.lineWidth = 2; g.stroke(); }
      if (d.tg.k === 'r' && nd[d.tg.node]) { const q = P(P3(nd[d.tg.node])); g.beginPath(); g.arc(q[0], q[1], 8, 0, 2 * PI); g.strokeStyle = pal.pink; g.lineWidth = 2; g.stroke(); }
    }
    const ilName = tg => (tg.k === 'r' ? T('reaction ', 'แรงปฏิกิริยา ') + ['Rx', 'Ry', 'Rz', 'Mx', 'My', 'Mz'][+tg.dof || 0] + T(' at ', ' ที่ ') + tg.node : tg.comp + T(' in ', ' ใน ') + tg.mem + T(' at ', ' ที่ ') + ((+tg.pt || 0) / 10).toFixed(1) + 'L');
    function ilChart(d) {
      const W = 540, H = 170, pad = 30, mx = Math.max(1e-12, ...d.y.map(Math.abs)), X = s => pad + (W - 2 * pad) * s / (d.L || 1), Y = v => H / 2 - v / mx * (H / 2 - 22);
      const pts = d.s.map((s, i) => X(s).toFixed(1) + ',' + Y(d.y[i]).toFixed(1)).join(' ');
      let iM = 0, im = 0; d.y.forEach((v, i) => { if (v > d.y[iM]) iM = i; if (v < d.y[im]) im = i; });
      const lab = i => `<circle cx="${X(d.s[i]).toFixed(1)}" cy="${Y(d.y[i]).toFixed(1)}" r="3" class="an-ilpt"/><text x="${Math.min(W - 70, X(d.s[i]) + 5).toFixed(1)}" y="${(Y(d.y[i]) + (d.y[i] >= 0 ? -6 : 14)).toFixed(1)}" class="an-ilt">${fx(d.y[i], 3)}</text>`;
      const pos = d.y.reduce((s2, v, i) => s2 + (i ? Math.max(0, (v + d.y[i - 1]) / 2) * (d.s[i] - d.s[i - 1]) : 0), 0), neg = d.y.reduce((s2, v, i) => s2 + (i ? Math.min(0, (v + d.y[i - 1]) / 2) * (d.s[i] - d.s[i - 1]) : 0), 0);
      return `<svg viewBox="0 0 ${W} ${H}" class="an-ilsvg" role="img" aria-label="${esc(T('Influence line', 'เส้นอิทธิพล'))}"><line x1="${pad}" x2="${W - pad}" y1="${H / 2}" y2="${H / 2}" class="an-ax"/><polygon points="${X(0)},${H / 2} ${pts} ${X(d.L)},${H / 2}" class="an-ilfill"/><polyline points="${pts}" class="an-illine"/>${[iM, im].filter((x, k, a) => a.indexOf(x) === k && Math.abs(d.y[x]) > 1e-9).map(lab).join('')}<text x="${pad}" y="${H - 6}" class="an-ilt">0</text><text x="${W - pad}" y="${H - 6}" text-anchor="end" class="an-ilt">${fu(d.L, 'L', 1)}${ul('L')}</text></svg>
        <p class="muted small">${T('Max', 'สูงสุด')} ${fx(d.y[iM], 4)} @ ${fu(d.s[iM], 'L', 2)}${ul('L')} · ${T('min', 'ต่ำสุด')} ${fx(d.y[im], 4)} @ ${fu(d.s[im], 'L', 2)}${ul('L')} · ${T('area +', 'พื้นที่ +')} ${fx(pos, 3)} / ${fx(neg, 3)} m · ${T('per unit load (kN) acting down', 'ต่อแรง 1 kN ทิศลง')}</p>`;
    }
    // ---- bridge windows
    const bf = (path, v, attrs, w) => inp(v == null ? '' : v, `data-bf="${path}" ${attrs || ''}`, w);
    const bsel = (path, opts, v) => sel(opts, v, `data-bf="${path}"`);
    Object.assign(RW, {
      blanes: { t: () => T('Traffic lanes', 'ช่องจราจร'), body: () => { const b = BRD(); return hint(T('A lane follows a chain of elements (path A). For a lane between two girder lines, give path B and the share w carried by B (lever rule). Select elements in the view, then use the buttons.', 'ช่องจราจรวิ่งตามชิ้นส่วนที่ต่อกัน (เส้นทาง A) หากอยู่ระหว่างคาน 2 แนว ให้กำหนดเส้นทาง B และสัดส่วน w ที่ B รับ (หลักคาน) เลือกชิ้นส่วนในมุมมองแล้วกดปุ่ม')) +
        (b.lanes.length ? tblw(['ID', T('Name', 'ชื่อ'), T('Path A', 'เส้นทาง A'), T('Path B', 'เส้นทาง B'), 'w (B)', T('Length', 'ความยาว'), ''], b.lanes.map((l, i) => { const ge = laneGeom(l); return `<tr><td><b style="color:${LCOL[i % LCOL.length]}">${esc(l.id)}</b></td><td>${bf('lanes.' + i + '.name', l.name, '', 120)}</td><td class="small">${(l.a || []).length} ${T('el.', 'ชิ้น')} <span class="muted">${esc((l.a || []).slice(0, 2).join(', '))}${(l.a || []).length > 2 ? '…' : ''}</span> <button class="linkbtn" data-act="an-rb" data-c="lanesel" data-v="${i}:a">${T('use selection', 'ใช้ที่เลือก')}</button></td><td class="small">${l.b && l.b.length ? l.b.length + T(' el.', ' ชิ้น') : '—'} <button class="linkbtn" data-act="an-rb" data-c="lanesel" data-v="${i}:b">${T('use selection', 'ใช้ที่เลือก')}</button>${l.b && l.b.length ? ` <button class="linkbtn" data-act="an-rb" data-c="lanesel" data-v="${i}:x">${T('clear', 'ล้าง')}</button>` : ''}</td><td>${bf('lanes.' + i + '.w', l.w || 0, 'type="number" step="0.05" min="0" max="1"', 60)}</td><td class="num mono">${fu(ge.L, 'L', 1)}</td><td><button class="icon-btn" data-act="an-rb" data-c="bdel" data-v="lanes:${i}" aria-label="${T('Delete', 'ลบ')}">×</button></td></tr>`; })) : hint(T('No lanes yet.', 'ยังไม่มีช่องจราจร'))) +
        wfoot(T('Add lane from selection', 'เพิ่มช่องจราจรจากที่เลือก')); }, add: () => { const ids = chainOf(A.sel.m); if (!ids || !ids.length) { toast(T('Select a connected chain of elements along the lane first.', 'เลือกชิ้นส่วนที่ต่อกันตามแนวช่องจราจรก่อน'), 'bad'); return; } snap(true); const b = BRD(); b.lanes.push({ id: nextId(b.lanes, 'L'), name: T('Lane ', 'ช่องจราจร ') + (b.lanes.length + 1), a: ids, b: null, w: 0 }); changed(true); ribRefresh(); } },
      bveh: { t: () => T('Vehicles', 'ยานพาหนะ'), def: () => ({ name: '', axles: '0:100, 1.2:100', udl: 0, dla: 0 }),
        body: v => tblw([T('Vehicle', 'ยานพาหนะ'), T('Axles (kN @ m)', 'เพลา (kN @ m)'), T('Lane UDL', 'น้ำหนักแผ่'), 'DLA', ''], vehList().map(([id]) => { const x = BR.vehicle(A.model, id), user = !BR.VEH[id], ax = BR.variants(x)[0]; return `<tr><td><b>${esc(id)}</b><br><span class="muted small">${esc(x.name || '')}</span></td><td class="small mono">${ax.length > 6 ? ax.length + ' × ' + f(ax[0][1], 0) + ' kN, ' + T('length ', 'ยาว ') + f(ax[ax.length - 1][0], 2) + ' m' : ax.map(a => f(a[1], 1) + '@' + f(a[0], 2)).join(' · ')}${x.vary ? `<br><span class="muted">${T('gap after axle ', 'ช่องว่างหลังเพลา ')}${x.vary.after + 1}: ${x.vary.min}–${x.vary.max} m</span>` : ''}${x.unit ? `<br><span class="muted">${T('axle load set by the lane class (300/200/100 kN)', 'น้ำหนักเพลาตามลำดับช่อง (300/200/100 kN)')}</span>` : ''}</td><td class="num mono">${x.unit ? '27 / 7.5' : f(x.udl, 2)} kN/m</td><td class="num mono">${f(x.dla, 2)}${x.dlaUdl ? ' *' : ''}</td><td>${user ? `<button class="icon-btn" data-act="an-rb" data-c="bdel" data-v="vehicles:${BRD().vehicles.findIndex(q => q.id === id)}" aria-label="${T('Delete', 'ลบ')}">×</button>` : ''}</td></tr>`; })) +
          `<p class="muted small">* ${T('DLA also applied to the lane UDL.', 'DLA ใช้กับน้ำหนักแผ่ด้วย')} ${T('Built-in vehicles follow AS 5100.2, EN 1991-2 and AASHTO; check them against the edition your project uses.', 'ยานพาหนะในระบบตาม AS 5100.2, EN 1991-2 และ AASHTO ควรตรวจสอบกับฉบับที่โครงการใช้')}</p>` +
          `<h4>${T('New user vehicle', 'เพิ่มยานพาหนะ')}</h4><div class="an-row2">${wf('name', T('Name', 'ชื่อ'), v.name, '', 'placeholder="' + T('e.g. 10-wheel truck', 'เช่น รถ 10 ล้อ') + '"')}${wf('axles', T('Axles: offset (m) : load (kN), …', 'เพลา: ระยะ (ม.) : แรง (kN), …'), v.axles)}</div><div class="an-row2">${wf('udl', T('Lane UDL (kN/m)', 'น้ำหนักแผ่ (kN/m)'), v.udl, 'n')}${wf('dla', T('Dynamic allowance (e.g. 0.3)', 'แรงกระแทก (เช่น 0.3)'), v.dla, 'n')}</div>` + wfoot(T('Add vehicle', 'เพิ่มยานพาหนะ')),
        add: v => { const ax = String(v.axles || '').split(/[,;]+/).map(s => s.split(':').map(Number)).filter(a => a.length === 2 && isFinite(a[0]) && isFinite(a[1])); if (!ax.length) { toast(T('Enter axles as offset:load, e.g. 0:60, 3.5:120', 'ใส่เพลาเป็น ระยะ:แรง เช่น 0:60, 3.5:120'), 'bad'); return; } snap(true); const b = BRD(), id = nextId(b.vehicles, 'V'); b.vehicles.push({ id, name: String(v.name || '').trim() || id, axles: ax, udl: +v.udl || 0, dla: +v.dla || 0, dlaUdl: false }); v.name = ''; changed(false); toast(T('Vehicle ', 'ยานพาหนะ ') + id, 'ok'); } },
      bmlc: { t: () => T('Moving load cases', 'กรณีน้ำหนักเคลื่อนที่'), body: () => { const b = BRD(), vl = vehList(); return hint(T('Each case runs the chosen vehicles along the chosen lanes (none ticked = all lanes) and keeps the worst effect at every point, with the lane factors of the code.', 'แต่ละกรณีให้ยานพาหนะที่เลือกวิ่งตามช่องจราจรที่เลือก (ไม่เลือก = ทุกช่อง) และเก็บผลที่รุนแรงที่สุดทุกจุด ตามตัวคูณช่องจราจรของมาตรฐาน')) +
        b.mlc.map((c, i) => `<div class="an-blk"><div class="an-row3">${fld('ID', bf('mlc.' + i + '.id', c.id))}${fld(T('Name', 'ชื่อ'), bf('mlc.' + i + '.name', c.name))}${fld(T('Code / lane factors', 'มาตรฐาน / ตัวคูณช่อง'), bsel('mlc.' + i + '.code', CODEL(), c.code))}</div><p class="muted small">${esc((BR.SCHEMES[c.code] || BR.SCHEMES.USER).name)}</p>
          <div class="an-chks"><b class="small">${T('Vehicles', 'ยานพาหนะ')}</b>${vl.map(([id, nm]) => `<label class="chkl sm" title="${esc(nm)}"><input type="checkbox" data-bfl="mlc.${i}.veh" value="${esc(id)}" ${(c.veh || []).includes(id) ? 'checked' : ''}> ${esc(id)}</label>`).join('')}</div>
          <div class="an-chks"><b class="small">${T('Lanes', 'ช่องจราจร')}</b>${b.lanes.map(l => `<label class="chkl sm"><input type="checkbox" data-bfl="mlc.${i}.lanes" value="${esc(l.id)}" ${(c.lanes || []).includes(l.id) ? 'checked' : ''}> ${esc(l.id)}</label>`).join('') || '—'}</div>
          <div class="an-row3">${fld(T('DLA override (blank = vehicle value)', 'แรงกระแทก (ว่าง = ตามยานพาหนะ)'), bf('mlc.' + i + '.dla', c.dla, 'type="number" step="0.01"'))}<span></span><span class="an-f"><span>&nbsp;</span><button class="btn btn-ghost xs" data-act="an-rb" data-c="bdel" data-v="mlc:${i}">${T('Delete case', 'ลบกรณี')}</button></span></div></div>`).join('') + wfoot(T('Add moving load case', 'เพิ่มกรณี')); },
        add: () => { snap(true); const b = BRD(), code = TCODE[A.model.std] || 'AS'; b.mlc.push({ id: nextId(b.mlc, 'ML'), name: T('Moving load ', 'น้ำหนักเคลื่อนที่ ') + (b.mlc.length + 1), code, veh: { AS: ['M1600'], EN: ['LM1'], HL93: ['HL93T', 'HL93D'] }[code] || ['M1600'], lanes: [], dla: '' }); changed(false); ribRefresh(); } },
      bstg: { t: () => T('Construction stages', 'ขั้นตอนการก่อสร้าง'), body: () => { const b = BRD(), m = A.model; return hint(T('Stages are analysed in order on the structure built so far; results add up. A stage activates elements, applies load cases and (optionally) the self-weight of its new elements.', 'วิเคราะห์ทีละขั้นบนโครงสร้างที่สร้างแล้ว ผลรวมสะสม แต่ละขั้นเพิ่มชิ้นส่วน ใส่กรณีน้ำหนัก และ (เลือกได้) น้ำหนักตัวเองของชิ้นส่วนใหม่')) +
        (b.stages.length ? b.stages.map((st, i) => `<div class="an-blk"><div class="an-row3">${fld(T('Stage', 'ขั้น') + ' ' + (i + 1), bf('stages.' + i + '.name', st.name))}${fld(T('Elements added', 'ชิ้นส่วนที่เพิ่ม'), `<span class="mono small">${(st.mems || []).length}</span>`)}<span class="an-f"><span>&nbsp;</span><span><button class="btn btn-ghost xs" data-act="an-rb" data-c="stgsel" data-v="${i}">${T('= selection', '= ที่เลือก')}</button> <button class="btn btn-ghost xs" data-act="an-rb" data-c="stgshow" data-v="${i}">${T('Select', 'เลือก')}</button> <button class="icon-btn" data-act="an-rb" data-c="bdel" data-v="stages:${i}" aria-label="${T('Delete', 'ลบ')}">×</button></span></span></div>
          <div class="an-chks"><b class="small">${T('Load cases applied', 'กรณีน้ำหนักที่ใส่')}</b>${m.cases.map(c => `<label class="chkl sm"><input type="checkbox" data-bfl="stages.${i}.cases" value="${esc(c.id)}" ${(st.cases || []).includes(c.id) ? 'checked' : ''}> ${esc(c.id)}</label>`).join('')}<label class="chkl sm"><input type="checkbox" data-bf="stages.${i}.sw" ${st.sw ? 'checked' : ''}> ${T('self-weight of new elements', 'น้ำหนักตัวเองของชิ้นส่วนใหม่')}</label></div></div>`).join('') : hint(T('No stages yet.', 'ยังไม่มีขั้นตอน'))) +
        `<p class="muted small">${T('Not yet in any stage: ', 'ยังไม่อยู่ในขั้นใด: ')}${m.members.filter(q => !b.stages.some(s => (s.mems || []).includes(q.id))).length} ${T('elements', 'ชิ้นส่วน')}</p>` + wfoot(T('Add stage from selection', 'เพิ่มขั้นจากที่เลือก')); },
        add: () => { if (!A.sel.m.length) { toast(T('Select the elements built in this stage first.', 'เลือกชิ้นส่วนที่สร้างในขั้นนี้ก่อน'), 'bad'); return; } snap(true); const b = BRD(); b.stages.push({ id: nextId(b.stages, 'S'), name: T('Stage ', 'ขั้นที่ ') + (b.stages.length + 1), mems: A.sel.m.slice(), cases: [], sw: true }); changed(false); ribRefresh(); } },
      bpres: { t: () => T('Prestressing tendon', 'แรงอัดล่วงหน้า'), def: () => ({ case: (A.model.cases.find(c => c.id === 'PT') || A.model.cases[0] || {}).id || '', P: 3000, e1: 0, em: 500, e2: 0, prof: 'span' }), live: ['prof'],
        body: v => selInfo() + hint(T('Equivalent loads of a parabolic tendon: axial compression P, end moments P·e and the upward pull 8P·sag/L². Eccentricity e in mm, positive below the centroid (local −y).', 'แรงเทียบเท่าของลวดอัดแรงรูปพาราโบลา: แรงอัด P โมเมนต์ปลาย P·e และแรงยก 8P·ระยะตกท้องช้าง/L² ค่า e เป็น มม. บวกเมื่ออยู่ใต้แกนกลาง (−y)')) +
          `<div class="an-row2">${ws('case', T('Load case', 'กรณีน้ำหนัก'), caseOpts(), v.case)}${wf('P', T('Force after losses P (kN)', 'แรงหลังสูญเสีย P (kN)'), v.P, 'n')}</div>${ws('prof', T('Profile', 'รูปทรง'), [['span', T('One parabola over the whole selected chain (e at ends, e at middle)', 'พาราโบลาเดียวตลอดชิ้นส่วนที่เลือก')], ['each', T('Same e1 / e_mid / e2 on every selected element', 'e1 / e_กลาง / e2 เท่ากันทุกชิ้น')]], v.prof)}<div class="an-row3">${wf('e1', 'e₁ (mm)', v.e1, 'n')}${wf('em', T('e at middle (mm)', 'e กลาง (mm)'), v.em, 'n')}${wf('e2', 'e₂ (mm)', v.e2, 'n')}</div>` + wfoot(T('Apply tendon', 'ใส่แรงอัด')),
        add: v => { if (!A.sel.m.length) { toast(T('Select the elements of the tendon first.', 'เลือกชิ้นส่วนของลวดก่อน'), 'bad'); return; } if (!(+v.P)) { toast(T('Enter the tendon force.', 'ใส่แรงในลวด'), 'bad'); return; } const m = A.model, ids = v.prof === 'span' ? chainOf(A.sel.m) : A.sel.m; if (!ids) { toast(T('The selection is not one connected chain.', 'ชิ้นส่วนที่เลือกไม่ต่อเนื่องกัน'), 'bad'); return; }
          snap(true); const nd = nodeMap(), Ls = ids.map(id => { const q = m.members.find(z => z.id === id); return Math.hypot(...sub(P3(nd[q.j]), P3(nd[q.i]))); }), Lt = Ls.reduce((a, b) => a + b, 0), e1 = +v.e1 || 0, e2 = +v.e2 || 0, em = +v.em || 0, e = x => e1 + (e2 - e1) * x / Lt + 4 * (em - (e1 + e2) / 2) * x * (Lt - x) / (Lt * Lt);
          let s0 = 0, at = null; ids.forEach((id, k) => { const q = m.members.find(z => z.id === id); let rev; if (k === 0) { const nx = ids[1] && m.members.find(z => z.id === ids[1]); rev = !!(nx && (q.i === nx.i || q.i === nx.j) && !(q.j === nx.i || q.j === nx.j)); } else rev = q.j === at; at = rev ? q.i : q.j; const a = s0, b2 = s0 + Ls[k], ea = v.prof === 'span' ? e(a) : e1, eb = v.prof === 'span' ? e(b2) : e2, ec = v.prof === 'span' ? e((a + b2) / 2) : em; m.loads.push({ case: v.case, kind: 'pres', member: id, P: +v.P, e1: r4(rev ? eb : ea), em: r4(ec), e2: r4(rev ? ea : eb) }); s0 = b2; });
          A.lcase = v.case; changed(true); toast(T('Tendon applied to ' + ids.length + ' element(s) in ' + v.case, 'ใส่แรงอัดให้ ' + ids.length + ' ชิ้นส่วน ในกรณี ' + v.case), 'ok'); } },
      bset: { t: () => T('Support settlement', 'การทรุดตัวของจุดรองรับ'), def: () => ({ case: '', dz: -10, dx: 0, dy: 0 }),
        body: v => selInfo() + hint(T('Imposed displacement of the selected supports (only restrained directions move). Downward settlement is negative Z.', 'การเคลื่อนตัวที่กำหนดของจุดรองรับที่เลือก (เฉพาะทิศที่ยึดไว้) การทรุดลงเป็น Z ลบ')) +
          `${ws('case', T('Load case', 'กรณีน้ำหนัก'), [['', T('— new case "SET" —', '— กรณีใหม่ "SET" —')]].concat(caseOpts()), v.case)}<div class="an-row3">${['dx', 'dy', 'dz'].map(q => wf(q, q + ul('d'), v[q], 'n')).join('')}</div>` + wfoot(T('Apply settlement', 'ใส่การทรุดตัว')),
        add: v => { if (!A.sel.n.length) { toast(T('Select the support nodes first.', 'เลือกจุดรองรับก่อน'), 'bad'); return; } snap(true); const m = A.model; let cs = v.case; if (!cs) { cs = m.cases.some(c => c.id === 'SET') ? 'SET' : 'SET'; if (!m.cases.some(c => c.id === cs)) m.cases.push(CASE(cs, 'O', false, 'Support settlement', 'การทรุดตัวของจุดรองรับ')); v.case = cs; }
          A.sel.n.forEach(id => m.loads.push({ case: cs, kind: 'settle', node: id, dx: frU(+v.dx || 0, 'd'), dy: frU(+v.dy || 0, 'd'), dz: frU(+v.dz || 0, 'd') })); A.lcase = cs; changed(true); toast(T('Settlement applied to ' + A.sel.n.length + ' node(s) in ' + cs, 'ใส่การทรุดตัว ' + A.sel.n.length + ' จุด ในกรณี ' + cs), 'ok'); } },
      bcomb: { t: () => T('Bridge combinations', 'การรวมน้ำหนักสะพาน'), body: () => { const b = BRD(), m = A.model; return hint(T('Static cases are added with their factors; moving-load envelopes are added on the adverse side at every point (max with max, min with min). A stage result can be the permanent part.', 'กรณีสถิตรวมตามตัวคูณ ผลน้ำหนักเคลื่อนที่รวมด้านที่รุนแรงทุกจุด (สูงสุดกับสูงสุด ต่ำสุดกับต่ำสุด) ใช้ผลขั้นตอนก่อสร้างเป็นส่วนถาวรได้')) +
        b.bcombos.map((c, i) => `<div class="an-blk"><div class="an-row3">${fld('ID', bf('bcombos.' + i + '.id', c.id))}${fld(T('Name', 'ชื่อ'), bf('bcombos.' + i + '.name', c.name))}${fld(T('Type', 'ชนิด'), bsel('bcombos.' + i + '.type', [['ULS', 'ULS'], ['SLS', 'SLS']], c.type))}</div>
          <div class="an-row4">${m.cases.map(cs => fld(esc(cs.id) + ' ×', bf('bcombos.' + i + '.f.' + cs.id, (c.f || {})[cs.id] || '', 'type="number" step="any"'))).join('')}${b.mlc.map(ml => fld('<b>' + esc(ml.id) + '</b> ×', bf('bcombos.' + i + '.ml.' + ml.id, (c.ml || {})[ml.id] || '', 'type="number" step="any"'))).join('')}</div>
          <div class="an-row3">${fld(T('Plus stage result', 'บวกผลขั้นตอน'), bsel('bcombos.' + i + '.stage', [['', '—']].concat(b.stages.map(s => [s.id, s.id + ' — ' + s.name])), c.stage || ''))}<span></span><span class="an-f"><span>&nbsp;</span><button class="btn btn-ghost xs" data-act="an-rb" data-c="bdel" data-v="bcombos:${i}">${T('Delete', 'ลบ')}</button></span></div></div>`).join('') + wfoot(T('Add combination', 'เพิ่มการรวม')); },
        add: () => { snap(true); const b = BRD(); b.bcombos.push({ id: nextId(b.bcombos, 'BC'), name: T('Combination ', 'การรวม ') + (b.bcombos.length + 1), type: 'ULS', f: { G: 1 }, ml: b.mlc[0] ? { [b.mlc[0].id]: 1 } : {} }); changed(false); ribRefresh(); } },
      bil: { t: () => T('Influence lines', 'เส้นอิทธิพล'), body: () => { const b = BRD(), tg = A.ilT || defaultIL() || { k: 'm', mem: '', comp: 'Mz', pt: 0 }, d = ilData();
        const memO = A.model.members.map(q => [q.id, q.id]), nodeO = A.model.nodes.filter(n => F.fixOf(n).some(Boolean)).map(n => [n.id, n.id]);
        return `<div class="an-row3">${fld(T('Lane', 'ช่องจราจร'), sel(b.lanes.map(l => [l.id, l.id + ' — ' + (l.name || '')]), A.ilLane || (b.lanes[0] || {}).id, 'id="an-illane"'))}${fld(T('Result', 'ผลลัพธ์'), sel([['m', T('Element force', 'แรงในชิ้นส่วน')], ['r', T('Support reaction', 'แรงปฏิกิริยา')]], tg.k, 'id="an-ilk"'))}${tg.k === 'r' ? fld(T('Node', 'จุดต่อ'), sel(nodeO, tg.node, 'id="an-ilnode"')) : fld(T('Element', 'ชิ้นส่วน'), sel(memO, tg.mem, 'id="an-ilmem"'))}</div>
          <div class="an-row3">${tg.k === 'r' ? fld(T('Component', 'องค์ประกอบ'), sel(['Rx', 'Ry', 'Rz', 'Mx', 'My', 'Mz'].map((q, i) => [i, q]), +tg.dof || 2, 'id="an-ildof"')) : fld(T('Component', 'องค์ประกอบ'), sel([['Mz', 'M_z'], ['Vy', 'V_y'], ['N', 'N'], ['My', 'M_y'], ['Vz', 'V_z'], ['T', 'T'], ['dz', T('deflection d_z', 'การโก่ง d_z')]], tg.comp, 'id="an-ilcomp"')) + fld(T('Position along element', 'ตำแหน่งบนชิ้นส่วน'), sel(Array.from({ length: 11 }, (_, i) => [i, (i / 10).toFixed(1) + ' L']), +tg.pt || 0, 'id="an-ilpt"'))}<span class="an-f"><span>&nbsp;</span><button class="btn btn-ghost xs" data-act="an-rb" data-c="ilpick">${T('Use selected', 'ใช้ที่เลือก')}</button></span></div>` +
          (d ? ilChart(d) : hint(T('Define a lane and run the analysis.', 'กำหนดช่องจราจรแล้ววิเคราะห์'))) + wfoot('', `<button class="btn btn-hot sm" data-act="an-rb" data-c="ilshow">${T('Show on the model', 'แสดงบนแบบจำลอง')}</button>`); } }
    });
    WIDE.push('blanes', 'bveh', 'bmlc', 'bstg', 'bcomb', 'bil');
    // commands of the bridge tab (called from ribCmd)
    function bridgeCmd(c, v) {
      const b = BRD();
      switch (c) {
        case 'blanes': case 'bveh': case 'bmlc': case 'bstg': case 'bpres': case 'bset': case 'bcomb': openWin(c); return true;
        case 'bil': A.ilT = A.ilT || defaultIL(); openWin('bil'); return true;
        case 'ilshow': if (!needRes()) return true; A.step = 'res'; A.rview = 'il'; A.drawerMin = true; A.win = null; ctx.render(); return true;
        case 'ilpick': if (A.sel.m.length) A.ilT = Object.assign({}, A.ilT || defaultIL() || {}, { k: 'm', mem: A.sel.m[0] }); else if (A.sel.n.length) A.ilT = { k: 'r', node: A.sel.n[0], dof: 2 }; winRefresh(); redraw(); return true;
        case 'lanesel': { const [i, w] = String(v).split(':'), l = b.lanes[+i]; if (!l) return true; if (w === 'x') { snap(true); l.b = null; l.w = 0; changed(true); winRefresh(); return true; } const ids = chainOf(A.sel.m); if (!ids || !ids.length) { toast(T('Select a connected chain of elements first.', 'เลือกชิ้นส่วนที่ต่อกันก่อน'), 'bad'); return true; } snap(true); l[w] = ids; if (w === 'b' && !(+l.w)) l.w = 0.5; changed(true); winRefresh(); return true; }
        case 'stgsel': { const st = b.stages[+v]; if (!st) return true; if (!A.sel.m.length) { toast(T('Select elements first.', 'เลือกชิ้นส่วนก่อน'), 'bad'); return true; } snap(true); st.mems = A.sel.m.slice(); changed(false); winRefresh(); return true; }
        case 'stgshow': { const st = b.stages[+v]; if (!st) return true; A.sel = { n: [], m: (st.mems || []).slice() }; selChanged(); return true; }
        case 'bdel': { const [k, i] = String(v).split(':'); if (!b[k] || !b[k][+i]) return true; snap(true); b[k].splice(+i, 1); changed(true); winRefresh(); ribRefresh(); return true; }
      }
      return false;
    }
    // inputs inside bridge windows: data-bf="path.to.value", data-bfl="path.to.list" (checkbox list)
    function bridgeInput(t) {
      const b = BRD();
      if (t.dataset.bfl) { const ps = t.dataset.bfl.split('.'); let o = b; for (let i = 0; i < ps.length - 1; i++) o = o[ps[i]]; const k = ps[ps.length - 1], list = new Set(o[k] || []); if (t.checked) list.add(t.value); else list.delete(t.value); snap(); o[k] = [...list]; changed(false); return true; }
      if (!t.dataset.bf) return false;
      const ps = t.dataset.bf.split('.'); let o = b; for (let i = 0; i < ps.length - 1; i++) { if (o[ps[i]] == null) o[ps[i]] = {}; o = o[ps[i]]; }
      const k = ps[ps.length - 1], v = t.type === 'checkbox' ? t.checked : t.type === 'number' ? (t.value === '' ? '' : +t.value) : t.value;
      snap(); if ((ps[0] === 'bcombos') && (ps[2] === 'f' || ps[2] === 'ml') && (v === '' || v === 0)) delete o[k]; else o[k] = v;
      changed(false); if (ps[0] === 'mlc' && k === 'code') winRefresh(); if (k === 'id' || k === 'name') ribRefresh(); return true;
    }
    function ilInput(t) {
      const id = t.id; if (!/^an-il/.test(id)) return false;
      const tg = Object.assign({}, A.ilT || defaultIL() || { k: 'm', comp: 'Mz', pt: 0 });
      if (id === 'an-illane') A.ilLane = t.value; else if (id === 'an-ilk') { if (t.value === 'r') { const n = A.model.nodes.find(z => F.fixOf(z).some(Boolean)); A.ilT = { k: 'r', node: n ? n.id : '', dof: 2 }; } else A.ilT = defaultIL(); winRefresh(); redraw(); return true; }
      else if (id === 'an-ilmem') tg.mem = t.value; else if (id === 'an-ilcomp') tg.comp = t.value; else if (id === 'an-ilpt') tg.pt = +t.value; else if (id === 'an-ilnode') tg.node = t.value; else if (id === 'an-ildof') tg.dof = +t.value;
      if (id !== 'an-illane') A.ilT = tg; winRefresh(); redraw(); return true;
    }
    // tree step "Bridge loads" (bridge mode)
    function bridgePanel() {
      const b = BRD(), r = A.bres;
      const row = (c, lbl, n, extra) => `<button class="an-lirow an-pickrow" data-act="an-rb" data-c="${c}"><span class="an-lim">${lbl}</span><span class="an-lis">${extra || ''}</span><span class="an-lit mono">${n}</span></button>`;
      return hint(T('Traffic lanes and vehicles give moving-load envelopes; stages, prestress, settlement and temperature are bridge effects. Everything runs with step 10.', 'ช่องจราจรและยานพาหนะให้ค่าสูงสุด/ต่ำสุดของน้ำหนักเคลื่อนที่ ขั้นตอนก่อสร้าง แรงอัดล่วงหน้า การทรุดตัว และอุณหภูมิเป็นผลเฉพาะสะพาน ทั้งหมดคำนวณเมื่อกดขั้นที่ 10')) +
        `<div class="an-list">${row('blanes', T('Traffic lanes', 'ช่องจราจร'), b.lanes.length, b.lanes.map(l => l.id).join(', '))}${row('bveh', T('Vehicles', 'ยานพาหนะ'), Object.keys(BR.VEH).length + b.vehicles.length)}${row('bmlc', T('Moving load cases', 'กรณีน้ำหนักเคลื่อนที่'), b.mlc.length, b.mlc.map(c => c.id + ': ' + (c.veh || []).join('+')).join(' · '))}${row('bstg', T('Construction stages', 'ขั้นตอนก่อสร้าง'), b.stages.length)}${row('bpres', T('Prestress tendons', 'ลวดอัดแรง'), A.model.loads.filter(l => l.kind === 'pres').length)}${row('bset', T('Support settlements', 'การทรุดตัว'), A.model.loads.filter(l => l.kind === 'settle').length)}${row('bcomb', T('Bridge combinations', 'การรวมน้ำหนักสะพาน'), b.bcombos.length)}${row('bil', T('Influence lines', 'เส้นอิทธิพล'), '›')}</div>` +
        (r && fresh() ? `<p class="muted small">${T('Bridge analysis: ', 'การวิเคราะห์สะพาน: ')}${Object.keys(r.ml).length} ${T('moving-load envelope(s)', 'ผลน้ำหนักเคลื่อนที่')}, ${r.st.length} ${T('stage(s)', 'ขั้นตอน')} · ${r.ms} ms</p>` : '');
    }

    // ================================================================== building module (grids, stories, floors, wind) and quantity take-off (all modes)
    const BDATA = () => BD.bld(A.model);
    const isBTool = t => t === 'bcol' || t === 'bbeam' || t === 'bslab';
    const storyList = () => BD.stories(A.model);
    const curStory = () => { const st = storyList(); return st.find(s => s.id === A.story) || st[st.length - 1] || null; };
    const storyOfZ = z => storyList().find(s => Math.abs(s.z - z) < 1e-3) || null;
    function goStory(id) { const s = storyList().find(q => q.id === id); if (!s) return; A.story = s.id; if (A.cam.v !== 'plan') { camPush(); setView('plan'); } A.cut = s.z; A.cam.k = null; ctx.render(); }
    function stepStory(d) { const st = storyList(), cs = curStory(); if (!cs) return; const k = Math.max(1, Math.min(st.length - 1, st.indexOf(cs) + d)); goStory(st[k].id); }
    // stories a drawing action applies to: this one, the ones of the same height, or all
    function targetStories() {
      const st = storyList(), cs = A.cam.v === 'plan' && A.cut !== 'all' ? storyOfZ(+A.cut) || curStory() : curStory(); if (!cs) return [];
      const k = st.indexOf(cs), h = k > 0 ? cs.z - st[k - 1].z : 0;
      if (A.simMode === 'all') return st.slice(1);
      if (A.simMode === 'sim') return st.filter((s, i) => i > 0 && Math.abs((s.z - st[i - 1].z) - h) < 1e-3);
      return k > 0 ? [cs] : [];
    }
    const gxs = () => BDATA().gx.slice().sort((a, b) => a.x - b.x), gys = () => BDATA().gy.slice().sort((a, b) => a.y - b.y);
    // snapping in plan: grid intersection › node on this level › grid line › snap step
    function gridSnap(x, y, W, H) {
      const b = BDATA(), cs = curStory(), z = A.cut === 'all' ? (cs ? cs.z : 0) : +A.cut, w = screenToWorld(x, y, W, H), tol = 14 / (A.cam.k || 1);
      let best = null, bd = tol;
      b.gx.forEach(gx => b.gy.forEach(gy => { const d = Math.hypot(w[0] - gx.x, w[1] - gy.y); if (d < bd) { bd = d; best = { p: [gx.x, gy.y, z], kind: 'int', lab: gx.id + '–' + gy.id }; } }));
      if (best) return best;
      A.model.nodes.forEach(n => { if (Math.abs((+n.z || 0) - z) > 1e-3) return; const d = Math.hypot(w[0] - n.x, w[1] - n.y); if (d < bd) { bd = d; best = { p: [+n.x, +n.y, z], kind: 'node', lab: n.id }; } });
      if (best) return best;
      const sn = +A.opt.snap > 0 ? +A.opt.snap : 0, rs = v => r4(sn ? Math.round(v / sn) * sn : v);
      b.gx.forEach(g => { const d = Math.abs(w[0] - g.x); if (d < bd) { bd = d; best = { p: [g.x, rs(w[1]), z], kind: 'line', lab: g.id }; } });
      b.gy.forEach(g => { const d = Math.abs(w[1] - g.y); if (d < bd) { bd = d; best = { p: [rs(w[0]), g.y, z], kind: 'line', lab: g.id }; } });
      return best || { p: [rs(w[0]), rs(w[1]), z], kind: 'free', lab: '' };
    }
    function bayAt(wx, wy) {
      const X = gxs(), Y = gys(); let i = -1, j = -1;
      for (let k = 0; k + 1 < X.length; k++) if (wx >= X[k].x && wx <= X[k + 1].x) { i = k; break; }
      for (let k = 0; k + 1 < Y.length; k++) if (wy >= Y[k].y && wy <= Y[k + 1].y) { j = k; break; }
      return i < 0 || j < 0 ? null : { x0: X[i].x, x1: X[i + 1].x, y0: Y[j].y, y1: Y[j + 1].y, lab: X[i].id + '–' + X[i + 1].id + ' / ' + Y[j].id + '–' + Y[j + 1].id };
    }
    const slabLabel = s => { const X = gxs(), Y = gys(), gl = (arr, k, v) => (arr.find(g => Math.abs(g[k] - v) < 1e-3) || {}).id; const a = gl(X, 'x', s.x0), c = gl(X, 'x', s.x1), d = gl(Y, 'y', s.y0), e = gl(Y, 'y', s.y1); return a && c && d && e ? a + '–' + c + ' / ' + d + '–' + e : fu(s.x0, 'L', 1) + '…' + fu(s.x1, 'L', 1) + ' × ' + fu(s.y0, 'L', 1) + '…' + fu(s.y1, 'L', 1); };
    const matFor = secId => { const s = A.model.sections.find(q => q.id === secId), steel = s && (s.type === 'std' || s.type === 'tube' || s.type === 'I'), m = A.model; return ((steel ? m.materials.find(t => t.kind === 'steel') : m.materials.find(t => t.kind === 'conc')) || m.materials[0] || {}).id || ''; };
    // a beam from a to b at level z, split at the nodes already on the line
    function addBeamLine(a, c, z, tpl) {
      const L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 1e-3) return 0;
      const on = A.model.nodes.filter(n => Math.abs((+n.z || 0) - z) < 1e-3).map(n => { const t = ((n.x - a[0]) * (c[0] - a[0]) + (n.y - a[1]) * (c[1] - a[1])) / (L * L), d = Math.abs((n.x - a[0]) * (c[1] - a[1]) - (n.y - a[1]) * (c[0] - a[0])) / L; return { n, t, d }; }).filter(q => q.d < 1e-3 && q.t > 1e-6 && q.t < 1 - 1e-6).sort((p, q) => p.t - q.t);
      const ids = [ensureNode([a[0], a[1], z])].concat(on.map(q => q.n.id), [ensureNode([c[0], c[1], z])]); let n = 0;
      for (let k = 0; k + 1 < ids.length; k++) if (addMember(ids[k], ids[k + 1], tpl)) n++;
      return n;
    }
    function addColumnAt(x, y, k, tpl) { const st = storyList(), i = ensureNode([x, y, st[k - 1].z]), j = ensureNode([x, y, st[k].z]); if (k - 1 === 0) { const nb = A.model.nodes.find(q => q.id === i); if (nb && nb.sup === 'free') nb.sup = 'fixed'; } return addMember(i, j, tpl) ? 1 : 0; }
    function bNote(msg) { A.bmsg = msg; const hb = $('#anHint'); if (hb) hb.textContent = hintBar(); }
    function bldClick(x, y, W, H) {
      const cs = curStory();
      if (!cs) { toast(T('Define the stories first (Building › Stories).', 'กำหนดชั้นก่อน (อาคาร › ชั้น)'), 'bad'); return; }
      if (A.cam.v !== 'plan') { toast(T('Drawing works in a story plan — switched to ', 'การวาดทำในแปลนชั้น — เปลี่ยนเป็น ') + cs.id, ''); goStory(cs.id); return; }
      const sp = gridSnap(x, y, W, H), tg = targetStories(), b = BDATA(), st = storyList();
      if (!tg.length) { toast(T('Pick a story above the base (PageUp / PageDown).', 'เลือกชั้นที่อยู่เหนือฐาน (PageUp / PageDown)'), 'bad'); return; }
      if (A.tool === 'bcol') {
        snap(true); const tpl = { sec: b.dsec.col, mat: matFor(b.dsec.col), type: 'frame' }; let n = 0; tg.forEach(s => { n += addColumnAt(sp.p[0], sp.p[1], st.indexOf(s), tpl); });
        changed(true); bNote(n ? '✓ ' + n + T(' column(s) at ', ' เสา ที่ ') + (sp.lab || fu(sp.p[0], 'L', 2) + ', ' + fu(sp.p[1], 'L', 2)) : T('Already there', 'มีอยู่แล้ว')); return;
      }
      if (A.tool === 'bbeam') {
        if (!A.drawP) { A.drawP = sp.p; redraw(); return; }
        const a = A.drawP; if (Math.hypot(a[0] - sp.p[0], a[1] - sp.p[1]) < 1e-3) return;
        snap(true); const tpl = { sec: b.dsec.beam, mat: matFor(b.dsec.beam), type: 'frame' }; let n = 0; tg.forEach(s => { n += addBeamLine(a, sp.p, s.z, tpl); });
        A.drawP = sp.p; changed(true); bNote(n ? '✓ ' + n + T(' beam(s) on ', ' คาน บน ') + tg.length + T(' story(s)', ' ชั้น') : T('Already there', 'มีอยู่แล้ว')); return;
      }
      if (A.tool === 'bslab') {
        const w = screenToWorld(x, y, W, H), bay = bayAt(w[0], w[1]); if (!bay) { toast(T('Click inside a grid bay.', 'คลิกภายในช่องกริด'), ''); return; }
        snap(true); const same = s => Math.abs(s.x0 - bay.x0) < 1e-3 && Math.abs(s.x1 - bay.x1) < 1e-3 && Math.abs(s.y0 - bay.y0) < 1e-3 && Math.abs(s.y1 - bay.y1) < 1e-3;
        const here = b.slabs.find(s => s.st === cs.id && same(s)), sp2 = b.slabP || { t: 150, sdl: 1.5, ll: 3 };
        let n = 0;
        if (here) { const ids = new Set(tg.map(s => s.id)); const before = b.slabs.length; b.slabs = b.slabs.filter(s => !(ids.has(s.st) && same(s))); n = before - b.slabs.length; bNote('✓ ' + n + T(' slab(s) removed', ' แผ่นพื้นถูกลบ')); }
        else { tg.forEach(s => { if (b.slabs.some(q => q.st === s.id && same(q))) return; b.slabs.push({ id: nextId(b.slabs, 'S'), st: s.id, x0: bay.x0, x1: bay.x1, y0: bay.y0, y1: bay.y1, t: +sp2.t || 150, sdl: +sp2.sdl || 0, ll: +sp2.ll || 0, way: b.floor.way || 'auto' }); n++; }); bNote('✓ ' + n + T(' slab(s) in bay ', ' แผ่นพื้นในช่อง ') + bay.lab); }
        changed(true); ribRefresh(); return;
      }
    }
    // auto-frame: columns at every grid intersection / beams on every grid line / slabs in every bay, on the target stories
    function autoFrame(what) {
      const tg = targetStories(), b = BDATA(), st = storyList(), X = gxs(), Y = gys(); if (!tg.length || X.length < 1 || Y.length < 1) { toast(T('Define grids and stories first.', 'กำหนดกริดและชั้นก่อน'), 'bad'); return; }
      snap(true); let n = 0;
      if (what === 'col') { const tpl = { sec: b.dsec.col, mat: matFor(b.dsec.col), type: 'frame' }; tg.forEach(s => X.forEach(gx => Y.forEach(gy => { n += addColumnAt(gx.x, gy.y, st.indexOf(s), tpl); }))); }
      if (what === 'beam') { const tpl = { sec: b.dsec.beam, mat: matFor(b.dsec.beam), type: 'frame' }; tg.forEach(s => { Y.forEach(gy => { for (let i = 0; i + 1 < X.length; i++) n += addBeamLine([X[i].x, gy.y], [X[i + 1].x, gy.y], s.z, tpl); }); X.forEach(gx => { for (let j = 0; j + 1 < Y.length; j++) n += addBeamLine([gx.x, Y[j].y], [gx.x, Y[j + 1].y], s.z, tpl); }); }); }
      if (what === 'slab') { const sp2 = b.slabP || { t: 150, sdl: 1.5, ll: 3 }; tg.forEach(s => { for (let i = 0; i + 1 < X.length; i++) for (let j = 0; j + 1 < Y.length; j++) { const r = { x0: X[i].x, x1: X[i + 1].x, y0: Y[j].y, y1: Y[j + 1].y }; if (b.slabs.some(q => q.st === s.id && Math.abs(q.x0 - r.x0) < 1e-3 && Math.abs(q.y0 - r.y0) < 1e-3 && Math.abs(q.x1 - r.x1) < 1e-3 && Math.abs(q.y1 - r.y1) < 1e-3)) continue; b.slabs.push(Object.assign({ id: nextId(b.slabs, 'S'), st: s.id, t: +sp2.t || 150, sdl: +sp2.sdl || 0, ll: +sp2.ll || 0, way: b.floor.way || 'auto' }, r)); n++; } }); }
      changed(true); ribRefresh();
      toast(n + ' ' + ({ col: T('column(s)', 'เสา'), beam: T('beam(s)', 'คาน'), slab: T('slab(s)', 'แผ่นพื้น') }[what]) + T(' added on ', ' เพิ่มบน ') + tg.length + T(' story(s)', ' ชั้น'), n ? 'ok' : '');
    }
    // ---- drawing (called from render): grids with bubbles, story lines, slabs, tool preview
    function drawBld(o) {
      const { g, P, pal, line, text, rep, W, H } = o, m = A.model, b = m.bld; if (!b) return;
      const v = A.cam.v, st = storyList(), X = gxs(), Y = gys(), xsN = m.nodes.map(n => +n.x || 0), ysN = m.nodes.map(n => +n.y || 0);
      const x0 = Math.min(...X.map(q => q.x), ...xsN), x1 = Math.max(...X.map(q => q.x), ...xsN), y0 = Math.min(...Y.map(q => q.y), ...ysN), y1 = Math.max(...Y.map(q => q.y), ...ysN), z0 = st.length ? st[0].z : 0, z1 = st.length ? st[st.length - 1].z : 0;
      const pad = Math.max(1.2, 0.07 * Math.max(x1 - x0, y1 - y0, z1 - z0, 1)), bub = (p, lab) => { g.beginPath(); g.arc(p[0], p[1], 9, 0, 2 * PI); g.fillStyle = pal.bg; g.fill(); g.strokeStyle = pal.muted; g.lineWidth = 1.2; g.stroke(); g.font = '600 10px system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = pal.ink; g.fillText(lab, p[0], p[1] + 3.5); g.textAlign = 'left'; };
      const ext = (a, bb, pp) => { const d = [pp[0] - a[0], pp[1] - a[1]], L = Math.hypot(d[0], d[1]) || 1; return [pp[0] + d[0] / L * 12, pp[1] + d[1] / L * 12]; };
      if (o.stage === 'grid' && (rep || A.grid !== false)) {
        g.save();
        if (v === 'xz' || v === 'yz') {
          const G2 = v === 'xz' ? X.map(q => [q.x, q.id]) : Y.map(q => [q.y, q.id]), c = v === 'xz' ? (A.cut === 'all' ? y0 : +A.cut) : (A.cut === 'all' ? x0 : +A.cut), pt = (s, z) => (v === 'xz' ? P([s, c, z]) : P([c, s, z]));
          G2.forEach(([s, id]) => { const a = pt(s, z0 - pad * 0.4), e = pt(s, z1 + pad); line(a, e, pal.grid, 1, [6, 4]); bub(ext(a, e, e), id); });
          const smin = Math.min(...G2.map(q => q[0]), v === 'xz' ? x0 : y0), smax = Math.max(...G2.map(q => q[0]), v === 'xz' ? x1 : y1);
          st.forEach(s => { const a = pt(smin - pad, s.z), e = pt(smax + pad * 0.3, s.z); line(a, e, pal.grid, 1, [2, 4]); text(s.id + '  ' + fu(s.z, 'L', 2), a[0] - 4, a[1] - 4, pal.muted, { align: 'right', font: '10.5px system-ui, sans-serif' }); });
        } else {
          const zz = v === 'plan' && A.cut !== 'all' ? +A.cut : z0;
          X.forEach(q => { const a = P([q.x, y0 - pad, zz]), e = P([q.x, y1 + pad * 0.4, zz]); line(a, e, pal.grid, 1, [6, 4]); bub(ext(e, a, a), q.id); });
          Y.forEach(q => { const a = P([x0 - pad, q.y, zz]), e = P([x1 + pad * 0.4, q.y, zz]); line(a, e, pal.grid, 1, [6, 4]); bub(ext(e, a, a), q.id); });
          if (v === 'plan' && A.cut !== 'all') { const s = storyOfZ(+A.cut); if (s) text(T('Story ', 'ชั้น ') + s.id + ' · ' + fu(s.z, 'L', 2) + ul('L'), 14, H - 54, pal.muted, { font: '600 12px system-ui, sans-serif' }); }
        }
        g.restore();
      }
      if (o.stage === 'slabs' && A.showSlabs !== false && b.slabs.length) {
        const planZ = v === 'plan' && A.cut !== 'all' ? +A.cut : null, elev = v === 'xz' || v === 'yz';
        g.save();
        b.slabs.forEach(s => {
          const ss = st.find(q => q.id === s.st); if (!ss) return; if (planZ !== null && Math.abs(ss.z - planZ) > 1e-3) return;
          const c = [[s.x0, s.y0], [s.x1, s.y0], [s.x1, s.y1], [s.x0, s.y1]].map(q => P([q[0], q[1], ss.z]));
          if (elev) return;
          g.beginPath(); c.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath();
          const hot = A.hoverSlab === s.id; g.globalAlpha = hot ? 0.3 : planZ !== null ? 0.16 : 0.07; g.fillStyle = hot ? pal.acc : pal.teal; g.fill(); g.globalAlpha = 1;
          if (planZ !== null && !rep) { const cx = (c[0][0] + c[2][0]) / 2, cy = (c[0][1] + c[2][1]) / 2, way = BD.slabWay(s); text(s.id, cx - 8, cy - 2, pal.teal, { font: '600 10.5px system-ui, sans-serif' }); text((+s.t || 0) + ' · ' + (way === 'two' ? '⤧' : way === 'oneX' ? '↔' : '↕'), cx - 8, cy + 11, pal.muted, { font: '10px system-ui, sans-serif' }); }
        });
        g.restore();
      }
      if (o.stage === 'tool' && !rep && isBTool(A.tool) && A.mouse && v === 'plan') {
        const sp = gridSnap(A.mouse[0], A.mouse[1], W, H), q = P(sp.p);
        if (A.tool === 'bslab') { const w = screenToWorld(A.mouse[0], A.mouse[1], W, H), bay = bayAt(w[0], w[1]); if (bay) { const z = sp.p[2], c = [[bay.x0, bay.y0], [bay.x1, bay.y0], [bay.x1, bay.y1], [bay.x0, bay.y1]].map(r => P([r[0], r[1], z])); g.beginPath(); c.forEach((r, i) => (i ? g.lineTo(r[0], r[1]) : g.moveTo(r[0], r[1]))); g.closePath(); g.globalAlpha = 0.18; g.fillStyle = pal.acc; g.fill(); g.globalAlpha = 1; g.strokeStyle = pal.acc; g.lineWidth = 1.5; g.stroke(); text(bay.lab, c[3][0] + 6, c[3][1] + 16, pal.acc, { font: '600 11px system-ui, sans-serif' }); } return; }
        if (A.tool === 'bbeam' && A.drawP) line(P(A.drawP), q, pal.acc, 2, [6, 4]);
        g.strokeStyle = pal.acc; g.lineWidth = 1.6; if (sp.kind === 'int' || sp.kind === 'node') { g.strokeRect(q[0] - 6, q[1] - 6, 12, 12); } else { g.beginPath(); g.arc(q[0], q[1], 5, 0, 2 * PI); g.stroke(); }
        if (A.tool === 'bcol') { g.fillStyle = pal.acc; g.globalAlpha = 0.35; g.fillRect(q[0] - 5, q[1] - 5, 10, 10); g.globalAlpha = 1; }
        if (sp.lab) text(sp.lab, q[0] + 10, q[1] - 8, pal.acc, { font: '600 11px system-ui, sans-serif' });
      }
    }
    // floor loads shown on the slabs (case lc)
    function drawSlabLoads(o, lc) {
      const { P, text, pal, g } = o, b = A.model.bld; if (!b || !b.slabs.length) return;
      const st = storyList(), swc = (A.model.cases.find(c => c.sw) || {}).id, rho = BD.slabRho ? 0 : 0;
      const planZ = A.cam.v === 'plan' && A.cut !== 'all' ? +A.cut : null, many = planZ === null && b.slabs.length > 6;
      b.slabs.forEach(s => {
        const ss = st.find(q => q.id === s.st); if (!ss || (planZ !== null && Math.abs(ss.z - planZ) > 1e-3)) return;
        const parts = []; if ((lc === 'all' || lc === b.floor.dl) && +s.sdl) parts.push((lc === 'all' ? b.floor.dl + ' ' : '') + fu(+s.sdl, 'p', 2)); if ((lc === 'all' || lc === b.floor.ll) && +s.ll) parts.push((lc === 'all' ? b.floor.ll + ' ' : '') + fu(+s.ll, 'p', 2)); if (b.floor.sw && (lc === 'all' || lc === swc) && +s.t) parts.push(T('slab ', 'พื้น ') + (+s.t) + ' mm');
        if (!parts.length) return;
        const c = [[s.x0, s.y0], [s.x1, s.y0], [s.x1, s.y1], [s.x0, s.y1]].map(q => P([q[0], q[1], ss.z]));
        g.save(); g.beginPath(); c.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.globalAlpha = 0.14; g.fillStyle = caseCol(pal, lc === 'all' ? b.floor.dl : lc); g.fill(); g.restore();
        if (many) return; const cx = (c[0][0] + c[2][0]) / 2, cy = (c[0][1] + c[2][1]) / 2;
        text(parts.join(' · ') + (parts.length ? '' : ''), cx - 30, cy + (planZ !== null ? 24 : 4), caseCol(pal, lc === 'all' ? b.floor.dl : lc), { font: '10.5px ui-monospace, monospace' });
      });
      if (A.model.loads.some(l => l.gen === 'slab' && (lc === 'all' || l.case === lc))) o.notes.push(T('Floor loads (kPa) are spread to the beams by tributary area — see Building › Floor Loads.', 'น้ำหนักบนพื้น (kPa) ถ่ายลงคานตามพื้นที่รับน้ำหนัก — ดู อาคาร › น้ำหนักบนพื้น'));
    }

    // ---- ribbon tab, menus
    function bldTab() {
      const tool = t => () => A.tool === t, b = BDATA(), cs = curStory(), sm = A.simMode || 'one', secN = id => { const s = A.model.sections.find(q => q.id === id); return s ? s.id : '—'; };
      return ['bldg', T('Building', 'อาคาร'), [
        [T('Templates', 'แม่แบบ'), [B('qt', 'bldg', T('RC Building', 'อาคาร คสล.'), { v: 'rc' }), B('qt', 'shed', T('Steel Building', 'อาคารเหล็ก'), { v: 'steel' }), COL(B('qt', 'column', T('RC Tower', 'อาคารสูง คสล.'), { v: 'tower' }), B('qt', 'grid', T('Grids Only', 'กริดอย่างเดียว'), { v: 'blank' }), B('wizard', 'wand', T('Wizard…', 'กำหนดขนาด…')))]],
        [T('Grid & Story', 'กริดและชั้น'), [B('bgrid', 'grid', T('Grid Lines', 'เส้นกริด') + ' (' + b.gx.length + '×' + b.gy.length + ')'), B('bstory', 'extrude', T('Stories', 'ชั้น') + ' (' + Math.max(0, b.stories.length - 1) + ')'), B('bstm', 'plane', T('Plan: ', 'แปลน: ') + (cs ? cs.id : '—'), { m: 1, on: () => A.cam.v === 'plan' })]],
        [T('Draw on Grid', 'วาดบนกริด'), [B('bcol', 'column', T('Columns', 'เสา'), { on: tool('bcol') }), B('bbeam', 'beam', T('Beams', 'คาน'), { on: tool('bbeam') }), B('bslab', 'slab', T('Slabs', 'แผ่นพื้น'), { on: tool('bslab') }),
          COL(B('bsim', null, T('This story', 'ชั้นนี้'), { v: 'one', radio: 1, on: () => sm === 'one' }), B('bsim', null, T('Similar stories', 'ชั้นสูงเท่ากัน'), { v: 'sim', radio: 1, on: () => sm === 'sim' }), B('bsim', null, T('All stories', 'ทุกชั้น'), { v: 'all', radio: 1, on: () => sm === 'all' })),
          COL(B('bsecc', 'sec', T('Column: ', 'เสา: ') + secN(b.dsec && b.dsec.col), { m: 1 }), B('bsecb', 'sec', T('Beam: ', 'คาน: ') + secN(b.dsec && b.dsec.beam), { m: 1 }), B('bauto', 'wand', T('Auto Frame', 'สร้างอัตโนมัติ'), { m: 1 }))]],
        [T('Floor Loads', 'น้ำหนักบนพื้น'), [B('bfloor', 'udl', T('Floor Loads', 'น้ำหนักบนพื้น') + ' (' + b.slabs.length + ')'), COL(B('bdia', 'plane', T('Rigid Diaphragm', 'ไดอะแฟรมแข็ง'), { on: () => !!BDATA().dia }), B('tog', 'eye', T('Show Slabs', 'แสดงพื้น'), { v: 'showSlabs', on: () => A.showSlabs !== false }))]],
        [T('Wind & Results', 'แรงลมและผล'), [B('bwind', 'wind', T('Wind Loads', 'แรงลม') + ' · ' + ({ AS: 'AS/NZS', EN: 'EN', TH: 'DPT' }[b.wind.code] || ''), { on: () => !!b.wind.on }), COL(B('bstr', 'table', T('Story Results', 'ผลรายชั้น')), B('qto', 'qto', T('Quantity Take-off', 'ถอดปริมาณ'))), B('run', 'play', T('Run', 'วิเคราะห์'))]]
      ]];
    }
    function bldMenu(id) {
      const it = (c, l, v, on) => ({ c, l, v, on }), b = BDATA();
      if (id === 'bstm') return storyList().slice().reverse().map(s => it('bgo', s.id + ' · ' + fu(s.z, 'L', 2) + ul('L'), s.id, A.cam.v === 'plan' && A.cut !== 'all' && Math.abs(+A.cut - s.z) < 1e-3)).concat([{ sep: 1 }, it('initv', T('3D view', 'มุมมอง 3 มิติ'))]);
      if (id === 'bsecc' || id === 'bsecb') { const k = id === 'bsecc' ? 'col' : 'beam'; return A.model.sections.map(s => it('bsec', s.id + ' — ' + (s.name || s.type), k + ':' + s.id, (b.dsec || {})[k] === s.id)).concat([{ sep: 1 }, it('psec', T('New section…', 'หน้าตัดใหม่…'))]); }
      if (id === 'bauto') return [it('bautogo', T('Columns at every grid intersection', 'เสาทุกจุดตัดกริด'), 'col'), it('bautogo', T('Beams on every grid line', 'คานทุกเส้นกริด'), 'beam'), it('bautogo', T('Slabs in every bay', 'แผ่นพื้นทุกช่อง'), 'slab'), { sep: 1 }, { c: 'bsim', l: T('Applies to: ', 'ใช้กับ: ') + ({ one: T('this story', 'ชั้นนี้'), sim: T('similar stories', 'ชั้นสูงเท่ากัน'), all: T('all stories', 'ทุกชั้น') }[A.simMode || 'one']), v: A.simMode || 'one' }];
      return null;
    }
    function bldCmd(c, v) {
      const b = BDATA();
      switch (c) {
        case 'bgrid': case 'bstory': case 'bfloor': case 'bwind': openWin(c); return true;
        case 'bstr': if (!needRes()) return true; openWin('bstr'); return true;
        case 'bgo': goStory(v); return true;
        case 'bcol': case 'bbeam': case 'bslab': { const cs = curStory(); A.bmsg = ''; setTool(A.tool === c ? 'select' : c); A.drawP = null; if (A.tool === c && A.cam.v !== 'plan' && cs) goStory(cs.id); else ribRefresh(); if (A.tool === c && !A._tipShown) A._tipShown = 1, toast({ bcol: T('Click grid intersections to place columns', 'คลิกจุดตัดกริดเพื่อวางเสา'), bbeam: T('Click two points to draw a beam (it splits at nodes on the way)', 'คลิก 2 จุดเพื่อวาดคาน (แบ่งที่จุดต่อระหว่างทาง)'), bslab: T('Click inside a bay to add a slab, click a slab to remove it', 'คลิกในช่องเพื่อเพิ่มแผ่นพื้น คลิกแผ่นพื้นเพื่อลบ') }[c] + T(' · PageUp / PageDown: change story', ' · PageUp / PageDown: เปลี่ยนชั้น'), ''); return true; }
        case 'bsim': A.simMode = v || 'one'; ribRefresh(); toast(T('Drawing applies to: ', 'การวาดใช้กับ: ') + ({ one: T('this story', 'ชั้นนี้'), sim: T('stories of the same height', 'ชั้นที่สูงเท่ากัน'), all: T('all stories', 'ทุกชั้น') }[A.simMode]), ''); return true;
        case 'bsec': { const [k, id] = String(v).split(':'); b.dsec = Object.assign({}, b.dsec, { [k]: id }); persist(); ribRefresh(); return true; }
        case 'bautogo': autoFrame(v); return true;
        case 'bdia': snap(true); b.dia = !b.dia; changed(false); ribRefresh(); toast(b.dia ? T('Rigid floor diaphragms on (stiff in-plane bracing in every slab)', 'เปิดไดอะแฟรมแข็ง (ค้ำยันในระนาบที่แข็งมากในทุกแผ่นพื้น)') : T('Rigid diaphragms off', 'ปิดไดอะแฟรมแข็ง'), ''); return true;
        case 'qto': openWin('qto'); return true;
        case 'qtocsv': qtoCSV(); return true;
        case 'qtab': A.qtab = v; winRefresh(); return true;
        case 'bgadd': { snap(true); const k = v === 'y' ? 'gy' : 'gx', arr = b[k].slice().sort((p, q) => p[k === 'gx' ? 'x' : 'y'] - q[k === 'gx' ? 'x' : 'y']), last = arr[arr.length - 1], prev = arr[arr.length - 2], sp = last && prev ? last[k === 'gx' ? 'x' : 'y'] - prev[k === 'gx' ? 'x' : 'y'] : 6, id = k === 'gx' ? GLAB(b.gx.length) : String(b.gy.length + 1); const o2 = { id: b[k].some(q => q.id === id) ? id + "'" : id }; o2[k === 'gx' ? 'x' : 'y'] = r4((last ? last[k === 'gx' ? 'x' : 'y'] : 0) + (last ? sp : 0)); b[k].push(o2); changed(true); winRefresh(); ribRefresh(); return true; }
        case 'bgdel': { const [k, i] = String(v).split(':'); if (!b[k] || !b[k][+i]) return true; snap(true); b[k].splice(+i, 1); changed(true); winRefresh(); ribRefresh(); return true; }
        case 'bggen': { const w = wdef('bgrid'), xs = cumul(numR(w.sx)), ys = cumul(numR(w.sy)); if (xs.length < 2 || ys.length < 2) { toast(T('Enter the spacings, e.g. 8, 8, 2@6', 'ใส่ระยะ เช่น 8, 8, 2@6'), 'bad'); return true; } snap(true); b.gx = xs.map((x, i) => ({ id: GLAB(i), x: r4(x + (+w.ox || 0)) })); b.gy = ys.map((y, i) => ({ id: String(i + 1), y: r4(y + (+w.oy || 0)) })); changed(true); winRefresh(); ribRefresh(); A.cam.k = null; redraw(); toast(T('Grid lines replaced', 'สร้างเส้นกริดใหม่แล้ว'), 'ok'); return true; }
        case 'bsadd': { const st = storyList(), top = st[st.length - 1]; if (!top) { snap(true); b.stories = [{ id: 'Base', z: 0 }]; changed(true); winRefresh(); return true; } const below = st[st.length - 2], h = +wdef('bstory').h > 0 ? frU(+wdef('bstory').h, 'L') : below ? top.z - below.z : 3.5; snap(true); addStoryAbove(h, !!wdef('bstory').copy); changed(true); winRefresh(); ribRefresh(); A.cam.k = null; redraw(); return true; }
        case 'bsdel': { const st = storyList(), top = st[st.length - 1]; if (!top || st.length < 2) return true; snap(true); const ids = new Set(A.model.nodes.filter(n => Math.abs((+n.z || 0) - top.z) < 1e-3).map(n => n.id)); A.model.members = A.model.members.filter(q => !ids.has(q.i) && !ids.has(q.j)); A.model.nodes = A.model.nodes.filter(n => !ids.has(n.id)); const keepM = new Set(A.model.members.map(q => q.id)); A.model.loads = A.model.loads.filter(l => (l.kind === 'node' || l.kind === 'settle' ? !ids.has(l.node) : keepM.has(l.member))); b.slabs = b.slabs.filter(s => s.st !== top.id); b.stories = b.stories.filter(s => s !== top); if (A.story === top.id) A.story = null; A.sel = { n: [], m: [] }; changed(true); winRefresh(); ribRefresh(); toast(T('Story ', 'ลบชั้น ') + top.id + T(' deleted', ''), ''); return true; }
        case 'bslabdel': { const i = +v; if (!b.slabs[i]) return true; snap(true); b.slabs.splice(i, 1); changed(true); winRefresh(); ribRefresh(); return true; }
        case 'bfapply': { const w = wdef('bfloor'), list = b.slabs.filter(s => w.on === 'all' || s.st === w.on); if (!list.length) { toast(T('No slabs on that story.', 'ไม่มีแผ่นพื้นในชั้นนั้น'), 'bad'); return true; } snap(true); list.forEach(s => { if (w.t !== '') s.t = +w.t; if (w.sdl !== '') s.sdl = frU(+w.sdl, 'p'); if (w.ll !== '') s.ll = frU(+w.ll, 'p'); if (w.way) s.way = w.way; }); b.slabP = { t: w.t !== '' ? +w.t : (b.slabP || {}).t, sdl: w.sdl !== '' ? frU(+w.sdl, 'p') : (b.slabP || {}).sdl, ll: w.ll !== '' ? frU(+w.ll, 'p') : (b.slabP || {}).ll }; changed(true); winRefresh(); toast(T('Applied to ', 'กำหนดให้ ') + list.length + T(' slab(s)', ' แผ่นพื้น'), 'ok'); return true; }
        case 'bwcases': windCases(); return true;
        case 'bshow': A.loadsOn = true; A.lcase = v; syncLshow(); redraw(); ribRefresh(); return true;
      }
      return false;
    }
    // new story on top: optionally a copy of the top story's columns, beams and slabs
    function addStoryAbove(h, copy) {
      const b = BDATA(), st = storyList(), top = st[st.length - 1], below = st[st.length - 2], nz = r4(top.z + h), k = st.length;
      const uniq = id => { let q = id, i = 2; while (b.stories.some(s => s.id === q)) q = id + '-' + i++; return q; };
      let nid = 'L' + k; const roofLL = {};
      if (top.id === 'Roof') { const rn = uniq('L' + (k - 1)); b.slabs.forEach(s => { if (s.st === 'Roof') { roofLL[s.id] = s.ll; s.st = rn; if (b.slabP && b.slabP.ll != null) s.ll = b.slabP.ll; } }); if (A.story === 'Roof') A.story = rn; top.id = rn; nid = 'Roof'; }
      const ns = { id: uniq(nid), z: nz }; b.stories.push(ns);
      if (!copy || !below) return;
      const nd = nodeMap(), tz = top.z, bz = below.z, sel = A.model.members.filter(q => { const a = nd[q.i], c = nd[q.j]; if (!a || !c) return false; const za = +a.z, zc = +c.z; return Math.min(za, zc) >= bz - 1e-3 && Math.max(za, zc) <= tz + 1e-3 && !(Math.abs(za - bz) < 1e-3 && Math.abs(zc - bz) < 1e-3); });
      sel.forEach(q => { const a = nd[q.i], c = nd[q.j], i = ensureNode([+a.x, +a.y, r4(+a.z + h)]), j = ensureNode([+c.x, +c.y, r4(+c.z + h)]); addMember(i, j, q); });
      b.slabs.filter(s => s.st === top.id).map(s => Object.assign({}, s, { st: ns.id, ll: ns.id === 'Roof' && roofLL[s.id] != null ? roofLL[s.id] : s.ll })).forEach(s => { s.id = nextId(b.slabs, 'S'); b.slabs.push(s); });
    }
    // make sure the wind cases exist (and the combinations include them)
    function windCases() {
      const m = A.model, w = BDATA().wind, want = [['X', 1], ['Y', 1], ['X', -1], ['Y', -1]].filter(([d, s]) => w[d] && (s > 0 || w.neg)).map(([d, s]) => [w.cases[d + (s < 0 ? 'N' : '')] || ('W' + d + (s < 0 ? 'N' : '')), d, s]);
      snap(true); let n = 0;
      want.forEach(([id, d, s]) => { if (m.cases.some(c => c.id === id)) return; m.cases.push(CASE(id, 'W', false, 'Wind ' + (s < 0 ? '−' : '+') + d, 'ลม ' + (s < 0 ? '−' : '+') + d)); n++; });
      m.combos = preset(m.code, m.cases); w.on = true; changed(true); winRefresh(); ribRefresh();
      toast((n ? n + T(' wind case(s) added · ', ' กรณีลมใหม่ · ') : '') + T('load combinations regenerated (', 'สร้างการรวมน้ำหนักใหม่ (') + m.combos.length + ')', 'ok');
    }

    // ---- windows
    const bk = (path, v, attrs, w) => inp(v == null ? '' : v, `data-bk="${path}" ${attrs || ''}`, w);
    const bks = (path, opts, v) => sel(opts, v, `data-bk="${path}"`);
    const pv = (v, q, d) => (v === '' || v == null ? '' : Number(toU(+v, q).toFixed(d == null ? 4 : d)));
    function windCalcHTML() {
      const b = BDATA(), w = b.wind; if (!w.on) return hint(T('Automatic wind loads are off.', 'ปิดการคำนวณแรงลมอัตโนมัติ'));
      const out = ['X', 'Y'].filter(d => w[d]).map(d => BD.windCalc(A.model, d)).filter(Boolean); if (!out.length) return hint(T('Needs stories and nodes above the base.', 'ต้องมีชั้นและจุดต่อเหนือฐาน'));
      const missing = [['X', ''], ['Y', ''], ['X', 'N'], ['Y', 'N']].filter(([d, s]) => w[d] && (!s || w.neg)).map(([d, s]) => w.cases[d + s]).filter(id => !A.model.cases.some(c => c.id === id));
      const info = (r, c) => (c === 'EN' ? `q<sub>p</sub>(z<sub>e</sub>=${fu(r.info.ze, 'L', 1)}) ${fu(r.info.qp, 'p', 3)}` : c === 'TH' ? `C<sub>e</sub> ${f(r.info.Ce, 3)}` : `M<sub>z,cat</sub> ${f(r.info.Mz, 3)} · V ${f(r.info.V, 1)} m/s`);
      return (missing.length ? `<p class="notice warn">${T('Load case(s) missing: ', 'ยังไม่มีกรณีน้ำหนัก: ')}${missing.map(esc).join(', ')} — <button class="linkbtn" data-act="an-rb" data-c="bwcases">${T('create them and the combinations', 'สร้างกรณีและการรวมน้ำหนัก')}</button></p>` : '') +
        out.map(c => `<div class="an-blk"><p class="small"><b>${T('Wind ', 'ลม ')}${c.dir}</b> · H ${fu(c.H, 'L', 2)} · B ${fu(c.B, 'L', 2)} · D ${fu(c.D, 'L', 2)}${ul('L')} · C<sub>p</sub> ${f(c.cp[0], 2)} / ${f(c.cp[1], 2)} · ${T('base shear', 'แรงเฉือนที่ฐาน')} <b>${fu(c.base, 'F', 1)}${ul('F')}</b> · ${T('overturning', 'โมเมนต์พลิกคว่ำ')} <b>${fu(c.Mb, 'M', 0)}${ul('M')}</b></p><p class="muted small">${esc(c.note)}</p>` +
          tblw([T('Story', 'ชั้น'), 'z', T('Trib. h', 'ความสูงรับ'), 'B', T('Windward', 'ด้านต้นลม') + ' p', T('Leeward', 'ด้านท้ายลม') + ' p', T('Force', 'แรง') + ' F', T('Shear', 'แรงเฉือน') + ' V', ''], c.rows.slice().reverse().map(r => `<tr><td><b>${esc(r.id)}</b></td><td class="num mono">${fu(r.z, 'L', 2)}</td><td class="num mono">${fu(r.zt - r.zb, 'L', 2)}</td><td class="num mono">${fu(r.B, 'L', 1)}</td><td class="num mono">${fu(r.pw, 'p', 3)}</td><td class="num mono">${fu(r.pl, 'p', 3)}</td><td class="num mono"><b>${fu(r.F, 'F', 2)}</b></td><td class="num mono">${fu(r.V, 'F', 1)}</td><td class="small muted">${r.info ? info(r, w.code) : ''}</td></tr>`).concat([`<tr class="tot"><td colspan="4">${T('units', 'หน่วย')}: ${ulab('L')}, ${ulab('p')}, ${ulab('F')}</td><td></td><td></td><td class="num mono">${fu(c.base, 'F', 1)}</td><td></td><td></td></tr>`]), 'an-wtbl-sm') +
          (c.warn.length ? `<ul class="warn-list">${c.warn.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '') + '</div>').join('') +
        `<p class="muted small">${T('Story forces act on the windward and leeward faces of each floor, shared by the tributary width of each column line. With rigid diaphragms the floor moves as one. Check the code values against the edition your project uses.', 'แรงลมต่อชั้นกระทำที่ด้านต้นลมและท้ายลมของแต่ละชั้น แบ่งตามความกว้างรับแรงของแนวเสา เมื่อมีไดอะแฟรมแข็งพื้นจะเคลื่อนที่เป็นชิ้นเดียว ควรตรวจสอบค่าตามมาตรฐานฉบับที่โครงการใช้')}</p>`;
    }
    function floorTotals() {
      const b = BDATA(), st = storyList(), swc = (A.model.cases.find(c => c.sw) || {}).id, rho = (A.model.materials.find(t => t.id === b.floor.mat) || A.model.materials.find(t => t.kind === 'conc') || { rho: 24 }).rho || 24;
      return st.slice(1).reverse().map(s => { const L = b.slabs.filter(q => q.st === s.id), Aa = L.reduce((t, q) => t + (q.x1 - q.x0) * (q.y1 - q.y0), 0); return { s, n: L.length, A: Aa, sdl: L.reduce((t, q) => t + (q.x1 - q.x0) * (q.y1 - q.y0) * (+q.sdl || 0), 0), ll: L.reduce((t, q) => t + (q.x1 - q.x0) * (q.y1 - q.y0) * (+q.ll || 0), 0), sw: b.floor.sw && swc ? L.reduce((t, q) => t + (q.x1 - q.x0) * (q.y1 - q.y0) * rho * (+q.t || 0) / 1000, 0) : 0 }; });
    }
    function storyResHTML(cur) {
      if (!cur || cur.kind === 'env') return `<p class="muted">${T('Choose a load case or combination.', 'เลือกกรณีน้ำหนักหรือการรวมน้ำหนัก')}</p>`;
      const rows = BD.storyResults(A.model, cur); if (!rows.length) return `<p class="muted">${T('Needs stories (Building › Stories).', 'ต้องกำหนดชั้น (อาคาร › ชั้น)')}</p>`;
      const rat = v => (!isFinite(v) || v > 99999 ? '≈ 0' : 'h/' + f(v, 0)), worst = Math.min(...rows.map(r => Math.min(r.rx, r.ry)));
      return wrap(`<table class="chk an-r"><thead><tr><th>${T('Story', 'ชั้น')}</th><th class="num">z (${ulab('L')})</th><th class="num">h</th><th class="num">u<sub>x</sub> max (${ulab('d')})</th><th class="num">u<sub>y</sub> max</th><th class="num">${T('Drift X', 'ดริฟต์ X')}</th><th class="num">${T('Drift Y', 'ดริฟต์ Y')}</th><th class="num">V<sub>x</sub> (${ulab('F')})</th><th class="num">V<sub>y</sub></th></tr></thead><tbody>${rows.slice().reverse().map(r => `<tr><td><b>${esc(r.id)}</b></td><td class="num mono">${fu(r.z, 'L', 2)}</td><td class="num mono">${fu(r.h, 'L', 2)}</td><td class="num mono">${fu(r.ux, 'd')}</td><td class="num mono">${fu(r.uy, 'd')}</td><td class="num mono ${r.rx < 500 ? 'bad' : ''}">${fu(r.dx, 'd')} · ${rat(r.rx)}</td><td class="num mono ${r.ry < 500 ? 'bad' : ''}">${fu(r.dy, 'd')} · ${rat(r.ry)}</td><td class="num mono">${fu(r.Vx, 'F', 1)}</td><td class="num mono">${fu(r.Vy, 'F', 1)}</td></tr>`).join('')}</tbody></table>`) +
        hint(T('Drift = largest difference in horizontal displacement between the floor and the floor below on the same column line. Story shear = horizontal force carried by the elements crossing mid-height of the story. Typical serviceability limits h/500 (brittle finishes) to h/300.', 'ดริฟต์ = ผลต่างการเคลื่อนตัวแนวราบสูงสุดระหว่างชั้นกับชั้นล่างบนแนวเสาเดียวกัน แรงเฉือนชั้น = แรงแนวราบในชิ้นส่วนที่ตัดผ่านกึ่งความสูงชั้น ค่าจำกัดทั่วไป h/500 ถึง h/300')) + (isFinite(worst) && worst < 1e5 ? `<p class="small">${T('Worst drift: ', 'ดริฟต์มากที่สุด: ')}<b>h/${f(worst, 0)}</b></p>` : '');
    }
    // ---- quantity take-off
    const QO = () => { if (!A.opt.qto) A.opt.qto = clone(BD.QDEF); return A.opt.qto; };
    function qtoRun() { if (A.qtoCache && A.qtoCache.ver === A.ver && A.qtoCache.o === JSON.stringify(QO())) return A.qtoCache.q; const q = BD.qto(A.model, QO()); A.qtoCache = { ver: A.ver, o: JSON.stringify(QO()), q }; return q; }
    const CATN = () => ({ col: T('Columns', 'เสา'), beam: T('Beams', 'คาน'), brace: T('Braces / inclined', 'ค้ำยัน / ชิ้นเอียง'), slab: T('Slabs', 'แผ่นพื้น') });
    const MKN = () => ({ conc: T('concrete', 'คอนกรีต'), steel: T('steel', 'เหล็ก'), other: T('other', 'อื่น ๆ') });
    function qtoHTML() {
      const q = qtoRun(), o = QO(), tab = A.qtab || 'sum', cur = o.cur ? ' ' + esc(o.cur) : '', V = v => f(v, 2), Wt = v => f(v / 1000, 2);
      const head = [T('Item', 'รายการ'), T('No.', 'จำนวน'), T('Length', 'ความยาว') + ' (m)', T('Concrete', 'คอนกรีต') + ' (m³)', T('Formwork', 'แบบหล่อ') + ' (m²)', T('Rebar', 'เหล็กเสริม') + ' (t)', T('Steel', 'เหล็กรูปพรรณ') + ' (t)'];
      const row = (lab, g) => `<tr><td>${lab}</td><td class="num mono">${g.n}</td><td class="num mono">${g.L ? f(g.L, 1) : g.A ? f(g.A, 1) + ' m²' : '—'}</td><td class="num mono">${g.V ? V(g.V) : '—'}</td><td class="num mono">${g.form ? f(g.form, 1) : '—'}</td><td class="num mono">${g.rebar ? Wt(g.rebar) : '—'}</td><td class="num mono">${g.steel ? Wt(g.steel) : '—'}</td></tr>`;
      const tot = `<tr class="tot"><td>${T('Total', 'รวม')}</td><td class="num mono">${q.tot.n}</td><td class="num mono">${f(q.tot.L, 1)}</td><td class="num mono">${V(q.tot.V)}</td><td class="num mono">${f(q.tot.form, 1)}</td><td class="num mono">${Wt(q.tot.rebar)}</td><td class="num mono">${Wt(q.tot.steel)}</td></tr>`;
      let body = '';
      if (tab === 'sum') body = tblw(head, q.byCat.map(g => { const [c, mk] = g.k.split('|'); return row(`${CATN()[c] || c} <span class="muted small">· ${MKN()[mk] || mk}</span>`, g); }).concat([tot]), 'an-wtbl-sm');
      else if (tab === 'story') body = tblw([T('Story / level', 'ชั้น / ระดับ')].concat(head.slice(1)), q.byStory.map(g => row(`<b>${esc(g.k)}</b>`, g)).concat([tot]), 'an-wtbl-sm');
      else if (tab === 'sec') body = tblw([T('Section', 'หน้าตัด')].concat(head.slice(1)), q.bySec.map(g => { const [mk, nm] = g.k.split('|'); const kgm = mk === 'steel' && g.L ? ` <span class="muted small">${f(g.steel / g.L, 1)} kg/m</span>` : ''; return row(esc(nm) + kgm, g); }).concat([tot]), 'an-wtbl-sm');
      else body = tblw([T('Element', 'ชิ้นส่วน'), T('Type', 'ชนิด'), T('Story', 'ชั้น'), T('Section', 'หน้าตัด'), 'L (m)', 'V (m³)', T('Form', 'แบบ') + ' (m²)', T('Rebar', 'เหล็กเสริม') + ' (kg)', T('Steel', 'เหล็ก') + ' (kg)'], q.rows.slice(0, 400).map(r => `<tr><td>${esc(r.id)}</td><td class="small">${CATN()[r.cat] || r.cat}</td><td>${esc(r.lvl)}</td><td class="small">${esc(r.secName)}</td><td class="num mono">${r.Lq ? f(r.Lq, 2) : r.A ? f(r.A, 2) + ' m²' : '—'}</td><td class="num mono">${r.V ? f(r.V, 3) : '—'}</td><td class="num mono">${r.form ? f(r.form, 2) : '—'}</td><td class="num mono">${r.rebar ? f(r.rebar, 0) : '—'}</td><td class="num mono">${r.steel ? f(r.steel, 0) : '—'}</td></tr>`), 'an-wtbl-sm') + (q.rows.length > 400 ? `<p class="muted small">${T('First 400 of ' + q.rows.length + ' — Export CSV for all.', 'แสดง 400 แรกจาก ' + q.rows.length + ' — ส่งออก CSV เพื่อดูทั้งหมด')}</p>` : '');
      const cost = q.cost.tot > 0 ? `<p class="small">${T('Estimated cost', 'ราคาประมาณ')}: ${T('concrete', 'คอนกรีต')} ${f(q.cost.conc, 0)} · ${T('formwork', 'แบบหล่อ')} ${f(q.cost.form, 0)} · ${T('rebar', 'เหล็กเสริม')} ${f(q.cost.rebar, 0)} · ${T('steel', 'เหล็กรูปพรรณ')} ${f(q.cost.steel, 0)} = <b>${f(q.cost.tot, 0)}${cur}</b></p>` : '';
      const virt = q.virt ? `<p class="muted small">${q.virt} ${T('stiffness-only element(s) with unit weight 0 (e.g. grillage deck strips) are not counted.', 'ชิ้นส่วนที่มีหน่วยน้ำหนัก 0 (เช่น แถบพื้นของกริลเลจ) ไม่นับรวม')}</p>` : '';
      return virt + `<div class="tabs sm" role="tablist">${[['sum', T('Summary', 'สรุป')], ['story', T('By story', 'ตามชั้น')], ['sec', T('By section', 'ตามหน้าตัด')], ['el', T('Elements', 'รายชิ้น')]].map(([k, l]) => `<button role="tab" aria-selected="${tab === k}" data-act="an-rb" data-c="qtab" data-v="${k}">${l}</button>`).join('')}</div>` + body + cost;
    }
    function qtoCSV() {
      const q = qtoRun(), e2 = v => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v), m = A.model;
      const rows = [['element', 'type', 'material', 'story', 'section', 'length_m', 'area_m2', 'concrete_m3', 'formwork_m2', 'rebar_kg', 'steel_kg']].concat(q.rows.map(r => [r.id, r.cat, r.mk, r.lvl, r.secName, r4(r.Lq || 0), r4(r.A || 0), r4(r.V || 0), r4(r.form || 0), Math.round(r.rebar || 0), Math.round(r.steel || 0)]));
      rows.push([], ['total', '', '', '', '', r4(q.tot.L), '', r4(q.tot.V), r4(q.tot.form), Math.round(q.tot.rebar), Math.round(q.tot.steel)]);
      ctx.saveFile((m.name || 'model').replace(/[^\w\-]+/g, '_') + '_quantities.csv', new Blob([rows.map(r => r.map(e2).join(',')).join('\n')], { type: 'text/csv' }));
    }
    Object.assign(RW, {
      bgrid: { t: () => T('Grid lines', 'เส้นกริด'), def: () => ({ sx: '', sy: '', ox: 0, oy: 0 }), body: v => {
        const b = BDATA(), tb = (k, ax) => tblw([T('Label', 'ชื่อ'), ax.toUpperCase() + ul('L'), T('Spacing', 'ระยะห่าง'), ''], b[k].map((g, i) => [g, i]).sort((p, q) => p[0][ax] - q[0][ax]).map(([g, i], j, arr) => `<tr><td>${inp(g.id, `data-bg="${k}.${i}.id"`, 56)}</td><td>${inp(uv(g[ax], 'L'), `data-bg="${k}.${i}.${ax}" type="number" step="any"`, 90)}</td><td class="num mono muted">${j ? fu(g[ax] - arr[j - 1][0][ax], 'L', 2) : '—'}</td><td><button class="icon-btn" data-act="an-rb" data-c="bgdel" data-v="${k}:${i}" aria-label="${T('Delete', 'ลบ')}">×</button></td></tr>`), 'an-wtbl-sm') + `<button class="btn btn-ghost xs" data-act="an-rb" data-c="bgadd" data-v="${ax}">+ ${T('Add', 'เพิ่ม')} ${ax.toUpperCase()} ${T('grid', 'กริด')}</button>`;
        return hint(T('Grid lines guide drawing: columns snap to intersections, beams to grid lines, slabs fill the bays. Moving a grid line moves the nodes on it.', 'เส้นกริดช่วยในการวาด: เสาสแนปที่จุดตัด คานตามเส้นกริด แผ่นพื้นเติมในช่อง การย้ายเส้นกริดจะย้ายจุดต่อบนเส้นนั้นด้วย')) +
          `<div class="an-row2"><div><h4>${T('X grids (lines at constant X)', 'กริด X (เส้นที่ X คงที่)')}</h4>${tb('gx', 'x')}</div><div><h4>${T('Y grids (lines at constant Y)', 'กริด Y (เส้นที่ Y คงที่)')}</h4>${tb('gy', 'y')}</div></div>` +
          `<label class="chkl"><input type="checkbox" data-bgm="1" ${A.gridMove !== false ? 'checked' : ''}> ${T('Move nodes and slabs with the grid line', 'ย้ายจุดต่อและแผ่นพื้นตามเส้นกริด')}</label>` +
          `<h4>${T('Replace all grids from spacings', 'สร้างกริดใหม่จากระยะห่าง')}</h4><div class="an-row4">${wf('sx', T('X spacings (m), e.g. 8, 8, 2@6', 'ระยะ X (ม.) เช่น 8, 8, 2@6'), v.sx)}${wf('sy', T('Y spacings (m)', 'ระยะ Y (ม.)'), v.sy)}${wf('ox', T('X origin', 'จุดเริ่ม X'), v.ox, 'n')}${wf('oy', T('Y origin', 'จุดเริ่ม Y'), v.oy, 'n')}</div>` + wfoot('', `<button class="btn btn-ghost sm" data-act="an-rb" data-c="bggen">${T('Replace grids', 'สร้างกริดใหม่')}</button>`);
      } },
      bstory: { t: () => T('Stories', 'ชั้น'), def: () => ({ h: '', copy: true }), body: v => {
        const st = storyList(), b = BDATA();
        return hint(T('Elevations are measured from the base. Changing a story height moves everything above it.', 'ระดับวัดจากฐาน การเปลี่ยนความสูงชั้นจะเลื่อนทุกอย่างที่อยู่เหนือขึ้นไป')) +
          tblw([T('Story', 'ชั้น'), T('Height', 'ความสูง') + ul('L'), T('Elevation', 'ระดับ') + ul('L'), T('Slabs', 'แผ่นพื้น'), T('Elements', 'ชิ้นส่วน'), ''], st.slice().reverse().map(s => { const k = st.indexOf(s), nm = A.model.nodes.filter(n => Math.abs((+n.z || 0) - s.z) < 1e-3).map(n => n.id), ns = new Set(nm); return `<tr><td>${inp(s.id, `data-bs="${esc(s.id)}.id"`, 80)}</td><td>${k ? inp(uv(s.z - st[k - 1].z, 'L'), `data-bs="${esc(s.id)}.h" type="number" step="any" min="0.1"`, 80) : '<span class="muted">—</span>'}</td><td class="num mono">${fu(s.z, 'L', 3)}</td><td class="num mono">${b.slabs.filter(q => q.st === s.id).length}</td><td class="num mono">${A.model.members.filter(q => ns.has(q.i) || ns.has(q.j)).length}</td><td>${k ? `<button class="linkbtn" data-act="an-rb" data-c="bgo" data-v="${esc(s.id)}">${T('plan', 'แปลน')}</button>` : ''}</td></tr>`; }), 'an-wtbl-sm') +
          `<div class="an-row3">${wf('h', T('New story height (blank = same as top)', 'ความสูงชั้นใหม่ (ว่าง = เท่าชั้นบนสุด)') + ul('L'), v.h, 'n')}<span class="an-f"><span>&nbsp;</span>${wck('copy', T('copy the top story’s columns, beams and slabs', 'คัดลอกเสา คาน และแผ่นพื้นของชั้นบนสุด'), v.copy)}</span><span></span></div>` +
          wfoot('', `<button class="btn btn-ghost sm" data-act="an-rb" data-c="bsdel">${T('Delete top story', 'ลบชั้นบนสุด')}</button><button class="btn btn-hot sm" data-act="an-rb" data-c="bsadd">${T('Add story on top', 'เพิ่มชั้นด้านบน')}</button>`);
      } },
      bfloor: { t: () => T('Floor loads and slabs', 'น้ำหนักบนพื้นและแผ่นพื้น'), def: () => ({ on: 'all', t: '', sdl: '', ll: '', way: '' }), body: v => {
        const b = BDATA(), m = A.model, st = storyList(), co = m.cases.map(c => [c.id, c.id + ' — ' + c.name]), tots = floorTotals();
        const wayO = [['auto', T('Auto (two-way unless ≥ 2:1)', 'อัตโนมัติ (สองทาง เว้นแต่ ≥ 2:1)')], ['two', T('Two-way (45° yield lines)', 'สองทาง (เส้นแบ่ง 45°)')], ['oneX', T('One-way, spans in X', 'ทางเดียว ช่วง X')], ['oneY', T('One-way, spans in Y', 'ทางเดียว ช่วง Y')]];
        return hint(T('Area loads on slabs go to the beams around them by tributary area: two-way slabs give triangles and trapezoids, one-way slabs a uniform load on the supporting beams. Slab self-weight = unit weight × thickness. Loads are regenerated whenever the model changes.', 'น้ำหนักแผ่บนแผ่นพื้นถ่ายลงคานโดยรอบตามพื้นที่รับน้ำหนัก: พื้นสองทางเป็นสามเหลี่ยมและสี่เหลี่ยมคางหมู พื้นทางเดียวเป็นแรงแผ่สม่ำเสมอบนคานที่รองรับ น้ำหนักพื้น = หน่วยน้ำหนัก × ความหนา คำนวณใหม่ทุกครั้งที่แบบจำลองเปลี่ยน')) +
          `<div class="an-row4">${fld(T('Superimposed dead → case', 'น้ำหนักคงที่เพิ่ม → กรณี'), bks('floor.dl', co, b.floor.dl))}${fld(T('Live → case', 'น้ำหนักจร → กรณี'), bks('floor.ll', co, b.floor.ll))}${fld(T('Slab concrete', 'คอนกรีตพื้น'), bks('floor.mat', m.materials.filter(t => t.kind === 'conc' || !t.kind).map(t => [t.id, t.id + ' · ' + fu(+t.rho || 0, 'g', 1) + ul('g')]), b.floor.mat))}<label class="chkl an-f"><span>&nbsp;</span><span><input type="checkbox" data-bk="floor.sw" ${b.floor.sw ? 'checked' : ''}> ${T('slab self-weight', 'น้ำหนักแผ่นพื้น')} → ${esc((m.cases.find(c => c.sw) || {}).id || '—')}</span></label></div>` +
          `<h4>${T('Assign to slabs', 'กำหนดให้แผ่นพื้น')}</h4><div class="an-row4">${ws('on', T('Story', 'ชั้น'), [['all', T('All stories', 'ทุกชั้น')]].concat(st.slice(1).reverse().map(s => [s.id, s.id])), v.on)}${wf('t', T('Thickness (mm)', 'ความหนา (มม.)'), v.t, 'n', 'placeholder="' + T('keep', 'คงเดิม') + '"')}${wf('sdl', T('SDL', 'น้ำหนักคงที่เพิ่ม') + ul('p'), v.sdl, 'n', 'placeholder="' + T('keep', 'คงเดิม') + '"')}${wf('ll', T('Live', 'น้ำหนักจร') + ul('p'), v.ll, 'n', 'placeholder="' + T('keep', 'คงเดิม') + '"')}</div>` +
          `<div class="an-row3">${ws('way', T('Distribution', 'การกระจาย'), [['', T('keep', 'คงเดิม')]].concat(wayO), v.way)}<span></span><span class="an-f"><span>&nbsp;</span><button class="btn btn-hot xs" data-act="an-rb" data-c="bfapply">${T('Apply', 'กำหนด')}</button></span></div>` +
          `<h4>${T('Totals per story', 'รวมต่อชั้น')}</h4>` + tblw([T('Story', 'ชั้น'), T('Slabs', 'แผ่น'), T('Area', 'พื้นที่') + ' (m²)', 'SDL' + ul('F'), T('Slab weight', 'น้ำหนักพื้น') + ul('F'), T('Live', 'จร') + ul('F')], tots.map(r => `<tr><td><b>${esc(r.s.id)}</b></td><td class="num mono">${r.n}</td><td class="num mono">${f(r.A, 1)}</td><td class="num mono">${fu(r.sdl, 'F', 0)}</td><td class="num mono">${fu(r.sw, 'F', 0)}</td><td class="num mono">${fu(r.ll, 'F', 0)}</td></tr>`).concat([`<tr class="tot"><td>Σ</td><td class="num mono">${b.slabs.length}</td><td class="num mono">${f(tots.reduce((t, r) => t + r.A, 0), 1)}</td><td class="num mono">${fu(tots.reduce((t, r) => t + r.sdl, 0), 'F', 0)}</td><td class="num mono">${fu(tots.reduce((t, r) => t + r.sw, 0), 'F', 0)}</td><td class="num mono">${fu(tots.reduce((t, r) => t + r.ll, 0), 'F', 0)}</td></tr>`]), 'an-wtbl-sm') +
          `<h4>${T('Slabs', 'แผ่นพื้น')} (${b.slabs.length})</h4>` + (b.slabs.length ? tblw(['ID', T('Story', 'ชั้น'), T('Bay', 'ช่อง'), 'Lx × Ly', 't (mm)', 'SDL' + ul('p'), T('Live', 'จร') + ul('p'), T('Way', 'การกระจาย'), ''], b.slabs.slice(0, 300).map((s, i) => `<tr><td>${esc(s.id)}</td><td>${esc(s.st)}</td><td class="small">${esc(slabLabel(s))}</td><td class="num mono small">${f(s.x1 - s.x0, 2)} × ${f(s.y1 - s.y0, 2)}</td><td>${bk('slabs.' + i + '.t', s.t, 'type="number" step="any"', 60)}</td><td>${bk('slabs.' + i + '.sdl', pv(s.sdl, 'p'), 'type="number" step="any" data-q="p"', 66)}</td><td>${bk('slabs.' + i + '.ll', pv(s.ll, 'p'), 'type="number" step="any" data-q="p"', 66)}</td><td>${bks('slabs.' + i + '.way', wayO.map(q => [q[0], q[0] === 'auto' ? 'auto → ' + BD.slabWay(Object.assign({}, s, { way: 'auto' })) : q[0]]), s.way || 'auto')}</td><td><button class="icon-btn" data-act="an-rb" data-c="bslabdel" data-v="${i}" aria-label="${T('Delete', 'ลบ')}">×</button></td></tr>`), 'an-wtbl-sm') : hint(T('No slabs yet — use Building › Slabs (click bays in a plan) or Auto Frame › Slabs in every bay.', 'ยังไม่มีแผ่นพื้น — ใช้ อาคาร › แผ่นพื้น (คลิกช่องในแปลน) หรือ สร้างอัตโนมัติ › แผ่นพื้นทุกช่อง'))) +
          wfoot('', `<button class="btn btn-ghost sm" data-act="an-rb" data-c="bshow" data-v="${esc(b.floor.dl)}">${T('Show on model', 'แสดงบนแบบจำลอง')}</button>`);
      } },
      bwind: { t: () => T('Wind loads (automatic)', 'แรงลม (คำนวณอัตโนมัติ)'), body: () => {
        const b = BDATA(), w = b.wind, c = w.code, p = w[c];
        const par = c === 'AS' ? `<div class="an-row4">${fld(T('Region', 'เขต'), bks('wind.AS.region', [['A', 'A (A0–A7)'], ['W', 'W'], ['B1', 'B1'], ['B2', 'B2'], ['C', 'C'], ['D', 'D']], p.region))}${fld(T('Return period R (years)', 'คาบการกลับ R (ปี)'), bks('wind.AS.R', [25, 50, 100, 250, 500, 1000, 2500].map(r => [r, r + (r === 500 ? T(' (IL2, 50 yr)', ' (IL2)') : r === 1000 ? ' (IL3)' : r === 2500 ? ' (IL4)' : '')]), p.R))}${fld(T('Terrain category', 'ประเภทภูมิประเทศ'), bks('wind.AS.tc', [['1', 'TC1'], ['2', 'TC2'], ['2.5', 'TC2.5'], ['3', 'TC3'], ['4', 'TC4']], p.tc))}${fld('M<sub>d</sub>', bk('wind.AS.Md', p.Md, 'type="number" step="0.01"'))}</div><div class="an-row4">${fld('M<sub>s</sub>', bk('wind.AS.Ms', p.Ms, 'type="number" step="0.01"'))}${fld('M<sub>t</sub>', bk('wind.AS.Mt', p.Mt, 'type="number" step="0.01"'))}${fld('K<sub>a</sub> · K<sub>c</sub>', `<span class="an-pair">${bk('wind.AS.Ka', p.Ka, 'type="number" step="0.05"', 60)}${bk('wind.AS.Kc', p.Kc, 'type="number" step="0.05"', 60)}</span>`)}${fld('C<sub>dyn</sub>', bk('wind.AS.Cdyn', p.Cdyn, 'type="number" step="0.01"'))}</div>`
          : c === 'EN' ? `<div class="an-row4">${fld('v<sub>b,0</sub> (m/s)', bk('wind.EN.vb0', p.vb0, 'type="number" step="0.5"'))}${fld('c<sub>dir</sub> · c<sub>season</sub>', `<span class="an-pair">${bk('wind.EN.cdir', p.cdir, 'type="number" step="0.05"', 60)}${bk('wind.EN.cseason', p.cseason, 'type="number" step="0.05"', 60)}</span>`)}${fld(T('Terrain category', 'ประเภทภูมิประเทศ'), bks('wind.EN.tc', [['0', '0 — sea'], ['I', 'I — lakes, flat'], ['II', 'II — low vegetation'], ['III', 'III — suburban'], ['IV', 'IV — urban']], p.tc))}${fld('c<sub>s</sub>c<sub>d</sub>', bk('wind.EN.cscd', p.cscd, 'type="number" step="0.01"'))}</div>`
            : `<div class="an-row4">${fld(T('Wind zone', 'เขตความเร็วลม'), bks('wind.TH.zone', [['1', T('1 — 25 m/s (most of Thailand)', '1 — 25 ม./วินาที')], ['2', '2 — 27 m/s'], ['3', '3 — 29 m/s'], ['4A', T('4A — 25 m/s, TF 1.2 (east coast)', '4A — 25 ม./วินาที TF 1.2')], ['4B', T('4B — 25 m/s, TF 1.08', '4B — 25 ม./วินาที TF 1.08')]], p.zone))}${fld(T('Importance', 'ความสำคัญ'), bks('wind.TH.imp', [['low', T('Low (0.8)', 'น้อย (0.8)')], ['normal', T('Normal (1.0)', 'ปกติ (1.0)')], ['high', T('High (1.15)', 'มาก (1.15)')], ['post', T('Very high (1.15)', 'สูงมาก (1.15)')]], p.imp))}${fld(T('Exposure', 'สภาพภูมิประเทศ'), bks('wind.TH.exp', [['A', T('A — open terrain', 'A — พื้นที่โล่ง')], ['B', T('B — suburban / urban', 'B — ชานเมือง / เมือง')]], p.exp))}${fld('C<sub>g</sub>', bk('wind.TH.Cg', p.Cg, 'type="number" step="0.05"'))}</div>`;
        return `<div class="an-row4"><label class="chkl an-f"><span>&nbsp;</span><span><input type="checkbox" data-bk="wind.on" ${w.on ? 'checked' : ''}> <b>${T('Automatic wind loads', 'คำนวณแรงลมอัตโนมัติ')}</b></span></label>${fld(T('Code', 'มาตรฐาน'), bks('wind.code', [['AS', 'AS/NZS 1170.2:2021'], ['EN', 'EN 1991-1-4'], ['TH', T('DPT 1311-50 (Thai)', 'มยผ. 1311-50')]], c))}${fld(T('Parapet above roof', 'กำแพงกันตกเหนือหลังคา') + ul('L'), bk('wind.par', uv(+w.par || 0, 'L'), 'type="number" step="any" data-q="L"'))}<span class="an-f"><span>${T('Directions', 'ทิศทาง')}</span><span class="an-chks"><label class="chkl sm"><input type="checkbox" data-bk="wind.X" ${w.X ? 'checked' : ''}> X</label><label class="chkl sm"><input type="checkbox" data-bk="wind.Y" ${w.Y ? 'checked' : ''}> Y</label><label class="chkl sm"><input type="checkbox" data-bk="wind.neg" ${w.neg ? 'checked' : ''}> ± ${T('both signs', 'สองทิศ')}</label></span></span></div>` + par +
          `<div class="an-row4">${fld('C<sub>p</sub> ' + T('windward (blank = code)', 'ต้นลม (ว่าง = ตามมาตรฐาน)'), bk('wind.' + c + '.cpw', p.cpw, 'type="number" step="0.05"'))}${fld('C<sub>p</sub> ' + T('leeward (blank = code)', 'ท้ายลม (ว่าง = ตามมาตรฐาน)'), bk('wind.' + c + '.cpl', p.cpl, 'type="number" step="0.05"'))}${fld(T('Cases +X / +Y', 'กรณี +X / +Y'), `<span class="an-pair">${bk('wind.cases.X', w.cases.X, '', 60)}${bk('wind.cases.Y', w.cases.Y, '', 60)}</span>`)}${fld(T('Cases −X / −Y', 'กรณี −X / −Y'), `<span class="an-pair">${bk('wind.cases.XN', w.cases.XN, '', 60)}${bk('wind.cases.YN', w.cases.YN, '', 60)}</span>`)}</div>` +
          `<div id="bwRes">${windCalcHTML()}</div>` + wfoot('', `<button class="btn btn-ghost sm" data-act="an-rb" data-c="bwcases">${T('Update cases & combinations', 'ปรับกรณีและการรวมน้ำหนัก')}</button><button class="btn btn-ghost sm" data-act="an-rb" data-c="bshow" data-v="${esc(w.cases.X)}">${T('Show on model', 'แสดงบนแบบจำลอง')}</button>`);
      } },
      bstr: { t: () => T('Story results — drift and shear', 'ผลรายชั้น — ดริฟต์และแรงเฉือน'), body: () => fresh() ? fld(T('Results for', 'ผลของ'), sel(srcList().filter(q => /^(case|combo):/.test(q[0])), A.src, 'id="an-src2"')) + `<div id="bstrBody">${storyResHTML(current())}</div>` + wfoot('') : hint(T('Run the analysis first.', 'วิเคราะห์ก่อน')) },
      qto: { t: () => T('Quantity take-off (3D model)', 'ถอดปริมาณวัสดุ (แบบจำลอง 3 มิติ)'), body: () => {
        const o = QO(), qi = (k, v, a, w2) => inp(v, `data-qo="${k}" type="number" step="any" ${a || ''}`, w2 || 70);
        return hint(T('Quantities from the elements and slabs of the model. Concrete beams are measured below the slab and between column faces (joints counted in the columns); slabs by area × thickness. Rebar from typical ratios — replace them with your own.', 'ปริมาณจากชิ้นส่วนและแผ่นพื้นในแบบจำลอง คาน คสล. วัดใต้พื้นและระหว่างผิวเสา (จุดต่อนับในเสา) แผ่นพื้นจากพื้นที่ × ความหนา เหล็กเสริมจากอัตราทั่วไป — แก้เป็นค่าของท่านได้')) +
          `<div class="an-row4">${fld(T('Rebar kg/m³ — columns', 'เหล็กเสริม กก./ลบ.ม. — เสา'), qi('rebar.col', o.rebar.col))}${fld(T('beams', 'คาน'), qi('rebar.beam', o.rebar.beam))}${fld(T('slabs', 'พื้น'), qi('rebar.slab', o.rebar.slab))}${fld(T('braces / other', 'ค้ำยัน / อื่น ๆ'), qi('rebar.brace', o.rebar.brace))}</div>` +
          `<div class="an-row4">${fld(T('Concrete waste %', 'เผื่อคอนกรีต %'), qi('waste', o.waste))}${fld(T('Steel connections %', 'เผื่อจุดต่อเหล็ก %'), qi('conn', o.conn))}${fld(T('Currency', 'สกุลเงิน'), inp(o.cur || '', 'data-qo="cur" placeholder="THB"', 70))}<span></span></div><label class="chkl"><input type="checkbox" data-qo="deduct" ${o.deduct ? 'checked' : ''}> ${T('Measure concrete beams between column faces', 'วัดคาน คสล. ระหว่างผิวเสา')}</label>` +
          `<div class="an-row4">${fld(T('Rate: concrete / m³', 'ราคา: คอนกรีต / ลบ.ม.'), qi('rates.conc', o.rates.conc))}${fld(T('formwork / m²', 'แบบหล่อ / ตร.ม.'), qi('rates.form', o.rates.form))}${fld(T('rebar / t', 'เหล็กเสริม / ตัน'), qi('rates.rebar', o.rates.rebar))}${fld(T('structural steel / t', 'เหล็กรูปพรรณ / ตัน'), qi('rates.steel', o.rates.steel))}</div>` +
          `<div id="qtoBody">${qtoHTML()}</div>` + wfoot('', `<button class="btn btn-ghost sm" data-act="an-rb" data-c="qtocsv">${T('Export CSV', 'ส่งออก CSV')}</button>`);
      } }
    });
    WIDE.push('bgrid', 'bstory', 'bfloor', 'bwind', 'bstr', 'qto');
    // inputs: data-bk (m.bld path), data-bg (grids), data-bs (stories), data-qo (take-off options)
    function bldInput(t) {
      if (t.id === 'an-src2') { A.src = t.value; const bb = $('#bstrBody'); if (bb) bb.innerHTML = storyResHTML(current()); drawAll(); return true; }
      if (t.dataset.qo) { const o = QO(), ps = t.dataset.qo.split('.'); let tg = o; for (let i = 0; i < ps.length - 1; i++) tg = tg[ps[i]]; tg[ps[ps.length - 1]] = t.type === 'checkbox' ? t.checked : t.dataset.qo === 'cur' ? t.value : +t.value || 0; persist(); const qb = $('#qtoBody'); if (qb) qb.innerHTML = qtoHTML(); return true; }
      if (!BLD) return false;
      const b = BDATA();
      if (t.dataset.bgm) { A.gridMove = t.checked; return true; }
      if (t.dataset.bg) {
        const [k, i, fd] = t.dataset.bg.split('.'), g = b[k] && b[k][+i]; if (!g) return true;
        if (fd === 'id') { const v = t.value.trim(); if (!v) return true; g.id = v; persist(); ribRefresh(); redraw(); return true; }
        const nv = r4(frU(+t.value, 'L')); if (!isFinite(nv) || t.value === '') return true; const old = g[fd]; if (Math.abs(nv - old) < 1e-9) return true;
        snap(); g[fd] = nv;
        if (A.gridMove !== false) { A.model.nodes.forEach(n => { if (Math.abs((+n[fd] || 0) - old) < 1e-3) n[fd] = nv; }); b.slabs.forEach(s => { const a0 = fd + '0', a1 = fd + '1'; if (Math.abs(s[a0] - old) < 1e-3) s[a0] = nv; if (Math.abs(s[a1] - old) < 1e-3) s[a1] = nv; if (s[a0] > s[a1]) { const q = s[a0]; s[a0] = s[a1]; s[a1] = q; } }); }
        changed(false); return true;
      }
      if (t.dataset.bs) {
        const [id, fd] = t.dataset.bs.split('.'), s = b.stories.find(q => q.id === id); if (!s) return true;
        if (fd === 'id') { const v = t.value.trim(); if (!v || b.stories.some(q => q !== s && q.id === v)) { t.classList.add('bad'); return true; } t.classList.remove('bad'); snap(); b.slabs.forEach(q => { if (q.st === s.id) q.st = v; }); if (A.story === s.id) A.story = v; s.id = v; t.dataset.bs = v + '.id'; changed(false); ribRefresh(); return true; }
        const st = storyList(), k = st.indexOf(s); if (k < 1) return true; const h = frU(+t.value, 'L'); if (!(h > 0.05)) return true; const d = r4(h - (s.z - st[k - 1].z)); if (Math.abs(d) < 1e-9) return true;
        snap(); const z0 = s.z; A.model.nodes.forEach(n => { if ((+n.z || 0) >= z0 - 1e-3) n.z = r4((+n.z || 0) + d); }); st.slice(k).forEach(q => { q.z = r4(q.z + d); }); if (A.cut !== 'all' && +A.cut >= z0 - 1e-3) A.cut = r4(+A.cut + d);
        changed(false); return true;
      }
      if (!t.dataset.bk) return false;
      const ps = t.dataset.bk.split('.'); let o = b; for (let i = 0; i < ps.length - 1; i++) { if (o[ps[i]] == null) o[ps[i]] = {}; o = o[ps[i]]; }
      const k = ps[ps.length - 1], q = t.dataset.q; let v = t.type === 'checkbox' ? t.checked : t.type === 'number' || t.tagName === 'SELECT' && /^(R)$/.test(k) ? (t.value === '' ? '' : +t.value) : t.value;
      if (q && v !== '') v = frU(+v, q);
      snap(); o[k] = v; changed(false);
      if (ps[0] === 'wind') { if (t.tagName === 'SELECT' || t.type === 'checkbox') { if (k === 'code') winRefresh(); else { const r = $('#bwRes'); if (r) r.innerHTML = windCalcHTML(); } ribRefresh(); } else { const r = $('#bwRes'); if (r) r.innerHTML = windCalcHTML(); } }
      if (ps[0] === 'floor' && (t.tagName === 'SELECT' || t.type === 'checkbox')) winRefresh();
      return true;
    }
    // tree step "Building" (building mode)
    function bldPanel() {
      const b = BDATA(), row = (c, lbl, n, extra) => `<button class="an-lirow an-pickrow" data-act="an-rb" data-c="${c}"><span class="an-lim">${lbl}</span><span class="an-lis">${extra || ''}</span><span class="an-lit mono">${n}</span></button>`, st = storyList();
      const wc = b.wind.on ? ['X', 'Y'].filter(d => b.wind[d]).map(d => BD.windCalc(A.model, d)).filter(Boolean) : [];
      return hint(T('Grids and stories organise the building; draw columns, beams and slabs in a story plan; floor loads and wind are generated from them every time the model changes.', 'กริดและชั้นจัดระเบียบอาคาร วาดเสา คาน และแผ่นพื้นในแปลนชั้น น้ำหนักบนพื้นและแรงลมสร้างอัตโนมัติทุกครั้งที่แบบจำลองเปลี่ยน')) +
        `<div class="an-list">${row('bgrid', T('Grid lines', 'เส้นกริด'), b.gx.length + ' × ' + b.gy.length, b.gx.map(g => g.id).join(' ') + ' / ' + b.gy.map(g => g.id).join(' '))}${row('bstory', T('Stories', 'ชั้น'), Math.max(0, st.length - 1), st.length ? T('H = ', 'H = ') + fu(st[st.length - 1].z - st[0].z, 'L', 2) + ul('L') : '')}${row('bstm', T('Story plan', 'แปลนชั้น'), '›', curStory() ? curStory().id : '')}${row('bfloor', T('Slabs & floor loads', 'แผ่นพื้นและน้ำหนักบนพื้น'), b.slabs.length, A.model.loads.filter(l => l.gen === 'slab').length + T(' beam loads', ' แรงบนคาน'))}${row('bwind', T('Wind loads', 'แรงลม'), b.wind.on ? '✓' : T('off', 'ปิด'), wc.map(c => c.dir + ': ' + fu(c.base, 'F', 0) + ul('F')).join(' · '))}${row('bdia', T('Rigid diaphragms', 'ไดอะแฟรมแข็ง'), b.dia ? T('on', 'เปิด') : T('off', 'ปิด'))}${row('bstr', T('Story results', 'ผลรายชั้น'), fresh() ? '✓' : '—')}${row('qto', T('Quantity take-off', 'ถอดปริมาณวัสดุ'), '›')}</div>` +
        `<div class="an-adds"><button class="btn btn-ghost xs" data-act="an-rb" data-c="bcol">${T('Draw columns', 'วาดเสา')}</button><button class="btn btn-ghost xs" data-act="an-rb" data-c="bbeam">${T('Draw beams', 'วาดคาน')}</button><button class="btn btn-ghost xs" data-act="an-rb" data-c="bslab">${T('Draw slabs', 'วาดแผ่นพื้น')}</button></div>`;
    }
    // report sections (building)
    function bldReport(sec, tbl, n0) {
      const b = BDATA(); let n = n0, html = '';
      const tots = floorTotals();
      html += sec(n++, T('Building — grids, stories and floor loads', 'อาคาร — กริด ชั้น และน้ำหนักบนพื้น'), `<p class="rp-txt">${T('Grid X: ', 'กริด X: ')}${gxs().map(g => esc(g.id) + ' ' + fu(g.x, 'L', 2)).join(' · ')}<br>${T('Grid Y: ', 'กริด Y: ')}${gys().map(g => esc(g.id) + ' ' + fu(g.y, 'L', 2)).join(' · ')}<br>${T('Rigid floor diaphragms: ', 'ไดอะแฟรมแข็ง: ')}${b.dia ? T('yes', 'ใช่') : T('no', 'ไม่')}</p>` +
        tbl([T('Story', 'ชั้น'), T('Elevation', 'ระดับ') + ' (' + ulab('L') + ')', T('Slabs', 'แผ่นพื้น'), T('Area', 'พื้นที่') + ' (m²)', 'SDL (' + ulab('F') + ')', T('Slab weight', 'น้ำหนักพื้น') + ' (' + ulab('F') + ')', T('Live', 'จร') + ' (' + ulab('F') + ')'], tots.map(r => [esc(r.s.id), fu(r.s.z, 'L', 2), r.n, f(r.A, 1), fu(r.sdl, 'F', 0), fu(r.sw, 'F', 0), fu(r.ll, 'F', 0)])));
      if (b.wind.on) { const w = ['X', 'Y'].filter(d => b.wind[d]).map(d => BD.windCalc(A.model, d)).filter(Boolean); if (w.length) html += sec(n++, T('Wind loads', 'แรงลม') + ' — ' + ({ AS: 'AS/NZS 1170.2:2021', EN: 'EN 1991-1-4', TH: 'DPT 1311-50' }[b.wind.code]), w.map(c => `<p class="rp-txt"><b>${T('Wind ', 'ลม ')}${c.dir}</b> · ${esc(c.note)} · H ${fu(c.H, 'L', 2)}, B ${fu(c.B, 'L', 2)}, D ${fu(c.D, 'L', 2)} ${ulab('L')} · C<sub>p</sub> ${f(c.cp[0], 2)} / ${f(c.cp[1], 2)}</p>` + tbl([T('Story', 'ชั้น'), 'z', 'B', 'p<sub>w</sub> (' + ulab('p') + ')', 'p<sub>l</sub> (' + ulab('p') + ')', 'F (' + ulab('F') + ')', 'V (' + ulab('F') + ')'], c.rows.slice().reverse().map(r => [esc(r.id), fu(r.z, 'L', 2), fu(r.B, 'L', 1), fu(r.pw, 'p', 3), fu(r.pl, 'p', 3), fu(r.F, 'F', 2), fu(r.V, 'F', 1)]))).join('')); }
      const keep = A.src, sr = A.model.cases.filter(c => c.type === 'W' && A.res.cases[c.id]).map(c => { A.src = 'case:' + c.id; const cur = current(), rows = BD.storyResults(A.model, cur); return [c, rows]; }); A.src = keep;
      if (sr.length) html += sec(n++, T('Story drift and shear under wind', 'ดริฟต์และแรงเฉือนรายชั้นภายใต้แรงลม'), sr.map(([c, rows]) => `<p class="rp-txt"><b>${esc(c.id)}</b> — ${esc(c.name)}</p>` + tbl([T('Story', 'ชั้น'), 'h (' + ulab('L') + ')', T('Drift X', 'ดริฟต์ X') + ' (' + ulab('d') + ')', T('Drift Y', 'ดริฟต์ Y') + ' (' + ulab('d') + ')', 'h/δ', 'V<sub>x</sub> (' + ulab('F') + ')', 'V<sub>y</sub> (' + ulab('F') + ')'], rows.slice().reverse().map(r => [esc(r.id), fu(r.h, 'L', 2), fu(r.dx, 'd'), fu(r.dy, 'd'), isFinite(Math.min(r.rx, r.ry)) && Math.min(r.rx, r.ry) < 1e5 ? f(Math.min(r.rx, r.ry), 0) : '—', fu(r.Vx, 'F', 1), fu(r.Vy, 'F', 1)]))).join(''));
      return { html, n };
    }
    function qtoReport(sec, tbl, n) {
      const q = qtoRun(); if (!q.rows.length) return { html: '', n };
      return { html: sec(n, T('Quantity take-off', 'ปริมาณวัสดุ'), tbl([T('Item', 'รายการ'), T('No.', 'จำนวน'), T('Concrete', 'คอนกรีต') + ' (m³)', T('Formwork', 'แบบหล่อ') + ' (m²)', T('Rebar', 'เหล็กเสริม') + ' (t)', T('Steel', 'เหล็กรูปพรรณ') + ' (t)'], q.byCat.map(g => { const [c, mk] = g.k.split('|'); return [(CATN()[c] || c) + ' · ' + (MKN()[mk] || mk), g.n, g.V ? f(g.V, 2) : '—', g.form ? f(g.form, 1) : '—', g.rebar ? f(g.rebar / 1000, 2) : '—', g.steel ? f(g.steel / 1000, 2) : '—']; }).concat([['<b>' + T('Total', 'รวม') + '</b>', q.tot.n, '<b>' + f(q.tot.V, 2) + '</b>', '<b>' + f(q.tot.form, 1) + '</b>', '<b>' + f(q.tot.rebar / 1000, 2) + '</b>', '<b>' + f(q.tot.steel / 1000, 2) + '</b>']])) + `<p class="rp-txt">${T('Rebar from ratios (kg/m³): columns ', 'เหล็กเสริมจากอัตรา (กก./ลบ.ม.): เสา ')}${q.opts.rebar.col}, ${T('beams', 'คาน')} ${q.opts.rebar.beam}, ${T('slabs', 'พื้น')} ${q.opts.rebar.slab}.${q.cost.tot > 0 ? ' ' + T('Estimated cost ', 'ราคาประมาณ ') + f(q.cost.tot, 0) + ' ' + esc(q.opts.cur || '') : ''}</p>`), n: n + 1 };
    }
    return { view, mount, onClick, onInput, run, state: A, build, preset, TPL, migrate, openQto: () => { openWin('qto'); } };
  };
})(typeof window !== 'undefined' ? window : globalThis);
