# Brief: split the standard timber bridge sheets into details and make the text exact

StructCap's drawing tool has a library of timber bridge repair details that must match the standard drawings
exactly. Every scanned sheet has already been converted to CAD vectors automatically: lines with their measured
weight and linetype, arcs, circles, arrowheads, and text read by OCR, drawn in the sheets' ISO lettering.
For each sheet in your list you do two things:
1. split the sheet into its individual details, and
2. make every piece of text exactly match the sheet.
Then you export it. Use only the commands below and only edit `review/<page>/spec.json`. Never edit any other file.

Be economical. A sheet should take about 8–12 image reads:
- 2–3 overview reads;
- one read of each proof image;
- a zoom only when a crop is unreadable.
Do not write your own scripts.

Directory: `T=/tmp/claude-0/-home-claude-structcap/a61acca7-a8a8-5a5f-82cf-ca7d81a86ce1/scratchpad/tdx`.
Run: `cd $T && python3 review.py <cmd> <page> ...`. Page ids look like `r-045` or `m-03`. Images are written to
`$T/review/<page>/`; view them with the Read tool.

## Commands
- `init <page>`:
  - writes `spec.json` with rough suggested details, but only if no spec exists yet;
  - draws `overview.png`.
- `grid <page>`: redraws `overview.png` from your current `spec.json`. In the overview:
  - every detail's lines and text are drawn in that detail's colour, with its number at its first rect;
  - RED marks anything that belongs to no detail and would be lost;
  - pale grey marks excluded content;
  - a blue % grid (0–100 across and down) helps you place rects.
- `proof <page>` writes `t1.png, t2.png …`. Each row shows the text id, the detail it is in (d1, d2, …), the scanned crop, and our string.
  Rows that OCR read with very high confidence (plain words and numbers) are not shown; `proof <page> all` shows every row. Use it only if the overview suggests a hidden row is wrong.
- `zoom <page> x0,y0,x1,y1` writes `zoom.png`: the scan and the vectors side by side for any rectangle given in %, at full resolution.
- `export <page>`: run it last.

## spec.json
```json
{ "sheet": "PN30-2303", "title": "PIER HALFCAPS STRENGTHENING DETAIL", "cat": "Halfcaps",
  "details": [ {"name": "SECTION A", "rects": [[8.5, 66, 40.3, 87.5]]}, ... ],
  "exclude": [[83, 96, 100, 100]], "erase": [], "text": {"2539": "IF BEARING IS <70 THEN REFER", "2584": ""},
  "add": [], "drop": [] }
```
- `sheet`: the drawing number, PN30-XXXX (bottom right) or 1330-000N (title block). Check it and fix it if wrong.
- `title`: the sheet's main caption, exactly as printed (the bold underlined title).
- `cat`: one of `Piles`, `Halfcaps`, `Stringers`, `Deck & overlay`, `Abutments`, `Wing walls`, `Sheeting`,
  `Barrier`, `Bracing`, `Bearings`, `General`. It is pre-filled from an older index; change it if it is clearly wrong.
- `details`:
  - each detail has a `name` and one or more `rects` `[x0, y0, x1, y1]` in % (x across, y down).
  - An entity goes to the FIRST detail whose rect contains its centre, so put small/inner details before the big ones around them.
  - Several rects per detail are fine, for example to follow a leader or dashed note box that reaches across.
- `exclude`: rects whose contents are dropped. Use it for:
  - the title block and border;
  - the large page number "PN30-xxxx";
  - "ISSUED FOR COMMENT" stamps;
  - sheet-edge scanner marks;
  - the vertical file-path text at the left edge of 1330 sheets.
- `erase`: rects where non-text vectors are dropped. Use it for garbled strokes where a word was not read; then `add` the word.
- `text`: id → exact string. Two special values:
  - `""` deletes the row (junk, a duplicate, or the second half of a merged line);
  - `"~"` means "this is part of the drawing, not text" (an arrow, a tick, a weld triangle or a hatch mark that was read as a letter). It is redrawn as plain lines from the scan.
- `add`: `{"s": "TEXT", "like": <id of a nearby text of the same size>, "dx": 0, "dy": 1.6}`. `dx` and `dy` are in cap heights from that text's start; `dy` > 0 is lower, and 1.6 is about the next line. Or `{"s": "TEXT", "like": <id>, "at": [x%, y%]}`, where `at` is the baseline-left point in % of the page.

## Splitting
A detail is one titled view with everything that belongs to it:
- geometry, hatching, centre lines;
- dimensions, leaders and their labels;
- section-cut markers and call-out circles drawn on it;
- the title with its circle letter, the scale ("1:20"), and the sub-lines under the title.

Separate details:
- every titled view (SECTION A, DETAIL 1, ELEVATION, PLAN, VIEW B, TYPICAL …);
- the general NOTES block, named "NOTES";
- dashed or boxed notes that are not inside one view, named "NOTE – <first words>". If a note is leadered to two views, give it its own detail and keep its leaders with it.
- tables, named by their title.

The sheet's main caption, with its sub-lines and a "DRG NUMBER – REFER TO PLAN DRAWING" box, goes with the view it sits under (usually the elevation).

Name each detail by its printed title: `SECTION A`, `DETAIL 1`, `ELEVATION`, `PLAN`, `VIEW B`, `NOTES`.
- If the main caption belongs to that view, append it: `ELEVATION – PIER HALFCAPS STRENGTHENING DETAIL`.
- If two views share a title, tell them apart: `DETAIL 1 – 380 PFC`.

Finish when every colour is one sensible detail and there is no red left except junk.

## Text
Read every row of every proof image. The scanned crop is the authority; read the line in the middle of the crop.
- Make the string match exactly: letters, digits, spaces, punctuation. Keep the sheet's own spelling.
- Watch for these typical errors:
  - a leading "C" or "I" that is really a box edge (e.g. "CIF BEARING" should be "IF BEARING");
  - stray "." or "_" or "|";
  - `Ø` read as `#`, `$`, `0`, `@` or dropped;
  - `1:10` read as `110`;
  - `(` read as `{`;
  - `O`/`0`, `I`/`1` and `S`/`5` swaps;
  - a missing `&`, `–` or `"`.
- Characters to use:
  - `≤` and `≥`; `℄` for the centre-line symbol;
  - `▼` for the water-level triangle in front of a level label; keep it in the string, e.g. `▼ PERMANENT WATER LEVEL`;
  - `Ø` for the diameter sign;
  - `°` for degrees;
  - a lower-case `x` in sizes like `65x5FLx65` when the sheet shows a lower-case x;
  - `"` for both quote marks;
  - `N°` for "No" written with a raised small o.
- When a title includes its circle letter (`SECTION. A`), just clean it to `SECTION  A` (two spaces). Keep the circle letter in the same string.
- When a line is split over two rows, put the whole line in the row that starts the line and `""` in the other.
- If you see words on the sheet that have no row (their letters show as broken strokes in the overview), `erase` that small area and `add` the text.

Then run `grid` once more, glance at the overview, and run `export`.

## Report
One line per sheet: page, sheet number, number of details, and anything left unresolved. Nothing else.
