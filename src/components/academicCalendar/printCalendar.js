/**
 * Print-to-PDF for the academic calendar document.
 *
 * Opens a clean popup with only the calendar, pulls in the app's stylesheets,
 * shrinks the whole document to fit a single UPRIGHT A4 portrait page, and
 * invokes the print dialog. The user picks "Save as PDF".
 *
 * Key detail: we scale with CSS `zoom`, NOT `transform: scale()`.
 * `transform` shrinks the content visually but the browser still computes page
 * breaks from the ORIGINAL full-size layout — so a tall table breaks onto a
 * second page even though the scaled version has room to spare (the exact
 * "splits across two pages with empty space" bug). `zoom` changes the actual
 * layout size, so page-break math uses the scaled dimensions and it fits on
 * one page. Chromium (what print-to-PDF uses) honours `zoom` in print.
 *
 * @param {HTMLElement} node   the rendered CalendarDocument element
 * @param {string}      title  document title (used as the PDF filename hint)
 */
export function printCalendarNode(node, title = 'Academic Calendar') {
  if (!node) return;

  const headStyles = Array.from(
    document.querySelectorAll('link[rel="stylesheet"], style')
  ).map(el => el.outerHTML).join('\n');

  const win = window.open('', '_blank', 'width=1000,height=800');
  if (!win) {
    alert('Please allow pop-ups to download / print the calendar.');
    return;
  }

  win.document.open();
  win.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  ${headStyles}
  <style>
    /* Upright portrait A4 with slim margins to maximise usable space */
    @page { size: A4 portrait; margin: 8mm; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

    #print-root { transform-origin: top left; }

    /* Drop card chrome so nothing eats vertical space */
    .ac-doc { box-shadow: none !important; border: none !important; border-radius: 0 !important;
              max-width: none !important; padding: 0 !important; margin: 0 !important; }
    .ac-grid-scroll { overflow: visible !important; border: none !important; }
    .ac-table { min-width: 0 !important; }

    /* Compact rows for print so the whole calendar is short enough to fit */
    .ac-cell, .ac-week-label { height: 20px !important; line-height: 1.05 !important;
              padding-top: 1px !important; padding-bottom: 1px !important; font-size: 11px !important; }
    .ac-th { padding-top: 4px !important; padding-bottom: 4px !important; font-size: 10px !important; }
    .ac-month-cell, .ac-holidays-cell { padding-top: 2px !important; padding-bottom: 2px !important;
              font-size: 10px !important; }
    .ac-th-holidays, .ac-holidays-cell { min-width: 110px !important; }

    /* Keep the table from being fractured across pages */
    .ac-doc-grid, .ac-table, .ac-table tr { break-inside: avoid; page-break-inside: avoid; }
  </style>
</head>
<body>
  <div id="print-root">${node.outerHTML}</div>
</body>
</html>`);
  win.document.close();

  const fitAndPrint = () => {
    try {
      const root = win.document.getElementById('print-root');
      if (root) {
        // A4 portrait printable area at 96dpi, minus 8mm margins each side.
        const PAGE_W = 750;  // (210mm − 16mm) ≈ 194mm
        const PAGE_H = 1085; // (297mm − 16mm) ≈ 281mm
        const w = root.scrollWidth  || root.getBoundingClientRect().width;
        const h = root.scrollHeight || root.getBoundingClientRect().height;
        // Fit BOTH dimensions onto one page; never enlarge beyond 100%.
        const scale = Math.min(PAGE_W / w, PAGE_H / h, 1);
        if (scale < 1) {
          // `zoom` affects layout → page breaks use the scaled size → one page.
          root.style.zoom = String(scale);
        }
      }
    } catch { /* if measuring fails, print unscaled */ }

    win.focus();
    win.print();
    setTimeout(() => { try { win.close(); } catch { /* ignore */ } }, 300);
  };

  if (win.document.readyState === 'complete') {
    setTimeout(fitAndPrint, 400);
  } else {
    win.onload = () => setTimeout(fitAndPrint, 400);
    setTimeout(fitAndPrint, 900); // fallback if onload never fires
  }
}
