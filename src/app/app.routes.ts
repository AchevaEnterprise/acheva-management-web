import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { AuthService } from './core/services/auth.service';

/** Only the head of Exams & Records manages the team. */
const teamHeadGuard: CanActivateFn = () =>
  inject(AuthService).isTeamHead() || inject(Router).createUrlTree(['/dashboard']);

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register').then((m) => m.Register),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/layout').then((m) => m.Layout),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'results',
        loadComponent: () => import('./features/results/results').then((m) => m.Results),
      },
      {
        path: 'results/:id',
        loadComponent: () => import('./features/results/result-detail').then((m) => m.ResultDetail),
      },
      {
        path: 'team',
        canActivate: [teamHeadGuard],
        loadComponent: () => import('./features/team/team').then((m) => m.Team),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
