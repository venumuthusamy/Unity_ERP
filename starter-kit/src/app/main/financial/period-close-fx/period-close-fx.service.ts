import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'environments/environment';

export interface PeriodOption {
  id: number;
  label: string;       // e.g. "Sep 2025"
  startDate: string;   // "2025-09-01"
  endDate: string;     // "2025-09-30"
}

export interface PeriodStatus {
  periodId: number;
  periodLabel: string;
  periodEndDate: string;
  isLocked: boolean;
}

export interface FxRevalRequest {
  periodId: number;
  fxDate: string; // yyyy-MM-dd
}

@Injectable({ providedIn: 'root' })
export class PeriodCloseService {

  private baseUrl = environment.apiUrl +'/PeriodClose';

  constructor(private http: HttpClient) {}

  getPeriods(): Observable<PeriodOption[]> {
    return this.http.get<PeriodOption[]>(`${this.baseUrl}/periods`);
  }

  getStatus(periodId: number): Observable<PeriodStatus> {
    return this.http.get<PeriodStatus>(`${this.baseUrl}/status/${periodId}`);
  }

  setLock(periodId: number, lock: boolean): Observable<PeriodStatus> {
    return this.http.post<PeriodStatus>(`${this.baseUrl}/lock`, { periodId, lock });
  }

  runFxReval(req: FxRevalRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/run-fx-reval`, req);
  }
}
