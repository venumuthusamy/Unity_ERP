// services/delivery-order.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';

@Injectable({ providedIn: 'root' })
export class DeliveryOrderService {
  private base = environment.apiUrl + '/DeliveryOrder';
  constructor(private http: HttpClient) {}

  create(payload: any) { return this.http.post(`${this.base}/Create`, payload); }
  get(id: number) { return this.http.get(`${this.base}/${id}`); }
  updateHeader(id: number, payload: any) { return this.http.put(`${this.base}/${id}/Header`, payload); }
  addLine(payload: any) { return this.http.post(`${this.base}/AddLine`, payload); }
  removeLine(lineId: number) { return this.http.delete(`${this.base}/RemoveLine/${lineId}`); }
  submit(id: number) { return this.http.post(`${this.base}/${id}/Submit`, {}); }
  approve(id: number) { return this.http.post(`${this.base}/${id}/Approve`, {}); }
  reject(id: number) { return this.http.post(`${this.base}/${id}/Reject`, {}); }
  post(id: number) { return this.http.post(`${this.base}/${id}/Post`, {}); }
}
