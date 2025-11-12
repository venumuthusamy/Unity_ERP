import { Component, HostListener, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';

import { CustomerMasterService } from 'app/main/businessPartners/customer-master/customer-master.service';
import { QuotationsService } from '../../quotations/quotations.service';
import { CountriesService } from 'app/main/master/countries/countries.service';
import { SalesOrderService } from '../sales-order.service';

/* ================= Types ================= */
type WarehouseInfo = {
  warehouseId: number;
  warehouseName: string;
  onHand: number;
  reserved: number;
  available: number;
};

type WarehouseMaster = { id: number; warehouseName: string };

type LineTaxMode = 'EXCLUSIVE' | 'INCLUSIVE' | 'EXEMPT';

type SoLine = {
  // server line id for UPDATE
  __id?: number;

  item?: string;
  itemId?: number;
  uom?: string;

  quantity?: number | string;
  unitPrice?: number | string;
  discount?: number | string;
  tax?: LineTaxMode;

  lineNet?: number;
  lineTax?: number;
  total?: number;

  // snapshot from server (used to freeze initial values)
  __origQty?: number;
  __origNet?: number;
  __origTax?: number;
  __origTotal?: number;

  // read-only availability badges
  warehouses?: WarehouseInfo[];

  // row dropdowns for item/tax
  dropdownOpen?: '' | 'item' | 'tax';
  filteredOptions?: any[];
};

type PreviewPiece = {
  warehouseId?: number;
  supplierId?: number;
  binId?: number | null;
  warehouseName?: string | null;
  supplierName?: string | null;
  binName?: string | null;
  qty: number;
};

type PreviewLine = {
  itemId: number;
  requestedQty: number;
  allocatedQty: number;
  fullyAllocated: boolean;
  allocations: PreviewPiece[];
};

@Component({
  selector: 'app-sales-order-create',
  templateUrl: './sales-order-create.component.html',
  styleUrls: ['./sales-order-create.component.scss']
})
export class SalesOrderCreateComponent implements OnInit {

  /* ============ Mode ============ */
  editMode = false;
  private routeId: number | null = null;

  /* ============ Header Model ============ */
  soHdr: any = {
    id: 0,
    quotationNo: '',
    customerId: 0,
    requestedDate: '',
    deliveryDate: '',
    shipping: 0,
    discount: 0,
    gstPct: 0,       // set from quotation API or server
    status: 1,
    statusText: 'Pending'
  };

  /* ============ Masters ============ */
  customers: any[] = [];
  quotationList: any[] = [];
  items: any[] = [];
  taxCodes: any[] = [];

  warehousesMaster: WarehouseMaster[] = [];
  selectedWarehouseId: number | null = null;
  selectedWarehouseName = '';

  /* ============ Lines ============ */
  soLines: SoLine[] = [];

  /* ============ Header dropdown helpers ============ */
  submitted = false;

  searchTexts: { [k: string]: string } = {
    quotationNo: '',
    customer: '',
    warehouse: ''
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

  requiredKeys: Array<'quotationNo' | 'customer'> = ['quotationNo', 'customer'];

  /* ============ Preview ============ */
  showPreview = false;
  previewData: PreviewLine[] = [];

  countries: any[] = [];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private customerSvc: CustomerMasterService,
    private quotationSvc: QuotationsService,
    private countriesSvc: CountriesService,
    private salesOrderService: SalesOrderService
  ) {}

  ngOnInit(): void {
    // 1) Detect mode
    const idParam = this.route.snapshot.paramMap.get('id');
    this.editMode = !!idParam;
    this.routeId = idParam ? Number(idParam) : null;

      if (!this.editMode) {
    this.soHdr.requestedDate = this.toInputDate(new Date());
  }

    // 2) Load masters
    this.countriesSvc.getCountry().subscribe((res: any) => {
      this.countries = (res?.data ?? []).map((c: any) => ({
        id: Number(c.id ?? c.Id),
        countryName: String(c.countryName ?? c.CountryName ?? '').trim(),
        gstPercentage: Number(c.gstPercentage ?? c.GSTPercentage ?? 0)
      }));
    });

    forkJoin({
      quotations: this.quotationSvc.getAll(),
      customers: this.customerSvc.GetAllCustomerDetails(),
    }).subscribe((res: any) => {
      this.quotationList = res.quotations?.data ?? [];
      this.customers = res.customers?.data ?? [];

      this.filteredLists.quotationNo = [...this.quotationList];
      this.filteredLists.customer = [...this.customers];
      this.filteredLists.warehouse = [...this.warehousesMaster];

      // 3) If edit mode, load existing SO by id
      if (this.editMode && this.routeId) {
        this.loadSOForEdit(this.routeId);
      }
    });
  }

  /* ======== helpers for amounts ======== */
  private round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

  private calcAmounts(
    qty: number,
    unitPrice: number,
    discountPct: number,
    taxMode: string | null | undefined,
    gstPct: number
  ) {
    const sub = qty * unitPrice;
    const afterDisc = sub - (sub * (discountPct || 0) / 100);
    const rate = (gstPct || 0) / 100;
    const mode = (taxMode ?? 'EXCLUSIVE').toUpperCase();

    let net = afterDisc, tax = 0, tot = afterDisc;
    if (mode === 'EXCLUSIVE') { net = afterDisc; tax = net * rate; tot = net + tax; }
    else if (mode === 'INCLUSIVE') { tot = afterDisc; net = rate > 0 ? (tot / (1 + rate)) : tot; tax = tot - net; }
    else { net = afterDisc; tax = 0; tot = afterDisc; }

    return {
      net: this.round2(net),
      tax: this.round2(tax),
      total: this.round2(tot)
    };
  }

  /* ============ Load SO (Edit) ============ */
  private loadSOForEdit(id: number) {
    this.salesOrderService.getSOById(id).subscribe({
      next: (res) => {
        const head = res?.data || {};
        // Header
        this.soHdr.id = head.id;
        this.soHdr.quotationNo = head.quotationNo; // number/id string
        this.soHdr.customerId = head.customerId;
        this.searchTexts['quotationNo'] = head.number || head.quotationNo?.toString() || '';
        this.searchTexts['customer'] = head.customerName || '';

        // Dates (ensure yyyy-MM-dd)
        this.soHdr.requestedDate = this.toInputDate(head.requestedDate);
        this.soHdr.deliveryDate  = this.toInputDate(head.deliveryDate);

        this.soHdr.shipping = Number(head.shipping ?? 0);
        this.soHdr.discount = Number(head.discount ?? 0);
        this.soHdr.gstPct   = Number(head.gstPct ?? 0);
        this.soHdr.status   = head.status ?? 1;
        this.soHdr.statusText = this.mapStatusText(this.soHdr.status);

        // Lines
        const lines = (head.lineItems ?? []) as any[];
        this.soLines = lines.map((l: any) => {
          // server → UI
          const qty = Number(l.quantity ?? 0);
          const price = Number(l.unitPrice ?? 0);
          const disc = Number(l.discount ?? 0);
          const taxMode = (l.tax || 'EXCLUSIVE') as LineTaxMode;

          // recompute amounts for edit view
          const amt = this.calcAmounts(qty, price, disc, taxMode, Number(this.soHdr.gstPct || 0));

          const line: SoLine = {
            __id: Number(l.id || l.Id || 0) || undefined,

            item: l.itemName || l.item || '',
            itemId: Number(l.itemId ?? 0) || undefined,
            uom: l.uom || l.uomName || '',

            quantity: qty,
            unitPrice: price,
            discount: disc,
            tax: taxMode,

            lineNet: amt.net,
            lineTax: amt.tax,
            total: amt.total,

            __origQty: qty,
            __origNet: amt.net,
            __origTax: amt.tax,
            __origTotal: amt.total,

            warehouses: [],
            dropdownOpen: '',
            filteredOptions: []
          };
          return line;
        });

        this.filteredLists.warehouse = [...this.warehousesMaster];
        this.recalcTotals();
      },
      error: (err) => {
        Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load Sales Order.' });
        console.error(err);
      }
    });
  }

  private mapStatusText(v: any): string {
    const n = Number(v);
    return n === 0 ? 'Draft' : n === 1 ? 'Pending' : n === 2 ? 'Approved' : n === 3 ? 'Rejected' : 'Unknown';
  }

  private toInputDate(d: any): string {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /* ============ Header dropdown helpers ============ */
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

  // Select from header dropdowns (disabled in edit)
  select(field: 'quotationNo' | 'customer', item: any) {
    if (this.editMode) return; // disabled in edit mode

    if (field === 'quotationNo') {
      this.soHdr.quotationNo = item.id;
      this.searchTexts['quotationNo'] = item.number ?? '';
      this.searchTexts['customer'] = item.customerName ?? '';

      // resolve customerId to store
      const match = (this.customers ?? []).find((c: any) =>
        (c.customerName ?? c.name ?? '').toLowerCase() === (item.customerName ?? '').toLowerCase()
      );
      this.soHdr.customerId = match?.customerId ?? this.soHdr.customerId ?? 0;

      // Load quotation detail → lines + warehouses + GST
      this.salesOrderService.GetByQuatitonDetails(this.soHdr.quotationNo).subscribe((res: any) => {
        const head = res?.data || res || {};
        const lines = (head?.lines ?? []) as any[];

        // GST from API (supports gstPct or gst)
        this.soHdr.gstPct = Number(head?.gstPct ?? head?.gst ?? 0);

        // map lines WITHOUT recalculating — keep server values as-is
        this.soLines = lines.map(l => {
          const wh: WarehouseInfo[] = Array.isArray(l.warehouses)
            ? l.warehouses
            : (l.warehousesJson ? safeJsonParse<WarehouseInfo[]>(l.warehousesJson, []) : []);

          const qty = Number(l.qty) || 0;
          const lineNet = Number(l.lineNet) || 0;
          const lineTax = Number(l.lineTax) || 0;
          const lineTotal = Number(l.lineTotal) || 0;

          const line: SoLine = {
            __id: undefined, // new SO lines → will be 0 in payload

            item: l.itemName,
            itemId: l.itemId,
            uom: l.uomName ?? '',

            quantity: qty,
            unitPrice: Number(l.unitPrice) || 0,
            discount: Number(l.discountPct) || 0,
            tax: (l.taxMode || 'EXCLUSIVE') as LineTaxMode,

            lineNet,
            lineTax,
            total: lineTotal,

            __origQty: qty,
            __origNet: lineNet,
            __origTax: lineTax,
            __origTotal: lineTotal,

            warehouses: wh,
            dropdownOpen: '',
            filteredOptions: []
          };
          return line;
        });

        // optional header warehouse list
        const seen = new Map<number, string>();
        this.soLines.forEach(l => (l.warehouses || []).forEach(w => seen.set(w.warehouseId, w.warehouseName)));
        this.warehousesMaster = Array.from(seen.entries()).map(([id, warehouseName]) => ({ id, warehouseName }));
        this.filteredLists.warehouse = [...this.warehousesMaster];

        this.recalcTotals();
      });

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

  onClearWarehouse() {
    this.searchTexts['warehouse'] = '';
    this.selectedWarehouseId = null;
    this.selectedWarehouseName = '';
    this.dropdownOpen['warehouse'] = false;
  }

  onClearSearch(field: 'quotationNo' | 'customer') {
    if (this.editMode) return; // disabled in edit
    this.searchTexts[field] = '';
    this.dropdownOpen[field] = false;
    if (field === 'quotationNo') this.soHdr.quotationNo = 0;
    if (field === 'customer') this.soHdr.customerId = 0;
  }

  /* ============ Close dropdowns on outside click ============ */
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

  /* ============ Item/tax dropdowns (not used for calc change) ============ */
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
      // allow changing item for new row or when not locked by id
      if (this.editMode && this.soLines[i].__id) {
        // prevent changing the item of existing line in edit mode
        this.soLines[i].dropdownOpen = '';
        this.soLines[i].filteredOptions = [];
        return;
      }
      this.soLines[i].item = `${opt.itemCode} - ${opt.itemName}`;
      this.soLines[i].itemId = opt.id;
      this.soLines[i].uom = opt.defaultUom || this.soLines[i].uom || '';
      if (!this.soLines[i].unitPrice) this.soLines[i].unitPrice = Number(opt.price || 0);
    } else {
      this.soLines[i].tax = opt.code;
    }
    this.soLines[i].dropdownOpen = '';
    this.soLines[i].filteredOptions = [];
  }

  /* ============ ONLY Qty change should recalc ============ */
  onQtyChange(i: number) {
    const L = this.soLines[i];
    const qtyNow = Number(L.quantity) || 0;

    // if qty equals original → restore original numbers and stop
    if (typeof L.__origQty === 'number' && qtyNow === L.__origQty) {
      L.lineNet = L.__origNet ?? L.lineNet;
      L.lineTax = L.__origTax ?? L.lineTax;
      L.total   = L.__origTotal ?? L.total;
      this.recalcTotals();
      return;
    }

    // qty changed → compute using GST + tax mode
    this.computeLineFromQty(i);
  }

  private computeLineFromQty(i: number) {
    const L = this.soLines[i];
    const qty = Number(L.quantity) || 0;
    const price = Number(L.unitPrice) || 0;
    const disc = Number(L.discount) || 0;
    const rate = (Number(this.soHdr.gstPct) || 0) / 100;
    const mode = L.tax ?? 'EXCLUSIVE';

    const sub = qty * price;
    const afterDisc = sub - (sub * disc / 100);

    let net = afterDisc, tax = 0, tot = afterDisc;
    switch (mode) {
      case 'EXCLUSIVE':
        net = afterDisc; tax = net * rate; tot = net + tax; break;
      case 'INCLUSIVE':
        tot = afterDisc; net = rate > 0 ? (tot / (1 + rate)) : tot; tax = tot - net; break;
      default:
        net = afterDisc; tax = 0; tot = afterDisc; break;
    }

    L.lineNet = this.round2(net);
    L.lineTax = this.round2(tax);
    L.total   = this.round2(tot);

    this.recalcTotals();
  }

  /* ============ Totals ============ */
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

  /* ============ Validate & Save ============ */
  private validateSO(): boolean {
    const missing = this.requiredKeys.filter(k => this.isEmpty(this.searchTexts[k]));
    if (missing.length) {
      this.submitted = true;
      Swal.fire({ icon: 'warning', title: 'Required', text: 'Please fill required header fields.' });
      return false;
    }
    if (this.soLines.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Required', text: 'Please add at least one line.' });
      return false;
    }
    const bad = this.soLines.find(l => !l.itemId || !(Number(l.quantity) >= 0)); // qty can be 0
    if (bad) {
      Swal.fire({ icon: 'warning', title: 'Required', text: 'Each line needs Item and a valid Qty.' });
      return false;
    }
    return true;
  }

  private buildPayload() {
    return {
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

      lineItems: this.soLines.map(l => ({
        id: l.__id || 0,                               // ← existing lines keep their id; new = 0
        itemId: l.itemId!,
        itemName: (l.item || '').toString(),
        uom: l.uom || '',
        quantity: Number(l.quantity) || 0,
        unitPrice: Number(l.unitPrice) || 0,
        discount: Number(l.discount) || 0,
        tax: l.tax || null,
        total: Number(l.total) || 0
      })),

      totals: this.totals
    };
  }

  post(): void {
    if (!this.validateSO()) return;

    const payload = this.buildPayload();

    if (this.editMode) {
      this.salesOrderService.updateSO(payload /*, true */).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Updated!',
            text: 'Sales Order updated successfully',
            confirmButtonText: 'OK',
            confirmButtonColor: '#0e3a4c'
          });
          this.router.navigate(['/Sales/Sales-Order-list']);
        },
        error: (err) => {
          const msg = err?.error?.message || err?.message || 'Failed to update Sales Order';
          Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#d33' });
        }
      });
    } else {
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
        error: (err) => {
          const msg = err?.error?.message || err?.message || 'Failed to create Sales Order';
          Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#d33' });
        }
      });
    }
  }

  /* ============ Preview (unchanged) ============ */
  previewAlloc(): void {
    const req = this.soLines
      .filter(l => !!l.itemId && Number(l.quantity) > 0)
      .map(l => ({ itemId: l.itemId as number, quantity: Number(l.quantity) || 0 }));

    if (req.length === 0) {
      Swal.fire({ icon: 'info', title: 'Nothing to preview', text: 'Add at least one valid line.' });
      return;
    }

    this.salesOrderService.previewAllocation(req).subscribe({
      next: (res: any) => {
        const linesFromWrapper = res?.data?.lines;
        const linesDirect = res?.lines;
        this.previewData = (linesFromWrapper ?? linesDirect ?? []) as PreviewLine[];
        this.showPreview = true;
      },
      error: () => {
        Swal.fire({ icon: 'error', title: 'Preview failed', text: 'Cannot preview allocation now.' });
      }
    });
  }

  closePreview(): void { this.showPreview = false; }

  /* ============ Misc UI ============ */
  removeLine(i: number) {
    this.soLines.splice(i, 1);
    this.recalcTotals();
  }

  trackByIndex = (i: number) => i;

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
  todayStr = this.toInputDate(new Date());


  cancel() {
    this.router.navigate(['/Sales/Sales-Order-list']);
  }
}

/* ============ safe JSON parse helper ============ */
function safeJsonParse<T>(txt: string, fallback: T): T {
  try { return JSON.parse(txt) as T; } catch { return fallback; }
}

