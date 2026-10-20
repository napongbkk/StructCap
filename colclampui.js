/* StructCap Column Clamp — prestressed column clamp (stress bars, friction, grout bearing, clamp box, welds) to EN 1993-1-1,
   EN 1993-1-8 and EN 1992-1-1. The calculation is the engineer's workbook (07_T5_Column_Clamp Rev 35), recalculated cell by
   cell by xlcalc.js; this page shows it like the other StructCap designers: inputs on the left, a 3D model, the drawings,
   the design checks and the full calculation as an HTML report. Only the inputs can be changed; the formulas are locked. Pro only. */
(function (G) {
  'use strict';
  G.SC_COLCLAMP_UI = function (ctx) {
    const { T, esc, f, $, S, toast, isPro, COPY, logoMark, today, saveFile } = ctx;
    const VIEW = 'colclamp', LS = 'sc.colclamp.v1', CALC = 'Column Clamp', DRAW = 'Clamp Drawings';
    const A = { book: null, busy: false, err: null, t: null, draw: 'arr', cam: null };
    const X = () => G.XLCALC;
    const store = { get() { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { return null; } }, set(v) { try { localStorage.setItem(LS, JSON.stringify(v)); } catch (e) { } } };
    const sh = () => A.book.S[CALC].sh, cellV = a => A.book.get(CALC, a), num = a => { const v = cellV(a); return typeof v === 'number' ? v : +v || 0; };
    const inputs = () => (A.book ? sh().inputs : []);
    const saved = () => { const o = {}; inputs().forEach(a => { const c = A.book.cell(CALC, a); if (c && c.v !== c.x0) o[a] = c.v; }); return o; };
    const txt = v => (v == null ? '' : X().isErr(v) ? v.e : String(v));
    const fmtCell = (a, v) => { const c = sh().cells[a], st = (A.book.model.styles[c ? c.s || 0 : 0]) || {}; return X().fmtValue(v === undefined ? cellV(a) : v, st.nf); };
    function load() {
      if (A.book || A.busy) return; A.busy = true;
      fetch('colclamp.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(m => {
        A.book = new (X().Book)(m); const s = store.get();
        if (s && s.inputs) Object.entries(s.inputs).forEach(([a, v]) => { if (sh().inputs.includes(a)) A.book.set(CALC, a, v); });
      }).catch(e => { A.err = String(e && e.message || e); }).finally(() => { A.busy = false; if (S.view === VIEW) { const r = $('#ccRoot'); if (r) r.outerHTML = page(); after(); } });
    }

    // ------------------------------------------------------------------ the workbook rows as structured content
    let rowsC = null;
    const rowsOf = () => { if (rowsC) return rowsC; const s = new Set(); Object.keys(sh().cells).forEach(a => { const r = +a.replace(/^[A-Z]+/, ''), c = a.replace(/\d+$/, ''); if (c.length === 1 && c <= 'J') s.add(r); }); return (rowsC = [...s].sort((x, y) => x - y)); };
    const styleOf = a => { const c = sh().cells[a]; return c ? A.book.model.styles[c.s || 0] || {} : {}; };
    const isHead = r => { const c = sh().cells['A' + r]; return !!c && typeof c.v === 'string' && styleOf('A' + r).bg === 'D9E2F3'; };
    const isSub = r => { const c = sh().cells['C' + r]; return !!c && !c.f && typeof c.v === 'string' && !!styleOf('C' + r).b && !sh().cells['F' + r]; };
    // inputs grouped under the sub-heading above them
    function groups() {
      const out = [{ name: T('Project', 'โครงการ'), items: [['D4', 'Project No.'], ['G4', 'Element'], ['D5', 'Designed by'], ['G5', 'Checked by'], ['G6', 'Revision']].map(([a, l]) => ({ a, l, sym: '', u: '', note: '' })) }];
      let cur = null, sec = '';
      rowsOf().forEach(r => {
        if (isHead(r)) sec = String(sh().cells['A' + r].v);
        if (isSub(r)) { cur = { name: String(sh().cells['C' + r].v), sec, items: [] }; out.push(cur); }
        const a = 'F' + r; if (!inputs().includes(a) || !cur) return;
        cur.items.push({ a, l: txt(cellV('C' + r)).replace(/;\s*$/, ''), sym: txt(cellV('D' + r)), u: txt(cellV('G' + r)), note: txt(cellV('J' + r)) });
      });
      return out.filter(g => g.items.length);
    }
    function summary() { // SUMMARY OF RESULTS rows (C = check, F = UR, I = status)
      const rs = rowsOf(), i0 = rs.find(r => sh().cells['A' + r] && /^SUMMARY OF RESULTS/.test(sh().cells['A' + r].v)) || 0, i1 = rs.find(r => r > i0 && isHead(r)) || 1e9, out = [];
      rs.filter(r => r > i0 + 1 && r < i1).forEach(r => { const st = cellV('I' + r); if (st !== 'OK' && st !== 'N.G.') return; out.push({ r, name: txt(cellV('C' + r)), ur: num('F' + r), ok: st === 'OK' }); });
      return out;
    }
    function welds() {
      const rs = rowsOf(), i0 = rs.find(r => sh().cells['A' + r] && /^WELD DETAILS/.test(sh().cells['A' + r].v));
      return i0 ? rs.filter(r => r > i0 + 1 && /^W\d+$/.test(txt(cellV('A' + r)))).map(r => ({ w: txt(cellV('A' + r)), d: txt(cellV('C' + r)).replace(/^W\d+\s+/, ''), ur: num('F' + r), st: txt(cellV('I' + r)), j: txt(cellV('J' + r)) })) : [];
    }

    // ------------------------------------------------------------------ 3D model (metres; x across the column, y along the clamp face, z up, clamp top at z = 0)
    function scene() {
      const m = new G.SC3D.Mesh(), mm = v => v / 1000, ax = [1, 0, 0], ay = [0, 1, 0], az = [0, 0, 1];
      const bc = mm(num('F77')), hc = mm(num('F78')), tg = mm(num('F79')), np = Math.max(1, Math.round(num('F80'))), Lp = mm(num('F81')), gp = mm(num('F82')), Hp = mm(num('F83'));
      const Lx = mm(num('F85')), H = mm(num('F86')), Hm = mm(num('F87')), B = mm(num('F88')), Bl = mm(num('F89')), tep = mm(num('F90'));
      const nwp = Math.round(num('F93')), twp = mm(num('F94')), zw = ['F95', 'F96', 'F97', 'F98', 'F99'].slice(0, nwp).map(a => mm(num(a)));
      const tcd = mm(num('F102')), pd = mm(num('F103')), ns = Math.round(num('F113')), tst = mm(num('F107')), Lst = mm(num('F108')), ys = ['F109', 'F110', 'F111'].slice(0, ns).map(a => mm(num(a)));
      const tcw = mm(num('F115')), yc1 = mm(num('F120')), yc2 = mm(num('F118')), nr = Math.round(num('F127')), d = mm(num('F128')), gb = mm(num('F129')), zb = ['F130', 'F131', 'F132'].slice(0, nr).map(a => mm(num(a)));
      const aL = mm(num('F122')), bL = mm(num('F123')), bp = mm(num('F136')), tp = mm(num('F137')), dw = mm(num('F138'));
      const steel = [86, 118, 160], plate = [120, 150, 190], conc = [190, 190, 186], grout = [228, 214, 170], bar = [60, 64, 72], nut = [40, 44, 50], lcb = [214, 120, 60];
      const box = (x0, x1, y0, y1, z0, z1, col) => m.box([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2], ax, ay, az, col);
      m.tag = 'column'; m.alpha = 0.35; box(-bc / 2, bc / 2, -hc / 2, hc / 2, -H - 0.9, 0.7, conc); m.alpha = null;
      const nl = 0.025, xn = Lx + tp + nl + 1.1 * d;
      [-1, 1].forEach(sg => {
        const xi = sg * (bc / 2 + tg), X0 = v => xi + sg * v; // distance outwards from the inner face of the clamp half
        m.tag = 'grout'; const tot = np * Lp + (np - 1) * gp; for (let i = 0; i < np; i++) { const y0 = -tot / 2 + i * (Lp + gp); box(sg * bc / 2, xi, y0, y0 + Lp, -Hp, 0, grout); }
        m.tag = 'plates'; // inner and outer end plates: full width B over Hm, the lower centre part Bl wide
        [[0, tep], [Lx - tep, Lx]].forEach(([a, b]) => { box(X0(a), X0(b), -B / 2, B / 2, -Hm, 0, plate); if (H > Hm + 1e-6) box(X0(a), X0(b), -Bl / 2, Bl / 2, -H, -Hm, plate); });
        m.tag = 'web'; zw.forEach(z => { const w = z < Hm ? B : Bl; box(X0(tep), X0(Lx - tep), -w / 2, w / 2, -z - twp / 2, -z + twp / 2, steel); });
        m.tag = 'diaphragm'; box(X0(tep), X0(Lx - tep), -tcd / 2, tcd / 2, -H, pd, steel);
        m.tag = 'stiffener'; ys.forEach(y => [-1, 1].forEach(k => box(X0(tep), X0(tep + Lst), k * y - tst / 2, k * y + tst / 2, -H, 0, steel)));
        const zc = zw.filter(z => z < Hm), zt = zc.length ? Math.min(...zc) : 0, zbt = zc.length ? Math.max(...zc) : Hm;
        m.tag = 'cell'; [yc1, yc2].forEach(y => [-1, 1].forEach(k => box(X0(tep), X0(Lx - tep), k * y - tcw / 2, k * y + tcw / 2, -zbt, -zt, steel)));
        m.tag = 'bars';
        zb.forEach(z => [-1, 1].forEach(k => { const y = k * gb / 2; box(X0(Lx), X0(Lx + tp), y - bp / 2, y + bp / 2, -z - bp / 2, -z + bp / 2, plate); m.rod([X0(Lx + tp), y, -z], [X0(Lx + tp + nl), y, -z], dw / 2, nut, null, 16); m.rod([X0(Lx + tp + nl), y, -z], [X0(xn), y, -z], 0.85 * d, nut, null, 6); }));
        m.tag = 'lcb'; m.alpha = 0.3; box(sg * (bc / 2 + aL), sg * (bc / 2 + aL + bL), -B / 2, B / 2, pd, pd + 0.25, lcb); m.alpha = null;
      });
      m.tag = 'bars'; const xe = bc / 2 + tg + xn + 0.03;
      zb.forEach(z => [-1, 1].forEach(k => m.rod([-xe, k * gb / 2, -z], [xe, k * gb / 2, -z], d / 2, bar, null, 14)));
      return { mesh: m, span: Math.max(2 * xe, B, H + 1.6), H };
    }
    function mount3D() {
      const cv = $('#cc3d'); if (!cv || !G.SC3D || !A.book) return;
      let sc; try { sc = scene(); } catch (e) { return; }
      const v = cv._v || new G.SC3D.Viewer(cv, A.cam || { yaw: -0.85, pitch: 0.42, dist: sc.span * 1.45, tx: 0, ty: 0, tz: -sc.H / 2 });
      cv._v = v; v.mesh = sc.mesh; v.marks = []; v.onchange = c => { A.cam = Object.assign({}, c); };
      const dark = document.documentElement.dataset.theme === 'dark';
      v.bg = dark ? [24, 28, 36] : [250, 251, 253];
      const NM = { column: T('Existing concrete column', 'เสาคอนกรีตเดิม'), grout: T('Grout pad', 'แผ่นเกราท์'), plates: T('End plate', 'แผ่นปลาย'), web: T('Web plate', 'แผ่นเอว'), diaphragm: T('Centre diaphragm', 'ไดอะแฟรมกลาง'), stiffener: T('Stiffener', 'แผ่นเสริมกำลัง'), cell: T('Bar cell wall', 'ผนังช่องเหล็กอัดแรง'), bars: T('Stress bar, bearing plate and nut', 'เหล็กอัดแรง แผ่นรับแรง และน็อต'), lcb: 'LCB' };
      v.fmtPick = sel => [NM[sel.tag] || sel.tag];
      v.onpick = sel => { const p = $('#cc3dpick'); if (p) p.textContent = sel ? NM[sel.tag] || '' : ''; };
      v.draw();
    }

    // ------------------------------------------------------------------ drawings (XY-scatter sketches of the workbook)
    const drawTitle = i => { const ch = A.book.S[DRAW].sh.charts[i], top = ch.from[2] + 1; let r = top; for (; r > 0; r--) { const v = A.book.get(DRAW, 'A' + r); if (typeof v === 'string' && /COLUMN CLAMP/.test(v)) return v.replace(/^.*?COLUMN CLAMP \(CC\)\s+-\s+/, ''); } return T('Drawing ', 'แบบ ') + (i + 1); };
    function drawList() { return [['arr', T('Arrangement (4 views)', 'ภาพรวม (4 มุมมอง)')]].concat(A.book.S[DRAW].sh.charts.map((c, i) => ['d' + i, drawTitle(i)])); }
    function chartHTML(name, i, wmax) {
      const s = A.book.S[name].sh, ch = s.charts[i], g = G.XLSHEET.geom(s);
      const px = a => [g.colX[a[0] + 1] + a[1] / 9525, g.rowY[a[2] + 1] + a[3] / 9525], p = px(ch.from), q = px(ch.to), w = Math.round(q[0] - p[0]), h = Math.round(q[1] - p[1]);
      return `<div class="cc-fig" style="max-width:${wmax || w}px"><div class="cc-figin" style="aspect-ratio:${w}/${h}">${G.XLSHEET.chartSVG(A.book, s, ch, w, h).replace('<svg ', '<svg preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%" ')}</div></div>`;
    }
    function drawHTML() {
      if (A.draw === 'arr') { const cs = sh().charts.map((c, i) => [c, i]).filter(([c]) => c.from[2] < 55); return `<div class="cc-grid2">${cs.map(([, i]) => chartHTML(CALC, i)).join('')}</div>`; }
      return chartHTML(DRAW, +A.draw.slice(1));
    }

    // ------------------------------------------------------------------ page
    const field = it => {
      const opts = G.XLSHEET.geom(sh()).val[it.a], c = A.book.cell(CALC, it.a), v = c ? c.v : '';
      const ctl = opts ? `<select data-cc="${it.a}">${opts.map(o => `<option ${String(o) === String(v) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`
        : `<input data-cc="${it.a}" ${typeof (c && c.x0) === 'number' ? 'type="number" step="any" inputmode="decimal"' : 'type="text"'} value="${esc(v == null ? '' : v)}">`;
      const wide = (opts && opts.some(o => String(o).length > 14)) || (!opts && typeof v === 'string' && String(v).length > 10);
      return `<div class="fld${wide ? ' fld-wide' : ''}"${it.note ? ` title="${esc(it.note)}"` : ''}><label>${esc(it.l)}${it.sym && it.sym !== '-' ? ` <i class="cc-sym">${esc(it.sym)}</i>` : ''}</label><div class="ctl">${ctl}${it.u && it.u !== '-' ? `<span class="unit">${esc(it.u)}</span>` : ''}</div></div>`;
    };
    function inputsHTML() {
      let last = '';
      return groups().map((g, i) => { const sec = g.sec && g.sec !== last ? (last = g.sec, `<p class="cc-insec">${esc(g.sec.replace(/\s*\(.*$/, ''))}</p>`) : ''; return sec + `<details class="grp"${i < 8 ? ' open' : ''}><summary>${esc(g.name)}</summary><div class="grp-b">${g.items.map(field).join('')}</div></details>`; }).join('');
    }
    const urClass = u => (u > 1.0001 ? 'bad' : u > 0.9 ? 'warn' : 'ok');
    const urCell = u => `<div class="urb"><div class="ur"><i style="width:${Math.min(100, u * 100)}%"></i></div><b class="mono">${f(u, 2)}</b></div>`;
    function outHTML() {
      const C = summary(), worst = C.reduce((a, b) => (b.ur > a.ur ? b : a), C[0] || { ur: 0, name: '' }), pass = C.every(c => c.ok), Wd = welds();
      const kv = [[T('Clamp force per face N_Ed', 'แรงบีบต่อด้าน N_Ed'), fmtCell('F196') + ' kN'], [T('Stress bars', 'เหล็กอัดแรง'), `${num('F125')} × Ø${num('F128')} · P₀ = ${fmtCell('F188')} kN`], [T('Clamp half L × B × H', 'แคลมป์ครึ่งซีก L × B × H'), `${num('F85')} × ${num('F88')} × ${num('F86')} mm`], [T('LCB reaction V_Ed', 'แรงปฏิกิริยา V_Ed'), num('F72') + ' kN'], [T('Steel', 'เหล็ก'), txt(cellV('F58'))]];
      return `<div class="out-top"><div class="sketch-card"><h2 class="card-h">${T('3D model', 'แบบจำลอง 3 มิติ')}</h2><div class="cc-3dw"><canvas id="cc3d" tabindex="0" aria-label="${T('3D model of the column clamp', 'แบบจำลอง 3 มิติของแคลมป์เสา')}"></canvas><span class="cc-pick" id="cc3dpick"></span></div><p class="hint">${T('Drag to rotate · wheel to zoom · right-drag to pan · click a part to name it. The model follows the inputs.', 'ลากเพื่อหมุน · ล้อเมาส์ซูม · คลิกขวาลากเลื่อน · คลิกชิ้นส่วนเพื่อดูชื่อ แบบจำลองเปลี่ยนตามค่าที่ใส่')}</p></div>
          <div class="sum-card"><div class="sum ${pass ? 'ok' : 'bad'}"><span class="sum-l">${T('Overall', 'สรุปผล')}</span><b class="sum-v">${pass ? T('PASS', 'ผ่าน') : T('FAIL', 'ไม่ผ่าน')}</b><span class="sum-u">UR<sub>max</sub> = <b class="mono">${f(worst.ur, 3)}</b></span><span class="sum-g">${T('Governing', 'วิกฤต')}: ${esc(worst.name)}</span></div>
            <dl class="kv">${kv.map(([k, v]) => `<dt>${k}</dt><dd class="mono">${esc(v)}</dd>`).join('')}</dl></div></div>
        <div class="card"><div class="cc-dh"><h2 class="card-h">${T('Drawings', 'แบบ')}</h2><select id="ccDraw" aria-label="${T('Drawing', 'แบบ')}">${drawList().map(([k, l]) => `<option value="${k}"${A.draw === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div><div id="ccDrawing">${drawHTML()}</div></div>
        <div class="card"><h2 class="card-h">${T('Design checks', 'ผลการตรวจสอบ')} (${C.length})</h2><div class="tbl-wrap"><table class="chk"><thead><tr><th>${T('Check', 'รายการ')}</th><th>UR</th></tr></thead><tbody>
          ${C.map(c => `<tr class="${urClass(c.ur)}"><td>${esc(c.name)}</td><td>${urCell(c.ur)}</td></tr>`).join('')}</tbody></table></div></div>
        <div class="card"><h2 class="card-h">${T('Welds', 'รอยเชื่อม')}</h2><div class="tbl-wrap"><table class="chk"><thead><tr><th>${T('Weld', 'รอยเชื่อม')}</th><th>${T('Joint, type and size', 'ตำแหน่ง ชนิด และขนาด')}</th><th>${T('Throat; force / resistance', 'ความหนาคอ; แรง / กำลัง')}</th><th>UR</th></tr></thead><tbody>
          ${Wd.map(w => `<tr class="${w.st === 'n/a' ? '' : urClass(w.ur)}"><td><b>${esc(w.w)}</b></td><td>${esc(w.d)}</td><td class="mono small">${esc(w.j)}</td><td>${w.st === 'n/a' ? 'n/a' : urCell(w.ur)}</td></tr>`).join('')}</tbody></table></div></div>`;
    }
    function page() {
      if (!isPro()) return `<main class="wrap page design" id="ccRoot"><div class="card cc-lockc"><h2>🔒 ${T('Prestressed column clamp — Pro', 'แคลมป์เสาอัดแรง — สำหรับสมาชิก Pro')}</h2><p class="muted">${T('Stress bars, friction on the existing column, grout bearing, the welded clamp box and every weld, to EN 1993-1-1, EN 1993-1-8 and EN 1992-1-1, with a 3D model and live drawings. Sign in with a Pro account to use it.', 'เหล็กอัดแรง แรงเสียดทานบนเสาเดิม แรงแบกทานของเกราท์ กล่องแคลมป์เหล็กเชื่อม และรอยเชื่อมทุกจุด ตาม EN 1993-1-1, EN 1993-1-8 และ EN 1992-1-1 พร้อมแบบจำลอง 3 มิติและแบบที่เปลี่ยนตามค่า เข้าสู่ระบบด้วยบัญชี Pro เพื่อใช้งาน')}</p><div class="cn-btns"><button class="btn btn-hot sm" data-act="nav" data-v="login">${T('Sign in', 'เข้าสู่ระบบ')}</button></div></div></main>`;
      if (!A.book) return `<main class="wrap page design" id="ccRoot"><p class="muted cc-loading">${A.err ? T('Could not load the calculation: ', 'โหลดรายการคำนวณไม่ได้: ') + esc(A.err) : T('Loading the calculation…', 'กำลังโหลดรายการคำนวณ…')}</p></main>`;
      return `<main class="wrap page design cc-page" id="ccRoot">
        <div class="crumbs"><button data-act="nav" data-v="home">${T('Main menu', 'เมนูหลัก')}</button><span>/</span><span>${T('Special design', 'งานออกแบบพิเศษ')}</span><span>/</span><span>${T('Prestressed column clamp', 'แคลมป์เสาอัดแรง')}</span></div>
        <div class="dz-head tone-eu"><div><p class="eyebrow">EN 1993-1-1 · EN 1993-1-8 · EN 1992-1-1</p><h1>${T('Prestressed column clamp design', 'ออกแบบแคลมป์เสาอัดแรง')}</h1><p class="muted small cc-lockt">🔒 ${T('Calculation locked — only the inputs can be changed', 'รายการคำนวณถูกล็อก — แก้ได้เฉพาะค่าที่ใส่')}</p></div>
          <div class="dz-actions"><button class="btn btn-ghost sm" data-act="cc-reset">${T('Reset example', 'คืนค่าตัวอย่าง')}</button><button class="btn btn-ghost sm" data-act="cc-save">${T('Save inputs', 'บันทึกค่า')}</button><label class="btn btn-ghost sm">${T('Open inputs', 'เปิดค่า')}<input type="file" accept=".json" id="cc-file" hidden></label><button class="btn btn-hot sm" data-act="cc-report">${T('Full calculation', 'รายการคำนวณฉบับเต็ม')}</button></div></div>
        <div class="dz"><aside class="dz-in cc-in" id="ccIn" aria-label="${T('Inputs', 'ข้อมูลนำเข้า')}">${inputsHTML()}</aside><section class="dz-out" id="ccOut" aria-live="polite">${outHTML()}</section></div>
        <div id="reportWrap"></div></main>`;
    }
    const view = () => page();
    function after() { mount3D(); }
    function refreshOut() { const o = $('#ccOut'); if (!o) return; o.innerHTML = outHTML(); mount3D(); if (S.reportOpen && $('#report')) renderReport(true); }

    // ------------------------------------------------------------------ full calculation as an HTML report
    function renderReport(quiet) {
      const rs = rowsOf(), secs = []; let cur = null;
      const charts = sh().charts.map((c, i) => ({ r: c.from[2] + 1, i }));
      rs.forEach(r => { if (r < 9) return; if (isHead(r)) { cur = { t: String(sh().cells['A' + r].v), r, rows: [] }; secs.push(cur); return; } if (cur) cur.rows.push(r); });
      const html = secs.map((s, k) => {
        const nx = secs[k + 1] ? secs[k + 1].r : 1e9, figs = charts.filter(c => c.r >= s.r && c.r < nx);
        let body = '';
        if (/^SUMMARY OF RESULTS/.test(s.t)) {
          body = `<table class="rp-t an-rp"><thead><tr><th>${T('Check', 'รายการ')}</th><th class="num">UR</th><th>${T('Limit', 'เกณฑ์')}</th><th>${T('Status', 'ผล')}</th></tr></thead><tbody>${summary().map(c => `<tr><td>${esc(c.name)}</td><td class="num mono">${f(c.ur, 3)}</td><td>≤ 1.0</td><td class="${c.ok ? 'ok' : 'bad'}"><b>${c.ok ? 'OK' : 'N.G.'}</b></td></tr>`).join('')}</tbody></table><p class="rp-txt"><b>${esc(txt(cellV('F933')))}</b></p>`;
        } else if (/^WELD DETAILS/.test(s.t)) {
          body = `<table class="rp-t an-rp"><thead><tr><th>${T('Weld', 'รอยเชื่อม')}</th><th>${T('Joint, type and size', 'ตำแหน่ง ชนิด และขนาด')}</th><th class="num">UR</th><th>${T('Status', 'ผล')}</th><th>${T('Throat; force / resistance', 'ความหนาคอ; แรง / กำลัง')}</th></tr></thead><tbody>${welds().map(w => `<tr><td><b>${esc(w.w)}</b></td><td>${esc(w.d)}</td><td class="num mono">${f(w.ur, 3)}</td><td class="${w.st === 'N.G.' ? 'bad' : 'ok'}"><b>${esc(w.st)}</b></td><td class="mono">${esc(w.j)}</td></tr>`).join('')}</tbody></table>`;
        } else {
          let tb = [];
          const flush = () => { if (tb.length) { body += `<table class="rp-t cc-rt"><tbody>${tb.join('')}</tbody></table>`; tb = []; } };
          s.rows.forEach(r => {
            const c = sh().cells['C' + r], cv = c ? cellV('C' + r) : null, ref = txt(cellV('A' + r)), fv = sh().cells['F' + r], st = txt(cellV('I' + r)), note = txt(cellV('J' + r));
            if (isSub(r)) { flush(); body += `<h4 class="cc-h4">${esc(cv)}</h4>`; return; }
            if (c && c.f && !fv) { const t = txt(cv); if (t.trim()) tb.push(`<tr class="cc-eqr"><td></td><td colspan="4" class="cc-eq">${esc(t)}</td></tr>`); return; }
            if (!c && ref && !fv) { if (ref.length > 30) { flush(); body += `<p class="rp-txt cc-note">${esc(ref)}</p>`; } return; }
            if (!c && !fv) return;
            const unit = txt(cellV('G' + r)), sym = txt(cellV('D' + r)), lim = txt(cellV('H' + r)), v = fv ? fmtCell('F' + r) : '';
            tb.push(`<tr><td class="cc-ref">${esc(ref)}</td><td>${esc(txt(cv).replace(/;\s*$/, ''))}${note ? `<div class="cc-rn">${esc(note)}</div>` : ''}</td><td class="cc-sy">${sym && sym !== '-' ? esc(sym) : ''}</td><td class="num mono"><b>${esc(v)}</b>${unit && unit !== '-' ? ` <span class="u">${esc(unit)}</span>` : ''}</td><td class="cc-st">${st === 'OK' || st === 'N.G.' ? `<b class="${st === 'OK' ? 'ok' : 'bad'}">${st}</b> <span class="u">${esc(lim)}</span>` : ''}</td></tr>`);
          });
          flush();
        }
        if (figs.length) body = `<div class="cc-rfigs">${figs.map(c => `<figure>${chartHTML(CALC, c.i, 520)}</figure>`).join('')}</div>` + body;
        return `<section class="rp-sec"><h3><span class="rp-n">${k + 1}</span>${esc(s.t.replace(/^\d+\.\s*/, ''))}</h3>${body}</section>`;
      }).join('') + `<section class="rp-sec"><h3><span class="rp-n">${secs.length + 1}</span>${T('Drawings', 'แบบ')}</h3>${A.book.S[DRAW].sh.charts.map((c, i) => `<figure class="cc-rdf"><figcaption>${esc(drawTitle(i))}</figcaption>${chartHTML(DRAW, i, 760)}</figure>`).join('')}</section>`;
      const g = k => esc(txt(cellV(k)));
      $('#reportWrap').innerHTML = `<div class="rp-bar"><h2>${T('Column clamp calculation', 'รายการคำนวณแคลมป์เสา')}</h2><div class="rp-btns"><button class="btn btn-hot sm" data-act="pdf" id="pdfBtn">${T('Export PDF', 'ส่งออก PDF')}</button><button class="btn btn-ghost sm" data-act="closeReport">${T('Close', 'ปิด')}</button></div></div>
        <article class="report" id="report" lang="${S.ui}"><header class="rp-head"><div class="rp-brand">${logoMark(34)}<div><b>StructCap</b><small>${T('Prestressed column clamp', 'แคลมป์เสาอัดแรง')}</small></div></div>
          <table class="rp-hd"><tr><th>${T('Project No.', 'เลขที่โครงการ')}</th><td>${g('D4')}</td><th>${T('Element', 'ชิ้นส่วน')}</th><td>${g('G4')}</td></tr><tr><th>${T('Designed by', 'ออกแบบ')}</th><td>${g('D5')}</td><th>${T('Checked by', 'ตรวจสอบ')}</th><td>${g('G5')}</td></tr><tr><th>${T('Date', 'วันที่')}</th><td>${today()}</td><th>${T('Revision', 'ฉบับแก้ไข')}</th><td>${g('G6')}</td></tr></table></header>
          <p class="rp-txt"><b>${esc(txt(cellV('A1')))}</b><br><span class="muted">${esc(txt(cellV('A2')))}</span></p>
          ${html}<p class="rp-foot"><b>${COPY}</b> · ${T('Generated by StructCap from the column clamp calculation (', 'จัดทำโดย StructCap จากรายการคำนวณแคลมป์เสา (') + esc(A.book.model.src) + T('). The engineer remains responsible for the inputs and the interpretation of the results.', ') วิศวกรต้องรับผิดชอบต่อข้อมูลที่ใส่และการแปลผล')}</p></article>`;
      S.reportOpen = true; if (!quiet) { const w = $('#reportWrap'); if (w) w.scrollIntoView({ behavior: 'smooth' }); }
    }

    // ------------------------------------------------------------------ events
    function setInput(a, raw) {
      const c = A.book.cell(CALC, a), s = String(raw).trim(), v = typeof c.x0 === 'number' && s !== '' && isFinite(+s) ? +s : s;
      A.book.set(CALC, a, v); store.set({ inputs: saved() });
    }
    function onClick(a) {
      if (!A.book) return false;
      if (a === 'cc-report') { renderReport(); return true; }
      if (a === 'cc-reset') { if (!confirm(T('Go back to the example inputs of the workbook?', 'กลับไปใช้ค่าตัวอย่างของไฟล์?'))) return true; inputs().forEach(x => { const c = A.book.cell(CALC, x); A.book.set(CALC, x, c.x0); }); store.set({ inputs: {} }); const i = $('#ccIn'); if (i) i.innerHTML = inputsHTML(); refreshOut(); toast(T('Example inputs restored', 'คืนค่าตัวอย่างแล้ว'), 'ok'); return true; }
      if (a === 'cc-save') { saveFile('column-clamp_inputs_' + today() + '.json', new Blob([JSON.stringify({ app: 'StructCap Column Clamp', src: A.book.model.src, inputs: Object.fromEntries(inputs().map(x => [x, A.book.cell(CALC, x).v])) }, null, 1)], { type: 'application/json' })); return true; }
      return false;
    }
    const onInput = () => false;
    let bound = false;
    function mount() {
      load(); if (A.book) after();
      if (bound) return; bound = true;
      document.addEventListener('input', e => { const t = e.target; if (S.view !== VIEW || !t || !t.dataset || !t.dataset.cc || !A.book) return; clearTimeout(A.t); const run = () => { setInput(t.dataset.cc, t.value); refreshOut(); }; if (t.tagName === 'SELECT') run(); else A.t = setTimeout(run, 400); });
      document.addEventListener('change', e => {
        const t = e.target; if (S.view !== VIEW || !t) return;
        if (t.id === 'ccDraw') { A.draw = t.value; const d = $('#ccDrawing'); if (d) d.innerHTML = drawHTML(); return; }
        if (t.dataset && t.dataset.cc && t.tagName === 'INPUT') { clearTimeout(A.t); setInput(t.dataset.cc, t.value); refreshOut(); return; }
        if (t.id === 'cc-file') { const fl = t.files[0]; if (!fl) return; fl.text().then(tx => { try { const j = JSON.parse(tx), I = j.inputs || j; let n = 0; Object.entries(I).forEach(([k, v]) => { if (inputs().includes(k)) { A.book.set(CALC, k, v); n++; } }); if (!n) throw 0; store.set({ inputs: saved() }); const i = $('#ccIn'); if (i) i.innerHTML = inputsHTML(); refreshOut(); toast(n + T(' inputs loaded', ' ค่าโหลดแล้ว'), 'ok'); } catch (er) { toast(T('That is not a column clamp input file.', 'ไฟล์นี้ไม่ใช่ไฟล์ค่าของแคลมป์เสา'), 'bad'); } }); t.value = ''; }
      });
      window.addEventListener('resize', () => { if (S.view === VIEW) { const c = $('#cc3d'); if (c && c._v) c._v.draw(); } });
    }
    return { view, mount, onClick, onInput, state: A, renderReport };
  };
})(typeof window !== 'undefined' ? window : globalThis);
