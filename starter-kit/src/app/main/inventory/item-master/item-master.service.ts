import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';
import { ItemMasterAPIUrls } from 'Urls/ItemMasterAPIUrls';

@Injectable({ providedIn: 'root' })
export class ItemMasterService {
  private url = environment.apiUrl; // e.g., 'https://host/api'

  private itemSource = new BehaviorSubject<any>(null);
  currentItem = this.itemSource.asObservable();

  constructor(private http: HttpClient) {}

  // GET all
  getAllItemMaster(): Observable<any> {
    return this.http.get<any>(this.url + ItemMasterAPIUrls.GetItems);
  }

  // GET by id
  getItemMasterById(id: number): Observable<any> {
    return this.http.get<any>(this.url + ItemMasterAPIUrls.GetItemById + id);
  }

  // POST
  createItemMaster(data: any): Observable<any> {
    return this.http.post<any>(this.url + ItemMasterAPIUrls.CreateItem, data);
  }

  // PUT
  updateItemMaster(id: number, data: any): Observable<any> {
    return this.http.put<any>(this.url + ItemMasterAPIUrls.UpdateItemById + id, data);
  }

  // DELETE (soft)
  deleteItemMaster(id: number): Observable<any> {
    return this.http.delete<any>(this.url + ItemMasterAPIUrls.DeleteItemById + id);
  }


  // Share selected item
  setItemMaster(item: any) {
    this.itemSource.next(item);
  }
  getItemAudit(itemId: number) {
  return this.http.get<{ isSuccess: boolean; data: any[] }>(this.url + ItemMasterAPIUrls.getItemAudit + itemId);
}
getWarehouseStock(itemId: number): Observable<any[]> {
    return this.http.get<any[]>(this.url + ItemMasterAPIUrls.getItemWarehouse+itemId);
  }

  getSupplierPrices(itemId: number): Observable<any[]> {
    return this.http.get<any[]>(this.url +ItemMasterAPIUrls.getItemSupplier+itemId);
  }
  getAudit(itemId: number) {
  return this.http.get<any[]>(this.url + ItemMasterAPIUrls.getItemAudit + itemId);
}
}
