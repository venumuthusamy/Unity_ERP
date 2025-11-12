import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'environments/environment';

export type SiSourceType = 1 | 2;

export interface ApiResponse<T = any> {
  isSuccess: boolean;   // your API returns isSuccess
  message: string;
  data: T;
}

export interface SiSourceLine {
  sourceLineId: number;
  sourceType: SiSourceType;
  sourceId: number;
  itemId: number;
  itemName: string;
  uomName?: string | null;
  qtyOpen: number;
  unitPrice: number;
  discountPct: number;
  taxCodeId?: number | null;
}

export interface SiCreateLine {
  sourceLineId?: number | null;
  itemId: number;
  itemName?: string | null;
  uom?: string | null;
  qty: number;
  unitPrice: number;
  discountPct: number;
  taxCodeId?: number | null;
}

export interface SiCreateRequest {
  sourceType: SiSourceType;
  soId?: number | null;
  doId?: number | null;
  invoiceDate: string;     // yyyy-MM-dd
  lines: SiCreateLine[];
}

@Injectable({ providedIn: 'root' })
export class SalesInvoiceService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // URLs (make sure these match your backend routes)
  private urls = {
    List:         '/salesinvoice/List',
    Get:          '/salesinvoice/',               // + id
    SourceLines:  '/salesinvoice/SourceLines',    // ?sourceType=&sourceId=
    Create:       '/salesinvoice/Create',
    Delete:       '/salesinvoice/Delete/',        // + id
    UpdateHeader: '/salesinvoice/UpdateHeader/',  // + id
    AddLine:      '/salesinvoice/AddLine/',       // + siId
    UpdateLine:   '/salesinvoice/UpdateLine/',    // + lineId
    RemoveLine:   '/salesinvoice/RemoveLine/'     // + lineId
  };

  list(): Observable<ApiResponse> {
    return this.http.get<ApiResponse>(this.base + this.urls.List);
  }

  get(id: number): Observable<ApiResponse> {
    return this.http.get<ApiResponse>(this.base + this.urls.Get + id);
  }

  sourceLines(sourceType: SiSourceType, sourceId: number): Observable<ApiResponse> {
    const params = new HttpParams().set('sourceType', String(sourceType)).set('sourceId', String(sourceId));
    return this.http.get<ApiResponse>(this.base + this.urls.SourceLines, { params });
  }

  create(req: SiCreateRequest): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(this.base + this.urls.Create, req);
  }

  delete(id: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(this.base + this.urls.Delete + id);
  }

  // --- EDIT endpoints (no currency anywhere) ---
  updateHeader(id: number, body: { invoiceDate: string }) {
    return this.http.put<ApiResponse>(this.base + this.urls.UpdateHeader + id, body);
  }

  addLine(siId: number, body: {
    sourceLineId?: number | null;
    itemId?: number | null;
    itemName?: string | null;
    uom?: string | null;
    qty: number;
    unitPrice: number;
    discountPct: number;
    taxCodeId?: number | null;
  }) {
    return this.http.post<ApiResponse>(this.base + this.urls.AddLine + siId, body);
  }

  updateLine(lineId: number, body: {
    qty: number;
    unitPrice: number;
    discountPct: number;
    taxCodeId?: number | null;
  }) {
    return this.http.put<ApiResponse>(this.base + this.urls.UpdateLine + lineId, body);
  }

  removeLine(lineId: number) {
    return this.http.delete<ApiResponse>(this.base + this.urls.RemoveLine + lineId);
  }
}
