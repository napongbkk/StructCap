# Workbook calculations in StructCap

`extract.py` converts an engineer's calculation workbook (.xlsx) into a JSON model that the app recalculates in the
browser with `xlcalc.js` and draws with `xlsheet.js` (cells, formats, merged cells, conditional colours and the
XY-scatter sketches). Only the input cells (yellow fill, FFF2CC) can be changed in the app; the formulas are locked.

    python3 -I tools/xlsheet/extract.py 07_T5_Column_Clamp_Rev35.xlsx colclamp.json tests/fixtures/colclamp_expect.json.gz

`tests/colclamp.test.js` recalculates every formula and compares it with the values Excel saved in the workbook,
and with a LibreOffice recalculation of a second set of inputs (`tests/fixtures/colclamp_alt.json.gz`).
