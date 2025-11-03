import { Component, OnInit } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import * as feather from 'feather-icons';
import Swal from 'sweetalert2';

// Services
import { ItemMasterService } from '../item-master/item-master.service';
import { WarehouseService } from 'app/main/master/warehouse/warehouse.service';
import { StockIssueService } from 'app/main/master/stock-issue/stock-issue.service';
import { StackOverviewService } from './stack-overview.service';
import { ApprovallevelService } from 'app/main/master/approval-level/approvallevel.service';
import { Router } from '@angular/router';

// Export libs
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/* ===================== Interfaces ===================== */

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
  qty?: number | null;            // may come from API as the quantity to show
  supplierName?: string | null;
  supplierId?: number | null;     // ✅ required for selection grouping
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

  // UI fields
  supplierName: string;
  qty: number;

  apiRow?: ApiItemRow;
  supplierId?: number | null;     // ✅ used in selection grouping
}

interface SimpleOption { id: number | string; name: string; }

/* ===================== Component ===================== */

@Component({
  selector: 'app-stack-overview',
  templateUrl: './stack-overview.component.html',
  styleUrls: ['./stack-overview.component.scss']
})
export class StackOverviewComponent implements OnInit {
  /* Lists */
  warehouses: Array<{ id: number | string; name: string }> = [];
  stockIssueOptions: Array<SimpleOption> = [];
  approvedByOptions: Array<SimpleOption> = [];

  /* Filters */
  selectedWarehouse: number | string | null = null;
  minOnly = false;
  expOnly = false;
  searchText = '';

  /* Data */
  rows: StockRow[] = [];
  filteredRows: StockRow[] = [];
  selectedKeys = new Set<string>();
  exportFileName = '';

  /* State */
  loading = false;
  errorMsg: string | null = null;

  /* Adjust modal model */
  adjust: {
    row: StockRow | null;
    stockIssueId: number | string | null;
    stockIssueName: string | null;
    originalInHand: number;
    available: number;
    reserved: number;
    newInHand: number | null;
    minAllowed: number;
    maxAllowed: number;
    qtyError: string | null;

    approvedById: number | string | null;
    approvedByName: string | null;
    faultQty: number | null;
    faultQtyError: string | null;
  } = {
    row: null,
    stockIssueId: null,
    stockIssueName: null,
    originalInHand: 0,
    available: 0,
    reserved: 0,
    newInHand: null,
    minAllowed: 0,
    maxAllowed: Number.MAX_SAFE_INTEGER,
    qtyError: null,
    approvedById: null,
    approvedByName: null,
    faultQty: null,
    faultQtyError: null
  };

  constructor(
    private modalService: NgbModal,
    private itemMasterService: ItemMasterService,
    private warehouseService: WarehouseService,
    private stockIssueService: StockIssueService,
    private stockService: StackOverviewService,
    private approvedlevelService: ApprovallevelService,
    private router: Router
  ) {}

  /* ===================== Lifecycle ===================== */

  ngOnInit(): void {
    this.loadApproved();
    this.loadWarehouses();
    this.loadMasterItem();
    setTimeout(() => (feather as any)?.replace?.(), 0);
  }

  /* ===================== Loaders ===================== */

  private loadWarehouses(): void {
    this.warehouseService.getWarehouse().subscribe({
      next: (res: any) => {
        const data = Array.isArray(res?.data) ? res.data : [];
        this.warehouses = data.map((w: any) => ({ id: w.id, name: w.name || w.warehouseName || `WH-${w.id}` }));
      },
      error: (err) => console.error('Error loading warehouses', err)
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
          setTimeout(() => (feather as any)?.replace?.(), 0);
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

  loadStockissue(): void {
    this.stockIssueService.getAllStockissue().subscribe({
      next: (res: any) => {
        const raw = Array.isArray(res?.data) ? res.data : [];
        this.stockIssueOptions = raw
          .filter((x: any) => x?.isActive)
          .map((x: any) => ({ id: x.id, name: x.stockIssuesNames }));
        setTimeout(() => (window as any).feather?.replace?.(), 0);
      },
      error: (err) => console.error('Failed to load stock issues', err)
    });
  }
  loadApproved(): void {
    this.approvedlevelService.getAllApprovalLevel().subscribe({
      next: (res: any) => {
        const raw = Array.isArray(res?.data) ? res.data : [];
        this.approvedByOptions = raw.map((x: any) => ({
          id: x.id,
          name: x.name || x.levelName || `User-${x.id}`
        }));
      },
      error: (err) => console.error('Failed to load approvers', err)
    });
  }

  /* ===================== Normalize API → UI ===================== */

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

    // Prefer explicit qty if present; else use onHand
    const qty = Number(api.qty ?? onHand);
    const supplierName = (api.supplierName ?? '').toString().trim() || '-';
    const supplierId = api.supplierId ?? null;

    const keyParts = [
      api.id ?? '',
      warehouse,
      item,
      sku ?? '',
      bin,
      String(supplierId ?? '')
    ];
    const idKey = keyParts.join('|').toLowerCase();

    return {
      idKey,
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
      supplierName,
      qty,
      supplierId,
      apiRow: api
    };
  }

  /* ===================== Filters ===================== */

  applyFilters(): void {
    let filtered = [...this.rows];

    const whName = this.getWarehouseNameById(this.selectedWarehouse);
    if (whName) {
      filtered = filtered.filter(r => (r.warehouse ?? '').toLowerCase() === whName.toLowerCase());
    }

    if (this.minOnly) filtered = filtered.filter(r => r.onHand <= r.min);

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
        const hay = this.normalize([
          r.item, r.sku, r.bin, r.warehouse, r.supplierName
        ].filter(Boolean).join(' | '));
        return tokens.every(t => hay.includes(t));
      });
    }

    this.filteredRows = filtered;
    this.pruneSelectionToVisible();
  }

  /* ===================== Selection ===================== */

  private keyOf(r: StockRow): string { return r.idKey; }
  trackByRow = (_: number, r: StockRow) => this.keyOf(r);

  isSelected(r: StockRow): boolean {
    return this.selectedKeys.has(this.keyOf(r));
  }

  private getSelectedRows(): StockRow[] {
    return this.rows.filter(r => this.selectedKeys.has(this.keyOf(r)));
  }

  private getSelectedWarehouses(): Set<string> {
    const set = new Set<string>();
    for (const r of this.getSelectedRows()) set.add(r.warehouse);
    return set;
  }

  private getSelectedSuppliers(): Set<string> {
    const set = new Set<string>();
    for (const r of this.getSelectedRows()) set.add(String(r.supplierId ?? ''));
    return set;
  }

  get sameWarehouseSelected(): boolean {
    const ws = this.getSelectedWarehouses();
    return this.selectedKeys.size > 0 && ws.size === 1;
  }

  get sameSupplierSelected(): boolean {
    const ss = this.getSelectedSuppliers();
    return this.selectedKeys.size > 0 && ss.size === 1;
  }

  toggleRow(r: StockRow, ev: Event): void {
    const checked = (ev.target as HTMLInputElement).checked;
    const k = this.keyOf(r);

    if (checked && this.selectedKeys.size) {
      const currentWh = this.getSelectedWarehouses();
      const currentSup = this.getSelectedSuppliers();
      const targetWh  = r.warehouse;
      const targetSup = String(r.supplierId ?? '');

      if ((currentWh.size === 1 && !currentWh.has(targetWh)) ||
          (currentSup.size === 1 && !currentSup.has(targetSup))) {
        (ev.target as HTMLInputElement).checked = false; // revert UI
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
    const total = this.filteredRows.length;
    let sel = 0;
    for (const r of this.filteredRows) if (this.selectedKeys.has(this.keyOf(r))) sel++;
    return sel > 0 && sel < total;
  }

  toggleAll(ev: Event): void {
    const check = (ev.target as HTMLInputElement).checked;

    if (!check) {
      for (const r of this.filteredRows) this.selectedKeys.delete(this.keyOf(r));
      return;
    }

    if (this.filteredRows.length) {
      // Anchor = first visible row’s warehouse + supplier
      const baseWh  = this.filteredRows[0].warehouse;
      const baseSup = String(this.filteredRows[0].supplierId ?? '');

      for (const r of this.filteredRows) {
        if (r.warehouse === baseWh && String(r.supplierId ?? '') === baseSup) {
          this.selectedKeys.add(this.keyOf(r));
        }
      }
    }
  }

  private pruneSelectionToVisible(): void {
    const visible = new Set(this.filteredRows.map(r => this.keyOf(r)));
    this.selectedKeys.forEach(k => {
      if (!visible.has(k)) this.selectedKeys.delete(k);
    });
  }

  /* ===================== Adjust Modal ===================== */

  openAdjustModal(tpl: any, row: StockRow) {
    this.loadStockissue();

    const original = Number(row.onHand ?? 0);
    const reserved = Number(row.reserved ?? 0);
    const available = Number(row.available ?? Math.max(0, original - reserved));

    this.adjust = {
      row,
      stockIssueId: null,
      stockIssueName: null,
      originalInHand: original,
      reserved,
      available,
      newInHand: Number(row.qty ?? 0),        // show the editable Qty
      minAllowed: 0,
      maxAllowed: Number.MAX_SAFE_INTEGER,
      qtyError: null,

      approvedById: null,
      approvedByName: null,
      faultQty: null,
      faultQtyError: null
    };

    this.modalService.open(tpl, { centered: true, backdrop: 'static', keyboard: false });
    setTimeout(() => (window as any).feather?.replace?.(), 0);
  }

  validateNewInHand() {
    const raw = this.adjust.newInHand;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      this.adjust.qtyError = 'Enter a valid non-negative number.';
      return;
    }
    if (!Number.isInteger(n)) {
      this.adjust.qtyError = 'Whole numbers only.';
      return;
    }
    this.adjust.qtyError = null;
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

  onApprovedByChange(selected: any): void {
    const approver = this.approvedByOptions.find(x => x.id === selected);
    this.adjust.approvedByName = approver ? approver.name : '';
  }
validateFaultQty() {
  const raw = this.adjust.faultQty;
  const reserved = Number(this.adjust.row?.reserved ?? 0); // ✅ reserved qty from selected row

  if (raw == null || (raw as any) === '') {
    this.adjust.faultQtyError = null;
    return;
  }

  const n = Number(raw);
  const cap = Number(this.adjust.newInHand ?? 0);

  if (!Number.isFinite(n) || n < 0) {
    this.adjust.faultQtyError = 'Fault qty cannot be negative.';
    return;
  }

  if (!Number.isInteger(n)) {
    this.adjust.faultQtyError = 'Whole numbers only.';
    return;
  }

  // ✅ NEW VALIDATION RULE
  if (n < reserved) {
    this.adjust.faultQtyError = `Fault Qty cannot be less than Reserved Qty (${reserved}).`;
    return;
  }

  if (n > cap) {
    this.adjust.faultQtyError = `Fault qty must be ≤ ${cap}.`;
    return;
  }

  this.adjust.faultQtyError = null;
}


  canSubmitAdjust(): boolean {
    const hasRow = !!this.adjust.row;
    const hasIssue = this.adjust.stockIssueId != null;
    const hasQty = this.adjust.newInHand != null && this.adjust.qtyError == null;
    const hasApprover = this.adjust.approvedById != null;
    const faultOk = this.adjust.faultQtyError == null;
    return !!(hasRow && hasIssue && hasQty && hasApprover && faultOk);
  }

  
submitAdjust(modalRef: any) {
  // --- Step 1: Validate user input
  this.validateNewInHand();
  this.validateFaultQty();
  if (!this.canSubmitAdjust() || !this.adjust.row) return;

  const row = this.adjust.row;

  // --- Step 2: Calculate final quantity (newOnHand - faultQty)
  const enteredQty = Number(this.adjust.newInHand ?? 0);
  const faultQty = Number(this.adjust.faultQty ?? 0);
  const finalQty = enteredQty - faultQty;   // ✅ subtract fault qty

  if (finalQty < 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Invalid Quantity',
      text: 'Final quantity cannot be negative.',
      confirmButtonColor: '#d33'
    });
    return;
  }

  // --- Step 3: Build payload for API
  const payload = {
    itemId: Number(row.apiRow?.id ?? 0),
    warehouseId: Number(row.warehouseId ?? 0),
    binId: row.binId ?? null,
    supplierId: Number(row.supplierId ?? 0),
    newOnHand: finalQty, // ✅ adjusted quantity
    stockIssueId: Number(this.adjust.stockIssueId ?? 0),
    approvedBy: this.adjust.approvedById, // ✅ approver dropdown value
    updatedBy: 'system' // or current user name
  };

  // --- Step 4: Call API
  this.loading = true;
  this.stockService.AdjustOnHand(payload).subscribe({
    next: (res: any) => {
      this.loading = false;

      // --- Step 5: Update UI row
      const newOnHand = Number(payload.newOnHand);
      row.onHand = newOnHand;
      row.qty = newOnHand;

      this.applyFilters();

      // --- Step 6: Success alert
      Swal.fire({
        icon: 'success',
        title: 'Adjustment Successful',
        text: `Stock successfully updated.`,
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




  /* ===================== Transfer ===================== */

  submitTransfer(): void {
    if (!this.sameWarehouseSelected || !this.sameSupplierSelected) {
      Swal.fire({ icon: 'warning', title: 'Selection required', text: 'Pick items from a single warehouse AND a single supplier.' });
      return;
    }

    const selRows = this.getSelectedRows();
    if (!selRows.length) {
      Swal.fire({ icon: 'info', title: 'Nothing to transfer', text: 'Select at least one row.' });
      return;
    }

    const now = new Date();
    const userId = 1001; // replace with real current user
    const toWarehouseID: number | null = 0;
    const toBinId: number | null = 0;

    const payload = selRows.map(r => ({
      ItemId: Number(r.apiRow?.id ?? 0),
      FromWarehouseID: Number(r.warehouseId ?? 0),
      ToWarehouseID: toWarehouseID,
      ToBinId: toBinId,
      Available: Number(r.qty ?? 0),
      OnHand: Number(r.qty ?? 0),
      IsApproved: false,
      CreatedBy: userId,
      CreatedDate: now,
      UpdatedBy: userId,
      UpdatedDate: now,
      FromWarehouseName: r.warehouse ?? '',
      ItemName: r.item ?? '',
      Sku: r.sku ?? '',
      BinId: r.binId ?? null,
      BinName: r.bin ?? '',
      Remarks: '',
      SupplierId: Number(r.supplierId ?? 0), // supplier context
      IsSupplierBased: true
    }));

    this.stockService.insertStock(payload).subscribe({
      next: _res => {
        const transferRequests = selRows.map(r => ({
          itemId: Number(r.apiRow?.id ?? 0),
          warehouseId: Number(r.warehouseId ?? 0),
          binId: r.binId ?? null,
          supplierId: Number(r.supplierId ?? 0)
        }));

        this.stockService.markAsTransferredBulk(transferRequests).subscribe({
          next: () => {
            Swal.fire({
              icon: 'success',
              title: 'Transfer Successful',
              text: 'Selected items have been transferred.',
              confirmButtonColor: '#2E5F73'
            }).then(() => {
              this.loadMasterItem();
              this.selectedKeys.clear();
              this.router.navigate(['/Inventory/create-stocktransfer']);
            });
          },
          error: err => {
            console.error('Failed to mark transferred', err);
            Swal.fire({
              icon: 'warning',
              title: 'Partial Success',
              text: 'Stock inserted but some rows could not be marked as transferred.'
            });
          }
        });
      },
      error: err => {
        console.error('Transfer failed', err);
        Swal.fire({
          icon: 'error',
          title: 'Transfer Failed',
          text: 'Something went wrong during transfer.'
        });
      }
    });
  }

  /* ===================== Export ===================== */

  openExportModal(tpl: any) {
    this.exportFileName = this.safeFile(this.buildFixedFileBase()); // stock-overview-YYYYMMDDHHmmss
    this.modalService.open(tpl, { centered: true, backdrop: 'static', keyboard: false });
  }

  private buildExportRows(): Array<Record<string, any>> {
    return (this.filteredRows || []).map(r => ({
      Warehouse: r.warehouse ?? '',
      Item: r.item ?? '',
      SKU: r.sku ?? '',
      Bin: r.bin ?? '',
      Supplier: r.supplierName ?? '',
      OnHand: r.onHand ?? 0
    }));
  }

  exportAsExcel(): void {
    const data = this.buildExportRows();
    const ws = XLSX.utils.json_to_sheet(data);
    (ws as any)['!cols'] = [
      { wch: 18 }, { wch: 28 }, { wch: 14 }, { wch: 12 },
      { wch: 18 }, { wch: 10 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Overview');
    const base = this.exportFileName || this.safeFile(this.buildFixedFileBase());
    XLSX.writeFile(wb, `${base}.xlsx`);
  }

  exportAsPdf(): void {
    const data = this.buildExportRows();
    const headers = [['Warehouse', 'Item', 'SKU', 'Bin', 'Supplier', 'On Hand']];
    const body = data.map(r => [r.Warehouse, r.Item, r.SKU, r.Bin, r.Supplier, r.OnHand]);

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

  /* ===================== Misc Helpers ===================== */

  getWarehouseNameById(id: number | string | null): string | null {
    if (id == null || id === '') return null;
    const w = this.warehouses.find(x => String(x.id) === String(id));
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

  private pad(n: number, w = 2): string { return String(n).padStart(w, '0'); }

  private timestamp(): string {
    const now = new Date();
    return `${now.getFullYear()}${this.pad(now.getMonth() + 1)}${this.pad(now.getDate())}`
         + `${this.pad(now.getHours())}${this.pad(now.getMinutes())}${this.pad(now.getSeconds())}`;
  }

  private sanitizeBaseName(s: string): string {
    return (s || 'stock-overview')
      .replace(/[\\/:*?"<>|]+/g, '')
      .replace(/\s+/g, '-')
      .trim()
      || 'stock-overview';
  }

  private buildFixedFileBase(): string {
    const base = this.sanitizeBaseName('stock-overview');
    return `${base}-${this.timestamp()}`.toLowerCase();
  }

  private safeFile(s: string): string {
    return this.sanitizeBaseName(s).toLowerCase();
  }
}
