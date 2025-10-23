import { Component, OnInit, TemplateRef } from '@angular/core';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import Swal from 'sweetalert2';

import { StackOverviewService } from '../../stack-overview/stack-overview.service';
import { WarehouseService } from 'app/main/master/warehouse/warehouse.service';

/** ---- API & UI Types ---------------------------------------------------- */

interface ApiItemRow {
  /** Item identifiers coming from API (support both shapes) */
  itemId?: number | string;       // preferred
  id?: number | string;           // legacy fallback
  stockId?: number | string;      // Stock table Id (required for submit)

  sku?: string;
  name?: string;
  itemName?: string;
  warehouseName?: string;
  binName?: string;

  onHand?: number | string;
  reserved?: number | string;
  min?: number | string;
  minQty?: number | string;
  available?: number | string;

  expiryDate?: string;
  warehouseId?: number | string;
  binId?: number | string;

  isApproved?: boolean;
  isTransfered?: boolean;
  isFullTransfer?: boolean;
  isPartialTransfer?: boolean;

  /** may come as "400.000" */
  transferQty?: number | string;

  /** Optional: if API sets it when a row has already been targeted */
  toWarehouseName?: string | null;
}

type QtyErr = null | 'required' | 'negative' | 'decimal' | 'exceeds';

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
  isApproved?: boolean;
  isTransfered?: boolean;
  isFullTransfer?: boolean;
  isPartialTransfer?: boolean;

  transferQty: number;

  _qtyValid: boolean;
  _qtyErr: QtyErr;

  _sel?: boolean;
}

interface WarehouseOpt { id: number | string; name: string; }

interface SubmitModalState {
  fromWarehouseId: number | string | null;
  toWarehouseId: number | string | null;
  remarks: string | null;
}

/** ---- Component --------------------------------------------------------- */

@Component({
  selector: 'app-stock-transfer-create',
  templateUrl: './stock-transfer-create.component.html',
  styleUrls: ['./stock-transfer-create.component.scss']
})
export class StockTransferCreateComponent implements OnInit {

  rows: StockRow[] = [];
  filteredRows: StockRow[] = [];

  lockedWarehouse: string | null = null;
  fromWarehouseName = '';

  modal: SubmitModalState = { fromWarehouseId: null, toWarehouseId: null, remarks: null };
  modalTouched = false;

  toWarehouseList: WarehouseOpt[] = [];

  constructor(
    private router: Router,
    private stockService: StackOverviewService,
    private warehouseService: WarehouseService,
    private modalSvc: NgbModal
  ) {}

  ngOnInit(): void {
    this.loadMasterItem();
  }

  /* ---------------------------
   * Selection helpers & guards
   * --------------------------*/
  get selectedRows(): StockRow[] { return this.filteredRows.filter(r => !!r._sel); }
  get selectedCount(): number { return this.selectedRows.length; }

  get allVisibleChecked(): boolean {
    const visible = this.filteredRows.filter(r => !this.isRowDisabled(r) && r._qtyValid);
    return visible.length > 0 && visible.every(r => !!r._sel);
  }

  isRowDisabled(r: StockRow): boolean {
    const crossWarehouse = !!this.lockedWarehouse && r.warehouse !== this.lockedWarehouse && !r._sel;
    const noStock = (r.available ?? 0) <= 0;
    return crossWarehouse || noStock;
  }

  onToggleRow(nextValue: boolean, row: StockRow): void {
    if (nextValue) {
      if (this.lockedWarehouse && row.warehouse !== this.lockedWarehouse) {
        row._sel = false;
        Swal.fire({ icon: 'warning', title: 'Different warehouse', text: 'Please select rows from the same warehouse only.', timer: 1300, showConfirmButton: false });
        return;
      }
      if (!row._qtyValid) {
        row._sel = false;
        Swal.fire({ icon: 'warning', title: 'Invalid quantity', text: 'Please enter a valid transfer quantity for this row.', timer: 1300, showConfirmButton: false });
        return;
      }
      if (!this.lockedWarehouse) this.lockedWarehouse = row.warehouse;
      row._sel = true;
    } else {
      row._sel = false;
      if (this.selectedRows.length === 0) this.lockedWarehouse = null;
    }
    this.fromWarehouseName = this.selectedRows.length ? this.selectedRows[0].warehouse : '';
  }

  toggleSelectAll(ev: Event): void {
    const checked = (ev.target as HTMLInputElement).checked;

    if (!checked) {
      this.filteredRows.forEach(r => (r._sel = false));
      this.lockedWarehouse = null;
      this.fromWarehouseName = '';
      return;
    }

    if (!this.lockedWarehouse) {
      this.lockedWarehouse = this.filteredRows[0]?.warehouse ?? null;
    }

    this.filteredRows.forEach(r => {
      const canSelect = r.warehouse === this.lockedWarehouse && !this.isRowDisabled(r) && r._qtyValid;
      r._sel = canSelect;
    });

    this.fromWarehouseName = this.lockedWarehouse ?? '';
  }

  /* ---------------
   * Page actions
   * --------------*/
  get sameWarehouseSelected(): boolean {
    const sel = this.selectedRows;
    if (sel.length === 0) return false;
    const wh = sel[0].warehouse;
    return sel.every(r => r.warehouse === wh);
  }

  openSubmitModal(tpl: TemplateRef<any>): void {
    if (this.selectedCount === 0 || this.hasInvalidSelected()) return;

    const firstRow = this.selectedRows[0];
    const whName = firstRow.warehouse;

    this.modalTouched = false;
    this.modal = {
      fromWarehouseId: firstRow.warehouseId,
      toWarehouseId: null,
      remarks: null
    };
    this.fromWarehouseName = whName;

    this.loadToWareHouse(whName, () => {
      this.modalSvc.open(tpl, { centered: true, size: 'lg', backdrop: 'static' });
    });
  }

  sameWarehouse(): boolean {
    return !!this.modal.fromWarehouseId &&
           !!this.modal.toWarehouseId &&
           this.modal.fromWarehouseId === this.modal.toWarehouseId;
  }

  /** Submit from modal: includes transferQty per selected row */
  submitFromModal(close: (reason?: any) => void): void {
    this.modalTouched = true;
    if (!this.modal.fromWarehouseId || !this.modal.toWarehouseId || this.sameWarehouse()) return;
    if (this.hasInvalidSelected()) return;

    const toId = Number(this.modal.toWarehouseId);
    const remarks = (this.modal.remarks ?? '').trim() || null;

    const keys = this.selectedRows.map(r => {
      const { isFullTransfer, isPartialTransfer } = this.calcTransferFlags(r);

      // derive StockId & ItemId robustly
      const stockIdRaw =
        (r.apiRow as any)?.stockId ??
        (r.apiRow as any)?.StockId;         // backend might send PascalCase

      const itemIdRaw =
        (r.apiRow as any)?.itemId ??
        (r.apiRow as any)?.ItemId ??
        (r.apiRow as any)?.id;

      const stockId = Number(stockIdRaw);
      const itemId  = Number(itemIdRaw);

      if (!Number.isFinite(stockId) || stockId <= 0) {
        throw new Error(`Missing/invalid StockId for row ${r.idKey}`);
      }
      if (!Number.isFinite(itemId) || itemId <= 0) {
        throw new Error(`Missing/invalid ItemId for row ${r.idKey}`);
      }

      // reflect flags in UI immediately (optional)
      r.isFullTransfer = isFullTransfer;
      r.isPartialTransfer = isPartialTransfer;

      return {
        stockId,                                        // 👈 Stock.Id for Stock table update
        itemId,                                         // useful for IWS update
        warehouseId: Number(r.warehouseId),             // FROM
        binId: (r.binId == null ? null : Number(r.binId)),
        toWarehouseId: toId,                            // TO
        transferQty: Number(r.transferQty),
        remarks,
        isFullTransfer,
        isPartialTransfer
      };
    });

    this.stockService.ApproveTransfersBulk(keys).subscribe({
      next: _ => {
        this.removeSelectedFromData();
        close();
        Swal.fire('Submitted', 'Transfer sent for approval.', 'success');
        this.router.navigate(['/Inventory/list-stocktransfer']);
        this.loadMasterItem();
      },
      error: err => {
        console.error(err);
        Swal.fire('Failed', err?.message || 'Something went wrong', 'error');
      }
    });
  }

  private calcTransferFlags(r: StockRow) {
    const avail = Math.max(0, Number(r.available ?? 0));
    const qty   = Math.max(0, Number(r.transferQty ?? 0));
    const remaining = Math.max(0, avail - qty);

    const isFullTransfer    = qty > 0 && remaining === 0;
    const isPartialTransfer = qty > 0 && remaining > 0;

    return { isFullTransfer, isPartialTransfer, remaining };
  }

  cancel(): void {
    this.router.navigate(['/inventory/stock-transfer']);
  }

  /* ---------------
   * Data loading
   * --------------*/
  loadMasterItem(): void {
    this.stockService.GetAllStockTransferedList().subscribe({
      next: (res: any) => {
        const list: ApiItemRow[] = res?.isSuccess && Array.isArray(res.data) ? res.data : [];
        this.rows = list.map(item => this.primeRow(this.toStockRow(item)));

        // filter candidates for NEW transfer
        this.filteredRows = this.rows.filter(r =>
          r.isTransfered === true &&
          r.isPartialTransfer === false &&
          (r.transferQty == null || Number(r.transferQty) === 0)
        );

        // de-dupe by composite key
        const byKey = new Map<string, StockRow>();
        for (const r of this.filteredRows) {
          const k = r.idKey;
          const curr = byKey.get(k);
          if (!curr || Number(r.transferQty ?? 0) < Number(curr.transferQty ?? 0)) {
            byKey.set(k, r);
          }
        }
        this.filteredRows = Array.from(byKey.values());

        // reset selection/lock
        this.filteredRows.forEach(r => (r._sel = false));
        this.lockedWarehouse = null;
        this.fromWarehouseName = '';
      },
      error: (err) => {
        console.error('Load stock transfer list failed', err);
        this.rows = [];
        this.filteredRows = [];
        this.lockedWarehouse = null;
        this.fromWarehouseName = '';
      }
    });
  }

  loadToWareHouse(fromName: string, done?: () => void): void {
    this.warehouseService.GetNameByWarehouseAsync(fromName).subscribe({
      next: (res: any) => { this.toWarehouseList = (res?.data ?? []) as WarehouseOpt[]; done?.(); },
      error: (err) => { console.error('Load To Warehouse failed', err); this.toWarehouseList = []; done?.(); }
    });
  }

  /* ---------------
   * Mapping helpers
   * --------------*/
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

    // preserve transferQty if present
    const apiTransfer = (api.transferQty as any);
    const preservedTransfer = (apiTransfer === null || apiTransfer === undefined) ? 0 : Number(apiTransfer);

    // choose item id (ItemId or legacy id)
    const itemIdRaw = (api.itemId ?? api.id) as any;
    const itemId = Number(itemIdRaw);

    const stockIdRaw = (api.stockId as any);
    const stockId = Number(stockIdRaw);

    return {
      // include stockId and itemId in idKey to avoid collisions
      idKey: [stockId || '', itemId || '', warehouse, item, sku ?? '', bin].join('|').toLowerCase(),

      warehouse,
      item,
      sku,
      bin,
      onHand,
      reserved,
      min,
      available,
      expiry,
      warehouseId: Number(api.warehouseId as any),
      binId: api.binId == null ? undefined : Number(api.binId as any),

      apiRow: api,
      isApproved: !!api.isApproved,
      isTransfered: !!api.isTransfered,
      isFullTransfer: !!api.isFullTransfer,
      isPartialTransfer: !!api.isPartialTransfer,

      transferQty: Number.isFinite(preservedTransfer) ? preservedTransfer : 0,

      _qtyValid: false,
      _qtyErr: 'required',
      _sel: false
    };
  }

  private primeRow(row: StockRow): StockRow {
    const n = Number(row.transferQty ?? 0);
    const valid = this.validateQty(n, row.available);
    return { ...row, transferQty: Number.isFinite(n) ? n : 0, _qtyValid: valid.ok, _qtyErr: valid.err };
  }

  /* ---------------
   * Quantity validation
   * --------------*/
  private validateQty(n: number, available: number): { ok: boolean; err: QtyErr } {
    if (n == null || Number.isNaN(n) || n === 0) return { ok: false, err: 'required' };
    if (!Number.isInteger(n)) return { ok: false, err: 'decimal' };
    if (n < 0) return { ok: false, err: 'negative' };
    if (n > Math.max(0, available ?? 0)) return { ok: false, err: 'exceeds' }; // allow <= available
    return { ok: true, err: null };
  }

  onQtyChange(row: StockRow, value: any) {
    let n = Number(value);

    if (value === '' || value === null || Number.isNaN(n)) {
      row.transferQty = 0; row._qtyValid = false; row._qtyErr = 'required'; this.recomputeSelectionMeta(); return;
    }
    if (!Number.isInteger(n)) {
      n = Math.floor(n);
      row.transferQty = n; row._qtyValid = false; row._qtyErr = 'decimal'; this.recomputeSelectionMeta(); return;
    }
    if (n < 0) {
      row.transferQty = 0; row._qtyValid = false; row._qtyErr = 'negative'; this.recomputeSelectionMeta(); return;
    }

    const available = Math.max(0, Number(row.available ?? 0));
    if (n > available) {
      row.transferQty = n; row._qtyValid = false; row._qtyErr = 'exceeds'; this.recomputeSelectionMeta(); return;
    }

    row.transferQty = n;
    row._qtyValid = n > 0;
    row._qtyErr = row._qtyValid ? null : 'required';
    this.recomputeSelectionMeta();
  }

  digitsOnly(e: KeyboardEvent) {
    const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
    if (allowed.includes(e.key)) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
  }

  hasInvalidSelected(): boolean {
    return this.filteredRows?.some(r => {
      if (!r._sel) return false;
      // stockId guard
      const stockId =
        (r.apiRow as any)?.stockId ??
        (r.apiRow as any)?.StockId;
      const okStock = Number.isFinite(Number(stockId)) && Number(stockId) > 0;
      return !r._qtyValid || !okStock;
    }) ?? false;
  }

  private recomputeSelectionMeta() {
    // reserved for side-effects if needed
  }

  /* ---------------
   * Template helpers
   * --------------*/
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

  private removeSelectedFromData(): void {
    const toRemove = new Set(this.selectedRows.map(r => r.idKey));
    this.rows = this.rows.filter(r => !toRemove.has(r.idKey));
    this.filteredRows = this.filteredRows.filter(r => !toRemove.has(r.idKey));
    this.filteredRows.forEach(r => (r._sel = false));
    this.lockedWarehouse = null;
    this.fromWarehouseName = '';
  }
}
