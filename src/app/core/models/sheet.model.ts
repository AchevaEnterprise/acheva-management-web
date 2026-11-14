/**
 * The DVC sheets as the API sends them (`acheva-nestjs/src/result-submissions`).
 * Every figure is computed by the server and frozen when the HOD sends the
 * sheet; this app only lays them out. A hand-kept copy lives in the staff
 * portal — change one, change both.
 */
export type SheetKind = 'SEMESTER' | 'OMITTED' | 'DEGREE';

export type SheetStatus =
  | 'PENDING_DEAN'
  | 'RETURNED_TO_HOD'
  | 'PENDING_DVC'
  | 'RETURNED_TO_DEAN'
  | 'APPROVED'
  | 'RELEASED'
  | 'WITHDRAWN';

export interface ISheetTotals {
  tgp: number;
  tnu: number;
  gpa: number;
}

export interface ISheetColumn {
  courseId: string;
  code: string;
  units: number | null;
}

export interface ISheetRow {
  sn: number;
  studentId: string;
  registrationNumber: string;
  name: string;
  grades: Record<string, string | null>;
  current: ISheetTotals;
  previous: ISheetTotals | null;
  cumulative: ISheetTotals;
  remark: string;
}

export interface IDegreeColumn {
  session: string;
  label: string;
}

export interface IDegreeRow {
  sn: number;
  studentId: string;
  registrationNumber: string;
  fullName: string;
  years: Record<string, { tgp: number; tnu: number } | null>;
  total: { tgp: number; tnu: number };
  cgpa: number;
  classOfDegree: string;
}

export interface ISheetHeader {
  institution: string;
  faculty: string;
  facultyCode: string;
  department: string;
  departmentCode: string;
  title: string;
  year: string;
  semester: string;
  session: string;
}

export interface ISheet {
  header: ISheetHeader;
  columns: ISheetColumn[];
  rows: ISheetRow[];
  degreeColumns: IDegreeColumn[];
  degreeRows: IDegreeRow[];
  reason: string | null;
}

export interface ISignature {
  name: string;
  at: string;
}

export interface IReturnNote {
  desk: 'HOD' | 'DEAN' | 'DVC' | 'EXAMS_RECORDS';
  name: string;
  reason: string;
  at: string;
}

export interface ISheetSummary {
  _id: string;
  kind: SheetKind;
  sequence: number;
  title: string;
  level: string;
  year: string;
  session: string;
  semester: string;
  semesterLabel: string;
  department: { _id: string; name: string; code: string };
  faculty: { _id: string; name: string; code: string };
  status: SheetStatus;
  studentCount: number;
  pageNumber: number | null;
  dispatchId: string | null;
  sentToDeanAt: string | null;
  sentToDvcAt: string | null;
  approvedAt: string | null;
  releasedAt: string | null;
  filedAt: string | null;
  filedByName: string | null;
  lastReturn: IReturnNote | null;
  updatedAt: string;
}

export interface ISheetEvent {
  action: 'SENT' | 'RESENT' | 'RETURNED' | 'SENT_TO_DVC' | 'APPROVED' | 'RELEASED' | 'FILED' | 'WITHDRAWN';
  desk: 'HOD' | 'DEAN' | 'DVC' | 'EXAMS_RECORDS';
  name: string;
  at: string;
  comment: string | null;
}

export interface ISheetDetail extends ISheetSummary {
  sheet: ISheet;
  fileNote: string | null;
  history: ISheetEvent[];
  signOff: { hod: ISignature | null; dean: ISignature | null; dvc: ISignature | null };
  /** What this viewer may do now: DVC_APPROVE · DVC_RETURN · RECORDS_FILE. */
  actions: string[];
}

export type ManagementBox = 'to-review' | 'returned' | 'approved' | 'to-file' | 'filed' | 'all';

export interface ISheetList {
  desk: 'DVC' | 'EXAMS_RECORDS';
  counts: Partial<Record<ManagementBox, number>>;
  page: number;
  limit: number;
  total: number;
  sheets: ISheetSummary[];
}

export interface ISheetFilters {
  faculties: { _id: string; name: string; code: string }[];
  departments: { _id: string; name: string; code: string; faculty: string }[];
  sessions: string[];
}
