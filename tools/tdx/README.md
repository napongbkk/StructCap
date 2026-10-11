# Standard drawing extraction (tdx)

The `tdx/` library at the site root is traced from the scanned standard drawings:
the PN30 timber bridge repair manual (140 pages) and the 1330 standard drawings (27 pages).

Pipeline (Python 3, OpenCV, scikit-image, Tesseract):
1. `vec.py`: page raster (400 dpi, 1-bit) → OCR words, rings, dots, arrowheads and filled shapes, skeleton line segments and arcs.
2. `build.py`: lines merged, dashed / centre / dash-dot linetypes recognised, circles merged. Text lines are assembled, re-read as whole lines for punctuation, and given their measured cap height, width factor and stroke weight.
3. `segment.py` + `review.py`: each sheet is split into its details and the text is checked against the scan. The splits and text corrections live in `specs/<page>.json`.
4. `review.py export` writes one JSON per sheet in paper mm, at the printed size: A3 for PN30, A1 for 1330. `mkindex.py` builds `tdx/index.json` and the thumbnail sprites.

Lettering: `font.py` defines a single-stroke font after ISO 3098 type B, matched to the ISOCPEUR lettering on the sheets.
It is emitted as `tfont.js` for the app; in DXF, text uses the ISO style (`isocpeur.ttf`).
