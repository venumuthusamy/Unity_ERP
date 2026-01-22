import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { Observable } from 'rxjs';

export interface SoHeaderDto {
  id: number;
  salesOrderNo: string;
  customerId?: number;
  deliveryDate?: string;
  status?: string;
}

export interface PlanRowDto {
  recipeId: number;
  finishedItemId: number;
  recipeName: string;
  plannedQty: number;
  expectedOutput: number;
  batchQty: number;
  headerYieldPct: number;
}

export interface IngredientRowDto {
  itemId: number;
  itemName: string;
  uom?: string;
  requiredQty: number;
  availableQty: number;
  status: 'OK' | 'Shortage';
}

export interface ProductionPlanResponseDto {
  planRows: PlanRowDto[];
  ingredients: IngredientRowDto[];
}
@Injectable({ providedIn: 'root' })
export class ProductionPlanService {
 private url = environment.apiUrl; 
  constructor(private http: HttpClient) {}

  getSalesOrders(): Observable<SoHeaderDto[]> {
    return this.http.get<SoHeaderDto[]>(`${this.url}/ProductionPlan/salesorders`);
  }

  getBySo(soId: number, warehouseId: number): Observable<ProductionPlanResponseDto> {
    return this.http.get<ProductionPlanResponseDto>(`${this.url}/ProductionPlan/so/${soId}?warehouseId=${warehouseId}`);
  }

  savePlan(payload: { salesOrderId: number; outletId?: number; warehouseId?: number; createdBy?: string }) {
    return this.http.post(`${this.url}/ProductionPlan/save`, payload);
  }
}
