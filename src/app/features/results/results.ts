import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { ISheetFilters, ISheetList, ManagementBox, SheetStatus } from '../../core/models/sheet.model';
import { AuthService } from '../../core/services/auth.service';
import { ManagementApiService } from '../../core/services/management-api.service';
import { ToastService } from '../../core/services/toast.service';
import {
  formatDate,
  kindLabel,
  pageCode,
  statusLabel,
  statusTone,
  titleCase,
  whenLabel,
} from '../../core/sheet-format';
import { INoteDialogData, NoteDialog } from '../../shared/note-dialog';
import { Pager } from '../../shared/pager';
import { Skeleton } from '../../shared/skeleton';

interface ITab {
  box: ManagementBox;
  label: string;
}

const LIMIT = 25;

/**
 * Every sheet that has reached the office, in boxes: the DVC's To review /
 * Returned / Approved, Exams & Records' To file / Filed. Filters and the
 * search live in the address bar, so a link to a filtered list works.
 */
@Component({
  selector: 'app-results',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Pager, Skeleton],
  templateUrl: './results.html',
  styles: `
    .bulk { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    .check { width: 40px; }
    .check input { width: 16px; height: 16px; accent-color: #2793ff; cursor: pointer; }
    .mg-chip--muted { margin-left: 6px; }
    .row-skeleton { margin-bottom: 8px; }
  `,
})
export class Results {
  private readonly api = inject(ManagementApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly searches = new Subject<string>();

  readonly isDvc = this.auth.isDvc;
  readonly list = signal<ISheetList | null>(null);
  readonly loading = signal(true);
  readonly filters = signal<ISheetFilters>({ faculties: [], departments: [], sessions: [] });
  readonly selected = signal<Set<string>>(new Set());
  readonly approving = signal(false);

  // The query, read from and written to the address bar.
  readonly box = signal<ManagementBox>('to-review');
  readonly faculty = signal('');
  readonly department = signal('');
  readonly session = signal('');
  readonly semester = signal('');
  readonly kind = signal('');
  readonly search = signal('');
  readonly page = signal(1);
  readonly limit = LIMIT;

  readonly tabs = computed<ITab[]>(() =>
    this.isDvc()
      ? [
          { box: 'to-review', label: 'To review' },
          { box: 'returned', label: 'Returned to the Dean' },
          { box: 'approved', label: 'Approved' },
          { box: 'all', label: 'All' },
        ]
      : [
          { box: 'to-file', label: 'To file' },
          { box: 'filed', label: 'Filed' },
          { box: 'all', label: 'All' },
        ],
  );

  readonly departments = computed(() =>
    this.filters().departments.filter((department) => !this.faculty() || department.faculty === this.faculty()),
  );

  /** Only the DVC's To review box can be approved several at a time. */
  readonly selectable = computed(() => this.isDvc() && this.box() === 'to-review');
  readonly allSelected = computed(() => {
    const sheets = this.list()?.sheets ?? [];
    return sheets.length > 0 && sheets.every((sheet) => this.selected().has(sheet._id));
  });

  readonly waitingOnMe = computed<SheetStatus[]>(() => (this.isDvc() ? ['PENDING_DVC'] : []));

  readonly kindLabel = kindLabel;
  readonly whenLabel = whenLabel;
  readonly statusLabel = statusLabel;
  readonly formatDate = formatDate;
  readonly pageCode = pageCode;
  readonly titleCase = titleCase;

  constructor() {
    this.api.filters().subscribe({ next: (filters) => this.filters.set(filters), error: () => undefined });
    this.route.queryParamMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((params) => {
      const box = params.get('box') as ManagementBox | null;
      const allowed = this.tabs().map((tab) => tab.box);
      this.box.set(box && allowed.includes(box) ? box : allowed[0]);
      this.faculty.set(params.get('faculty') ?? '');
      this.department.set(params.get('department') ?? '');
      this.session.set(params.get('session') ?? '');
      this.semester.set(params.get('semester') ?? '');
      this.kind.set(params.get('kind') ?? '');
      this.search.set(params.get('search') ?? '');
      this.page.set(Math.max(1, Number(params.get('page')) || 1));
      this.load();
    });
    this.searches
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((search) => this.navigate({ search: search || null, page: null }));
  }

  tone(status: SheetStatus): string {
    return `mg-chip--${statusTone(status, this.waitingOnMe())}`;
  }

  setBox(box: ManagementBox): void {
    this.navigate({ box, page: null });
  }

  setFilter(name: 'faculty' | 'department' | 'session' | 'semester' | 'kind', value: string): void {
    this.navigate({
      [name]: value || null,
      ...(name === 'faculty' ? { department: null } : {}),
      page: null,
    });
  }

  typeSearch(value: string): void {
    this.searches.next(value.trim());
  }

  setPage(page: number): void {
    this.navigate({ page });
  }

  clearFilters(): void {
    void this.router.navigate([], { queryParams: { box: this.box() } });
  }

  readonly hasFilters = computed(
    () => !!(this.faculty() || this.department() || this.session() || this.semester() || this.kind() || this.search()),
  );

  open(id: string): void {
    void this.router.navigate(['/results', id]);
  }

  toggle(id: string, event: Event): void {
    event.stopPropagation();
    this.selected.update((selected) => {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  toggleAll(): void {
    const sheets = this.list()?.sheets ?? [];
    this.selected.set(this.allSelected() ? new Set() : new Set(sheets.map((sheet) => sheet._id)));
  }

  approveSelected(): void {
    const ids = [...this.selected()];
    if (!ids.length) return;
    const data: INoteDialogData = {
      title: `Approve ${ids.length} ${ids.length === 1 ? 'sheet' : 'sheets'}?`,
      message:
        'Each goes to its Dean, to send out to the HOD and the Course Advisors, and to Exams & Records for the record. This cannot be undone.',
      label: 'A note on your approval',
      confirmLabel: 'Approve',
      required: false,
    };
    this.dialog
      .open(NoteDialog, { data, width: '520px', maxWidth: '92vw' })
      .afterClosed()
      .subscribe((comment: string | null | undefined) => {
        if (comment === null || comment === undefined) return;
        this.approving.set(true);
        this.api.approve(ids, comment || undefined).subscribe({
          next: (approved) => {
            this.approving.set(false);
            this.toast.success(`${approved.length} ${approved.length === 1 ? 'sheet' : 'sheets'} approved.`);
            this.selected.set(new Set());
            this.load();
          },
          error: (err: { error?: { message?: string } }) => {
            this.approving.set(false);
            this.toast.error(err?.error?.message ?? 'The sheets could not be approved.');
            this.load();
          },
        });
      });
  }

  private navigate(changes: Record<string, string | number | null>): void {
    void this.router.navigate([], { queryParams: changes, queryParamsHandling: 'merge' });
  }

  private load(): void {
    this.loading.set(true);
    this.selected.set(new Set());
    this.api
      .sheets({
        box: this.box(),
        faculty: this.faculty() || undefined,
        department: this.department() || undefined,
        session: this.session() || undefined,
        semester: this.semester() || undefined,
        kind: this.kind() || undefined,
        search: this.search() || undefined,
        page: this.page(),
        limit: LIMIT,
      })
      .subscribe({
        next: (list) => {
          this.list.set(list);
          this.loading.set(false);
        },
        error: () => {
          this.list.set({ desk: this.isDvc() ? 'DVC' : 'EXAMS_RECORDS', counts: {}, page: 1, limit: LIMIT, total: 0, sheets: [] });
          this.loading.set(false);
        },
      });
  }
}
