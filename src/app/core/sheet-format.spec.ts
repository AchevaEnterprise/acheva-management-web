import {
  formatDate,
  gpa,
  pageCode,
  sheetLine,
  statusLabel,
  statusTone,
  titleCase,
  totalsCells,
  whenLabel,
} from './sheet-format';

describe('sheet-format', () => {
  it('names each stage of the chain', () => {
    expect(statusLabel('PENDING_DVC')).toBe('With the DVC');
    expect(statusLabel('RETURNED_TO_DEAN')).toBe('Returned to the Dean');
    expect(statusLabel('RELEASED')).toBe('Approved · sent out');
  });

  it('marks in solid blue what waits on the viewer', () => {
    expect(statusTone('PENDING_DVC', ['PENDING_DVC'])).toBe('brand');
    expect(statusTone('APPROVED', ['PENDING_DVC'])).toBe('tint');
    expect(statusTone('RETURNED_TO_DEAN', ['PENDING_DVC'])).toBe('outline');
  });

  it('dates day first, whatever the machine\'s locale', () => {
    expect(formatDate('2026-11-03T10:00:00')).toBe('03/11/2026');
    expect(formatDate(null)).toBe('');
    expect(formatDate('not a date')).toBe('');
  });

  it('prints a GPA with two places and blanks an absent block', () => {
    expect(gpa(2.5)).toBe('2.50');
    expect(totalsCells({ tgp: 54, tnu: 21, gpa: 2.57 })).toEqual(['54', '21', '2.57']);
    expect(totalsCells(null)).toEqual(['', '', '']);
  });

  it('names a sheet the way the paper does', () => {
    expect(
      sheetLine({ department: 'MATHEMATICS', title: 'OMITTED RESULT', year: 'ONE', semester: 'HARMATTAN', session: '2016/2017' }),
    ).toBe('MATHEMATICS · OMITTED RESULT · YEAR ONE · HARMATTAN 2016/2017');
    expect(whenLabel({ kind: 'SEMESTER', year: 'FIVE EXTRA', semesterLabel: 'RAIN', session: '2023/2024' })).toBe(
      'Year FIVE EXTRA · Rain 2023/2024',
    );
    expect(pageCode(3)).toBe('IG 3');
    expect(pageCode(null)).toBe('');
    expect(titleCase('SCHOOL OF PHYSICAL SCIENCES')).toBe('School Of Physical Sciences');
  });
});
