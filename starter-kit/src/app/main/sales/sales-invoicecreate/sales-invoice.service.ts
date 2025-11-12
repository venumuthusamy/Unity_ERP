// sales-invoice.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { Observable } from 'rxjs';
import { SalesInvoiceAPIUrls } from 'Urls/SalesInvoiceAPIUrls ';

export type SiSourceType = 1 | 2;

export interface ApiResponse<T=any> {
  isSuccess?: boolean; success?: boolean;
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
  description?: string | null;     // <— NEW
}

export interface SiCreateRequest {
  sourceType: SiSourceType;
  soId?: number | null;
  doId?: number | null;
  invoiceDate: string;          // yyyy-MM-dd
  lines: SiCreateLine[];
}

@Injectable({ providedIn: 'root' })
export class SalesInvoiceService {
  private base = environment.apiUrl;
  constructor(private http: HttpClient) {}

  list(): Observable<ApiResponse> {
    return this.http.get<ApiResponse>(this.base + SalesInvoiceAPIUrls.List);
  }
  get(id: number): Observable<ApiResponse> {
    return this.http.get<ApiResponse>(this.base + SalesInvoiceAPIUrls.Get + id);
  }
  sourceLines(sourceType: SiSourceType, sourceId: number): Observable<ApiResponse> {
    const params = new HttpParams().set('sourceType', String(sourceType)).set('sourceId', String(sourceId));
    return this.http.get<ApiResponse>(this.base + SalesInvoiceAPIUrls.SourceLines, { params });
  }
  create(req: SiCreateRequest): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(this.base + SalesInvoiceAPIUrls.Create, req);
  }
  delete(id: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(this.base + SalesInvoiceAPIUrls.Delete + id);
  }

  // --- edit endpoints already in your controller ---
  updateHeader(id: number, body: { invoiceDate: string }): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(this.base + `/salesinvoice/UpdateHeader/${id}`, body);
  }
  addLine(siId: number, body: SiCreateLine): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(this.base + `/salesinvoice/AddLine/${siId}`, body);
  }
  updateLine(lineId: number, body: { qty: number; unitPrice: number; discountPct: number; taxCodeId?: number|null; description?: string|null }): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(this.base + `/salesinvoice/UpdateLine/${lineId}`, body);
  }
  removeLine(lineId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(this.base + `/salesinvoice/RemoveLine/${lineId}`);
  }
}
