import { Component, OnInit } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ItemMasterService } from '../item-master/item-master.service';
import { WarehouseService } from 'app/main/master/warehouse/warehouse.service';
import { StockIssueService } from 'app/main/master/stock-issue/stock-issue.service';
import * as feather from 'feather-icons';
import { Router } from '@angular/router';
import { StackOverviewService } from './stack-overview.service';
import Swal from 'sweetalert2';

// NEW: export libs
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  selector: 'app-stack-overview',
  templateUrl: './stack-overview.component.html',
  styleUrls: ['./stack-overview.component.scss']
})
export class StackOverviewComponent implements OnInit {
  warehouses: Array<{ id: number | string; name: string }> = [];
  exportFileName = ''; // <-- will be auto-filled as stock-overview-YYYYMMDDHHmmss

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
    reserved: number;
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
    reserved: 0,
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

  // ===== Helpers for fixed filename =====
  private pad(n: number, w = 2): string { return String(n).padStart(w, '0'); }

  private timestamp(): string {
    const now = new Date();
    return `${now.getFullYear()}${this.pad(now.getMonth() + 1)}${this.pad(now.getDate())}` +
           `${this.pad(now.getHours())}${this.pad(now.getMinutes())}${this.pad(now.getSeconds())}`;
  }

  private sanitizeBaseName(s: string): string {
    return (s || 'stock-overview')
      .replace(/[\\/:*?"<>|]+/g, '')   // illegal FS chars
      .replace(/\s+/g, '-')            // spaces -> dashes
      .trim()
      || 'stock-overview';
  }

  private buildFixedFileBase(): string {
    // always "stock-overview-YYYYMMDDHHmmss"
    const base = this.sanitizeBaseName('stock-overview');
    return `${base}-${this.timestamp()}`.toLowerCase();
  }

  private safeFile(s: string): string {
    // keep for final sanitation before saving (no extension)
    return this.sanitizeBaseName(s).toLowerCase();
  }

  // ===== Expiry parsing =====
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
    const available = Number(api.available != null ? api.available : (onHand - reserved));
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

    this.stockService.GetAllStockList().subscribe({
      next: (res: any) => {
        if (res?.isSuccess && Array.isArray(res.data)) {
          this.rows = res.data.map((item: ApiItemRow) => this.toStockRow(item));
          this.filteredRows = [...this.rows];
        } else {
          this.errorMsg = 'No stock data found.';
        }
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = 'Failed to load stock list.';
        console.error('Stock list load error', err);
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
        (ev.target as HTMLInputElement).checked = false;
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

  // ===== Modals / Stock Issue / Adjustment =====
  openAdjustModal(tpl: any, row: StockRow) {
    this.loadStockissue();

    const original = Number(row.onHand ?? 0);
    const reserved = Number(row.reserved ?? 0);
    const available = Number(row.available ?? Math.max(0, original - reserved));
    const minAllowed = Math.max(0, original - available);
    const maxAllowed = original + available;

    this.adjust = {
      row,
      stockIssueId: null,
      stockIssueName: null,
      originalInHand: original,
      reserved,
      available,
      newInHand: original,
      minAllowed,
      maxAllowed,
      qtyError: null
    };

    this.modalService.open(tpl, { centered: true, backdrop: 'static', keyboard: false });
    setTimeout(() => (window as any).feather?.replace?.(), 0);
  }

  validateNewInHand() {
    const { minAllowed, maxAllowed } = this.adjust;
    let v = Number(this.adjust.newInHand);
    if (!Number.isFinite(v)) {
      this.adjust.qtyError = 'Enter a valid number.';
      return;
    }
    if (v < minAllowed || v > maxAllowed) {
      this.adjust.qtyError = `In-hand must be between ${minAllowed} and ${maxAllowed}.`;
    } else {
      this.adjust.qtyError = null;
    }
  }

  onInHandBlur() {
    const { minAllowed, maxAllowed } = this.adjust;
    let v = Number(this.adjust.newInHand);
    if (!Number.isFinite(v)) v = this.adjust.originalInHand;
    if (v < minAllowed) v = minAllowed;
    if (v > maxAllowed) v = maxAllowed;
    this.adjust.newInHand = v;
    this.validateNewInHand();
  }

  canSubmitAdjust(): boolean {
    return !!(this.adjust.row && this.adjust.stockIssueId != null && this.adjust.newInHand != null && this.adjust.qtyError == null);
  }

  onStockIssueChange(issueId: number | string | null) {
    this.adjust.stockIssueId = issueId;
    const found = this.stockIssueOptions.find(x => String(x.id) === String(issueId));
    this.adjust.stockIssueName = found?.name ?? null;
  }

  // ✅ Backend call to update OnHand + Available (payload includes stockIssueId)
  submitAdjust(modalRef: any) {
    this.validateNewInHand();
    if (!this.canSubmitAdjust() || !this.adjust.row) return;

    const row = this.adjust.row;
    const payload = {
      itemId: row.apiRow?.id,
      warehouseId: row.apiRow?.warehouseId,
      binId: row.apiRow?.binId,
      newOnHand: Number(this.adjust.newInHand),
      stockIssueId: this.adjust.stockIssueId ?? null
    };

    this.loading = true;
    this.stockService.AdjustOnHand(payload).subscribe({
      next: (res: any) => {
        this.loading = false;

        const onHand = Number(res?.data?.onHand ?? payload.newOnHand);
        const reserved = Number(res?.data?.reserved ?? row.reserved ?? 0);
        const available = Number(res?.data?.available ?? (onHand - reserved));

        row.onHand = onHand;
        row.reserved = reserved;
        row.available = available;

        this.applyFilters();

        Swal.fire({
          icon: 'success',
          title: 'Adjustment Successful',
          text: 'Stock levels updated successfully.',
          confirmButtonColor: '#2E5F73'
        });

        modalRef.close('submitted');
      },
      error: (err) => {
        this.loading = false;
        console.error('Adjust failed', err);
        Swal.fire({
          icon: 'error',
          title: 'Adjustment Failed',
          text: err?.error?.message || 'Could not adjust stock.',
          confirmButtonColor: '#d33'
        });
      }
    });
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

  private toSqlDate(d: Date | null | undefined): string | null {
    if (!d) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // ===== Transfer =====
  submitTransfer(): void {
    if (!this.sameWarehouseSelected) {
      alert('Select items from a single warehouse to transfer.');
      return;
    }

    const selRows = this.getSelectedRows();
    if (!selRows.length) {
      alert('No items selected.');
      return;
    }

    const now = new Date();
    const userId = 1001;
    const toWarehouseID = 0;

    const payload = selRows.map(r => ({
      ItemId: r.apiRow?.id,
      Available: r.available ?? 0,
      OnHand: r.onHand ?? 0,
      Reserved: r.reserved ?? 0,
      Min: r.min ?? 0,
      Expiry: this.toSqlDate(r.expiry),
      CreatedBy: userId,
      CreatedDate: now,
      UpdatedBy: userId,
      UpdatedDate: now,
      FromWarehouseID: r.warehouseId ?? null,
      ToWarehouseID: toWarehouseID,
      IsApproved: false,
      FromWarehouseName: r.warehouse ?? '',
      ItemName: r.item ?? '',
      Sku: r.sku ?? '',
      BinId: r.binId ?? null,
      BinName: r.bin ?? '',
      remarks:'',
      transferQty:0
    }));

    this.stockService.insertStock(payload).subscribe({
      next: _res => {
        const transferRequests = selRows.map(r => ({
          itemId: r.apiRow?.id,
          warehouseId: r.warehouseId,
          binId: r.binId
        }));

        this.stockService.markAsTransferredBulk(transferRequests).subscribe({
          next: () => {
            Swal.fire({
              icon: 'success',
              title: 'Transfer Successful',
              text: 'Selected items have been transferred successfully.',
              confirmButtonColor: '#2E5F73'
            }).then(() => {
              this.selectedKeys.clear();
              this.router.navigate(['/Inventory/create-stocktransfer']);
            });
          },
          error: err => {
            console.error('Failed to mark transferred', err);
            Swal.fire({
              icon: 'warning',
              title: 'Partial Success',
              text: 'Stock inserted but some items could not be marked as transferred.',
              confirmButtonColor: '#d33'
            });
          }
        });
      },
      error: err => {
        console.error('Transfer failed', err);
        Swal.fire({
          icon: 'error',
          title: 'Transfer Failed',
          text: 'Something went wrong during transfer. Please try again.',
          confirmButtonColor: '#d33'
        });
      }
    });
  }

  // ===== Export =====
  openExportModal(tpl: any) {
    // refresh the timestamp each time user opens the modal
    this.exportFileName = this.safeFile(this.buildFixedFileBase()); // e.g. stock-overview-20251022070730
    this.modalService.open(tpl, { centered: true, backdrop: 'static', keyboard: false });
  }

  private buildExportRows(): Array<Record<string, any>> {
    const toDate = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');
    return (this.filteredRows || []).map(r => ({
      Warehouse: r.warehouse ?? '',
      Item: r.item ?? '',
      SKU: r.sku ?? '',
      Bin: r.bin ?? '',
      OnHand: r.onHand ?? 0,
      Reserved: r.reserved ?? 0,
      Min: r.min ?? 0,
      Available: r.available ?? 0,
      Expiry: toDate(r.expiry),
    }));
  }

  exportAsExcel(): void {
    const data = this.buildExportRows();
    const ws = XLSX.utils.json_to_sheet(data);
    (ws as any)['!cols'] = [
      { wch: 18 }, { wch: 28 }, { wch: 14 }, { wch: 12 },
      { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Overview');

    const base = this.exportFileName || this.safeFile(this.buildFixedFileBase());
    XLSX.writeFile(wb, `${base}.xlsx`);
  }

  exportAsPdf(): void {
    const data = this.buildExportRows();
    const headers = [['Warehouse', 'Item', 'SKU', 'Bin', 'On Hand', 'Reserved', 'Min', 'Available', 'Expiry']];
    const body = data.map(r => [r.Warehouse, r.Item, r.SKU, r.Bin, r.OnHand, r.Reserved, r.Min, r.Available, r.Expiry]);

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(12);
    doc.setFillColor(46, 95, 115);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 46, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('Stock Overview', 40, 30);

    doc.setTextColor(0, 0, 0);
    autoTable(doc, {
      head: headers,
      body,
      startY: 64,
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [46, 95, 115], textColor: [255, 255, 255] },
      theme: 'grid',
      tableWidth: 'auto',
    });

    const base = this.exportFileName || this.safeFile(this.buildFixedFileBase());
    doc.save(`${base}.pdf`);
  }

  // ===== Misc helpers =====
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
