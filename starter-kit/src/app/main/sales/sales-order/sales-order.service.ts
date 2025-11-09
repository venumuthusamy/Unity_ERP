import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { SalesOrderApiUrls } from 'Urls/SalesOrderAPIUrls';
import { environment } from 'environments/environment';

@Injectable({ providedIn: 'root' })
export class SalesOrderService {
  private url = environment.apiUrl
  private requestSource = new BehaviorSubject<any>(null);
  currentRequest = this.requestSource.asObservable();

  constructor(private http: HttpClient) { }


  getSO(): Observable<any[]> {
    return this.http.get<any[]>(this.url + SalesOrderApiUrls.GetAllSO);
  }

  getSOById(id: any): Observable<any[]> {
    return this.http.get<any[]>(this.url + SalesOrderApiUrls.GetSOById + id);
  }

  insertSO(data: any): Observable<any> {
    return this.http.post<any>(this.url + SalesOrderApiUrls.CreateSO, data);
  }

  updateSO(data: any): Observable<any> {
    return this.http.put<any>(this.url + SalesOrderApiUrls.UpdateSO, data);
  }

  deleteSO(id: any) {
    return this.http.delete<any>(this.url + SalesOrderApiUrls.DeleteSO + id);
  }

   GetByQuatitonDetails(id: any): Observable<any[]> {
    return this.http.get<any[]>(this.url + SalesOrderApiUrls.GetByQuatitonDetails + id);
  }
}
