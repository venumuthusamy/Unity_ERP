import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { Observable } from 'rxjs';
import { StockAPIUrls } from 'Urls/StockApiUrls';

@Injectable({
  providedIn: 'root'
})
export class StockService {

  private url = environment.apiUrl;
 
   constructor(private http: HttpClient) {}
 
   getAllStock(): Observable<any> {
     return this.http.get<any[]>(this.url + StockAPIUrls.GetAllStock);
   }
 
   createStock(data: any): Observable<any> {
     return this.http.post(this.url + StockAPIUrls.CreateStock, data);
   }
 
   updateStock(id: number, data: any): Observable<any> {
     return this.http.put(`${this.url + StockAPIUrls.UpdateStock}${id}`, data);
   }
 
   deleteStock(id: number): Observable<any> {
     return this.http.delete(`${this.url + StockAPIUrls.DeleteStock}${id}`);
   }
 
   getByIdStock(id: number): Observable<any> {
     return this.http.get(`${this.url + StockAPIUrls.GetStockById}${id}`);
   }
}
