// src/app/main/sales/delivery-order/deliveryorder.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { DeliveryOrderAPIUrls } from 'Urls/DeliveryOrderAPIUrls';

// -------- Models --------
export type DoCreateRequest = {
  soId: number | null;
  packId: number | null;
  driverId: number;            // NOT NULL in DB
  vehicleId: number | null;
  routeName: string | null;    // free text
  deliveryDate: string | null; // yyyy-MM-dd
  lines: Array<{
    soLineId: number | null;
    packLineId: number | null;
    itemId: number | null;
    itemName: string;
    uom: string | null;
    qty: number;
    notes: string | null;
  }>;
};

export type DoHeaderDto = {
  id: number;
  doNumber: string;
  status: number;
  soId: number | null;
  packId: number | null;
  driverId: number | null;
  driverName?: string | null;
  vehicleId: number | null;
  routeName: string | null;
  deliveryDate: string | null;  // ISO
  podFileUrl: string | null;
  isPosted: boolean | number;
};

export type DoLineDto = {
  id: number;
  doId: number;
  soLineId: number | null;
  packLineId: number | null;
  itemId: number | null;
  itemName: string;
  uom: string | null;
  qty: number;
  notes: string | null;
};

export type DoAddLineRequest = {
  doId: number;
  soLineId: number | null;
  packLineId: number | null;
  itemId: number | null;
  itemName: string;
  uom: string | null;
  qty: number;
  notes: string | null;
};

export type DoUpdateHeaderRequest = {
  driverId: number | null;
  vehicleId: number | null;
  routeName: string | null;
  deliveryDate: string | null;
};

@Injectable({ providedIn: 'root' })
export class DeliveryOrderService {
  private readonly base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ---- Headers ----
  getAll(): Observable<DoHeaderDto[]> {
    return this.http.get<any>(`${this.base}${DeliveryOrderAPIUrls.GetAll}`)
      .pipe(map(res => res?.data ?? res ?? []));
  }

  get(id: number): Observable<DoHeaderDto & { lines?: DoLineDto[] }> {
    return this.http.get<any>(`${this.base}${DeliveryOrderAPIUrls.GetById}${id}`)
      .pipe(map(res => res?.data ?? res));
  }

  create(payload: DoCreateRequest): Observable<number> {
    return this.http.post<any>(`${this.base}${DeliveryOrderAPIUrls.Create}`, payload)
      .pipe(map(res => res?.data ?? res));
  }

  updateHeader(id: number, payload: DoUpdateHeaderRequest): Observable<void> {
    // APIUrls.UpdateHeader ends with "/DeliveryOrder/Update/"
    // we append `${id}/Header`
    return this.http.put<any>(`${this.base}${DeliveryOrderAPIUrls.UpdateHeader}${id}/Header`, payload)
      .pipe(map(res => res?.data ?? res));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<any>(`${this.base}${DeliveryOrderAPIUrls.Delete}${id}`)
      .pipe(map(res => res?.data ?? res));
  }

  // ---- Lines ----
  getLines(id: number): Observable<DoLineDto[]> {
    return this.http.get<any>(`${this.base}${DeliveryOrderAPIUrls.GetLines}${id}`)
      .pipe(map(res => res?.data ?? res ?? []));
  }

  addLine(payload: DoAddLineRequest): Observable<number> {
    return this.http.post<any>(`${this.base}${DeliveryOrderAPIUrls.AddLine}`, payload)
      .pipe(map(res => res?.data ?? res));
  }

  removeLine(lineId: number): Observable<void> {
    return this.http.delete<any>(`${this.base}${DeliveryOrderAPIUrls.RemoveLine}${lineId}`)
      .pipe(map(res => res?.data ?? res));
  }

  // ---- Workflow ----
  submit(id: number): Observable<void> {
    return this.http.post<any>(`${this.base}${DeliveryOrderAPIUrls.Submit}${id}`, {})
      .pipe(map(res => res?.data ?? res));
  }

  approve(id: number): Observable<void> {
    return this.http.post<any>(`${this.base}${DeliveryOrderAPIUrls.Approve}${id}`, {})
      .pipe(map(res => res?.data ?? res));
  }

  reject(id: number): Observable<void> {
    return this.http.post<any>(`${this.base}${DeliveryOrderAPIUrls.Reject}${id}`, {})
      .pipe(map(res => res?.data ?? res));
  }

  post(id: number): Observable<void> {
    return this.http.post<any>(`${this.base}${DeliveryOrderAPIUrls.Post}${id}`, {})
      .pipe(map(res => res?.data ?? res));
  }
  // deliveryorder.service.ts
getSoSnapshot(doId: number) {
  return this.http.get<any>(`${this.base}${DeliveryOrderAPIUrls.GetSoSnapshot}${doId}`)
    .pipe(map(res => res?.data ?? res ?? []));
}

}
