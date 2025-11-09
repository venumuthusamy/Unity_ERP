import { Component, HostListener, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CustomerMasterService } from 'app/main/businessPartners/customer-master/customer-master.service';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';
import { QuotationsService } from '../../quotations/quotations.service';
import { CountriesService } from 'app/main/master/countries/countries.service';
import { SalesOrderService } from '../sales-order.service';

/** Types (adapt or import your own) */
type SoLine = {
  item?: string;      // "CODE - NAME" display
  itemId?: number;
  uom?: string;
  quantity?: number | string;
  unitPrice?: number | string;
  discount?: number | string;
  tax?: 'EXCLUSIVE' | 'INCLUSIVE' | 'EXEMPT';
  lineNet?: number;
  lineTax?: number;
  total?: number;

  // dropdown helpers per-row
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

  /** -------- Masters (bind from API) ---------- */
  customers: any[] = [];
  quotationList: any[] = [];
  items: any[] = [];
  taxCodes: any[] = [];

  /** -------- Lines ---------- */
  soLines: SoLine[] = [];

  /** -------- DropDowns (Header) ---------- */
  submitted = false;

  // visible text in inputs
  searchTexts: { [k: string]: string } = {
    quotationNo: '',
    customer: '',
  };

  // dropdown open/close
  dropdownOpen: { [k: string]: boolean } = {
    quotationNo: false,
    customer: false,
  };

  // filtered lists to render
  filteredLists: { [k: string]: any[] } = {
    quotationNo: [],
    customer: [],
  };

  // which header fields are required (by searchText)
  requiredKeys = ['quotationNo', 'customer',];

  /** -------- Allocation (optional UI) ---------- */
  allocation = { reservedPct: 0 };
  countries: any;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private _customerMasterService: CustomerMasterService,
    private quotationSvc: QuotationsService,
    private countriesService: CountriesService,
    private salesOrderService: SalesOrderService
  ) { }

  ngOnInit(): void {
   debugger
    this.countriesService.getCountry().subscribe((res: any) => {
         this.countries = (res?.data ?? []).map((c: any) => ({
        id: Number(c.id ?? c.Id),
        countryName: String(c.countryName ?? c.CountryName ?? '').trim(),
        gstPercentage: Number(c.gstPercentage ?? c.GSTPercentage ?? 0)
      }));})

      forkJoin({
        quotations: this.quotationSvc.getAll(),
        customers: this._customerMasterService.GetAllCustomerDetails(),

      }).subscribe((res: any) => {
        this.quotationList = res.quotations.data;
        this.customers = res.customers.data;
        // this.items = res.items;
        // this.taxCodes = res.taxCodes;

        // init header dropdown source
        this.filteredLists.quotationNo = [...this.quotationList];
        this.filteredLists.customer = [...this.customers];


        // starter row
        // if (this.soLines.length === 0) this.addLine();
      });

      // if edit mode, grab id and hydrate header+lines here...
    }

  /** quick mock helper — replace with real observables */
  private mock<T>(data: T) {
      return { subscribe: (cb: (x: T) => void) => cb(data) } as any;
    }

  /** ======= Header dropdown helpers (SearchText style) ======= */

  isEmpty(v: any): boolean {
      return(v ?? '').toString().trim() === '';
  }

  toggleDropdown(field: 'quotationNo' | 'customer', open?: boolean) {
    debugger
    this.dropdownOpen[field] = open !== undefined ? open : !this.dropdownOpen[field];
    if (field === 'quotationNo') {
      this.filteredLists[field] = [...this.quotationList];
    } else if (field === 'customer') {
      this.filteredLists[field] = [...this.customers];
    }
  }

  filter(field: 'quotationNo' | 'customer') {
    debugger
    const q = (this.searchTexts[field] || '').toLowerCase();
    if (field === 'quotationNo') {
      this.filteredLists[field] = this.quotationList.filter(x => (x.number || '').toLowerCase().includes(q));
    } else if (field === 'customer') {
      this.filteredLists[field] = this.customers.filter(x => (x.customerName || '').toLowerCase().includes(q));
    }
  }

  select(field: 'quotationNo' | 'customer', item: any) {
    debugger
    if (field === 'quotationNo') {
      // 1) set quotation
      this.soHdr.quotationNo = item.id;
      this.searchTexts['quotationNo'] = item.number ?? '';

      // 2) bind customer name from quotation
      this.searchTexts['customer'] = item.customerName ?? '';

      // 3) try to resolve customerId by name (if quotation doesn’t carry customerId)
      const match = (this.customers ?? []).find((c: any) =>
        (c.customerName ?? c.name ?? '').toLowerCase() === (item.customerName ?? '').toLowerCase()
      );
      this.soHdr.customerId = match?.customerId ?? this.soHdr.customerId ?? 0;


      const cust = this.customers.find(x => x.customerId === this.soHdr.customerId) || null;
      

      const country = this.countries.find(c => c.id === (cust?.countryId ?? -1)) || null;
     

      this.soHdr.gstPct = country?.gstPercentage ?? 0;

      // load table
      this.quotationSvc.getById(this.soHdr.quotationNo).subscribe((res: any) => {
        this.soLines = (res.data.lines || []).map((l: any) => ({
          item: l.itemName,                    // your template binds to `soLines[i].item`
          itemId: l.itemId,
          uom: l.uomName ?? '',                // template uses `uom`
          quantity: Number(l.qty) || 0,             // template uses `qty`
          unitPrice: Number(l.unitPrice) || 0, // template uses `unitPrice`
          discount: Number(l.discountPct) || 0, // template uses `discountPct`
          tax: l.taxMode as any,            // EXCLUSIVE | INCLUSIVE | EXEMPT
          lineNet: Number(l.lineNet) || 0,
          lineTax: Number(l.lineTax) || 0,         // template uses `tax` (string)
          total: Number(l.lineTotal) || 0,     // template displays `total`
          dropdownOpen: '',
          filteredOptions: []
        }));
        this.recalcTotals();
      })

      // optionally: close both dropdowns
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


  onClearSearch(field: 'quotationNo' | 'customer') {
    debugger
    this.searchTexts[field] = '';
    this.dropdownOpen[field] = false;
    if (field === 'quotationNo') this.soHdr.quotationNo = 0;
    if (field === 'customer') this.soHdr.customerId = 0;

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

  // addLine() {
  //   this.soLines.push({
  //     itemName: '',
  //     itemId: 0,
  //     uom: '',
  //     quantity: 0,
  //     unitPrice: 0,
  //     discount: 0,
  //     tax: '',
  //     total: 0,
  //     dropdownOpen: '',
  //     filteredOptions: []
  //   });
  // }

  removeLine(i: number) {
    this.soLines.splice(i, 1);
    this.recalcTotals();
  }

  trackByIndex = (i: number) => i;

  /** open the mini dropdown in a cell */
  openDropdown(i: number, field: 'item' | 'tax') {
    this.soLines[i].dropdownOpen = field;
    if (field === 'item') {
      this.soLines[i].filteredOptions = [...this.items];
    } else {
      this.soLines[i].filteredOptions = [...this.taxCodes];
    }
  }

  /** filter options for that row/field */
  filterOptions(i: number, field: 'item' | 'tax') {
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
  selectOption(i: number, field: 'item' | 'tax', opt: any) {
    if (field === 'item') {
      // display "CODE - NAME", keep id for saving
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

  /** ======= Calculations ======= */

  private round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

  recalcLine(i: number) {
    debugger
    const L = this.soLines[i];
    const qty = Number(L.quantity) || 0;
    const price = Number(L.unitPrice) || 0;
    const disc = Number(L.discount) || 0;
    const rate = (Number(this.soHdr.gstPct) || 0) / 100;   // use header GST%

    const sub = qty * price;
    const afterDisc = sub - (sub * disc / 100);

    let net = afterDisc, tax = 0, tot = afterDisc;

    switch (L.tax ?? 'EXCLUSIVE') {
      case 'EXCLUSIVE': // add GST
        net = afterDisc;
        tax = net * rate;
        tot = net + tax;
        break;
      case 'INCLUSIVE': // price includes GST
        tot = afterDisc;
        net = rate > 0 ? (tot / (1 + rate)) : tot;
        tax = tot - net;
        break;
      case 'EXEMPT':    // 0%
      default:
        net = afterDisc;
        tax = 0;
        tot = afterDisc;
        break;
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
    const hdrDc = Number(this.soHdr.discount || 0); // absolute

    return {
      subTotal: this.round2(net),
      gstAmount: this.round2(tax),
      netTotal: this.round2(net + tax + ship - hdrDc)
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
    const bad = this.soLines.find(l => !l.itemId || !(Number(l.quantity) > 0) || !(Number(l.unitPrice) > 0));
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
      LineItems: this.soLines.map(l => ({
        itemId: l.itemId,
        uom: l.uom,
        quantity: Number(l.quantity) || 0,
        unitPrice: Number(l.unitPrice) || 0,
        discount: Number(l.discount) || 0,
        tax: l.tax || null,
        total: Number(l.total) || 0
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
                text: 'Failed to created Sales Order ',
                confirmButtonText: 'OK',
                confirmButtonColor: '#d33'
              });
            }
          });
    
  }


  cancel() { this.router.navigate(['/Sales/Sales-Order-list']); }

  /** ======= UI helpers ======= */
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
}
