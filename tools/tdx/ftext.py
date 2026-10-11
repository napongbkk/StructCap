import json, math, numpy as np, cv2
F = json.load(open('/tmp/claude-0/-home-claude-structcap/a61acca7-a8a8-5a5f-82cf-ca7d81a86ce1/scratchpad/tdx/font.json'))
def width(s):
    return sum(F['g'].get(c, F['g']['X'])['a'] for c in s) - F['sp']
def strokes(s, x, y, h, wf=1.0, ang=0.0):
    """polylines in a y-DOWN pixel frame: baseline-left at (x,y), cap height h."""
    k = h / 10.0; out = []; cx = 0.0
    ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    for c in s:
        gl = F['g'].get(c) or F['g'].get(c.upper()) or F['g']['X']
        for st in gl['s']:
            pts = []
            for i in range(0, len(st), 2):
                u, v = (cx + st[i]) * k * wf, st[i + 1] * k
                pts.append((x + u * ca - v * sa, y - (u * sa + v * ca)))
            out.append(pts)
        cx += gl['a']
    return out
def draw(img, s, x, y, h, wf=1.0, ang=0.0, col=(0, 0, 0), lw=None):
    lw = lw or max(1, int(round(h / 7.5)))
    for p in strokes(s, x, y, h, wf, ang):
        cv2.polylines(img, [np.int32(np.round(p))], False, col, lw, cv2.LINE_AA)
