import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, switchMap } from 'rxjs';
import { IInviteInfo } from '../../../core/models/management.model';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

/** At least 8 characters with an upper-case letter, a number and a symbol — the API's rule. */
const STRONG = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const messageOf = (err: unknown, fallback: string): string => {
  const message = (err as { error?: { message?: unknown } })?.error?.message;
  if (Array.isArray(message)) return String(message[0]);
  return typeof message === 'string' ? message : fallback;
};

/**
 * Accepting an invite (2026-11-13). The invite already says who this is —
 * the DVC, the head of Exams & Records or a member of the team, and of which
 * university — so the page shows that first and asks only for a name and a
 * password. The email is the one the invite was sent to.
 */
@Component({
  selector: 'app-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: '../login/login.scss',
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly params = inject(ActivatedRoute).snapshot.queryParamMap;

  readonly token = this.params.get('token') ?? '';
  readonly email = this.params.get('email') ?? '';
  readonly invite = signal<IInviteInfo | null>(null);
  readonly problem = signal<string | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly showPassword = signal(false);

  readonly titles = ['', 'Prof.', 'Dr.', 'Mr.', 'Mrs.', 'Ms.'];

  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true }),
    firstname: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    lastname: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(STRONG)] }),
    confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    if (!this.token || !this.email) {
      this.problem.set('This link is incomplete. Open the invitation email again, or ask for a new invite.');
      this.loading.set(false);
      return;
    }
    this.auth
      .lookupInvite(this.token, this.email)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (invite) => this.invite.set(invite),
        error: (err) => this.problem.set(messageOf(err, 'This invite cannot be used.')),
      });
  }

  showError(field: 'firstname' | 'lastname' | 'password' | 'confirmPassword'): boolean {
    const control = this.form.controls[field];
    if (field === 'confirmPassword') {
      return (control.touched || control.dirty) && (control.invalid || control.value !== this.form.controls.password.value);
    }
    return control.invalid && (control.touched || control.dirty);
  }

  submit(): void {
    const value = this.form.getRawValue();
    if (this.form.invalid || value.password !== value.confirmPassword) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.auth
      .register({
        token: this.token,
        email: this.email,
        ...(value.title ? { title: value.title } : {}),
        firstname: value.firstname.trim(),
        lastname: value.lastname.trim(),
        password: value.password,
        confirmPassword: value.confirmPassword,
      })
      .pipe(
        switchMap(() => this.auth.signIn(this.email, value.password)),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: () => {
          this.toast.success('Welcome to Acheva.');
          void this.router.navigate(['/dashboard']);
        },
        error: (err) => this.toast.error(messageOf(err, 'Your account could not be created.')),
      });
  }
}
