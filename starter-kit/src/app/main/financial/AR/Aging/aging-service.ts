import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ArAgingInvoice, ArAgingSummary, ResponseResult } from './aging/aging-model';
import { environment } from 'environments/environment';


@Injectable({ providedIn: 'root' })
export class ArAgingService {
  private url = environment.apiUrl
  private baseUrl = '/ArAging';

  constructor(private http: HttpClient) {}

  getSummary(asOfDate: string): Observable<ResponseResult<ArAgingSummary[]>> {
    return this.http.get<ResponseResult<ArAgingSummary[]>>(
      `${this.url+this.baseUrl}/summary?asOfDate=${asOfDate}`
    );
  }

  getCustomerInvoices(
    customerId: number,
    asOfDate: string
  ): Observable<ResponseResult<ArAgingInvoice[]>> {
    return this.http.get<ResponseResult<ArAgingInvoice[]>>(
      `${this.url+this.baseUrl}/detail/${customerId}?asOfDate=${asOfDate}`
    );
  }
}
