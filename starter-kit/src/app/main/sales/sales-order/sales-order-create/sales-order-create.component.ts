import { Component, HostListener, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';

/** Types (adapt or import your own) */
type SoLine = {
  item?: string;      // "CODE - NAME" display
  itemId?: number;
  uom?: string;
  qty?: number | string;
  unitPrice?: number | string;
  discountPct?: number | string;
  taxCode?: string;
  amount?: number;

  // dropdown helpers per-row
  dropdownOpen?: '' | 'item' | 'taxCode';
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
    warehouseId: 0,
    requestedDate: '',
    deliveryDate: '',
    shipping: 0,
    discount: 0,
    gstPct: 0,
    status: 1, // 1=Pending,2=Approved,3=Rejected
    statusText: 'Pending'
  };

  /** -------- Masters (bind from API) ---------- */
  customers: any[] = [];
  warehouses: any[] = [];
  quotationList: any[] = [];
  items: any[] = [];
  taxCodes: any[] = [];

  /** -------- Lines ---------- */
  soLines: SoLine[] = [];

  /** -------- DropDowns (Header) ---------- */
  submitted = false;

  // visible text in inputs
  searchTexts: { [k: string]: string } = {
    customer: '',
    warehouse: ''
  };

  // dropdown open/close
  dropdownOpen: { [k: string]: boolean } = {
    customer: false,
    warehouse: false
  };

  // filtered lists to render
  filteredLists: { [k: string]: any[] } = {
    customer: [],
    warehouse: []
  };

  // which header fields are required (by searchText)
  requiredKeys = ['customer', 'warehouse'];

  /** -------- Allocation (optional UI) ---------- */
  allocation = { reservedPct: 0 };

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    // inject your real services here (CustomersService, ItemsService, etc.)
  ) {}

  ngOnInit(): void {
    // Load masters (replace with your real calls)
    forkJoin({
      quoations: this.mock([{ id: 10, name: 'Main DC (SG)' }]),
      customers: this.mock([{ id: 1, name: 'FB Holdings HQ' }]),
      warehouses: this.mock([{ id: 10, name: 'Main DC (SG)' }]),
      items: this.mock([
        { id: 1001, itemCode: 'BTL500', itemName: 'Black Tea Leaves 500g', defaultUom: 'PKT', price: 2.5 }
      ]),
      taxCodes: this.mock([{ code: 'GST7', name: 'GST7 (7%)', pct: 7 }])
    }).subscribe((res: any) => {
      this.quotationList = res.quoations;
      this.customers = res.customers;
      this.warehouses = res.warehouses;
      this.items = res.items;
      this.taxCodes = res.taxCodes;

      // init header dropdown source
      this.filteredLists.quotation = [...this.quotationList];
      this.filteredLists.customer = [...this.customers];
      this.filteredLists.warehouse = [...this.warehouses];

      // starter row
      if (this.soLines.length === 0) this.addLine();
    });

    // if edit mode, grab id and hydrate header+lines here...
  }

  /** quick mock helper — replace with real observables */
  private mock<T>(data: T) {
    return { subscribe: (cb: (x: T) => void) => cb(data) } as any;
  }

  /** ======= Header dropdown helpers (SearchText style) ======= */

  isEmpty(v: any): boolean {
    return (v ?? '').toString().trim() === '';
  }

  toggleDropdown(field: 'quotationNo' |'customer' | 'warehouse', open?: boolean) {
    this.dropdownOpen[field] = open !== undefined ? open : !this.dropdownOpen[field];
    if (field === 'quotationNo') {
      this.filteredLists[field] = [...this.quotationList];
    } else if (field === 'customer') {
      this.filteredLists[field] = [...this.customers];
    } else if (field === 'warehouse') {
      this.filteredLists[field] = [...this.warehouses];
    }
  }

  filter(field: 'quotationNo' |'customer' | 'warehouse') {
    const q = (this.searchTexts[field] || '').toLowerCase();
     if(field === 'quotationNo'){
     this.filteredLists[field] = this.quotationList.filter(x => (x.name || '').toLowerCase().includes(q));
    } else if (field === 'customer') {
      this.filteredLists[field] = this.customers.filter(x => (x.name || '').toLowerCase().includes(q));
    } else if(field === 'warehouse') {
      this.filteredLists[field] = this.warehouses.filter(x => (x.name || '').toLowerCase().includes(q));
    }
  }

  select(field: 'quotationNo' | 'customer' | 'warehouse', item: any) {
    this.searchTexts[field] = item.name;
    if (field === 'quotationNo') this.soHdr.quotationNo = item.id;
    if (field === 'customer') this.soHdr.customerId = item.id;
    if (field === 'warehouse') this.soHdr.warehouseId = item.id;
    this.dropdownOpen[field] = false;
  }

  onClearSearch(field: 'quotationNo' | 'customer' | 'warehouse') {
    this.searchTexts[field] = '';
    this.dropdownOpen[field] = false;
    if (field === 'quotationNo') this.soHdr.quotationNo = 0; 
    if (field === 'customer') this.soHdr.customerId = 0;
    if (field === 'warehouse') this.soHdr.warehouseId = 0;
  }

  /** Close any open dropdowns if clicking outside */
  @HostListener('document:click', ['$event'])
  onDocClick(e: Event) {
    const el = e.target as HTMLElement;

    // header dropdowns
    if (!el.closest('.so-header-dd')) {
      Object.keys(this.dropdownOpen).forEach(k => (this.dropdownOpen[k] = false));
    }
    // line dropdowns
    this.soLines.forEach(l => {
      if (!el.closest('.so-line-dd')) l.dropdownOpen = '';
    });
  }

  /** ======= Lines with SearchText-like dropdowns ======= */

  addLine() {
    this.soLines.push({
      item: '',
      itemId: 0,
      uom: '',
      qty: 0,
      unitPrice: 0,
      discountPct: 0,
      taxCode: '',
      amount: 0,
      dropdownOpen: '',
      filteredOptions: []
    });
  }

  removeLine(i: number) {
    this.soLines.splice(i, 1);
    this.recalcTotals();
  }

  trackByIndex = (i: number) => i;

  /** open the mini dropdown in a cell */
  openDropdown(i: number, field: 'item' | 'taxCode') {
    this.soLines[i].dropdownOpen = field;
    if (field === 'item') {
      this.soLines[i].filteredOptions = [...this.items];
    } else {
      this.soLines[i].filteredOptions = [...this.taxCodes];
    }
  }

  /** filter options for that row/field */
  filterOptions(i: number, field: 'item' | 'taxCode') {
    const q = ((this.soLines[i] as any)[field] || '').toString().toLowerCase();

    if (field === 'item') {
      this.soLines[i].filteredOptions = this.items.filter(x =>
        (x.itemCode || '').toLowerCase().includes(q) ||
        (x.itemName || '').toLowerCase().includes(q)
      );
    } else {
      this.soLines[i].filteredOptions = this.taxCodes.filter(x =>
        (x.name || '').toLowerCase().includes(q) ||
        (x.code || '').toLowerCase().includes(q)
      );
    }
  }

  /** when clicking an option */
  selectOption(i: number, field: 'item' | 'taxCode', opt: any) {
    if (field === 'item') {
      // display "CODE - NAME", keep id for saving
      this.soLines[i].item = `${opt.itemCode} - ${opt.itemName}`;
      this.soLines[i].itemId = opt.id;
      this.soLines[i].uom = opt.defaultUom || this.soLines[i].uom || '';
      if (!this.soLines[i].unitPrice) this.soLines[i].unitPrice = Number(opt.price || 0);
      this.recalcLine(i);
    } else {
      this.soLines[i].taxCode = opt.code;
      this.recalcLine(i);
    }

    this.soLines[i].dropdownOpen = '';
    this.soLines[i].filteredOptions = [];
  }

  /** ======= Calculations ======= */

  recalcLine(i: number) {
    const L = this.soLines[i];
    const qty = Number(L.qty) || 0;
    const price = Number(L.unitPrice) || 0;
    const disc = Number(L.discountPct) || 0;

    const sub = qty * price;
    const afterDisc = sub - (sub * disc) / 100;

    const taxPct = (this.taxCodes.find(t => t.code === L.taxCode)?.pct ?? 0);
    const taxAmt = afterDisc * (taxPct / 100);

    L.amount = this.round(afterDisc + taxAmt);
    this.recalcTotals();
  }

  get totals() {
    const subTotal = this.soLines.reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const withShip = subTotal + Number(this.soHdr.shipping || 0);
    const afterDisc = withShip - Number(this.soHdr.discount || 0);
    const gstAmt = afterDisc * (Number(this.soHdr.gstPct || 0) / 100);
    const net = afterDisc + gstAmt;

    return {
      subTotal: this.round(subTotal),
      gstAmount: this.round(gstAmt),
      netTotal: this.round(net)
    };
  }

  recalcTotals() {
    this.soHdr = { ...this.soHdr }; // trigger CD
  }

  round(v: number) {
    return Math.round((v + Number.EPSILON) * 100) / 100;
  }

  /** ======= Actions ======= */

  setStatus(n: 1 | 2 | 3 | 'Pending' | 'Approved' | 'Rejected') {
    let s = typeof n === 'number' ? n : (n === 'Approved' ? 2 : n === 'Rejected' ? 3 : 1);
    this.soHdr.status = s;
    this.soHdr.statusText = s === 2 ? 'Approved' : s === 3 ? 'Rejected' : 'Pending';
  }

  validateSO(): boolean {
    // header required by searchtexts
    const missing = this.requiredKeys.filter(k => this.isEmpty(this.searchTexts[k]));
    if (missing.length) {
      this.submitted = true;
      Swal.fire({ icon: 'warning', title: 'Required', text: 'Please fill required header fields.' });
      return false;
    }
    // lines
    if (this.soLines.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Required', text: 'Please add at least one line.' });
      return false;
    }
    const bad = this.soLines.find(l => !l.itemId || !(Number(l.qty) > 0) || !(Number(l.unitPrice) > 0));
    if (bad) {
      Swal.fire({ icon: 'warning', title: 'Required', text: 'Each line needs Item, Qty > 0, Unit Price > 0.' });
      return false;
    }
    return true;
  }

  post() {
    if (!this.validateSO()) return;

    const payload = {
      ...this.soHdr,
      customerName: this.searchTexts.customer,
      warehouseName: this.searchTexts.warehouse,
      lines: this.soLines.map(l => ({
        itemId: l.itemId,
        uom: l.uom,
        qty: Number(l.qty) || 0,
        unitPrice: Number(l.unitPrice) || 0,
        discountPct: Number(l.discountPct) || 0,
        taxCode: l.taxCode || null,
        amount: Number(l.amount) || 0
      })),
      totals: this.totals
    };

    // call your service here
    Swal.fire({ icon: 'success', title: 'Posted', text: 'Sales Order created' });
    this.router.navigate(['/sales/list-salesorder']);
  }

  
  cancel()  { this.router.navigate(['/Sales/Sales-Order-list']); }

  /** ======= UI helpers ======= */
  reserveStock(){ this.allocation.reservedPct = 60; }
  releaseToPicking(){ Swal.fire({ icon: 'success', title: 'Released', text: 'Released to picking' }); }

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
}
