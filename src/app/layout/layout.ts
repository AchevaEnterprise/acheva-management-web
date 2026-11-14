import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { NotificationBell } from './notification-bell';

interface INavItem {
  label: string;
  route: string;
  activeIcon: string;
  inactiveIcon: string;
}

/**
 * The management portal's shell (management.acheva.app, 2026-11-13): the
 * same light sidebar as the other Acheva apps, showing only what the office
 * signed in uses — the head of Exams & Records also sees their Team.
 */
@Component({
  selector: 'app-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NotificationBell],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class Layout {
  private readonly auth = inject(AuthService);
  readonly account = this.auth.account;

  constructor() {
    // The office or the head flag may have changed since sign-in.
    this.auth.refreshAccount();
  }

  readonly nav = computed<INavItem[]>(() => [
    {
      label: 'Dashboard',
      route: '/dashboard',
      activeIcon: 'icons/menu/dashboard-active.svg',
      inactiveIcon: 'icons/menu/dashboard-inactive.svg',
    },
    {
      label: this.auth.isDvc() ? 'Results to vet' : 'Approved results',
      route: '/results',
      activeIcon: 'icons/menu/result-management-active.svg',
      inactiveIcon: 'icons/menu/result-management-inactive.svg',
    },
    ...(this.auth.isTeamHead()
      ? [
          {
            label: 'Team',
            route: '/team',
            activeIcon: 'icons/menu/students-active.svg',
            inactiveIcon: 'icons/menu/students-inactive.svg',
          },
        ]
      : []),
  ]);

  readonly name = computed(() => {
    const account = this.account();
    if (!account) return '';
    return [account.titles?.[0], account.firstname, account.lastname].filter(Boolean).join(' ');
  });

  readonly initial = computed(() => (this.account()?.firstname ?? 'A').charAt(0).toUpperCase());

  logout(): void {
    this.auth.signOut();
  }
}
