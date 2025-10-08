import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';
import { DebitNoteApiUrls } from 'Urls/DebitNoteApiUrls';



@Injectable({
    providedIn: 'root'
})
export class DebitNoteService {
    private url = environment.apiUrl
    private requestSource = new BehaviorSubject<any>(null);
    currentRequest = this.requestSource.asObservable();
    constructor(private http: HttpClient) { }

    getDebitNote(): Observable<any[]> {
        return this.http.get<any[]>(this.url + DebitNoteApiUrls.GetAllDebitNote);
    }

    getDebitNoteById(id: any): Observable<any[]> {
        return this.http.get<any[]>(this.url + DebitNoteApiUrls.GetDebitNoteById + id);
    }

    insertDebitNote(data: any): Observable<any> {
        return this.http.post<any>(this.url + DebitNoteApiUrls.CreateDebitNote, data);
    }

    updateDebitNote(data: any): Observable<any> {
        return this.http.put<any>(this.url + DebitNoteApiUrls.UpdateDebitNote, data);
    }

    deleteDebitNote(id: any) {
        return this.http.delete<any>(this.url + DebitNoteApiUrls.DeleteDebitNote + id);
    }

}