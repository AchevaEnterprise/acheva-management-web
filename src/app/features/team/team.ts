import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ICreatedInvite, IPendingInvite, ITeamMember } from '../../core/models/management.model';
import { AuthService } from '../../core/services/auth.service';
import { ManagementApiService } from '../../core/services/management-api.service';
import { ToastService } from '../../core/services/toast.service';
import { formatDate } from '../../core/sheet-format';
import { ConfirmDialog, IConfirmData } from '../../shared/confirm-dialog';
import { Skeleton } from '../../shared/skeleton';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const messageOf = (err: unknown, fallback: string): string => {
  const message = (err as { error?: { message?: unknown } })?.error?.message;
  if (Array.isArray(message)) return String(message[0]);
  return typeof message === 'string' ? message : fallback;
};

/**
 * The head of Exams & Records brings in the rest of the team and switches
 * accounts off when people leave (the user, 2026-11-13). Acheva appoints the
 * head; the head never appoints another.
 */
@Component({
  selector: 'app-team',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Skeleton],
  template: `
    <header class="mg-page-head">
      <div>
        <h1>Exams &amp; Records team</h1>
        <p>Everyone here can file DVC-approved results. You add and remove members.</p>
      </div>
    </header>

    <section class="mg-card invite">
      <h2 class="mg-section-title">Add a member</h2>
      <form class="invite__form" (submit)="$event.preventDefault(); invite()">
        <label class="mg-field invite__email">
          <span class="mg-field__label">Their work email</span>
          <input
            class="mg-input"
            type="email"
            placeholder="name@futo.edu.ng"
            [value]="email()"
            (input)="email.set($any($event.target).value)"
            autocomplete="off"
          />
        </label>
        <button type="submit" class="mg-btn" [disabled]="sending() || !valid()">
          {{ sending() ? 'Sending…' : 'Send invite' }}
        </button>
      </form>
      @if (created(); as created) {
        <div class="mg-banner invite__done">
          <p>
            Invite sent to {{ created.email }}. If it does not arrive, send them this link — it works for 7 days:
          </p>
          <div class="invite__link">
            <input class="mg-input" readonly [value]="created.inviteLink" aria-label="Invite link" />
            <button type="button" class="mg-btn mg-btn--outline" (click)="copy(created.inviteLink)">Copy</button>
          </div>
        </div>
      }
    </section>

    <section class="mg-card">
      <h2 class="mg-section-title">Members</h2>
      @if (!members()) {
        <app-skeleton height="3rem" />
      } @else {
        <div class="mg-table-wrap">
          <table class="mg-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              @for (member of members(); track member._id) {
                <tr>
                  <td>{{ name(member) }}</td>
                  <td>{{ member.email }}</td>
                  <td>{{ member.isTeamHead ? 'Head' : 'Member' }}</td>
                  <td>
                    <span class="mg-chip" [class.mg-chip--tint]="member.isActive" [class.mg-chip--muted]="!member.isActive">
                      {{ member.isActive ? 'Active' : 'Switched off' }}
                    </span>
                  </td>
                  <td class="right">
                    @if (!member.isTeamHead) {
                      <button type="button" class="mg-link" (click)="setActive(member, !member.isActive)">
                        {{ member.isActive ? 'Switch off' : 'Switch back on' }}
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (invites().length) {
        <h2 class="mg-section-title pending">Invites not yet accepted</h2>
        <div class="mg-table-wrap">
          <table class="mg-table">
            <thead>
              <tr><th>Email</th><th>Sent</th><th>Expires</th><th></th></tr>
            </thead>
            <tbody>
              @for (pending of invites(); track pending._id) {
                <tr>
                  <td>{{ pending.email }}</td>
                  <td>{{ formatDate(pending.createdAt) }}</td>
                  <td>{{ formatDate(pending.expiresAt) }}</td>
                  <td class="right">
                    <button type="button" class="mg-link" (click)="revoke(pending)">Withdraw</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    .invite { margin-bottom: 24px; }
    .invite__form { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
    .invite__email { flex: 1 1 280px; }
    .invite__done { margin-top: 16px; flex-direction: column; }
    .invite__link { display: flex; gap: 8px; width: 100%; }
    .right { text-align: right; }
    .pending { margin-top: 24px; }
  `,
})
export class Team {
  private readonly api = inject(ManagementApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);

  readonly members = signal<ITeamMember[] | null>(null);
  readonly invites = signal<IPendingInvite[]>([]);
  readonly email = signal('');
  readonly sending = signal(false);
  readonly created = signal<ICreatedInvite | null>(null);
  readonly formatDate = formatDate;

  constructor() {
    this.load();
  }

  valid(): boolean {
    return EMAIL.test(this.email().trim());
  }

  name(member: ITeamMember): string {
    const name = [member.titles?.[0], member.firstname, member.lastname].filter(Boolean).join(' ');
    return member._id === this.auth.account()?.id ? `${name} (you)` : name;
  }

  invite(): void {
    if (!this.valid()) return;
    this.sending.set(true);
    this.api.invite(this.email().trim().toLowerCase()).subscribe({
      next: (created) => {
        this.sending.set(false);
        this.created.set(created);
        this.email.set('');
        this.load();
      },
      error: (err) => {
        this.sending.set(false);
        this.toast.error(messageOf(err, 'The invite could not be sent.'));
      },
    });
  }

  copy(link: string): void {
    navigator.clipboard?.writeText(link).then(
      () => this.toast.success('Link copied.'),
      () => this.toast.error('Copy did not work — select the link and copy it.'),
    );
  }

  setActive(member: ITeamMember, active: boolean): void {
    const data: IConfirmData = active
      ? { title: `Switch ${member.firstname}'s account back on?`, message: 'They can sign in again straight away.', confirmLabel: 'Switch on' }
      : {
          title: `Switch ${member.firstname}'s account off?`,
          message: 'They are signed out at once and cannot sign in until you switch it back on. What they filed stays on record.',
          confirmLabel: 'Switch off',
        };
    this.dialog
      .open(ConfirmDialog, { data, width: '460px', maxWidth: '92vw' })
      .afterClosed()
      .subscribe((yes: boolean) => {
        if (!yes) return;
        this.api.setActive(member._id, active).subscribe({
          next: () => {
            this.toast.success(active ? 'Switched back on.' : 'Switched off.');
            this.load();
          },
          error: (err) => this.toast.error(messageOf(err, 'That did not go through.')),
        });
      });
  }

  revoke(pending: IPendingInvite): void {
    this.api.revokeInvite(pending._id).subscribe({
      next: () => {
        this.toast.success('Invite withdrawn.');
        this.load();
      },
      error: (err) => this.toast.error(messageOf(err, 'The invite could not be withdrawn.')),
    });
  }

  private load(): void {
    this.api.team().subscribe({
      next: ({ members, invites }) => {
        this.members.set(members);
        this.invites.set(invites);
      },
      error: () => this.members.set([]),
    });
  }
}
