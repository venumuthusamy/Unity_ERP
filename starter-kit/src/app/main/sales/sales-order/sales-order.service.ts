// sales-order.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { SalesOrderApiUrls } from 'Urls/SalesOrderAPIUrls';
import { environment } from 'environments/environment';


export interface ResponseResult<T = any> {
  isSuccess: boolean;
  message: string;
  data: T;
}

export interface AllocationPreviewResponse {
  lines: Array<{
    itemId: number;
    requestedQty: number;
    allocatedQty: number;
    fullyAllocated: boolean;
    allocations: Array<{ warehouseId: number; supplierId: number; qty: number }>;
  }>;
}
@Injectable({ providedIn: 'root' })
export class SalesOrderService {
  private url = environment.apiUrl; // e.g. '/api'
  private requestSource = new BehaviorSubject<any>(null);
  currentRequest = this.requestSource.asObservable();

  constructor(private http: HttpClient) {}

  getSO(): Observable<ResponseResult<any>> {
    return this.http.get<ResponseResult<any>>(this.url + SalesOrderApiUrls.GetAllSO);
  }

  getSOById(id: any): Observable<ResponseResult<any>> {
    return this.http.get<ResponseResult<any>>(this.url + SalesOrderApiUrls.GetSOById + id);
  }

  insertSO(data: any): Observable<ResponseResult<number>> {
    return this.http.post<ResponseResult<number>>(this.url + SalesOrderApiUrls.CreateSO, data);
  }

  updateSO(data: any): Observable<ResponseResult<any>> {
    return this.http.put<ResponseResult<any>>(this.url + SalesOrderApiUrls.UpdateSO, data);
  }

  deleteSO(id: any): Observable<ResponseResult<any>> {
    return this.http.delete<ResponseResult<any>>(this.url + SalesOrderApiUrls.DeleteSO + id);
  }

  GetByQuatitonDetails(id: any): Observable<ResponseResult<any>> {
    return this.http.get<ResponseResult<any>>(this.url + SalesOrderApiUrls.GetByQuatitonDetails + id);
  }

  // ✅ FIXED: pass { lines } as the body (2nd arg), not appended to URL
  previewAllocation(lines: { itemId: number; quantity: number }[]) {
    return this.http.post<ResponseResult<AllocationPreviewResponse>>(
      this.url + SalesOrderApiUrls.previewAllocation,
      { lines }
    );
  }
}
