import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';
import { ItemMasterAPIUrls } from 'Urls/ItemMasterAPIUrls';

@Injectable({
  providedIn: 'root'
})
export class ItemMasterService {
private url = environment.apiUrl;

  private itemSource = new BehaviorSubject<any>(null);
  currentItem = this.itemSource.asObservable();

  constructor(private http: HttpClient) {}

  // GET all
  getAllItemMaster(): Observable<any> {
    return this.http.get<any>(this.url + ItemMasterAPIUrls.GetAllItemsMaster);
  }

  // GET by id
  getItemMasterById(id: number): Observable<any> {
    return this.http.get<any>(this.url + ItemMasterAPIUrls.GetItemMasterById + id);
  }

  // POST
  createItemMaster(data: any): Observable<any> {
    return this.http.post<any>(this.url + ItemMasterAPIUrls.CreateItemMaster, data);
  }

  // PUT
  updateItemMaster(id: number, data: any): Observable<any> {
    return this.http.put<any>(this.url + ItemMasterAPIUrls.UpdateItemMasterById + id, data);
  }

  // DELETE (soft delete on server)
  deleteItemMaster(id: number): Observable<any> {
    return this.http.delete<any>(this.url + ItemMasterAPIUrls.DeleteItemMasterById + id);
  }

  // Share selected item to other components if needed
  setItemMaster(item: any) {
    this.itemSource.next(item);
  }
}
