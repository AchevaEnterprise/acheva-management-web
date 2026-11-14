import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/** Routes that must go out without the session's token. */
const PUBLIC = ['/auth/management/login', '/auth/management/register', '/auth/management/invite', '/auth/management/refresh-token'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  if (PUBLIC.some((path) => req.url.includes(path)) || req.headers.has('Authorization')) return next(req);
  const token = auth.token;
  return next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);
};
