// src/app/main/finance/ap/accounts-payable.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AccountsPayableService {

  private baseUrl = environment.apiUrl + '/finance/ap';

  constructor(private http: HttpClient) { }

  // INVOICES TAB
  getApInvoices(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/invoices`);
  }

  getApInvoicesBySupplier(supplierId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/invoices/supplier/${supplierId}`);
  }

  // PAYMENTS TAB
  getPayments(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/payments`);
  }

  createPayment(payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/payments`, payload);
  }

  // 3-WAY MATCH TAB
  getMatchList(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/match`);
  }
}
