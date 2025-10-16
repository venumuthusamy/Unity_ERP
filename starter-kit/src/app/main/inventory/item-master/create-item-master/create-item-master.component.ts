import { Component, ElementRef, HostListener, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
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

type SimpleItem = {
  id: number;
  itemName: string;
  itemCode?: string;
  uomName?: string;
  budgetLineId?: number;
  label?: string | null;
  catagoryName: string;
};

interface Warehouse { id: number | string; name: string; }
interface Bin { id: number | string; name?: string; binId?: number|string; binName?: string; warehouseId?: number | string; }
interface SupplierLite { id: number | string; name: string; code?: string; }

interface ItemStockRow {
  warehouseId: number | string | null;
  binId: number | string | null;
  strategyId: number | string | null;
  onHand: number;
  reserved: number;
  available: number;
  min: number | null;
  max: number | null;
  reorderQty: number | null;
  leadTimeDays: number | null;
  batchFlag: boolean;
  serialFlag: boolean;
  isApproved:boolean,
  isTransfered:boolean
}

@Component({
  selector: 'app-create-item-master',
  templateUrl: './create-item-master.component.html',
  styleUrls: ['./create-item-master.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class CreateItemMasterComponent implements OnInit {
  // Wizard steps
  steps = ['Summary','Warehouses','Suppliers','Audit','Review'] as const;
  step = 0;

  next() {
    if (this.step === 0) {
      if (!this.item.name?.trim() && !this.selectedItemId) {
        Swal.fire({ icon:'warning', title:'Select Item', text:'Pick an Item Name first (or create one).' });
        return;
      }
    }
    if (this.step < this.steps.length - 1) this.step++;
  }
  prev() { if (this.step > 0) this.step--; }

  // Form model
  item: any = this.makeEmptyItem();

  // selectors
  selectedItemId: number | null = null;

  // Pricing rows (keeping your field name: SupplierId)
  prices: Array<{ price: number | null; SupplierId: any }> = [];

  // ===== Supplier dropdown state/data =====
  supplierList: SupplierLite[] = [];
  modalLine1 = {
    supplierId: null as number|string|null,
    supplierName: '',
    supplierSearch: '',
  };
  supplierDropdownOpen = false;
  filteredSuppliers: SupplierLite[] = [];
  private activePriceIndex: number | null = null;   // <-- which row is being edited
minDate = '';
  // Strategies
  strategyList:any;

  // Suppliers/Substitutes
  suppliers: string[] = [];
  supplierDraft = '';
  substitutes: string[] = [];
  substituteDraft = '';

  // Catalogs
  accountHeads: any[] = [];
  parentHeadList: Array<{ value: number; label: string }> = [];
  itemsList: SimpleItem[] = [];
  uomList: Array<{ id?: number; name: string }> = [];
  taxCodeList: Array<{ id: number; name: string }> = [];
  costingMethodList: Array<{ id: number; name: string }> = [];

  // Warehouses/Bins
  warehouseList: Warehouse[] = [];
  binList: Bin[] = [];

  // Per-warehouse stock
  itemStocks: ItemStockRow[] = [];

  // Modal state
  showWhModal = false;
  whDraft: ItemStockRow = this.makeEmptyStockDraft();

  // Files
  @ViewChild('pictureInput') pictureInput!: ElementRef<HTMLInputElement>;
  @ViewChild('attachmentsInput') attachmentsInput!: ElementRef<HTMLInputElement>;

  // Supplier search dropdown box ref
  @ViewChild('supplierSearchBox', { static: false }) supplierSearchBox!: ElementRef<HTMLElement>;

  // ===== Item search dropdown state =====
  modalLine: {
    itemSearch: string;
    dropdownOpen: boolean;
    filteredItems: SimpleItem[];
  } = {
    itemSearch: '',
    dropdownOpen: false,
    filteredItems: [],
  };
 userId:any;
  // Refs for click-outside
  @ViewChild('itemSearchBox', { static: false }) itemSearchBox!: ElementRef<HTMLElement>;
  @ViewChild('itemSearchInput', { static: false }) itemSearchInput!: ElementRef<HTMLInputElement>;

  constructor(
    private itemsSvc: ItemMasterService,
    private chartOfAccountService: ChartofaccountService,
    private itemsService: ItemsService,
    private uomService: UomService,
    private warehouseService: WarehouseService,
    private taxCodeService: TaxCodeService,
    private coastingmethodService: CoastingMethodService,
    private _SupplierService : SupplierService,
    private strategyService: StrategyService
  ) {this.userId = localStorage.getItem('id');}

  ngOnInit(): void {
    this.setMinDate();
    this.loadItems();
    this.loadCatalogs();
    this.loadWarehouses();
    this.loadCostingMethods();
    this.getAllTaxCode();
    this.getAllSupplier();
    this.getAllStrategy();
    console.log("userid",this.userId)
  }

  // ---------- Helpers ----------
  private makeEmptyItem() {
    return {
      id: 0,
      sku: '',
      name: '',
      category: '',
      uom: '',
      barcode: '',
      costingMethodId: null as number | null,
      taxCodeId: null as number | null,
      specs: '',
      pictureUrl: '',
      lastCost: null,
      isActive: true,
      createdBy:this.userId,
      updatedBy:this.userId,
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
      isApproved:false,
      isTransfered:false
    };
  }
  trackByIdx = (_: any, i: number) => i;
  trackByItemId = (_: number, it: SimpleItem) => it.id;
  trackBySupplierId = (_: number, s: SupplierLite) => s.id;

  get totals() {
    const t = { onHand: 0, reserved: 0, available: 0 };
    for (const r of this.itemStocks) {
      t.onHand += Number(r.onHand || 0);
      t.reserved += Number(r.reserved || 0);
      t.available += Math.max(0, Number(r.onHand || 0) - Number(r.reserved || 0));
    }
    return t;
  }

  // ---------- Load grid ----------
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

  // ---------- Save / Clone / Archive ----------
  async onSave(): Promise<void> {
  if (!this.item.sku?.trim() || !this.item.name?.trim()) {
    await Swal.fire({ icon: 'warning', title: 'Required', text: 'SKU and Name are required.' });
    return;
  }
debugger
  const stocksPayload = this.itemStocks.map(r => ({
    warehouseId: r.warehouseId,
    binId: r.binId,
    strategyId: r.strategyId,
    onHand: Number(r.onHand || 0),
    available: Number(r.available),
    reserved: Number(r.reserved || 0),
    minQty: Number(r.min || 0),
    maxQty: Number(r.max || 0),
    reorderQty: Number(r.reorderQty || 0),
    leadTimeDays: Number(r.leadTimeDays || 0),
    batchFlag: !!r.batchFlag,
    serialFlag: !!r.serialFlag,
    isApproved:false,
    isTransfered:false
  }));

  const payload = {
    ...this.item,
    itemStocks: stocksPayload,
    prices: (this.prices ?? []).filter(p => p.price != null),
    suppliers: this.suppliers,
    substitutes: this.substitutes
   
  };

  const creating = !payload.id || payload.id <= 0;

  const onApiSuccess = (res: any) => {
    // accept either res.isSuccess or res.issucess (typo-tolerant)
    const ok = res?.isSuccess === true || res?.issucess === true;

    if (ok) {
      if (creating) {
        const newId = Number(res?.data?.id ?? res?.data ?? res?.id ?? 0);
        if (!this.item.id && newId) this.item.id = newId;
      }

      Swal.fire({
        icon: 'success',
        title: creating ? 'Created!' : 'Updated!',
        text: res?.message || (creating ? 'Item created successfully' : 'Item updated successfully'),
        confirmButtonText: 'OK',
        confirmButtonColor: '#0e3a4c'
      });

      this.loadItems();
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Failed',
        text: res?.message || (creating ? 'Create failed' : 'Update failed'),
        confirmButtonColor: '#0e3a4c'
      });
    }
  };

  const onApiError = (_err: any) => {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: creating ? 'Create failed' : 'Update failed',
      confirmButtonColor: '#0e3a4c'
    });
  };

  if (creating) {
    this.itemsSvc.createItemMaster(payload).subscribe({
      next: onApiSuccess,
      error: onApiError
    });
  } else {
    this.itemsSvc.updateItemMaster(payload.id, payload).subscribe({
      next: onApiSuccess,
      error: onApiError
    });
  }
}
 setMinDate() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    this.minDate = `${yyyy}-${mm}-${dd}`;
  }

  onClone(): void {
    if (!this.item?.sku || !this.item?.name) {
      Swal.fire({ icon:'warning', title:'Nothing to clone', text:'Please load or create an item first.' });
      return;
    }
    const clone = { ...this.item, id: 0, sku: `${this.item.sku}-CLONE-${Date.now().toString().slice(-4)}`, name: `${this.item.name} (Clone)` };
    this.itemsSvc.createItemMaster(clone).subscribe({
      next: _ => { Swal.fire({ icon:'success', title:'Cloned', text:'Item cloned successfully' }); this.loadItems(); },
      error: _ => Swal.fire({ icon:'error', title:'Error', text:'Clone failed' }),
    });
  }

  onArchive(): void {
    const id = Number(this.item?.id);
    if (!id) return;
    Swal.fire({ icon:'warning', title:'Archive Item?', text:'This will deactivate the item.', showCancelButton:true, confirmButtonText:'Archive' })
      .then(res=>{
        if(res.isConfirmed){
          this.itemsSvc.deleteItemMaster(id).subscribe({
            next:_=>{ Swal.fire({ icon:'success', title:'Archived', text:'Item archived' }); this.item = this.makeEmptyItem(); this.itemStocks=[]; this.loadItems(); },
            error:_=> Swal.fire({ icon:'error', title:'Error', text:'Archive failed' }),
          });
        }
      });
  }

  // ---------- Files ----------
  onPictureChange(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (f) Swal.fire({ icon:'info', title:'Selected', text:`Picture: ${f.name}` });
  }
  onAttachmentsChange(ev: Event) {
    const files = (ev.target as HTMLInputElement).files ? Array.from((ev.target as HTMLInputElement).files!) : [];
    if (files.length) Swal.fire({ icon:'info', title:'Selected', text:`${files.length} attachment(s) chosen` });
  }
onExpiryChange(e: Event) {
  const value = (e.target as HTMLInputElement).value || null;
  this.item.expiryDate = value;
  this.item.createdBy = this.userId;
  this.item.updatedBy = this.userId;
}
  // ---------- Select handlers ----------
  onItemSelectedId(id: number | null) {
    if (!id) return;
    const picked = this.itemsList.find(x => x.id === id);
    if (!picked) return;

    this.item.name = picked.itemName;
    this.item.sku  = picked.itemCode ?? '';
    this.item.uom  = picked.uomName ?? '';
    this.item.category  = picked.catagoryName ?? '';
  }
  onTaxSelectedId(id: number | null) { this.item.taxCodeId = id; }
  onCostingSelectedId(id: number | null) { this.item.costingMethodId = id; }

  // ---------- Warehouse modal ----------
  submitWarehouse(closeAfter: boolean): void {
    if (!this.whDraft.warehouseId) {
      Swal.fire({ icon: 'warning', title: 'Select warehouse' });
      return;
    }
    if ((this.whDraft.min ?? 0) > (this.whDraft.max ?? 0)) {
      Swal.fire({ icon:'warning', title:'Invalid min/max', text:'Min cannot exceed Max' });
      return;
    }
    this.itemStocks.push({ ...this.whDraft });
    if (closeAfter) this.closeWhModal();
    else this.whDraft = this.makeEmptyStockDraft();
  }

  removeWarehouseRow(i: number): void {
    if (i >= 0 && i < this.itemStocks.length) this.itemStocks.splice(i, 1);
  }

  // ---------- Lookup helpers ----------
  getBinsForWarehouse(id: number | string | null) {
    this.warehouseService.getBinNameByIdAsync(id).subscribe((response: any) => {
      this.binList = response.data;
    });
  }

  getWarehouseName(id: any): string {
    const w = this.warehouseList.find(x => String(x.id) === String(id));
    return w?.name ?? '-';
  }

  getBinName(id: any): string {
    if (id == null) return '-';
    // support { id,name } or { binId, binName }
    const byId = this.binList.find(b => String((b.binId ?? b.id)) === String(id));
    return (byId?.binName ?? byId?.name) || '-';
  }

  getById(list: any[], id: any) { return list?.find?.(x => String(x.id)===String(id)); }

  // ======= SUPPLIERS API LOAD =======
  getAllSupplier() {
    this._SupplierService.GetAllSupplier().subscribe((response: any) => {
      this.supplierList = (response?.data ?? []).map((s:any) => ({
        id: s.id,
        name: s.name ?? s.supplierName ?? `Supplier-${s.id}`,
        code: s.code ?? s.supplierCode ?? undefined
      }));
      if (!this.modalLine1.supplierSearch) {
        this.filteredSuppliers = this.supplierList.slice(0, 20);
      }
    });
  }

  // ---------- Loads ----------
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

  loadCatalogs() {
    this.chartOfAccountService.getAllChartOfAccount().subscribe((res: any) => {
      this.accountHeads = res?.data ?? [];
      this.parentHeadList = this.accountHeads.map((head: any) => ({ value: head.id, label: this.buildFullPath(head) }));

      this.itemsService.getAllItem().subscribe((ires: any) => {
        const raw = ires?.data ?? [];
        this.itemsList = raw.map((item: any) => {
          const matched = this.parentHeadList.find(h => +h.value === +item.budgetLineId);
          return {
            id: Number(item.id ?? item.itemId ?? 0),
            itemName: item.itemName ?? item.name ?? '',
            itemCode: item.itemCode ?? '',
            uomName: item.uomName ?? item.uom ?? '',
            budgetLineId: item.budgetLineId,
            label: matched ? matched.label : null,
            catagoryName: item.catagoryName
          } as SimpleItem;
        });
      });
    });

    this.uomService.getAllUom().subscribe((res: any) => {
      this.uomList = (res?.data ?? []).map((u:any)=>({ id:u.id, name:u.name }));
    });
  }

  buildFullPath(item: any): string {
    if (!item) return '';
    let path = item.headName;
    let current = this.accountHeads.find((x: any) => x.id === item.parentHead);
    while (current) {
      path = `${current.headName} >> ${path}`;
      current = this.accountHeads.find((x: any) => x.id === current.parentHead);
    }
    return path;
  }

  // ---------- Pricing ----------
  addPriceLine(): void {
    // keep your structure; SupplierId will be filled by the dropdown selection
    this.prices = [...this.prices, { price: null, SupplierId: null }];
  }
  removePriceLine(i: number): void {
    this.prices = this.prices.filter((_, idx) => idx !== i);
  }

  // ---------- Suppliers/Substitutes ----------
  addSupplier(): void {
    const v = (this.supplierDraft || '').trim();
    if (!v) {
      Swal.fire({ icon: 'warning', title: 'Empty', text: 'Enter a supplier name' });
      return;
    }
    if (!this.suppliers.includes(v)) this.suppliers = [...this.suppliers, v];
    this.supplierDraft = '';
  }
  getAllStrategy() {
    this.strategyService.getStrategy().subscribe((response: any) => {
      this.strategyList = response.data;
    });
  }
  addSubstitute(): void {
    const v = (this.substituteDraft || '').trim();
    if (!v) return;
    if (!this.substitutes.includes(v)) this.substitutes = [...this.substitutes, v];
    this.substituteDraft = '';
  }

  // ====== Item Search Dropdown logic ======
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

  selectModalItem(row: SimpleItem): void {
    this.item.name = row.itemName || '';
    this.item.sku = row.itemCode || '';
    this.item.uom = row.uomName || '';
    this.item.category = row.catagoryName || '';
    this.modalLine.itemSearch = row.itemName || '';
    this.modalLine.dropdownOpen = false;
  }

  // ====== Supplier Search Dropdown logic ======
  filterSuppliers(): void {
    const q = (this.modalLine1.supplierSearch || '').toLowerCase().trim();
    if (!q) {
      this.filteredSuppliers = this.supplierList.slice(0, 20);
      return;
    }
    this.filteredSuppliers = this.supplierList.filter(s =>
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.code && s.code.toLowerCase().includes(q)) ||
      (String(s.id).toLowerCase().includes(q))
    );
  }

  /** When a result is clicked, fill the global input AND the active price line */
  selectSupplier(s: SupplierLite, ev?: MouseEvent): void {
    ev?.stopPropagation();
    this.modalLine1.supplierId = s.id;
    this.modalLine1.supplierName = s.name;
    this.modalLine1.supplierSearch = s.name;
    this.supplierDropdownOpen = false;

    if (this.activePriceIndex != null && this.prices[this.activePriceIndex]) {
      this.prices[this.activePriceIndex].SupplierId = s.id; // keep your field name
    }
  }

  // ---------- Global focus & click handling ----------
  /** detect which pricing row's supplier input is focused (no HTML change needed) */
  @HostListener('document:focusin', ['$event'])
  onFocusIn(ev: FocusEvent) {
    const target = ev.target as HTMLElement;
    if (!target) return;

    // Only on the supplier search input
    if ((target as HTMLInputElement).name === 'supplierSearch') {
      this.supplierDropdownOpen = true;

      // find nearest TR and compute its index among tbody rows (matches *ngFor index)
      const tr = target.closest('tr');
      if (tr) {
        const tbody = tr.parentElement;
        if (tbody) {
          const rows = Array.from(tbody.querySelectorAll(':scope > tr'));
          const idx = rows.indexOf(tr);
          this.activePriceIndex = idx >= 0 ? idx : null;
        }
      }

      // prime list if empty
      const q = (this.modalLine1.supplierSearch || '').trim();
      if (q) this.filterSuppliers(); else this.filteredSuppliers = this.supplierList.slice(0, 20);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent) {
    const t = ev.target as Node;

    // Item dropdown outside-click
    const itemBox = this.itemSearchBox?.nativeElement;
    if (itemBox && !itemBox.contains(t)) {
      this.modalLine.dropdownOpen = false;
    }

    // Supplier dropdown outside-click
    const supplierBox = this.supplierSearchBox?.nativeElement;
    if (supplierBox && !supplierBox.contains(t)) {
      this.supplierDropdownOpen = false;
    }
  }

  // ---------- Modal open/close ----------
  openWhModal(): void {
    this.whDraft = this.makeEmptyStockDraft();
    this.showWhModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeWhModal(): void {
    this.showWhModal = false;
    document.body.style.overflow = '';
  }

  onModalRootClick(ev: MouseEvent) {
    ev.stopPropagation();
    const t = ev.target as HTMLElement;
    const insideDropdown = t.closest('.prl-dropdown') || t.closest('.prl-menu');
    if (insideDropdown) return;
    this.modalLine.dropdownOpen = false;
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEsc(_e: KeyboardEvent) {}

  // ---------- small utilities ----------
  recalcDraft(): void {
    const onHand = Math.max(0, Number(this.whDraft.onHand || 0));
    const reserved = Math.max(0, Number(this.whDraft.reserved || 0));
    this.whDraft.onHand = onHand;
    this.whDraft.reserved = reserved;
    this.whDraft.available = Math.max(0, onHand - reserved);
  }
}
