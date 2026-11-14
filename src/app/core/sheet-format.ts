import { ISheetHeader, ISheetSummary, ISheetTotals, SheetKind, SheetStatus } from './models/sheet.model';

/**
 * Words for the DVC sheets — shared by the list, the sheet view and the PDF.
 * A hand-kept copy lives in the staff portal; change one, change both.
 */

const STATUS_LABELS: Record<SheetStatus, string> = {
  PENDING_DEAN: 'With the Dean',
  RETURNED_TO_HOD: 'Returned to the HOD',
  PENDING_DVC: 'With the DVC',
  RETURNED_TO_DEAN: 'Returned to the Dean',
  APPROVED: 'Approved',
  RELEASED: 'Approved · sent out',
  WITHDRAWN: 'Withdrawn',
};

export function statusLabel(status: SheetStatus): string {
  return STATUS_LABELS[status] ?? status;
}

/** Solid brand blue when it waits on the viewer, a tint otherwise. */
export function statusTone(status: SheetStatus, waitingOnMe: readonly SheetStatus[]): 'brand' | 'tint' | 'outline' {
  if (waitingOnMe.includes(status)) return 'brand';
  if (status === 'APPROVED' || status === 'RELEASED') return 'tint';
  return 'outline';
}

const KIND_LABELS: Record<SheetKind, string> = {
  SEMESTER: 'Semester Result',
  OMITTED: 'Omitted Result',
  DEGREE: 'Degree Result',
};

export function kindLabel(kind: SheetKind): string {
  return KIND_LABELS[kind] ?? kind;
}

/** "Year ONE · Harmattan 2025/2026" — or the session alone for a Degree Result. */
export function whenLabel(sheet: Pick<ISheetSummary, 'kind' | 'year' | 'semesterLabel' | 'session'>): string {
  const semester = sheet.semesterLabel ? titleCase(sheet.semesterLabel) : '';
  return [`Year ${sheet.year}`, `${semester} ${sheet.session}`.trim()].filter(Boolean).join(' · ');
}

/** "MATHEMATICS · SEMESTER RESULT · YEAR ONE · HARMATTAN 2025/2026" — as the emails name it. */
export function sheetLine(header: Pick<ISheetHeader, 'department' | 'title' | 'year' | 'semester' | 'session'>): string {
  return [header.department, header.title, `YEAR ${header.year}`, `${header.semester} ${header.session}`].join(' · ');
}

export function titleCase(text: string): string {
  return String(text ?? '')
    .toLowerCase()
    .replace(/(^|[\s(-])([a-z])/g, (_match, lead: string, letter: string) => lead + letter.toUpperCase());
}

/** "13/11/2026" — day first, never the runtime's locale (see the messaging notes). */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** "13/11/2026, 14:05" */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${formatDate(date)}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A GPA always prints with two places: 2.5 → "2.50". */
export function gpa(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '';
}

/** The three cells of a CURRENT / PREVIOUS / CUMMULATIVE block; blank when absent. */
export function totalsCells(totals: ISheetTotals | null): [string, string, string] {
  if (!totals) return ['', '', ''];
  return [String(totals.tgp), String(totals.tnu), gpa(totals.gpa)];
}

/** "IG 3" — the sheet's place in what the Dean sent together. */
export function pageCode(pageNumber: number | null | undefined): string {
  return pageNumber ? `IG ${pageNumber}` : '';
}

const ACTIONS: Record<string, string> = {
  SENT: 'Sent to the Dean',
  RESENT: 'Sent to the Dean again',
  RETURNED: 'Returned',
  SENT_TO_DVC: 'Sent to the DVC',
  APPROVED: 'Approved',
  RELEASED: 'Sent out to the HOD and Course Advisors',
  FILED: 'Filed by Exams & Records',
  WITHDRAWN: 'Withdrawn by the HOD',
};

export function actionLabel(action: string): string {
  return ACTIONS[action] ?? action;
}
