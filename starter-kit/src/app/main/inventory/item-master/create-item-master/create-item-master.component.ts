import {
  Component,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, Observable } from 'rxjs';
import Swal from 'sweetalert2';

import { ItemMasterService } from '../item-master.service';
import { ChartofaccountService } from 'app/main/financial/chartofaccount/chartofaccount.service';
import { ItemsService } from 'app/main/master/items/items.service';
import { UomService } from 'app/main/master/uom/uom.service';
import { WarehouseService } from 'app/main/master/warehouse/warehouse.service';
import { TaxCodeService } from 'app/main/master/taxcode/taxcode.service';
import { CoastingMethodService } from 'app/main/master/coasting-method/coasting-method.service';
import { SupplierService } from 'app/main/businessPartners/supplier/supplier.service';
import { StrategyService } from 'app/main/master/strategies/strategy.service';

/* ----------------- Lightweight view models ----------------- */
type SimpleItem = {
  id: number;
  itemName: string;
  itemCode?: string;
  uomName?: string;
  catagoryName: string;
};

type PriceRow = {
  price: number | null;
  qty: number | null;            // <-- NEW
  barcode: string | null;
  SupplierId: number | string | null;
  supplierName?: string | null;
  supplierSearch?: string | null;
};

interface Warehouse { id: number | string; name: string; }
interface Bin {
  id?: number | string;
  name?: string;
  binID?: number|string;
  binName?: string;
  warehouseId?: number | string;
}
interface SupplierLite { id: number | string; name: string; code?: string; }

interface ItemMasterAudit {
  auditId: number;
  itemId: number;
  action: 'CREATE'|'UPDATE'|'DELETE'|string;
  occurredAtUtc: string;
  userId?: number|null;
  userName?: string|null;
  oldValuesJson?: string|null;
  newValuesJson?: string|null;
  remarks?: string|null;
}

interface ItemStockRow {
  warehouseId: number | string | null;
  binId: number | string | null;
  strategyId: number | string | null;
  onHand: number | null;
  reserved: number | null;
  available: number | null;
  min: number | null;
  max: number | null;
  reorderQty: number | null;
  leadTimeDays: number | null;
  batchFlag: boolean;
  serialFlag: boolean;
  isApproved: boolean;
  isTransfered: boolean;
  stockIssueID: number;
  isFullTransfer: boolean;
  isPartialTransfer: boolean;
}

/* ----------------- BOM contracts ----------------- */
// If your API already returns { latest, history }, these are used:
export interface BomLatestRow {
  supplierId: number;
  supplierName: string;
  existingCost: number;
  unitCost: number;
  createdDate: string;
}
export interface BomHistoryPoint {
  supplierId: number;
  supplierName: string;
  existingCost: number;
  unitCost: number;
  createdDate: string;
  rn?: number;
}
export interface BomSnapshot {
  latest: BomLatestRow[];
  history: BomHistoryPoint[];
}

// If your API returns a flat ItemBom[] from the DB (like your screenshot)
export interface ItemBomRow {
  id: number;
  itemId: number;
  supplierId: number;
  existingCost: number;
  unitCost: number;
  createdDate: string;
  createdBy?: number;
  updatedBy?: number;
  updatedDate?: string;
}

interface BomInlineRow {
  supplierId: number | string | null;
  supplierName: string | null;
  existingCost: number;
  unitCost: number | null;
}
interface BomTotals { rollup: number; count: number; }

/* ----------------- Component ----------------- */
@Component({
  selector: 'app-create-item-master',
  templateUrl: './create-item-master.component.html',
  styleUrls: ['./create-item-master.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class CreateItemMasterComponent implements OnInit {
  /* Steps */
  private readonly stepsCreate = ['Summary'] as const;
  private readonly stepsEdit   = ['Summary','Warehouses','Suppliers','BOM','Audit','Review'] as const;
  get stepsView() { return this.isEdit ? this.stepsEdit : this.stepsCreate; }
  get lastStepIndex() { return this.stepsView.length - 1; }
  step = 0;

  next() {
    if (this.step === 0) {
      if (!this.item.name?.trim() && !this.selectedItemId) {
        Swal.fire({ icon:'warning', title:'Select Item', text:'Pick an Item Name first (or create one).' });
        return;
      }
    }
    if (this.step < this.stepsView.length - 1) {
      this.step++;
      if (this.isEdit && this.step === 3) this.loadBomSnapshotOrFallback(); // BOM
      if (this.isEdit && this.step === 4) this.loadAudits();                // Audit
      this.maybeScrollToReviewBottom();
    }
  }
  prev() { if (this.step > 0) this.step--; }

  /* Edit vs Create */
  isEdit = false;
  editingId: number | null = null;

  /* Audit */
  audits: ItemMasterAudit[] = [];
  expandedAudit: Record<string | number, boolean> = {};
  busy: Record<string, boolean> = {};
  copied: Record<string, boolean> = {};

  /* Header model */
  item: any = this.makeEmptyItem();

  /* Lists / selectors */
  selectedItemId: number | null = null;
  prices: PriceRow[] = [];
  supplierList: SupplierLite[] = [];
  supplierDropdownOpen = false;
  filteredSuppliers: SupplierLite[] = [];
  activePriceIndex: number | null = null;

  modalLine = { itemSearch: '', dropdownOpen: false, filteredItems: [] as SimpleItem[] };

  strategyList: any;
  itemsList: SimpleItem[] = [];
  uomList: Array<{ id?: number; name: string }> = [];
  taxCodeList: Array<{ id: number; name: string }> = [];
  costingMethodList: Array<{ id: number; name: string }> = [];
  warehouseList: Warehouse[] = [];
  binList: Bin[] = [];

  /* Per-warehouse stock */
  itemStocks: ItemStockRow[] = [];

  /* Warehouse modal state */
  showWhModal = false;
  whDraft: ItemStockRow = this.makeEmptyStockDraft();
  isEditMode: boolean = false;
  editingIndex: number = -1;

  /* BOM (INLINE) */
  bomRows: BomInlineRow[] = [];
  bomTotals: BomTotals = { rollup: 0, count: 0 };

  /**
   * Map used by the UI helper to show “last 3” chips.
   * Key = supplierId, Value = array of history points (unsorted).
   */
  bomHistoryBySupplier = new Map<number, BomHistoryPoint[]>();

  brand = '#2E5F73';
  minDate = '';
  userId: any;
  showRaw: Record<string | number, boolean> = {};
  @ViewChild('supplierSearchBox', { static: false }) supplierSearchBox!: ElementRef<HTMLElement>;
  @ViewChild('itemSearchBox', { static: false }) itemSearchBox!: ElementRef<HTMLElement>;
  @ViewChild('itemSearchInput', { static: false }) itemSearchInput!: ElementRef<HTMLInputElement>;
  @ViewChild('topOfWizard') topOfWizard!: ElementRef<HTMLDivElement>;
  @ViewChild('bottomOfWizard') bottomOfWizard!: ElementRef<HTMLDivElement>;

  constructor(
    private itemsSvc: ItemMasterService,
    private chartOfAccountService: ChartofaccountService,
    private itemsService: ItemsService,
    private uomService: UomService,
    private warehouseService: WarehouseService,
    private taxCodeService: TaxCodeService,
    private coastingmethodService: CoastingMethodService,
    private supplierService : SupplierService,
    private strategyService: StrategyService,
    private router: Router,
    private route: ActivatedRoute,
  ) {
    this.userId = localStorage.getItem('id');
  }

  /* Lifecycle */
  ngOnInit(): void {
    this.setMinDate();
    this.loadCatalogs();
    this.loadWarehouses();
    this.loadCostingMethods();
    this.getAllTaxCode();
    this.getAllSupplier();
    this.getAllStrategy();

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.isEdit = true;
      this.editingId = Number(idParam);
      this.loadForEdit(this.editingId);
    } else {
      this.loadItems();
    }
  }

  /* Derived totals */
  get totals() {
    const t = { onHand: 0, reserved: 0, available: 0 };
    for (const r of this.itemStocks) {
      const onHand = Number(r.onHand || 0);
      const reserved = Number(r.reserved || 0);
      t.onHand += onHand;
      t.reserved += reserved;
      t.available += Math.max(0, onHand - reserved);
    }
    return t;
  }

  /* Items list */
  itemsTable: any[] = [];
  loadItems(): void {
    this.itemsSvc.getAllItemMaster().subscribe({
      next: (res: any) => {
        const list = res?.data ?? res ?? [];
        this.itemsTable = (list || []).map((x: any) => ({
          ...x,
          available: Number(x.onHand || 0) - Number(x.reserved || 0),
        }));
      },
      error: _ => Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load items' }),
    });
  }

  /* Edit loader */
  private loadForEdit(id: number): void {
    forkJoin({
      header: this.itemsSvc.getItemMasterById(id),
      stocks: this.itemsSvc.getWarehouseStock(id),
      prices: this.itemsSvc.getSupplierPrices(id),
    } as { header: Observable<any>; stocks: Observable<any>; prices: Observable<any>; })
    .subscribe({
      next: ({ header, stocks, prices }) => {
        const h: any = Array.isArray(header)
          ? header[0]
          : (header && 'data' in header ? (header as any).data : header) || {};

        this.item = {
          id: h.id,
          sku: h.sku ?? h.itemCode ?? '',
          name: h.name ?? h.itemName ?? '',
          category: h.category ?? h.catagoryName ?? '',
          uom: h.uom ?? h.uomName ?? '',
          costingMethodId: h.costingMethodId ?? null,
          taxCodeId: h.taxCodeId ?? null,
          specs: h.specs ?? '',
          pictureUrl: h.pictureUrl ?? '',
          lastCost: h.lastCost ?? null,
          isActive: h.isActive ?? true,
          createdBy: this.userId,
          updatedBy: this.userId,
          expiryDate: this.toDateOnly(h.expiryDate)
        };

        const stockArr: any[] = Array.isArray(stocks)
          ? stocks
          : (stocks && 'data' in stocks ? (stocks as any).data : []) || [];

        this.itemStocks = stockArr.map((r: any) => ({
          warehouseId: r.warehouseId,
          binId: r.binId,
          strategyId: r.strategyId ?? null,
          onHand: Number(r.onHand || 0),
          reserved: Number(r.reserved || 0),
          available: Math.max(0, Number(r.available ?? (Number(r.onHand || 0) - Number(r.reserved || 0)))),
          min: r.min ?? r.minQty ?? null,
          max: r.max ?? r.maxQty ?? null,
          reorderQty: r.reorderQty ?? null,
          leadTimeDays: r.leadTimeDays ?? null,
          batchFlag: !!r.batchFlag,
          serialFlag: !!r.serialFlag,
          isApproved: !!r.isApproved,
          isTransfered: !!r.isTransfered,
          stockIssueID: r.stockIssueID ?? 0,
          isFullTransfer:r.isFullTransfer,
          isPartialTransfer:r.isPartialTransfer
        }));

        const priceArr: any[] = Array.isArray(prices)
          ? prices
          : (prices && 'data' in prices ? (prices as any).data : []) || [];

        this.prices = priceArr.map((p: any) => ({
          price: p.price ?? null,
          qty: (p.qty != null ? Number(p.qty)
               : (p.quantity != null ? Number(p.quantity) : null)),
          barcode: p.barcode ?? null,
          SupplierId: p.supplierId ?? p.SupplierId ?? null,
          supplierName: p.supplierName ?? p.name ?? null,
          supplierSearch: p.supplierName ?? p.name ?? ''
        }));

        this.modalLine.itemSearch = this.item.name || '';
        this.loadBomSnapshotOrFallback();
      },
      error: () => Swal.fire({ icon: 'error', title: 'Failed', text: 'Could not load item for editing.' })
    });
  }

  private toDateOnly(d: any): string | null {
    if (!d) return null;
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return null;
    const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000);
    return local.toISOString().split('T')[0];
  }

  /* Save */
  async onSave(): Promise<void> {
    if (!this.item.sku?.trim() || !this.item.name?.trim()) {
      await Swal.fire({ icon: 'warning', title: 'Required', text: 'SKU and Name are required.' });
      return;
    }

    const stocksPayload = this.itemStocks.map(r => ({
      warehouseId: r.warehouseId,
      binId: r.binId,
      strategyId: r.strategyId,
      onHand: Number(r.onHand || 0),
      available: Math.max(0, Number(r.onHand || 0) - Number(r.reserved || 0)),
      reserved: Number(r.reserved || 0),
      minQty: Number(r.min || 0),
      maxQty: Number(r.max || 0),
      reorderQty: Number(r.reorderQty || 0),
      leadTimeDays: Number(r.leadTimeDays || 0),
      batchFlag: !!r.batchFlag,
      serialFlag: !!r.serialFlag,
      isApproved: !!r.isApproved,
      isTransfered: !!r.isTransfered,
      stockIssueID: r.stockIssueID ?? 0,
      isFullTransfer:r.isFullTransfer,
      isPartialTransfer:r.isPartialTransfer
    }));

    const bomPayload = (this.bomRows || []).map(r => ({
      supplierId: r.supplierId,
      supplierName: r.supplierName,
      existingCost: Number(r.existingCost || 0),
      unitCost: Number(((r.unitCost ?? r.existingCost) || 0))
    }));

    // normalize prices, include qty as number
    const pricesPayload = (this.prices ?? [])
      .filter(p => p.price != null && p.SupplierId != null)
      .map(p => ({
        supplierId: p.SupplierId,
        price: Number(p.price),
        qty: p.qty == null || p.qty === ('' as any) ? 0 : Number(p.qty),
        barcode: p.barcode ?? null
      }));

    const payload: any = {
      ...this.item,
      itemStocks: stocksPayload,
      prices: pricesPayload,
      ...(this.isEdit ? { bomLines: bomPayload } : {})
    };
    if (this.isEdit) payload.bomLines = bomPayload;

    const creating = !payload.id || payload.id <= 0;

    const onApiSuccess = (res: any) => {
      const ok = res?.isSuccess === true || res?.issucess === true;
      if (ok) {
        Swal.fire({
          icon: 'success',
          title: creating ? 'Created!' : 'Updated!',
          text: res?.message || (creating ? 'Item created successfully' : 'Item updated successfully'),
          confirmButtonColor: '#0e3a4c'
        });

        if (creating) { this.onGoToItemList(); return; }
        this.loadItems();
        if (this.item?.id) this.loadBomSnapshotOrFallback();
      } else {
        Swal.fire({ icon: 'error', title: 'Failed', text: res?.message || 'Save failed', confirmButtonColor: '#0e3a4c' });
      }
    };
    const onApiError = (_: any) =>
      Swal.fire({ icon: 'error', title: 'Error', text: creating ? 'Create failed' : 'Update failed', confirmButtonColor: '#0e3a4c' });

    if (creating) this.itemsSvc.createItemMaster(payload).subscribe({ next: onApiSuccess, error: onApiError });
    else this.itemsSvc.updateItemMaster(payload.id, payload).subscribe({ next: onApiSuccess, error: onApiError });
  }

  /* Misc UI helpers */
  setMinDate() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    this.minDate = `${yyyy}-${mm}-${dd}`;
  }
  onExpiryChange(e: Event) {
    const value = (e.target as HTMLInputElement).value || null;
    this.item.expiryDate = value;
    this.item.createdBy = this.userId;
    this.item.updatedBy = this.userId;
  }
  onTaxSelectedId(id: number | null) { this.item.taxCodeId = id; }
  onCostingSelectedId(id: number | null) { this.item.costingMethodId = id; }

  /* Warehouse modal */
  openWhModal(): void {
    this.whDraft = this.makeEmptyStockDraft();
    this.showWhModal = true;
    (document.body.style as any).overflow = 'hidden';
  }
  closeWhModal(): void {
    this.showWhModal = false;
    (document.body.style as any).overflow = '';
  }
  onModalRootClick(ev: MouseEvent) {
    ev.stopPropagation();
    const t = ev.target as HTMLElement;
    const insideDropdown = t.closest('.prl-dropdown') || t.closest('.prl-menu');
    if (insideDropdown) return;
    this.modalLine.dropdownOpen = false;
  }
  editLine(i: number): void {
    const r = this.itemStocks[i];
    if (!r) return;
    this.isEditMode = true;
    this.editingIndex = i;
    this.whDraft = {
      warehouseId: r.warehouseId ?? null,
      binId: r.binId ?? null,
      strategyId: r.strategyId ?? null,
      onHand: Number(r.onHand ?? 0),
      reserved: Number(r.reserved ?? 0),
      available: Math.max(0, Number(r.available ?? (Number(r.onHand ?? 0) - Number(r.reserved ?? 0)))),
      min: r.min ?? null,
      max: r.max ?? null,
      reorderQty: r.reorderQty ?? null,
      leadTimeDays: r.leadTimeDays ?? null,
      batchFlag: !!r.batchFlag,
      serialFlag: !!r.serialFlag,
      isApproved: !!r.isApproved,
      isTransfered: !!r.isTransfered,
      stockIssueID: r.stockIssueID ?? 0,
      isFullTransfer:r.isFullTransfer,
      isPartialTransfer:r.isPartialTransfer
    };
    this.getBinsForWarehouse(this.whDraft.warehouseId);
    this.showWhModal = true;
  }
  submitWarehouse(closeAfter: boolean): void {
    this.recalcDraft();
    if (!this.whDraft.warehouseId) { Swal.fire({ icon: 'warning', title: 'Select warehouse' }); return; }
    if (!this.whDraft.binId) { Swal.fire({ icon: 'warning', title: 'Select bin' }); return; }
    if ((this.whDraft.min ?? 0) > (this.whDraft.max ?? 0)) { Swal.fire({ icon:'warning', title:'Invalid min/max', text:'Min cannot exceed Max' }); return; }
    if ((this.whDraft.reserved ?? 0) > (this.whDraft.onHand ?? 0)) { Swal.fire({ icon:'warning', title:'Invalid reserved', text:'Reserved cannot exceed On Hand' }); return; }

    const dupIdx = this.itemStocks.findIndex(x =>
      String(x.warehouseId) === String(this.whDraft.warehouseId) &&
      String(x.binId) === String(this.whDraft.binId)
    );
    if (dupIdx !== -1 && (!this.isEditMode || dupIdx !== this.editingIndex)) {
      Swal.fire({ icon:'warning', title:'Duplicate', text:'This Warehouse + Bin already exists.' });
      return;
    }

    const normalized: ItemStockRow = {
      warehouseId: this.whDraft.warehouseId,
      binId: this.whDraft.binId,
      strategyId: this.whDraft.strategyId,
      onHand: Number(this.whDraft.onHand ?? 0),
      reserved: Number(this.whDraft.reserved ?? 0),
      available: Math.max(0, Number(this.whDraft.onHand ?? 0) - Number(this.whDraft.reserved ?? 0)),
      min: this.whDraft.min ?? null,
      max: this.whDraft.max ?? null,
      reorderQty: this.whDraft.reorderQty ?? null,
      leadTimeDays: this.whDraft.leadTimeDays ?? null,
      batchFlag: !!this.whDraft.batchFlag,
      serialFlag: !!this.whDraft.serialFlag,
      isApproved: !!this.whDraft.isApproved,
      isTransfered: !!this.whDraft.isTransfered,
      stockIssueID: this.whDraft.stockIssueID ?? 0,
      isFullTransfer:this.whDraft.isFullTransfer,
      isPartialTransfer:this.whDraft.isPartialTransfer
    };

    if (this.isEditMode && this.editingIndex > -1) {
      const next = [...this.itemStocks];
      next[this.editingIndex] = { ...next[this.editingIndex], ...normalized };
      this.itemStocks = next;

      if (closeAfter) {
        this.closeWhModal();
        this.isEditMode = false;
        this.editingIndex = -1;
      } else {
        const keepWarehouse = this.whDraft.warehouseId;
        this.isEditMode = false;
        this.editingIndex = -1;
        this.whDraft = this.makeEmptyStockDraft();
        this.whDraft.warehouseId = keepWarehouse;
        this.getBinsForWarehouse(this.whDraft.warehouseId);
      }
    } else {
      this.itemStocks.push({ ...normalized });
      if (closeAfter) this.closeWhModal();
      else this.whDraft = this.makeEmptyStockDraft();
    }
  }
  removeWarehouseRow(i: number): void {
    if (i >= 0 && i < this.itemStocks.length) this.itemStocks.splice(i, 1);
  }

  /* Lookups */
  getBinsForWarehouse(id: number | string | null) {
    this.warehouseService.getBinNameByIdAsync(id).subscribe((response: any) => {
      this.binList = response?.data ?? [];
    });
  }
  getWarehouseName(id: any): string {
    const w = this.warehouseList.find(x => String(x.id) === String(id));
    return w?.name ?? '-';
  }
  getBinName(id: any): string {
    if (id == null) return '-';
    const byId = this.binList.find(b => String((b.binID ?? (b as any).id)) === String(id));
    return (byId?.binName ?? (byId as any)?.name) || '-';
  }
  getStrategyName(id: any): string {
    if (id == null) return '-';
    const s = (this.strategyList || []).find((x: any) => String(x.id) === String(id));
    return s?.strategyName || s?.name || '-';
  }
  getById(list: any[], id: any) { return list?.find?.(x => String(x.id)===String(id)); }

  /* Suppliers */
  getAllSupplier() {
    this.supplierService.GetAllSupplier().subscribe((response: any) => {
      this.supplierList = (response?.data ?? []).map((s:any) => ({
        id: s.id,
        name: s.name ?? s.supplierName ?? `Supplier-${s.id}`,
        code: s.code ?? s.supplierCode ?? undefined
      }));
      if (!this.prices.length) this.filteredSuppliers = this.supplierList.slice(0, 20);
    });
  }

  /* Catalogs */
  loadWarehouses() {
    this.warehouseService.getWarehouse().subscribe({
      next: (res: any) => {
        const raw = res?.data ?? [];
        this.warehouseList = raw.map((w: any) => ({ id: w.id, name: w.name || w.warehouseName || `WH-${w.id}` }));
      },
      error: (err: any) => console.error('Error loading warehouses', err)
    });
  }
  loadCostingMethods() {
    this.coastingmethodService.getAllCoastingMethod().subscribe((res: any) => {
      const data = res?.data ?? [];
      this.costingMethodList = data.filter((x:any)=>x.isActive===true).map((x:any)=>({ id:x.id, name:x.costingName }));
    });
  }
  getAllTaxCode() {
    this.taxCodeService.getTaxCode().subscribe((response: any) => {
      const data = response?.data ?? [];
      this.taxCodeList = data.map((t:any)=>({ id:t.id, name:t.name }));
    });
  }
  getAllStrategy() {
    this.strategyService.getStrategy().subscribe((response: any) => {
      this.strategyList = response.data;
    });
  }
  loadCatalogs() {
    this.chartOfAccountService.getAllChartOfAccount().subscribe(() => {
      this.itemsService.getAllItem().subscribe((ires: any) => {
        const raw = ires?.data ?? [];
        this.itemsList = raw.map((item: any) => ({
          id: Number(item.id ?? item.itemId ?? 0),
          itemName: item.itemName ?? item.name ?? '',
          itemCode: item.itemCode ?? '',
          uomName: item.uomName ?? item.uom ?? '',
          catagoryName: item.catagoryName
        } as SimpleItem));
      });
    });
    this.uomService.getAllUom().subscribe((res: any) => {
      this.uomList = (res?.data ?? []).map((u:any)=>({ id:u.id, name:u.name }));
    });
  }

  /* Pricing */
  addPriceLine(): void {
    this.prices = [
      ...this.prices,
      { price: null, qty: null, barcode: null, SupplierId: null, supplierName: null, supplierSearch: '' }
    ];
    this.activePriceIndex = null;
    this.filteredSuppliers = [];
    this.supplierDropdownOpen = false;
  }
  removePriceLine(i: number): void {
    this.prices = this.prices.filter((_, idx) => idx !== i);
    if (this.isEdit) this.syncBomFromPrices();
  }

  /* Item dropdown */
  onModalItemFocus(open: boolean = true): void {
    this.modalLine.dropdownOpen = open;
    if (open) {
      const q = (this.modalLine.itemSearch || '').trim();
      if (q) this.filterModalItems();
      else this.modalLine.filteredItems = this.itemsList.slice(0, 50);
      setTimeout(() => this.itemSearchInput?.nativeElement?.focus(), 0);
    }
  }
  filterModalItems(): void {
    const q = (this.modalLine.itemSearch || '').toLowerCase();
    this.modalLine.filteredItems = this.itemsList.filter(
      (it: any) =>
        (it.itemName || '').toLowerCase().includes(q) ||
        (it.itemCode || '').toLowerCase().includes(q)
    );
  }
  trackByItemId = (_: number, row: SimpleItem) => row.id;
  selectModalItem(row: SimpleItem): void {
    this.item.name = row.itemName || '';
    this.item.sku = row.itemCode || '';
    this.item.uom = row.uomName || '';
    this.item.category = row.catagoryName || '';
    this.modalLine.itemSearch = row.itemName || '';
    this.modalLine.dropdownOpen = false;
  }

  /* Supplier dropdown */
  filterSuppliersForRow(i: number): void {
    const q = (this.prices[i]?.supplierSearch || '').toLowerCase().trim();
    this.filteredSuppliers = !q
      ? this.supplierList.slice(0, 20)
      : this.supplierList.filter(s =>
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.code && s.code.toLowerCase().includes(q)) ||
          String(s.id).toLowerCase().includes(q)
        );
  }
  trackBySupplierId = (_: number, s: SupplierLite) => s.id;
  selectSupplierForRow(i: number, s: SupplierLite, ev?: MouseEvent): void {
    ev?.stopPropagation();
    const row = this.prices[i];
    if (!row) return;
    row.SupplierId = s.id;
    row.supplierName = s.name;
    row.supplierSearch = s.name;
    this.activePriceIndex = i;
    this.supplierDropdownOpen = false;
    if (this.isEdit) this.syncBomFromPrices();
  }

  /* Global focus & click */
  @HostListener('document:focusin', ['$event'])
  onFocusIn(ev: FocusEvent) {
    const target = ev.target as HTMLInputElement;
    if (!target) return;
    if (target.name?.startsWith('supplierSearch')) {
      this.supplierDropdownOpen = true;
      const tr = target.closest('tr');
      if (tr && tr.parentElement) {
        const rows = Array.from(tr.parentElement.querySelectorAll(':scope > tr'));
        const idx = rows.indexOf(tr);
        this.activePriceIndex = idx >= 0 ? idx : null;
      }
    }
  }
  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent) {
    const t = ev.target as Node;
    const itemBox = this.itemSearchBox?.nativeElement;
    if (itemBox && !itemBox.contains(t)) this.modalLine.dropdownOpen = false;
    const supplierBox = this.supplierSearchBox?.nativeElement;
    if (supplierBox && !supplierBox.contains(t)) this.supplierDropdownOpen = false;
  }

  /* Small utilities */
  private makeEmptyItem() {
    return {
      id: 0,
      sku: '',
      name: '',
      category: '',
      uom: '',
      costingMethodId: null as number | null,
      taxCodeId: null as number | null,
      specs: '',
      pictureUrl: '',
      lastCost: null,
      isActive: true,
      createdBy: this.userId,
      updatedBy: this.userId,
      expiryDate: null as string | null
    };
  }
  private makeEmptyStockDraft(): ItemStockRow {
    return {
      warehouseId: null,
      binId: null,
      strategyId: null,
      onHand: null,
      reserved: null,
      available: null,
      min: null,
      max: null,
      reorderQty: null,
      leadTimeDays: null,
      batchFlag: false,
      serialFlag: false,
      isApproved: false,
      isTransfered: false,
      stockIssueID: 0,
      isFullTransfer:false,
      isPartialTransfer:false
    };
  }
  recalcDraft(): void {
    const onHand = Math.max(0, Number(this.whDraft.onHand || 0));
    const reserved = Math.max(0, Number(this.whDraft.reserved || 0));
    this.whDraft.onHand = onHand;
    this.whDraft.reserved = reserved;
    this.whDraft.available = Math.max(0, onHand - reserved);
  }

  loadAudits(): void {
    const id = Number(this.item?.id || 0);
    if (!id) { this.audits = []; return; }
    this.itemsSvc.getItemAudit(id).subscribe({
      next: r => this.audits = r?.data ?? [],
      error: _ => this.audits = []
    });
  }

  chipStyle(action: string) {
    const a = (action || '').toUpperCase();
    const map: any = {
      CREATE: { bg: '#DCFCE7', color: '#166534', border: '#BBF7D0' },
      UPDATE: { bg: '#E0F2FE', color: '#075985', border: '#BAE6FD' },
      DELETE: { bg: '#FEE2E2', color: '#991B1B', border: '#FECACA' }
    };
    const s = map[a] || { bg:'#F1F5F9', color:'#334155', border:'#E2E8F0' };
    return {
      display:'inline-block',
      padding:'2px 8px',
      borderRadius:'9999px',
      background:s.bg,
      border:`1px solid ${s.border}`,
      color:s.color,
      fontSize:'11px',
      fontWeight:600
    };
  }
  avatarStyle(_name?: string) {
    return {
      display: 'inline-grid',
      placeItems: 'center',
      width: '20px',
      height: '20px',
      borderRadius: '9999px',
      fontSize: '10px',
      fontWeight: 700,
      color: '#fff',
      background: this.brand,
      border: '1px solid #dbe7ee',
      boxShadow: '0 1px 0 rgba(0,0,0,.03)',
      marginRight: '6px'
    } as any;
  }
  get userPillStyle() {
    return {
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '9999px',
      background: '#F1F5F9',
      border: '1px solid #E2E8F0',
      fontSize: '11px',
      color: '#334155'
    } as any;
  }
  initials(full: string) {
    if (!full) return '?';
    const parts = full.trim().split(/\s+/);
    const first = parts[0]?.[0] || '';
    const last  = parts[1]?.[0] || '';
    return (first + last).toUpperCase();
  }
  toggleDetails(id: string | number) { this.expandedAudit[id] = !this.expandedAudit[id]; }
  prettyJson(payload: any): string {
    if (!payload) return '—';
    try {
      const obj = typeof payload === 'string' ? JSON.parse(payload) : payload;
      return JSON.stringify(obj, null, 2);
    } catch { return String(payload); }
  }
  private valueToText(v: any): string {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }
  safeParse(x: any) {
    if (!x) return null;
    try { return typeof x === 'string' ? JSON.parse(x) : x; } catch { return x; }
  }

  async copyJson(a: any) {
    const k = String(a.auditId ?? a.occurredAtUtc ?? '');
    this.busy[k] = true;
    const payload = {
      action: a.action,
      occurredAtUtc: a.occurredAtUtc,
      user: a.userName || a.userId,
      before: this.safeParse(a.oldValuesJson),
      after: this.safeParse(a.newValuesJson)
    };
    const text = JSON.stringify(payload, null, 2);

    try {
      if ((navigator as any).clipboard?.writeText) {
        await (navigator as any).clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      this.copied[k] = true;
      setTimeout(()=> this.copied[k] = false, 1500);
    } catch {
      Swal.fire({ toast: true, position: 'top', icon: 'error', title: 'Copy failed', showConfirmButton: false, timer: 1500 });
    } finally { this.busy[k] = false; }
  }

  keyOf(a: any, index: number): string {
    return String(a?.auditId ?? `${(a?.action || '').toUpperCase()}_${a?.occurredAtUtc ?? ''}_${index}`);
  }
  isExpanded(a: any, index: number): boolean {
    return !!this.expandedAudit[this.keyOf(a, index)];
  }
  isUpdate(a: any): boolean {
    return (a?.action || '').toString().toUpperCase() === 'UPDATE';
  }
  diffs(a: any): Array<{ field: string; before: any; after: any }> {
    const oldObj = this.safeParse(a?.oldValuesJson) || {};
    const newObj = this.safeParse(a?.newValuesJson) || {};
    if (typeof oldObj !== 'object' || typeof newObj !== 'object') return [];
    const keys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
    return keys
      .filter(k => (oldObj as any)[k] !== (newObj as any)[k])
      .map(k => ({
        field: k,
        before: this.valueToText((oldObj as any)[k]),
        after:  this.valueToText((newObj as any)[k]),
      }));
  }

  /* ----------------- BOM logic ----------------- */

  /** First try backend; if absent, build BOM from supplier prices */
  private loadBomSnapshotOrFallback(): void {
    const id = Number(this.item?.id || 0);
    if (!this.isEdit || !id) { this.syncBomFromPrices(); return; }
    this.loadBomSnapshot(id, true);
  }

  /** Normalize any API response into { latest, history } */
private normalizeSnapshot(payload: any): BomSnapshot {
  const root = payload?.data ?? payload ?? {};
  const latest = Array.isArray(root.latest) ? root.latest : [];
  const history = Array.isArray(root.history) ? root.history : [];
  return { latest, history } as BomSnapshot;
}

/** If the flat endpoint returns an envelope, unwrap it; else return array */
private normalizeFlat(payload: any): ItemBomRow[] | BomSnapshot {
  const root = payload?.data ?? payload ?? [];
  return root;
}

  /**
   * Calls API and **normalizes** to a snapshot.
   * Supports:
   *  - `getBom(itemId)` → `ItemBomRow[]`
   *  - or `getBomSnapshot(itemId)` → `{ latest, history }`
   */
private loadBomSnapshot(itemId: number, fallbackToPrices = false): void {
  const apiSnap$ = (this.itemsSvc as any).getBomSnapshot?.(itemId) as Observable<any> | undefined;
  const apiFlat$ = this.itemsSvc.getBom(itemId) as Observable<any>;

  const useFlat = () => apiFlat$.subscribe({
    next: (raw: any) => {
      const normalized = this.normalizeFlat(raw);
      if (Array.isArray(normalized)) {
        this.populateHistoryFromFlatRows(normalized);
        this.deriveLatestFromFlatRows(normalized);
      } else {
        this.populateFromSnapshot(this.normalizeSnapshot(normalized));
      }
    },
    error: () => { if (fallbackToPrices) this.syncBomFromPrices(); }
  });

  if (apiSnap$) {
    apiSnap$.subscribe({
      next: (snap: any) => this.populateFromSnapshot(this.normalizeSnapshot(snap)),
      error: () => useFlat()
    });
  } else {
    useFlat();
  }
}


 private populateFromSnapshot(snap: BomSnapshot) {
  const latest = Array.isArray(snap?.latest) ? snap.latest : [];
  const history = Array.isArray(snap?.history) ? snap.history : [];

  // history → map
  this.bomHistoryBySupplier.clear();
  for (const h of history) {
    const sid = Number((h as any).supplierId ?? 0);
    if (!sid) continue;
    const point: BomHistoryPoint = {
      supplierId: sid,
      supplierName: (h as any).supplierName ?? '',
      existingCost: Number((h as any).existingCost ?? 0),
      unitCost: Number((h as any).unitCost ?? (h as any).existingCost ?? 0),
      createdDate: (h as any).createdDate,
      rn: (h as any).rn
    };
    const arr = this.bomHistoryBySupplier.get(sid) ?? [];
    arr.push(point);
    this.bomHistoryBySupplier.set(sid, arr);
  }

  // latest → grid rows
  if (latest.length) {
    this.bomRows = latest.map((r: any) => ({
      supplierId: Number(r.supplierId ?? 0) || null,
      supplierName: r.supplierName || '—',
      existingCost: Number(r.existingCost ?? 0),
      unitCost: Number(r.unitCost ?? r.existingCost ?? 0)
    }));
    this.recomputeBomTotalsInline();
  } else {
    this.syncBomFromPrices();
  }
}


  /** Fill history map from flat ItemBom rows (DB table) */
  private populateHistoryFromFlatRows(rows: ItemBomRow[]) {
    this.bomHistoryBySupplier.clear();
    const toPoint = (r: ItemBomRow): BomHistoryPoint => ({
      supplierId: r.supplierId,
      supplierName: this.supplierList.find(s => String(s.id) === String(r.supplierId))?.name ?? '',
      existingCost: Number(r.existingCost ?? 0),
      unitCost: Number(r.unitCost ?? r.existingCost ?? 0),
      createdDate: r.createdDate,
    });

    for (const r of rows) {
      const sid = Number(r.supplierId || 0);
      if (!sid) continue;
      const arr = this.bomHistoryBySupplier.get(sid) ?? [];
      arr.push(toPoint(r));
      this.bomHistoryBySupplier.set(sid, arr);
    }
  }

  /** Derive one “latest” line per supplier for the grid from flat rows */
  private deriveLatestFromFlatRows(rows: ItemBomRow[]) {
    const bySup = new Map<number, ItemBomRow>();
    for (const r of rows) {
      const sid = Number(r.supplierId || 0);
      const prev = bySup.get(sid);
      if (!prev || new Date(r.createdDate) > new Date(prev.createdDate)) bySup.set(sid, r);
    }

    this.bomRows = Array.from(bySup.values()).map(r => ({
      supplierId: r.supplierId,
      supplierName: this.supplierList.find(s => String(s.id) === String(r.supplierId))?.name ?? '—',
      existingCost: Number(r.existingCost ?? 0),
      unitCost: Number(r.unitCost ?? r.existingCost ?? 0),
    }));
    this.recomputeBomTotalsInline();
  }

  /* Build from Supplier Prices if no backend history */
  syncBomFromPrices(opts: { preserveUnitCost?: boolean } = { preserveUnitCost: true }): void {
    const preserve = opts.preserveUnitCost !== false;
    const norm = (s: any) => String(s ?? '').trim().toLowerCase();
    const prevByKey = new Map<string, BomInlineRow>();
    for (const r of this.bomRows || []) {
      const key = `${String(r.supplierId ?? '')}::${norm(r.supplierName)}`;
      prevByKey.set(key, r);
    }

    const next: BomInlineRow[] = (this.prices || [])
      .filter(p => p.price != null)
      .map(p => {
        const supplierId   = p.SupplierId ?? null;
        const supplierName = p.supplierName ?? null;
        const existingCost = Number(p.price || 0);
        const key = `${String(supplierId ?? '')}::${norm(supplierName)}`;
        const prev = prevByKey.get(key);
        const unitCost = preserve && prev && prev.unitCost != null
          ? Number(prev.unitCost)
          : existingCost;
        return { supplierId, supplierName, existingCost, unitCost };
      });

    this.bomRows = next;
    this.recomputeBomTotalsInline();
  }

  applyBomToPrices(): void {
    if (!this.bomRows?.length || !this.prices?.length) return;
    const norm = (s: any) => String(s ?? '').trim().toLowerCase();
    const mapById = new Map<string, number>();
    const mapByName = new Map<string, number>();

    for (const r of this.bomRows) {
      const cost = Number((r.unitCost ?? r.existingCost ?? 0));
      if (r.supplierId != null) mapById.set(String(r.supplierId), cost);
      if (r.supplierName) mapByName.set(norm(r.supplierName), cost);
    }

    this.prices = this.prices.map(p => {
      const idKey = p.SupplierId != null ? String(p.SupplierId) : '';
      const nameKey = norm(p.supplierName);
      let nextPrice: number | null = null;
      if (idKey && mapById.has(idKey)) nextPrice = mapById.get(idKey)!;
      else if (nameKey && mapByName.has(nameKey)) nextPrice = mapByName.get(nameKey)!;
      if (nextPrice == null) return p;
      return { ...p, price: nextPrice };
    });
  }

  addBomRow(): void {
    this.bomRows = [...this.bomRows, { supplierId: null, supplierName: null, existingCost: 0, unitCost: null }];
    this.recomputeBomTotalsInline();
  }
  removeBomRow(i: number): void {
    this.bomRows = this.bomRows.filter((_, idx) => idx !== i);
    this.recomputeBomTotalsInline();
  }
  recomputeBomTotalsInline(): void {
    const roll = (this.bomRows || []).reduce((sum, r) => sum + Number(r.unitCost || 0), 0);
    this.bomTotals = { rollup: this.toNum(roll, 6), count: this.bomRows.length };
  }
  private toNum(v: any, dp = 6): number {
    const n = Number(v ?? 0);
    if (!isFinite(n)) return 0;
    const p = Math.pow(10, dp);
    return Math.round(n * p) / p;
  }
  trackByIdx = (i: number, _l: any) => i;

  /* Navigation */
  onGoToItemList(): void {
    this.router.navigate(['/Inventory/List-itemmaster']);
  }
  private isOnReviewStep(): boolean {
    return (this.isEdit && this.step === this.lastStepIndex);
  }
  private maybeScrollToReviewBottom() {
    if (!this.isOnReviewStep()) return;
    setTimeout(() => {
      this.bottomOfWizard?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
    }, 0);
  }

  getLast3CostsForSupplier(supplierId: number | string | null): Array<{ value: number; when: Date }> {
  const sid = Number(supplierId ?? 0);
  if (!sid) return [];
  const hist = this.bomHistoryBySupplier.get(sid) ?? [];
  if (!hist.length) return [];
  const sorted = [...hist].sort(
    (a,b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
  );
  const seen = new Set<string>();
  const out: Array<{ value: number; when: Date }> = [];
  for (const h of sorted) {
    const val = Number((h.unitCost ?? h.existingCost) ?? 0);
    const key = val.toFixed(4);
    if (!seen.has(key)) {
      out.push({ value: val, when: new Date(h.createdDate) });
      seen.add(key);
    }
    if (out.length >= 3) break;
  }
  return out;
}
isCurrentCost(curr: number | null | undefined, val: number | null | undefined): boolean {
  const a = Number(curr ?? 0);
  const b = Number(val ?? 0);
  return a.toFixed(4) === b.toFixed(4);
}

deltaVsPrev(supplierId: number | string | null, current: number | null | undefined) {
  const arr = this.getLast3CostsForSupplier(supplierId) || [];
  const prev = arr.length > 1 ? Number(arr[1].value ?? 0) : Number(arr[0]?.value ?? 0);
  const curr = Number(current ?? 0);
  const abs  = curr - prev;
  const pct  = prev !== 0 ? (abs / prev) * 100 : 0;
  const dir  = abs > 0 ? 'up' : abs < 0 ? 'down' : 'flat';
  return {
    abs: Math.abs(abs),
    pct: Math.abs(pct),
    dir,
    tooltip: dir === 'flat' ? 'No change vs previous' :
             dir === 'up'   ? 'Increased vs previous' :
                              'Decreased vs previous'
  };
}

deltaColorStyle(delta: {dir:'up'|'down'|'flat'}): any {
  if (delta.dir === 'up')   return {'border-color':'#fecaca','background':'#fff1f2','color':'#991b1b'};
  if (delta.dir === 'down') return {'border-color':'#bbf7d0','background':'#f0fdf4','color':'#166534'};
  return {'border-color':'#e5e7eb','background':'#f8fafc','color':'#64748b'};
}


}
