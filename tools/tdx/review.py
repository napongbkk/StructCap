"""Per-sheet review workflow for the extracted standard details.

  python3 review.py init  <page>        overview with a % grid + suggested detail boxes  -> review/<page>/overview.png, spec.json
  python3 review.py show  <page> [n]    each detail: source | vector (text ids in blue)  -> review/<page>/d<n>.png
  python3 review.py proof <page>        every text: source crop beside the recognised string -> review/<page>/t<k>.png
  python3 review.py export <page>       -> lib/<sheet>.json (paper mm, y up, each detail at its own origin)

spec.json (edit this):
  { "sheet": "PN30-2303", "title": "PIER HALFCAPS STRENGTHENING DETAIL", "cat": "Halfcaps",
    "details": [ {"name": "SECTION A", "rects": [[x0,y0,x1,y1], ...]}, ... ],      # rects in % of the page (0-100)
    "exclude": [[x0,y0,x1,y1], ...],                                                # dropped everywhere
    "text": {"<id>": "corrected string" | ""},                                      # "" deletes the text
    "add": [{"s": "TEXT", "like": <id>, "dx": 0, "dy": 1.5}],                       # new text placed relative to text <id> (dx, dy in cap heights; dy>0 = lower)
    "drop": [<entity id>, ...] }
"""
import sys, os, json, math, re, numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
Image.MAX_IMAGE_PIXELS = None
import build, ftext, vec

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FONTB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

def load(page):
    F = json.load(open(os.path.join(HERE, 'out', page + '.json'))); F['page'] = page
    spec_p = os.path.join(HERE, 'review', page, 'spec.json')
    spec = json.load(open(spec_p)) if os.path.exists(spec_p) else None
    return F, spec

def ent_center(e):
    t = e['t']
    if t == 'line': return ((e['a'][0] + e['b'][0]) / 2, (e['a'][1] + e['b'][1]) / 2)
    if t in ('circle', 'dot'): return tuple(e['c'])
    if t == 'arc':   # middle of the arc (a leader arc can have its centre far away)
        sw = (e['e'] - e['s']) % 360; a = math.radians(e['s'] + sw / 2)
        return (e['c'][0] + e['r'] * math.cos(a), e['c'][1] + e['r'] * math.sin(a))
    if t == 'solid': return (sum(p[0] for p in e['p']) / len(e['p']), sum(p[1] for p in e['p']) / len(e['p']))
    if t == 'text':
        L = ftext.width(e['s']) * e['h'] / 10 * e['wf']
        return (e['x'] + L / 2, e['y'] - e['h'] / 2) if e['ang'] == 0 else (e['x'] - e['h'] / 2, e['y'] - L / 2)
    return None

_SRC = {}
SHOW_ALL = False
def trace_box(page_png, box):
    """vectorise the ink inside box (x0,y0,x1,y1 px) as plain lines (for 'text' that is really drawing)."""
    if page_png not in _SRC: _SRC[page_png] = vec.load(page_png)
    ink = _SRC[page_png]
    x0, y0, x1, y1 = [int(v) for v in box]
    sub = np.zeros_like(ink[y0:y1, x0:x1]); sub[:] = ink[y0:y1, x0:x1]
    from skimage.morphology import skeletonize
    sk = skeletonize(sub)
    dt = cv2.distanceTransform(sub.astype(np.uint8), cv2.DIST_L2, 5)
    out = []
    for pth in vec.trace_skeleton(sk):
        P = [(c + x0, r + y0) for r, c in pth]
        if len(P) < 2: continue
        wd = float(np.median([dt[r, c] for r, c in pth])) * 2
        V = vec.rdp(P, 1.2)
        for i in range(len(V) - 1): out.append(dict(t='line', a=V[i], b=V[i + 1], w=max(1.5, wd), lt='CONTINUOUS'))
    return out

def apply_text(F, spec):
    """returns a copy of the entity list with text corrections, additions and drops applied (ids kept; dropped -> None)."""
    E = [dict(e) for e in F['ents']]
    TX = spec.get('text') or {}
    span = lambda e: ftext.width(e['s']) * e['h'] / 10 * e['wf']
    deleted = [int(k) for k, v in TX.items() if v == '' and 0 <= int(k) < len(E) and E[int(k)]['t'] == 'text']
    def merged_span(i):
        # the row's own span, extended over rows on the same line that were deleted because they were merged into it
        e = F['ents'][i]; h = e['h']; end = span(e)
        changed = True
        while changed:
            changed = False
            for j in deleted:
                q = F['ents'][j]
                if q['ang'] != e['ang'] or abs(q['h'] - h) > 0.4 * h: continue
                if e['ang'] == 0: base_ok = abs(q['y'] - e['y']) < 0.35 * h; st = q['x'] - e['x']
                else: base_ok = abs(q['x'] - e['x']) < 0.35 * h; st = e['y'] - q['y']
                if base_ok and end - 0.5 * h < st < end + 3.5 * h and st + span(q) > end: end = st + span(q); changed = True
        return end
    for k, v in TX.items():
        i = int(k)
        if 0 <= i < len(E) and E[i] and E[i]['t'] == 'text':
            if v == '~':
                e = E[i]; h = e['h']; L = ftext.width(e['s']) * h / 10 * e['wf']
                box = (e['x'] - 0.2 * h, e['y'] - 1.2 * h, e['x'] + L + 0.3 * h, e['y'] + 0.25 * h) if e['ang'] == 0 else (e['x'] - 1.2 * h, e['y'] - L - 0.3 * h, e['x'] + 0.25 * h, e['y'] + 0.2 * h)
                E[i] = None
                E.extend(trace_box(os.path.join(HERE, 'pg', F.get('page', '') + '.png'), box))
                continue
            if v == '' or v is None: E[i] = None
            else:
                old = E[i]; old_w = merged_span(i); old_s = old['s']
                # the OCR row may have started after letters it missed: if the old string sits inside the new one,
                # move the start back by the width of what was added in front
                import difflib
                pos = -1
                for blk in difflib.SequenceMatcher(None, v, old_s, autojunk=False).get_matching_blocks():
                    if blk.size >= 2:
                        if blk.b <= 1 and blk.a - blk.b > 0: pos = blk.a - blk.b
                        elif blk.a == 0 and 0 < blk.b <= 3:
                            # leading junk of the OCR row removed: the text starts further right
                            dxr = ftext.width(old_s[:blk.b]) * old['h'] / 10 * old['wf'] + ftext.F['sp'] * old['h'] / 10 * old['wf']
                            if old['ang'] == 0: old['x'] += dxr
                            else: old['y'] -= dxr
                            old_w -= dxr
                        break
                if pos > 0:
                    dx = ftext.width(v[:pos]) * old['h'] / 10 * old['wf'] + (ftext.F['sp'] * old['h'] / 10 * old['wf'])
                    if old['ang'] == 0: old['x'] -= dx
                    else: old['y'] += dx
                    old_w += dx
                old['s'] = v
                # keep the measured span (including merged rows) when it fits, else the natural width
                nat = ftext.width(v) * old['h'] / 10
                wf = old_w / nat if nat else 1
                old['wf'] = wf if 0.75 < wf < 1.3 else 1.0
    circles = [e for e in F['ents'] if e['t'] == 'circle']
    for i in range(len(F['ents'])):
        e = E[i]
        if not e or e['t'] != 'text' or e['ang'] != 0: continue
        m = re.match(r'^(.*\S)(?:\s{2,}|\.\s*)([A-Z0-9])$', e['s'])
        if not m: continue
        h = e['h']; L = span(e); cy0 = e['y'] - h / 2
        best = None
        for c in circles:
            if 0.55 * h <= c['r'] <= 2.4 * h and abs(c['c'][1] - cy0) < 0.9 * h and e['x'] + 0.5 * L < c['c'][0] < e['x'] + L + 3 * h:
                if best is None or c['c'][0] < best['c'][0]: best = c
        if not best: continue
        head = m.group(1).rstrip('.')
        e['s'] = head
        lim = best['c'][0] - best['r'] - 0.6 * h - e['x']
        nat = ftext.width(head) * h / 10
        e['wf'] = min(1.3, max(0.75, lim / nat)) if nat else 1.0
        lw = ftext.width(m.group(2)) * h / 10
        E.append(dict(t='text', s=m.group(2), x=best['c'][0] - lw / 2, y=best['c'][1] + h / 2, h=h, wf=1.0, ang=0, sw=e.get('sw', h / 8)))
    for i in spec.get('drop') or []:
        if 0 <= i < len(E): E[i] = None
    for a in spec.get('add') or []:
        ref = F['ents'][int(a['like'])]
        h = ref['h']
        e = dict(t='text', s=a['s'], h=h, wf=1.0, ang=ref['ang'], sw=ref.get('sw', h / 8))
        if a.get('at'):
            e['x'] = a['at'][0] * F['W'] / 100; e['y'] = a['at'][1] * F['H'] / 100
            if a.get('ang') is not None: e['ang'] = a['ang']
        elif ref['ang'] == 0: e['x'] = ref['x'] + a.get('dx', 0) * h; e['y'] = ref['y'] + a.get('dy', 0) * h
        else: e['x'] = ref['x'] + a.get('dy', 0) * h; e['y'] = ref['y'] - a.get('dx', 0) * h
        E.append(e)
    return E

def assign(F, spec, E):
    W, H = F['W'], F['H']
    rects = [[[r[0] * W / 100, r[1] * H / 100, r[2] * W / 100, r[3] * H / 100] for r in d['rects']] for d in spec['details']]
    ex = [[r[0] * W / 100, r[1] * H / 100, r[2] * W / 100, r[3] * H / 100] for r in spec.get('exclude') or []]
    er = [[r[0] * W / 100, r[1] * H / 100, r[2] * W / 100, r[3] * H / 100] for r in spec.get('erase') or []]
    inside = lambda p, r: r[0] <= p[0] <= r[2] and r[1] <= p[1] <= r[3]
    out = []
    for e in E:
        if e is None: out.append(-1); continue
        c = ent_center(e)
        if c is None or any(inside(c, r) for r in ex): out.append(-1); continue
        if e['t'] != 'text' and any(inside(c, r) for r in er): out.append(-1); continue
        k = -1
        for di, rs in enumerate(rects):
            if any(inside(c, r) for r in rs): k = di; break
        out.append(k)
    return out

def bbox_px(E, idx):
    xs, ys = [], []
    for i in idx:
        e = E[i]
        import segment
        b = segment.ent_box(e)
        if b: xs += [b[0], b[2]]; ys += [b[1], b[3]]
    return (min(xs), min(ys), max(xs), max(ys)) if xs else (0, 0, 1, 1)

PAL = [(25, 90, 220), (20, 140, 60), (150, 40, 200), (215, 110, 0), (0, 140, 160), (120, 80, 30), (200, 30, 140), (60, 60, 60)]
def grid_overview(F, spec, path, scale=None):
    """the sheet with each detail's entities in its own colour; entities in no detail in RED, excluded ones pale."""
    W, H = F['W'], F['H']
    scale = scale or 1600.0 / max(W, H)
    img = np.full((int(H * scale), int(W * scale), 3), 255, np.uint8)
    if spec:
        E = apply_text(F, spec); A = assign(F, spec, E)
        X = excluded_mask(F, spec, E)
        groups = {}
        for i, (e, a) in enumerate(zip(E, A)):
            if e is None: continue
            groups.setdefault(-2 if (a == -1 and X[i]) else a, []).append(e)
        order = sorted(groups.keys())
        for g in order:
            col = (215, 215, 215) if g == -2 else (230, 0, 0) if g == -1 else PAL[g % len(PAL)]
            build.render(dict(H=H, W=W, ents=groups[g]), scale, img, col)
    else:
        img = build.render(F, scale)
    pil = Image.fromarray(img).convert('RGB'); d = ImageDraw.Draw(pil, 'RGBA')
    f = ImageFont.truetype(FONT, 13); fb = ImageFont.truetype(FONTB, 20)
    for p in range(0, 101, 5):
        x = p * W / 100 * scale; y = p * H / 100 * scale
        col = (0, 120, 255, 70 if p % 10 == 0 else 30)
        d.line([(x, 0), (x, H * scale)], fill=col, width=1); d.line([(0, y), (W * scale, y)], fill=col, width=1)
        if p % 10 == 0:
            d.text((x + 2, 2), str(p), fill=(0, 90, 220), font=f); d.text((2, y + 2), str(p), fill=(0, 90, 220), font=f)
    if spec:
        for i, dt in enumerate(spec['details']):
            colr = PAL[i % len(PAL)]
            for r in dt['rects']:
                x0, y0, x1, y1 = r[0] * W / 100 * scale, r[1] * H / 100 * scale, r[2] * W / 100 * scale, r[3] * H / 100 * scale
                d.rectangle([x0, y0, x1, y1], outline=colr + (150,), width=1)
            r = dt['rects'][0]; x0, y0 = r[0] * W / 100 * scale, r[1] * H / 100 * scale
            d.rectangle([x0, y0, x0 + 28, y0 + 24], fill=colr + (255,)); d.text((x0 + 4, y0 + 1), str(i + 1), fill=(255, 255, 255), font=fb)
        for r in spec.get('erase') or []:
            x0, y0, x1, y1 = r[0] * W / 100 * scale, r[1] * H / 100 * scale, r[2] * W / 100 * scale, r[3] * H / 100 * scale
            d.rectangle([x0, y0, x1, y1], outline=(255, 0, 200, 255), width=2)
        for r in spec.get('exclude') or []:
            x0, y0, x1, y1 = r[0] * W / 100 * scale, r[1] * H / 100 * scale, r[2] * W / 100 * scale, r[3] * H / 100 * scale
            d.rectangle([x0, y0, x1, y1], outline=(120, 120, 120, 255), width=1)
    pil.save(path)

def excluded_mask(F, spec, E):
    W, H = F['W'], F['H']
    ex = [[r[0] * W / 100, r[1] * H / 100, r[2] * W / 100, r[3] * H / 100] for r in (spec.get('exclude') or [])]
    er = [[r[0] * W / 100, r[1] * H / 100, r[2] * W / 100, r[3] * H / 100] for r in (spec.get('erase') or [])]
    inside = lambda p, r: r[0] <= p[0] <= r[2] and r[1] <= p[1] <= r[3]
    out = []
    for e in E:
        if e is None: out.append(True); continue
        c = ent_center(e)
        out.append(c is None or any(inside(c, r) for r in ex) or (e['t'] != 'text' and any(inside(c, r) for r in er)))
    return out

def suggest(F, page):
    import segment
    S = segment.segment(F, page)
    W, H = F['W'], F['H']
    det = []
    for g in S['regions']:
        x0, y0, x1, y1 = g['bbox']
        det.append(dict(name=g['title'] or ('DETAIL %d' % len(det)), rects=[[round(x0 / W * 100 - 0.4, 1), round(y0 / H * 100 - 0.4, 1), round(x1 / W * 100 + 0.4, 1), round(y1 / H * 100 + 0.4, 1)]]))
    a = S['area']
    excl = []
    if page.startswith('m'): excl = [[round(a[2] / W * 100, 1), 0, 100, 100]]
    try: cat = json.load(open(os.path.join(HERE, 'sheetcat.json'))).get(S['sheet'] or '', '')
    except Exception: cat = ''
    return dict(sheet=S['sheet'], title='', cat=cat, details=det, exclude=excl, erase=[], text={}, add=[], drop=[])

def show(page, only=None):
    F, spec = load(page)
    src = vec.load(os.path.join(HERE, 'pg', page + '.png'))
    E = apply_text(F, spec); A = assign(F, spec, E)
    d = os.path.join(HERE, 'review', page)
    fb = ImageFont.truetype(FONTB, 15)
    outs = []
    for di, dt in enumerate(spec['details']):
        if only and di + 1 != only: continue
        idx = [i for i, a in enumerate(A) if a == di]
        if not idx: print('detail', di + 1, 'is empty'); continue
        x0, y0, x1, y1 = bbox_px(E, idx); m = 20
        x0, y0, x1, y1 = int(max(0, x0 - m)), int(max(0, y0 - m)), int(min(F['W'], x1 + m)), int(min(F['H'], y1 + m))
        sc = min(1.0, 1150.0 / max(1, x1 - x0), 1500.0 / max(1, y1 - y0))
        sub = dict(H=F['H'], W=F['W'], ents=[E[i] for i in idx])
        full = build.render(sub, 1.0)[y0:y1, x0:x1]
        so = np.where(src[y0:y1, x0:x1, None], 0, 255).repeat(3, 2).astype(np.uint8)
        so = cv2.resize(so, (int((x1 - x0) * sc), int((y1 - y0) * sc)), interpolation=cv2.INTER_AREA)
        ve = cv2.resize(full, (int((x1 - x0) * sc), int((y1 - y0) * sc)), interpolation=cv2.INTER_AREA)
        pil = Image.fromarray(ve); dr = ImageDraw.Draw(pil)
        for i in idx:
            e = E[i]
            if e['t'] == 'text':
                tx = (e['x'] - x0) * sc; ty = (e['y'] - y0 - e['h']) * sc
                if e['ang'] == 90: tx = (e['x'] - e['h'] - x0) * sc - 8; ty = (e['y'] - y0) * sc
                dr.text((tx - 2, ty - 15), str(i), fill=(0, 60, 255), font=fb)
        sep = np.full((so.shape[0], 12, 3), 200, np.uint8)
        both = np.concatenate([so, sep, np.array(pil)], 1)
        p = os.path.join(d, 'd%d.png' % (di + 1)); Image.fromarray(both).save(p); outs.append(p)
        print('detail %d %s: %d entities, %d texts -> %s' % (di + 1, dt['name'], len(idx), sum(1 for i in idx if E[i]['t'] == 'text'), p))
    X = excluded_mask(F, spec, E)
    un = [i for i, a in enumerate(A) if a == -1 and not X[i]]
    print('unassigned entities (lost unless you add them to a detail):', len(un))
    return outs

def proof(page):
    """text proof sheets: id | detail | scanned crop | recognised string (30 rows per image)."""
    F, spec = load(page)
    src = vec.load(os.path.join(HERE, 'pg', page + '.png'))
    E = apply_text(F, spec); A = assign(F, spec, E)
    T = [i for i, e in enumerate(E) if e is not None and e['t'] == 'text' and A[i] >= 0]
    fixed = set(int(k) for k in (spec.get('text') or {}))
    def trusted(i):
        e = E[i]
        return (not SHOW_ALL and i not in fixed and i < len(F['ents']) and e.get('cf', 0) >= 94 and not e.get('p2') and 's0' not in e
                and re.match(r'^[A-Z0-9 .,()\-:/]{3,}$', e['s']) and len(e['s'].split()) >= 2)
    nt = sum(1 for i in T if trusted(i))
    T = [i for i in T if not trusted(i)]
    print('%d rows read with high confidence are not shown (proof %s all shows them)' % (nt, page))
    T.sort(key=lambda i: (A[i], round((E[i]['y'] if E[i]['ang'] == 0 else E[i]['x']) / max(10, E[i]['h'] * 0.6)), E[i]['x'] if E[i]['ang'] == 0 else -E[i]['y']))
    f = ImageFont.truetype(FONT, 21); fb = ImageFont.truetype(FONTB, 16)
    d = os.path.join(HERE, 'review', page)
    for old in [p for p in os.listdir(d) if re.match(r't\d+\.png$', p)]: os.remove(os.path.join(d, old))
    per, rows = 30, []
    for k in range(0, len(T), per):
        chunk = T[k:k + per]
        canvas = Image.new('RGB', (1400, 48 * len(chunk) + 8), (255, 255, 255)); dr = ImageDraw.Draw(canvas)
        for r, i in enumerate(chunk):
            e = E[i]; L = ftext.width(e['s']) * e['h'] / 10 * e['wf']; h = e['h']
            if e['ang'] == 0: bx = (int(e['x'] - 0.4 * h), int(e['y'] - 1.4 * h), int(e['x'] + L + 0.6 * h), int(e['y'] + 0.5 * h))
            else: bx = (int(e['x'] - 1.4 * h), int(e['y'] - L - 0.6 * h), int(e['x'] + 0.5 * h), int(e['y'] + 0.4 * h))
            bx = (max(0, bx[0]), max(0, bx[1]), min(F['W'], bx[2]), min(F['H'], bx[3]))
            crop = np.where(src[bx[1]:bx[3], bx[0]:bx[2]], 0, 255).astype(np.uint8)
            if e['ang'] == 90: crop = np.rot90(crop, -1)
            y = 4 + r * 48
            dr.text((4, y + 10), str(i), fill=(0, 60, 255), font=fb); dr.text((62, y + 10), 'd%d' % (A[i] + 1), fill=(150, 150, 150), font=fb)
            if crop.size:
                s_ = 38.0 / crop.shape[0]; cw = int(crop.shape[1] * s_)
                if cw > 690: s_ = 690.0 / crop.shape[1]; cw = 690
                canvas.paste(Image.fromarray(crop).resize((max(1, cw), max(1, int(crop.shape[0] * s_)))), (100, y))
            dr.text((800, y + 8), e['s'], fill=(0, 0, 0), font=f)
            dr.line([(0, y + 44), (1400, y + 44)], fill=(228, 228, 228))
        p = os.path.join(d, 't%d.png' % (k // per + 1)); canvas.save(p); rows.append(p)
    print(len(T), 'texts ->', ', '.join(os.path.basename(p) for p in rows))

PENS = [0.13, 0.18, 0.25, 0.35, 0.50, 0.70, 1.00]
BASE = {'HIDDEN': 1.6, 'DASHED': 3.0, 'CENTER': 8.0, 'DASHDOT': 5.0}
def export(page):
    F, spec = load(page)
    E = apply_text(F, spec); A = assign(F, spec, E)
    k = F.get('k', 1.0); mm = 25.4 / 400.0 * k; H = F['H']
    P = lambda p: [round(p[0] * mm, 3), round((H - p[1]) * mm, 3)]
    pen = lambda wpx: min(PENS, key=lambda q: abs(q - max(0.1, (wpx - 0.8) * mm)))
    details = []
    for di, dt in enumerate(spec['details']):
        idx = [i for i, a in enumerate(A) if a == di]
        if not idx: continue
        out = []
        for i in idx:
            e = E[i]; t = e['t']
            if t == 'line':
                o = dict(t='line', a=P(e['a']), b=P(e['b']), lw=pen(e['w']))
                if e.get('lt', 'CONTINUOUS') != 'CONTINUOUS':
                    o['lt'] = e['lt']
                    if e.get('dash'): o['ls'] = round(max(0.3, min(4, e['dash'] * mm / BASE.get(e['lt'], 3))), 2)
            elif t == 'circle':
                o = dict(t='circle', c=P(e['c']), r=round(e['r'] * mm, 3), lw=pen(e['w']))
                if e.get('lt', 'CONTINUOUS') != 'CONTINUOUS': o['lt'] = e['lt']
            elif t == 'arc':
                # image frame (y down, ccw s->e on screen = cw in y-up) -> y up: angles negate and swap
                o = dict(t='arc', c=P(e['c']), r=round(e['r'] * mm, 3), a0=round((-e['e']) % 360, 2), a1=round((-e['s']) % 360, 2), lw=pen(e['w']))
                if e.get('lt', 'CONTINUOUS') != 'CONTINUOUS': o['lt'] = e['lt']
            elif t == 'solid': o = dict(t='solid', p=[P(q) for q in e['p']])
            elif t == 'dot': o = dict(t='solid', p=[P((e['c'][0] + 3 * math.cos(a), e['c'][1] + 3 * math.sin(a))) for a in [j * math.pi / 3 for j in range(6)]])
            elif t == 'text':
                tx = e['s'].replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"')
                tx = re.sub(r'\$(?=\d)', 'Ø', tx)
                if '(' in tx: tx = tx.replace('}', ')')
                if ')' in tx: tx = tx.replace('{', '(')
                o = dict(t='text', p=P((e['x'], e['y'])), s=tx, h=round(e['h'] * mm, 3), wf=round(e['wf'], 3), ang=e['ang'], al='l', v='b', sw=round(max(0.13, e.get('sw', e['h'] / 8) * mm), 3))
            else: continue
            o['L'] = 'STD-TEXT' if o['t'] == 'text' else ('STD-%.2f' % o.get('lw', 0.25)) if 'lw' in o else 'STD-0.25'
            out.append(o)
        # origin at bottom-left of the detail
        xs, ys = [], []
        for o in out:
            if o['t'] == 'text':   # the whole text, not just its insertion point
                Lw = ftext.width(o['s']) * o['h'] / 10 * o['wf']
                x, y = o['p']
                if o['ang']: xs += [x - o['h'], x]; ys += [y, y + Lw]
                else: xs += [x, x + Lw]; ys += [y, y + o['h']]
            for key in ('a', 'b', 'c', 'p'):
                v = o.get(key)
                if v is None: continue
                if isinstance(v[0], list):
                    for q in v: xs.append(q[0]); ys.append(q[1])
                else: xs.append(v[0]); ys.append(v[1])
        ox, oy = min(xs), min(ys)
        sh = lambda q: [round(q[0] - ox, 3), round(q[1] - oy, 3)]
        for o in out:
            for key in ('a', 'b', 'c', 'p'):
                v = o.get(key)
                if v is None: continue
                o[key] = [sh(q) for q in v] if isinstance(v[0], list) else sh(v)
        details.append(dict(name=dt['name'], ents=out, w=round(max(xs) - ox, 1), h=round(max(ys) - oy, 1)))
    lib = dict(sheet=spec['sheet'], title=spec.get('title', ''), cat=spec.get('cat', ''), page=page, k=k, details=details)
    os.makedirs(os.path.join(HERE, 'lib'), exist_ok=True)
    fn = os.path.join(HERE, 'lib', re.sub(r'[^\w\-]', '_', spec['sheet'] or page) + '.json')
    json.dump(lib, open(fn, 'w'), separators=(',', ':'))
    print('exported', fn, [(d['name'], len(d['ents'])) for d in details], os.path.getsize(fn) // 1024, 'KB')

def zoom(page, rect):
    """source | vector of a rectangle given in % (x0,y0,x1,y1), at full resolution (max 1100 px wide per panel)."""
    F, spec = load(page)
    src = vec.load(os.path.join(HERE, 'pg', page + '.png'))
    E = apply_text(F, spec) if spec else F['ents']
    x0, y0, x1, y1 = [int(v * (F['W'] if i % 2 == 0 else F['H']) / 100) for i, v in enumerate(rect)]
    if spec:
        X = excluded_mask(F, spec, E)
        E = [e for e, x in zip(E, X) if not x]
    sub = dict(H=F['H'], W=F['W'], ents=[e for e in E if e is not None])
    ve = build.render(sub, 1.0)[y0:y1, x0:x1]
    so = np.where(src[y0:y1, x0:x1, None], 0, 255).repeat(3, 2).astype(np.uint8)
    sc = min(1.0, 1100.0 / max(1, x1 - x0))
    so = cv2.resize(so, (int(so.shape[1] * sc), int(so.shape[0] * sc)), interpolation=cv2.INTER_AREA); ve = cv2.resize(ve, (so.shape[1], so.shape[0]), interpolation=cv2.INTER_AREA)
    p = os.path.join(HERE, 'review', page, 'zoom.png')
    Image.fromarray(np.concatenate([so, np.full((so.shape[0], 12, 3), 200, np.uint8), ve], 1)).save(p); print(p)

def check(page, show=True):
    """compare the final vectors with the scan: boxes where ink is MISSING (red) or EXTRA/doubled (blue)."""
    F, spec = load(page)
    src = vec.load(os.path.join(HERE, 'pg', page + '.png'))
    E = apply_text(F, spec); A = assign(F, spec, E)
    keep = [e for e, a in zip(E, A) if e is not None and a >= 0]
    out = build.render(dict(H=F['H'], W=F['W'], ents=keep), 1.0)[:, :, 0] < 128
    # only judge inside the details' rects
    W, H = F['W'], F['H']
    zone = np.zeros_like(src)
    for d in spec['details']:
        for r in d['rects']:
            zone[int(r[1] * H / 100):int(r[3] * H / 100), int(r[0] * W / 100):int(r[2] * W / 100)] = True
    for r in (spec.get('exclude') or []):
        zone[int(r[1] * H / 100):int(r[3] * H / 100), int(r[0] * W / 100):int(r[2] * W / 100)] = False
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))
    sd = cv2.dilate(src.astype(np.uint8), k).astype(bool); od = cv2.dilate(out.astype(np.uint8), k).astype(bool)
    miss = src & ~od & zone; extra = out & ~sd & zone
    boxes = []
    for kind, m in (('missing', miss), ('extra', extra)):
        mm = cv2.dilate(m.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_RECT, (25, 25)))
        n, lab, st, _ = cv2.connectedComponentsWithStats(mm, connectivity=8)
        for i in range(1, n):
            x, y, w, h, a = st[i]
            ink = m[y:y + h, x:x + w].sum()
            if ink < 120: continue
            boxes.append((int(ink), kind, [round(x / W * 100, 1), round(y / H * 100, 1), round((x + w) / W * 100, 1), round((y + h) / H * 100, 1)]))
    boxes.sort(key=lambda b: -b[0])
    rec = (src & od & zone).sum() / max(1, (src & zone).sum()); pre = (out & sd & zone).sum() / max(1, (out & zone).sum())
    print('%s: match %.3f of scan ink, %.3f of drawn ink; %d problem areas' % (page, rec, pre, len(boxes)))
    for b in boxes[:25]: print('  %-7s %6d px  %s' % (b[1], b[0], ','.join(str(v) for v in b[2])))
    if show:
        sc = 1600.0 / max(W, H)
        img = np.full((int(H * sc), int(W * sc), 3), 255, np.uint8)
        build.render(dict(H=H, W=W, ents=keep), sc, img, (150, 150, 150))
        pil = Image.fromarray(img); d = ImageDraw.Draw(pil); f = ImageFont.truetype(FONTB, 14)
        for j, b in enumerate(boxes[:25]):
            x0, y0, x1, y1 = [v * (W if q % 2 == 0 else H) / 100 * sc for q, v in enumerate(b[2])]
            col = (220, 0, 0) if b[1] == 'missing' else (0, 80, 230)
            d.rectangle([x0 - 3, y0 - 3, x1 + 3, y1 + 3], outline=col, width=2); d.text((x0, y0 - 16), str(j + 1), fill=col, font=f)
        pil.save(os.path.join(HERE, 'review', page, 'check.png'))
    return rec, pre, boxes

if __name__ == '__main__':
    cmd, page = sys.argv[1], sys.argv[2]
    os.makedirs(os.path.join(HERE, 'review', page), exist_ok=True)
    if cmd == 'init':
        F, spec = load(page)
        if spec is None:
            spec = suggest(F, page)
            json.dump(spec, open(os.path.join(HERE, 'review', page, 'spec.json'), 'w'), indent=1)
        grid_overview(F, spec, os.path.join(HERE, 'review', page, 'overview.png'))
        print(json.dumps(spec, indent=1)[:1500])
    elif cmd == 'grid':
        F, spec = load(page); grid_overview(F, spec, os.path.join(HERE, 'review', page, 'overview.png')); print('ok')
    elif cmd == 'show': show(page, int(sys.argv[3]) if len(sys.argv) > 3 else None)
    elif cmd == 'proof':
        SHOW_ALL = len(sys.argv) > 3 and sys.argv[3] == 'all'
        proof(page)
    elif cmd == 'export': export(page)
    elif cmd == 'check': check(page)
    elif cmd == 'zoom': zoom(page, [float(v) for v in sys.argv[3].split(',')])
