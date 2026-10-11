"""Scan -> CAD vector extraction for the timber standard drawings.
   page png (1-bit, 400 dpi)  ->  JSON entities in original paper mm (y up):
     line {t,a,b,lw,lt}, arc {t,c,r,a0,a1,lw,lt}, circle, pl, solid {t,p}, text {t,p,s,h,ang,wf}
   Usage: python3 vec.py <page.png> <out.json> [k]   (k = original paper size / scan size, e.g. 2 for A1 printed on A3)
"""
import sys, json, math, subprocess, os, tempfile
import numpy as np, cv2
from PIL import Image
from skimage.morphology import skeletonize
Image.MAX_IMAGE_PIXELS = None
DPI = 400.0

def load(path):
    a = np.array(Image.open(path).convert('L'))
    return a < 128

# ------------------------------------------------------------------ OCR
def ocr_words(img_bool, rot=0):
    """tesseract sparse text; returns words (x,y,w,h,conf,text) in the coordinates of img_bool."""
    im = img_bool
    if rot == 90: im = np.rot90(img_bool, 1)  # counter-clockwise: vertical text reading bottom->top becomes horizontal
    fd, fn = tempfile.mkstemp(suffix='.png'); os.close(fd)
    Image.fromarray(np.where(im, 0, 255).astype(np.uint8)).save(fn)
    out = subprocess.run(['tesseract', fn, 'stdout', '--psm', '11', '--dpi', '400', '-c', 'preserve_interword_spaces=1', 'tsv'], capture_output=True, text=True).stdout
    os.remove(fn)
    W = []
    H0, W0 = img_bool.shape
    for ln in out.splitlines()[1:]:
        f = ln.split('\t')
        if len(f) < 12 or not f[11].strip(): continue
        x, y, w, h, conf, t = int(f[6]), int(f[7]), int(f[8]), int(f[9]), float(f[10]), f[11].strip()
        if rot == 90:  # map back: rotated image (W0 x H0); point (xr, yr) -> original (W0-1-yr? ) for rot90 ccw: orig x = W0-1-yr... compute bbox
            # np.rot90(a,1): new[i,j] = a[j, W0-1-i]  => original col = W0-1-i (i = row in rotated = y), original row = j (= x in rotated)
            ox0, ox1 = W0 - 1 - (y + h), W0 - 1 - y
            oy0, oy1 = x, x + w
            W.append(dict(x=ox0, y=oy0, w=ox1 - ox0, h=oy1 - oy0, conf=conf, s=t, ang=90))
        else:
            W.append(dict(x=x, y=y, w=w, h=h, conf=conf, s=t, ang=0))
    return W

import re
LOWER_OK = re.compile(r'^(?:[0-9A-Z.,:;()/%+\-=&°"\'<>@#*xX~]*|.*\d+x\d+.*|.*mm.*|.*kN.*|N[o°].*|Ø.*|.*x.*)$')
def good_word(w, strict=True):
    s = w['s'].strip('_|')
    w['s'] = s
    if not s: return False
    if any(c.islower() for c in s) and not LOWER_OK.match(s): return False
    lim = 55 if not strict else 55
    if w['conf'] < (40 if not strict else 55): return False
    if not any(ch.isalnum() for ch in s): return False
    th = w['h'] if w['ang'] == 0 else w['w']
    if th < 14 or th > 140: return False
    if strict and len(s) <= 2 and not s.isdigit() and w['conf'] < 85: return False
    if w['ang'] == 90 and w['conf'] < 75: return False
    return True

# ------------------------------------------------------------------ helpers
def components(mask):
    n, lab, st, cen = cv2.connectedComponentsWithStats(mask.astype(np.uint8), connectivity=8)
    return n, lab, st

def remove_long_lines(ink, L=60):
    """mask of long straight horizontal/vertical runs (to help OCR)."""
    u = ink.astype(np.uint8)
    h = cv2.morphologyEx(u, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (L, 1)))
    v = cv2.morphologyEx(u, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, L)))
    return (h | v).astype(bool)

def ring_mask(ink):
    """closed circle-like rings (section / detail markers, bolt circles) so OCR does not read them as '(A)'."""
    n, lab, st = components(ink)
    out = np.zeros_like(ink)
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if 30 <= w <= 260 and 30 <= h <= 260 and abs(w - h) < 0.15 * max(w, h):
            sub = (lab[y:y + h, x:x + w] == i)
            # ring: the centre is empty and the ink area is small relative to the disc
            if a < 0.62 * w * h:
                cnts, _ = cv2.findContours(sub.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
                if not cnts: continue
                c = max(cnts, key=cv2.contourArea)
                ar = cv2.contourArea(c); pe = cv2.arcLength(c, True)
                circ = 4 * math.pi * ar / (pe * pe + 1e-9)
                if circ > 0.8:
                    (cx, cy), r = cv2.minEnclosingCircle(c)
                    yy, xx = np.mgrid[0:h, 0:w]
                    d = np.hypot(xx + 0.5 - cx, yy + 0.5 - cy)
                    # ring thickness from the ink on the outer band
                    band = sub & (d > r * 0.6)
                    thk = band.sum() / max(1.0, 2 * math.pi * r)
                    out[y:y + h, x:x + w] |= sub & (d > r - max(3.0, 1.6 * thk))
    return out

# ------------------------------------------------------------------ text
def text_lines(words):
    """group words into lines (same orientation, aligned, small gaps)."""
    ws = sorted([w for w in words], key=lambda w: (w['ang'], w['y'] if w['ang'] == 0 else -w['x'], w['x'] if w['ang'] == 0 else -w['y']))
    lines = []
    for w in ws:
        th = w['h'] if w['ang'] == 0 else w['w']
        placed = False
        for L in lines:
            if L['ang'] != w['ang']: continue
            lh = L['th']
            if w['ang'] == 0:
                same = abs((w['y'] + w['h']) - L['base']) < 0.35 * lh and abs(th - lh) < 0.5 * lh
                gap = w['x'] - L['x1']
            else:
                same = abs(w['x'] + w['w'] - L['base']) < 0.35 * lh and abs(th - lh) < 0.5 * lh
                gap = L['y0'] - (w['y'] + w['h'])
            if same and -0.3 * lh < gap < 1.6 * lh:
                L['ws'].append(w)
                if w['ang'] == 0: L['x1'] = max(L['x1'], w['x'] + w['w'])
                else: L['y0'] = min(L['y0'], w['y'])
                placed = True; break
        if not placed:
            lines.append(dict(ang=w['ang'], th=th, ws=[w], base=(w['y'] + w['h']) if w['ang'] == 0 else (w['x'] + w['w']), x1=w['x'] + w['w'], y0=w['y']))
    return lines

# ------------------------------------------------------------------ skeleton graph
NB = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
def trace_skeleton(sk):
    """return list of pixel paths [(r,c),...] between nodes (endpoints / junctions) and closed loops."""
    H, W = sk.shape
    p = np.pad(sk, 1).astype(np.uint8)
    cnt = sum(np.roll(np.roll(p, dr, 0), dc, 1) for dr, dc in NB)[1:-1, 1:-1] * sk
    node = sk & (cnt != 2)
    visited_edges = set()
    paths = []
    ys, xs = np.nonzero(sk)
    skset = sk
    def nbrs(r, c):
        out = []
        for dr, dc in NB:
            rr, cc = r + dr, c + dc
            if 0 <= rr < H and 0 <= cc < W and skset[rr, cc]: out.append((rr, cc))
        return out
    used = np.zeros_like(sk)
    nr, nc = np.nonzero(node)
    for r, c in zip(nr, nc):
        for q in nbrs(r, c):
            key = (min((r, c), q), max((r, c), q))
            if key in visited_edges: continue
            path = [(r, c), q]; visited_edges.add(key)
            prev, cur = (r, c), q
            while not node[cur]:
                used[cur] = 1
                nx = [n for n in nbrs(*cur) if n != prev and not (len(path) > 2 and n == path[-3])]
                # prefer 4-neighbours that are not yet on path
                nx = [n for n in nx if (min(cur, n), max(cur, n)) not in visited_edges]
                if not nx: break
                nxt = nx[0]
                visited_edges.add((min(cur, nxt), max(cur, nxt)))
                path.append(nxt); prev, cur = cur, nxt
            paths.append(path)
    # loops with no nodes
    rest = sk & ~node & ~used.astype(bool)
    rest[nr, nc] = False
    rr, cc = np.nonzero(rest)
    seen = np.zeros_like(sk)
    for r, c in zip(rr, cc):
        if seen[r, c] or used[r, c]: continue
        path = [(r, c)]; seen[r, c] = 1; prev = None; cur = (r, c)
        while True:
            nx = [n for n in nbrs(*cur) if n != prev and not seen[n] and not node[n]]
            if not nx: break
            prev, cur = cur, nx[0]; seen[cur] = 1; path.append(cur)
        if len(path) > 4: paths.append(path + [path[0]])
    return paths

def rdp(pts, eps):
    if len(pts) < 3: return pts
    a, b = np.array(pts[0], float), np.array(pts[-1], float)
    d = b - a; L = math.hypot(*d)
    P = np.array(pts, float)
    if L < 1e-9: dist = np.hypot(*(P - a).T)
    else: dist = np.abs(d[0] * (P[:, 1] - a[1]) - d[1] * (P[:, 0] - a[0])) / L
    i = int(np.argmax(dist))
    if dist[i] > eps:
        return rdp(pts[:i + 1], eps)[:-1] + rdp(pts[i:], eps)
    return [pts[0], pts[-1]]

def fit_circle(P):
    P = np.asarray(P, float); x, y = P[:, 0], P[:, 1]
    A = np.c_[2 * x, 2 * y, np.ones(len(P))]; b = x * x + y * y
    try: (cx, cy, c), *_ = np.linalg.lstsq(A, b, rcond=None)
    except Exception: return None
    r = math.sqrt(max(c + cx * cx + cy * cy, 0))
    res = np.abs(np.hypot(x - cx, y - cy) - r)
    return cx, cy, r, float(res.max()), float(res.mean())

def second_pass(lines_ink, words):
    n, lab, st = components(lines_ink)
    groups = []
    for ang in (0, 90):
        cs = []
        for i in range(1, n):
            x, y, w, h, a = st[i]
            L, Wd = (h, w) if ang == 0 else (w, h)
            if 12 <= L <= 70 and Wd <= 1.6 * L and a >= 12: cs.append((i, x, y, w, h))
        if ang == 0: cs.sort(key=lambda c: (c[2] + c[4], c[1]))
        else: cs.sort(key=lambda c: (c[1] + c[3], -c[2]))
        rows = []
        for c in cs:
            i, x, y, w, h = c
            base, L = ((y + h), h) if ang == 0 else ((x + w), w)
            placed = False
            for r in rows[-40:]:
                rb, rl = r['base'], r['L']
                if abs(base - rb) < 0.35 * rl and 0.55 < L / rl < 1.6:
                    last = r['m'][-1]
                    gap = (x - (last[1] + last[3])) if ang == 0 else (last[2] - (y + h))
                    if -0.2 * rl < gap < 1.0 * rl: r['m'].append(c); placed = True; break
            if not placed: rows.append(dict(base=base, L=L, m=[c]))
        for r in rows:
            if len(r['m']) >= 2: groups.append((ang, r))
    if not groups: return
    crops = []
    for ang, r in groups:
        ids = [c[0] for c in r['m']]
        x0 = min(c[1] for c in r['m']); y0 = min(c[2] for c in r['m']); x1 = max(c[1] + c[3] for c in r['m']); y1 = max(c[2] + c[4] for c in r['m'])
        sub = np.isin(lab[y0:y1, x0:x1], ids)
        if ang == 90: sub = np.rot90(sub, 1)
        sc = 48.0 / r['L']
        sub = cv2.resize(sub.astype(np.uint8) * 255, (max(1, int(sub.shape[1] * sc)), max(1, int(sub.shape[0] * sc))), interpolation=cv2.INTER_AREA) > 100
        crops.append((sub, (x0, y0, x1, y1), ids, ang, r))
    Wd = max(c[0].shape[1] for c in crops) + 80
    ys, y = [], 40
    for c in crops: ys.append(y); y += c[0].shape[0] + 50
    canvas = np.zeros((y + 40, Wd), bool)
    for c, yy in zip(crops, ys): canvas[yy:yy + c[0].shape[0], 40:40 + c[0].shape[1]] = c[0]
    fd, fn = tempfile.mkstemp(suffix='.png'); os.close(fd)
    cv2.imwrite(fn, np.where(canvas, 0, 255).astype(np.uint8))
    out = subprocess.run(['tesseract', fn, 'stdout', '--psm', '6', '--dpi', '300', 'tsv'], capture_output=True, text=True).stdout
    os.remove(fn)
    tw = []
    for ln in out.splitlines()[1:]:
        f = ln.split('\t')
        if len(f) < 12 or not f[11].strip(): continue
        tw.append((int(f[7]) + int(f[9]) / 2, float(f[10]), f[11]))
    added = 0
    for (sub, (x0, y0, x1, y1), ids, ang, r), yy in zip(crops, ys):
        ws = [t for t in tw if yy - 5 <= t[0] <= yy + sub.shape[0] + 5]
        if not ws: continue
        txt = ' '.join(t[2] for t in ws).strip('_|')
        conf = min(t[1] for t in ws)
        alnum = sum(ch.isalnum() for ch in txt)
        if conf < 60 or alnum < 2 or any(ch.islower() for ch in txt.replace('x', '').replace('mm', '')): continue
        if alnum < 0.6 * len(txt.replace(' ', '')): continue
        w = dict(x=int(x0), y=int(y0), w=int(x1 - x0), h=int(y1 - y0), conf=conf, s=txt, ang=ang, p2=True)
        w['gc'] = [((c[4], c[2] + c[4], c[3]) if ang == 0 else (c[3], c[1] + c[3], c[4])) for c in r['m']]
        words.append(w)
        lines_ink[y0:y1, x0:x1] &= ~np.isin(lab[y0:y1, x0:x1], ids)
        added += 1
    print('second pass: %d groups, %d read' % (len(crops), added), flush=True)

# ------------------------------------------------------------------ main extraction
def extract(path, k=1.0, region=None):
    ink = load(path)
    H, W = ink.shape
    if region:
        x0, y0, x1, y1 = region
        mask = np.zeros_like(ink); mask[y0:y1, x0:x1] = True; ink = ink & mask
    # ---- OCR on a cleaned copy (no long lines, no rings)
    rings = ring_mask(ink)
    longl = remove_long_lines(ink, 90)
    clean = ink & ~rings & ~longl
    raw0 = ocr_words(clean, 0)
    strong = [w for w in raw0 if good_word(dict(w))]
    def near_strong(w):
        for q in strong:
            if q is w: continue
            if abs((q['y'] + q['h']) - (w['y'] + w['h'])) < 0.4 * q['h'] and -0.5 * q['h'] < min(abs(w['x'] - (q['x'] + q['w'])), abs(q['x'] - (w['x'] + w['w']))) < 2.0 * q['h']:
                return True
        return False
    words = [w for w in raw0 if good_word(w) or (near_strong(w) and good_word(w, strict=False))]
    wv = [w for w in ocr_words(clean, 90) if good_word(w)]
    # keep vertical words only where no horizontal word overlaps (and vertical box is tall)
    def ov(a, b):
        return not (a['x'] + a['w'] < b['x'] or b['x'] + b['w'] < a['x'] or a['y'] + a['h'] < b['y'] or b['y'] + b['h'] < a['y'])
    wv = [v for v in wv if v['h'] >= v['w'] * 0.9 or len(v['s']) <= 2]
    wv = [v for v in wv if not any(ov(v, h) and h['conf'] >= v['conf'] - 5 for h in words)]
    words = [h for h in words if not any(ov(v, h) and v['conf'] > h['conf'] + 5 for v in wv)] + wv
    # ---- remove glyph components of recognised words from the ink
    n, lab, st = components(ink & ~rings)
    glyph = np.zeros(n, bool)
    for w in words:
        th = w['h'] if w['ang'] == 0 else w['w']
        pad = max(3, int(0.12 * th))
        x0, y0, x1, y1 = w['x'] - pad, w['y'] - pad, w['x'] + w['w'] + pad, w['y'] + w['h'] + pad
        ids = np.unique(lab[max(0, w['y']):w['y'] + w['h'], max(0, w['x']):w['x'] + w['w']])
        for i in ids:
            if i == 0: continue
            cx, cy, cw, ch, ca = st[i]
            if not (cx >= x0 and cy >= y0 and cx + cw <= x1 and cy + ch <= y1): continue
            lw_, lh_ = (cw, ch) if w['ang'] == 0 else (ch, cw)
            if lw_ > 1.3 * th and lh_ < 0.3 * th: continue      # underline / leader
            glyph[i] = True
            sub_ = (lab[cy:cy + ch, cx:cx + cw] == i).astype(np.uint8)
            cs_, _ = cv2.findContours(sub_, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
            per_ = sum(cv2.arcLength(c_, True) for c_ in cs_)
            if per_ > 0: w.setdefault('sw', []).append(2.0 * ca / per_)
            if w['ang'] == 0: w.setdefault('gc', []).append((int(ch), int(cy + ch), int(cw)))
            else: w.setdefault('gc', []).append((int(cw), int(cx + cw), int(ch)))
    textpix = glyph[lab]
    lines_ink = ink & ~textpix
    # ---- letters inside ring markers (section / detail callouts)
    nR, labR, stR = components(rings)
    for i in range(1, nR):
        x, y, w_, h_, a = stR[i]
        inner = ink[y + int(0.18 * h_):y + int(0.82 * h_), x + int(0.18 * w_):x + int(0.82 * w_)] & ~rings[y + int(0.18 * h_):y + int(0.82 * h_), x + int(0.18 * w_):x + int(0.82 * w_)]
        if inner.sum() < 30: continue
        ys_, xs_ = np.nonzero(inner)
        gx0, gy0 = x + int(0.18 * w_) + xs_.min(), y + int(0.18 * h_) + ys_.min()
        gx1, gy1 = x + int(0.18 * w_) + xs_.max() + 1, y + int(0.18 * h_) + ys_.max() + 1
        crop = ink[gy0 - 6:gy1 + 6, gx0 - 6:gx1 + 6] & ~rings[gy0 - 6:gy1 + 6, gx0 - 6:gx1 + 6]
        big = np.pad(crop, 30)
        fd, fn = tempfile.mkstemp(suffix='.png'); os.close(fd)
        Image.fromarray(np.where(big, 0, 255).astype(np.uint8)).save(fn)
        t = subprocess.run(['tesseract', fn, 'stdout', '--psm', '10', '--dpi', '400', '-c', 'tessedit_char_whitelist=ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'], capture_output=True, text=True).stdout.strip()
        os.remove(fn)
        if t and len(t) <= 2:
            words.append(dict(x=int(gx0), y=int(gy0), w=int(gx1 - gx0), h=int(gy1 - gy0), conf=90.0, s=t, ang=0, ring=True))
            lines_ink[gy0 - 2:gy1 + 2, gx0 - 2:gx1 + 2] &= rings[gy0 - 2:gy1 + 2, gx0 - 2:gx1 + 2]
    # ---- second OCR pass on letter-like leftovers (small or crowded text the sparse pass missed)
    try: second_pass(lines_ink, words)
    except Exception as ex: print('second pass failed', ex)
    # ---- dots (dash-dot linetypes, small marks)
    n3, lab3, st3 = components(lines_ink)
    dots = []
    for i in range(1, n3):
        x, y, w_, h_, a = st3[i]
        if max(w_, h_) <= 10 and a >= 4 and a >= 0.4 * w_ * h_ and max(w_, h_) <= 2.2 * min(w_, h_):
            dots.append((x + w_ / 2.0, y + h_ / 2.0))
            lines_ink[y:y + h_, x:x + w_] &= ~(lab3[y:y + h_, x:x + w_] == i)
    # ---- arrowheads and small filled marks: blobs that survive an opening which removes thin lines
    small_solids = []
    op = cv2.morphologyEx(lines_ink.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (6, 6)))
    n4, lab4, st4 = components(op.astype(bool))
    for i in range(1, n4):
        x, y, w_, h_, a = st4[i]
        if a < 30 or max(w_, h_) > 70: continue
        if max(w_, h_) > 5.5 * max(1, min(w_, h_)): continue            # a thick line, not a blob
        blob = (lab4[y:y + h_, x:x + w_] == i).astype(np.uint8)
        x0, y0 = max(0, x - 3), max(0, y - 3)
        g = np.zeros((h_ + 6, w_ + 6), np.uint8); g[y - y0:y - y0 + h_, x - x0:x - x0 + w_] = blob
        g = cv2.dilate(g, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))) & lines_ink[y0:y0 + h_ + 6, x0:x0 + w_ + 6].astype(np.uint8)
        cnts, _ = cv2.findContours(g, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for c in cnts:
            c = cv2.approxPolyDP(c, 1.0, True)
            if len(c) >= 3: small_solids.append([(int(p[0][0]) + x0, int(p[0][1]) + y0) for p in c])
        lines_ink[y0:y0 + h_ + 6, x0:x0 + w_ + 6] &= ~g.astype(bool)
    # ---- solids (arrowheads, filled shapes): thick cores grown back
    dt = cv2.distanceTransform(lines_ink.astype(np.uint8), cv2.DIST_L2, 5)
    widths = []
    thick = dt >= 5.5
    solids = small_solids
    if thick.any():
        grown = cv2.dilate(thick.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))).astype(bool) & lines_ink
        n2, lab2, st2 = components(grown)
        for i in range(1, n2):
            x, y, w, h, a = st2[i]
            if a < 60: continue
            sub = (lab2[y:y + h, x:x + w] == i).astype(np.uint8)
            cnts, _ = cv2.findContours(sub, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for c in cnts:
                c = cv2.approxPolyDP(c, 1.2, True)
                if len(c) >= 3: solids.append([(int(p[0][0]) + x, int(p[0][1]) + y) for p in c])
            lines_ink[y:y + h, x:x + w] &= ~sub.astype(bool)
    # ---- skeleton -> paths
    sk = skeletonize(lines_ink)
    paths = trace_skeleton(sk)
    dt2 = cv2.distanceTransform(lines_ink.astype(np.uint8), cv2.DIST_L2, 5)
    segs, arcs = [], []
    for pth in paths:
        if len(pth) < 2: continue
        P = [(c, r) for r, c in pth]
        wv_ = [dt2[r, c] for r, c in pth]
        wd = float(np.median(wv_)) * 2
        length = sum(math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]) for i in range(len(P) - 1))
        if length < 2.5: continue
        V = rdp(P, 1.3)
        closed = P[0] == P[-1] and len(P) > 8
        turns = []
        for q in range(1, len(V) - 1):
            v1 = (V[q][0] - V[q - 1][0], V[q][1] - V[q - 1][1]); v2 = (V[q + 1][0] - V[q][0], V[q + 1][1] - V[q][1])
            turns.append(math.atan2(v1[0] * v2[1] - v1[1] * v2[0], v1[0] * v2[0] + v1[1] * v2[1]))
        curvy = len(V) >= 5 and turns and (all(t > 0 for t in turns) or all(t < 0 for t in turns)) and max(abs(t) for t in turns) < math.radians(50)
        if curvy or (closed and len(P) > 20):
            f = fit_circle(P)
            if f and f[3] < max(1.8, 0.012 * f[2]) and f[2] > 4 and f[2] < 3000 and (closed or abs(sum(turns)) > math.radians(20)):
                cx, cy, r = f[0], f[1], f[2]
                a0 = math.degrees(math.atan2(P[0][1] - cy, P[0][0] - cx)); a1 = math.degrees(math.atan2(P[-1][1] - cy, P[-1][0] - cx))
                # sweep direction via middle point
                am = math.degrees(math.atan2(P[len(P) // 2][1] - cy, P[len(P) // 2][0] - cx))
                arcs.append(dict(c=(cx, cy), r=r, a0=a0, a1=a1, am=am, closed=closed, w=wd, n=len(P)))
                continue
        for i in range(len(V) - 1):
            segs.append(dict(a=V[i], b=V[i + 1], w=wd))
    return dict(H=H, W=W, k=k, words=words, segs=segs, arcs=arcs, solids=solids, dots=dots)

# ------------------------------------------------------------------ line merging & linetypes
def seg_ang(s):
    return math.atan2(s['b'][1] - s['a'][1], s['b'][0] - s['a'][0])

def merge_lines(segs, dots=()):
    """join collinear touching pieces, then chain collinear dashes into dashed lines with a linetype."""
    out = []
    # canonical direction
    for s in segs:
        a, b = s['a'], s['b']
        if (b[0], b[1]) < (a[0], a[1]): a, b = b, a
        out.append(dict(a=a, b=b, w=s['w']))
    def key(s):
        ang = math.atan2(s['b'][1] - s['a'][1], s['b'][0] - s['a'][0]) % math.pi
        nx, ny = -math.sin(ang), math.cos(ang)
        off = s['a'][0] * nx + s['a'][1] * ny
        return ang, off
    groups = {}
    items = []
    for s in out:
        L = math.hypot(s['b'][0] - s['a'][0], s['b'][1] - s['a'][1])
        ang, off = key(s); items.append((ang, off, s, L))
    clusters = []
    grid = {}
    items.sort(key=lambda t: -t[3])
    for ang, off, s_, L in items:
        if ang > math.pi - 0.06:
            ang -= math.pi; off = -off
        ka, ko = int(round(ang / 0.035)), int(round(off / 3.0))
        tol_a = math.radians(1.5 if L > 30 else 4)
        found = None
        for da in (-2, -1, 0, 1, 2):
            for do in (-1, 0, 1):
                for C in grid.get((ka + da, ko + do), ()):
                    if abs(ang - C['ang']) < tol_a:
                        cx_, cy_, cux, cuy = C['ref']
                        d1 = abs((s_['a'][0] - cx_) * (-cuy) + (s_['a'][1] - cy_) * cux); d2 = abs((s_['b'][0] - cx_) * (-cuy) + (s_['b'][1] - cy_) * cux)
                        if d1 < 2.2 and d2 < 2.2: found = C; break
                if found: break
            if found: break
        if found: found['m'].append(s_)
        else:
            C = dict(ang=ang, off=off, m=[s_], ref=((s_['a'][0] + s_['b'][0]) / 2, (s_['a'][1] + s_['b'][1]) / 2, math.cos(ang), math.sin(ang))); clusters.append(C); grid.setdefault((ka, ko), []).append(C)
    for d in dots:
        for C in clusters:
            if len(C['m']) < 2: continue
            nx_, ny_ = -math.sin(C['ang']), math.cos(C['ang'])
            if abs(d[0] * nx_ + d[1] * ny_ - C['off']) < 3.0: C.setdefault('dots', []).append(d)
    res = []
    for C in clusters:
        ang = C['ang']; ux, uy = math.cos(ang), math.sin(ang)
        ms = []
        for s in C['m']:
            t0 = s['a'][0] * ux + s['a'][1] * uy; t1 = s['b'][0] * ux + s['b'][1] * uy
            if t1 < t0: t0, t1 = t1, t0
            ms.append([t0, t1, s])
        ms.sort(key=lambda m: m[0])
        nx, ny = -uy, ux
        off = np.mean([m[2]['a'][0] * nx + m[2]['a'][1] * ny for m in ms])
        # 1) join overlapping / touching
        runs = []
        for t0, t1, s in ms:
            if runs and t0 <= runs[-1][1] + 3.0:
                runs[-1][1] = max(runs[-1][1], t1); runs[-1][2].append(s['w']); runs[-1][3] += t1 - t0
            else: runs.append([t0, t1, [s['w']], t1 - t0])
        # dots lying on this line
        dts = sorted(d[0] * ux + d[1] * uy for d in C.get('dots', []))
        def dot_in(g0, g1):
            import bisect
            q = bisect.bisect_right(dts, g0)
            return q < len(dts) and dts[q] < g1
        # 2) chain dashes: short runs separated by small gaps (a gap holding a dot may be longer)
        i = 0
        while i < len(runs):
            j = i
            while j + 1 < len(runs) and (runs[j][1] - runs[j][0]) < 260 and (runs[j + 1][1] - runs[j + 1][0]) < 260:
                g = runs[j + 1][0] - runs[j][1]
                if 2 < g < 45 or (g < 75 and dot_in(runs[j][1], runs[j + 1][0])): j += 1
                else: break
            chain = runs[i:j + 1]
            wmed = float(np.median([w for r in chain for w in r[2]]))
            P = lambda t: (t * ux + off * nx, t * uy + off * ny)
            if len(chain) >= 3:
                dl = [r[1] - r[0] for r in chain]; gp = [chain[q + 1][0] - chain[q][1] for q in range(len(chain) - 1)]
                nd = sum(1 for q in range(len(chain) - 1) if dot_in(chain[q][1], chain[q + 1][0]))
                lt = ('DASHDOT' if np.median(dl) < 160 else 'CENTER') if nd >= 0.5 * len(gp) else classify_dash(dl, gp, wmed)
                res.append(dict(a=P(chain[0][0]), b=P(chain[-1][1]), w=wmed, lt=lt, dl=dl, gp=gp))
            else:
                for r in chain: res.append(dict(a=P(r[0]), b=P(r[1]), w=float(np.median(r[2])), lt='CONTINUOUS'))
            i = j + 1
    return res

def classify_dash(dl, gp, w):
    dl = np.array(dl[1:-1] if len(dl) > 4 else dl, float)
    if len(dl) == 0: return 'DASHED'
    short = dl < max(8, 2.6 * w)
    if short.any() and (~short).any() and 0.25 < short.mean() < 0.6:
        longs = dl[~short]
        # two dots between longs = phantom; one = center/dashdot
        return 'DASHDOT' if np.median(longs) < 160 else 'CENTER'
    return 'HIDDEN' if np.median(dl) < 70 else 'DASHED'

if __name__ == '__main__':
    import time
    t = time.time()
    r = extract(sys.argv[1], float(sys.argv[3]) if len(sys.argv) > 3 else 1.0)
    print('extract', time.time() - t, len(r['words']), len(r['segs']), len(r['arcs']), len(r['solids']))
    t = time.time(); L = merge_lines(r['segs'], r['dots']); print('merge', time.time() - t, len(L))
    r['lines'] = L
    json.dump(r, open(sys.argv[2], 'w'), default=float)
