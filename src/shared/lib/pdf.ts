// jspdf / jspdf-autotable / html2canvas are all dynamically imported inside
// each function below (not at module scope) — together they're a few
// hundred KB, and most page loads never touch a PDF export button. This
// keeps that weight out of the initial bundle for everyone else.

/** A simple tabular report → one PDF page (paginated automatically by
 * jspdf-autotable if the table is long). Used by the Reports page. */
export async function exportTableToPdf(
  filename: string,
  title: string,
  subtitle: string,
  head: string[],
  rows: (string | number)[][],
) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(16)
  doc.text(title, 14, 16)
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(subtitle, 14, 23)
  autoTable(doc, {
    head: [head],
    body: rows.map((row) => row.map(String)),
    startY: 28,
    headStyles: { fillColor: [32, 30, 29] },
    styles: { fontSize: 9 },
  })
  doc.save(filename)
}

/** Captures a DOM node (the whole dashboard) as an image and lays it into a
 * PDF, splitting across pages if it's taller than one page. Good enough for
 * "export what's on screen" — not a pixel-perfect print layout. */
export async function exportElementToPdf(element: HTMLElement, filename: string, title: string) {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ])
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#f3f2f2',
    useCORS: true,
  })
  const imgData = canvas.toDataURL('image/png')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 24

  doc.setFontSize(14)
  doc.text(title, margin, margin)
  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(new Date().toLocaleString(), margin, margin + 14)

  // Standard html2canvas+jsPDF pagination trick: draw the same full-height
  // image on every page, shifted progressively further up (negative y) so
  // each page's fixed viewport reveals the next slice — the page bounds do
  // the cropping, there's no need to slice the canvas itself.
  const usableWidth = pageWidth - margin * 2
  const imgHeight = (canvas.height * usableWidth) / canvas.width
  const headerHeight = 40
  const firstPageUsable = pageHeight - margin * 2 - headerHeight
  const laterPageUsable = pageHeight - margin * 2

  doc.addImage(imgData, 'PNG', margin, margin + headerHeight, usableWidth, imgHeight)
  let shown = firstPageUsable
  let pages = 1
  while (shown < imgHeight && pages < 10) {
    doc.addPage()
    doc.addImage(imgData, 'PNG', margin, margin - shown + headerHeight, usableWidth, imgHeight)
    shown += laterPageUsable
    pages += 1
  }

  doc.save(filename)
}
