import { Component, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';

import { CustomerMasterService } from 'app/main/businessPartners/customer-master/customer-master.service';
import { QuotationsService } from '../../quotations/quotations.service';
import { CountriesService } from 'app/main/master/countries/countries.service';
import { SalesOrderService } from '../sales-order.service';

/** ===== Types ===== */
type WarehouseInfo = {
  warehouseId: number;
  warehouseName: string;
  onHand: number;
  reserved: number;
  available: number;
};

type WarehouseMaster = { id: number; warehouseName: string };

type SoLine = {
  item?: string;      // display "CODE - NAME" or name only
  itemId?: number;
  uom?: string;
  quantity?: number | string;
  unitPrice?: number | string;
  discount?: number | string;
  tax?: 'EXCLUSIVE' | 'INCLUSIVE' | 'EXEMPT';
  lineNet?: number;
  lineTax?: number;
  total?: number;

  // Per-line warehouses & selection
  warehouses?: WarehouseInfo[];
  selectedWarehouseId?: number | null;
  selectedWh?: WarehouseInfo | null;

  // row dropdowns for item/tax
  dropdownOpen?: '' | 'item' | 'tax';
  filteredOptions?: any[];
};

@Component({
  selector: 'app-sales-order-create',
  templateUrl: './sales-order-create.component.html',
  styleUrls: ['./sales-order-create.component.scss']
})
export class SalesOrderCreateComponent implements OnInit {

  /** -------- Header Model ---------- */
  soHdr: any = {
    id: 0,
    quotationNo: '',
    customerId: 0,
    requestedDate: '',
    deliveryDate: '',
    shipping: 0,
    discount: 0,
    gstPct: 0,
    status: 1, // 1=Pending,2=Approved,3=Rejected
    statusText: 'Pending'
  };

  /** -------- Masters ---------- */
  customers: any[] = [];
  quotationList: any[] = [];
  items: any[] = [];     // optional, if you open the line item selector
  taxCodes: any[] = [];  // optional, if you use tax dropdown

  /** Header warehouse dropdown (optional, informational) */
  warehousesMaster: WarehouseMaster[] = [];
  selectedWarehouseId: number | null = null;
  selectedWarehouseName = '';

  /** -------- Lines ---------- */
  soLines: SoLine[] = [];

  /** -------- SearchText style dropdowns (Header) ---------- */
  submitted = false;

  searchTexts: { [k: string]: string } = {
    quotationNo: '',
    customer: '',
    warehouse: '' // header search for warehouses
  };

  dropdownOpen: { [k: string]: boolean } = {
    quotationNo: false,
    customer: false,
    warehouse: false
  };

  filteredLists: { [k: string]: any[] } = {
    quotationNo: [],
    customer: [],
    warehouse: []
  };

  /** Which header fields are required */
  requiredKeys = ['quotationNo', 'customer'];

  /** Optional UI bits */
  allocation = { reservedPct: 0 };
  countries: any[] = [];

  constructor(
    private router: Router,
    private customerSvc: CustomerMasterService,
    private quotationSvc: QuotationsService,
    private countriesSvc: CountriesService,
    private salesOrderService: SalesOrderService
  ) {}

  /** ======= Init ======= */
  ngOnInit(): void {
    // Countries (for GST%)
    this.countriesSvc.getCountry().subscribe((res: any) => {
      this.countries = (res?.data ?? []).map((c: any) => ({
        id: Number(c.id ?? c.Id),
        countryName: String(c.countryName ?? c.CountryName ?? '').trim(),
        gstPercentage: Number(c.gstPercentage ?? c.GSTPercentage ?? 0)
      }));
    });

    // Quotation list + Customer list
    forkJoin({
      quotations: this.quotationSvc.getAll(),
      customers: this.customerSvc.GetAllCustomerDetails(),
    }).subscribe((res: any) => {
      this.quotationList = res.quotations?.data ?? [];
      this.customers = res.customers?.data ?? [];

      this.filteredLists.quotationNo = [...this.quotationList];
      this.filteredLists.customer = [...this.customers];
      this.filteredLists.warehouse = [...this.warehousesMaster]; // empty initially
    });
  }

  /** ======= Header dropdown helpers ======= */
isEmpty(v: any): boolean {
  return (v ?? '').toString().trim() === '';
}
  toggleDropdown(field: 'quotationNo' | 'customer' | 'warehouse', open?: boolean) {
    this.dropdownOpen[field] = open !== undefined ? open : !this.dropdownOpen[field];
    if (field === 'quotationNo') {
      this.filteredLists[field] = [...this.quotationList];
    } else if (field === 'customer') {
      this.filteredLists[field] = [...this.customers];
    } else {
      this.filteredLists[field] = [...this.warehousesMaster];
    }
  }

  filter(field: 'quotationNo' | 'customer' | 'warehouse') {
    const q = (this.searchTexts[field] || '').toLowerCase();
    if (field === 'quotationNo') {
      this.filteredLists[field] = this.quotationList.filter(x => (x.number || '').toLowerCase().includes(q));
    } else if (field === 'customer') {
      this.filteredLists[field] = this.customers.filter(x => (x.customerName || '').toLowerCase().includes(q));
    } else {
      this.filteredLists[field] = this.warehousesMaster.filter(x =>
        (x.warehouseName || '').toLowerCase().includes(q) || String(x.id).includes(q));
    }
  }

  /** Select from header dropdowns */
  select(field: 'quotationNo' | 'customer', item: any) {
    if (field === 'quotationNo') {
      // 1) set quotation on header
      this.soHdr.quotationNo = item.id;
      this.searchTexts['quotationNo'] = item.number ?? '';

      // 2) set customer name display
      this.searchTexts['customer'] = item.customerName ?? '';

      // 3) find customerId
      const match = (this.customers ?? []).find((c: any) =>
        (c.customerName ?? c.name ?? '').toLowerCase() === (item.customerName ?? '').toLowerCase()
      );
      this.soHdr.customerId = match?.customerId ?? this.soHdr.customerId ?? 0;

      // 4) GST by customer's country
      const cust = this.customers.find(x => x.customerId === this.soHdr.customerId) || null;
      const country = this.countries?.find((c: any) => c.id === (cust?.countryId ?? -1)) || null;
      this.soHdr.gstPct = country?.gstPercentage ?? 0;

      // 5) Load quotation detail (lines + per-line warehouses)
      this.salesOrderService.GetByQuatitonDetails(this.soHdr.quotationNo).subscribe((res: any) => {
        const lines = (res?.data?.lines ?? []) as any[];

        this.soLines = lines.map(l => {
          const wh: WarehouseInfo[] = Array.isArray(l.warehouses)
            ? l.warehouses
            : (l.warehousesJson ? safeJsonParse<WarehouseInfo[]>(l.warehousesJson, []) : []);

          const line: SoLine = {
            item: l.itemName,
            itemId: l.itemId,
            uom: l.uomName ?? '',
            quantity: Number(l.qty) || 0,
            unitPrice: Number(l.unitPrice) || 0,
            discount: Number(l.discountPct) || 0,
            tax: (l.taxMode || 'EXCLUSIVE') as any,
            lineNet: Number(l.lineNet) || 0,
            lineTax: Number(l.lineTax) || 0,
            total: Number(l.lineTotal) || 0,

            warehouses: wh,
            selectedWarehouseId: wh?.length === 1 ? wh[0].warehouseId : null, // auto-pick if only one
            selectedWh: wh?.length === 1 ? { ...wh[0] } : null,

            dropdownOpen: '',
            filteredOptions: []
          };
          return line;
        });

        // Build header warehouse master = union of all line warehouses
        const seen = new Map<number, string>();
        this.soLines.forEach(l => (l.warehouses || []).forEach(w => seen.set(w.warehouseId, w.warehouseName)));
        this.warehousesMaster = Array.from(seen.entries()).map(([id, warehouseName]) => ({ id, warehouseName }));
        this.filteredLists.warehouse = [...this.warehousesMaster];

        this.recalcTotals();
      });

      // close dropdowns
      this.dropdownOpen['quotationNo'] = false;
      this.dropdownOpen['customer'] = false;
      return;
    }

    if (field === 'customer') {
      this.soHdr.customerId = item.id;
      this.searchTexts['customer'] = item.customerName ?? item.name ?? '';
      this.dropdownOpen['customer'] = false;
      return;
    }
  }

  /** Header warehouse dropdown select (optional, informational) */
  selectWarehouse(w: WarehouseMaster) {
    this.selectedWarehouseId = w.id;
    this.selectedWarehouseName = w.warehouseName;
    this.searchTexts['warehouse'] = w.warehouseName;
    this.dropdownOpen['warehouse'] = false;
  }

  onClearWarehouse() {
    this.searchTexts['warehouse'] = '';
    this.selectedWarehouseId = null;
    this.selectedWarehouseName = '';
    this.dropdownOpen['warehouse'] = false;
  }

  onClearSearch(field: 'quotationNo' | 'customer') {
    this.searchTexts[field] = '';
    this.dropdownOpen[field] = false;
    if (field === 'quotationNo') this.soHdr.quotationNo = 0;
    if (field === 'customer') this.soHdr.customerId = 0;
  }

  /** Close any open dropdowns if clicking outside */
  @HostListener('document:click', ['$event'])
  onDocClick(e: Event) {
    const el = e.target as HTMLElement;
    if (!el.closest('.so-header-dd')) {
      Object.keys(this.dropdownOpen).forEach(k => (this.dropdownOpen[k] = false));
    }
    this.soLines.forEach(l => {
      if (!el.closest('.so-line-dd')) l.dropdownOpen = '';
    });
  }

  /** ======= Line mini-dropdowns (item/tax) ======= */
  openDropdown(i: number, field: 'item' | 'tax') {
    this.soLines[i].dropdownOpen = field;
    this.soLines[i].filteredOptions = field === 'item' ? [...this.items] : [...this.taxCodes];
  }

  filterOptions(i: number, field: 'item' | 'tax') {
    const q = ((this.soLines[i] as any)[field] || '').toString().toLowerCase();
    if (field === 'item') {
      this.soLines[i].filteredOptions = this.items.filter(x =>
        (x.itemCode || '').toLowerCase().includes(q) ||
        (x.itemName || '').toLowerCase().includes(q));
    } else {
      this.soLines[i].filteredOptions = this.taxCodes.filter(x =>
        (x.name || '').toLowerCase().includes(q) ||
        (x.code || '').toLowerCase().includes(q));
    }
  }

  selectOption(i: number, field: 'item' | 'tax', opt: any) {
    if (field === 'item') {
      this.soLines[i].item = `${opt.itemCode} - ${opt.itemName}`;
      this.soLines[i].itemId = opt.id;
      this.soLines[i].uom = opt.defaultUom || this.soLines[i].uom || '';
      if (!this.soLines[i].unitPrice) this.soLines[i].unitPrice = Number(opt.price || 0);
      this.recalcLine(i);
    } else {
      this.soLines[i].tax = opt.code;
      this.recalcLine(i);
    }
    this.soLines[i].dropdownOpen = '';
    this.soLines[i].filteredOptions = [];
  }

  /** ======= Per-line Warehouse change ======= */
  onWarehouseChange(i: number) {
    const L = this.soLines[i];
    const id = L.selectedWarehouseId ?? null;
    if (!id) { L.selectedWh = null; return; }
    const found = (L.warehouses || []).find(w => w.warehouseId === id) || null;
    L.selectedWh = found ? { ...found } : null;
  }

  /** ======= Calculations ======= */
  private round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

  recalcLine(i: number) {
    const L = this.soLines[i];
    const qty = Number(L.quantity) || 0;
    const price = Number(L.unitPrice) || 0;
    const disc = Number(L.discount) || 0;
    const rate = (Number(this.soHdr.gstPct) || 0) / 100;

    const sub = qty * price;
    const afterDisc = sub - (sub * disc / 100);

    let net = afterDisc, tax = 0, tot = afterDisc;
    switch (L.tax ?? 'EXCLUSIVE') {
      case 'EXCLUSIVE':
        net = afterDisc; tax = net * rate; tot = net + tax; break;
      case 'INCLUSIVE':
        tot = afterDisc; net = rate > 0 ? (tot / (1 + rate)) : tot; tax = tot - net; break;
      default:
        net = afterDisc; tax = 0; tot = afterDisc; break;
    }

    L.lineNet = this.round2(net);
    L.lineTax = this.round2(tax);
    L.total = this.round2(tot);
    this.recalcTotals();
  }

  get totals() {
    const net = this.soLines.reduce((s, x) => s + (x.lineNet || 0), 0);
    const tax = this.soLines.reduce((s, x) => s + (x.lineTax || 0), 0);
    const ship = Number(this.soHdr.shipping || 0);
    const hdrDc = Number(this.soHdr.discount || 0);
    return {
      subTotal: this.round2(net),
      gstAmount: this.round2(tax),
      netTotal: this.round2(net + tax + ship - hdrDc)
    };
  }

  recalcTotals() { this.soHdr = { ...this.soHdr }; }

  /** ======= Validate & Save ======= */
  private validateSO(): boolean {
    // header required
    const missing = this.requiredKeys.filter(k => this.isEmpty(this.searchTexts[k]));
    if (missing.length) {
      this.submitted = true;
      Swal.fire({ icon: 'warning', title: 'Required', text: 'Please fill required header fields.' });
      return false;
    }
    // lines present
    if (this.soLines.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Required', text: 'Please add at least one line.' });
      return false;
    }
    // each line valid
    const bad = this.soLines.find(l => !l.itemId || !(Number(l.quantity) > 0) || !(Number(l.unitPrice) > 0));
    if (bad) {
      Swal.fire({ icon: 'warning', title: 'Required', text: 'Each line needs Item, Qty > 0, Unit Price > 0.' });
      return false;
    }
    return true;
  }

  post(): void {
    if (!this.validateSO()) return;

    const payload = {
      // header
      id: this.soHdr.id,
      quotationNo: this.soHdr.quotationNo,
      customerId: this.soHdr.customerId,
      requestedDate: this.soHdr.requestedDate,
      deliveryDate: this.soHdr.deliveryDate,
      shipping: Number(this.soHdr.shipping || 0),
      discount: Number(this.soHdr.discount || 0),
      gstPct: Number(this.soHdr.gstPct || 0),
      status: this.soHdr.status,
      customerName: this.searchTexts.customer,

      // optional header selection
      headerWarehouseId: this.selectedWarehouseId ?? null,
      headerWarehouseName: this.selectedWarehouseName || null,

      // lines
      lineItems: this.soLines.map(l => ({
        id: 0, // if edit, put existing id
        itemId: l.itemId!,
        itemName: (l.item || '').toString(),
        uom: l.uom || '',
        quantity: Number(l.quantity) || 0,
        unitPrice: Number(l.unitPrice) || 0,
        discount: Number(l.discount) || 0,
        tax: l.tax || null,
        total: Number(l.total) || 0,
        // persist the user's per-line selection (not shown in UI beyond dropdown)
        selectedWarehouseId: l.selectedWarehouseId ?? null,
        selectedWarehouseAvailable: l.selectedWh?.available ?? null
      })),

      totals: this.totals
    };

    this.salesOrderService.insertSO(payload).subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: 'Created!',
          text: 'Sales Order created successfully',
          confirmButtonText: 'OK',
          confirmButtonColor: '#0e3a4c'
        });
        this.router.navigate(['/Sales/Sales-Order-list']);
      },
      error: () => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to create Sales Order',
          confirmButtonText: 'OK',
          confirmButtonColor: '#d33'
        });
      }
    });
  }

  /** ======= Misc UI ======= */
  removeLine(i: number) {
    this.soLines.splice(i, 1);
    this.recalcTotals();
  }

  trackByIndex = (i: number) => i;

  reserveStock() { this.allocation.reservedPct = 60; }
  releaseToPicking() { Swal.fire({ icon: 'success', title: 'Released', text: 'Released to picking' }); }

  gridColsClass(cols: number) {
    return {
      'grid grid-cols-1 gap-3': true,
      'md:grid-cols-1': cols === 1,
      'md:grid-cols-2': cols === 2,
      'md:grid-cols-3': cols === 3,
      'md:grid-cols-4': cols === 4,
      'md:grid-cols-5': cols === 5,
      'md:grid-cols-6': cols === 6
    };
  }

  cancel() {
    this.router.navigate(['/Sales/Sales-Order-list']);
  }
}

/** safe JSON parse helper */
function safeJsonParse<T>(txt: string, fallback: T): T {
  try { return JSON.parse(txt) as T; } catch { return fallback; }
}
