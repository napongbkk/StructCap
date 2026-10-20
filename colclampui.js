/* StructCap Column Clamp — prestressed column clamp (stress bars, friction, grout bearing, clamp box, welds) to EN 1993-1-1,
   EN 1993-1-8 and EN 1992-1-1. The calculation is the engineer's workbook (07_T5_Column_Clamp Rev 35) recalculated cell by cell
   by xlcalc.js and drawn by xlsheet.js: only the yellow input cells can be changed; the formulas are locked. Pro only. */
(function (G) {
  'use strict';
  G.SC_COLCLAMP_UI = function (ctx) {
    const { T, esc, $, S, toast, isPro, COPY, today, saveFile, go } = ctx;
    const VIEW = 'colclamp', LS = 'sc.colclamp.v1', CALC = 'Column Clamp', DRAW = 'Clamp Drawings';
    const A = { book: null, busy: false, err: null, tab: CALC, zoom: 'fit', t: null, pdf: false };
    const store = { get() { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { return null; } }, set(v) { try { localStorage.setItem(LS, JSON.stringify(v)); } catch (e) { } } };
    const inputs = () => (A.book ? A.book.S[CALC].sh.inputs : []);
    const saved = () => { const o = {}; inputs().forEach(a => { const c = A.book.cell(CALC, a); if (c && c.v !== c.x0) o[a] = c.v; }); return o; };
    function load() {
      if (A.book || A.busy) return; A.busy = true;
      fetch('colclamp.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(m => {
        A.book = new G.XLCALC.Book(m); const s = store.get();
        if (s && s.inputs) Object.entries(s.inputs).forEach(([a, v]) => { if (A.book.S[CALC].sh.inputs.includes(a)) A.book.set(CALC, a, v); });
      }).catch(e => { A.err = String(e && e.message || e); }).finally(() => { A.busy = false; if (S.view === VIEW) { const r = $('#ccRoot'); if (r) r.outerHTML = body(); paint(); } });
    }
    const locked = () => !isPro();

    // ------------------------------------------------------------------ checks summary (column I = OK / N.G.)
    function checks() {
      const B = A.book, sh = B.S[CALC].sh, out = []; let sec = '';
      const rows = Object.keys(sh.cells).map(a => G.XLCALC.parseAddr(a)).filter(p => p[0] === 1 || p[0] === 9).map(p => p[1]);
      [...new Set(rows)].sort((x, y) => x - y).forEach(r => {
        const h = sh.cells['A' + r]; if (h && /^\d+\.\s/.test(String(h.v || ''))) sec = String(h.v).replace(/\s*\(.*$/, '');
        const ic = sh.cells['I' + r]; if (!ic || !ic.f) return; const v = B.get(CALC, 'I' + r); if (v !== 'OK' && v !== 'N.G.') return;
        const lab = B.get(CALC, 'C' + r), ur = B.get(CALC, 'F' + r);
        out.push({ r, sec, ok: v === 'OK', ur: typeof ur === 'number' ? ur : null, lab: String(lab || '').replace(/\s+=\s+.*$/, '') });
      });
      return out;
    }
    function heads(name) {
      const sh = A.book.S[name].sh, st = A.book.model.styles;
      return Object.keys(sh.cells).filter(a => /^A\d+$/.test(a)).map(a => [+a.slice(1), sh.cells[a]]).filter(([r, c]) => c.v && typeof c.v === 'string' && (name === CALC ? (st[c.s || 0] || {}).bg === 'D9E2F3' : /^C\d+\s+-|SCHEDULE/.test(c.v) && (st[c.s || 0] || {}).b)).sort((x, y) => x[0] - y[0]).map(([r, c]) => [r, name === CALC ? c.v : c.v.replace(/^.*?TYPE 5 COLUMN CLAMP \(CC\)\s+-\s+/, '')]);
    }

    // ------------------------------------------------------------------ page
    function side() {
      const C = checks(), ng = C.filter(c => !c.ok), mx = Math.max(...C.map(c => c.ur || 0)), st = A.book.get(CALC, 'F933');
      return `<div class="cc-stat ${ng.length ? 'bad' : 'ok'}"><b>${ng.length ? T('Checks failing: ', 'ไม่ผ่าน: ') + ng.length : T('All checks OK', 'ผ่านทุกรายการ')}</b><span>${T('Max utilisation', 'อัตราส่วนสูงสุด')} ${mx.toFixed(3)}</span>${st ? `<small>${esc(st)}</small>` : ''}</div>
        <div class="cc-nh">${T('Sheet', 'แผ่นงาน')}</div>${heads(A.tab).map(([r, t]) => `<button class="cc-nav" data-act="cc-go" data-r="${r}">${esc(t)}</button>`).join('')}
        <div class="cc-nh">${T('Checks', 'รายการตรวจสอบ')} (${C.length})</div><div class="cc-checks">${C.map(c => `<button class="cc-ck ${c.ok ? '' : 'bad'}" data-act="cc-go" data-r="${c.r}" data-t="${CALC}" title="${esc(c.sec)}"><span>${esc(c.lab || c.sec)}</span><b>${c.ur != null ? c.ur.toFixed(2) : ''} ${c.ok ? 'OK' : 'N.G.'}</b></button>`).join('')}</div>`;
    }
    function body() {
      if (locked()) return `<div id="ccRoot" class="cc-lock"><div class="card"><h2>🔒 ${T('Prestressed column clamp — Pro', 'แคลมป์เสาอัดแรง — สำหรับสมาชิก Pro')}</h2><p class="muted">${T('Stress bars, friction on the existing column, grout bearing, the welded clamp box and every weld, to EN 1993-1-1, EN 1993-1-8 and EN 1992-1-1, with live drawings. Sign in with a Pro account to use it.', 'เหล็กอัดแรง แรงเสียดทานบนเสาเดิม แรงแบกทานของเกราท์ กล่องแคลมป์เหล็กเชื่อม และรอยเชื่อมทุกจุด ตาม EN 1993-1-1, EN 1993-1-8 และ EN 1992-1-1 พร้อมแบบที่เปลี่ยนตามค่าที่ใส่ เข้าสู่ระบบด้วยบัญชี Pro เพื่อใช้งาน')}</p><div class="cn-btns"><button class="btn btn-hot sm" data-act="nav" data-v="login">${T('Sign in', 'เข้าสู่ระบบ')}</button></div></div></div>`;
      if (!A.book) return `<div id="ccRoot" class="cc-load">${A.err ? T('Could not load the calculation: ', 'โหลดรายการคำนวณไม่ได้: ') + esc(A.err) : T('Loading the calculation…', 'กำลังโหลดรายการคำนวณ…')}</div>`;
      return `<div id="ccRoot" class="cc-wrap"><div class="cc-bar">
          <div class="cc-tabs">${[[CALC, T('Calculation', 'รายการคำนวณ')], [DRAW, T('Drawings', 'แบบร่าง')]].map(([k, l]) => `<button class="cc-tab" data-act="cc-tab" data-v="${k}" aria-pressed="${A.tab === k}">${l}</button>`).join('')}</div>
          <span class="cc-lockt" title="${T('Only the yellow input cells can be changed; the formulas are locked.', 'แก้ได้เฉพาะช่องสีเหลือง สูตรถูกล็อก')}">🔒 ${T('Formulas locked — edit the yellow cells', 'สูตรถูกล็อก — แก้เฉพาะช่องสีเหลือง')}</span><span class="grow"></span>
          <button class="btn btn-ghost xs" data-act="cc-zoom">${A.zoom === 'fit' ? T('Zoom 100 %', 'ขนาดจริง') : T('Fit width', 'พอดีความกว้าง')}</button>
          <button class="btn btn-ghost xs" data-act="cc-reset">${T('Original inputs', 'ค่าเริ่มต้น')}</button>
          <button class="btn btn-ghost xs" data-act="cc-save">${T('Save inputs', 'บันทึกค่า')}</button>
          <label class="btn btn-ghost xs">${T('Open inputs', 'เปิดค่า')}<input type="file" accept=".json" id="cc-file" hidden></label>
          <button class="btn btn-hot xs" data-act="cc-pdf" ${A.pdf ? 'disabled' : ''}>${A.pdf ? T('Preparing PDF…', 'กำลังสร้าง PDF…') : T('Export PDF', 'ส่งออก PDF')}</button></div>
        <div class="cc-main"><aside class="cc-side" id="ccSide"></aside><section class="cc-view" id="ccView"><div class="cc-zoom" id="ccSheet"></div></section></div></div>`;
    }
    function view() { return `<main class="an an-app cc-app">${body()}</main>`; }
    function paint() {
      if (!A.book || A.painting) return; const el = $('#ccSheet'), sv = $('#ccView'); if (!el) return; A.painting = true;
      const act = document.activeElement, aid = act && act.dataset && act.dataset.xs, sel = aid && act.selectionStart != null ? [act.selectionStart, act.selectionEnd] : null, sc = sv ? sv.scrollTop : 0;
      let r; try { r = G.XLSHEET.render(A.book, A.tab, { edit: A.tab === CALC, id: 'cc' }); el.innerHTML = r.html; } catch (e) { A.painting = false; throw e; } fit(r.W);
      const sd = $('#ccSide'); if (sd) sd.innerHTML = side();
      if (aid) { const n = el.querySelector(`[data-xs="${aid}"]`); if (n) { if (n.dataset.raw != null) { n.value = n.dataset.raw; n.dataset.ed = '1'; } n.focus(); if (sel && n.setSelectionRange) try { n.setSelectionRange(sel[0], sel[1]); } catch (e) { } } }
      if (sv) sv.scrollTop = sc; A.painting = false;
    }
    function fit(W) { const el = $('#ccSheet'), sv = $('#ccView'); if (!el || !sv) return; const k = A.zoom === 'fit' ? Math.min(1.6, Math.max(0.3, (sv.clientWidth - 24) / W)) : 1; el.style.zoom = k; el.dataset.k = k; }
    function setInput(a, raw) {
      const s = String(raw).trim(), v = s !== '' && isFinite(+s) && !/^0\d/.test(s) ? +s : s;
      A.book.set(CALC, a, v); store.set({ inputs: saved() });
    }

    // ------------------------------------------------------------------ PDF (page by page, like the workbook's print setup)
    const loadScript = src => new Promise((ok, bad) => { if (document.querySelector(`script[src="${src}"]`)) { ok(); return; } const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
    async function exportPDF() {
      if (G.SC_FEAT_OFF && G.SC_FEAT_OFF('pdf')) return;
      A.pdf = true; refreshBar();
      let host = null;
      try {
        await Promise.all([loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'), loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')]);
        const { jsPDF } = G.jspdf; let pdf = null, n = 0;
        host = document.createElement('div'); host.className = 'pdf-host cc-print'; document.body.appendChild(host);
        for (const [name, fmt, orient] of [[CALC, 'a4', 'portrait'], [DRAW, 'a3', 'landscape']]) {
          const pw = orient === 'portrait' ? 210 : 420, ph = orient === 'portrait' ? 297 : 297, m = 10, ratio = (ph - 2 * m - 6) / (pw - 2 * m);
          for (const [r1, r2] of G.XLSHEET.pages(A.book, name, ratio)) {
            const r = G.XLSHEET.render(A.book, name, { r1, r2 }); host.innerHTML = r.html;
            const cv = await G.html2canvas(host.firstChild, { scale: 2, backgroundColor: '#ffffff', width: r.W, height: r.H, windowWidth: r.W + 20, logging: false });
            if (!pdf) pdf = new jsPDF({ unit: 'mm', format: fmt, orientation: orient }); else pdf.addPage(fmt, orient);
            const k = Math.min((pw - 2 * m) / r.W, (ph - 2 * m - 6) / r.H);
            pdf.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', (pw - r.W * k) / 2, m, r.W * k, r.H * k);
            pdf.setFontSize(7); pdf.setTextColor(120); n++;
            pdf.text(COPY + '  |  ' + name + '  |  ' + today(), m, ph - 5); pdf.text(String(n), pw - m, ph - 5, { align: 'right' });
          }
        }
        const nm = 'Column_Clamp_' + String(A.book.get(CALC, 'D4') || '').replace(/[^\w\-]+/g, '_') + '_' + today() + '.pdf';
        await saveFile(nm, pdf.output('blob')); toast(T('PDF saved', 'บันทึก PDF แล้ว'), 'ok');
      } catch (e) { toast(T('Could not create the PDF here.', 'สร้าง PDF ไม่ได้'), 'bad'); }
      if (host) host.remove(); A.pdf = false; refreshBar();
    }
    function refreshBar() { const r = $('#ccRoot'); if (!r || !A.book) return; const b = r.querySelector('.cc-bar'), t = document.createElement('div'); t.innerHTML = body(); b.replaceWith(t.querySelector('.cc-bar')); }

    // ------------------------------------------------------------------ events
    function onClick(a, b) {
      if (!A.book) return false;
      if (a === 'cc-tab') { A.tab = b.dataset.v; refreshBar(); paint(); const sv = $('#ccView'); if (sv) sv.scrollTop = 0; return true; }
      if (a === 'cc-zoom') { A.zoom = A.zoom === 'fit' ? '100' : 'fit'; refreshBar(); paint(); return true; }
      if (a === 'cc-go') { const t = b.dataset.t || A.tab; if (t !== A.tab) { A.tab = t; refreshBar(); paint(); } const g = G.XLSHEET.geom(A.book.S[A.tab].sh), sv = $('#ccView'), k = +($('#ccSheet').dataset.k || 1); if (sv) sv.scrollTo({ top: (g.rowY[+b.dataset.r] - g.rowY[g.pa[1]]) * k - 8, behavior: 'smooth' }); return true; }
      if (a === 'cc-reset') { if (!confirm(T('Go back to the original inputs of the workbook?', 'กลับไปใช้ค่าเริ่มต้นของไฟล์?'))) return true; inputs().forEach(x => { const c = A.book.cell(CALC, x); A.book.set(CALC, x, c.x0); }); store.set({ inputs: {} }); paint(); toast(T('Original inputs restored', 'คืนค่าเริ่มต้นแล้ว'), 'ok'); return true; }
      if (a === 'cc-save') { saveFile('column-clamp_inputs_' + today() + '.json', new Blob([JSON.stringify({ app: 'StructCap Column Clamp', src: A.book.model.src, inputs: Object.fromEntries(inputs().map(x => [x, A.book.cell(CALC, x).v])) }, null, 1)], { type: 'application/json' })); return true; }
      if (a === 'cc-pdf') { if (!A.pdf) exportPDF(); return true; }
      return false;
    }
    function onInput(t, ev) {
      if (!t.closest('.cc-app') || !A.book) return false;
      const a = t.dataset.xs; if (!a) return true;
      clearTimeout(A.t);
      if (t.tagName === 'SELECT' || (ev && ev.type === 'change')) { setInput(a, t.value); paint(); }
      else A.t = setTimeout(() => { setInput(a, t.value); paint(); }, 450);
      return true;
    }
    let bound = false;
    function mount() {
      load(); if (A.book) paint();
      if (bound) return; bound = true;
      document.addEventListener('change', e => { const t = e.target; if (S.view !== VIEW || !t) return; if (t.dataset && t.dataset.xs && t.tagName === 'INPUT' && !A.painting) { clearTimeout(A.t); setInput(t.dataset.xs, t.value); paint(); }
        if (t.id === 'cc-file') { const fl = t.files[0]; if (!fl) return; fl.text().then(txt => { try { const j = JSON.parse(txt), I = j.inputs || j; let n = 0; Object.entries(I).forEach(([k, v]) => { if (inputs().includes(k)) { A.book.set(CALC, k, v); n++; } }); if (!n) throw 0; store.set({ inputs: saved() }); paint(); toast(n + T(' inputs loaded', ' ค่าโหลดแล้ว'), 'ok'); } catch (er) { toast(T('That is not a column clamp input file.', 'ไฟล์นี้ไม่ใช่ไฟล์ค่าของแคลมป์เสา'), 'bad'); } }); t.value = ''; } });
      document.addEventListener('keydown', e => { const t = e.target; if (S.view !== VIEW || !t || !t.dataset || !t.dataset.xs) return; if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); clearTimeout(A.t); setInput(t.dataset.xs, t.value); const L = inputs(), i = L.indexOf(t.dataset.xs), nx = L[(i + (e.shiftKey ? -1 : 1) + L.length) % L.length]; paint(); const n = document.querySelector(`[data-xs="${nx}"]`); if (n) { n.focus(); if (n.select) n.select(); } } });
      document.addEventListener('focusin', e => { const t = e.target; if (S.view === VIEW && t && t.dataset && t.dataset.xs && t.tagName === 'INPUT' && t.dataset.raw != null && !t.dataset.ed) { t.value = t.dataset.raw; t.dataset.ed = '1'; } });
      window.addEventListener('resize', () => { if (S.view === VIEW && A.book) { const r = $('#ccSheet .xs-sheet'); if (r) fit(parseFloat(r.style.width)); } });
    }
    return { view, mount, onClick, onInput, state: A };
  };
})(typeof window !== 'undefined' ? window : globalThis);
