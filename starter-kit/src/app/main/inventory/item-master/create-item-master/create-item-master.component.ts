import { Component, ElementRef, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import Swal from 'sweetalert2';
import { ItemMasterService } from '../item-master.service';
import { ChartofaccountService } from 'app/main/financial/chartofaccount/chartofaccount.service';
import { ItemsService } from 'app/main/master/items/items.service';
import { UomService } from 'app/main/master/uom/uom.service';
import { WarehouseService } from 'app/main/master/warehouse/warehouse.service';
import { TaxCodeService } from 'app/main/master/taxcode/taxcode.service';
import { CoastingMethodService } from 'app/main/master/coasting-method/coasting-method.service';

type SimpleItem = {
  id: number;
  itemName: string;
  itemCode?: string;
  uomName?: string;
  budgetLineId?: number;
  label?: string | null;
  catagoryName: string;
};

@Component({
  selector: 'app-create-item-master',
  templateUrl: './create-item-master.component.html',
  styleUrls: ['./create-item-master.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class CreateItemMasterComponent implements OnInit {
  // Tabs
  itemTabs = ['Summary', 'Pricing', 'Suppliers', 'BOM', 'Substitutes', 'Attachments', 'Audit'];
  itemSubTab = 'Summary';

  // Form model
  item: any = this.makeEmptyItem();

  // ng-select model
  selectedItemId: number | null = null;
selectedWareHouseId: number | null = null;
selectedTaxId: number | null = null;
selectedCostingId:number | null = null;
  // Pricing rows
  prices: Array<{ price: number | null; uom: string }> = [];

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
  taxCodeList:any;
  CoastingMethodList: any[] = [];
  // Files
  pictureFile?: File;
  attachmentFiles: File[] = [];

  // Real list from API (grid)
  itemsTable: any[] = [];

  // Modal (demo)
  showModal = false;
  modalLine: any = this.makeEmptyModalLine();
  locationList = [{ name: 'Main Warehouse' }, { name: 'Store A' }];
  wareHouseList:any;
  // Refs
  @ViewChild('pictureInput') pictureInput!: ElementRef<HTMLInputElement>;
  @ViewChild('attachmentsInput') attachmentsInput!: ElementRef<HTMLInputElement>;

  constructor(
    private itemsSvc: ItemMasterService,
    private chartOfAccountService: ChartofaccountService,
    private itemsService: ItemsService,
    private uomService: UomService,
    private warehouseService: WarehouseService,
    private taxCodeService: TaxCodeService,
    private coastingmethodService: CoastingMethodService,
  ) {}

  ngOnInit(): void {
    this.loadItems();
    this.loadCatalogs();
    this.loadRequests();
    this.loadCoastingMethod();
    this.getAllTaxCode();
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
      costing: '',
      min: 0,
      max: 0,
      reorder: 0,
      leadTime: 0,
      batchFlag: false,
      serialFlag: false,
      taxClass: '',
      specs: '',
      pictureUrl: '',
      lastCost: null,
      isActive: true,
      onHand: 0,
      reserved: 0,
      available: 0,
      WareHouse:'',
      Costing:''
    };
  }

  private makeEmptyModalLine() {
    return {
      itemSearch: '',
      itemCode: '',
      qty: null as number | null,
      uomSearch: '',
      uom: '',
      locationSearch: '',
      location: '',
      remarks: '',
      filteredItems: [] as SimpleItem[],
      filteredUoms: [] as Array<{ id?: number; name: string }>,
      filteredLocations: [] as Array<{ name: string }>,
      dropdownOpen: false,
      uomDropdownOpen: false,
      locationDropdownOpen: false,
    };
  }

  trackByIdx = (i: number) => i;

  // ---------- Load grid ----------
  loadItems(): void {
    this.itemsSvc.getAllItemMaster().subscribe({
      next: (res: any) => {
        const list = res?.data ?? res ?? [];
        this.itemsTable = (list || []).map((x: any) => ({
          ...x,
          available: Number(x.onHand || 0) - Number(x.reserved || 0),
        }));
      },
      error: _ =>
        Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load items', confirmButtonColor: '#d33' }),
    });
  }

  // Row click → load into form
  selectRow(row: any) {
    const id = Number(row?.id ?? row?.Id);
    if (!id) return;
    this.itemsSvc.getItemMasterById(id).subscribe({
      next: (res: any) => {
        const data = res?.data ?? res;
        if (!data) return;
        this.item = {
          id: data.id,
          sku: data.sku,
          name: data.name,
          category: data.category,
          uom: data.uom,
          barcode: data.barcode,
          costing: data.costing ?? 'FIFO',
          min: Number(data.min ?? data.minQty ?? 0),
          max: Number(data.max ?? data.maxQty ?? 0),
          reorder: Number(data.reorder ?? data.reorderQty ?? 0),
          leadTime: Number(data.leadTime ?? data.leadTimeDays ?? 0),
          batchFlag: !!data.batchFlag,
          serialFlag: !!data.serialFlag,
          tax: data.tax ?? data.taxClass ?? 'NONE',
          specs: data.specs ?? '',
          pictureUrl: data.pictureUrl ?? '',
          lastCost: data.lastCost ?? null,
          isActive: data.isActive !== false,
          onHand: Number(data.onHand || 0),
          reserved: Number(data.reserved || 0),
          available: Number(data.onHand || 0) - Number(data.reserved || 0),
        };
        this.itemSubTab = 'Summary';
        this.prices = [];
        this.suppliers = [];
        this.substitutes = [];
        this.pictureFile = undefined;
        this.attachmentFiles = [];
      },
      error: _ =>
        Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load item', confirmButtonColor: '#d33' }),
    });
  }

  // ---------- Save / Clone / Archive ----------
  async onSave(): Promise<void> {
    debugger
    if (!this.item.sku?.trim() || !this.item.name?.trim()) {
      await Swal.fire({
        icon: 'warning',
        title: 'Required',
        text: 'SKU and Name are required.',
        confirmButtonColor: '#2E5F73',
      });
      return;
    }

    const payload = {
      ...this.item,
      minQty: Number(this.item.min || 0),
      maxQty: Number(this.item.max || 0),
      reorderQty: Number(this.item.reorder || 0),
      leadTimeDays: Number(this.item.leadTime || 0),
      taxClass: this.item.tax || 'NONE',
    };

    if (payload.id && payload.id > 0) {
      this.itemsSvc.updateItemMaster(payload.id, payload).subscribe({
        next: _ => {
          Swal.fire({
            icon: 'success',
            title: 'Updated',
            text: 'Item updated successfully',
            confirmButtonColor: '#2E5F73',
          });
          this.loadItems();
        },
        error: _ =>
          Swal.fire({ icon: 'error', title: 'Error', text: 'Update failed', confirmButtonColor: '#d33' }),
      });
    } else {
      this.itemsSvc.createItemMaster(payload).subscribe({
        next: (res: any) => {
          const newId = Number(res?.data ?? res?.id ?? 0);
          if (newId) this.item.id = newId;
          Swal.fire({
            icon: 'success',
            title: 'Created',
            text: 'Item created successfully',
            confirmButtonColor: '#2E5F73',
          });
          this.loadItems();
        },
        error: _ =>
          Swal.fire({ icon: 'error', title: 'Error', text: 'Create failed', confirmButtonColor: '#d33' }),
      });
    }
  }

  onClone(): void {
    if (!this.item?.sku || !this.item?.name) {
      Swal.fire({
        icon: 'warning',
        title: 'Nothing to clone',
        text: 'Please load or create an item first.',
        confirmButtonColor: '#2E5F73',
      });
      return;
    }
    const clone = {
      ...this.item,
      id: 0,
      sku: `${this.item.sku}-CLONE-${Date.now().toString().slice(-4)}`,
      name: `${this.item.name} (Clone)`,
    };
    this.itemsSvc.createItemMaster(clone).subscribe({
      next: _ => {
        Swal.fire({ icon: 'success', title: 'Cloned', text: 'Item cloned successfully', confirmButtonColor: '#2E5F73' });
        this.loadItems();
      },
      error: _ =>
        Swal.fire({ icon: 'error', title: 'Error', text: 'Clone failed', confirmButtonColor: '#d33' }),
    });
  }

  onArchive(): void {
    const id = Number(this.item?.id);
    if (!id) return;
    Swal.fire({
      icon: 'warning',
      title: 'Archive Item?',
      text: 'This will deactivate the item.',
      showCancelButton: true,
      confirmButtonText: 'Archive',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#d33',
    }).then(res => {
      if (res.isConfirmed) {
        this.itemsSvc.deleteItemMaster(id).subscribe({
          next: _ => {
            Swal.fire({ icon: 'success', title: 'Archived', text: 'Item archived', confirmButtonColor: '#2E5F73' });
            this.item = this.makeEmptyItem();
            this.loadItems();
          },
          error: _ =>
            Swal.fire({ icon: 'error', title: 'Error', text: 'Archive failed', confirmButtonColor: '#d33' }),
        });
      }
    });
  }

  // ---------- Pricing ----------
  addPriceLine(): void {
    const defaultUom = this.item.uom || 'EA';
    this.prices = [...this.prices, { price: null, uom: defaultUom }];
  }
  removePriceLine(i: number): void {
    this.prices = this.prices.filter((_, idx) => idx !== i);
  }

  // ---------- Suppliers / Substitutes ----------
  addSupplier(): void {
    const v = (this.supplierDraft || '').trim();
    if (!v) {
      Swal.fire({ icon: 'warning', title: 'Empty', text: 'Enter a supplier name', confirmButtonColor: '#2E5F73' });
      return;
    }
    if (!this.suppliers.includes(v)) this.suppliers = [...this.suppliers, v];
    this.supplierDraft = '';
  }

  addSubstitute(): void {
    const v = (this.substituteDraft || '').trim();
    if (!v) return;
    if (!this.substitutes.includes(v)) this.substitutes = [...this.substitutes, v];
    this.substituteDraft = '';
  }

  // ---------- Files ----------
  onPictureChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    this.pictureFile = input.files?.[0] ?? undefined;
    if (this.pictureFile) {
      Swal.fire({ icon: 'info', title: 'Selected', text: `Picture: ${this.pictureFile.name}`, confirmButtonColor: '#2E5F73' });
    }
  }

  onAttachmentsChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    this.attachmentFiles = input.files ? Array.from(input.files) : [];
    if (this.attachmentFiles?.length) {
      Swal.fire({ icon: 'info', title: 'Selected', text: `${this.attachmentFiles.length} attachment(s) chosen`, confirmButtonColor: '#2E5F73' });
    }
  }

 onItemSelectedId(id: number | null) {
  debugger
  if (!id) return;
  const picked = this.itemsList.find(x => x.id === id);
  if (!picked) return;

  this.item.name = picked.itemName;
  this.item.sku  = picked.itemCode ?? '';
  this.item.uom  = picked.uomName ?? '';
  this.item.category  = picked.catagoryName ?? '';
}
 onWareHouseSelectedId(name:string | null) {
 this.item.wareHouse =name;
}
 onTaxSelectedId(name:string | null) {
  this.item.taxClass= name;
}
 onCostingSelectedId(name: string | null) {
  this.item.costing = name;
}
loadCoastingMethod() {
     debugger
     this.coastingmethodService.getAllCoastingMethod().subscribe((res: any) => {
      this.CoastingMethodList = res.data.filter((item: any) => item.isActive === true);
      
     });
   }
loadRequests() {
    this.warehouseService.getWarehouse().subscribe({
      next: (res: any) => {
        this.wareHouseList = res.data.map((req: any) => {
          return {
            ...req,
          };
        });
       
      },
      error: (err: any) => console.error('Error loading list', err)
    });
  }

   getAllTaxCode() {
    this.taxCodeService.getTaxCode().subscribe((response: any) => {
      this.taxCodeList = response.data;
      
    })
  }

  // ---------- Catalogs (COA, Items, UOMs) ----------
  loadCatalogs() {
    this.chartOfAccountService.getAllChartOfAccount().subscribe((res: any) => {
      this.accountHeads = res?.data ?? [];
      this.parentHeadList = this.accountHeads.map((head: any) => ({
        value: head.id,
        label: this.buildFullPath(head),
      }));

      this.itemsService.getAllItem().subscribe((ires: any) => {
        const raw = ires?.data ?? [];
        // Normalize into SimpleItem
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
      this.uomList = (res?.data ?? []).map((u: any) => ({ id: u.id, name: u.name }));
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

  // ---------- Modal (demo) ----------
  openLineModal(): void {
    this.modalLine = this.makeEmptyModalLine();
    this.showModal = true;
  }
  closeModal(): void {
    this.showModal = false;
  }
  onSubmitModal(): void {
    if (!this.modalLine?.itemSearch || !this.modalLine?.qty) {
      Swal.fire({ icon: 'warning', title: 'Required', text: 'Item and Qty are required', confirmButtonColor: '#2E5F73' });
      return;
    }
    this.showModal = false;
    Swal.fire({ icon: 'success', title: 'Line saved', confirmButtonColor: '#2E5F73' });
  }

  onModalItemFocus(): void {
    this.modalLine.filteredItems = [...this.itemsList];
    this.modalLine.dropdownOpen = true;
  }
  filterModalItems(): void {
    const q = (this.modalLine.itemSearch || '').toLowerCase();
    this.modalLine.filteredItems = this.itemsList.filter(
      it => (it.itemName || '').toLowerCase().includes(q) || (it.itemCode || '').toLowerCase().includes(q)
    );
  }
  selectModalItem(item: SimpleItem): void {
    this.modalLine.itemSearch = item.itemName;
    this.modalLine.itemCode = item.itemCode || '';
    this.modalLine.uomSearch = item.uomName || '';
    this.modalLine.uom = item.uomName || '';
    this.modalLine.dropdownOpen = false;
    this.modalLine.filteredItems = [];
  }

  onModalUomFocus(): void {
    this.modalLine.filteredUoms = [...this.uomList];
    this.modalLine.uomDropdownOpen = true;
  }
  filterModalUoms(): void {
    const q = (this.modalLine.uomSearch || '').toLowerCase();
    this.modalLine.filteredUoms = this.uomList.filter((u: any) => (u.name || '').toLowerCase().includes(q));
  }
  selectModalUom(uom: any): void {
    this.modalLine.uomSearch = uom.name;
    this.modalLine.uom = uom.name;
    this.modalLine.uomDropdownOpen = false;
    this.modalLine.filteredUoms = [];
  }

  onModalLocationFocus(): void {
    this.modalLine.filteredLocations = [...this.locationList];
    this.modalLine.locationDropdownOpen = true;
  }
  filterModalLocations(): void {
    const q = (this.modalLine.locationSearch || '').toLowerCase();
    this.modalLine.filteredLocations = this.locationList.filter((loc: any) => (loc.name || '').toLowerCase().includes(q));
  }
  selectModalLocation(location: any): void {
    this.modalLine.locationSearch = location.name;
    this.modalLine.location = location.name;
    this.modalLine.locationDropdownOpen = false;
    this.modalLine.filteredLocations = [];
  }
}
