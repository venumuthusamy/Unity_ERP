import { Component, OnInit } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ItemMasterService } from '../item-master/item-master.service';
import { WarehouseService } from 'app/main/master/warehouse/warehouse.service';
import { StockIssueService } from 'app/main/master/stock-issue/stock-issue.service';
import * as feather from 'feather-icons';
import { Router } from '@angular/router';
import { StackOverviewService } from './stack-overview.service';



interface ApiItemRow {
  id?: number | string;
  sku?: string;
  name?: string;
  itemName?: string;
  wareHouse?: string;
  warehouse?: string;
  bin?: string;
  onHand?: number;
  reserved?: number;
  min?: number;
  minQty?: number;
  available?: number;
  expiry?: string | Date | null;
  warehouseId?: number;
  binId?: number;
}

interface StockRow {
  idKey: string;              // unique composite key or id
  sku?: string | null;
  item: string;
  warehouse: string;
  bin: string;
  onHand: number;
  reserved?: number;
  min: number;
  available: number;
  expiry?: string | Date | null;

  // extra ID fields if needed for backend payload
  warehouseId?: number;
  binId?: number;
  apiRow?: ApiItemRow;        // keep original row for reference
}

@Component({
  selector: 'app-stack-overview',
  templateUrl: './stack-overview.component.html',
  styleUrls: ['./stack-overview.component.scss']
})
export class StackOverviewComponent implements OnInit {
  // ===== Dropdowns =====
  warehouses: Array<{ id: number | string; name: string }> = [];

  // ===== UI states =====
  selectedWarehouse: number | string | null = null;
  minOnly = false;
  expOnly = false;
  searchText = '';

  loading = false;
  errorMsg: string | null = null;

  rows: StockRow[] = [];
  filteredRows: StockRow[] = [];

  selectedKeys = new Set<string>();

  strictSameWarehouse = true;

  stockIssueOptions: Array<{ id: number | string; name: string }> = [];

  adjust: {
    row: StockRow | null;
    stockIssueId?: number | string | null;
    stockIssueName?: string | null;
    originalInHand: number;
    available: number;
    newInHand: number | null;
    minAllowed: number;
    maxAllowed: number;
    qtyError: string | null;
  } = {
    row: null,
    stockIssueId: null,
    stockIssueName: null,
    originalInHand: 0,
    available: 0,
    newInHand: null,
    minAllowed: 1,
    maxAllowed: 0,
    qtyError: null
  };

  constructor(
    private modalService: NgbModal,
    private itemMasterService: ItemMasterService,
    private warehouseService: WarehouseService,
    private stockIssueService: StockIssueService,
    private stockService: StackOverviewService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadMasterItem();
    this.loadWarehouses();
    setTimeout(() => (feather as any)?.replace?.(), 0);
  }

  private toStockRow(api: ApiItemRow): StockRow {
    const name = api.name ?? api.itemName ?? api.sku ?? '(item)';
    const sku = api.sku ?? null;
    const whName = api.warehouse ?? api.wareHouse ?? 'Central';
    const bin = api.bin ?? 'A1';

    const onHand = Number(api.onHand ?? 0);
    const reserved = Number(api.reserved ?? 0);
    const min = Number(api.min ?? api.minQty ?? 0);
    const available = Number(api.available ?? 0);
    const expiry = api.expiry ?? null;

    // composite key or use api.id if unique
    const idKey = [
      api.id ?? '',
      sku ?? '',
      whName,
      bin
    ].join('|').toLowerCase();

    return {
      idKey,
      sku,
      item: String(name),
      warehouse: String(whName),
      bin: String(bin),
      onHand,
      reserved,
      min,
      available,
      expiry,
      warehouseId: api.warehouse ? Number(api.warehouseId) : undefined,
      binId: api.bin ? Number(api.binId) : undefined,
      apiRow: api
    };
  }

  private loadWarehouses(): void {
    this.warehouseService.getWarehouse().subscribe({
      next: (res: any) => {
        if (res?.data) {
          this.warehouses = res.data.map((w: any) => ({
            id: w.id,
            name: w.name
          }));
        }
      },
      error: err => console.error('Error loading warehouses', err)
    });
  }

  loadMasterItem(): void {
    this.loading = true;
    this.errorMsg = null;
    this.itemMasterService.getAllItemMaster().subscribe({
      next: (res: any) => {
        if (res?.isSuccess && Array.isArray(res.data)) {
          this.rows = res.data.map((item: ApiItemRow) => this.toStockRow(item));
          this.filteredRows = [...this.rows];
        } else {
          this.errorMsg = 'No data found.';
        }
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        this.errorMsg = 'Failed to load Item Master list.';
        console.error('Item Master load error', err);
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.rows];
    const whName = this.getWarehouseNameById(this.selectedWarehouse);
    if (whName) {
      filtered = filtered.filter(r => (r.warehouse ?? '').toLowerCase() === whName.toLowerCase());
    }

    if (this.minOnly) {
      filtered = filtered.filter(r => r.onHand <= r.min);
    }

    if (this.expOnly) {
      const today = this.startOfDay(new Date()).getTime();
      const in30 = this.startOfDay(this.addDays(new Date(), 30)).getTime();
      filtered = filtered.filter(r => {
        if (!r.expiry) return false;
        const dt = this.startOfDay(new Date(r.expiry)).getTime();
        return dt >= today && dt <= in30;
      });
    }

    const tokens = this.tokenize(this.searchText);
    if (tokens.length) {
      filtered = filtered.filter(r => {
        const hay = this.normalize([r.item, r.sku, r.bin, r.warehouse].filter(Boolean).join(' | '));
        return tokens.every(t => hay.includes(t));
      });
    }

    this.filteredRows = filtered;
    this.pruneSelectionToVisible();
  }

  private keyOf(r: StockRow): string {
    return r.idKey;
  }

  trackByRow = (_: number, r: StockRow) => this.keyOf(r);

  isSelected(r: StockRow): boolean {
    return this.selectedKeys.has(this.keyOf(r));
  }

  toggleRow(r: StockRow, ev: Event): void {
    const checked = (ev.target as HTMLInputElement).checked;
    const k = this.keyOf(r);

    if (checked && this.strictSameWarehouse && this.selectedKeys.size) {
      const currentWh = this.getSelectedWarehouses();
      const targetWh = r.warehouse;
      if (currentWh.size === 1 && !currentWh.has(targetWh)) {
        // Prevent cross-warehouse selection
        (ev.target as HTMLInputElement).checked = false;
        // You may show an alert or toast
        return;
      }
    }

    if (checked) this.selectedKeys.add(k);
    else this.selectedKeys.delete(k);
  }

  isAllSelected(): boolean {
    if (!this.filteredRows?.length) return false;
    return this.filteredRows.every(r => this.selectedKeys.has(this.keyOf(r)));
  }

  isIndeterminate(): boolean {
    if (!this.filteredRows?.length) return false;
    let sel = 0;
    for (const r of this.filteredRows) {
      if (this.selectedKeys.has(this.keyOf(r))) sel++;
      if (sel && sel < this.filteredRows.length) return true;
    }
    return false;
  }

  toggleAll(ev: Event): void {
    const check = (ev.target as HTMLInputElement).checked;
    if (!check) {
      for (const r of this.filteredRows) {
        this.selectedKeys.delete(this.keyOf(r));
      }
      return;
    }
    if (this.strictSameWarehouse && this.filteredRows.length) {
      const wh = this.filteredRows[0].warehouse;
      for (const r of this.filteredRows) {
        if (r.warehouse === wh) {
          this.selectedKeys.add(this.keyOf(r));
        }
      }
    } else {
      for (const r of this.filteredRows) {
        this.selectedKeys.add(this.keyOf(r));
      }
    }
  }

  private pruneSelectionToVisible(): void {
    const visible = new Set(this.filteredRows.map(r => this.keyOf(r)));
    this.selectedKeys.forEach(k => {
      if (!visible.has(k)) this.selectedKeys.delete(k);
    });
  }

  private getSelectedRows(): StockRow[] {
    return this.rows.filter(r => this.selectedKeys.has(this.keyOf(r)));
  }

  private getSelectedWarehouses(): Set<string> {
    const set = new Set<string>();
    for (const r of this.getSelectedRows()) {
      set.add(r.warehouse);
    }
    return set;
  }

  get sameWarehouseSelected(): boolean {
    const ws = this.getSelectedWarehouses();
    return this.selectedKeys.size > 0 && ws.size === 1;
  }

  get selectedWarehouseName(): string | null {
    if (!this.sameWarehouseSelected) return null;
    return [...this.getSelectedWarehouses()][0] ?? null;
  }

  openAdjustModal(tpl: any, row: StockRow) {
    this.loadStockissue();
    const original = row.onHand;
    const available = row.available;
    const minAllowed = 1;
    const maxAllowed = available;

    const startVal = Math.min(Math.max(original, minAllowed), maxAllowed);

    this.adjust = {
      row,
      stockIssueId: null,
      stockIssueName: null,
      originalInHand: original,
      available,
      newInHand: startVal,
      minAllowed,
      maxAllowed,
      qtyError: null
    };

    this.modalService.open(tpl, { centered: true, backdrop: 'static', keyboard: false });
  }

  onStockIssueChange(issueId: number | string | null) {
    this.adjust.stockIssueId = issueId;
    const found = this.stockIssueOptions.find(x => String(x.id) === String(issueId));
    this.adjust.stockIssueName = found?.name ?? null;
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
    return !!(this.adjust.row && this.adjust.stockIssueId && this.adjust.newInHand != null && !this.adjust.qtyError);
  }

  submitAdjust(modalRef: any) {
    this.validateNewInHand();
    if (!this.canSubmitAdjust()) return;
    if (this.adjust.row) {
      this.adjust.row.onHand = Number(this.adjust.newInHand);
      // Possibly recalc available etc.
    }
    this.applyFilters();
    modalRef.close('submitted');
  }

  loadStockissue() {
    this.stockIssueService.getAllStockissue().subscribe(res => {
      const raw = Array.isArray(res?.data) ? res.data : [];
      this.stockIssueOptions = raw
        .filter(item => item.isActive)
        .map(item => ({ id: item.id, name: item.stockIssuesNames }));
      setTimeout(() => (window as any).feather?.replace?.(), 0);
    });
  }

submitTransfer(): void {
  if (!this.sameWarehouseSelected) {
    alert('Select items from a single warehouse to transfer.');
    return;
  }

  const selRows = this.getSelectedRows();
  const now = new Date();
  const userId = 1001; // TODO: Replace with actual logged-in user ID

  const payload = selRows.map(r => ({
    itemID: r.apiRow?.id,               // from backend API
    fromWarehouseID: r.warehouseId,     // ensure this is available
    toWarehouseID: 0,                   // default to 0
    available: r.available ?? 0,
    onHand: r.onHand ?? 0,
    reserved: r.reserved ?? 0,
    min: r.min ?? 0,
    expiry: r.expiry?? new Date(), // format date as YYYYMM
    isApproved: 0,                      // default false
    createdBy: userId,
    createdDate: now,
    updatedBy: userId,
    updatedDate: now
  }));

  this.stockService.insertStock(payload).subscribe({
    next: res => {
      alert('Transfer successful');
      this.selectedKeys.clear();
      this.loadMasterItem();
    },
    error: err => {
      console.error('Transfer failed', err);
      alert('Transfer failed');
    }
  });
}


  exportData() {
    // implement export logic (e.g. CSV)
  }

  getWarehouseNameById(id: number | string | null): string | null {
    if (id == null || id === '') return null;
    const w = this.warehouses.find(w => String(w.id) === String(id));
    return w ? w.name : null;
  }

  private startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  private addDays(d: Date, days: number): Date {
    const x = new Date(d);
    x.setDate(x.getDate() + days);
    return x;
  }

  private normalize(s: string | null | undefined): string {
    return (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  private tokenize(s: string): string[] {
    return this.normalize(s).split(' ').filter(Boolean);
  }
}
