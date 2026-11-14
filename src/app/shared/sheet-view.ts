import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ISheet, ISignature } from '../core/models/sheet.model';
import { formatDate, gpa, pageCode, totalsCells } from '../core/sheet-format';

/**
 * The sheet as the user's paper lays it out (2026-11-13): the FUTO header,
 * DEPT / YEAR on the left and SEMESTER / SESSION on the right, course codes
 * standing on end above their units, then CURRENT / PREVIOUS / CUMMULATIVE
 * and REMARK — or, for a Degree Result, each year's TGP and TNU, the total,
 * CGPA and class. The signature lines carry who signed, and when.
 *
 * Hand-kept copy in the staff portal; change one, change both.
 */
@Component({
  selector: 'app-sheet-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = sheet();
    <article class="paper" [attr.aria-label]="s.header.title">
      @if (code()) {
        <p class="paper__ig">{{ code() }}</p>
      }
      <p class="paper__inst">{{ s.header.institution }}</p>
      <p class="paper__fac">{{ s.header.faculty }}</p>
      <p class="paper__title">{{ s.header.title }}</p>
      <div class="paper__meta">
        <div>
          <p>DEPT: {{ s.header.department }}</p>
          <p>YEAR: {{ s.header.year }}</p>
        </div>
        <div>
          <p>SEMESTER: {{ s.header.semester }}</p>
          <p>SESSION: {{ s.header.session }}</p>
        </div>
      </div>

      <div class="paper__scroll" tabindex="0">
        @if (isDegree()) {
          <table class="sheet-table">
            <thead>
              <tr>
                <th colspan="3"></th>
                @for (column of s.degreeColumns; track column.session) {
                  <th colspan="2">{{ column.label }}<br />{{ column.session }}</th>
                }
                <th colspan="2" class="sheet-table__bottom">TOTAL</th>
                <th rowspan="2" class="sheet-table__bottom">CGPA</th>
                <th rowspan="2" class="sheet-table__bottom">CLASS OF DEGREE</th>
              </tr>
              <tr>
                <th>S/N</th>
                <th>REG. NO.</th>
                <th class="sheet-table__name">NAMES OF STUDENT</th>
                @for (column of s.degreeColumns; track column.session) {
                  <th>TGP</th>
                  <th>TNU</th>
                }
                <th>TGP</th>
                <th>TNU</th>
              </tr>
            </thead>
            <tbody>
              @for (row of s.degreeRows; track row.studentId) {
                <tr>
                  <td>{{ row.sn }}</td>
                  <td>{{ row.registrationNumber }}</td>
                  <td class="sheet-table__name">{{ row.fullName }}</td>
                  @for (column of s.degreeColumns; track column.session) {
                    <td>{{ row.years[column.session]?.tgp ?? '' }}</td>
                    <td>{{ row.years[column.session]?.tnu ?? '' }}</td>
                  }
                  <td>{{ row.total.tgp }}</td>
                  <td>{{ row.total.tnu }}</td>
                  <td>{{ gpa(row.cgpa) }}</td>
                  <td class="sheet-table__name">{{ row.classOfDegree }}</td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <table class="sheet-table">
            <thead>
              <tr>
                <th rowspan="3" class="sheet-table__bottom">SN</th>
                <th rowspan="3" class="sheet-table__bottom">REG. NO.</th>
                <th rowspan="3" class="sheet-table__bottom sheet-table__name">NAMES OF STUDENTS</th>
                <th [attr.colspan]="s.columns.length || 1">COURSES AND UNITS OFFERED</th>
                <th rowspan="2" colspan="3" class="sheet-table__bottom">CURRENT</th>
                <th rowspan="2" colspan="3" class="sheet-table__bottom">PREVIOUS</th>
                <th rowspan="2" colspan="3" class="sheet-table__bottom">CUMMULATIVE</th>
                <th rowspan="2" class="sheet-table__bottom">REMARK</th>
              </tr>
              <tr>
                @for (column of s.columns; track column.courseId) {
                  <th class="sheet-table__code"><span>{{ column.code }}</span></th>
                }
              </tr>
              <tr>
                @for (column of s.columns; track column.courseId) {
                  <th>{{ column.units ?? '' }}</th>
                }
                @for (block of blocks; track $index) {
                  <th>TGP</th>
                  <th>TNU</th>
                  <th>GPA</th>
                }
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (row of s.rows; track row.studentId) {
                <tr>
                  <td>{{ row.sn }}</td>
                  <td>{{ row.registrationNumber }}</td>
                  <td class="sheet-table__name">{{ row.name }}</td>
                  @for (column of s.columns; track column.courseId) {
                    <td>{{ row.grades[column.courseId] ?? '' }}</td>
                  }
                  @for (cell of cells(row.current); track $index) {
                    <td>{{ cell }}</td>
                  }
                  @for (cell of cells(row.previous); track $index) {
                    <td>{{ cell }}</td>
                  }
                  @for (cell of cells(row.cumulative); track $index) {
                    <td>{{ cell }}</td>
                  }
                  <td>{{ row.remark }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>

      @if (s.reason) {
        <p class="paper__reason">REASON: {{ s.reason }}</p>
      }

      <div class="paper__signs">
        <p>HOD: <span>{{ signed(signOff()?.hod) }}</span></p>
        <p>DEAN, {{ s.header.facultyCode }}: <span>{{ signed(signOff()?.dean) }}</span></p>
        @if (signOff()?.dvc) {
          <p>APPROVED, DVC: <span>{{ signed(signOff()?.dvc) }}</span></p>
        }
      </div>
    </article>
  `,
  styles: `
    :host { display: block; }
    .paper { background: #fff; color: #111; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; font-size: 13px; }
    .paper p { margin: 0; }
    .paper__ig { text-align: right; }
    .paper__inst, .paper__fac, .paper__title { text-align: center; font-weight: 500; letter-spacing: 0.01em; }
    .paper__inst { font-size: 16px; }
    .paper p.paper__fac { font-size: 15px; margin-bottom: 16px; }
    .paper p.paper__title { margin-bottom: 8px; }
    .paper__meta { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 4px; }
    .paper__meta > div:last-child { text-align: right; }
    .paper__scroll { overflow-x: auto; }
    .sheet-table { border-collapse: collapse; width: max-content; min-width: 100%; }
    .sheet-table th, .sheet-table td { border: 1.5px solid #111; padding: 3px 6px; text-align: center; white-space: nowrap; }
    .sheet-table th { font-weight: 500; font-size: 12px; }
    .sheet-table__bottom { vertical-align: bottom; }
    .sheet-table .sheet-table__name { text-align: left; min-width: 160px; }
    .sheet-table .sheet-table__code { vertical-align: bottom; padding: 6px 2px; }
    .sheet-table__code span { writing-mode: vertical-rl; transform: rotate(180deg); display: inline-block; }
    .paper p.paper__reason { margin: 20px 0 0 96px; }
    .paper__signs { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px 32px; margin-top: 28px; }
    .paper__signs span { color: #2793ff; }
  `,
})
export class SheetView {
  readonly sheet = input.required<ISheet>();
  readonly pageNumber = input<number | null>(null);
  readonly signOff = input<{ hod: ISignature | null; dean: ISignature | null; dvc: ISignature | null } | null>(null);

  readonly blocks = [0, 1, 2];
  readonly isDegree = computed(() => this.sheet().degreeRows.length > 0 || this.sheet().header.title === 'DEGREE RESULT');
  readonly code = computed(() => pageCode(this.pageNumber()));

  readonly cells = totalsCells;
  readonly gpa = gpa;

  /** "HOD MTH · 13/11/2026", or the dotted line where nobody has signed. */
  signed(signature: ISignature | null | undefined): string {
    return signature ? `${signature.name} · ${formatDate(signature.at)}` : '……………………………';
  }
}
