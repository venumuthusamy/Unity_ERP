import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { Observable } from 'rxjs';
import { GRNApiUrls } from 'Urls/GRNApiUrls';

@Injectable({
  providedIn: 'root'
})
export class PurchaseGoodreceiptService {
private url = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getAllGRN(): Observable<any> {
    return this.http.get<any[]>(this.url + GRNApiUrls.GetAllGRN);
  }

  createGRN(data: any): Observable<any> {
    return this.http.post(this.url + GRNApiUrls.CreateGRN, data);
  }

    getByIdGRN(id: number): Observable<any> {
    return this.http.get(`${this.url + GRNApiUrls.GetGRNById}${id}`);
  }

  // updatePaymentTerms(id: number, data: any): Observable<any> {
  //   return this.http.put(`${this.url + GRNApiUrls.UpdatePaymentTerms}${id}`, data);
  // }

  // deletePaymentTerms(id: number): Observable<any> {
  //   return this.http.delete(`${this.url + GRNApiUrls.DeletePaymentTerms}${id}`);
  // }


}
