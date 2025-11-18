import {
  Component,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  ViewEncapsulation
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';

import { QuotationHeader, QuotationLine, QuotationsService } from '../quotations.service';
import { ItemsService } from 'app/main/master/items/items.service';
import { ChartofaccountService } from 'app/main/financial/chartofaccount/chartofaccount.service';
import { UomService } from 'app/main/master/uom/uom.service';
import { CountriesService } from 'app/main/master/countries/countries.service';
import { CustomerMasterService } from 'app/main/businessPartners/customer-master/customer-master.service';
import { CurrencyService } from 'app/main/master/currency/currency.service';
import { PaymentTermsService } from 'app/main/master/payment-terms/payment-terms.service';

// ---------- Types ----------
type SimpleItem = {
  id: number;
  itemName: string;
  itemCode?: string;
  uomName?: string;
  uomId?: number;
  catagoryName: string;
};

type LineTaxMode = 'EXCLUSIVE' | 'INCLUSIVE' | 'EXEMPT';
type Country = { id: number; countryName: string; gstPercentage: number };
type Customer = { id: number; name: string; countryId: number };
type CurrencyRow = { id: number; name: string };
type PaymentTermsRow = { id: number; name: string };

type DiscountType = 'VALUE' | 'PERCENT';

type UiLine =
  Omit<QuotationLine, 'uom' | 'uomId'> & {
    uomId: number | null;
    taxMode?: LineTaxMode;
    lineNet?: number;
    lineTax?: number;
    lineTotal?: number;
  };

type UiQuotationHeader = QuotationHeader & {
  taxPct?: number;
  countryId?: number | null;
  currency?: string;
  paymentTerms?: string;

  discountType: DiscountType;
  discountInput: number;
  docDiscount: number;
  discountManual: boolean;
};

@Component({
  selector: 'app-quotationscreate',
  templateUrl: './quotationscreate.component.html',
  styleUrls: ['./quotationscreate.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class QuotationscreateComponent implements OnInit {
  @ViewChild('itemSearchInput', { static: false }) itemSearchInput!: ElementRef<HTMLInputElement>;
  @ViewChild('customerBox') customerBox!: ElementRef<HTMLElement>;
  @ViewChild('currencyBox') currencyBox!: ElementRef<HTMLElement>;
  @ViewChild('paymentBox') paymentBox!: ElementRef<HTMLElement>;
  @ViewChild('modalItemBox') modalItemBox!: ElementRef<HTMLElement>;

  header: UiQuotationHeader = {
    status: 0,
    customerId: null,
    currencyId: 0,
    fxRate: 1,
    paymentTermsId: 0,
    validityDate: null,
    subtotal: 0,
    taxAmount: 0,
    rounding: 0,
    grandTotal: 0,
    needsHodApproval: false,
    remarks: '',
    lines: [],
    taxPct: 0,
    countryId: null,
    currency: '',
    paymentTerms: '',
   discountType: 'PERCENT',
    discountInput: 0,
    docDiscount: 0,
    discountManual: false
  };

  minDate = '';

  customers: Customer[] = [];
  countries: Country[] = [];
  activeCustomerCountry: Country | null = null;

  currenciesSrv: CurrencyRow[] = [];
  currencySearch = '';
  currencyDdOpen = false;
  filteredCurrencies: CurrencyRow[] = [];

  paymentTermsSrv: PaymentTermsRow[] = [];
  paymentTermsSearch = '';
  paymentTermsDdOpen = false;
  filteredPaymentTerms: PaymentTermsRow[] = [];

  customerSearch = '';
  customerDdOpen = false;
  filteredCustomers: Customer[] = [];

  lines: UiLine[] = [];
  hoverAdd = false;
  itemsList: SimpleItem[] = [];
  uomList: Array<{ id: number; name: string }> = [];

  showModal = false;
  editingIndex: number | null = null;
  modal: {
    itemId: number | null;
    itemSearch: string;
    qty: number | null;
    uomId: number | null;
    unitPrice: number;
    discountPct: number;
    taxMode: LineTaxMode;
    remarks: string;
    dropdownOpen: boolean;
    filteredItems: SimpleItem[];
  } = {
    itemId: null,
    itemSearch: '',
    qty: null,
    uomId: null,
    unitPrice: 0,
    discountPct: 0,
    taxMode: 'EXCLUSIVE',
    remarks: '',
    dropdownOpen: false,
    filteredItems: []
  };
  modalPreview: { net: number; tax: number; total: number } | null = null;

  private editId: number | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private qt: QuotationsService,
    private chartOfAccountService: ChartofaccountService,
    private itemsService: ItemsService,
    private uomService: UomService,
    private countriesService: CountriesService,
    private customerService: CustomerMasterService,
    private currencyService: CurrencyService,
    private paymentTermsService: PaymentTermsService
  ) {}

  // ---------- Lifecycle ----------
  ngOnInit(): void {
    this.setMinDate();
    this.loadLookups();

    const idStr = this.route.snapshot.paramMap.get('id');
    this.editId = idStr ? +idStr : null;
    if (this.editId) this.loadForEdit(this.editId);

    this.currencySearch = this.header.currency || '';
    this.paymentTermsSearch = this.header.paymentTerms || '';
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    const t = ev.target as Node;
    if (this.customerDdOpen && this.customerBox && !this.customerBox.nativeElement.contains(t)) {
      this.customerDdOpen = false;
    }
    if (this.currencyDdOpen && this.currencyBox && !this.currencyBox.nativeElement.contains(t)) {
      this.currencyDdOpen = false;
    }
    if (this.paymentTermsDdOpen && this.paymentBox && !this.paymentBox.nativeElement.contains(t)) {
      this.paymentTermsDdOpen = false;
    }
    if (this.showModal && this.modal.dropdownOpen && this.modalItemBox &&
        !this.modalItemBox.nativeElement.contains(t)) {
      this.modal.dropdownOpen = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    this.customerDdOpen = this.currencyDdOpen = this.paymentTermsDdOpen = false;
    if (this.modal) this.modal.dropdownOpen = false;
  }

  // ---------- Helpers ----------
  private toDateInput(v: string | Date | null | undefined): string | null {
    if (!v) return null;
    const d = (typeof v === 'string') ? new Date(v) : v;
    if (isNaN(d.getTime())) return null;
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  setMinDate() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    this.minDate = `${yyyy}-${mm}-${dd}`;
  }

  round2(n: number) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  statusLabel(s: number) {
    return ['Draft', 'Submitted', 'Approved', 'Rejected', 'Posted'][s] ?? 'Draft';
  }

  getItemName(id?: number | null) {
    return this.itemsList.find(x => x.id === id)?.itemName;
  }

  getUomName = (id?: number | null) =>
    this.uomList.find(u => u.id === id)?.name ?? '';

  // ---------- Load existing QT ----------
  private loadForEdit(id: number) {
    this.qt.getById(id).subscribe((res: any) => {
      const dto = res?.data ?? res ?? null;
      if (!dto) return;

      const discAmount = Number(dto.docDiscount ?? dto.discount ?? 0) || 0;
      const discType = (dto.discountType as DiscountType) || 'PERCENT';

      this.header = {
        ...this.header,
        ...dto,
        customerId: Number(dto.customerId ?? this.header.customerId ?? 0),
        currencyId: Number(dto.currencyId ?? this.header.currencyId ?? 0),
        paymentTermsId: Number(dto.paymentTermsId ?? this.header.paymentTermsId ?? 0),
        validityDate: this.toDateInput(dto.validityDate),
        discountType: discType,
        discountInput: discType === 'PERCENT'
          ? Number(dto.discountInput ?? 0) || 0
          : discAmount,
        docDiscount: discAmount,
        discountManual: discAmount > 0
      };

      (this.header as any).id = Number(dto.id);

      if (dto.customerName) this.customerSearch = String(dto.customerName);
      if (dto.currencyName || dto.currency) {
        this.header.currency = String(dto.currencyName ?? dto.currency);
        this.currencySearch = this.header.currency!;
      }
      if (dto.paymentTermsName || dto.paymentTerms) {
        this.header.paymentTerms = String(dto.paymentTermsName ?? dto.paymentTerms);
        this.paymentTermsSearch = this.header.paymentTerms!;
      }

      const apiLines = dto.lines ?? [];
      this.lines = apiLines.map((l: any) => ({
        itemId: Number(l.itemId ?? l.ItemId ?? 0),
        itemName: String(l.itemName ?? l.ItemName ?? ''),
        uomId: (l.uomId ?? l.UomId ?? null) !== null ? Number(l.uomId ?? l.UomId) : null,
        qty: Number(l.qty ?? l.Qty ?? 0),
        unitPrice: Number(l.unitPrice ?? l.UnitPrice ?? 0),
        discountPct: Number(l.discountPct ?? l.DiscountPct ?? 0),
        taxMode: (l.taxMode as LineTaxMode) || 'EXCLUSIVE',
        remarks: String(l.remarks ?? l.Remarks ?? ''),
        lineNet: Number(l.lineNet ?? l.LineNet ?? 0),
        lineTax: Number(l.lineTax ?? l.LineTax ?? 0),
        lineTotal: Number(l.lineTotal ?? l.LineTotal ?? 0)
      })) as UiLine[];

      this.onCustomerChange(this.header.customerId ?? null);
      this.computeTotals();
    });
  }

  // ---------- Lookups ----------
  loadLookups() {
    this.chartOfAccountService.getAllChartOfAccount().subscribe(() => {
      this.itemsService.getAllItem().subscribe((ires: any) => {
        const raw = ires?.data ?? [];
        this.itemsList = raw.map((item: any) => ({
          id: Number(item.id ?? item.itemId ?? 0),
          itemName: item.itemName ?? item.name ?? '',
          itemCode: item.itemCode ?? '',
          uomName: item.uomName ?? item.uom ?? '',
          uomId: Number(item.uomId ?? item.UomId ?? item.uomid ?? 0),
          catagoryName: item.catagoryName
        } as SimpleItem));
      });
    });

    this.uomService.getAllUom().subscribe((res: any) => {
      this.uomList = (res?.data ?? []).map((u: any) => ({
        id: Number(u.id ?? u.Id),
        name: String(u.name ?? u.Name ?? '').trim()
      }));
    });

    this.countriesService.getCountry().subscribe((res: any) => {
      this.countries = (res?.data ?? []).map((c: any) => ({
        id: Number(c.id ?? c.Id),
        countryName: String(c.countryName ?? c.CountryName ?? '').trim(),
        gstPercentage: Number(c.gstPercentage ?? c.GSTPercentage ?? 0)
      }));

      this.customerService.getAllCustomerMaster().subscribe((cres: any) => {
        const arr = (cres?.data ?? []);
        this.customers = arr.map((c: any) => ({
          id: Number(c.id ?? c.Id),
          name: String(c.customerName ?? c.CustomerName ?? '').trim(),
          countryId: Number(c.countryId ?? c.CountryId ?? 0)
        }));

        if (this.header.customerId) {
          const cu = this.customers.find(x => x.id === this.header.customerId);
          if (cu) this.customerSearch = cu.name;
          this.onCustomerChange(this.header.customerId);
        } else {
          this.computeTotals();
        }
      });
    });

    this.currencyService.getAllCurrency().subscribe((res: any) => {
      const data = res?.data ?? res ?? [];
      this.currenciesSrv = data.map((r: any) => ({
        id: Number(r.id ?? r.Id),
        name: String(r.currencyName ?? r.CurrencyName ?? '').trim()
      })) as CurrencyRow[];

      if (this.header.currencyId) {
        const row = this.currenciesSrv.find(x => x.id === this.header.currencyId);
        if (row) {
          this.header.currency = row.name;
          this.currencySearch = row.name;
        }
      }
    });

    this.paymentTermsService.getAllPaymentTerms().subscribe((res: any) => {
      const data = res?.data ?? res ?? [];
      this.paymentTermsSrv = data.map((r: any) => ({
        id: Number(r.id ?? r.Id),
        name: String(r.paymentTermsName ?? r.PaymentTermsName ?? '').trim()
      })) as PaymentTermsRow[];

      if (this.header.paymentTermsId) {
        const row = this.paymentTermsSrv.find(x => x.id === this.header.paymentTermsId);
        if (row) {
          this.header.paymentTerms = row.name;
          this.paymentTermsSearch = row.name;
        }
      }
    });
  }

  // ---------- Customer / GST ----------
  openCustomerDropdown() {
    this.customerDdOpen = true;
    this.filteredCustomers = (this.customers || []).slice(0, 50);
  }

  filterCustomers() {
    const q = (this.customerSearch || '').trim().toLowerCase();
    this.filteredCustomers = !q
      ? (this.customers || []).slice(0, 50)
      : (this.customers || []).filter(c => (c.name || '').toLowerCase().includes(q)).slice(0, 50);
    this.customerDdOpen = true;
  }

  selectCustomer(c: Customer) {
    this.customerSearch = c.name;
    this.customerDdOpen = false;
    if (this.header.customerId !== c.id) this.onCustomerChange(c.id);
  }

  onCustomerChange(custId: number | null) {
    this.header.customerId = custId;
    const cust = this.customers.find(x => x.id === custId) || null;
    this.header.countryId = cust?.countryId ?? null;

    const country = this.countries.find(c => c.id === (cust?.countryId ?? -1)) || null;
    this.activeCustomerCountry = country;

    this.header.taxPct = country?.gstPercentage ?? 0;
    this.computeTotals();
  }

  // ---------- Currency ----------
  openCurrencyDropdown() {
    this.currencyDdOpen = true;
    this.filteredCurrencies = this.currenciesSrv.slice();
  }

  filterCurrencies() {
    const q = (this.currencySearch || '').trim().toUpperCase();
    this.filteredCurrencies = !q
      ? this.currenciesSrv.slice()
      : this.currenciesSrv.filter(c => c.name.toUpperCase().includes(q));
    this.currencyDdOpen = true;
  }

  selectCurrency(cur: CurrencyRow) {
    this.currencySearch = cur.name;
    this.currencyDdOpen = false;
    this.header.currencyId = cur.id;
    this.header.currency = cur.name;
    this.computeTotals();
  }

  // ---------- Payment terms ----------
  openPaymentTermsDropdown() {
    this.paymentTermsDdOpen = true;
    this.filteredPaymentTerms = this.paymentTermsSrv.slice();
  }

  filterPaymentTerms() {
    const q = (this.paymentTermsSearch || '').trim().toLowerCase();
    this.filteredPaymentTerms = !q
      ? this.paymentTermsSrv.slice()
      : this.paymentTermsSrv.filter(p => p.name.toLowerCase().includes(q));
    this.paymentTermsDdOpen = true;
  }

  selectPaymentTerms(p: PaymentTermsRow) {
    this.paymentTermsSearch = p.name;
    this.paymentTermsDdOpen = false;
    this.header.paymentTermsId = p.id;
    this.header.paymentTerms = p.name;
  }

  onDiscountChange() {
  this.header.discountManual = true;
  this.computeTotals();
}


onDiscountTypeChange(raw: string) {
  const newType = (raw === 'VALUE' ? 'VALUE' : 'PERCENT') as DiscountType;

  const subtotal = +this.header.subtotal || 0;
  const input    = +this.header.discountInput || 0;

  // We interpret the current input as the "old" representation and convert it
  // to the correct value for the NEW type.
  if (newType === 'VALUE') {
    // 🔁 New = Amount, so current input is %  → convert % → amount
    const pct = Math.min(Math.max(input, 0), 100);
    const amount = subtotal * (pct / 100);
    this.header.discountInput = this.round2(amount);
  } else {
    // 🔁 New = %, so current input is amount → convert amount → %
    const amount = input;
    if (subtotal > 0) {
      this.header.discountInput = this.round2((amount * 100) / subtotal);
    } else {
      this.header.discountInput = 0;
    }
  }

  this.header.discountType = newType;
  this.header.discountManual = true;   // user changed footer
  this.computeTotals();
}

  // ---------- Line calculation ----------
  private computeLine(l: UiLine): { base: number; discount: number } {
    const qty   = +l.qty || 0;
    const price = +l.unitPrice || 0;
    const discP = Math.min(Math.max(+l.discountPct || 0, 0), 100);

    const gross = qty * price;
    const discountAmt = gross * (discP / 100);
    const afterDisc = gross - discountAmt;

    const rate = (l.taxMode === 'EXEMPT') ? 0 : (+this.header.taxPct || 0);

    if (l.taxMode === 'INCLUSIVE' && rate > 0) {
      const divisor = 1 + (rate / 100);
      const lineNet = afterDisc / divisor;
      const lineTax = afterDisc - lineNet;
      l.lineNet   = this.round2(lineNet);
      l.lineTax   = this.round2(lineTax);
      l.lineTotal = this.round2(afterDisc);
    } else {
      const lineNet = afterDisc;
      const lineTax = rate > 0 ? (afterDisc * rate / 100) : 0;
      l.lineNet   = this.round2(lineNet);
      l.lineTax   = this.round2(lineTax);
      l.lineTotal = this.round2(lineNet + lineTax);
    }

    return { base: gross, discount: discountAmt };
  }
computeTotals() {
  let baseSubtotal = 0;
  let lineDiscTotal = 0;
  let tax = 0;
  let hod = false;

  for (const l of this.lines) {
    const { base, discount } = this.computeLine(l);
    baseSubtotal  += base;
    lineDiscTotal += discount;
    tax           += l.lineTax || 0;

    if ((+l.discountPct || 0) > 10) hod = true;
  }

  this.header.subtotal  = this.round2(baseSubtotal);
  this.header.taxAmount = this.round2(tax);

  const rounding = this.header.rounding || 0;

  // -------- Document level discount --------
  let discountAmt: number;

  if (this.header.discountManual) {
    // user typed something in footer
    const input = +this.header.discountInput || 0;

    if (this.header.discountType === 'PERCENT') {
      const pct = Math.min(Math.max(input, 0), 100);
      discountAmt = this.header.subtotal * (pct / 100);
    } else {
      discountAmt = input;
    }
  } else {
    // auto = sum of line discounts
    discountAmt = lineDiscTotal;
  }

  // clamp
  if (discountAmt < 0) discountAmt = 0;
  if (discountAmt > this.header.subtotal) discountAmt = this.header.subtotal;

  this.header.docDiscount = this.round2(discountAmt);

  // If user never touched footer, keep it in sync with lines
  if (!this.header.discountManual) {
    if (this.header.discountType === 'PERCENT') {
      if (this.header.subtotal > 0) {
        this.header.discountInput = this.round2(
          (discountAmt * 100) / this.header.subtotal
        );
      } else {
        this.header.discountInput = 0;
      }
    } else {
      this.header.discountInput = this.round2(discountAmt);
    }
  }

  const netAfterDiscount = this.header.subtotal - this.header.docDiscount;
  this.header.grandTotal = this.round2(
    netAfterDiscount + this.header.taxAmount + rounding
  );
  this.header.needsHodApproval = hod;
}


  // ---------- Modal / items ----------
  onModalItemFocus(open: boolean = true): void {
    this.modal.dropdownOpen = open;
    if (open) {
      const q = (this.modal.itemSearch || '').trim().toLowerCase();
      this.modal.filteredItems = q
        ? this.itemsList.filter(it =>
            (it.itemName || '').toLowerCase().includes(q) ||
            (it.itemCode || '').toLowerCase().includes(q))
        : this.itemsList.slice(0, 50);
      setTimeout(() => this.itemSearchInput?.nativeElement?.focus(), 0);
    }
  }

  filterModalItems(): void {
    const text = (this.modal.itemSearch || '');
    const q = text.trim().toLowerCase();

    if (!q || (this.modal.itemId && !this.getItemName(this.modal.itemId)?.toLowerCase().includes(q))) {
      this.modal.itemId = null;
      this.modal.uomId = null;
    }

    this.modal.filteredItems = q
      ? this.itemsList.filter(
          it =>
            (it.itemName || '').toLowerCase().includes(q) ||
            (it.itemCode || '').toLowerCase().includes(q)
        )
      : this.itemsList.slice(0, 50);

    this.modal.dropdownOpen = true;
  }

  trackByItemId = (_: number, row: SimpleItem) => row.id;

  selectModalItem(row: SimpleItem): void {
    if (!row.itemCode || !row.itemCode.trim()) {
      this.applySelectedItem(row);
      return;
    }

    this.itemsService.checkItemExists(row.itemCode).subscribe({
      next: (res: any) => {
        const exists = (res?.data === true) || (res === true);
        if (exists) {
          this.applySelectedItem(row);
        } else {
          this.clearSelectedItemAndKeepDropdown();
          Swal.fire({
            icon: 'warning',
            title: 'Item not found in ItemMaster',
            text: 'Please add this item to ItemMaster before proceeding.',
            confirmButtonColor: '#2E5F73'
          });
        }
      },
      error: (err) => {
        this.clearSelectedItemAndKeepDropdown();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to verify item existence.',
          confirmButtonColor: '#d33'
        });
        console.error(err);
      }
    });
  }

  private applySelectedItem(row: SimpleItem): void {
    this.modal.itemId = row.id;
    this.modal.itemSearch = row.itemName || '';
    this.modal.uomId = row.uomId != null ? Number(row.uomId) : null;
    this.modal.dropdownOpen = false;
    this.previewLineTotals();
  }

  private clearSelectedItemAndKeepDropdown(): void {
    this.modal.itemId = null;
    this.modal.itemSearch = '';
    this.modal.uomId = null;
    this.modal.dropdownOpen = true;
    this.modal.filteredItems = this.itemsList.slice(0, 50);
  }

  previewLineTotals() {
    const qty   = +this.modal.qty || 0;
    const price = +this.modal.unitPrice || 0;
    const disc  = Math.min(Math.max(+this.modal.discountPct || 0, 0), 100);
    const base  = qty * price * (1 - disc / 100);
    const mode  = this.modal.taxMode as LineTaxMode;
    const rate  = (mode === 'EXEMPT') ? 0 : (+this.header.taxPct || 0);
    if (mode === 'INCLUSIVE' && rate > 0) {
      const divisor = 1 + (rate / 100);
      const net = base / divisor;
      const tax = base - net;
      this.modalPreview = { net: this.round2(net), tax: this.round2(tax), total: this.round2(base) };
    } else {
      const net = base;
      const tax = rate > 0 ? (base * rate / 100) : 0;
      this.modalPreview = { net: this.round2(net), tax: this.round2(tax), total: this.round2(net + tax) };
    }
  }

  // ---------- Modal open/close ----------
  openAdd() {
    this.editingIndex = null;
    this.modal = {
      itemId: null,
      itemSearch: '',
      qty: null,
      uomId: null,
      unitPrice: 0,
      discountPct: 0,
      taxMode: 'EXCLUSIVE',
      remarks: '',
      dropdownOpen: false,
      filteredItems: []
    };
    this.modalPreview = null;
    this.showModal = true;
  }

  openEdit(i: number) {
    this.editingIndex = i;
    const l = this.lines[i];
    this.modal = {
      itemId: l.itemId || null,
      itemSearch: (l as any).itemName || this.getItemName(l.itemId) || '',
      qty: l.qty || null,
      uomId: l.uomId ?? null,
      unitPrice: l.unitPrice || 0,
      discountPct: l.discountPct || 0,
      taxMode: (l.taxMode as LineTaxMode) || 'EXCLUSIVE',
      remarks: (l as any).remarks || '',
      dropdownOpen: false,
      filteredItems: []
    };
    this.previewLineTotals();
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.modal.dropdownOpen = false;
    this.modalPreview = null;
  }

  onModalContainer(ev: MouseEvent) {
    const t = ev.target as Node;
    if (this.modal.dropdownOpen && this.modalItemBox &&
        !this.modalItemBox.nativeElement.contains(t)) {
      this.modal.dropdownOpen = false;
    }
    ev.stopPropagation();
  }

  submitModal() {
    if (!this.modal.itemId || !this.modal.qty) {
      Swal.fire({
        icon: 'warning',
        title: 'Required',
        text: 'Item and Qty are required',
        confirmButtonColor: '#2E5F73'
      });
      return;
    }
    const payload: UiLine = {
      itemId: this.modal.itemId!,
      itemName: this.modal.itemSearch,
      uomId: this.modal.uomId ?? null,
      qty: +this.modal.qty!,
      unitPrice: +this.modal.unitPrice || 0,
      discountPct: +this.modal.discountPct || 0,
      remarks: this.modal.remarks ?? '',
      taxMode: this.modal.taxMode || 'EXCLUSIVE'
    };

    this.computeLine(payload);
    if (this.editingIndex === null) {
      this.lines.push(payload);
    } else {
      this.lines[this.editingIndex] = { ...(this.lines[this.editingIndex]), ...payload };
    }
    this.computeTotals();
    this.closeModal();
  }

  remove(i: number) {
    this.lines.splice(i, 1);
    this.computeTotals();
  }

  // ---------- Actions ----------
  submit() { this.header.status = 1; }
  approve() { this.header.status = 2; }
  reject() { this.header.status = 3; }
  post() { this.header.status = 4; }

  // ---------- Save ----------
  save() {
    const dto: any = {
      ...this.header,
      discountType: this.header.discountType,
      docDiscount: this.header.docDiscount,
      discountInput: this.header.discountInput,
      currencyId: this.header.currencyId ?? null,
      paymentTermsId: this.header.paymentTermsId ?? null,
      lines: this.lines.map(l => ({
        ...l,
        uomId: l.uomId ?? null,
        qty: +l.qty,
        unitPrice: +l.unitPrice,
        discountPct: +l.discountPct,
        taxMode: l.taxMode || 'EXCLUSIVE'
      }))
    };

    if (!dto.number || !dto.number.trim?.()) {
      dto.number = `QT-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
    }

    if (dto.id) {
      this.qt.update(dto.id, dto).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Updated',
            text: 'Quotation Updated Successfully',
            confirmButtonColor: '#2E5F73'
          });
          this.router.navigate(['/Sales/Quotation-list']);
        },
        error: () =>
          Swal.fire({
            icon: 'error',
            title: 'Failed',
            text: 'Update failed',
            confirmButtonColor: '#d33'
          })
      });
    } else {
      this.qt.create(dto).subscribe({
        next: (res: any) => {
          const id = (res && typeof res === 'object') ? res.data : res;
          Swal.fire({
            icon: 'success',
            title: 'Saved',
            text: `Quotation #${id} Created Successfully`,
            confirmButtonColor: '#2E5F73'
          });
          (this.header as any).id = id;
          this.router.navigate(['/Sales/Quotation-list']);
        },
        error: () =>
          Swal.fire({
            icon: 'error',
            title: 'Failed',
            text: 'Create failed',
            confirmButtonColor: '#d33'
          })
      });
    }
  }

  // ---------- Navigation ----------
  goToList() {
    this.router.navigate(['/Sales/Quotation-list']);
  }
}
