/* ============================================================
   StructCap — core engine
   Shared solver, SVG section diagrams, routing, UI helpers.
   ============================================================ */
"use strict";

const StructCap = (() => {

  /* ---------- number & formatting helpers ---------- */
  const fmt = (v, d = 1) => {
    if (v === null || v === undefined || Number.isNaN(v)) return "—";
    if (!Number.isFinite(v)) return "—";
    return v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const uid = (() => { let n = 0; return () => "id" + (++n) + Math.random().toString(36).slice(2, 6); })();

  /* ============================================================
     GENERIC ULS FLEXURE SOLVER (rectangular stress block)
     Works for any code by passing the stress-block parameters.
     Sign convention: y measured DOWN from the top (compression)
     fibre. Compression stress/force positive, tension negative.
     ============================================================ */
  function solveFlexure({ b, h, layers, fc, fy, Es, ecu, alpha, betaOf }) {
    // layers: [{ y, As }]  y = depth from top fibre (mm), As = mm^2
    // alpha  = uniform stress-block stress = alpha * fc
    // betaOf(c) => stress block depth ratio a = beta*c  (may depend on fc)
    const stress = alpha * fc; // MPa, block stress
    const capSteel = (strain) => clamp(Es * strain, -fy, fy);

    function forcesFor(c) {
      c = Math.max(c, 1e-6);
      const beta = betaOf(fc);
      const a = Math.min(beta * c, h);
      const Cc = stress * b * a; // concrete compression force (positive)
      let steelSum = 0;
      let momentSum = Cc * (a / 2);
      const rows = [];
      for (const L of layers) {
        const strain = ecu * (c - L.y) / c; // + compression
        let f = capSteel(strain);
        // if this layer sits inside the compression block, the concrete
        // stress there is already counted in Cc, so subtract the
        // displaced-concrete contribution to avoid double counting.
        if (L.y < a && f > 0) f -= stress;
        const F = f * L.As;
        steelSum += F;
        momentSum += F * L.y;
        rows.push({ y: L.y, As: L.As, strain, stress: f, F });
      }
      return { c, a, Cc, steelSum, momentSum, rows, netF: Cc + steelSum };
    }

    // bisection on c to satisfy netF = 0
    let lo = 0.001 * h, hi = h * 3, best = forcesFor(hi);
    let fLo = forcesFor(lo).netF, fHi = forcesFor(hi).netF;
    // widen hi if needed (heavily over-reinforced/odd cases)
    let iter = 0;
    while (fLo * fHi > 0 && hi < h * 50 && iter < 60) { hi *= 1.5; fHi = forcesFor(hi).netF; iter++; }
    let mid, fMid, res;
    for (let i = 0; i < 80; i++) {
      mid = (lo + hi) / 2;
      res = forcesFor(mid);
      fMid = res.netF;
      if (Math.abs(fMid) < 1e-6 * Math.max(1, b * h)) break;
      if ((fLo < 0) === (fMid < 0)) { lo = mid; fLo = fMid; } else { hi = mid; fHi = fMid; }
    }
    res.Mn = Math.abs(res.momentSum); // N·mm
    res.beta = betaOf(fc);
    res.stress = stress;
    return res;
  }

  /* ============================================================
     Circular / rectangular COLUMN biaxial interaction (placeholder
     hook kept for future module — not used by beam page).
     ============================================================ */

  /* ============================================================
     SVG SECTION DIAGRAM RENDERER
     ============================================================ */
  const NS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function drawBeamSection({ b, h, cover, bars, outerLink, internalLinks, neutralAxisMajor, neutralAxisMinor }) {
    // bars: [{x, y, dia, role}]  x,y = position from top-left corner (mm)
    const pad = 46;
    const scale = Math.min(320 / b, 380 / h);
    const W = b * scale + pad * 2 + 90;
    const H = h * scale + pad * 2;
    const ox = pad, oy = pad;

    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, style: "width:100%;height:auto;display:block", role: "img", "aria-label": "Beam cross-section" });

    const col = {
      concrete: "var(--diag-concrete)",
      concreteEdge: "var(--diag-edge)",
      bar: "var(--diag-bar)",
      stirrup: "var(--diag-stirrup)",
      dim: "var(--diag-dim)",
      na: "var(--diag-na)",
      text: "var(--diag-text)"
    };

    // concrete outline
    svg.appendChild(svgEl("rect", {
      x: ox, y: oy, width: b * scale, height: h * scale,
      fill: col.concrete, stroke: col.concreteEdge, "stroke-width": 2, rx: 2
    }));

    // outer link (rounded rect inset by cover)
    const c = cover * scale;
    if (outerLink && outerLink.dia > 0) {
      svg.appendChild(svgEl("rect", {
        x: ox + c, y: oy + c, width: b * scale - 2 * c, height: h * scale - 2 * c,
        fill: "none", stroke: col.stirrup, "stroke-width": 1.6, rx: 6
      }));
    }
    // internal links — extra vertical legs spaced evenly across the clear width
    if (internalLinks && internalLinks.count > 0) {
      const nLeg = internalLinks.count;
      const innerLeft = ox + c, innerRight = ox + b * scale - c;
      for (let i = 1; i <= nLeg; i++) {
        const xx = innerLeft + ((innerRight - innerLeft) * i) / (nLeg + 1);
        svg.appendChild(svgEl("line", { x1: xx, y1: oy + c, x2: xx, y2: oy + h * scale - c, stroke: col.stirrup, "stroke-width": 1.4, "stroke-dasharray": "4 3" }));
      }
    }

    // neutral axis — major (horizontal line, from top)
    if (neutralAxisMajor && neutralAxisMajor > 0 && neutralAxisMajor < h) {
      const yNA = oy + neutralAxisMajor * scale;
      svg.appendChild(svgEl("line", { x1: ox - 10, y1: yNA, x2: ox + b * scale + 10, y2: yNA, stroke: col.na, "stroke-width": 1.3, "stroke-dasharray": "5 4" }));
    }
    // neutral axis — minor (vertical line, from left)
    if (neutralAxisMinor && neutralAxisMinor > 0 && neutralAxisMinor < b) {
      const xNA = ox + neutralAxisMinor * scale;
      svg.appendChild(svgEl("line", { x1: xNA, y1: oy - 10, x2: xNA, y2: oy + h * scale + 10, stroke: col.na, "stroke-width": 1.1, "stroke-dasharray": "2 4", opacity: 0.7 }));
    }

    // rebar
    bars.forEach((bar) => {
      const xx = ox + bar.x * scale, yy = oy + bar.y * scale;
      const r = Math.max(2.6, (bar.dia * scale) / 2.6);
      svg.appendChild(svgEl("circle", { cx: xx, cy: yy, r, fill: col.bar, stroke: col.concreteEdge, "stroke-width": 0.6 }));
    });

    // dimension lines: width (bottom) and height (right)
    const dimY = oy + h * scale + 22;
    svg.appendChild(svgEl("line", { x1: ox, y1: dimY, x2: ox + b * scale, y2: dimY, stroke: col.dim, "stroke-width": 1 }));
    svg.appendChild(svgEl("line", { x1: ox, y1: dimY - 4, x2: ox, y2: dimY + 4, stroke: col.dim, "stroke-width": 1 }));
    svg.appendChild(svgEl("line", { x1: ox + b * scale, y1: dimY - 4, x2: ox + b * scale, y2: dimY + 4, stroke: col.dim, "stroke-width": 1 }));
    const wLbl = svgEl("text", { x: ox + (b * scale) / 2, y: dimY + 16, fill: col.text, "font-size": 11, "text-anchor": "middle", "font-family": "var(--font-mono)" });
    wLbl.textContent = "b = " + fmt(b, 0) + " mm";
    svg.appendChild(wLbl);

    const dimX = ox + b * scale + 46;
    svg.appendChild(svgEl("line", { x1: dimX, y1: oy, x2: dimX, y2: oy + h * scale, stroke: col.dim, "stroke-width": 1 }));
    const hLbl = svgEl("text", { x: dimX + 14, y: oy + (h * scale) / 2, fill: col.text, "font-size": 11, "text-anchor": "middle", "font-family": "var(--font-mono)", transform: `rotate(90 ${dimX + 14} ${oy + (h * scale) / 2})` });
    hLbl.textContent = "h = " + fmt(h, 0) + " mm";
    svg.appendChild(hLbl);

    return svg;
  }

  /* ============================================================
     Small UI helpers
     ============================================================ */
  function el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") e.className = v;
      else if (k === "html") e.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null) e.setAttribute(k, v);
    }
    for (const c of [].concat(children)) {
      if (c === null || c === undefined) continue;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return e;
  }

  function numberField({ id, label, value, unit, step = "any", min, hint }) {
    const input = el("input", { type: "number", id, value, step, class: "field-input" });
    if (min !== undefined) input.min = min;
    return el("label", { class: "field", for: id }, [
      el("span", { class: "field-label" }, label),
      el("div", { class: "field-row" }, [
        input,
        unit ? el("span", { class: "field-unit" }, unit) : null
      ]),
      hint ? el("span", { class: "field-hint" }, hint) : null
    ]);
  }

  function selectField({ id, label, options, value, hint }) {
    const sel = el("select", { id, class: "field-input" },
      options.map(o => el("option", { value: o.value, selected: o.value === value ? "" : undefined }, o.label))
    );
    return el("label", { class: "field", for: id }, [
      el("span", { class: "field-label" }, label),
      sel,
      hint ? el("span", { class: "field-hint" }, hint) : null
    ]);
  }

  function statTile({ label, value, unit, tone = "" }) {
    return el("div", { class: "stat-tile " + tone }, [
      el("span", { class: "stat-label" }, label),
      el("span", { class: "stat-value" }, [value, unit ? el("span", { class: "stat-unit" }, " " + unit) : null])
    ]);
  }

  function verdictPill(ok, passText = "OK", failText = "FAIL") {
    return el("span", { class: "pill " + (ok ? "pill-ok" : "pill-fail") }, ok ? passText : failText);
  }

  /* ---------- toast ---------- */
  function toast(msg) {
    const t = el("div", { class: "toast" }, msg);
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 2200);
  }

  return { fmt, clamp, uid, solveFlexure, drawBeamSection, el, numberField, selectField, statTile, verdictPill, toast };
})();
