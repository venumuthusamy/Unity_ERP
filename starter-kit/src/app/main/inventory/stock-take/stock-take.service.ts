import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';
import { StockTakeApiUrls } from 'Urls/StockTakeApiUrls';

@Injectable({
    providedIn: 'root'
})
export class StockTakeService {
    private url = environment.apiUrl
    private requestSource = new BehaviorSubject<any>(null);
    currentRequest = this.requestSource.asObservable();
    constructor(private http: HttpClient) { }

    getStockTake(): Observable<any[]> {
        return this.http.get<any[]>(this.url + StockTakeApiUrls.GetAllStockTake);
    }

    getStockTakeById(id: any): Observable<any[]> {
        return this.http.get<any[]>(this.url + StockTakeApiUrls.GetStockTakeById + id);
    }

    insertStockTake(data: any): Observable<any> {
        return this.http.post<any>(this.url + StockTakeApiUrls.CreateStockTake, data);
    }

    updateStockTake(data: any): Observable<any> {
        return this.http.put<any>(this.url + StockTakeApiUrls.UpdateStockTake, data);
    }

    deleteStockTake(id: any) {
        return this.http.delete<any>(this.url + StockTakeApiUrls.DeleteStockTake + id);
    }

}