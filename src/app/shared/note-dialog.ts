import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface INoteDialogData {
  title: string;
  message: string;
  label: string;
  confirmLabel: string;
  /** A return must say why; an approval or a filing note may be blank. */
  required: boolean;
  placeholder?: string;
}

/** A short text before acting: the reason for a return, a note on approval or filing. */
@Component({
  selector: 'app-note-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="mg-dialog" (submit)="$event.preventDefault(); confirm()">
      <h2>{{ data.title }}</h2>
      <p>{{ data.message }}</p>
      <label class="mg-field">
        <span class="mg-field__label">{{ data.label }}{{ data.required ? '' : ' (optional)' }}</span>
        <textarea
          class="mg-textarea"
          rows="4"
          maxlength="1000"
          [placeholder]="data.placeholder ?? ''"
          [value]="text()"
          (input)="text.set($any($event.target).value)"
          cdkFocusInitial
        ></textarea>
      </label>
      @if (tooShort()) {
        <p class="mg-hint">Write at least 5 characters so they know what to fix.</p>
      }
      <div class="mg-dialog__actions">
        <button type="button" class="mg-btn mg-btn--outline" (click)="ref.close(null)">Cancel</button>
        <button type="submit" class="mg-btn" [disabled]="tooShort()">{{ data.confirmLabel }}</button>
      </div>
    </form>
  `,
})
export class NoteDialog {
  readonly ref = inject(MatDialogRef<NoteDialog, string | null>);
  readonly data = inject<INoteDialogData>(MAT_DIALOG_DATA);
  readonly text = signal('');
  readonly tooShort = computed(() => this.data.required && this.text().trim().length < 5);

  confirm(): void {
    if (this.tooShort()) return;
    this.ref.close(this.text().trim());
  }
}
