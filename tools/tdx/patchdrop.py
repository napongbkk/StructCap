"""Restore small pieces (box-edge dashes) that the old 'punctuation remnant' rule dropped next to text.
   Entities are APPENDED to out/<page>.json so existing ids (used by the specs) do not change."""
import sys, json, gzip, os
import build
def bbox_of(e):
    t = e['t']
    if t == 'line': return (min(e['a'][0], e['b'][0]), min(e['a'][1], e['b'][1]), max(e['a'][0], e['b'][0]), max(e['a'][1], e['b'][1])), 0.9
    if t == 'dot': return (e['c'][0] - 2, e['c'][1] - 2, e['c'][0] + 2, e['c'][1] + 2), 0.9
    if t == 'solid': xs = [p[0] for p in e['p']]; ys = [p[1] for p in e['p']]; return (min(xs), min(ys), max(xs), max(ys)), 0.6
    if t == 'arc': return (e['c'][0] - e['r'], e['c'][1] - e['r'], e['c'][0] + e['r'], e['c'][1] + e['r']), 0.9
    return None, None
def dropped(ents, T, boxes):
    out = []
    for i, e in enumerate(ents):
        bb, lim = bbox_of(e)
        if bb is None: continue
        x0, y0, x1, y1 = bb
        for (bx0, by0, bx1, by1), t in zip(boxes, T):
            if x0 >= bx0 and y0 >= by0 and x1 <= bx1 and y1 <= by1 and max(x1 - x0, y1 - y0) < lim * t['h']: out.append(i); break
    return out
def new_box(e):
    h = e['h']; import ftext; L = ftext.width(e['s']) * h / 10 * e['wf']
    if e['ang'] == 0: return (e['x'] - 0.05 * h, e['y'] - 1.05 * h, e['x'] + L + 0.4 * h, e['y'] + 0.12 * h)
    return (e['x'] - 1.05 * h, e['y'] - L - 0.4 * h, e['x'] + 0.12 * h, e['y'] + 0.05 * h)
for pg in sys.argv[1:]:
    fo = 'out/%s.json' % pg
    F = json.load(open(fo))
    if F.get('patched_drop'): continue
    raw = json.load(gzip.open('raw/%s.json.gz' % pg, 'rt'))
    pre = build.finalize(raw, None)['ents']
    pre_nt = [e for e in pre if e['t'] != 'text']
    T = [e for e in F['ents'] if e['t'] == 'text']
    old = set(dropped(pre_nt, T, [build.line_box(e, 1.05, 0.12) for e in T]))
    n_out_nt = sum(1 for e in F['ents'] if e['t'] != 'text')
    if len(pre_nt) - len(old) != n_out_nt:
        print(pg, 'MISMATCH', len(pre_nt), len(old), n_out_nt, flush=True); continue
    new = set(dropped(pre_nt, T, [new_box(e) for e in T]))
    back = [pre_nt[i] for i in sorted(old - new)]
    F['ents'] += back; F['patched_drop'] = len(back)
    json.dump(F, open(fo, 'w'), default=float)
    print(pg, 'restored', len(back), flush=True)
