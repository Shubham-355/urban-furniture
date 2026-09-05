import PDFDocument from 'pdfkit';
import { formatINR, type Numeric } from './money';

/**
 * Server side PDF rendering for invoices, bills and reports.
 *
 * The built in Helvetica face has no rupee glyph, which is why amounts print as
 * `Rs. 1,00,000.00` - the same notation the spec asks the UI to use.
 */

const PAGE_MARGIN = 40;
const INK = '#111827';
const MUTED = '#6b7280';
const RULE = '#d1d5db';
const ACCENT = '#7c3aed';

export type Doc = PDFKit.PDFDocument;

export function renderPdf(build: (doc: Doc) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      build(doc);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export function header(doc: Doc, title: string, subtitle?: string): void {
  doc.fillColor(ACCENT).fontSize(18).font('Helvetica-Bold').text('Urban Furniture', PAGE_MARGIN, PAGE_MARGIN);
  doc.fillColor(MUTED).fontSize(9).font('Helvetica').text('Accounting System');
  doc.moveDown(0.8);
  doc.fillColor(INK).fontSize(15).font('Helvetica-Bold').text(title);
  if (subtitle) {
    doc.fillColor(MUTED).fontSize(10).font('Helvetica').text(subtitle);
  }
  doc.moveDown(0.6);
  rule(doc);
  doc.moveDown(0.6);
  doc.fillColor(INK);
}

export function rule(doc: Doc): void {
  const y = doc.y;
  doc
    .strokeColor(RULE)
    .lineWidth(1)
    .moveTo(PAGE_MARGIN, y)
    .lineTo(doc.page.width - PAGE_MARGIN, y)
    .stroke();
}

export function keyValues(doc: Doc, pairs: [string, string][]): void {
  const columnWidth = (doc.page.width - PAGE_MARGIN * 2) / 2;
  const startY = doc.y;
  pairs.forEach((pair, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = PAGE_MARGIN + column * columnWidth;
    const y = startY + row * 16;
    doc.fontSize(9).fillColor(MUTED).font('Helvetica').text(`${pair[0]}`, x, y, { width: 110 });
    doc.fontSize(9).fillColor(INK).font('Helvetica-Bold').text(pair[1], x + 110, y, {
      width: columnWidth - 115,
    });
  });
  doc.y = startY + Math.ceil(pairs.length / 2) * 16 + 8;
  doc.x = PAGE_MARGIN;
}

export interface Column {
  label: string;
  width: number;
  align?: 'left' | 'right';
  /** Render the cell as an INR amount. */
  money?: boolean;
}

export function table(doc: Doc, columns: Column[], rows: (string | number)[][]): void {
  const rowHeight = 18;
  const drawRow = (cells: (string | number)[], bold: boolean) => {
    if (doc.y + rowHeight > doc.page.height - PAGE_MARGIN) {
      doc.addPage();
    }
    let x = PAGE_MARGIN;
    const y = doc.y;
    columns.forEach((column, index) => {
      const raw = cells[index];
      const value = column.money && raw !== '' ? formatINR(raw as Numeric) : String(raw ?? '');
      doc
        .fontSize(9)
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor(INK)
        .text(value, x, y + 5, {
          width: column.width - 8,
          align: column.align ?? (column.money ? 'right' : 'left'),
          lineBreak: false,
          ellipsis: true,
        });
      x += column.width;
    });
    doc.y = y + rowHeight;
    doc.x = PAGE_MARGIN;
  };

  doc.fillColor(MUTED);
  drawRow(
    columns.map((c) => c.label),
    true,
  );
  rule(doc);
  doc.y += 2;
  rows.forEach((row) => drawRow(row, false));
  rule(doc);
  doc.y += 4;
}

export function totalsBlock(doc: Doc, pairs: [string, Numeric][], emphasiseLast = true): void {
  const width = 220;
  const x = doc.page.width - PAGE_MARGIN - width;
  pairs.forEach((pair, index) => {
    const bold = emphasiseLast && index === pairs.length - 1;
    const y = doc.y;
    doc
      .fontSize(bold ? 11 : 9)
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fillColor(bold ? INK : MUTED)
      .text(pair[0], x, y, { width: width / 2 });
    doc
      .fontSize(bold ? 11 : 9)
      .font('Helvetica-Bold')
      .fillColor(INK)
      .text(formatINR(pair[1]), x + width / 2, y, { width: width / 2, align: 'right' });
    doc.y = y + (bold ? 20 : 16);
  });
  doc.x = PAGE_MARGIN;
}

export function footerNote(doc: Doc, note: string): void {
  doc.moveDown(1.5);
  doc.fontSize(8).fillColor(MUTED).font('Helvetica').text(note, PAGE_MARGIN, doc.y, {
    width: doc.page.width - PAGE_MARGIN * 2,
  });
}
