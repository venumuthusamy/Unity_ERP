import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { StackOverviewService } from '../../stack-overview/stack-overview.service';
import { WarehouseService } from 'app/main/master/warehouse/warehouse.service';

interface ApiItemRow {
  id?: number | string;
  sku?: string;
  name?: string;
  itemName?: string;
  warehouseName?: string;
  binName?: string;
  onHand?: number;
  reserved?: number;
  min?: number;
  minQty?: number;
  available?: number;
  expiryDate?: string;
  warehouseId?: number;
  binId?: number;
}

interface StockRow {
  idKey: string;
  sku: string | null;
  item: string;
  warehouse: string;
  bin: string;
  onHand: number;
  reserved: number;
  min: number;
  available: number;
  expiry: Date | null;
  warehouseId?: number;
  binId?: number;
  apiRow?: ApiItemRow;
}

@Component({
  selector: 'app-stock-transfer-create',
  templateUrl: './stock-transfer-create.component.html',
  styleUrls: ['./stock-transfer-create.component.scss']
})
export class StockTransferCreateComponent implements OnInit {
  fromWarehouseName = '';
  rows: StockRow[] = [];
  filteredRows: StockRow[] = [];

  fromWarehouse: string | number | null = null; // readonly in UI (name shown)
  toWarehouse:   string | number | null = null;
  remarks = '';

  toWarehouseList: any;

  constructor(
    private router: Router,
    private stockService: StackOverviewService,
    private warehouseServcie: WarehouseService
  ) {}

  ngOnInit(): void {
    this.loadMasterItem();
  }

  onSaveDraft(): void {
    // build payload without selections if needed
  }

  onSubmitForApproval(): void {
    // submit without selections if needed
  }

  private parseExpiry(src?: string): Date | null {
    if (!src) return null;
    if (src.startsWith('0001-01-01')) return null;
    const d = new Date(src);
    return isNaN(d.getTime()) ? null : d;
  }

  private toStockRow(api: ApiItemRow): StockRow {
    const warehouse = api.warehouseName ?? '';
    const item = api.name ?? api.itemName ?? '';
    const sku = api.sku ?? null;
    const bin = api.binName ?? '';
    const onHand = Number(api.onHand ?? 0);
    const reserved = Number(api.reserved ?? 0);
    const min = Number(api.min ?? api.minQty ?? 0);
    const available = Number(
      api.available != null ? api.available : (onHand - reserved)
    );
    const expiry = this.parseExpiry(api.expiryDate);

    return {
      idKey: [api.id ?? '', warehouse, item, sku ?? '', bin].join('|').toLowerCase(),
      warehouse,
      item,
      sku,
      bin,
      onHand,
      reserved,
      min,
      available,
      expiry,
      warehouseId: api.warehouseId,
      binId: api.binId,
      apiRow: api
    };
  }

  loadMasterItem(): void {
    this.stockService.GetAllStockTransferedList().subscribe({
      next: (res: any) => {
        const list: ApiItemRow[] = res?.isSuccess && Array.isArray(res.data) ? res.data : [];
        this.rows = list.map(item => this.toStockRow(item));
        this.filteredRows = [...this.rows];

        // set From Warehouse name from first row if available
        this.fromWarehouseName = this.rows.length ? this.rows[0].warehouse : '';

        if (this.fromWarehouseName) {
          this.loadToWareHouse(this.fromWarehouseName);
        } else {
          this.toWarehouseList = [];
        }
      },
      error: (err) => {
        console.error('Load stock transfer list failed', err);
        this.rows = [];
        this.filteredRows = [];
        this.fromWarehouseName = '';
        this.toWarehouseList = [];
      }
    });
  }

  loadToWareHouse(fromName: string): void {
    this.warehouseServcie.GetNameByWarehouseAsync(fromName).subscribe({
      next: (res: any) => {
        this.toWarehouseList = res?.data ?? [];
      },
      error: (err) => {
        console.error('Load To Warehouse failed', err);
        this.toWarehouseList = [];
      }
    });
  }

  // keep trackBy for performance
  trackByRow = (_: number, r: StockRow) => r.idKey;
    badgeToneClasses(tone: 'blue' | 'green' | 'amber' | 'red' = 'blue') {
    const map: Record<string, { bg: string; text: string; border: string }> = {
      blue:  { bg: 'bg-blue-50',  text: 'text-blue-700',  border: 'border-blue-100' },
      green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100' },
      amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
      red:   { bg: 'bg-red-50',   text: 'text-red-700',   border: 'border-red-100' },
    };
    const t = map[tone] ?? map.blue;
    return `${t.bg} ${t.text} ${t.border}`;
  }

  cancel(){

  }
}
