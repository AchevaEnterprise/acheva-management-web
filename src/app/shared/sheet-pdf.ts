import { ISheet, ISignature } from '../core/models/sheet.model';
import { formatDate, gpa, pageCode, totalsCells } from '../core/sheet-format';

/**
 * The DVC sheet as a pdfmake document — the user's paper, A4 landscape
 * (2026-11-13). Pure: the caller hands in `codeImage`, which draws a course
 * code standing on end (pdfmake cannot rotate text), so this stays free of
 * the browser and is tested directly.
 *
 * Hand-kept copy in the staff portal; change one, change both.
 */
export interface SheetPdfInput {
  readonly sheet: ISheet;
  readonly pageNumber?: number | null;
  readonly signOff?: { hod: ISignature | null; dean: ISignature | null; dvc: ISignature | null } | null;
  readonly generatedAt?: Date;
}

export interface SheetPdfDocument {
  content: unknown[];
  [key: string]: unknown;
}

/** A PNG data URI of `code` written bottom-to-top. */
export type CodeImage = (code: string) => string;

const PAGE_WIDTH = 842 - 2 * 24;
const CODE_HEIGHT = 46;
const DOTS = '…………………………………';

type Cell = Record<string, unknown> | string;

const th = (text: string, extra: Record<string, unknown> = {}): Cell => ({ text, style: 'th', ...extra });
const td = (text: unknown, extra: Record<string, unknown> = {}): Cell => ({
  text: text === null || text === undefined ? '' : String(text),
  style: 'td',
  ...extra,
});

/** Course columns narrow as they multiply, so the sheet always fits the page. */
export function courseWidth(columns: number): number {
  const fixed = 18 + 62 + 112 + 3 * (28 + 24 + 28) + 32;
  if (columns === 0) return 15;
  return Math.max(9, Math.min(24, Math.floor((PAGE_WIDTH - fixed - 2 * columns) / columns)));
}

function semesterTable(sheet: ISheet, codeImage: CodeImage) {
  const columns = sheet.columns;
  const n = Math.max(columns.length, 1);
  const width = courseWidth(columns.length);
  // Labels sit at the foot of their spanned cells, as on the paper.
  const low = (rows: number) => ({ margin: [0, rows === 3 ? CODE_HEIGHT + 4 : CODE_HEIGHT - 8, 0, 0] });

  const first: Cell[] = [
    th('SN', { rowSpan: 3, ...low(3) }),
    th('REG. NO.', { rowSpan: 3, ...low(3) }),
    th('NAMES OF STUDENTS', { rowSpan: 3, ...low(3) }),
    th('COURSES AND UNITS OFFERED', { colSpan: n }),
    ...Array.from({ length: n - 1 }, () => ''),
  ];
  for (const label of ['CURRENT', 'PREVIOUS', 'CUMMULATIVE']) {
    first.push(th(label, { colSpan: 3, rowSpan: 2, ...low(2) }), '', '');
  }
  first.push(th('REMARK', { rowSpan: 2, ...low(2) }));

  const second: Cell[] = ['', '', ''];
  if (columns.length) {
    for (const column of columns) {
      second.push({ image: codeImage(column.code), width: 8, height: CODE_HEIGHT, alignment: 'center' });
    }
  } else {
    second.push('');
  }
  second.push(...Array.from({ length: 10 }, () => ''));

  const third: Cell[] = ['', '', ''];
  if (columns.length) for (const column of columns) third.push(th(column.units === null ? '' : String(column.units)));
  else third.push('');
  for (let block = 0; block < 3; block += 1) third.push(th('TGP'), th('TNU'), th('GPA'));
  third.push('');

  const body: Cell[][] = [first, second, third];
  for (const row of sheet.rows) {
    body.push([
      td(row.sn),
      td(row.registrationNumber),
      td(row.name, { alignment: 'left' }),
      ...(columns.length ? columns.map((column) => td(row.grades[column.courseId] ?? '')) : [td('')]),
      ...totalsCells(row.current).map((cell) => td(cell)),
      ...totalsCells(row.previous).map((cell) => td(cell)),
      ...totalsCells(row.cumulative).map((cell) => td(cell)),
      td(row.remark),
    ]);
  }

  return {
    table: {
      headerRows: 3,
      dontBreakRows: true,
      widths: [18, 62, '*', ...Array.from({ length: n }, () => width), ...[28, 24, 28, 28, 24, 28, 28, 24, 28], 32],
      body,
    },
    layout: gridLayout,
  };
}

function degreeTable(sheet: ISheet) {
  const years = sheet.degreeColumns;
  const first: Cell[] = [th('', { colSpan: 3 }), '', ''];
  for (const column of years) first.push(th(`${column.label}\n${column.session}`, { colSpan: 2 }), '');
  first.push(th('TOTAL', { colSpan: 2, margin: [0, 8, 0, 0] }), '', th('CGPA', { rowSpan: 2, margin: [0, 8, 0, 0] }), th('CLASS OF DEGREE', { rowSpan: 2, margin: [0, 8, 0, 0] }));

  const second: Cell[] = [th('S/N'), th('REG. NO.'), th('NAMES OF STUDENT')];
  for (let i = 0; i < years.length; i += 1) second.push(th('TGP'), th('TNU'));
  second.push(th('TGP'), th('TNU'), '', '');

  const body: Cell[][] = [first, second];
  for (const row of sheet.degreeRows) {
    const cells: Cell[] = [td(row.sn), td(row.registrationNumber), td(row.fullName, { alignment: 'left' })];
    for (const column of years) {
      const year = row.years[column.session];
      cells.push(td(year?.tgp ?? ''), td(year?.tnu ?? ''));
    }
    cells.push(td(row.total.tgp), td(row.total.tnu), td(gpa(row.cgpa)), td(row.classOfDegree, { alignment: 'left' }));
    body.push(cells);
  }
  const yearWidth = Math.max(18, Math.min(26, Math.floor((PAGE_WIDTH - (22 + 62 + 150 + 26 + 26 + 30 + 104)) / Math.max(years.length * 2, 1)) - 2));
  return {
    table: {
      headerRows: 2,
      dontBreakRows: true,
      widths: [22, 62, '*', ...Array.from({ length: years.length * 2 }, () => yearWidth), 26, 26, 30, 104],
      body,
    },
    layout: gridLayout,
  };
}

/** Heavy black rules, as the paper prints them. */
const gridLayout = {
  hLineWidth: () => 1,
  vLineWidth: () => 1,
  hLineColor: () => '#000000',
  vLineColor: () => '#000000',
  paddingLeft: () => 2,
  paddingRight: () => 2,
  paddingTop: () => 2,
  paddingBottom: () => 2,
};

const signed = (signature: ISignature | null | undefined) =>
  signature ? { name: signature.name, date: formatDate(signature.at) } : { name: DOTS, date: DOTS };

export function buildSheetPdf(input: SheetPdfInput, codeImage: CodeImage): SheetPdfDocument {
  const { sheet } = input;
  const header = sheet.header;
  const degree = sheet.degreeRows.length > 0 || header.title === 'DEGREE RESULT';
  const hod = signed(input.signOff?.hod);
  const dean = signed(input.signOff?.dean);
  const dvc = input.signOff?.dvc ? signed(input.signOff.dvc) : null;
  const code = pageCode(input.pageNumber);
  const generated = formatDate(input.generatedAt ?? new Date());

  const content: unknown[] = [
    { text: header.institution, style: 'institution' },
    { text: header.faculty, style: 'faculty' },
    { text: header.title, style: 'title' },
    {
      columns: [
        { stack: [`DEPT: ${header.department}`, `YEAR: ${header.year}`], width: '*' },
        { stack: [`SEMESTER: ${header.semester}`, `SESSION: ${header.session}`], width: 'auto', alignment: 'right' },
      ],
      style: 'meta',
    },
    degree ? degreeTable(sheet) : semesterTable(sheet, codeImage),
  ];

  if (sheet.reason) content.push({ text: `REASON: ${sheet.reason}`, style: 'reason' });

  content.push({
    columns: [
      { text: [`HOD: `, { text: hod.name, bold: false }, `   DATE: `, { text: hod.date, bold: false }], width: '*' },
      {
        text: [`DEAN, ${header.facultyCode}: `, { text: dean.name, bold: false }, `   DATE: `, { text: dean.date, bold: false }],
        width: 'auto',
      },
    ],
    style: 'signs',
  });
  if (dvc) {
    content.push({
      text: [`APPROVED BY THE DVC: `, { text: dvc.name, bold: false }, `   DATE: `, { text: dvc.date, bold: false }],
      style: 'signs',
      margin: [0, 10, 0, 0],
    });
  }

  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [24, 34, 24, 30],
    info: { title: `${header.department} ${header.title} ${header.year} ${header.semester} ${header.session}` },
    header: () => (code ? { text: code, alignment: 'right', margin: [24, 14, 30, 0], fontSize: 10 } : ''),
    footer: (page: number, pages: number) => ({
      columns: [
        { text: `Prepared on Acheva · ${generated}`, fontSize: 7, color: '#555555' },
        { text: pages > 1 ? `Page ${page} of ${pages}` : '', fontSize: 7, color: '#555555', alignment: 'right' },
      ],
      margin: [24, 8, 24, 0],
    }),
    defaultStyle: { font: 'Roboto', fontSize: 8 },
    styles: {
      institution: { fontSize: 13, bold: true, alignment: 'center' },
      faculty: { fontSize: 12, bold: true, alignment: 'center', margin: [0, 2, 0, 14] },
      title: { fontSize: 11, bold: true, alignment: 'center', margin: [0, 0, 0, 6] },
      meta: { fontSize: 9, margin: [0, 0, 0, 2] },
      th: { fontSize: 7.5, bold: true, alignment: 'center' },
      td: { fontSize: 8, alignment: 'center' },
      reason: { fontSize: 9, margin: [60, 14, 0, 0] },
      signs: { fontSize: 9, bold: true, margin: [0, 26, 0, 0] },
    },
    content,
  };
}

/** "MATHEMATICS SEMESTER RESULT ONE HARMATTAN 2025-2026" — safe as a file name. */
export function sheetFileName(sheet: ISheet, pageNumber?: number | null): string {
  const h = sheet.header;
  return [pageCode(pageNumber), h.department, h.title, `YEAR ${h.year}`, h.semester, h.session]
    .filter(Boolean)
    .join(' ')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}
