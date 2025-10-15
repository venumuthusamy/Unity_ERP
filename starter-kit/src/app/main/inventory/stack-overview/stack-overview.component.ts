// src/app/main/inventory/stack-overview/stack-overview.component.ts
import { Component, OnInit } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ItemMasterService } from '../item-master/item-master.service';
import { WarehouseService } from 'app/main/master/warehouse/warehouse.service';

// Adjust these to your actual API row shape if needed
interface ApiItemRow {
  id?: number | string;
  sku?: string;
  name?: string;          // Item name
  itemName?: string;      // sometimes APIs use itemName
  wareHouse?: string;     // spelling in your sample
  warehouse?: string;
  bin?: string;
  onHand?: number;
  min?: number;
  available?: number;
  expiry?: string | Date | null;
}

interface StockRow {
  item: string;           // display name
  sku?: string | null;
  warehouse: string;
  bin: string;
  onHand: number;
  min: number;
  available: number;
  expiry?: string | Date | null;
}

@Component({
  selector: 'app-stack-overview',
  templateUrl: './stack-overview.component.html',
  styleUrls: ['./stack-overview.component.scss'],
  
})
export class StackOverviewComponent implements OnInit {
  // ===== Dropdown options =====
 warehouses: any[] = [];

  // ===== UI state =====
selectedWarehouse: string | null = null;
  minOnly = false;
  expOnly = false;
  searchText = '';

  loading = false;
  errorMsg: string | null = null;

  // ===== Data =====
  rows: StockRow[] = [];
  filteredRows: StockRow[] = [];

  // ===== Reasons =====
  reasons = [
    { id: 1, name: 'Damage' },
    { id: 2, name: 'Expiry' },
    { id: 3, name: 'Shrinkage' },
    { id: 4, name: 'Stock Count Adj.' }
  ];

  // ===== Modal state =====
  adjust: {
    row: StockRow | null;
    reasonId: number | null;
    originalInHand: number;
    available: number;        // fixed
    newInHand: number | null; // user edits this
    minAllowed: number;       // 1
    maxAllowed: number;       // <= available (as per your rule)
    qtyError: string | null;
  } = {
    row: null,
    reasonId: null,
    originalInHand: 0,
    available: 0,
    newInHand: null,
    minAllowed: 1,
    maxAllowed: 0,
    qtyError: null
  };

  constructor(
    private modalService: NgbModal,
    private itemMasterService : ItemMasterService,
    private warehouseService: WarehouseService
  ) {}

  ngOnInit(): void {
    this.loadMasterItem();
    this.loadRequests();
  }

  /** Map API -> table row */
  private toStockRow(api: ApiItemRow): StockRow {
    const name = api.name ?? api.itemName ?? api.sku ?? '(item)';
    return {
      item: String(name),
      sku: api.sku ?? null,
      warehouse: (api.warehouse ?? api.wareHouse ?? 'Central') as string,
      bin: (api.bin ?? 'A1') as string,
      onHand: Number(api.onHand ?? 0),
      min: Number(api.min ?? 0),
      available: Number(api.available ?? 0),
      expiry: api.expiry ?? null,
    };
  }

loadRequests(): void {
  this.warehouseService.getWarehouse().subscribe({
    next: (res: any) => {
      if (res?.data) {
        this.warehouses = res.data.map((w: any) => ({
          id: w.id,
          name: w.name
        }));
      }
    },
    error: (err: any) => console.error('Error loading warehouses', err)
  });
}


loadMasterItem(): void {
  this.loading = true;
  this.errorMsg = null;

  this.itemMasterService.getAllItemMaster().subscribe({
    next: (res: any) => {
      if (res?.isSuccess && Array.isArray(res.data)) {
        // Map backend fields to table structure
        this.rows = res.data.map(item => ({
          item: item.name,
          warehouse: item.wareHouse,
          sku:item.sku,
          bin: '', // No bin info, leave empty or map if available
          onHand: item.onHand,
          min: item.minQty,
          available: item.available,
          expiry: item.expiry || null // optional
        }));

        this.filteredRows = [...this.rows];
      } else {
        this.errorMsg = 'No data found.';
      }

      this.loading = false;
    },
    error: (err) => {
      this.loading = false;
      this.errorMsg = 'Failed to load Item Master list.';
      console.error('Item Master load error', err);
    }
  });
}


  /** Apply current UI filters to rows */
 applyFilters(): void {
  let filtered = [...this.rows]; // rows = full item list

if (typeof this.selectedWarehouse === 'number') {
  const whName = this.getWarehouseNameById(this.selectedWarehouse);
  if (whName) {
    filtered = filtered.filter(r => r.warehouse === whName);
  }
}

  // Add other filters like minOnly, expOnly, searchText, etc.

  this.filteredRows = filtered;
}


  // ===== Modal handlers (kept from your version, with tiny typing tweaks) =====
  openAdjustModal(tpl: any, row: StockRow) {
    const originalInHand = Number(row?.onHand ?? 0);
    const available = Number(row?.available ?? 0);

    // Rule you asked: In-hand can vary only within [1, available]
    const minAllowed = 1;
    const maxAllowed = available;

    const start = Math.min(Math.max(originalInHand, minAllowed), maxAllowed);

    this.adjust = {
      row,
      reasonId: null,
      originalInHand,
      available,          // fixed
      newInHand: start,   // clamped start value
      minAllowed,
      maxAllowed,
      qtyError: null
    };

    this.modalService.open(tpl, { centered: true, backdrop: 'static', keyboard: false });
  }

  validateNewInHand() {
    let v = Number(this.adjust.newInHand);
    const { minAllowed, maxAllowed } = this.adjust;

    if (!Number.isFinite(v)) v = minAllowed;
    if (v < minAllowed) v = minAllowed;
    if (v > maxAllowed) v = maxAllowed;

    this.adjust.newInHand = v;
    this.adjust.qtyError = null;
  }

  canSubmitAdjust(): boolean {
    return !!(this.adjust.row && this.adjust.reasonId && this.adjust.newInHand && !this.adjust.qtyError);
  }

  submitAdjust(modalRef: any) {
    this.validateNewInHand();
    if (!this.canSubmitAdjust()) return;

    // Write back ONLY in-hand to the bound object
    if (this.adjust.row) {
      this.adjust.row.onHand = Number(this.adjust.newInHand);
    }

    // Re-apply filters so "Below Min" etc. respond instantly
    this.applyFilters();

    modalRef.close('submitted');
  }


  getWarehouseNameById(id: number): string | null {
  const wh = this.warehouses.find(w => w.id === id);
  return wh ? wh.name : null;
}

}
