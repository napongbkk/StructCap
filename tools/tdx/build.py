"""Finalise raw extraction (vec.extract) into CAD entities in pixel space (y down), then export to paper mm.
   Pixel-space entity forms:
     line  {t:'line', a:(x,y), b:(x,y), w:px, lt}
     arc   {t:'arc', c:(x,y), r, s:deg, e:deg (ccw in the image frame, y down), w, lt}
     circle{t:'circle', c, r, w, lt}
     solid {t:'solid', p:[(x,y)...]}
     text  {t:'text', s, x, y (baseline-left), h (cap height px), wf, ang (0|90)}"""
import math, json, re, numpy as np, cv2
import vec, ftext

def ang_norm(a): return a % 360.0

def arc_interval(a):
    """(s, e) ccw in degrees (image frame) for a raw arc from vec."""
    a0, a1, am = a['a0'] % 360, a['a1'] % 360, a['am'] % 360
    if (am - a0) % 360 <= (a1 - a0) % 360: return a0, a1
    return a1, a0

def merge_arcs(arcs, lines):
    groups = []
    for a in arcs:
        cx, cy = a['c']; r = a['r']
        g = None
        for G in groups:
            if math.hypot(G['c'][0] - cx, G['c'][1] - cy) < max(4, 0.03 * r) and abs(G['r'] - r) < max(3, 0.03 * r): g = G; break
        iv = (0, 360) if a.get('closed') else arc_interval(a)
        if g: g['iv'].append(iv); g['w'].append(a['w']); g['n'] += a['n']
        else: groups.append(dict(c=(cx, cy), r=r, iv=[iv], w=[a['w']], n=a['n']))
    # absorb short lines lying on a found circle
    keep = []
    for L in lines:
        ax, ay = L['a']; bx, by = L['b']; mx, my = (ax + bx) / 2, (ay + by) / 2
        ln = math.hypot(bx - ax, by - ay); hit = None
        if L.get('lt', 'CONTINUOUS') == 'CONTINUOUS':
            for G in groups:
                cx, cy = G['c']; r = G['r']
                if r < 8 or ln > 0.6 * r: continue
                d = [abs(math.hypot(px - cx, py - cy) - r) for px, py in ((ax, ay), (bx, by), (mx, my))]
                tol = max(1.8, 0.01 * r) + 0.0
                # the midpoint of a chord sits inside the circle by r - sqrt(r^2 - (l/2)^2)
                sag = r - math.sqrt(max(r * r - (ln / 2) ** 2, 0))
                if d[0] < tol + 1 and d[1] < tol + 1 and abs(d[2] - sag) < tol + 1: hit = G; break
        if hit:
            cx, cy = hit['c']
            s = math.degrees(math.atan2(ay - cy, ax - cx)) % 360; e = math.degrees(math.atan2(by - cy, bx - cx)) % 360
            if (e - s) % 360 > 180: s, e = e, s
            hit['iv'].append((s, e)); hit['w'].append(L['w'])
        else: keep.append(L)
    out = []
    for G in groups:
        # union of intervals on the circle
        cov = np.zeros(720, bool)
        for s, e in G['iv']:
            span = (e - s) % 360 if (s, e) != (0, 360) else 360
            if span == 0 and (s, e) == (0, 360): span = 360
            i0 = int(round(s * 2)); n = int(round(span * 2)) + 1
            idx = (np.arange(n) + i0) % 720; cov[idx] = True
        w = float(np.median(G['w']))
        if cov.mean() > 0.97:
            out.append(dict(t='circle', c=G['c'], r=G['r'], w=w, lt='CONTINUOUS')); continue
        # runs of coverage (bridge gaps < 4 deg)
        c2 = cov.copy()
        gaps = []
        if not c2.all():
            start = int(np.argmin(c2))  # a False position
            seq = np.roll(c2, -start)
            runs = []; i = 0
            while i < 720:
                if seq[i]:
                    j = i
                    while j < 720 and seq[j]: j += 1
                    runs.append([i, j]); i = j
                else: i += 1
            # merge runs separated by small gaps
            merged = []
            for r_ in runs:
                if merged and r_[0] - merged[-1][1] < 8: merged[-1][1] = r_[1]
                else: merged.append(r_)
            if len(merged) > 1 and (720 - merged[-1][1] + merged[0][0]) < 8:
                merged[0][0] = merged[-1][0] - 720; merged.pop()
            for r0, r1 in merged:
                s = ((r0 + start) / 2.0) % 360; e = ((r1 + start) / 2.0) % 360
                if (r1 - r0) / 2.0 < 3: continue
                out.append(dict(t='arc', c=G['c'], r=G['r'], s=s, e=e, w=w, lt='CONTINUOUS'))
    return out, keep

def dashed_circles(lines, dots, H, W):
    """find circles drawn with a broken linetype: many short pieces on a common circle."""
    short = [L for L in lines if L.get('lt', 'CONTINUOUS') == 'CONTINUOUS' and math.hypot(L['b'][0] - L['a'][0], L['b'][1] - L['a'][1]) < 70]
    if len(short) < 6: return [], lines
    img = np.zeros((H, W), np.uint8)
    for L in short: cv2.line(img, tuple(map(int, L['a'])), tuple(map(int, L['b'])), 255, 2)
    for d in dots: cv2.circle(img, (int(d[0]), int(d[1])), 2, 255, -1)
    # work at quarter resolution for Hough speed
    sm = cv2.resize(img, (W // 2, H // 2), interpolation=cv2.INTER_AREA)
    cs = cv2.HoughCircles(cv2.GaussianBlur(sm, (5, 5), 1), cv2.HOUGH_GRADIENT, dp=1, minDist=20, param1=60, param2=22, minRadius=15, maxRadius=600)
    found, used = [], set()
    if cs is None: return [], lines
    cell = {}
    for L in short:
        for q in (L['a'], L['b']): cell.setdefault((int(q[0] // 100), int(q[1] // 100)), []).append(L)
    for cx, cy, r in cs[0][:400]:
        cx, cy, r = cx * 2, cy * 2, r * 2
        mem = []
        cand = {}
        for gx in range(int((cx - r - 6) // 100), int((cx + r + 6) // 100) + 1):
            for gy in range(int((cy - r - 6) // 100), int((cy + r + 6) // 100) + 1):
                for L in cell.get((gx, gy), ()): cand[id(L)] = L
        for L in cand.values():
            if id(L) in used: continue
            ax, ay = L['a']; bx, by = L['b']
            if abs(math.hypot(ax - cx, ay - cy) - r) < 5 and abs(math.hypot(bx - cx, by - cy) - r) < 5: mem.append(L)
        if len(mem) < 6: continue
        # refine with all member endpoints
        P = [L['a'] for L in mem] + [L['b'] for L in mem]
        f = vec.fit_circle(P)
        if not f: continue
        cx, cy, r = f[0], f[1], f[2]
        covered = sum(math.hypot(L['b'][0] - L['a'][0], L['b'][1] - L['a'][1]) for L in mem) / (2 * math.pi * r)
        if covered < 0.35: continue
        nd = sum(1 for d in dots if abs(math.hypot(d[0] - cx, d[1] - cy) - r) < 4)
        lt = 'DASHDOT' if nd >= 0.4 * len(mem) else 'HIDDEN'
        # angular extent (could be a dashed arc)
        angs = sorted(math.degrees(math.atan2(q[1] - cy, q[0] - cx)) % 360 for q in P)
        gaps = [(angs[(i + 1) % len(angs)] - angs[i]) % 360 for i in range(len(angs))]
        gi = int(np.argmax(gaps))
        for L in mem: used.add(id(L))
        w = float(np.median([L['w'] for L in mem]))
        if gaps[gi] > 40:
            found.append(dict(t='arc', c=(cx, cy), r=r, s=angs[(gi + 1) % len(angs)], e=angs[gi], w=w, lt=lt))
        else:
            found.append(dict(t='circle', c=(cx, cy), r=r, w=w, lt=lt))
    return found, [L for L in lines if id(L) not in used]

CAPS = re.compile(r'^[A-Z0-9.:\-+=/&]+$')
def dedupe(words):
    out = []
    ws = sorted(words, key=lambda w: -w['conf'])
    for w in ws:
        dup = False
        for q in out:
            if q['ang'] != w['ang']: continue
            ix = max(0, min(w['x'] + w['w'], q['x'] + q['w']) - max(w['x'], q['x'])); iy = max(0, min(w['y'] + w['h'], q['y'] + q['h']) - max(w['y'], q['y']))
            if ix * iy > 0.5 * w['w'] * w['h']: dup = True; break
        if not dup: out.append(w)
    return out

def group_lines(words):
    out = []
    for ang in (0, 90):
        ws = [w for w in words if w['ang'] == ang]
        th = lambda w: w['h'] if ang == 0 else w['w']
        base = lambda w: (w['y'] + w['h']) if ang == 0 else (w['x'] + w['w'])
        pos0 = lambda w: w['x'] if ang == 0 else -(w['y'] + w['h'])
        pos1 = lambda w: (w['x'] + w['w']) if ang == 0 else -w['y']
        ws.sort(key=base)
        rows = []
        for w in ws:
            if rows and abs(base(w) - np.median([base(q) for q in rows[-1]])) < 0.3 * th(w): rows[-1].append(w)
            else: rows.append([w])
        for r in rows:
            for w in [w for w in r if w.get('ring')]: out.append(dict(ang=ang, ws=[w]))
            r = [w for w in r if not w.get('ring')]
            if not r: continue
            r.sort(key=pos0)
            cur = [r[0]]
            for w in r[1:]:
                h = np.median([th(q) for q in cur])
                gap = pos0(w) - pos1(cur[-1])
                if -0.3 * h < gap < 1.7 * h and abs(th(w) - h) < 0.45 * h: cur.append(w)
                else: out.append(dict(ang=ang, ws=cur)); cur = [w]
            out.append(dict(ang=ang, ws=cur))
    return out

def text_ents(words):
    lines = group_lines(dedupe(words))
    out = []
    for L in lines:
        ws = sorted(L['ws'], key=lambda w: w['x'] if L['ang'] == 0 else -w['y'])
        clean = [w for w in ws if CAPS.match(w['s'])] or ws
        if L['ang'] == 0:
            hs = [w['h'] for w in clean]; base = float(np.median([w['y'] + w['h'] for w in clean]))
            x0 = ws[0]['x']; x1 = max(w['x'] + w['w'] for w in ws)
        else:
            hs = [w['w'] for w in clean]; base = float(np.median([w['x'] + w['w'] for w in clean]))
            x0 = ws[0]['y'] + ws[0]['h']; x1 = min(w['y'] for w in ws)
        h = float(np.median(hs))
        # cap height from the glyph components (more reliable than the OCR boxes)
        gc = [g for w in ws for g in w.get('gc', []) if g[0] > 0.45 * h and g[2] < 1.5 * g[0]]
        if len(gc) >= 2:
            hh = np.array([g[0] for g in gc], float)
            h = float(np.percentile(hh, 60))
            bot = [g[1] for g in gc if abs(g[0] - h) < 0.12 * h]
            if bot: base = float(np.median(bot))
        elif not any(CAPS.match(w['s']) for w in ws): h *= 0.86
        # rebuild the string with the gaps measured on the sheet (2 spaces where the gap is wide)
        s = ''
        for i, w in enumerate(ws):
            if i:
                prev = ws[i - 1]
                gap = (w['x'] - (prev['x'] + prev['w'])) if L['ang'] == 0 else ((prev['y']) - (w['y'] + w['h']))
                s += '  ' if gap > 1.25 * h else ' '
            s += w['s']
        span = abs(x1 - x0)
        nat = ftext.width(s) * h / 10.0
        wf = span / nat if nat > 0 else 1.0
        wf = min(1.35, max(0.7, wf))
        cf = min(w['conf'] for w in ws) if ws else 0
        p2 = any(w.get('p2') for w in ws)
        sw = [v for w in ws for v in w.get('sw', [])]
        sw = float(np.median(sw)) if sw else h / 8
        if L['ang'] == 0: out.append(dict(t='text', s=s, x=float(x0), y=base, h=h, wf=wf, ang=0, sw=sw, cf=cf, p2=p2))
        else: out.append(dict(t='text', s=s, x=base, y=float(x0), h=h, wf=wf, ang=90, sw=sw, cf=cf, p2=p2))
    return out

def stroke_width(ink, e):
    h = e['h']; L = ftext.width(e['s']) * h / 10 * e['wf']
    if e['ang'] == 0: x0, y0, x1, y1 = int(e['x']), int(e['y'] - h), int(e['x'] + L), int(e['y'])
    else: x0, y0, x1, y1 = int(e['x'] - h), int(e['y'] - L), int(e['x']), int(e['y'])
    sub = ink[max(0, y0):max(0, y1), max(0, x0):max(0, x1)]
    if sub.size < 20 or sub.sum() < 20: return None
    from skimage.morphology import skeletonize
    dt = cv2.distanceTransform(sub.astype(np.uint8), cv2.DIST_L2, 5)
    sk = skeletonize(sub)
    v = dt[sk]
    if not len(v): return None
    r = float(np.median(v.astype(np.float64))) * 2 - 0.6
    return r if math.isfinite(r) and 0 < r < e['h'] else None

import difflib, subprocess, tempfile, os
WL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:;-+=/()&%<>°"\'x@#*~ '
def line_box(e, pad_top=1.25, pad_bot=0.3):
    h = e['h']; L = ftext.width(e['s']) * h / 10 * e['wf']
    if e['ang'] == 0: return (int(e['x'] - 0.3 * h), int(e['y'] - pad_top * h), int(e['x'] + L + 0.9 * h), int(e['y'] + pad_bot * h))
    return (int(e['x'] - pad_top * h), int(e['y'] - L - 0.9 * h), int(e['x'] + pad_bot * h), int(e['y'] + 0.3 * h))

def reocr(ink, T, keep):
    """re-read every text line as a whole line (tesseract psm 6 on a stack of line crops): recovers punctuation and '&'."""
    crops = []
    for e in T:
        x0, y0, x1, y1 = line_box(e)
        x0, y0 = max(0, x0), max(0, y0)
        c = ink[y0:y1, x0:x1].copy()
        if c.size == 0: crops.append(None); continue
        # keep only pixels of components that are within the band (cut through long lines)
        if keep is not None: c &= keep[y0:y1, x0:x1]
        if e['ang'] == 90: c = np.rot90(c, -1)
        s = 48.0 / max(1, e['h'])
        c = cv2.resize(c.astype(np.uint8) * 255, (max(1, int(c.shape[1] * s)), max(1, int(c.shape[0] * s))), interpolation=cv2.INTER_AREA) > 100
        crops.append(c)
    Wd = max([c.shape[1] for c in crops if c is not None] + [10]) + 80
    rows, ys = [], []
    y = 40
    for c in crops:
        ys.append(y)
        if c is not None: y += c.shape[0] + 50
    canvas = np.zeros((y + 40, Wd), bool)
    for c, yy in zip(crops, ys):
        if c is not None: canvas[yy:yy + c.shape[0], 40:40 + c.shape[1]] = c
    fd, fn = tempfile.mkstemp(suffix='.png'); os.close(fd)
    cv2.imwrite(fn, np.where(canvas, 0, 255).astype(np.uint8))
    out = subprocess.run(['tesseract', fn, 'stdout', '--psm', '6', '--dpi', '300', '-c', 'preserve_interword_spaces=1', 'tsv'], capture_output=True, text=True).stdout
    os.remove(fn)
    words = []
    for ln in out.splitlines()[1:]:
        f = ln.split('\t')
        if len(f) < 12 or not f[11].strip(): continue
        words.append((int(f[7]) + int(f[9]) / 2, int(f[6]), float(f[10]), f[11]))
    res = []
    for c, yy in zip(crops, ys):
        if c is None: res.append(None); continue
        ws = sorted([w for w in words if yy - 5 <= w[0] <= yy + c.shape[0] + 5], key=lambda w: w[1])
        res.append((' '.join(w[3] for w in ws), min([w[2] for w in ws] or [0])))
    return res

def norm(s): return re.sub(r'[^A-Z0-9]', '', s.upper())
PUNCT_IN = set('.,&:;"\'/-“”')
def merge_punct(old, new):
    """take punctuation the whole-line reading found (inside or at the end) without changing any letter."""
    new = new.replace('“', '"').replace('”', '"')
    o = old.replace('“', '"').replace('”', '"')
    sm = difflib.SequenceMatcher(None, o, new, autojunk=False)
    out = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal': out.append(o[i1:i2]); continue
        if tag == 'insert':
            ins = new[j1:j2]
            core = ins.strip()
            if i1 == 0: continue                                    # nothing in front of the text
            if i1 == len(o):                                         # at the end: only a full stop / comma
                if core in ('.', ','): out.append(core)
                continue
            if core and all(c in PUNCT_IN for c in core) and len(core) <= 2: out.append(ins)
            elif ins.isspace(): out.append(ins)
            continue
        if tag == 'replace':
            seg_o, seg_n = o[i1:i2], new[j1:j2]
            # double space read as a symbol between words (e.g. '  ' -> ' & ')
            if seg_o.strip() == '' and seg_n.strip() and all(c in PUNCT_IN for c in seg_n.strip()) and 0 < i1 < len(o): out.append(seg_n); continue
            out.append(seg_o); continue
        if tag == 'delete': out.append(o[i1:i2])
    return ''.join(out)

def finalize(raw, ink=None):
    H, W = raw['H'], raw['W']
    lines = vec.merge_lines(raw['segs'], raw.get('dots', []))
    dc, lines = dashed_circles(lines, raw.get('dots', []), H, W)
    arcs, lines = merge_arcs(raw['arcs'], lines)
    ents = []
    for L in lines:
        e = dict(t='line', a=tuple(L['a']), b=tuple(L['b']), w=L['w'], lt=L.get('lt', 'CONTINUOUS'))
        if L.get('dl'):
            dl = sorted(L['dl']); e['dash'] = float(dl[len(dl) * 3 // 4]); e['gap'] = float(np.median(L['gp'])) if L.get('gp') else 0.0
        ents.append(e)
    ents += arcs + dc
    for p in raw['solids']: ents.append(dict(t='solid', p=p))
    # loose dots (not consumed as linetype dots): small filled squares
    pat = [e for e in ents if e.get('lt') in ('DASHDOT', 'CENTER')]
    def on_pattern(d):
        for e in pat:
            if e['t'] == 'line':
                ax, ay = e['a']; bx, by = e['b']; dx, dy = bx - ax, by - ay; L2 = dx * dx + dy * dy or 1
                t = max(0, min(1, ((d[0] - ax) * dx + (d[1] - ay) * dy) / L2))
                if math.hypot(ax + t * dx - d[0], ay + t * dy - d[1]) < 3.5: return True
            else:
                if abs(math.hypot(d[0] - e['c'][0], d[1] - e['c'][1]) - e['r']) < 4: return True
        return False
    for d in raw.get('dots', []):
        if not on_pattern(d): ents.append(dict(t='dot', c=d))
    T = text_ents(raw['words'])
    if T:
        hs = sorted(e['h'] for e in T); levels = []
        for h in hs:
            if levels and h - levels[-1][-1] < 0.07 * h: levels[-1].append(h)
            else: levels.append([h])
        for e in T:
            for L in levels:
                if L[0] - 1e-9 <= e['h'] <= L[-1] + 1e-9 and len(L) >= 3:
                    h2 = float(np.median(L)); e['wf'] = min(1.35, max(0.7, e['wf'] * e['h'] / h2)); e['h'] = h2; break
    if ink is not None and T:
        R = reocr(ink, T, None)
        for e, r in zip(T, R):
            if not r or not r[0].strip(): continue
            new = re.sub(r'\s+', ' ', r[0]).strip()
            old = e['s']
            m = merge_punct(old, new)
            if m and m != old: e['s0'] = old; e['s'] = m
        for e in T:
            sw = stroke_width(ink, e)
            if sw: e['sw'] = max(1.0, sw)
        # drop small vector pieces left inside a text line (punctuation and symbols now carried by the text)
        boxes = [line_box(e, 1.05, 0.12) for e in T]
        def inside_any(x0, y0, x1, y1, lim):
            for (bx0, by0, bx1, by1), e in zip(boxes, T):
                if x0 >= bx0 and y0 >= by0 and x1 <= bx1 and y1 <= by1 and max(x1 - x0, y1 - y0) < lim * e['h']: return True
            return False
        keep = []
        for e in ents:
            t = e['t']
            if t == 'line': bb = (min(e['a'][0], e['b'][0]), min(e['a'][1], e['b'][1]), max(e['a'][0], e['b'][0]), max(e['a'][1], e['b'][1])); lim = 0.9
            elif t == 'dot': bb = (e['c'][0] - 2, e['c'][1] - 2, e['c'][0] + 2, e['c'][1] + 2); lim = 0.9
            elif t == 'solid': xs = [p[0] for p in e['p']]; ys = [p[1] for p in e['p']]; bb = (min(xs), min(ys), max(xs), max(ys)); lim = 0.6
            elif t == 'arc': bb = (e['c'][0] - e['r'], e['c'][1] - e['r'], e['c'][0] + e['r'], e['c'][1] + e['r']); lim = 0.9
            else: keep.append(e); continue
            if not inside_any(*bb, lim): keep.append(e)
        ents = keep
    ents += T
    return dict(H=H, W=W, k=raw.get('k', 1.0), ents=ents)

# ------------------------------------------------------------------ raster render (for checking)
def render(F, scale=1.0, img=None, col=(0, 0, 0)):
    H, W = F['H'], F['W']
    if img is None: img = np.full((int(H * scale), int(W * scale), 3), 255, np.uint8)
    S = lambda p: (int(round(p[0] * scale)), int(round(p[1] * scale)))
    for e in F['ents']:
        t = e['t']
        if t == 'line':
            cv2.line(img, S(e['a']), S(e['b']), col, max(1, int(round(e['w'] * scale))), cv2.LINE_AA)
        elif t == 'circle':
            cv2.circle(img, S(e['c']), int(round(e['r'] * scale)), col, max(1, int(round(e['w'] * scale))), cv2.LINE_AA)
        elif t == 'arc':
            s, en = e['s'], e['e']; sw = (en - s) % 360
            n = max(6, int(sw / 4))
            pts = [S((e['c'][0] + e['r'] * math.cos(math.radians(s + sw * i / n)), e['c'][1] + e['r'] * math.sin(math.radians(s + sw * i / n)))) for i in range(n + 1)]
            cv2.polylines(img, [np.int32(pts)], False, col, max(1, int(round(e['w'] * scale))), cv2.LINE_AA)
        elif t == 'solid':
            cv2.fillPoly(img, [np.int32([S(p) for p in e['p']])], col, cv2.LINE_AA)
        elif t == 'dot':
            cv2.circle(img, S(e['c']), max(1, int(3 * scale)), col, -1)
        elif t == 'text':
            ftext.draw(img, e['s'], e['x'] * scale, e['y'] * scale, e['h'] * scale, e['wf'], e['ang'], col, max(1, int(round(e.get('sw', e['h'] / 8) * scale))))
    return img
