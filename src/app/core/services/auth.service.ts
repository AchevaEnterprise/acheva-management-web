import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { map, Observable, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { IAPIResponse } from '../models/api-response.model';
import { IInviteInfo, IManagementAccount } from '../models/management.model';

const TOKEN_KEY = 'acheva-mgmt-token';
const REFRESH_KEY = 'acheva-mgmt-refresh';
const ACCOUNT_KEY = 'acheva-mgmt-account';

interface ISignInResponse extends IManagementAccount {
  accessToken: string;
  refreshToken: string;
}

export interface IRegistration {
  token: string;
  email: string;
  title?: string;
  firstname: string;
  lastname: string;
  password: string;
  confirmPassword: string;
}

/** Storage can be refused (private windows); nothing here may throw because of it. */
const store = {
  get: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* the session lasts this tab */
    }
  },
  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* nothing to clear */
    }
  },
};

/**
 * The management portal's session — the DVC and Exams & Records
 * (2026-11-13). Unlike the admin console it KEEPS the refresh token and
 * renews: the DVC works through a queue over days, and being signed out
 * every morning would be the first thing they noticed.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly jwt = new JwtHelperService();
  private renewal: Observable<string> | null = null;

  readonly account = signal<IManagementAccount | null>(null);
  readonly isDvc = computed(() => this.account()?.office === 'DVC');
  readonly isRecords = computed(() => this.account()?.office === 'EXAMS_RECORDS');
  readonly isTeamHead = computed(() => this.isRecords() && this.account()?.isTeamHead === true);

  get token(): string | null {
    return store.get(TOKEN_KEY);
  }

  get isAuthenticated(): boolean {
    const token = this.token;
    if (!token) return false;
    try {
      // An expired access token still counts while a refresh token can renew it.
      return !this.jwt.isTokenExpired(token) || !!store.get(REFRESH_KEY);
    } catch {
      return false;
    }
  }

  signIn(email: string, password: string): Observable<IManagementAccount> {
    return this.http
      .post<IAPIResponse<ISignInResponse>>(`${environment.BASE_URL}/auth/management/login`, {
        email,
        password,
      })
      .pipe(
        map((resp) => resp.data),
        tap(({ accessToken, refreshToken, ...account }) => {
          store.set(TOKEN_KEY, accessToken);
          store.set(REFRESH_KEY, refreshToken);
          this.remember(account);
        }),
        map(({ accessToken: _a, refreshToken: _r, ...account }) => account),
      );
  }

  lookupInvite(token: string, email: string): Observable<IInviteInfo> {
    return this.http
      .get<IAPIResponse<IInviteInfo>>(`${environment.BASE_URL}/auth/management/invite`, {
        params: { token, email },
      })
      .pipe(map((resp) => resp.data));
  }

  register(registration: IRegistration): Observable<unknown> {
    return this.http.post(`${environment.BASE_URL}/auth/management/register`, registration);
  }

  /** Re-read the account — the office or the head flag may have changed. */
  refreshAccount(): void {
    this.http
      .get<IAPIResponse<IManagementAccount>>(`${environment.BASE_URL}/auth/management/me`)
      .subscribe({ next: (resp) => this.remember(resp.data), error: () => undefined });
  }

  /**
   * One renewal at a time: a page firing four requests with a stale token
   * must not spend the single-use refresh token four times.
   */
  renew(): Observable<string> {
    const refreshToken = store.get(REFRESH_KEY);
    if (!refreshToken) throw new Error('No refresh token');
    this.renewal ??= this.http
      .post<IAPIResponse<{ accessToken: string; refreshToken: string }>>(
        `${environment.BASE_URL}/auth/management/refresh-token`,
        { refreshToken },
      )
      .pipe(
        map((resp) => {
          store.set(TOKEN_KEY, resp.data.accessToken);
          store.set(REFRESH_KEY, resp.data.refreshToken);
          this.renewal = null;
          return resp.data.accessToken;
        }),
        // A refused renewal must not stay cached for the next attempt.
        tap({ error: () => (this.renewal = null) }),
        shareReplay(1),
      );
    return this.renewal;
  }

  loadInitialSession(): void {
    const raw = store.get(ACCOUNT_KEY);
    if (!raw) return;
    try {
      this.account.set(JSON.parse(raw) as IManagementAccount);
    } catch {
      store.remove(ACCOUNT_KEY);
    }
  }

  /** Local state first and unconditionally — see the admin console's note. */
  signOut(): void {
    const token = this.token;
    const refreshToken = store.get(REFRESH_KEY);
    store.remove(TOKEN_KEY);
    store.remove(REFRESH_KEY);
    store.remove(ACCOUNT_KEY);
    this.renewal = null;
    this.account.set(null);
    void this.router.navigate(['/login']);
    if (!token) return;
    this.http
      .post(
        `${environment.BASE_URL}/auth/logout`,
        refreshToken ? { refreshToken } : {},
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({ error: () => undefined });
  }

  private remember(account: IManagementAccount): void {
    store.set(ACCOUNT_KEY, JSON.stringify(account));
    this.account.set(account);
  }
}
