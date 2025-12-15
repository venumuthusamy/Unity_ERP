import { Component, OnInit, TemplateRef } from '@angular/core';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import Swal from 'sweetalert2';

import { StackOverviewService } from '../../stack-overview/stack-overview.service';
import { WarehouseService } from 'app/main/master/warehouse/warehouse.service';
import { BinService } from 'app/main/master/bin/bin.service';
import { StockAdjustmentService } from '../../stock-adjustment/stock-adjustment.service';

/** ---- API & UI Types ---------------------------------------------------- */

interface ApiItemRow {
  itemId?: number | string;
  id?: number | string;
  stockId?: number | string;

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

  transferQty?: number | string;

  toWarehouseName?: string | null;

  supplierId?: number | string | null;
  supplierName?: string | null;
}

type QtyErr = null | 'required' | 'negative' | 'decimal' | 'exceeds';

interface StockRow {
  idKey: string;
  itemId?: number;                 // NEW
  warehouseId?: number;            // already present in your code
  sku: string | null;
  item: string;
  warehouse: string;
  bin: string;
  onHand: number;
  reserved: number;
  min: number;
  available: number;
  expiry: Date | null;
  binId?: number;

  supplierId?: number | null;
  supplierName?: string | null;

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
interface BinOpt { id: number | string; binName: string; code?: string; }

interface SubmitModalState {
  fromWarehouseId: number | string | null;
  toWarehouseId: number | string | null;
  toBinId: number | string | null;
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

  modal: SubmitModalState = { fromWarehouseId: null, toWarehouseId: null, toBinId: null, remarks: null };
  modalTouched = false;

  toWarehouseList: WarehouseOpt[] = [];
  toBinList: BinOpt[] = [];
  toBinLoading = false;

  /** Group meta (recomputed after each edit) */
  groupMeta = new Map<string, { totalOnHand: number; reserved: number; maxTransfer: number; used: number; remaining: number }>();

  constructor(
    private router: Router,
    private stockService: StackOverviewService,
    private warehouseService: WarehouseService,
    private stockAdjustmentService: StockAdjustmentService,
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

  /* --------------- */
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
      fromWarehouseId: firstRow.warehouseId!,
      toWarehouseId: null,
      toBinId: null,
      remarks: null
    };
    this.fromWarehouseName = whName;

    this.loadToWareHouse(whName, () => {
      this.toBinList = [];
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
    if (!this.modal.toBinId) return;
    if (this.hasInvalidSelected()) return;

    const toId = Number(this.modal.toWarehouseId);
    const toBinId = Number(this.modal.toBinId);
    const remarks = (this.modal.remarks ?? '').trim() || null;

    const keys = this.selectedRows.map(r => {
      const { isFullTransfer, isPartialTransfer } = this.calcTransferFlags(r);

      const stockIdRaw =
        (r.apiRow as any)?.stockId ??
        (r.apiRow as any)?.StockId;

      const itemIdRaw =
        (r.apiRow as any)?.itemId ??
        (r.apiRow as any)?.ItemId ??
        (r.apiRow as any)?.id;

      const stockId = Number(stockIdRaw);
      const itemId  = Number(itemIdRaw);

      if (!Number.isFinite(stockId) || stockId <= 0) throw new Error(`Missing/invalid StockId for row ${r.idKey}`);
      if (!Number.isFinite(itemId) || itemId <= 0) throw new Error(`Missing/invalid ItemId for row ${r.idKey}`);

      r.isFullTransfer = isFullTransfer;
      r.isPartialTransfer = isPartialTransfer;

      return {
        stockId,
        itemId,
        warehouseId: Number(r.warehouseId),         // FROM
        binId: (r.binId == null ? null : Number(r.binId)),
        toWarehouseId: toId,                         // TO
        toBinId,
        transferQty: Number(r.transferQty),
        remarks,
        isFullTransfer,
        isPartialTransfer,
        supplierId: (r.supplierId == null ? null : Number(r.supplierId))
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

  /* --------------- Data loading --------------- */
  loadMasterItem(): void {
    this.stockService.GetStockTransferedList().subscribe({
      next: (res: any) => {
        const list: ApiItemRow[] = res?.isSuccess && Array.isArray(res.data) ? res.data : [];
        this.rows = list.map(item => this.primeRow(this.toStockRow(item)));

        // show items not yet transferred and without preset transfer qty
        this.filteredRows = this.rows.filter(r =>
          (r.isTransfered === false || r.isTransfered == null) &&
          (r.isPartialTransfer === false || r.isPartialTransfer == null) &&
          (r.transferQty == null || Number(r.transferQty) === 0)
        );

        // de-dup by composite key (includes supplierId)
        const byKey = new Map<string, StockRow>();
        for (const r of this.filteredRows) {
          const k = r.idKey;
          const curr = byKey.get(k);
          if (!curr || Number(r.transferQty ?? 0) < Number(curr.transferQty ?? 0)) byKey.set(k, r);
        }
        this.filteredRows = Array.from(byKey.values());

        // reset selection/lock and compute group meta
        this.filteredRows.forEach(r => (r._sel = false));
        this.lockedWarehouse = null;
        this.fromWarehouseName = '';
        this.groupMeta = this.computeGroupMeta();
      },
      error: (err) => {
        console.error('Load stock transfer list failed', err);
        this.rows = [];
        this.filteredRows = [];
        this.lockedWarehouse = null;
        this.fromWarehouseName = '';
        this.groupMeta = new Map();
      }
    });
  }

  loadToWareHouse(fromName: string, done?: () => void): void {
    this.warehouseService.GetNameByWarehouseAsync(fromName).subscribe({
      next: (res: any) => { this.toWarehouseList = (res?.data ?? []) as WarehouseOpt[]; done?.(); },
      error: (err) => { console.error('Load To Warehouse failed', err); this.toWarehouseList = []; done?.(); }
    });
  }

  onToWarehouseChange(warehouseId: number | string | null | undefined): void {
    this.modal.toBinId = null;
    this.toBinList = [];
    if (!warehouseId) return;
    this.loadToBinLocation(Number(warehouseId));
  }

  loadToBinLocation(warehouseId: number, done?: () => void): void {
    this.toBinLoading = true;
    this.stockAdjustmentService.GetBinDetailsbywarehouseID(warehouseId).subscribe({
      next: (res: any) => {
        const data = res?.data ?? res ?? [];
        this.toBinList = data.map((b: any) => ({
          id: b.id ?? b.Id,
          binName: b.binName ?? b.BinName ?? b.name ?? b.Name,
          code: b.code ?? b.Code ?? undefined,
        }));
        this.toBinLoading = false; done?.();
      },
      error: (err: any) => {
        console.error('Load To Bin Location failed', err);
        this.toBinLoading = false; this.toBinList = []; done?.();
      }
    });
  }

  /* --------------- Mapping helpers --------------- */
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

    const apiTransfer = (api.transferQty as any);
    const preservedTransfer = (apiTransfer === null || apiTransfer === undefined) ? 0 : Number(apiTransfer);

    const itemId = Number((api.itemId ?? api.id) as any);
    const stockId = Number((api.stockId as any));
    const supplierId = (api.supplierId == null ? null : Number(api.supplierId as any));
    const supplierName = (api.supplierName ?? null);

    return {
      idKey: [stockId || '', itemId || '', (supplierId ?? ''), warehouse, item, sku ?? '', bin].join('|').toLowerCase(),
      itemId,
      warehouse,
      sku,
      item,
      bin,
      onHand,
      reserved,
      min,
      available,
      expiry,
      warehouseId: Number(api.warehouseId as any),
      binId: api.binId == null ? undefined : Number(api.binId as any),
      supplierId,
      supplierName,
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

  /* --------------- Group logic --------------- */
  /** same item + same warehouse → one group */
  groupKey(r: StockRow) {
    return `${r.warehouseId || 0}|${r.itemId || 0}`;
  }

  /** compute per-group caps */
  private computeGroupMeta() {
    const meta = new Map<string, { totalOnHand: number; reserved: number; maxTransfer: number; used: number; remaining: number }>();

    for (const r of this.filteredRows) {
      const k = this.groupKey(r);
      const m = meta.get(k) || { totalOnHand: 0, reserved: 0, maxTransfer: 0, used: 0, remaining: 0 };

      m.totalOnHand += Math.max(0, Number(r.onHand ?? 0));

      // reserved is common inside group – take max (avoids double count)
      const rsv = Math.max(0, Number(r.reserved ?? 0));
      m.reserved = Math.max(m.reserved, rsv);

      m.used += Math.max(0, Number(r.transferQty ?? 0));

      meta.set(k, m);
    }

    for (const [k, m] of meta) {
      m.maxTransfer = Math.max(0, m.totalOnHand - m.reserved);
      m.remaining = Math.max(0, m.maxTransfer - m.used);
    }
    return meta;
  }

  /** remaining available for a row considering its previous qty */
  groupRemainingForRow(r: StockRow): number {
    const k = this.groupKey(r);
    const g = this.groupMeta.get(k);
    if (!g) return Math.max(0, Number(r.available ?? r.onHand ?? 0));
    const prevThis = Math.max(0, Number(r.transferQty ?? 0));
    return Math.max(0, (g.remaining ?? 0) + prevThis);
  }

  /* --------------- Quantity validation --------------- */
  private validateQty(n: number, _available: number): { ok: boolean; err: QtyErr } {
    if (n == null || Number.isNaN(n) || n === 0) return { ok: false, err: 'required' };
    if (!Number.isInteger(n)) return { ok: false, err: 'decimal' };
    if (n < 0) return { ok: false, err: 'negative' };
    return { ok: true, err: null };
  }

  onQtyChange(row: StockRow, value: any) {
    let n = Number(value);

    if (value === '' || value === null || Number.isNaN(n)) {
      row.transferQty = 0; row._qtyValid = false; row._qtyErr = 'required'; this.recomputeMeta(); return;
    }
    if (!Number.isInteger(n)) {
      n = Math.floor(n);
      row.transferQty = n; row._qtyValid = false; row._qtyErr = 'decimal'; this.recomputeMeta(); return;
    }
    if (n < 0) {
      row.transferQty = 0; row._qtyValid = false; row._qtyErr = 'negative'; this.recomputeMeta(); return;
    }

    // group cap logic
    const prevThis = Math.max(0, Number(row.transferQty ?? 0));
    // recompute meta first to get latest numbers excluding this edit
    this.groupMeta = this.computeGroupMeta();
    const groupRemaining = this.groupRemainingForRow(row); // includes prevThis
    const rowCap = Math.max(0, Number(row.available ?? row.onHand ?? 0));
    const finalCap = Math.min(groupRemaining, rowCap);

    if (n > finalCap) {
      row.transferQty = n; row._qtyValid = false; row._qtyErr = 'exceeds'; this.recomputeMeta(); return;
    }

    row.transferQty = n;
    row._qtyValid = n >= 0;
    row._qtyErr = row._qtyValid ? null : 'required';
    this.recomputeMeta();
  }

  digitsOnly(e: KeyboardEvent) {
    const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
    if (allowed.includes(e.key)) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
  }

  hasInvalidSelected(): boolean {
    return this.filteredRows?.some(r => {
      if (!r._sel) return false;
      const stockId =
        (r.apiRow as any)?.stockId ??
        (r.apiRow as any)?.StockId;
      const okStock = Number.isFinite(Number(stockId)) && Number(stockId) > 0;
      return !r._qtyValid || !okStock;
    }) ?? false;
  }

  private recomputeMeta() {
    this.groupMeta = this.computeGroupMeta();
  }

  /* --------------- Template helpers --------------- */
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
    this.groupMeta = this.computeGroupMeta();
  }

  goToStockTransferList(){
     this.router.navigate(['/Inventory/list-stocktransfer']); 
  }
}
