import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ISheetList, ManagementBox } from '../../core/models/sheet.model';
import { AuthService } from '../../core/services/auth.service';
import { ManagementApiService } from '../../core/services/management-api.service';
import { formatDate, kindLabel, pageCode, titleCase, whenLabel } from '../../core/sheet-format';
import { Skeleton } from '../../shared/skeleton';

interface IStat {
  box: ManagementBox;
  label: string;
  hint: string;
}

/**
 * Where the DVC and Exams & Records start: how much is waiting on them, and
 * the sheets that have waited longest.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Skeleton],
  template: `
    <header class="mg-page-head">
      <div>
        <h1>{{ greeting() }}, {{ account()?.firstname }}</h1>
        <p>{{ account()?.officeTitle }} · {{ account()?.school?.name }}</p>
      </div>
    </header>

    <section class="stats" aria-label="Your boxes">
      @for (stat of stats(); track stat.box) {
        <a class="mg-card stat" [routerLink]="['/results']" [queryParams]="{ box: stat.box }">
          <span class="stat__label">{{ stat.label }}</span>
          @if (list()) {
            <span class="stat__value">{{ list()?.counts?.[stat.box] ?? 0 }}</span>
          } @else {
            <app-skeleton width="48px" height="2rem" />
          }
          <span class="stat__hint">{{ stat.hint }}</span>
        </a>
      }
    </section>

    <section class="mg-card">
      <div class="queue-head">
        <h2 class="mg-section-title">{{ isDvc() ? 'Waiting longest for your approval' : 'Waiting longest to be filed' }}</h2>
        <a class="mg-link" routerLink="/results" [queryParams]="{ box: primaryBox() }">See all</a>
      </div>
      @if (!list()) {
        @for (row of [1, 2, 3]; track row) {
          <app-skeleton height="3rem" radius="8px" class="queue-skeleton" />
        }
      } @else if (list()!.sheets.length === 0) {
        <div class="mg-empty">
          <strong>Nothing is waiting on you.</strong>
          {{ isDvc() ? 'Sheets the Deans send you will appear here.' : 'Sheets the DVC approves will appear here.' }}
        </div>
      } @else {
        <div class="mg-table-wrap">
          <table class="mg-table mg-table--rows">
            <thead>
              <tr>
                <th>Sheet</th>
                <th>Department</th>
                <th>Students</th>
                <th>{{ isDvc() ? 'Sent to you' : 'Approved' }}</th>
              </tr>
            </thead>
            <tbody>
              @for (sheet of list()!.sheets; track sheet._id) {
                <tr (click)="open(sheet._id)" tabindex="0" (keydown.enter)="open(sheet._id)">
                  <td>
                    {{ kindLabel(sheet.kind) }} @if (sheet.pageNumber) {<span class="mg-chip mg-chip--muted">{{ pageCode(sheet.pageNumber) }}</span>}
                    <span class="mg-cell-sub">{{ whenLabel(sheet) }}</span>
                  </td>
                  <td>
                    {{ titleCase(sheet.department.name) }}
                    <span class="mg-cell-sub">{{ sheet.faculty.code }}</span>
                  </td>
                  <td>{{ sheet.studentCount }}</td>
                  <td>{{ formatDate(isDvc() ? sheet.sentToDvcAt : sheet.approvedAt) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat { display: flex; flex-direction: column; gap: 6px; color: inherit; text-decoration: none; transition: border-color 0.15s; }
    .stat:hover { border-color: #77bbff; }
    .stat__label { font-size: 0.875rem; color: #4b5563; font-weight: 500; }
    .stat__value { font-size: 2rem; font-weight: 500; color: #2793ff; line-height: 1.2; }
    .stat__hint { font-size: 0.75rem; color: #6b7280; }
    .queue-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
    .queue-skeleton { margin-bottom: 8px; }
    .mg-chip { margin-left: 6px; }
  `,
})
export class Dashboard {
  private readonly auth = inject(AuthService);
  private readonly api = inject(ManagementApiService);
  private readonly router = inject(Router);

  readonly account = this.auth.account;
  readonly isDvc = this.auth.isDvc;
  readonly list = signal<ISheetList | null>(null);

  readonly primaryBox = computed<ManagementBox>(() => (this.isDvc() ? 'to-review' : 'to-file'));

  readonly stats = computed<IStat[]>(() =>
    this.isDvc()
      ? [
          { box: 'to-review', label: 'To review', hint: 'Sent by the Deans, waiting for you' },
          { box: 'returned', label: 'Returned to the Deans', hint: 'Waiting on a correction' },
          { box: 'approved', label: 'Approved', hint: 'Signed off by you' },
        ]
      : [
          { box: 'to-file', label: 'To file', hint: 'Approved by the DVC' },
          { box: 'filed', label: 'Filed', hint: 'On record' },
        ],
  );

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  });

  readonly kindLabel = kindLabel;
  readonly whenLabel = whenLabel;
  readonly formatDate = formatDate;
  readonly pageCode = pageCode;
  readonly titleCase = titleCase;

  constructor() {
    this.api.sheets({ box: this.primaryBox(), limit: 5 }).subscribe({
      next: (list) => this.list.set(list),
      error: () => this.list.set({ desk: 'DVC', counts: {}, page: 1, limit: 5, total: 0, sheets: [] }),
    });
  }

  open(id: string): void {
    void this.router.navigate(['/results', id]);
  }
}
