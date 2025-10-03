import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';
import { POApiUrls } from 'Urls/PurchaseOrderAPIUrls';


@Injectable({
    providedIn: 'root'
})
export class POService {
    private url = environment.apiUrl
    private requestSource = new BehaviorSubject<any>(null);
    currentRequest = this.requestSource.asObservable();
    constructor(private http: HttpClient) { }

    getPO(): Observable<any[]> {
        return this.http.get<any[]>(this.url + POApiUrls.GetAllPO);
    }

    getPOById(id: any): Observable<any[]> {
        return this.http.get<any[]>(this.url + POApiUrls.GetPOById + id);
    }

    insertPO(data: any): Observable<any> {
        return this.http.post<any>(this.url + POApiUrls.CreatePO, data);
    }

    updatePO(data: any): Observable<any> {
        return this.http.put<any>(this.url + POApiUrls.UpdatePO, data);
    }

    deletePO(id: any) {
        return this.http.delete<any>(this.url + POApiUrls.DeletePO + id);
    }

}