import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

const NO_RETRY = ['/auth/management/login', '/auth/management/refresh-token', '/auth/logout'];

/**
 * A 401 means the access token lapsed or the account was switched off.
 * Renew once and retry; if renewal is refused, the session is over.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || NO_RETRY.some((path) => req.url.includes(path))) {
        return throwError(() => err);
      }
      let renewal;
      try {
        renewal = auth.renew();
      } catch {
        auth.signOut();
        return throwError(() => err);
      }
      return renewal.pipe(
        switchMap((token) => next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))),
        catchError((retryError: HttpErrorResponse) => {
          if (retryError.status === 401 || req.url.includes('/refresh-token') || retryError.url?.includes('/refresh-token')) {
            auth.signOut();
          }
          return throwError(() => retryError);
        }),
      );
    }),
  );
};
