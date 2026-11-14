import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { IAPIResponse } from '../models/api-response.model';
import {
  ICreatedInvite,
  INotification,
  IPendingInvite,
  ITeamMember,
} from '../models/management.model';
import { ISheetDetail, ISheetFilters, ISheetList, ISheetSummary } from '../models/sheet.model';

export interface ISheetQuery {
  box?: string;
  faculty?: string;
  department?: string;
  session?: string;
  semester?: string;
  kind?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/** Everything the management portal asks of the API. */
@Injectable({ providedIn: 'root' })
export class ManagementApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.BASE_URL;

  // ── Result sheets ──────────────────────────────────────────────────────

  sheets(query: ISheetQuery): Observable<ISheetList> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    }
    return this.http
      .get<IAPIResponse<ISheetList>>(`${this.base}/management/submissions`, { params })
      .pipe(map((resp) => resp.data));
  }

  filters(): Observable<ISheetFilters> {
    return this.http
      .get<IAPIResponse<ISheetFilters>>(`${this.base}/management/submissions/filters`)
      .pipe(map((resp) => resp.data));
  }

  sheet(id: string): Observable<ISheetDetail> {
    return this.http
      .get<IAPIResponse<ISheetDetail>>(`${this.base}/management/submissions/${id}`)
      .pipe(map((resp) => resp.data));
  }

  approve(ids: string[], comment?: string): Observable<ISheetSummary[]> {
    return this.http
      .post<IAPIResponse<{ approved: ISheetSummary[] }>>(`${this.base}/management/submissions/approve`, {
        ids,
        ...(comment ? { comment } : {}),
      })
      .pipe(map((resp) => resp.data.approved));
  }

  returnToDean(id: string, reason: string): Observable<ISheetDetail> {
    return this.http
      .patch<IAPIResponse<ISheetDetail>>(`${this.base}/management/submissions/${id}/return`, { reason })
      .pipe(map((resp) => resp.data));
  }

  file(id: string, note?: string): Observable<ISheetDetail> {
    return this.http
      .patch<IAPIResponse<ISheetDetail>>(`${this.base}/management/submissions/${id}/file`, note ? { note } : {})
      .pipe(map((resp) => resp.data));
  }

  // ── The Exams & Records team ───────────────────────────────────────────

  team(): Observable<{ members: ITeamMember[]; invites: IPendingInvite[] }> {
    return this.http
      .get<IAPIResponse<{ members: ITeamMember[]; invites: IPendingInvite[] }>>(`${this.base}/management/team`)
      .pipe(map((resp) => resp.data));
  }

  invite(email: string): Observable<ICreatedInvite> {
    return this.http
      .post<IAPIResponse<ICreatedInvite>>(`${this.base}/management/team/invites`, { email })
      .pipe(map((resp) => resp.data));
  }

  revokeInvite(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/management/team/invites/${id}`);
  }

  setActive(id: string, active: boolean): Observable<unknown> {
    return this.http.patch(`${this.base}/management/team/${id}/active`, { active });
  }

  // ── Notifications ──────────────────────────────────────────────────────

  notifications(): Observable<INotification[]> {
    return this.http
      .get<IAPIResponse<INotification[]>>(`${this.base}/notifications`)
      .pipe(map((resp) => resp.data ?? []));
  }

  markNotificationRead(id: string): Observable<unknown> {
    return this.http.patch(`${this.base}/notifications/${id}/read`, {});
  }

  markAllNotificationsRead(): Observable<unknown> {
    return this.http.patch(`${this.base}/notifications/read-all`, {});
  }
}
