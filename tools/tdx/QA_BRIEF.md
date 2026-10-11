# QA brief: final check of the extracted standard details against the scans

Every sheet has already been split into details and its text corrected, as set out in
`REVIEW_BRIEF.md` in the same folder. Read that brief first, for the commands and the `spec.json` format.
This pass compares the final result with the scan and fixes what is visibly different.

Directory: `T=/tmp/claude-0/-home-claude-structcap/a61acca7-a8a8-5a5f-82cf-ca7d81a86ce1/scratchpad/tdx`.
Run `cd $T && python3 review.py <cmd> <page> ...`. Edit only `review/<page>/spec.json`. Do not write scripts.

## What changed since the first pass

1. **Erasing works.** The old `zoom` did not show the effect of `erase` and `exclude`, which made erasing look broken. It now shows them. Some rows were left as part-words ("ION", "TYP)", "00 LONG", "0x100") because the leading letters stayed as strokes. Fix those properly:
   - `erase` a small rect over the stroke letters;
   - put the FULL word in the text row (e.g. `"Ø10x100 LONG"`).
   
   The tool now moves the start of the text back automatically when you add letters in front of what OCR read, and moves it forward when you remove junk from the front.
2. Lines that you merged (full line in the first row, `""` in the others) now keep the width of the whole line on the sheet.
3. A title written with its circle letter (`SECTION  A`) is now split automatically, and the letter is centred in its circle.
4. New command `check <page>` compares the final drawing with the scan. It prints the match and a list of problem areas as `x0,y0,x1,y1` in %, and writes `check.png`:
   - **missing**: ink on the scan that is not drawn;
   - **extra**: drawn but not on the scan, such as doubled text or text in the wrong place or size.

## For each page
1. `check <page>`. Read the list of problem areas. You may skip `check.png`.
2. Zoom on the problem areas in order of size. Combine neighbours into one zoom, at most about 6 zooms per page. Fix what is wrong:
   - **leftover stroke letters in front of a text:** `erase` them and write the full word;
   - **doubled text** (a text row and the same word as strokes): `erase` the strokes;
   - **text in the wrong size or place:** usually two printed lines of different size merged into one row. Keep the first part in the row and `add` the rest with `like` set to a row of the right size;
   - **missing geometry:** usually an `erase`/`exclude` rect that is too big, or a detail rect that misses part of a view. Adjust the rects;
   - **small stroke shapes the scan does not have:** leave them alone unless they are obviously junk.
   
   Small differences in letter shape or weight are expected and are not errors: our lettering is a clean CAD font and the scan is a print.
3. Run `check` again and `export`. Do not re-read every proof image. Run `proof` only when you changed a lot of text.

## Report
One line per page: page, the match figures from the final `check`, and anything left unresolved. Nothing else.
