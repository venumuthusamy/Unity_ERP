import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { Observable } from 'rxjs';
import { SupplierInvoiceAPIUrls } from 'Urls/SupplierInvoiceAPIUrls ';
import { SupplierApiUrls } from 'Urls/SuppliersApiUrls';


export interface OcrInvoiceLine {
  poNo?: string;
  grnNo?: string;
  item?: string;
  qty?: number;
  price?: number;
}

export interface OcrInvoiceResult {
  invoiceNo?: string;
  invoiceDate?: string; // yyyy-mm-dd
  amount?: number;
  tax?: number;
  currency?: string;
  lines?: OcrInvoiceLine[];
}
@Injectable({
  providedIn: 'root'
})
export class SupplierInvoiceService {
  private url = environment.apiUrl;
  constructor(private http: HttpClient) {}

   getAll(): Observable<any> {
      return this.http.get<any[]>(this.url + SupplierInvoiceAPIUrls.GetAll);
    }
  
    // POST
    create(data: any): Observable<any> {
      return this.http.post(this.url+SupplierInvoiceAPIUrls.Create, data);
    }
  
    // PUT
  update(id: number, data: any): Observable<any> {
    return this.http.put(`${this.url + SupplierInvoiceAPIUrls.Update}${id}`, data);
  }
  
    // DELETE
    delete(id: number): Observable<any> {
      return this.http.delete(`${this.url + SupplierInvoiceAPIUrls.Delete}${id}`);
    }
     GetSupplierInvoiceById(id: number): Observable<any> {
        return this.http.get(`${this.url + SupplierInvoiceAPIUrls.GetById}${id}`);
      }
}
