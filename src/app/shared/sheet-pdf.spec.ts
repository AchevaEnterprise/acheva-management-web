import { ISheet } from '../core/models/sheet.model';
import { buildSheetPdf, courseWidth, sheetFileName } from './sheet-pdf';

const header = {
  institution: 'FEDERAL UNIVERSITY OF TECHNOLOGY, OWERRI',
  faculty: 'SCHOOL OF PHYSICAL SCIENCES',
  facultyCode: 'SOPS',
  department: 'MATHEMATICS',
  departmentCode: 'MTH',
  title: 'OMITTED RESULT',
  year: 'ONE',
  semester: 'HARMATTAN',
  session: '2016/2017',
};

const sheet: ISheet = {
  header,
  columns: [
    { courseId: 'c1', code: 'MTH 101', units: 4 },
    { courseId: 'c2', code: 'GST 103', units: 1 },
  ],
  rows: [
    {
      sn: 1,
      studentId: 's1',
      registrationNumber: '20161131315',
      name: 'IFEANYI U. C.',
      grades: { c1: 'D', c2: 'F' },
      current: { tgp: 8, tnu: 5, gpa: 1.6 },
      previous: null,
      cumulative: { tgp: 8, tnu: 5, gpa: 1.6 },
      remark: '1F',
    },
  ],
  degreeColumns: [],
  degreeRows: [],
  reason: 'THE STUDENT DID NOT OBTAIN REG. NO ON TIME',
};

const codes: string[] = [];
const codeImage = (code: string) => {
  codes.push(code);
  return `data:image/png;base64,${code}`;
};

/** Every string in a pdfmake fragment, flattened. */
function texts(node: unknown): string[] {
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(texts);
  if (node && typeof node === 'object') return Object.values(node as Record<string, unknown>).flatMap(texts);
  return [];
}

describe('buildSheetPdf', () => {
  beforeEach(() => (codes.length = 0));

  it('lays the sheet out as the paper does', () => {
    const doc = buildSheetPdf(
      { sheet, pageNumber: 1, signOff: { hod: { name: 'HOD MTH', at: '2026-11-13T10:00:00' }, dean: null, dvc: null } },
      codeImage,
    );
    const all = texts(doc.content);
    for (const expected of [
      'FEDERAL UNIVERSITY OF TECHNOLOGY, OWERRI',
      'SCHOOL OF PHYSICAL SCIENCES',
      'OMITTED RESULT',
      'DEPT: MATHEMATICS',
      'YEAR: ONE',
      'SEMESTER: HARMATTAN',
      'SESSION: 2016/2017',
      'COURSES AND UNITS OFFERED',
      'CUMMULATIVE',
      'REASON: THE STUDENT DID NOT OBTAIN REG. NO ON TIME',
      'HOD MTH',
      '13/11/2026',
      'DEAN, SOPS: ',
    ]) {
      expect(all).toContain(expected);
    }
    expect(doc['pageOrientation']).toBe('landscape');
    expect(codes).toEqual(['MTH 101', 'GST 103']);
  });

  it('keeps every row the width of the header', () => {
    const doc = buildSheetPdf({ sheet }, codeImage);
    const table = (doc.content[4] as { table: { body: unknown[][]; widths: unknown[] } }).table;
    for (const row of table.body) expect(row.length).toBe(table.widths.length);
    // A first semester leaves PREVIOUS blank, as IG 1 does.
    const cells = table.body[3].map((cell) => (typeof cell === 'string' ? cell : (cell as { text: string }).text));
    expect(cells.slice(0, 12)).toEqual(['1', '20161131315', 'IFEANYI U. C.', 'D', 'F', '8', '5', '1.60', '', '', '', '8']);
  });

  it('leaves the dotted line where nobody has signed, and adds the DVC once they have', () => {
    const unsigned = texts(buildSheetPdf({ sheet }, codeImage).content);
    expect(unsigned.some((text) => text.startsWith('…'))).toBeTrue();
    expect(unsigned).not.toContain('APPROVED BY THE DVC: ');
    const approved = texts(
      buildSheetPdf(
        { sheet, signOff: { hod: null, dean: null, dvc: { name: 'Prof. Ada Obi', at: '2026-11-14T09:00:00' } } },
        codeImage,
      ).content,
    );
    expect(approved).toContain('APPROVED BY THE DVC: ');
    expect(approved).toContain('Prof. Ada Obi');
  });

  it('prints a Degree Result with each year\'s TGP and TNU and the class', () => {
    const degree: ISheet = {
      ...sheet,
      header: { ...header, title: 'DEGREE RESULT', year: 'FIVE EXTRA', semester: 'RAIN', session: '2023/2024' },
      rows: [],
      columns: [],
      reason: null,
      degreeColumns: [
        { session: '2016/2017', label: '1ST YEAR' },
        { session: '2022/2023', label: '5TH EXTRA YEAR' },
      ],
      degreeRows: [
        {
          sn: 1,
          studentId: 's1',
          registrationNumber: '20161131315',
          fullName: 'IFEANYI UGOCHUKWU CHRISTIAN',
          years: { '2016/2017': { tgp: 103, tnu: 41 }, '2022/2023': null },
          total: { tgp: 103, tnu: 41 },
          cgpa: 2.51,
          classOfDegree: '2ND CLASS HONOURS (LOWER DIVISION)',
        },
      ],
    };
    const doc = buildSheetPdf({ sheet: degree }, codeImage);
    const table = (doc.content[4] as { table: { body: unknown[][]; widths: unknown[] } }).table;
    for (const row of table.body) expect(row.length).toBe(table.widths.length);
    const all = texts(doc.content);
    expect(all).toContain('1ST YEAR\n2016/2017');
    expect(all).toContain('CLASS OF DEGREE');
    expect(all).toContain('2.51');
    expect(all).toContain('2ND CLASS HONOURS (LOWER DIVISION)');
  });

  it('narrows course columns as they multiply', () => {
    expect(courseWidth(9)).toBe(24);
    expect(courseWidth(30)).toBeLessThan(24);
    expect(courseWidth(80)).toBe(9);
  });

  it('names the file after the sheet', () => {
    expect(sheetFileName(sheet, 2)).toBe('IG 2 MATHEMATICS OMITTED RESULT YEAR ONE HARMATTAN 2016-2017');
  });
});
