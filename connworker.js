/* StructCap Connection — runs the plate FE (CBFEM) off the page so the app stays responsive. */
importScripts('engine.js', 'steelsec.js', 'gantry.js', 'conn.js', 'conncheck.js', 'connfe.js');
self.onmessage = e => {
  const { id, J, les } = e.data || {}, C = self.CONN;
  self.postMessage({ id, ready: true });
  les.forEach(le => {
    const l = J.loads.find(q => q.id === le);
    try {
      const g = C.build(J), r = C.fe.run(J, g, l);
      if (!r.ok) { self.postMessage({ id, le, ok: false, err: r.err }); return; }
      const checks = C.fe.checks(J, g, r, l);
      self.postMessage({ id, le, ok: true, res: r, checks });
    } catch (err) { self.postMessage({ id, le, ok: false, err: String(err && err.message || err) }); }
  });
};
