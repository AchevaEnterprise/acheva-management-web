import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { ISheetDetail } from '../../core/models/sheet.model';
import { AuthService } from '../../core/services/auth.service';
import { ManagementApiService } from '../../core/services/management-api.service';
import { ToastService } from '../../core/services/toast.service';
import {
  actionLabel,
  formatDate,
  formatDateTime,
  kindLabel,
  pageCode,
  statusLabel,
  statusTone,
  titleCase,
  whenLabel,
} from '../../core/sheet-format';
import { INoteDialogData, NoteDialog } from '../../shared/note-dialog';
import { SheetExportService } from '../../shared/sheet-export.service';
import { SheetView } from '../../shared/sheet-view';
import { Skeleton } from '../../shared/skeleton';

const messageOf = (err: unknown, fallback: string): string => {
  const message = (err as { error?: { message?: unknown } })?.error?.message;
  return typeof message === 'string' ? message : fallback;
};

/**
 * One sheet, laid out as the paper is, with what this office may do to it:
 * the DVC approves or returns it to the Dean; Exams & Records download it
 * and mark it filed. Below it, the trail of everyone who handled it.
 */
@Component({
  selector: 'app-result-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SheetView, Skeleton],
  templateUrl: './result-detail.html',
  styles: `
    .back { display: inline-block; margin-bottom: 16px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
    .head h1 { margin: 0 0 6px; font-size: 1.375rem; font-weight: 500; }
    .head p { margin: 0; color: #6b7280; font-size: 0.875rem; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; }
    .mg-banner { margin-bottom: 16px; }
    .trail { margin-top: 24px; }
    .trail ol { margin: 0; padding: 0; list-style: none; }
    .trail li { display: grid; grid-template-columns: 150px 1fr; gap: 16px; padding: 12px 0; border-bottom: 1px solid #f3f4f6; font-size: 0.875rem; }
    .trail li:last-child { border-bottom: none; }
    .trail time { color: #6b7280; }
    .trail__comment { display: block; margin-top: 4px; color: #4b5563; }
    .sheet-skeleton { margin-top: 16px; }
    .head p.status-line { margin-top: 8px; }
  `,
})
export class ResultDetail {
  private readonly api = inject(ManagementApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);
  private readonly exporter = inject(SheetExportService);

  readonly id = input.required<string>();
  readonly detail = signal<ISheetDetail | null>(null);
  readonly missing = signal(false);
  readonly busy = signal(false);
  readonly downloading = signal(false);

  readonly isDvc = this.auth.isDvc;
  readonly canApprove = computed(() => this.detail()?.actions.includes('DVC_APPROVE') ?? false);
  readonly canReturn = computed(() => this.detail()?.actions.includes('DVC_RETURN') ?? false);
  readonly canFile = computed(() => this.detail()?.actions.includes('RECORDS_FILE') ?? false);

  readonly kindLabel = kindLabel;
  readonly whenLabel = whenLabel;
  readonly statusLabel = statusLabel;
  readonly actionLabel = actionLabel;
  readonly formatDate = formatDate;
  readonly formatDateTime = formatDateTime;
  readonly pageCode = pageCode;
  readonly titleCase = titleCase;

  constructor() {
    // Re-read when the bell opens another sheet while this page is showing.
    effect(() => {
      this.id();
      untracked(() => {
        this.detail.set(null);
        this.missing.set(false);
        this.load();
      });
    });
  }

  tone(): string {
    const detail = this.detail();
    return detail ? `mg-chip--${statusTone(detail.status, this.isDvc() ? ['PENDING_DVC'] : [])}` : '';
  }

  approve(): void {
    this.act(
      {
        title: 'Approve this sheet?',
        message:
          'It goes to the Dean, to send out to the HOD and the Course Advisors, and to Exams & Records for the record. This cannot be undone.',
        label: 'A note on your approval',
        confirmLabel: 'Approve',
        required: false,
      },
      (note) => this.api.approve([this.id()], note || undefined),
      'Approved. The Dean and Exams & Records have been told.',
    );
  }

  returnToDean(): void {
    this.act(
      {
        title: 'Return this sheet to the Dean?',
        message: 'Say what needs correcting. The Dean can send it back to you, or return it to the HOD.',
        label: 'Reason',
        confirmLabel: 'Return to the Dean',
        required: true,
        placeholder: 'For example: two students are missing their GST 101 grades.',
      },
      (reason) => this.api.returnToDean(this.id(), reason),
      'Returned to the Dean.',
    );
  }

  file(): void {
    this.act(
      {
        title: 'Mark this sheet as filed?',
        message: 'Your name and today\'s date are recorded against it, and your colleagues see it as filed.',
        label: 'Where it is kept',
        confirmLabel: 'Mark as filed',
        required: false,
        placeholder: 'For example: Senate file 12, shelf 4.',
      },
      (note) => this.api.file(this.id(), note || undefined),
      'Filed.',
    );
  }

  async download(): Promise<void> {
    const detail = this.detail();
    if (!detail) return;
    this.downloading.set(true);
    try {
      await this.exporter.download({ sheet: detail.sheet, pageNumber: detail.pageNumber, signOff: detail.signOff });
    } catch {
      this.toast.error('The PDF could not be made. Try again.');
    } finally {
      this.downloading.set(false);
    }
  }

  private act(data: INoteDialogData, run: (note: string) => Observable<unknown>, done: string): void {
    this.dialog
      .open(NoteDialog, { data, width: '520px', maxWidth: '92vw' })
      .afterClosed()
      .subscribe((note: string | null | undefined) => {
        if (note === null || note === undefined) return;
        this.busy.set(true);
        run(note).subscribe({
          next: () => {
            this.busy.set(false);
            this.toast.success(done);
            this.load();
          },
          error: (err) => {
            this.busy.set(false);
            this.toast.error(messageOf(err, 'That did not go through.'));
            this.load();
          },
        });
      });
  }

  private load(): void {
    this.api.sheet(this.id()).subscribe({
      next: (detail) => this.detail.set(detail),
      error: () => this.missing.set(true),
    });
  }
}
