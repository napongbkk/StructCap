/* StructCap House — automatic structural calculation report (รายการคำนวณโครงสร้าง), Thai engineering style.
   Pure string builder (no DOM): HOUSERPT.html(H, A, D, Q, ctx) -> HTML for <div class="report">. Uses the app's .rp-* classes;
   extra styles are scoped under .hrp. Numbers come from house.js (A, D) and housebbs.js (Q); small intermediate
   quantities (ρb, φVc, Pc, As,req …) are recomputed from H.mat with the engine's own formulas. Units ksc, kg, t, t·m, cm, cm². */
(function (G) {
  'use strict';
  const sq = Math.sqrt, max = Math.max, min = Math.min, abs = Math.abs, PI = Math.PI, round = Math.round, floor = Math.floor;
  const fin = v => v != null && isFinite(v);
  const f = (v, d) => (fin(v) ? (+v).toFixed(d == null ? 2 : d) : '—');
  const fk = v => (fin(v) ? (round(v) || 0).toLocaleString('en-US') : '—');
  const CSS = `<style>
.hrp{font-size:12.5px}.hrp table{width:100%;border-collapse:collapse}
.hrp .rp-t td{font-size:12px}.hrp .rp-t .rp-l{width:24%}.hrp .rp-t .rp-ex{width:44%}.hrp .rp-t .num{width:20%;white-space:nowrap}
.hrp .rp-chk .rp-v{text-align:center;width:12%}.hrp tr.rp-chk.bad td{background:#FDF0F1}.hrp tr.rp-chk.ok td{background:#EEF9F3}
.hrp .hrp-sub td{font-weight:700;padding:7px 6px 3px;border-bottom:1px solid #D5DBE5;color:#141B2B}
.hrp .hrp-d{margin:6px 0 10px}.hrp .hrp-d th{font-size:11px;text-align:left;padding:4px 5px;border-bottom:1.5px solid #141B2B;color:#5A6478;font-weight:600}
.hrp .hrp-d td{font-size:11.5px;padding:3px 5px;border-bottom:1px solid #E3E8EF;font-variant-numeric:tabular-nums}
.hrp .hrp-d td.r,.hrp .hrp-d th.r{text-align:right}.hrp .hrp-d tr.tot td{font-weight:700;border-top:1.5px solid #141B2B}
.hrp .hrp-ok{color:#0C7A42;font-weight:700}.hrp .hrp-ng{color:#B3202E;font-weight:700}
.hrp .hrp-title{text-align:center;margin:18px 0 6px}.hrp .hrp-title h2{font-size:22px;margin:0}.hrp .hrp-title p{margin:4px 0 0;color:#5A6478}
.hrp .hrp-loc{font-size:11.5px;color:#5A6478;margin:2px 0 6px}.hrp .hrp-loc b{color:#141B2B}
.hrp .rp-n{width:auto;padding:0 6px}.hrp .hrp-blk{display:grid;grid-template-columns:minmax(0,1fr) 150px;gap:14px;align-items:start}
.hrp figure{margin:6px 0;text-align:center}.hrp figure svg{max-width:100%;height:auto}.hrp .hrp-blk figure{margin-top:28px}.hrp figcaption{font-size:11px;color:#5A6478}
.hrp .hrp-plans{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.hrp ul.hrp-ref{margin:4px 0 0 18px;padding:0;font-size:12px}.hrp .hrp-warn{color:#B3202E;font-size:12px;margin:4px 0}
@media (max-width:700px){.hrp .hrp-blk,.hrp .hrp-plans{grid-template-columns:1fr}}
</style>`;

  function html(H, A, D, Q, ctx) {
    ctx = ctx || {}; const X = G.HOUSE, BB = G.HOUSEBBS;
    const esc = ctx.esc || (s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
    const M = H.mat, fc = M.fc, fy = M.fy, fys = M.fys, b1 = X.beta1(fc), rb = X.rhoB(fc, fy), rmax = 0.75 * rb, sfc = sq(fc), Ec = 15100 * sfc;
    const S = X.stories(H), xn = i => esc(H.grid.xn[i] != null ? H.grid.xn[i] : i + 1), yn = j => esc(H.grid.yn[j] != null ? H.grid.yn[j] : String.fromCharCode(65 + j));
    const stN = id => esc((H.stories.find(s => s.id === id) || { name: id }).name), bA = k => X.barA(k), bD = k => X.barD(k);
    // ---- markup helpers (app classes)
    const tr = (l, ex, v, u, note) => `<tr><td class="rp-l">${l}</td><td class="rp-ex">${ex || ''}</td><td class="num mono">${v === '' || v == null ? '' : '= ' + v} ${u || ''}</td><td class="rp-note">${note || ''}</td></tr>`;
    const ck = (l, ex, ok, v) => `<tr class="rp-chk ${ok ? 'ok' : 'bad'}"><td>${l}</td><td class="rp-ex">${ex}</td><td class="num mono">${v || ''}</td><td class="rp-v">${ok ? 'OK' : 'NG'}</td></tr>`;
    const sub = t => `<tr class="hrp-sub"><td colspan="4">${t}</td></tr>`;
    const T = rows => `<table class="rp-t">${rows.join('')}</table>`;
    const OK = ok => (ok ? '<span class="hrp-ok">OK</span>' : '<span class="hrp-ng">NG</span>');
    const dt = (head, rows, foot) => `<table class="hrp-d"><thead><tr>${head.map(h => `<th${/^[~]/.test(h) ? ' class="r"' : ''}>${h.replace(/^~/, '')}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, k) => `<td${/^~/.test(head[k]) ? ' class="r"' : ''}>${c}</td>`).join('')}</tr>`).join('')}${foot || ''}</tbody></table>`;
    const sec = (n, title, body, cl) => `<section class="rp-sec"><h3><span class="rp-n">${n}</span>${title}${cl ? `<span class="rp-cl">${cl}</span>` : ''}</h3>${body}</section>`;
    const warnL = w => (w && w.length ? w.map(x => `<p class="hrp-warn">⚠ ${esc(x)}</p>`).join('') : '');
    const groups = list => { const m = new Map(); list.forEach(x => { if (!x.mark) return; if (!m.has(x.mark)) m.set(x.mark, []); m.get(x.mark).push(x); }); return [...m.entries()]; };
    const loc = s => { const g = new Map(); s.forEach(x => { const [a, b] = Array.isArray(x) ? x : ['', x]; if (!g.has(a)) g.set(a, []); g.get(a).push(b); }); return `<p class="hrp-loc">ตำแหน่ง (${s.length} แห่ง): ${[...g].map(([a, l]) => `${a ? a + ': ' : ''}<b>${l.join(', ')}</b>`).join(' · ')}</p>`; };
    const barTxt = (n, k) => `${n}-${k}`, atTxt = (k, s) => `${k} @ ${f(s, 1)} ซม.`;
    const CODE = 'ว.ส.ท. 1008 / ACI 318', fu = X.uFac ? X.uFac(H) : { D: 1.4, L: 1.7 }, U1 = (A.combos || []).find(c => c.id === 'U1'), U1n = U1 ? esc(U1.name) : '1.4D + 1.7L';
    const sumD = X.summary(D);

    // ---- sketches (plain SVG, explicit colours)
    const svgW = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="sans-serif">${body}</svg>`;
    const txt = (x, y, s, o) => `<text x="${f(x, 1)}" y="${f(y, 1)}" font-size="${(o && o.fs) || 11}" fill="${(o && o.c) || '#141B2B'}" text-anchor="${(o && o.a) || 'middle'}"${o && o.rot ? ` transform="rotate(${o.rot} ${f(x, 1)} ${f(y, 1)})"` : ''}>${s}</text>`;
    function rectSec(b, h, cov, tieD, pts, barK, label) { // pts in cm from the section centre
      const sc = 130 / max(b, h), W = b * sc, Hh = h * sc, x0 = 30, y0 = 14, c = (cov + tieD / 20) * sc, r = max(2.2, bD(barK) / 20 * sc);
      let s = `<rect x="${x0}" y="${y0}" width="${f(W, 1)}" height="${f(Hh, 1)}" fill="#E4EAF3" stroke="#141B2B" stroke-width="1.5"/>`;
      s += `<rect x="${f(x0 + cov * sc, 1)}" y="${f(y0 + cov * sc, 1)}" width="${f(W - 2 * cov * sc, 1)}" height="${f(Hh - 2 * cov * sc, 1)}" rx="3" fill="none" stroke="#2E6BFF" stroke-width="1.4"/>`;
      pts.forEach(([u, v, k]) => { s += `<circle cx="${f(x0 + W / 2 + u * sc, 1)}" cy="${f(y0 + Hh / 2 + v * sc, 1)}" r="${f(k ? max(2.2, bD(k) / 20 * sc) : r, 1)}" fill="#141B2B"/>`; });
      s += txt(x0 + W / 2, y0 + Hh + 16, `${b} ซม.`) + txt(x0 - 8, y0 + Hh / 2, `${h} ซม.`, { rot: -90 });
      return `<figure>${svgW(x0 + W + 20, y0 + Hh + 24, s)}<figcaption>${label}</figcaption></figure>`; void c;
    }
    const rowPts = (n, y, b, cov, tieD, k) => { const e = b / 2 - cov - tieD / 10 - bD(k) / 20, out = []; for (let q = 0; q < n; q++) out.push([n > 1 ? -e + 2 * e * q / (n - 1) : 0, y, k]); return out; };
    const perim = (n, b, h) => (BB && BB.perimeterPts ? BB.perimeterPts(n, b, h) : [[-b / 2, -h / 2], [b / 2, -h / 2], [b / 2, h / 2], [-b / 2, h / 2]]);
    function planSVG(st) {
      const gx = H.grid.x, gy = H.grid.y, Wm = gx[gx.length - 1] - gx[0], Hm = gy[gy.length - 1] - gy[0], sc = 300 / max(Wm, Hm, 1), ox = 26, oy = 18, P = (x, y) => [ox + (x - gx[0]) * sc, oy + (Hm - (y - gy[0])) * sc];
      let s = '';
      gx.forEach((x, i) => { const [a, b0] = P(x, gy[0]), [, b1y] = P(x, gy[gy.length - 1]); s += `<line x1="${f(a, 1)}" y1="${f(b0 + 8, 1)}" x2="${f(a, 1)}" y2="${f(b1y - 8, 1)}" stroke="#B9C3D3" stroke-dasharray="4 3"/>` + txt(a, b0 + 20, xn(i), { fs: 10, c: '#5A6478' }); });
      gy.forEach((y, j) => { const [a, b0] = P(gx[0], y), [a1] = P(gx[gx.length - 1], y); s += `<line x1="${f(a - 8, 1)}" y1="${f(b0, 1)}" x2="${f(a1 + 8, 1)}" y2="${f(b0, 1)}" stroke="#B9C3D3" stroke-dasharray="4 3"/>` + txt(a - 16, b0 + 4, yn(j), { fs: 10, c: '#5A6478' }); });
      D.slabs.filter(sd => { const q = H.slabs.find(z => z.id === sd.id); return q && q.st === st.id; }).forEach(sd => { const q = H.slabs.find(z => z.id === sd.id), [cx, cy] = P((gx[q.i] + gx[q.i + 1]) / 2, (gy[q.j] + gy[q.j + 1]) / 2); s += txt(cx, cy + 4, esc(sd.mark || ''), { fs: 10, c: '#00897B' }); });
      H.stairs.filter(t => t.st === st.id).forEach((t, k) => { const [x1, y1] = P(gx[t.i], gy[t.j + 1]), [x2, y2] = P(gx[t.i + 1], gy[t.j]); s += `<rect x="${f(x1 + 6, 1)}" y="${f(y1 + 6, 1)}" width="${f(x2 - x1 - 12, 1)}" height="${f(y2 - y1 - 12, 1)}" fill="none" stroke="#FF6A2B" stroke-dasharray="3 2"/>` + txt((x1 + x2) / 2, (y1 + y2) / 2 + 18, 'ST' + (H.stairs.indexOf(t) + 1), { fs: 10, c: '#FF6A2B' }); void k; });
      D.beams.filter(b => b.st === st.id && b.mark).forEach(b => { const [x1, y1] = P(gx[b.a[0]], gy[b.a[1]]), [x2, y2] = P(gx[b.bb[0]], gy[b.bb[1]]), v = abs(x1 - x2) < 1; s += `<line x1="${f(x1, 1)}" y1="${f(y1, 1)}" x2="${f(x2, 1)}" y2="${f(y2, 1)}" stroke="${b.ok ? '#2E6BFF' : '#D8303F'}" stroke-width="2.4"/>` + txt((x1 + x2) / 2 + (v ? 4 : 0), (y1 + y2) / 2 - (v ? 0 : 4), esc(b.mark), { fs: 9.5, a: v ? 'start' : 'middle', c: '#141B2B' }); });
      const k = X.stIdx(H, st.id);
      H.columns.filter(c => X.stIdx(H, c.top) >= k).forEach(c => { const [x, y] = P(gx[c.i], gy[c.j]); s += `<rect x="${f(x - 4.5, 1)}" y="${f(y - 4.5, 1)}" width="9" height="9" fill="#141B2B"/>`; });
      return `<figure>${svgW(ox + Wm * sc + 26, oy + Hm * sc + 30, s)}<figcaption>แปลน ${stN(st.id)} (z = ${f(st.z)} ม.)</figcaption></figure>`;
    }
    function footSVG(fd, cb, ch) {
      const sc = 150 / max(fd.B, fd.L), W = fd.B * sc, Hh = fd.L * sc, x0 = 30, y0 = 12, cx = x0 + W / 2, cy = y0 + Hh / 2, cv = M.cover.fnd / 100 * sc;
      let s = `<rect x="${x0}" y="${y0}" width="${f(W, 1)}" height="${f(Hh, 1)}" fill="#E4EAF3" stroke="#141B2B" stroke-width="1.5"/>`;
      const nx = min(fd.fx.n, 14), ny = min(fd.fy.n, 14);
      for (let q = 0; q < nx; q++) { const y = y0 + cv + (Hh - 2 * cv) * q / max(1, nx - 1); s += `<line x1="${f(x0 + cv, 1)}" y1="${f(y, 1)}" x2="${f(x0 + W - cv, 1)}" y2="${f(y, 1)}" stroke="#2E6BFF" stroke-width="1"/>`; }
      for (let q = 0; q < ny; q++) { const x = x0 + cv + (W - 2 * cv) * q / max(1, ny - 1); s += `<line x1="${f(x, 1)}" y1="${f(y0 + cv, 1)}" x2="${f(x, 1)}" y2="${f(y0 + Hh - cv, 1)}" stroke="#00A89A" stroke-width="1"/>`; }
      if (fd.pts) { const r = (+H.soil.pile.D || 18) / 200 * sc; fd.pts.forEach(([u, v]) => { s += `<circle cx="${f(cx + u * sc, 1)}" cy="${f(cy - v * sc, 1)}" r="${f(r, 1)}" fill="none" stroke="#FF6A2B" stroke-width="1.6"/>`; }); }
      s += `<rect x="${f(cx - cb / 200 * sc, 1)}" y="${f(cy - ch / 200 * sc, 1)}" width="${f(cb / 100 * sc, 1)}" height="${f(ch / 100 * sc, 1)}" fill="#141B2B"/>`;
      if (!fd.pts) { const d = fd.d / 100 * sc; s += `<rect x="${f(cx - cb / 200 * sc - d / 2, 1)}" y="${f(cy - ch / 200 * sc - d / 2, 1)}" width="${f(cb / 100 * sc + d, 1)}" height="${f(ch / 100 * sc + d, 1)}" fill="none" stroke="#D8303F" stroke-dasharray="3 2"/>`; }
      s += txt(cx, y0 + Hh + 15, `B = ${f(fd.B)} ม.`) + txt(x0 - 9, cy, `L = ${f(fd.L)} ม.`, { rot: -90 });
      return `<figure>${svgW(x0 + W + 16, y0 + Hh + 22, s)}<figcaption>${fd.pts ? 'แปลนฐานรากบนเสาเข็ม' : 'แปลนฐานราก (เส้นประแดง: หน้าตัดวิกฤตเฉือนทะลุ)'}</figcaption></figure>`;
    }
    function trussSVG(R) {
      const tg = R.truss.geom, mem = R.truss.members, span = R.g.span, rise = max(R.g.rise, 0.5), sc = min(680 / span, 200 / rise), ox = 20, oy = 18 + rise * sc, P = k => [ox + tg.nodes[k][0] * sc, oy - tg.nodes[k][1] * sc];
      let s = '';
      tg.mem.forEach((m, k) => { const [x1, y1] = P(m[1]), [x2, y2] = P(m[2]), N = mem[k] ? mem[k].N : 0, c = N > 1 ? '#2E6BFF' : N < -1 ? '#D8303F' : '#8C9BB5'; s += `<line x1="${f(x1, 1)}" y1="${f(y1, 1)}" x2="${f(x2, 1)}" y2="${f(y2, 1)}" stroke="${c}" stroke-width="${m[0] === 'tc' || m[0] === 'bc' ? 2.4 : 1.4}"/>`; });
      tg.mem.forEach((m, k) => { const [x1, y1] = P(m[1]), [x2, y2] = P(m[2]), N = mem[k] ? mem[k].N : 0; if (abs(N) < 1) return; const vt = abs(x1 - x2) < 1, dy = m[0] === 'bc' ? 12 : m[0] === 'tc' ? -4 : 0; s += txt((x1 + x2) / 2 + (vt ? 3 : 0), (y1 + y2) / 2 + dy, fk(N), { fs: 9, c: N > 0 ? '#1F4FC0' : '#B3202E', a: vt ? 'start' : 'middle' }); });
      tg.sup.forEach(k => { const [x, y] = P(k); s += `<path d="M${f(x, 1)} ${f(y, 1)} l-6 10 h12 z" fill="none" stroke="#141B2B"/>`; });
      return `<figure>${svgW(ox * 2 + span * sc, oy + 30, s)}<figcaption>แรงในชิ้นส่วนโครงถัก (D + L, kg) — น้ำเงิน: แรงดึง (+), แดง: แรงอัด (−)</figcaption></figure>`;
    }

    // ================================================================== header, verdict
    const mt = H.meta || {};
    let out = `<header class="rp-head"><div class="rp-brand">${ctx.logo || ''}<div><b>StructCap</b><small>House · SDM / ASD</small></div></div>
<table class="rp-hd"><tr><th>โครงการ</th><td>${esc(mt.project)}</td><th>เจ้าของ</th><td>${esc(mt.owner)}</td></tr><tr><th>สถานที่</th><td>${esc(mt.location)}</td><th>วันที่</th><td>${esc(ctx.date || mt.date || '')}</td></tr><tr><th>วิศวกรผู้ออกแบบ</th><td>${esc(mt.engineer)}${mt.license ? ' (ก.ว. ' + esc(mt.license) + ')' : ''}</td><th>ผู้ตรวจสอบ</th><td>${esc(mt.checker)}</td></tr></table></header>
<div class="hrp-title"><h2>รายการคำนวณโครงสร้าง</h2><p>${esc(mt.project || 'บ้านพักอาศัย')} · ${S.length - 1} ชั้น · ${H.columns.length} เสา · ${D.beams.filter(b => b.mark).length} คาน</p></div>
<div class="rp-verdict ${sumD.nBad ? 'bad' : 'ok'}"><b>${sumD.nBad ? `มีชิ้นส่วนไม่ผ่านการตรวจสอบ ${sumD.nBad} รายการ` : 'ชิ้นส่วนทั้งหมดผ่านการตรวจสอบ'}</b><span>ผ่าน ${sumD.nOk} / ${sumD.list.length}</span></div>`;

    // ================================================================== 1 standards
    const so = H.soil, pile = so.type === 'pile';
    out += sec('1', 'มาตรฐานและข้อกำหนดการออกแบบ', T([
      tr('วิธีออกแบบ', `คอนกรีตเสริมเหล็ก: วิธีกำลัง (SDM) ${CODE} · โครงหลังคาเหล็ก: วิธีหน่วยแรงใช้งาน (ASD)`, '', ''),
      tr("กำลังอัดคอนกรีต f'c", 'ทรงกระบอก 15×30 ซม. อายุ 28 วัน', f(fc, 0), 'ksc'),
      tr('โมดูลัสคอนกรีต Ec', `15,100√f'c = 15,100√${fc}`, fk(Ec), 'ksc'),
      tr('เหล็กข้ออ้อย fy', 'SD40 (มอก. 24)', f(fy, 0), 'ksc'),
      tr('เหล็กกลม fys', 'SR24 (มอก. 20) — ปลอกคาน ปลอกเสา', f(fys, 0), 'ksc'),
      tr('เหล็กรูปพรรณ Fy, Es', 'โครงหลังคา', `${f(M.Fy, 0)}, ${fk(M.Es)}`, 'ksc'),
      tr('ตัวคูณลดกำลัง', 'φb (ดัด) · φv (เฉือน) · φc (เสาปลอกเดี่ยว)', '0.90 · 0.85 · 0.70', ''),
      tr('β1', fc <= 280 ? "f'c ≤ 280 ksc" : "0.85 − 0.05(f'c − 280)/70 ≥ 0.65", f(b1, 3), ''),
      tr('ρb', `0.85β1(f'c/fy)·6120/(6120+fy) = 0.85×${f(b1, 3)}×(${fc}/${fy})×6120/${6120 + fy}`, f(rb, 5), ''),
      tr('ρmax', '0.75ρb', f(rmax, 5), ''),
      tr('ระยะหุ้มคอนกรีต', `พื้น ${M.cover.slab} · คาน ${M.cover.beam} · เสา ${M.cover.col} · ฐานราก ${M.cover.fnd}`, '', 'ซม.'),
      tr('ระยะทาบเหล็ก', `DB ${M.lapDB}db · RB ${M.lapRB}db`, '', ''),
      tr('หน่วยน้ำหนักคอนกรีต', 'คอนกรีตเสริมเหล็ก', f(M.ws, 0), 'kg/m³'),
      pile ? tr('ฐานราก', `ฐานรากบนเสาเข็ม: ${esc(so.pile.name)} · ศก. ${so.pile.D} ซม. · ระยะห่าง ${so.pile.s} ม.`, f(so.pile.cap, 1), 't/ต้น', 'Pa')
        : tr('ฐานราก', `ฐานรากแผ่ · ระดับก้นฐาน Df = ${f(so.Df)} ม. · γ ดิน ${f(so.gs || 1.8)} t/m³`, f(so.qa, 1), 't/m²', 'qa')
    ]) + `<p class="rp-txt">เอกสารอ้างอิง</p><ul class="hrp-ref">${['กฎกระทรวง ฉบับที่ 6 (พ.ศ. 2527) ออกตามความใน พ.ร.บ.ควบคุมอาคาร พ.ศ. 2522 — น้ำหนักบรรทุกจร หน่วยแรง',
      'ว.ส.ท. 1008 มาตรฐานสำหรับอาคารคอนกรีตเสริมเหล็กโดยวิธีกำลัง (สมาคมวิศวกรรมสถานแห่งประเทศไทยฯ) / ACI 318-99',
      'ว.ส.ท. มาตรฐานสำหรับอาคารเหล็กรูปพรรณ (ASD) / AISC ASD 9th ed.', 'มยผ. (กรมโยธาธิการและผังเมือง) — มาตรฐานงานโครงสร้างและการคำนวณแรงลม (มยผ. 1311)',
      'มอก. 20 เหล็กเส้นกลม · มอก. 24 เหล็กข้ออ้อย'].map(x => `<li>${x}</li>`).join('')}</ul>`, 'กฎกระทรวง 6 · ว.ส.ท.');

    // ================================================================== 2 loads
    const usedLL = new Set(H.slabs.filter(s => !s.ground).map(s => s.use || 'res'));
    let L2 = sub('2.1 น้ำหนักบรรทุกจร (กฎกระทรวง ฉบับที่ 6)') + Object.entries(X.LL).map(([k, v]) => tr(v[0], usedLL.has(k) || (k === 'stair' && H.stairs.length) ? 'ใช้ในโครงการ' : '', fk(v[1]), 'kg/m²')).join('');
    if (H.roof && X.roofGeom(H)) L2 += tr('หลังคา (โครงเหล็ก)', 'น้ำหนักจรบนพื้นที่ฉาย', fk(H.roof.ll), 'kg/m²');
    L2 += sub('2.2 น้ำหนักบรรทุกคงที่');
    [...new Set(H.slabs.map(s => +s.t || 12))].sort((a, b) => a - b).forEach(t => { L2 += tr(`น้ำหนักพื้น คสล. หนา ${t} ซม.`, `${f(t / 100)} × ${M.ws}`, fk(t / 100 * M.ws), 'kg/m²'); });
    L2 += tr('น้ำหนักบรรทุกคงที่เพิ่มเติม (SDL)', 'วัสดุปูพื้น ฝ้า งานระบบ', fk(H.loads.sdl), 'kg/m²');
    const wg = {}; H.walls.forEach(w => { const k = X.stIdx(H, w.st); if (k < 0) return; const hz = k + 1 < S.length ? S[k + 1].z - S[k].z : 3.0, ab = k + 1 < S.length ? X.beamOn(H, S[k + 1].id, w.a, w.b) : null, h = w.h != null && w.h !== '' ? +w.h : hz - (ab ? X.secOf(H, ab.sec).h / 100 : 0), key = w.st + '|' + w.type + '|' + f(h); (wg[key] = wg[key] || { st: w.st, type: w.type, h, n: 0 }).n++; });
    if (Object.keys(wg).length) { L2 += sub('2.3 น้ำหนักผนัง (บรรทุกลงคานที่รองรับ)'); Object.values(wg).forEach(g => { const W = X.WALLS[g.type] || X.WALLS.block10; L2 += tr(`${stN(g.st)} · ${esc(W[0])}`, `${W[1]} kg/m² × h ${f(g.h)} ม.`, fk(W[1] * g.h), 'kg/m', `${g.n} ช่วง`); }); }
    const rg = X.roofGeom(H), rl = X.roofLoads(H);
    if (rg && rl) { const RC = X.ROOFS[H.roof.cover] || X.ROOFS.tile, cs = 1 / Math.cos(rg.th);
      L2 += sub(`2.4 น้ำหนักหลังคา (ต่อพื้นที่ฉาย, ความชัน ${f(rg.th * 180 / PI, 1)}°, 1/cosθ = ${f(cs, 3)})`) + tr(`วัสดุมุง: ${esc(RC[0])}`, `${RC[1]} × ${f(cs, 3)}`, f(rl.cover, 1), 'kg/m²') + tr('แป + โครงถักเหล็ก', `15 × ${f(cs, 3)}`, f(rl.steel, 1), 'kg/m²') + tr('ฝ้าเพดาน', '', f(rl.ceil, 1), 'kg/m²') + tr('รวมน้ำหนักคงที่หลังคา D', '', f(rl.D, 1), 'kg/m²') + tr('น้ำหนักจรหลังคา L', '', f(rl.L, 1), 'kg/m²'); }
    else L2 += sub('2.4 หลังคา') + tr('หลังคา', H.roof && H.roof.type === 'flat' ? 'หลังคาพื้น คสล. (ดาดฟ้า) — ไม่มีโครงหลังคาเหล็ก' : 'ไม่มีโครงหลังคา', '', '');
    if (H.loads.wind && H.loads.wind.on) {
      const q = +H.loads.wind.q || 50, W = H.grid.x[H.grid.x.length - 1] - H.grid.x[0], Dd = H.grid.y[H.grid.y.length - 1] - H.grid.y[0];
      L2 += sub(`2.5 แรงลม (หน่วยแรงลม q = ${q} kg/m², กระจายเป็นแรงจุดที่หัวเสาแต่ละชั้น)`);
      S.forEach((st, k) => { const hb = k > 0 ? (st.z - S[k - 1].z) / 2 : 0, ha = k + 1 < S.length ? (S[k + 1].z - st.z) / 2 : (rg ? rg.rise : 0) * 0.7, h = hb + ha; if (h <= 0) return; L2 += tr(`${stN(st.id)} (h = ${f(h)} ม.)`, `WX = q·${f(Dd)}·h · WY = q·${f(W)}·h`, `${fk(q * Dd * h)} · ${fk(q * W * h)}`, 'kg'); });
    }
    out += sec('2', 'น้ำหนักบรรทุก', T([L2]), 'กฎกระทรวง 6');

    // ================================================================== 3 combinations
    out += sec('3', 'การรวมน้ำหนักบรรทุก (Load combinations)', dt(['รหัส', 'การรวมน้ำหนัก', 'ตัวคูณ', 'ประเภท', 'ใช้สำหรับ'], (A.combos || []).map(c => [esc(c.id), esc(c.name), Object.entries(c.f || {}).map(([k, v]) => `${k} ${f(v, 3).replace(/\.?0+$/, '')}`).join(' · '), c.type === 'ULS' ? 'กำลังประลัย (U)' : 'ใช้งาน (Service)', c.type === 'ULS' ? 'ออกแบบ พื้น คาน เสา ฐานราก (SDM)' : 'ขนาดฐานราก แรงแบกทาน การแอ่นตัว'])) +
      `<p class="rp-txt">ค่าออกแบบ (Mu, Vu, Pu) ใช้ค่าซองสูงสุด (envelope) จากทุกกรณี ULS · แรงปฏิกิริยาออกแบบฐานรากใช้ U1 (${U1n}) และ SV · โครงหลังคาเหล็กใช้ D + L (ASD)</p>`, 'ACI 318-99 §9.2');

    // ================================================================== 4 model
    const fm = A.fm && A.fm.model;
    out += sec('4', 'ระบบโครงสร้างและแบบจำลอง', T([
      tr('ระยะกริด X', H.grid.x.map((x, i) => i ? f(x - H.grid.x[i - 1]) : '').filter(Boolean).join(' + '), f(H.grid.x[H.grid.x.length - 1] - H.grid.x[0]), 'ม.', `แนว ${xn(0)}–${xn(H.grid.x.length - 1)}`),
      tr('ระยะกริด Y', H.grid.y.map((y, j) => j ? f(y - H.grid.y[j - 1]) : '').filter(Boolean).join(' + '), f(H.grid.y[H.grid.y.length - 1] - H.grid.y[0]), 'ม.', `แนว ${yn(0)}–${yn(H.grid.y.length - 1)}`),
      tr('ระดับชั้น', S.map(s => `${stN(s.id)} +${f(s.z)}`).join(' · '), '', ''),
      tr('ระดับหลังฐานราก (ฐานเสาในแบบจำลอง)', 'z = −Df + 0.50', A.fm ? f(A.fm.zBase) : '—', 'ม.', 'ยึดแน่น'),
      tr('จำนวนชิ้นส่วน', `เสา ${H.columns.length} ต้น · คาน ${H.beams.length} ช่วง · พื้น ${H.slabs.length} แผ่น · บันได ${H.stairs.length}`, '', ''),
      tr('แบบจำลองโครงข้อแข็ง 3 มิติ', fm ? `${fm.nodes.length} จุดต่อ · ${fm.members.length} ชิ้นส่วน · ${fm.loads.length} น้ำหนัก` : '—', '', ''),
      tr('การถ่ายน้ำหนักพื้น', 'พื้นสองทาง: สามเหลี่ยม/สี่เหลี่ยมคางหมู (yield line 45°) · พื้นทางเดียว: แผ่สม่ำเสมอ', '', '')
    ]) + `<div class="hrp-plans">${S.map(planSVG).join('')}</div>` + warnL(A.warn), 'FRAME 3D');

    // ================================================================== 5 members
    let n5 = 0; const s5 = () => '5.' + (++n5);
    // ---- 5.1 slabs
    const slabLoc = sd => { const q = H.slabs.find(z => z.id === sd.id); return q ? [stN(q.st), `${yn(q.j)}-${yn(q.j + 1)}/${xn(q.i)}-${xn(q.i + 1)}`] : sd.id; };
    let SL = '', ks = 0; const nS = s5();
    groups(D.slabs).forEach(([mk, L]) => {
      const sd = L.reduce((a, c) => (c.wu * (c.g.S || 1) ** 2 > a.wu * (a.g.S || 1) ** 2 ? c : a), L[0]), g = sd.g, ld = sd.ld, t = sd.t, d = sd.d, Asmin = (fy >= 3000 ? 0.0018 : 0.0025) * 100 * t;
      let r = [sub('ข้อมูล'), tr('ขนาดแผ่นพื้น Lx × Ly', '', `${f(g.Lx)} × ${f(g.Ly)}`, 'ม.'), tr('ความหนา t, ความลึกประสิทธิผล d', `d = t − cover − db/2 = ${t} − ${M.cover.slab} − 0.6`, `${t}, ${f(d)}`, 'ซม.'),
        tr('น้ำหนักตัวเอง', `${f(t / 100)} × ${M.ws}`, f(ld.sw, 0), 'kg/m²'), tr('น้ำหนักบรรทุก D, L', `SDL = ${f(ld.sdl, 0)}`, `${f(ld.D, 0)}, ${f(ld.L, 0)}`, 'kg/m²'),
        tr('wu', `${fu.D}D + ${fu.L}L = ${fu.D}×${f(ld.D, 0)} + ${fu.L}×${f(ld.L, 0)}`, f(sd.wu, 1), 'kg/m²')];
      let tbl = '';
      if (sd.ground) {
        const r0 = sd.rows[0]; r.push(sub('พื้นวางบนดิน — เหล็กเสริมกันร้าว'), tr('As,min', `0.0018·b·t = 0.0018×100×${t}`, f(Asmin), 'cm²/m'), ck('เลือกเหล็ก', `${atTxt(r0.bar, r0.s)} ทั้งสองทาง As = ${f(100 * bA(r0.bar) / r0.s)} cm²/m ≥ ${f(Asmin)}`, 100 * bA(r0.bar) / r0.s >= Asmin - 1e-6));
      } else {
        const two = g.way === 'two';
        if (two) r.push(sub('พื้นสองทาง — วิธีที่ 2 (ว.ส.ท. / ACI 318-63 Method 2)'), tr('m = S/L', `${f(g.S)} / ${f(g.L)}`, f(sd.m, 3), ''), tr('กรณีของพื้น', ['', 'ต่อเนื่องทั้ง 4 ด้าน', 'ไม่ต่อเนื่อง 1 ด้าน', 'ไม่ต่อเนื่อง 2 ด้าน', 'ไม่ต่อเนื่อง 3 ด้าน', 'ไม่ต่อเนื่อง 4 ด้าน'][sd.case] || '', 'กรณี ' + sd.case, ''), tr('M = C·wu·S²', `wu·S² = ${f(sd.wu, 1)} × ${f(g.S)}²`, f(sd.wu * g.S * g.S, 1), 'kg·m/m'));
        else r.push(sub(`พื้นทางเดียว (ช่วง ${f(sd.span)} ม., สัมประสิทธิ์โมเมนต์ ACI)`), tr('wu·L²', `${f(sd.wu, 1)} × ${f(sd.span)}²`, f(sd.wu * sd.span * sd.span, 1), 'kg·m/m'));
        r.push(ck('ความหนาต่ำสุด', two ? `hmin = 2(S + L)/180 ≥ 9 = ${f(sd.hmin)} ≤ t = ${t}` : `hmin = L/24 ≥ 8 = ${f(sd.hmin)} ≤ t = ${t}`, t >= sd.hmin - 0.01, `${f(sd.hmin)} ซม.`));
        const rows = sd.rows.map(q => { const Ar = fin(q.rho) ? max(q.rho * 100 * d, Asmin) : Infinity, Ap = 100 * bA(q.bar) / q.s; return [esc(q.pos), two ? f(q.C, 3) : '1/' + round(1 / q.C), f(q.M, 1), f(q.Rn), f(q.rho, 5), f(Ar), atTxt(q.bar, q.s), f(Ap), OK(q.ok && Ap >= Ar - 1e-6)]; });
        tbl = dt(['ตำแหน่ง', '~C', '~M (kg·m/m)', '~Rn (ksc)', '~ρ', '~As,req', 'เหล็กเสริม', '~As (cm²/m)', 'ผล'], rows);
        const q = sd.rows.reduce((a, c) => (c.M > a.M ? c : a), sd.rows[0]);
        if (q && q.M > 0) { const Ar = max(q.rho * 100 * d, Asmin); r.push(sub(`ตัวอย่างการคำนวณ: ${esc(q.pos)}`), tr('Rn', `Mu/(φb·b·d²) = ${f(q.M * 100, 0)}/(0.9×100×${f(d)}²)`, f(q.Rn), 'ksc'),
          tr('ρreq', `0.85(f'c/fy)[1 − √(1 − 2Rn/0.85f'c)]`, f(q.rho, 5), '', `≤ ρmax ${f(rmax, 4)}`), tr('As,req', `max(ρbd, As,min) = max(${f(q.rho * 100 * d)}, ${f(Asmin)})`, f(Ar), 'cm²/m', fy >= 3000 ? '0.0018bt' : '0.0025bt'),
          ck('เลือกเหล็ก', `${atTxt(q.bar, q.s)} → As = ${f(100 * bA(q.bar) / q.s)} cm²/m (s ≤ 3t, 30 ซม.)`, q.ok && 100 * bA(q.bar) / q.s >= Ar - 1e-6)); }
        r.push(sub('ตรวจแรงเฉือน'), tr('Vu', two ? `wu·S/2 = ${f(sd.wu, 1)} × ${f(g.S)}/2` : `wu·L/2 = ${f(sd.wu, 1)} × ${f(sd.span)}/2`, fk(sd.Vu), 'kg/m'), ck('φVc', `φ·0.53√f'c·b·d = 0.85×0.53×${f(sfc)}×100×${f(d)} = ${fk(sd.pVc)} ≥ Vu`, sd.Vu <= sd.pVc, fk(sd.pVc) + ' kg/m'));
      }
      SL += sec(`${nS}.${++ks}`, `พื้น ${esc(mk)} (หนา ${t} ซม.${sd.ground ? ', วางบนดิน' : g.way === 'two' ? ', สองทาง' : ', ทางเดียว'})`, loc(L.map(slabLoc)) + T(r) + tbl + warnL(sd.warn), CODE);
    });
    if (SL) out += sec(nS, 'การออกแบบพื้น (S, SG)', SL, 'SDM');
    // ---- 5.2 stairs
    if (D.stairs.length) { const nT = s5(); let ST = '';
      D.stairs.forEach((sd, k) => { const t0 = H.stairs[k], Asmin = 0.0018 * 100 * sd.t, Ar = fin(sd.rho) ? max(sd.rho * 100 * sd.d, Asmin) : Infinity, pVc = 0.85 * 0.53 * sfc * 100 * sd.d;
        ST += sec(`${nT}.${k + 1}`, `บันได ${esc(sd.mark)} (พื้นท้องเรียบ ช่วงเดียว)`, loc([[stN(t0.st), `${yn(t0.j)}-${yn(t0.j + 1)}/${xn(t0.i)}-${xn(t0.i + 1)}`]]) + T([
          tr('ความสูงชั้น, ช่วงราบ L, กว้าง W', '', `${f(sd.hgt)}, ${f(sd.Lh)}, ${f(sd.W)}`, 'ม.'), tr('ลูกตั้ง R', `${f(sd.hgt)} / ${sd.nr} ขั้น`, f(sd.R * 100, 1), 'ซม.'), tr('ลูกนอน T', `${f(sd.Lh)} / ${sd.nr - 1}`, f(sd.Tr * 100, 1), 'ซม.', `2R+T = ${f((2 * sd.R + sd.Tr) * 100, 1)}`),
          tr('มุมเอียง θ, ท้องบันได t', `tanθ = ${f(sd.hgt)}/${f(sd.Lh)}`, `${f(sd.th * 180 / PI, 1)}°, ${sd.t} ซม.`, ''),
          tr('D', `(t/cosθ + R/2)·${M.ws} + 100 = (${f(sd.t / 100, 3)}/${f(Math.cos(sd.th), 3)} + ${f(sd.R / 2, 3)})×${M.ws} + 100`, f(sd.D, 0), 'kg/m²', 'รวมผิว 100'),
          tr('L', 'บันได (กฎกระทรวง 6)', f(sd.L, 0), 'kg/m²'), tr('wu', `${fu.D}×${f(sd.D, 0)} + ${fu.L}×${f(sd.L, 0)}`, f(sd.wu, 1), 'kg/m²'),
          tr('Mu', `wu·L²/8 = ${f(sd.wu, 1)} × ${f(sd.Lh)}²/8`, f(sd.Mu, 1), 'kg·m/m'), tr('d', `${sd.t} − ${M.cover.slab} − 0.6`, f(sd.d), 'ซม.'),
          tr('Rn', `${f(sd.Mu * 100, 0)}/(0.9×100×${f(sd.d)}²)`, f(sd.Rn), 'ksc'), tr('ρreq', `0.85(f'c/fy)[1 − √(1 − 2Rn/0.85f'c)]`, f(sd.rho, 5), '', `≤ ρmax ${f(rmax, 4)}`),
          tr('As,req', `max(ρbd, 0.0018bt) = max(${f(sd.rho * 100 * sd.d)}, ${f(Asmin)})`, f(Ar), 'cm²/m'),
          ck('เหล็กหลัก', `${atTxt(sd.main.bar, sd.main.s)} → As = ${f(sd.main.As)} cm²/m ≥ ${f(Ar)}`, sd.ok && sd.main.As >= Ar - 1e-6), ck('เหล็กกันร้าว', `${atTxt(sd.dist.bar, sd.dist.s)} → As = ${f(sd.dist.As)} ≥ ${f(Asmin)}`, sd.dist.As >= Asmin - 1e-6),
          ck('แรงเฉือน', `Vu = wuL/2 = ${fk(sd.Vu)} ≤ φVc = 0.85×0.53√f'c·100·d = ${fk(pVc)} kg/m`, sd.Vu <= pVc)]), CODE); });
      out += sec(nT, 'การออกแบบบันได (ST)', ST, 'SDM'); }
    // ---- 5.3 beams
    const beamLoc = b => { const dx = b.a[1] === b.bb[1]; return [stN(b.st), dx ? `${yn(b.a[1])}/${xn(min(b.a[0], b.bb[0]))}-${xn(max(b.a[0], b.bb[0]))}` : `${xn(b.a[0])}/${yn(min(b.a[1], b.bb[1]))}-${yn(max(b.a[1], b.bb[1]))}`]; };
    let BM = '', kb = 0; const nB = s5();
    groups(D.beams.filter(b => b.top)).forEach(([mk, L]) => {
      const bd = L.reduce((a, c) => (max(c.top.Mu, c.bot.Mu) > max(a.top.Mu, a.bot.Mu) ? c : a), L[0]), b = bd.b, h = bd.h, d = bd.d, st = bd.shear, ds = bD(st.bar) / 10, den = bd.cont === 2 ? 21 : bd.cont === 1 ? 18.5 : 16;
      const flex = (F, nm) => { const Ar = fin(F.rho) ? max(F.rho * b * d, F.Mu > 0.01 ? bd.Asmin : 0) : Infinity, Ap = F.n * bA(F.bar); return [sub(`${nm}`), tr('Mu', 'จากซองแรง ULS', f(F.Mu, 3), 't·m'), tr('Rn', `Mu/(φb·b·d²) = ${f(F.Mu * 1e5, 0)}/(0.9×${b}×${f(d)}²)`, f(F.Rn), 'ksc'),
        ck('ρreq ≤ ρmax', `0.85(f'c/fy)[1 − √(1 − 2Rn/0.85f'c)] = ${f(F.rho, 5)} ≤ ${f(bd.rmax, 5)}`, fin(F.rho) && F.rho <= bd.rmax), tr('As,req', `max(ρbd, As,min) = max(${f(F.rho * b * d)}, ${f(F.Mu > 0.01 ? bd.Asmin : 0)})`, f(Ar), 'cm²'),
        ck('เลือกเหล็ก', `${barTxt(F.n, F.bar)}${F.layers > 1 ? ' (2 ชั้น)' : ''} → As = ${f(Ap)} cm² ≥ ${f(Ar)}`, F.ok, `${f(Ar / Ap * 100, 0)}%`)]; };
      const sAv = st.Av * fys / (3.5 * b), sReq = st.Vs > 0 ? st.Av * fys * d / st.Vs : null, lim = 1.06 * sfc * b * d, sMax = st.Vs > lim ? d / 4 : d / 2, pVn = 0.85 * (st.Vc + st.Av * fys * d / st.s), Vu = bd.Vu * 1000;
      const ptsT = rowPts(bd.top.n, -(h / 2 - M.cover.beam - ds - bD(bd.top.bar) / 20), b, M.cover.beam, bD(st.bar), bd.top.bar), ptsB = rowPts(bd.bot.n, h / 2 - M.cover.beam - ds - bD(bd.bot.bar) / 20, b, M.cover.beam, bD(st.bar), bd.bot.bar);
      const r = [sub('ข้อมูล'), tr('หน้าตัด b × h', '', `${b} × ${h}`, 'ซม.'), tr('ความยาวช่วง L', `ปลายต่อเนื่อง ${bd.cont} ด้าน`, f(bd.L), 'ม.'), tr('d', `h − cover − ปลอก − db/2 = ${h} − ${M.cover.beam} − ${f(ds, 1)} − 0.8`, f(d), 'ซม.'),
        ck('ความลึกต่ำสุด', `hmin = L/${den}·(0.4 + fy/7000) = ${f(bd.hmin, 1)} ≤ h = ${h}`, h >= bd.hmin - 0.01, `Δ = ${f(bd.defl, 1)} มม.`),
        tr('As,min', `max(14/fy, 0.8√f'c/fy)·b·d = ${f(max(14 / fy, 0.8 * sfc / fy), 5)}×${b}×${f(d)}`, f(bd.Asmin), 'cm²'), tr('ρmax', `0.75ρb = 0.75×${f(rb, 5)}`, f(bd.rmax, 5), ''),
        ...flex(bd.top, 'เหล็กบน — โมเมนต์ลบที่ฐานรองรับ'), ...flex(bd.bot, 'เหล็กล่าง — โมเมนต์บวกกลางช่วง'),
        sub('เหล็กปลอก — แรงเฉือน'), tr('Vu', 'จากซองแรง ULS', f(bd.Vu, 3), 't'), tr('Vc', `0.53√f'c·b·d = 0.53×${f(sfc)}×${b}×${f(d)}`, fk(st.Vc), 'kg'), tr('φVc', `0.85 × ${fk(st.Vc)}`, fk(st.pVc), 'kg', Vu > st.pVc / 2 ? 'Vu > φVc/2' : 'Vu ≤ φVc/2'),
        tr('Vs', `Vu/φ − Vc = ${fk(Vu)}/0.85 − ${fk(st.Vc)} ≥ 0`, fk(st.Vs), 'kg'), tr('Av', `2 ขา ${st.bar}`, f(st.Av, 3), 'cm²'),
        tr('s ตามกำลัง', sReq ? `Av·fys·d/Vs = ${f(st.Av, 3)}×${fys}×${f(d)}/${fk(st.Vs)}` : 'Vs = 0 — ไม่ต้องการ', sReq ? f(sReq, 1) : '', sReq ? 'ซม.' : ''),
        tr('s สูงสุด', `${st.Vs > lim ? 'd/4' : 'd/2'} = ${f(sMax, 1)} · Av,min: Av·fys/(3.5b) = ${f(sAv, 1)} · 30`, f(min(sMax, Vu > st.pVc / 2 ? sAv : 999, 30), 1), 'ซม.'),
        ck('ใช้ปลอก', `${atTxt(st.bar, st.s)} → φVn = φ(Vc + Av·fys·d/s) = ${fk(pVn)} kg ≥ Vu`, pVn >= Vu - 1 && !st.over, `${f(Vu / pVn * 100, 0)}%`),
        ck('Vs ≤ 2.1√f\'c·bd', `${fk(st.Vs)} ≤ ${fk(2.1 * sfc * b * d)} kg`, !st.over)];
      BM += sec(`${nB}.${++kb}`, `คาน ${esc(mk)} (${b} × ${h} ซม.)`, loc(L.map(beamLoc)) + `<div class="hrp-blk">${T(r)}${rectSec(b, h, M.cover.beam, bD(st.bar), ptsT.concat(ptsB), bd.bot.bar, `บน ${barTxt(bd.top.n, bd.top.bar)} · ล่าง ${barTxt(bd.bot.n, bd.bot.bar)} · ปลอก ${atTxt(st.bar, st.s)}`)}</div>` + warnL(bd.warn), CODE);
    });
    if (BM) out += sec(nB, 'การออกแบบคาน (GB, B, RB)', `<p class="rp-txt">แสดงการคำนวณของช่วงคานที่วิกฤตที่สุดในแต่ละกลุ่ม (mark) · แรงจากการวิเคราะห์โครงข้อแข็ง 3 มิติ</p>` + BM, 'SDM');
    // ---- 5.4 columns and pedestals
    let CL = '', kc = 0; const nC = s5();
    groups(D.cols.filter(c => c.bar)).forEach(([mk, L]) => {
      const cd = L.reduce((a, c) => ((c.ur || 0) > (a.ur || 0) ? c : a), L[0]), b = cd.b, h = cd.h, Ag = b * h, Ast = cd.n * bA(cd.bar), Pu = cd.Pu, ped = cd.seg === 0;
      const kl = cd.slender, Pc = I => PI * PI * 0.4 * Ec * I / 1.6 / (cd.Lu * 100) ** 2 / 1000, emin = 1.5 + 0.03 * h, rx = cd.Mux / cd.phiMnx, ry = cd.Muy / cd.phiMny, bres = Math.pow(rx, 1.5) + Math.pow(ry, 1.5);
      const P0 = 0.85 * fc * (Ag - Ast) + fy * Ast, pPmax = 0.8 * 0.7 * P0 / 1000;
      const locs = {}; L.forEach(c => { const col = H.columns.find(q => q.id === c.id); if (!col) return; const k = `${yn(col.j)}/${xn(col.i)}`; (locs[k] = locs[k] || []).push(c.seg); });
      const lt = Object.entries(locs).map(([k, s]) => ped ? k : `${k} [ชั้น ${s.join(',')}]`);
      const r = [sub('ข้อมูล'), tr('หน้าตัด b × h', `Ag = ${Ag} cm²`, `${b} × ${h}`, 'ซม.'), tr('ความยาวไม่ค้ำยัน Lu', ped ? 'ตอม่อ: หลังฐานราก ถึง คานคอดิน' : 'ระหว่างชั้น', f(cd.Lu), 'ม.'),
        tr('Pu', 'แรงอัดสูงสุดจากซองแรง ULS', f(Pu, 2), 't'),
        tr('ความชะลูด kLu/r', `k = 1, r = 0.3h → ${f(cd.Lu * 100, 0)}/(0.3×${min(b, h)})`, f(kl, 1), '', kl <= 22 ? '≤ 22 เสาสั้น' : '> 22 เสายาว')];
      if (kl > 22) r.push(tr('Pc,x', `π²·0.4EcIg/(1+βd)/Lu² , Ig = ${fk(b * h ** 3 / 12)} cm⁴, βd = 0.6`, f(Pc(b * h ** 3 / 12), 1), 't'), tr('δx, δy', `Cm/(1 − Pu/0.75Pc) ≥ 1`, `${f(cd.dz, 3)}, ${f(cd.dy, 3)}`, '', 'non-sway'));
      r.push(tr('emin', `1.5 + 0.03h = 1.5 + 0.03×${h}`, f(emin), 'ซม.', `Pu·emin = ${f(Pu * emin / 100, 3)} t·m`), tr('Mux, Muy', `max(δ·M2, Pu·emin)`, `${f(cd.Mux, 3)}, ${f(cd.Muy, 3)}`, 't·m'),
        sub('เหล็กยืน'), ck('ρg', `${barTxt(cd.n, cd.bar)}: Ast = ${f(Ast)} cm² → ρg = ${f(cd.rho * 100, 2)}% (1% – 4%)`, cd.rho >= 0.01 - 1e-9 && cd.rho <= 0.04 + 1e-9),
        ck('φPn,max', `0.8φ[0.85f'c(Ag − Ast) + fy·Ast] = 0.8×0.7×[0.85×${fc}×(${Ag} − ${f(Ast)}) + ${fy}×${f(Ast)}] = ${f(pPmax, 1)} t ≥ Pu`, Pu <= pPmax, `${f(Pu / pPmax * 100, 0)}%`),
        tr('φMnx, φMny ที่ Pu', 'strain compatibility, εcu = 0.003', `${f(cd.phiMnx, 3)}, ${f(cd.phiMny, 3)}`, 't·m'),
        tr('Mux/φMnx, Muy/φMny', `${f(cd.Mux, 3)}/${f(cd.phiMnx, 3)}, ${f(cd.Muy, 3)}/${f(cd.phiMny, 3)}`, `${f(rx, 3)}, ${f(ry, 3)}`, ''),
        ck('Bresler (load contour α = 1.5)', `(Mux/φMnx)^1.5 + (Muy/φMny)^1.5 = ${f(rx, 3)}^1.5 + ${f(ry, 3)}^1.5 = ${f(bres, 3)} ≤ 1.0`, cd.ok, `UR = ${f(cd.ur, 3)}`),
        sub('เหล็กปลอก'), ck('ระยะปลอก', `s ≤ min(16db, 48dt, b) = min(${f(16 * bD(cd.bar) / 10, 1)}, ${f(48 * bD(cd.tie) / 10, 1)}, ${min(b, h)}) → ${atTxt(cd.tie, cd.s)}`, cd.s <= min(16 * bD(cd.bar) / 10, 48 * bD(cd.tie) / 10, min(b, h)) + 1e-6));
      const cv = M.cover.col + bD(cd.tie) / 10 + bD(cd.bar) / 20, pts = perim(cd.n, b - 2 * cv, h - 2 * cv).map(([u, v]) => [u, v, cd.bar]);
      CL += sec(`${nC}.${++kc}`, `${ped ? 'ตอม่อ' : 'เสา'} ${esc(mk)} (${b} × ${h} ซม.)`, loc(lt) + `<div class="hrp-blk">${T(r)}${rectSec(b, h, M.cover.col, bD(cd.tie), pts, cd.bar, `${barTxt(cd.n, cd.bar)} · ปลอก ${atTxt(cd.tie, cd.s)}`)}</div>` + warnL(cd.warn), CODE + ' §10');
    });
    if (CL) out += sec(nC, 'การออกแบบเสาและตอม่อ (C, P)', `<p class="rp-txt">เสาปลอกเดี่ยว รับแรงอัดร่วมกับแรงดัดสองแกน · แสดงชิ้นส่วนที่มีอัตราส่วนการใช้งานสูงสุดในแต่ละกลุ่ม</p>` + CL, 'SDM');
    // ---- 5.5 footings
    let FD = '', kf = 0; const nF = s5();
    groups(D.fnds.filter(x => x.B)).forEach(([mk, L]) => {
      const fd = L.reduce((a, c) => (c.Ps > a.Ps ? c : a), L[0]), col = H.columns.find(q => q.id === fd.id), cs = X.secOf(H, col.sec), cb = cs.b, ch = cs.h, sh = fd.sh, d = fd.d, A0 = fd.B * fd.L, qu = fd.Pu / A0;
      const db = bD(fd.fx.bar) / 10, c1 = cb + d, c2 = ch + d, bc = max(cb, ch) / min(cb, ch), k1 = 0.27 * (2 + 4 / bc), k2 = 0.27 * (40 * d / sh.b0 + 2), kv = min(k1, k2, 1.06);
      const r = [sub('ข้อมูล'), tr('ขนาดเสา', '', `${cb} × ${ch}`, 'ซม.'), tr('Ps (D + L) ที่ฐานเสา', 'แรงปฏิกิริยา service', f(fd.Ps, 2), 't'), tr('Pu', `แรงปฏิกิริยา U1: ${U1n}`, f(fd.Pu, 2), 't')];
      if (pile) r.push(sub('เสาเข็ม'), tr('เสาเข็ม', `${esc(so.pile.name)}`, f(fd.capP, 1), 't/ต้น', 'Pa'), tr('จำนวนเข็ม', `n ≥ 1.1Ps/Pa = 1.1×${f(fd.Ps)}/${f(fd.capP, 1)} = ${f(1.1 * fd.Ps / fd.capP)}`, fd.np, 'ต้น', 'รวม น.น.ฐาน 10%'),
        ck('น้ำหนักต่อต้น', `R = 1.1Ps/n = ${f(fd.Rpile)} ≤ ${f(fd.capP, 1)} t`, fd.Rpile <= fd.capP + 1e-6, `${f(fd.Rpile / fd.capP * 100, 0)}%`), tr('ขนาดฐานราก B × L', `ระยะเข็ม ${so.pile.s} ม. + ระยะขอบ`, `${f(fd.B)} × ${f(fd.L)}`, 'ม.'));
      else { const w = (+so.Df || 1.5) * 2.0; r.push(sub('ขนาดฐานราก (แรงแบกทานดิน)'), tr('w ฐาน + ดินถม', `Df × 2.0 = ${f(so.Df)} × 2.0`, f(w), 't/m²'), tr('Areq', `Ps/(qa − w) = ${f(fd.Ps)}/(${f(fd.qa, 1)} − ${f(w)})`, f(fd.Areq, 3), 'm²'),
        tr('เลือก B × L', `A = ${f(A0, 3)} m²`, `${f(fd.B)} × ${f(fd.L)}`, 'ม.'), ck('แรงแบกทาน', `q = Ps/A + w = ${f(fd.Ps)}/${f(A0, 3)} + ${f(w)} = ${f(fd.q)} ≤ qa = ${f(fd.qa, 1)} t/m²`, fd.q <= fd.qa + 1e-6, `${f(fd.q / fd.qa * 100, 0)}%`),
        tr('qu', `Pu/A = ${f(fd.Pu)}/${f(A0, 3)}`, f(qu, 3), 't/m²')); }
      r.push(sub('ความหนาและแรงเฉือน'), tr('t, d', `d = t − cover − db = ${fd.t} − ${M.cover.fnd} − ${f(db, 1)}`, `${fd.t}, ${f(d)}`, 'ซม.'),
        tr('b0', `2(c1 + c2) = 2(${f(c1, 1)} + ${f(c2, 1)})`, f(sh.b0, 1), 'ซม.', `βc = ${f(bc, 2)}`),
        tr('Vu เฉือนทะลุ', pile ? `จำนวนเข็มนอกหน้าตัดวิกฤต × Pu/n` : `qu(A − c1·c2) = ${f(qu, 3)}×(${f(A0, 3)} − ${f(c1 * c2 / 1e4, 4)})`, f(sh.Vp, 2), 't'),
        tr('vc', `min[0.27(2 + 4/βc), 0.27(αs·d/b0 + 2), 1.06]√f'c = min(${f(k1, 3)}, ${f(k2, 3)}, 1.06)√f'c`, f(kv * sfc, 2), 'ksc'),
        ck('เฉือนทะลุ', `φVc = 0.85×${f(kv, 3)}×${f(sfc)}×${f(sh.b0, 1)}×${f(d)}/1000 = ${f(sh.pVp, 2)} t ≥ Vu = ${f(sh.Vp, 2)}`, sh.Vp <= sh.pVp, `${f(sh.Vp / sh.pVp * 100, 0)}%`),
        ck('เฉือนทางเดียว (แนว X)', pile ? `Vu = ${f(sh.V1x, 2)} ≤ φVc = 0.85×0.53√f'c·L·d = ${f(sh.pV1x, 2)} t` : `Vu = qu·L·(B/2 − c/2 − d) = ${f(sh.V1x, 2)} ≤ φVc = 0.85×0.53×${f(sfc)}×${f(fd.L * 100, 0)}×${f(d)}/1000 = ${f(sh.pV1x, 2)} t`, sh.V1x <= sh.pV1x, `${f(sh.V1x / sh.pV1x * 100, 0)}%`),
        ck('เฉือนทางเดียว (แนว Y)', `Vu = ${f(sh.V1y, 2)} ≤ φVc = 0.85×0.53√f'c·B·d = ${f(sh.pV1y, 2)} t`, sh.V1y <= sh.pV1y, `${f(sh.V1y / sh.pV1y * 100, 0)}%`));
      [['x', fd.fx, fd.L, fd.B, cb], ['y', fd.fy, fd.B, fd.L, ch]].forEach(([ax, F, wdt, span, cf]) => { const As0 = 0.0018 * wdt * 100 * fd.t, Ap = F.n * bA(F.bar);
        r.push(sub(`โมเมนต์ดัดที่ผิวเสา — เหล็กขนาน ${ax.toUpperCase()} (กว้าง ${f(wdt)} ม.)`), tr('Mu', pile ? `Σ R·(x − c/2) ต่อด้าน, R = Pu/n = ${f(fd.Pu / fd.np)} t` : `qu·${f(wdt)}·(${f(span)}/2 − ${f(cf / 100)}/2)²/2`, f(F.Mu, 3), 't·m'),
          tr('Rn', `${f(F.Mu * 1e5, 0)}/(0.9×${f(wdt * 100, 0)}×${f(d)}²)`, f(F.Rn), 'ksc'), tr('As,req', `max(ρbd, 0.0018bt) = max(${f(F.rho * wdt * 100 * d)}, ${f(As0)})`, f(F.As), 'cm²', `ρ = ${f(F.rho, 5)}`),
          ck('เลือกเหล็ก', `${barTxt(F.n, F.bar)} @ ${f(F.s, 1)} ซม. → As = ${f(Ap)} cm² ≥ ${f(F.As)}`, F.ok && Ap >= F.As - 1e-6, `${f(F.As / Ap * 100, 0)}%`)); });
      FD += sec(`${nF}.${++kf}`, `ฐานราก ${esc(mk)} (${f(fd.B)} × ${f(fd.L)} × ${f(fd.t / 100)} ม.${pile ? `, เข็ม ${fd.np} ต้น` : ''})`, loc(L.map(x => `${yn(x.j)}/${xn(x.i)}`)) + `<div class="hrp-blk">${T(r)}${footSVG(fd, cb, ch)}</div>` + warnL(fd.warn), CODE + ' §11, §15');
    });
    if (FD) out += sec(nF, `การออกแบบฐานราก (F) — ${pile ? 'ฐานรากบนเสาเข็ม' : 'ฐานรากแผ่'}`, FD, 'SDM');
    // ---- 5.6 steel roof
    const R = D.roof;
    if (R) { const nR = s5(), g = R.g, Fy = +M.Fy || 2400, E = M.Es, Cc = sq(2 * PI * PI * E / Fy), pu = R.purlin; let RT = '';
      RT += T([sub('รูปทรงหลังคา'), tr('ชนิด', { gable: 'หน้าจั่ว', hip: 'ปั้นหยา', shed: 'เพิงหมาแหงน' }[g.type] || g.type, '', '', `ทิศโครงถัก ${g.dir === 'x' ? 'ขวาง Y' : 'ขวาง X'}`), tr('ช่วงโครงถัก, ความสูง', `rise = ${g.type === 'shed' ? 'span' : 'span/2'}·tan${f(g.th * 180 / PI, 1)}°`, `${f(g.span)}, ${f(g.rise)}`, 'ม.'),
        tr('ระยะโครงถัก sp, ระยะแป', `จำนวนโครงถัก ${R.nTruss || '—'} ชุด · ชายคา ${f(g.ov)} ม.`, `${f(R.sp)}, ${f(R.psp)}`, 'ม.'), tr('D, L ต่อพื้นที่ฉาย', '', `${f(R.rl.D, 1)}, ${f(R.rl.L, 1)}`, 'kg/m²')]);
      if (pu) RT += sec(`${nR}.1`, `แป ${esc(pu.p.name)}`, T([tr('น้ำหนักบนแป w', `(น.น.มุง·cosθ + 5 + L·cosθ)·ระยะแป`, f(pu.w, 1), 'kg/m'), tr('M', `w·sp²/8 = ${f(pu.w, 1)}×${f(R.sp)}²/8`, f(pu.M, 1), 'kg·m'),
        tr('คุณสมบัติหน้าตัด', `A = ${f(pu.p.A)} cm² · Ix = ${f(pu.p.Ix, 1)} cm⁴ · Sx = ${f(pu.p.Sx)} cm³`, f(pu.p.w), 'kg/m'),
        ck('หน่วยแรงดัด', `fb = M/Sx = ${f(pu.M * 100, 0)}/${f(pu.p.Sx)} = ${f(pu.fb, 0)} ≤ Fb = 0.6Fy = ${f(0.6 * Fy, 0)} ksc`, pu.fb <= 0.6 * Fy + 1e-6, `${f(pu.fb / (0.6 * Fy) * 100, 0)}%`),
        ck('การแอ่นตัว', `Δ = 5wL⁴/384EI = ${f(pu.dl, 2)} ≤ L/180 = ${f(R.sp * 100 / 180, 2)} ซม.`, pu.dl <= R.sp * 100 / 180 + 1e-6, `${f(pu.dl / (R.sp * 100 / 180) * 100, 0)}%`)]), 'ASD');
      if (R.truss) { const nbc = R.truss.members.filter(m => m.kind === 'bc').length, a = g.span / max(1, nbc), KN = { tc: 'จันทัน (Top chord)', bc: 'ขื่อ (Bottom chord)', vt: 'ค้ำยันแนวดิ่ง', dg: 'ค้ำยันทแยง' };
        let tb = T([tr('น้ำหนักที่จุดต่อ', `(D + L)·sp·a = (${f(R.rl.D, 1)} + ${f(R.rl.L, 1)})×${f(R.sp)}×${f(a, 3)}`, f((R.rl.D + R.rl.L) * R.sp * a, 1), 'kg', 'จุดต่อภายใน'), tr('แรงปฏิกิริยาที่ฐานรองรับ', `(D + L)·sp·(span/2 + ชายคา)`, fk(R.reaction), 'kg'),
          tr('Cc', `√(2π²E/Fy) = √(2π²×${fk(E)}/${Fy})`, f(Cc, 1), ''), tr('Fa (KL/r ≤ Cc)', '[1 − (KL/r)²/2Cc²]Fy / [5/3 + 3(KL/r)/8Cc − (KL/r)³/8Cc³]', '', ''), tr('Fa (KL/r > Cc)', '12π²E / 23(KL/r)²', '', ''), tr('Ft', `0.6Fy`, f(0.6 * Fy, 0), 'ksc')]);
        tb += trussSVG(R);
        tb += dt(['ชิ้นส่วน', 'หน้าตัด', '~A (cm²)', '~r (cm)', '~L (ม.)', '~KL/r', '~Fa (ksc)', '~Nc (kg)', '~fa', '~Nt (kg)', '~ft', '~อัตราส่วน', 'ผล'], R.truss.groups.map(gr => { const s = gr.sec; return s ? [KN[gr.kind] || gr.kind, s.p.name, f(s.p.A), f(min(s.p.rx, s.p.ry)), f(gr.L), f(s.KLr, 1), f(s.fa, 0), fk(gr.Nc), f(gr.Nc / s.p.A, 0), fk(gr.Nt), f(gr.Nt / s.p.A, 0), f(s.ur, 3), OK(s.ok)] : [KN[gr.kind], '—', '', '', f(gr.L), '', '', fk(gr.Nc), '', fk(gr.Nt), '', '', OK(false)]; }));
        const tc = R.truss.groups.find(x => x.kind === 'tc'); if (tc && tc.sec) { const s = tc.sec, q = s.KLr / Cc; tb += T([sub(`ตัวอย่าง: ${KN.tc} ${s.p.name}`), tr('KL/r', `1.0×${f(tc.L * 100, 1)}/${f(min(s.p.rx, s.p.ry))}`, f(s.KLr, 1), '', `≤ 200`), tr('Fa', s.KLr <= Cc ? `[1 − ${f(q, 3)}²/2]×${Fy} / [5/3 + 3×${f(q, 3)}/8 − ${f(q, 3)}³/8]` : `12π²E/23(KL/r)²`, f(s.fa, 0), 'ksc'),
          ck('แรงอัด', `fa = Nc/A = ${fk(tc.Nc)}/${f(s.p.A)} = ${f(tc.Nc / s.p.A, 0)} ≤ Fa = ${f(s.fa, 0)} ksc`, s.urc <= 1 && s.KLr <= 200, `${f(s.urc * 100, 0)}%`)]); }
        tb += `<p class="rp-txt">แรงในชิ้นส่วนทั้งหมด (D + L, kg, + ดึง / − อัด)</p>` + dt(['ชิ้นส่วน', 'ประเภท', '~L (ม.)', '~N (kg)', 'สถานะ'], R.truss.members.map(m => [m.id, KN[m.kind] || m.kind, f(m.L), fk(m.N), m.N > 1 ? 'ดึง' : m.N < -1 ? 'อัด' : '—']));
        RT += sec(`${nR}.${pu ? 2 : 1}`, 'โครงถักหลังคา', tb, 'ASD · AISC'); }
      out += sec(nR, 'การออกแบบโครงหลังคาเหล็ก (ASD)', RT + warnL(R.warn), `Fy ${Fy} ksc`); }

    // ================================================================== 6 summary schedules
    let SM = '';
    const cnt = (L, k) => L.filter(x => x.mark === k).length, uniq = (L, kf) => groups(L).map(([k, l]) => kf(k, l));
    SM += `<p class="rp-txt">6.1 พื้น</p>` + dt(['Mark', '~t (ซม.)', 'ชนิด', 'เหล็กเสริม', '~จำนวน', 'ผล'], uniq(D.slabs, (k, l) => { const s = l[0], pr = s.rows.filter(r => /บวก|ทั้งสอง|ทางเดียว โมเมนต์บวก/.test(r.pos)), ng = s.rows.filter(r => /ลบ/.test(r.pos)); return [esc(k), s.t, s.ground ? 'วางบนดิน' : s.g.way === 'two' ? 'สองทาง' : 'ทางเดียว', `ล่าง ${[...new Set(pr.map(r => atTxt(r.bar, r.s)))].join(' / ')}${ng.length ? ` · บน ${[...new Set(ng.map(r => atTxt(r.bar, r.s)))].join(' / ')}` : ''}`, l.length, OK(l.every(x => x.ok))]; }));
    SM += `<p class="rp-txt">6.2 คาน</p>` + dt(['Mark', '~b × h (ซม.)', 'เหล็กบน', 'เหล็กล่าง', 'ปลอก', '~จำนวน', 'ผล'], uniq(D.beams.filter(b => b.top), (k, l) => { const b = l[0]; return [esc(k), `${b.b} × ${b.h}`, barTxt(b.top.n, b.top.bar), barTxt(b.bot.n, b.bot.bar), atTxt(b.shear.bar, b.shear.s), l.length, OK(l.every(x => x.ok))]; }));
    SM += `<p class="rp-txt">6.3 เสาและตอม่อ</p>` + dt(['Mark', '~b × h (ซม.)', 'เหล็กยืน', 'ปลอก', '~UR สูงสุด', '~จำนวน', 'ผล'], uniq(D.cols.filter(c => c.bar), (k, l) => { const c = l[0]; return [esc(k), `${c.b} × ${c.h}`, barTxt(c.n, c.bar), atTxt(c.tie, c.s), f(max(...l.map(x => x.ur || 0)), 3), l.length, OK(l.every(x => x.ok))]; }));
    SM += `<p class="rp-txt">6.4 ฐานราก</p>` + dt(['Mark', '~B × L × t (ม.)', ...(pile ? ['~เข็ม'] : []), 'เหล็กขนาน X', 'เหล็กขนาน Y', '~Ps สูงสุด (t)', '~จำนวน', 'ผล'], uniq(D.fnds.filter(x => x.B), (k, l) => { const x = l[0]; return [esc(k), `${f(x.B)} × ${f(x.L)} × ${f(x.t / 100)}`, ...(pile ? [x.np] : []), `${barTxt(x.fx.n, x.fx.bar)} @ ${f(x.fx.s, 1)}`, `${barTxt(x.fy.n, x.fy.bar)} @ ${f(x.fy.s, 1)}`, f(max(...l.map(z => z.Ps)), 2), l.length, OK(l.every(z => z.ok))]; }));
    if (D.stairs.length) SM += `<p class="rp-txt">6.5 บันได</p>` + dt(['Mark', '~t (ซม.)', 'เหล็กหลัก', 'เหล็กกันร้าว', 'ผล'], D.stairs.map(s => [esc(s.mark), s.t, atTxt(s.main.bar, s.main.s), atTxt(s.dist.bar, s.dist.s), OK(s.ok)]));
    if (R) SM += `<p class="rp-txt">6.6 โครงหลังคาเหล็ก</p>` + dt(['ชิ้นส่วน', 'หน้าตัด', '~อัตราส่วน', 'ผล'], [...(R.purlin ? [['แป', R.purlin.p.name, f(R.purlin.fb / (0.6 * (+M.Fy || 2400)), 3), OK(R.purlin.fb <= 0.6 * (+M.Fy || 2400) + 1e-6)]] : []), ...(R.truss ? R.truss.groups.map(gr => [{ tc: 'จันทัน', bc: 'ขื่อ', vt: 'ค้ำยันแนวดิ่ง', dg: 'ค้ำยันทแยง' }[gr.kind], gr.sec ? gr.sec.p.name : '—', gr.sec ? f(gr.sec.ur, 3) : '—', OK(gr.sec && gr.sec.ok)]) : [['โครงถัก', '—', '—', OK(false)]])]);
    const bad = sumD.list.filter(x => !x.ok); if (bad.length) SM += `<p class="hrp-warn">ชิ้นส่วนที่ไม่ผ่าน: ${[...new Set(bad.map(x => `${x.k} ${esc(x.mark || '')}`))].join(', ')}</p>`;
    out += sec('6', 'สรุปผลการออกแบบ', SM);
    void cnt;

    // ================================================================== appendices: BBS, BOQ
    if (Q && Q.B) { const agg = new Map(); Q.B.rows.forEach(r => { const k = [r.grp, r.mark, r.bar, r.shape, f(r.L), r.note].join('|'), o = agg.get(k); if (o) { o.n += r.n; o.kg += r.kg; o.cnt++; } else agg.set(k, { ...r, cnt: 1 }); });
      const rows = [...agg.values()], tkg = rows.reduce((s, r) => s + r.kg, 0);
      let AP = dt(['กลุ่ม', 'Mark', 'เหล็ก', 'รูป', '~ยาว/เส้น (ม.)', '~จำนวน', '~ทาบ', '~น้ำหนัก (kg)', 'หมายเหตุ'], rows.map(r => [r.grp, esc(r.mark || ''), r.bar, r.shape, f(r.L), r.n, r.laps || '', f(r.kg, 1), esc(r.note)]), `<tr class="tot"><td colspan="7">รวม (ไม่รวมเผื่อเสียหาย)</td><td class="r">${f(tkg, 1)}</td><td></td></tr>`);
      AP += `<p class="rp-txt">สรุปตามขนาดเหล็ก (เผื่อเสียหาย ${M.waste}%, เหล็กยาว 10 ม.)</p>` + dt(['ขนาด', '~ความยาวรวม (ม.)', '~น้ำหนัก (kg)', `~รวมเผื่อ ${M.waste}% (kg)`, '~จำนวนเส้น 10 ม.'], Q.B.byBar.map(o => [o.bar, f(o.L, 1), f(o.kg, 1), f(o.kgw, 1), o.nStock]), `<tr class="tot"><td colspan="3">รวม</td><td class="r">${f(Q.B.byBar.reduce((s, o) => s + o.kgw, 0), 1)}</td><td></td></tr>`);
      out += sec('ก', 'ภาคผนวก ก — ตารางตัดและดัดเหล็ก (BBS)', AP, 'มยผ. / ว.ส.ท.');
      const priced = Q.items.some(x => x.mat || x.lab);
      const bq = Q.items.map((x, i) => [i + 1, esc(x.name), f(x.q, 2), x.unit, ...(priced ? [fk(x.mat), fk(x.lab), fk(x.tot)] : [])]);
      out += sec('ข', 'ภาคผนวก ข — ปริมาณงานโครงสร้าง (BOQ)', dt(['ลำดับ', 'รายการ', '~ปริมาณ', 'หน่วย', ...(priced ? ['~ค่าวัสดุ/หน่วย', '~ค่าแรง/หน่วย', '~รวม (บาท)'] : [])], bq, priced ? `<tr class="tot"><td colspan="6">รวมทั้งสิ้น</td><td class="r">${fk(Q.total)}</td></tr>` : ''));
    }
    out += `<p class="rp-foot"><b>StructCap</b> · รายการคำนวณนี้จัดทำโดยโปรแกรมอัตโนมัติ หน่วย ksc, kg, t, t·m, cm · วิศวกรผู้ออกแบบต้องตรวจสอบข้อมูลนำเข้า แบบจำลอง น้ำหนักบรรทุก และรายละเอียดการเสริมเหล็กก่อนลงนามรับรอง</p>`;
    return `${CSS}<div class="hrp">${out}</div>`;
  }

  G.HOUSERPT = { html };
})(typeof window !== 'undefined' ? window : globalThis);
