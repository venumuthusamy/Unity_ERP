import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { Observable } from 'rxjs';
import { PurchaseOrderApiUrls } from 'Urls/PurchaseOrderApiUrls';

@Injectable({
  providedIn: 'root'
})
export class PurchaseOrderService {

  private url = environment.apiUrl;
 
   constructor(private http: HttpClient) {}
 
   getAllPurchaseOrder(): Observable<any> {
     return this.http.get<any[]>(this.url + PurchaseOrderApiUrls.GetAllPR);
   }
 
  //  createPaymentTerms(data: any): Observable<any> {
  //    return this.http.post(this.url + PaymentTermsAPIUrls.CreatePaymentTerms, data);
  //  }
 
  //  updatePaymentTerms(id: number, data: any): Observable<any> {
  //    return this.http.put(`${this.url + PaymentTermsAPIUrls.UpdatePaymentTerms}${id}`, data);
  //  }
 
  //  deletePaymentTerms(id: number): Observable<any> {
  //    return this.http.delete(`${this.url + PaymentTermsAPIUrls.DeletePaymentTerms}${id}`);
  //  }
 
  //  getByIdPaymentTerms(id: number): Observable<any> {
  //    return this.http.get(`${this.url + PaymentTermsAPIUrls.GetPaymentTermsById}${id}`);
  //  }
}
