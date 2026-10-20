/* StructCap XLCalc — evaluates a calculation workbook converted by tools/xlsheet/extract.py, with Excel semantics:
   formulas are parsed once into closures (no eval), values are recomputed on demand after an input changes.
   Supported: + - * / ^ & % comparisons, ranges, sheet references, IF IFERROR AND OR NOT NA TRUE FALSE MAX MIN SUM ABS SQRT
   MOD INT PI CHOOSE MATCH INDEX LEFT FIND COUNTIF TEXT TODAY ROUND ROUNDUP ROUNDDOWN. Errors are XErr values (#N/A, #DIV/0! …). */
(function (G) {
  'use strict';
  class XErr { constructor(e) { this.e = e; } toString() { return this.e; } }
  const ERR = { na: new XErr('#N/A'), div: new XErr('#DIV/0!'), val: new XErr('#VALUE!'), num: new XErr('#NUM!'), ref: new XErr('#REF!'), name: new XErr('#NAME?') };
  const isErr = v => v instanceof XErr;
  const colNum = s => { let n = 0; for (const ch of s) n = n * 26 + ch.charCodeAt(0) - 64; return n; };
  const colName = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; };
  const parseAddr = a => { const m = /^\$?([A-Z]+)\$?(\d+)$/.exec(a); return m ? [colNum(m[1]), +m[2]] : null; };

  // ------------------------------------------------------------------ number formatting (Excel style)
  const r15 = x => (isFinite(x) ? parseFloat(x.toPrecision(15)) : x);
  const roundHalf = (x, d) => { const s = x < 0 ? -1 : 1, a = Math.abs(r15(x)); const r = Number(Math.round(Number(a + 'e' + d)) + 'e-' + d); return s * r; };
  const group = s => { const [i, f] = s.split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f != null ? '.' + f : ''); };
  function general(x) {
    if (!isFinite(x)) return String(x); if (x === 0) return '0';
    const a = Math.abs(x);
    if (a >= 1e11 || a < 1e-9) { let s = x.toExponential(5).replace(/\.?0+e/, 'e').replace('e+', 'E+').replace('e-', 'E-'); return s.replace(/E([+-])(\d)$/, 'E$10$2'); }
    for (let p = 10; p >= 1; p--) { let s = String(parseFloat(x.toPrecision(p))); if (s.includes('e')) s = x.toFixed(Math.max(0, 9 - Math.floor(Math.log10(a)))).replace(/\.?0+$/, ''); if (s.replace('-', '').length <= 11) return s; }
    return String(Math.round(x));
  }
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function serialDate(n) { return new Date(Date.UTC(1899, 11, 30) + Math.round(n * 86400000)); }
  // one section of a number format: literals in quotes or escaped with \, digits 0 # , . E+00 %
  function fmtNum(x, f) {
    if (f == null || f === '' || /^general$/i.test(f)) return general(x);
    const secs = []; let cur = '', q = false; for (let i = 0; i < f.length; i++) { const ch = f[i]; if (ch === '"') q = !q; if (ch === ';' && !q) { secs.push(cur); cur = ''; } else cur += ch; } secs.push(cur);
    let sec = secs[0], neg = false;
    if (x < 0 && secs.length > 1) { sec = secs[1]; x = -x; } else if (x === 0 && secs.length > 2) sec = secs[2];
    if (/[dmy]/i.test(sec.replace(/"[^"]*"/g, '')) && !/[0#]/.test(sec)) { // dates
      const d = serialDate(x), Y = d.getUTCFullYear(), M = d.getUTCMonth(), D = d.getUTCDate();
      return sec.replace(/\\(.)/g, '$1').replace(/"([^"]*)"/g, '$1').replace(/yyyy/gi, Y).replace(/yy/gi, String(Y).slice(2)).replace(/mmmm/gi, MON[M]).replace(/mmm/gi, MON[M]).replace(/mm/gi, String(M + 1).padStart(2, '0')).replace(/dd/gi, String(D).padStart(2, '0'));
    }
    // split literal prefix / suffix around the numeric pattern
    const toks = []; for (let i = 0; i < sec.length; i++) { const ch = sec[i]; if (ch === '"') { const j = sec.indexOf('"', i + 1); toks.push({ lit: sec.slice(i + 1, j < 0 ? sec.length : j) }); i = j < 0 ? sec.length : j; } else if (ch === '\\') { toks.push({ lit: sec[i + 1] || '' }); i++; } else if (/[0#?.,%E+\-]/.test(ch) && !(ch === '-' && !/E/.test(sec.slice(0, i)))) toks.push({ p: ch }); else toks.push({ lit: ch === '_' ? ' ' : ch === '*' ? '' : ch }); }
    const pat = toks.filter(t => t.p).map(t => t.p).join(''), pre = [], post = []; let seen = false; toks.forEach(t => { if (t.p) seen = true; else (seen ? post : pre).push(t.lit); });
    let v = x; if (pat.includes('%')) v *= 100;
    let body;
    const em = /E([+-])(0+)/.exec(pat);
    if (em) {
      const mant = pat.slice(0, em.index), dec = (mant.split('.')[1] || '').replace(/[^0#]/g, '').length;
      if (v === 0) body = (0).toFixed(dec) + 'E+' + '0'.repeat(em[2].length);
      else { let e = Math.floor(Math.log10(Math.abs(v))), m = roundHalf(v / Math.pow(10, e), dec); if (Math.abs(m) >= 10) { e++; m = roundHalf(v / Math.pow(10, e), dec); } body = Math.abs(m).toFixed(dec) + 'E' + (e < 0 ? '-' : '+') + String(Math.abs(e)).padStart(em[2].length, '0'); if (v < 0) body = '-' + body; }
    } else {
      const p = pat.replace(/%/g, ''), parts = p.split('.'), dec = (parts[1] || '').replace(/[^0#]/g, '').length, minDec = (parts[1] || '').replace(/[^0]/g, '').length, grp = parts[0].includes(',');
      const r = roundHalf(v, dec); let s = Math.abs(r).toFixed(dec);
      if (dec > minDec) s = s.replace(new RegExp('0{1,' + (dec - minDec) + '}$'), '').replace(/\.$/, minDec ? '.' : '');
      const intZeros = (parts[0].match(/0/g) || []).length; if (!intZeros && s.startsWith('0') && s.length > 1 && s[1] === '.') s = s.slice(1); else if (!intZeros && s === '0') s = '';
      if (grp) s = group(s);
      body = (v < 0 && secs.length === 1 ? '-' : '') + s;
    }
    return pre.join('') + body + post.join('') + (pat.includes('%') && !post.join('').includes('%') ? '' : '');
  }
  function fmtValue(v, nf) {
    if (v == null) return '';
    if (isErr(v)) return v.e;
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'number') return fmtNum(v, nf);
    if (typeof v === 'string' && nf && /;.*;.*;/.test(nf)) { const t = nf.split(';')[3]; return t.replace('@', v).replace(/"/g, ''); }
    return String(v);
  }
  const numToStr = x => { if (Number.isInteger(x)) return String(x); let s = String(parseFloat(x.toPrecision(15))); if (s.includes('e')) s = s.replace('e', 'E'); return s; };

  // ------------------------------------------------------------------ tokenizer and parser
  function tokenize(f) {
    const T = []; let i = 0;
    const SHEET = /^(?:'((?:[^']|'')+)'|([A-Za-z_][\w.]*))!/;
    while (i < f.length) {
      const ch = f[i], rest = f.slice(i);
      if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') { i++; continue; }
      if (ch === '"') { let j = i + 1, s = ''; for (;;) { if (j >= f.length) break; if (f[j] === '"') { if (f[j + 1] === '"') { s += '"'; j += 2; continue; } break; } s += f[j++]; } T.push({ t: 'str', v: s }); i = j + 1; continue; }
      let m;
      if ((m = /^#(N\/A|DIV\/0!|VALUE!|REF!|NUM!|NAME\?|NULL!)/.exec(rest))) { T.push({ t: 'err', v: '#' + m[1] }); i += m[0].length; continue; }
      if ((m = /^(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)/.exec(rest))) { T.push({ t: 'num', v: parseFloat(m[1]) }); i += m[0].length; continue; }
      let sheet = null, j = i; if ((m = SHEET.exec(rest))) { sheet = (m[1] || m[2]).replace(/''/g, "'"); j = i + m[0].length; }
      const r2 = f.slice(j);
      if ((m = /^(\$?[A-Z]{1,3}\$?\d+)(?::(\$?[A-Z]{1,3}\$?\d+))?(?![\w(])/.exec(r2))) { T.push({ t: 'ref', sheet, a: m[1].replace(/\$/g, ''), b: m[2] ? m[2].replace(/\$/g, '') : null }); i = j + m[0].length; continue; }
      if (sheet == null && (m = /^([A-Za-z_][\w.]*)\s*\(/.exec(rest))) { T.push({ t: 'fn', v: m[1].toUpperCase() }); i += m[0].length; continue; }
      if (sheet == null && (m = /^(TRUE|FALSE)(?![\w(])/i.exec(rest))) { T.push({ t: 'bool', v: m[1].toUpperCase() === 'TRUE' }); i += m[0].length; continue; }
      if ((m = /^(<>|<=|>=|[-+*/^&=<>%(),:{};])/.exec(rest))) { T.push({ t: 'op', v: m[1] }); i += m[0].length; continue; }
      throw new Error('Cannot read formula at: ' + rest.slice(0, 20));
    }
    return T;
  }
  function parse(f) {
    const T = tokenize(f); let p = 0;
    const peek = () => T[p], take = () => T[p++], isOp = v => T[p] && T[p].t === 'op' && T[p].v === v;
    function expr() { let a = concat(); while (T[p] && T[p].t === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(T[p].v)) { const o = take().v, b = concat(); a = { k: 'bin', o, a, b }; } return a; }
    function concat() { let a = add(); while (isOp('&')) { take(); a = { k: 'bin', o: '&', a, b: add() }; } return a; }
    function add() { let a = mul(); while (isOp('+') || isOp('-')) { const o = take().v; a = { k: 'bin', o, a, b: mul() }; } return a; }
    function mul() { let a = pow(); while (isOp('*') || isOp('/')) { const o = take().v; a = { k: 'bin', o, a, b: pow() }; } return a; }
    function pow() { let a = unary(); while (isOp('^')) { take(); a = { k: 'bin', o: '^', a, b: unary() }; } return a; }
    function unary() { if (isOp('-')) { take(); return { k: 'neg', a: unary() }; } if (isOp('+')) { take(); return unary(); } return postfix(); }
    function postfix() { let a = primary(); while (isOp('%')) { take(); a = { k: 'pct', a }; } return a; }
    function primary() {
      const t = take(); if (!t) throw new Error('Unexpected end of formula');
      if (t.t === 'num') return { k: 'lit', v: t.v }; if (t.t === 'str') return { k: 'lit', v: t.v }; if (t.t === 'bool') return { k: 'lit', v: t.v }; if (t.t === 'err') return { k: 'lit', v: new XErr(t.v) };
      if (t.t === 'ref') return { k: 'ref', sheet: t.sheet, a: t.a, b: t.b };
      if (t.t === 'fn') { const args = []; if (isOp(')')) { take(); return { k: 'fn', n: t.v, args }; } for (;;) { if (isOp(',') || isOp(')')) args.push({ k: 'lit', v: null }); else args.push(expr()); const s = take(); if (!s || s.t !== 'op') throw new Error('Bad argument list'); if (s.v === ')') break; if (s.v !== ',') throw new Error('Bad argument list'); } return { k: 'fn', n: t.v, args }; }
      if (t.t === 'op' && t.v === '{') { const arr = []; for (;;) { let sg = 1; if (isOp('-')) { take(); sg = -1; } const x = take(); if (!x) throw new Error('Bad array'); arr.push(x.t === 'num' ? sg * x.v : x.v); const s = take(); if (s && s.t === 'op' && s.v === '}') break; } return { k: 'lit', v: { arr } }; }
      if (t.t === 'op' && t.v === '(') { const e = expr(); if (!isOp(')')) throw new Error('Missing )'); take(); return e; }
      throw new Error('Unexpected ' + (t.v || t.t));
    }
    const e = expr(); if (p < T.length) throw new Error('Unexpected ' + T[p].v); return e;
  }

  // ------------------------------------------------------------------ workbook
  function Book(model) {
    this.model = model; this.S = {}; this.gen = 1; this.today = null;
    model.sheets.forEach(sh => { const cells = {}; Object.entries(sh.cells).forEach(([a, c]) => { const rc = parseAddr(a); cells[a] = { c: rc[0], r: rc[1], f: c.f, v: c.f ? undefined : c.v, s: c.s, x0: c.v }; }); this.S[sh.name] = { sh, cells }; });
    this.first = model.sheets[0].name;
  }
  const BP = Book.prototype;
  BP.cell = function (sheet, a) { const S = this.S[sheet]; return S ? S.cells[a] : null; };
  BP.set = function (sheet, a, v) { const S = this.S[sheet]; let c = S.cells[a]; if (!c) { const rc = parseAddr(a); c = S.cells[a] = { c: rc[0], r: rc[1] }; } c.v = v; this.gen++; };
  BP.get = function (sheet, a) { const S = this.S[sheet]; if (!S) return ERR.ref; const c = S.cells[a]; if (!c) return null; return this.value(c, sheet); };
  BP.value = function (c, sheet) {
    if (!c.f) return c.v === undefined ? null : c.v;
    if (c.g === this.gen) return c.val;
    if (c.busy) return ERR.ref; // circular
    if (!c.fn) { try { c.fn = compile(parse(c.f)); } catch (e) { c.fn = () => ERR.name; c.perr = e.message; } }
    c.busy = true; let v; try { v = c.fn(this, sheet); } catch (e) { v = e instanceof XErr ? e : ERR.value; } c.busy = false;
    if (v && v.range) v = this.rangeFirst(v); if (v === undefined) v = 0;
    c.val = v; c.g = this.gen; return v;
  };
  BP.rangeFirst = function (r) { const a = colName(r.c1) + r.r1; return this.get(r.sheet, a); };
  BP.rangeVals = function (r) { const out = []; for (let rr = r.r1; rr <= r.r2; rr++) for (let cc = r.c1; cc <= r.c2; cc++) out.push(this.get(r.sheet, colName(cc) + rr)); return out; };
  BP.evalFormula = function (f, sheet) { const fn = compile(parse(f)); const v = fn(this, sheet || this.first); return v && v.range ? this.rangeFirst(v) : v; };

  // ------------------------------------------------------------------ coercion and comparison
  function toNum(v) { if (v == null || v === '') return 0; if (typeof v === 'number') return v; if (typeof v === 'boolean') return v ? 1 : 0; if (isErr(v)) throw v; const s = String(v).trim(); if (s !== '' && isFinite(+s)) return +s; throw ERR.val; }
  function toStr(v) { if (v == null) return ''; if (typeof v === 'string') return v; if (typeof v === 'number') return numToStr(v); if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'; if (isErr(v)) throw v; return String(v); }
  function toBool(v) { if (isErr(v)) throw v; if (v == null) return false; if (typeof v === 'boolean') return v; if (typeof v === 'number') return v !== 0; const s = String(v).toUpperCase(); if (s === 'TRUE') return true; if (s === 'FALSE') return false; throw ERR.val; }
  const rank = v => (typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : 2);
  function cmp(a, b) {
    if (isErr(a)) throw a; if (isErr(b)) throw b;
    if (a == null) a = typeof b === 'string' ? '' : typeof b === 'boolean' ? false : 0;
    if (b == null) b = typeof a === 'string' ? '' : typeof a === 'boolean' ? false : 0;
    const ra = rank(a), rb = rank(b); if (ra !== rb) return ra < rb ? -1 : 1;
    if (ra === 1) { const x = a.toLowerCase(), y = b.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; }
    if (ra === 2) return (a ? 1 : 0) - (b ? 1 : 0);
    const x = r15(a), y = r15(b); return x < y ? -1 : x > y ? 1 : 0;
  }

  // ------------------------------------------------------------------ compile AST -> closure
  function compile(n) {
    switch (n.k) {
      case 'lit': { const v = n.v; return () => v; }
      case 'ref': {
        const a = parseAddr(n.a), b = n.b ? parseAddr(n.b) : null, sh = n.sheet;
        if (!b) { const addr = colName(a[0]) + a[1]; return (B, cur) => B.get(sh || cur, addr); }
        const r = { c1: Math.min(a[0], b[0]), r1: Math.min(a[1], b[1]), c2: Math.max(a[0], b[0]), r2: Math.max(a[1], b[1]) };
        return (B, cur) => ({ range: true, sheet: sh || cur, c1: r.c1, r1: r.r1, c2: r.c2, r2: r.r2 });
      }
      case 'neg': { const a = compile(n.a); return (B, s) => { const v = sc(B, a(B, s)); if (isErr(v)) return v; return -toNum(v); }; }
      case 'pct': { const a = compile(n.a); return (B, s) => { const v = sc(B, a(B, s)); if (isErr(v)) return v; return toNum(v) / 100; }; }
      case 'bin': {
        const a = compile(n.a), b = compile(n.b), o = n.o;
        return (B, s) => {
          const x = sc(B, a(B, s)), y = sc(B, b(B, s)); if (isErr(x)) return x; if (isErr(y)) return y;
          switch (o) {
            case '+': return toNum(x) + toNum(y); case '-': return toNum(x) - toNum(y); case '*': return toNum(x) * toNum(y);
            case '/': { const d = toNum(y); if (d === 0) return ERR.div; return toNum(x) / d; }
            case '^': { const r = Math.pow(toNum(x), toNum(y)); return isFinite(r) ? r : ERR.num; }
            case '&': return toStr(x) + toStr(y);
            case '=': return cmp(x, y) === 0; case '<>': return cmp(x, y) !== 0; case '<': return cmp(x, y) < 0; case '>': return cmp(x, y) > 0; case '<=': return cmp(x, y) <= 0; case '>=': return cmp(x, y) >= 0;
          }
          return ERR.value;
        };
      }
      case 'fn': {
        const F = FN[n.n]; if (!F) return () => ERR.name;
        const args = n.args.map(compile);
        return (B, s) => F(B, s, args);
      }
    }
    return () => ERR.value;
  }
  const sc = (B, v) => (v && v.range ? B.rangeFirst(v) : v && v.arr ? v.arr[0] : v); // scalar context: a range used as a value takes its first cell
  // evaluate an argument to a scalar
  const ev = (B, s, f) => sc(B, f(B, s));
  // flatten arguments: ranges give their cells (text / logical in ranges skipped by numeric functions)
  function nums(B, s, args, strict) {
    const out = [];
    for (const f of args) {
      const v = f(B, s);
      if (v && (v.range || v.arr)) { for (const x of (v.arr || B.rangeVals(v))) { if (isErr(x)) throw x; if (typeof x === 'number') out.push(x); } }
      else { if (isErr(v)) throw v; if (v == null) { if (strict) out.push(0); continue; } if (typeof v === 'boolean') out.push(v ? 1 : 0); else out.push(toNum(v)); }
    }
    return out;
  }
  const W = fn => (B, s, a) => { try { return fn(B, s, a); } catch (e) { if (e instanceof XErr) return e; throw e; } };
  function crit(c) { // COUNTIF criteria
    if (typeof c === 'number' || typeof c === 'boolean') return v => v === c;
    const m = /^(<=|>=|<>|<|>|=)?(.*)$/.exec(String(c)), op = m[1] || '=', rhs = m[2], n = rhs !== '' && isFinite(+rhs) ? +rhs : null;
    return v => { if (n != null && typeof v === 'number') { return op === '=' ? v === n : op === '<>' ? v !== n : op === '<' ? v < n : op === '>' ? v > n : op === '<=' ? v <= n : v >= n; } if (n != null) return op === '<>'; const s = v == null ? '' : String(v).toLowerCase(), t = rhs.toLowerCase(); const re = new RegExp('^' + t.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$'); return op === '<>' ? !re.test(s) : op === '=' ? re.test(s) : false; };
  }
  const FN = {
    IF: (B, s, a) => { const c = ev(B, s, a[0]); if (isErr(c)) return c; let t; try { t = toBool(c); } catch (e) { return e; } if (t) return a.length > 1 ? sc(B, a[1](B, s)) ?? 0 : true; return a.length > 2 ? sc(B, a[2](B, s)) ?? 0 : false; },
    IFERROR: (B, s, a) => { const v = ev(B, s, a[0]); return isErr(v) ? ev(B, s, a[1]) : v; },
    AND: W((B, s, a) => { let r = true, any = false; for (const f of a) { const v = f(B, s); const L = v && v.range ? B.rangeVals(v).filter(x => typeof x !== 'string' && x != null) : [v]; for (const x of L) { if (isErr(x)) throw x; if (typeof x === 'string') throw ERR.val; if (x == null) continue; any = true; if (!toBool(x)) r = false; } } return any ? r : ERR.val; }),
    OR: W((B, s, a) => { let r = false, any = false; for (const f of a) { const v = f(B, s); const L = v && v.range ? B.rangeVals(v).filter(x => typeof x !== 'string' && x != null) : [v]; for (const x of L) { if (isErr(x)) throw x; if (typeof x === 'string') throw ERR.val; if (x == null) continue; any = true; if (toBool(x)) r = true; } } return any ? r : ERR.val; }),
    NOT: W((B, s, a) => !toBool(ev(B, s, a[0]))),
    NA: () => ERR.na, TRUE: () => true, FALSE: () => false, PI: () => Math.PI,
    TODAY: B => { if (B.today != null) return B.today; const d = new Date(); return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86400000); },
    MAX: W((B, s, a) => { const v = nums(B, s, a); return v.length ? Math.max(...v) : 0; }),
    MIN: W((B, s, a) => { const v = nums(B, s, a); return v.length ? Math.min(...v) : 0; }),
    SUM: W((B, s, a) => nums(B, s, a).reduce((x, y) => x + y, 0)),
    ABS: W((B, s, a) => Math.abs(toNum(ev(B, s, a[0])))),
    SQRT: W((B, s, a) => { const x = toNum(ev(B, s, a[0])); return x < 0 ? ERR.num : Math.sqrt(x); }),
    INT: W((B, s, a) => Math.floor(toNum(ev(B, s, a[0])))),
    MOD: W((B, s, a) => { const n = toNum(ev(B, s, a[0])), d = toNum(ev(B, s, a[1])); if (d === 0) return ERR.div; return n - d * Math.floor(n / d); }),
    ROUND: W((B, s, a) => roundHalf(toNum(ev(B, s, a[0])), toNum(ev(B, s, a[1])))),
    ROUNDUP: W((B, s, a) => { const x = toNum(ev(B, s, a[0])), p = Math.pow(10, toNum(ev(B, s, a[1]))); return Math.sign(x) * Math.ceil(r15(Math.abs(x) * p)) / p; }),
    ROUNDDOWN: W((B, s, a) => { const x = toNum(ev(B, s, a[0])), p = Math.pow(10, toNum(ev(B, s, a[1]))); return Math.sign(x) * Math.floor(r15(Math.abs(x) * p)) / p; }),
    CHOOSE: W((B, s, a) => { const i = Math.trunc(toNum(ev(B, s, a[0]))); if (i < 1 || i >= a.length) return ERR.val; return ev(B, s, a[i]); }),
    LEFT: W((B, s, a) => { const t = toStr(ev(B, s, a[0])), n = a.length > 1 ? toNum(ev(B, s, a[1])) : 1; return n < 0 ? ERR.val : t.slice(0, n); }),
    FIND: W((B, s, a) => { const x = toStr(ev(B, s, a[0])), t = toStr(ev(B, s, a[1])), st = a.length > 2 ? toNum(ev(B, s, a[2])) : 1; const i = t.indexOf(x, st - 1); return i < 0 ? ERR.val : i + 1; }),
    TEXT: W((B, s, a) => { const v = ev(B, s, a[0]), f = toStr(ev(B, s, a[1])); if (typeof v === 'string' && !(v.trim() !== '' && isFinite(+v))) return v; return fmtNum(toNum(v), f); }),
    MATCH: W((B, s, a) => { const x = ev(B, s, a[0]), r = a[1](B, s), t = a.length > 2 ? toNum(ev(B, s, a[2])) : 1; if (isErr(x)) return x; const L = r && r.range ? B.rangeVals(r) : r && r.arr ? r.arr : [r]; if (t === 0) { for (let i = 0; i < L.length; i++) if (L[i] != null && !isErr(L[i]) && rank(L[i]) === rank(x) && cmp(L[i], x) === 0) return i + 1; return ERR.na; } let best = -1; for (let i = 0; i < L.length; i++) { const v = L[i]; if (v == null || isErr(v) || rank(v) !== rank(x)) continue; const c = cmp(v, x); if (t > 0 ? c <= 0 : c >= 0) best = i; else break; } return best < 0 ? ERR.na : best + 1; }),
    INDEX: W((B, s, a) => { const r = a[0](B, s); if (r && r.arr) { const i = Math.trunc(toNum(ev(B, s, a[a.length > 2 && toNum(ev(B, s, a[1])) === 1 ? 2 : 1]))); return i >= 1 && i <= r.arr.length ? r.arr[i - 1] : ERR.ref; } if (!(r && r.range)) return r; const ri = Math.trunc(toNum(ev(B, s, a[1]))), ci = a.length > 2 ? Math.trunc(toNum(ev(B, s, a[2]))) : 1; const rows = r.r2 - r.r1 + 1, cols = r.c2 - r.c1 + 1; let R = ri, C = ci; if (rows === 1 && a.length === 2) { R = 1; C = ri; } if (R < 1 || C < 1 || R > rows || C > cols) return ERR.ref; return B.get(r.sheet, colName(r.c1 + C - 1) + (r.r1 + R - 1)); }),
    COUNTIF: W((B, s, a) => { const r = a[0](B, s), c = ev(B, s, a[1]), t = crit(c); const L = r && r.range ? B.rangeVals(r) : [r]; return L.filter(v => !isErr(v) && t(v)).length; })
  };

  G.XLCALC = { Book, parse, compile, fmtNum, fmtValue, general, XErr, isErr, colName, colNum, parseAddr, roundHalf, FN };
})(typeof window !== 'undefined' ? window : globalThis);
