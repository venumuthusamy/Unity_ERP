import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  ViewEncapsulation
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';

import { SupplierInvoiceService } from './supplier-invoice.service';
import { PurchaseGoodreceiptService } from '../purchase-goodreceipt/purchase-goodreceipt.service';
import { ChartofaccountService } from 'app/main/financial/chartofaccount/chartofaccount.service';

interface GRNHeader {
  id: number;
  grnNo: string;
  poid: number;
  poNo?: string | number;
  supplierId?: number;
  supplierName?: string;
  grnJson?: string;
  poLines?: string;
  poLinesJson?: string;
  currencyId?: number;
  tax?: number;          // tax %
}

interface GRNItem {
  item?: string;
  itemCode?: string;
  itemName?: string;

  qty?: number | string;
  qtyReceived?: number | string;

  price?: number | string;
  unitPrice?: number | string;

  location?: string;
  discountPct?: number | string;
  budgetLineId: number;

  isPostInventory?: boolean | string | number;
  IsPostInventory?: boolean | string | number;

  [k: string]: any;
}

interface SupplierAdvanceOption {
  id: number;
  advanceNo: string;
  advanceDate: string;
  originalAmount: number;
  utilisedAmount: number;
  balanceAmount: number;
  label?: string;
}

type TaxMode = 'EXCLUSIVE' | 'INCLUSIVE' | 'ZERO';

@Component({
  selector: 'app-supplier-invoice',
  templateUrl: './supplier-invoice.component.html',
  styleUrls: ['./supplier-invoice.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SupplierInvoiceComponent implements OnInit, OnDestroy {

  form: FormGroup;

  // GRN combobox
  grnOpen = false;
  grnSearch = '';
  grnList: GRNHeader[] = [];
  grnFiltered: GRNHeader[] = [];

  selectedGrn: GRNHeader | null = null;
  selectedGrnItems: GRNItem[] = [];

  minDate = '';

  userId: string;

  // footer totals
  subTotal = 0;
  discountTotal = 0;
  taxAmount = 0;
  grandTotal = 0;

  // ====== ADVANCE (AP) ======
  supplierAdvances: SupplierAdvanceOption[] = [];
  selectedAdvanceId: number | null = null;
  advanceApplyAmount = 0;
  advanceTotalApplied = 0;
  advanceBalanceForSelected = 0;
  netPayable = 0;

  // store PO lines (only location + discount needed)
  private poLinesList: any[] = [];
  parentHeadList: any;

  constructor(
    private fb: FormBuilder,
    private api: SupplierInvoiceService,
    private grnService: PurchaseGoodreceiptService,
    private router: Router,
    private route: ActivatedRoute,
    private coaService: ChartofaccountService
  ) {
    this.userId = localStorage.getItem('id') ?? 'System';

    this.form = this.fb.group({
      id: [0],
      invoiceNo: [''],
      grnId: [null],
      grnNo: [''],
      supplierId: [null],
      supplierName: [''],
      invoiceDate: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(0)]],
      taxMode: ['ZERO'],                       // EXCLUSIVE | INCLUSIVE | ZERO
      tax: [0, [Validators.min(0)]],           // tax %
      currencyId: [null],
      status: [0],
      lines: this.fb.array([])                 // FormArray
    });
  }

  // convenience accessors
  get lines(): FormArray {
    return this.form.get('lines') as FormArray;
  }

  get taxMode(): TaxMode {
    return (this.form.get('taxMode')?.value || 'ZERO') as TaxMode;
  }

  // ------------------------------------------------------------------
  // LIFECYCLE
  // ------------------------------------------------------------------
  ngOnInit(): void {
    document.body.classList.add('pin-supplier-invoice-page');

    this.loadAccountHeads();
    this.setMinDate();
    this.loadGrns();

    this.route.paramMap.subscribe(pm => {
      const id = Number(pm.get('id') || 0);
      if (id > 0) this.loadInvoice(id);
    });
  }

  ngOnDestroy(): void {
    document.body.classList.remove('pin-supplier-invoice-page');
  }

  // ------------------------------------------------------------------
  // UTILITIES
  // ------------------------------------------------------------------
  private setMinDate(): void {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    this.minDate = `${yyyy}-${mm}-${dd}`;
  }

  trackByIndex(i: number): number { return i; }
  trackByGrn = (_: number, g: GRNHeader) => g.id;

  private safeParseJson(jsonish: any): any {
    try {
      let v = jsonish;
      if (typeof v === 'string') v = JSON.parse(v);
      while (typeof v === 'string') v = JSON.parse(v);
      return v;
    } catch {
      return null;
    }
  }

  private safeParseGrnItems(str: any): GRNItem[] {
    const v = this.safeParseJson(str);
    if (Array.isArray(v)) return v;
    if (v?.items && Array.isArray(v.items)) return v.items;
    return [];
  }

  private safeParsePoLines(str: any): any[] {
    const v = this.safeParseJson(str);
    if (Array.isArray(v)) return v;
    if (v?.items && Array.isArray(v.items)) return v.items;
    return [];
  }

  private isTruthyTrue(v: any): boolean {
    return v === true || v === 'true' || v === 1 || v === '1';
  }

  private shouldIncludeItem(it: GRNItem): boolean {
    const flag = it.isPostInventory ?? it.IsPostInventory;
    return this.isTruthyTrue(flag);
  }

  // ------------------------------------------------------------------
  // ADVANCE UTIL
  // ------------------------------------------------------------------
  private resetAdvanceState(): void {
    this.supplierAdvances = [];
    this.selectedAdvanceId = null;
    this.advanceApplyAmount = 0;
    this.advanceTotalApplied = 0;
    this.advanceBalanceForSelected = 0;
    this.recalcNetPayable();
  }

  private loadSupplierAdvancesForSupplier(supplierId: number | null | undefined): void {
  this.resetAdvanceState();
  if (!supplierId) return;

  this.api.getSupplierAdvancesBySupplier(supplierId).subscribe({
    next: (res: any) => {
      const rows = res?.data || res || [];

      this.supplierAdvances = rows
        .map((a: any): SupplierAdvanceOption => {
          // NOTE: use the *actual* property names from API: AdvanceNo, Amount, BalanceAmount
          const original = Number(
            a.originalAmount ?? a.OriginalAmount ?? a.Amount ?? 0
          );
          const utilised = Number(
            a.utilisedAmount ?? a.UtilisedAmount ?? 0
          );
          const balance = Number(
            a.balanceAmount ?? a.BalanceAmount ?? (original - utilised)
          );

          return {
            id: a.Id ?? a.id,
            advanceNo: a.AdvanceNo ?? a.advanceNo,
            advanceDate: a.AdvanceDate ?? a.advanceDate,
            originalAmount: original,
            utilisedAmount: utilised,
            balanceAmount: balance,
            label: `${a.AdvanceNo ?? a.advanceNo} – Bal: ${balance.toFixed(2)}`
          };
        })
        // if you want to see it for testing, comment this line first
        .filter(x => x.balanceAmount > 0);
    },
    error: () => {
      console.error('Failed to load supplier advances');
    }
  });
}


  private recalcNetPayable(): void {
    const cap = this.advanceBalanceForSelected || 0;
    const raw = Number(this.advanceApplyAmount || 0);

    const safe = Math.max(0, Math.min(raw, cap, this.grandTotal || 0));

    this.advanceApplyAmount = safe;
    this.advanceTotalApplied = safe;
    this.netPayable = +(((this.grandTotal || 0) - safe).toFixed(2));
  }

  onAdvanceSelected(): void {
    const adv = this.supplierAdvances.find(x => x.id === this.selectedAdvanceId) || null;

    if (!adv) {
      this.advanceBalanceForSelected = 0;
      this.advanceApplyAmount = 0;
      this.advanceTotalApplied = 0;
      this.recalcNetPayable();
      return;
    }

    this.advanceBalanceForSelected = adv.balanceAmount || 0;

    const defaultApply = Math.min(this.advanceBalanceForSelected, this.grandTotal || 0);
    this.advanceApplyAmount = defaultApply;
    this.recalcNetPayable();
  }

  onAdvanceAmountChanged(): void {
    this.recalcNetPayable();
  }

  // ------------------------------------------------------------------
  // LOAD EXISTING INVOICE
  // ------------------------------------------------------------------
  private loadInvoice(id: number): void {
    this.api.GetSupplierInvoiceById(id).subscribe({
      next: (res: any) => {
        const d = res?.data || {};

        const dateOnly = d.invoiceDate?.includes('T')
          ? d.invoiceDate.split('T')[0]
          : d.invoiceDate;

        this.form.patchValue({
          id: d.id ?? 0,
          invoiceNo: d.invoiceNo ?? '',
          grnId: d.grnId ?? null,
          grnNo: d.grnNo ?? '',
          supplierId: d.supplierId ?? null,
          supplierName: d.supplierName ?? '',
          invoiceDate: dateOnly,
          amount: Number(d.amount ?? 0),
          tax: Number(d.tax ?? 0),         // assume stored %; tax amount will be recomputed
          currencyId: d.currencyId,
          status: Number(d.status ?? 0)
        });

        const pct = Number(this.form.get('tax')?.value || 0);
        const mode: TaxMode = pct > 0 ? 'EXCLUSIVE' : 'ZERO';
        this.form.get('taxMode')?.setValue(mode, { emitEvent: false });

        this.grnSearch = d.grnNo;
        this.clearLines();

        const rows = this.safeParseJson(d.linesJson) ?? [];
        rows.forEach((r: any) => {
          const qty = Number(r.qty) || 0;
          const unitPrice = Number(r.unitPrice ?? 0);
          const discountPct = Number(r.discountPct ?? 0);

          const lineTotal = this.calcLineTotal(qty, unitPrice, discountPct);

          this.lines.push(this.fb.group({
            item: [r.item || ''],
            budgetLineId: r.budgetLineId,
            location: [r.location || ''],
            qty: [qty],
            unitPrice: [unitPrice],
            discountPct: [discountPct],
            lineTotal: [lineTotal],
            matchStatus: [r.matchStatus ?? 'OK'],
            mismatchFields: [r.mismatchFields ?? ''],
            dcNoteNo: [r.dcNoteNo ?? '']
          }));
        });

        this.recalcHeaderFromLines();

        // Optionally: load advances for existing supplier
        if (d.supplierId) {
          this.loadSupplierAdvancesForSupplier(d.supplierId);
        }
      },
      error: (err) => {
        Swal.fire({
          icon: 'error',
          title: 'Load failed',
          text: err?.message || 'Unable to load invoice.',
          confirmButtonColor: '#0e3a4c'
        });
      }
    });
  }

  // ------------------------------------------------------------------
  // MATCHING PO LINES
  // ------------------------------------------------------------------
  private findPoLineForGrnItem(it: GRNItem): any | undefined {
    if (!this.poLinesList.length) return undefined;

    const code = (it.itemCode || '').toString().toUpperCase();
    if (!code) return undefined;

    return this.poLinesList.find(row => {
      const itemText = (row.item || '').toString().toUpperCase();
      return itemText.startsWith(code + ' ') || itemText === code;
    });
  }

  // ------------------------------------------------------------------
  // LINES
  // ------------------------------------------------------------------
  private calcLineTotal(qty: number, price: number, discount: number): number {
    const gross = qty * price;
    const discAmt = (discount > 0) ? (gross * discount / 100) : 0;
    return +(gross - discAmt).toFixed(2);
  }

  addLineFromGrn(it: GRNItem): void {
    if (!this.shouldIncludeItem(it)) return;

    const po = this.findPoLineForGrnItem(it);

    const qty = it.qtyReceived != null
      ? Number(it.qtyReceived)
      : Number(it.qty ?? 0);

    const unitPrice = it.unitPrice != null
      ? Number(it.unitPrice)
      : Number(it.price ?? 0);

    const location = po?.location ?? '';
    const discountPct = po?.discount != null ? Number(po.discount) : 0;

    const lineTotal = this.calcLineTotal(qty, unitPrice, discountPct);

    this.lines.push(this.fb.group({
      item: [it.item ?? it.itemName ?? it.itemCode ?? ''],
      location: [location],
      budgetLineId: it.budgetLineId,
      qty: [qty],
      unitPrice: [unitPrice],
      discountPct: [discountPct],
      lineTotal: [lineTotal],
      matchStatus: ['OK'],
      mismatchFields: [''],
      dcNoteNo: ['']
    }));

    this.recalcHeaderFromLines();
  }

  clearLines(): void {
    while (this.lines.length) this.lines.removeAt(0);
  }

  onCellChange(i: number): void {
    const row = this.lines.at(i).value;
    const qty = Number(row.qty) || 0;
    const price = Number(row.unitPrice) || 0;
    const discount = Number(row.discountPct) || 0;

    const lineTotal = this.calcLineTotal(qty, price, discount);

    this.lines.at(i).patchValue({ lineTotal }, { emitEvent: false });

    this.recalcHeaderFromLines();
  }

  // ------------------------------------------------------------------
  // HEADER SUMMARY / TAX LOGIC
  // ------------------------------------------------------------------
  private recalcHeaderFromLines(): void {
    let grossTotal = 0;  // Σ(qty * unitPrice)
    let discount = 0;    // Σ discount amount

    this.lines.value.forEach((l: any) => {
      const q = Number(l.qty) || 0;
      const p = Number(l.unitPrice) || 0;
      const d = Number(l.discountPct) || 0;

      const gross = q * p;
      const discAmt = d > 0 ? (gross * d / 100) : 0;

      grossTotal += gross;
      discount += discAmt;
    });

    const subtotal = +grossTotal.toFixed(2);
    discount = +discount.toFixed(2);

    const taxPct = Number(this.form.get('tax')?.value || 0);
    const rate = taxPct / 100;
    const mode = this.taxMode;

    const netBeforeTax = subtotal - discount;

    let taxAmt = 0;
    let grand = 0;

    if (mode === 'ZERO' || rate === 0) {
      taxAmt = 0;
      grand = netBeforeTax;
    } else if (mode === 'EXCLUSIVE') {
      taxAmt = +(netBeforeTax * rate).toFixed(2);
      grand = +(netBeforeTax + taxAmt).toFixed(2);
    } else { // INCLUSIVE
      const base = +(netBeforeTax / (1 + rate)).toFixed(2);
      taxAmt = +(netBeforeTax - base).toFixed(2);
      grand = netBeforeTax;
    }

    this.subTotal = subtotal;
    this.discountTotal = discount;
    this.taxAmount = taxAmt;
    this.grandTotal = grand;

    this.form.patchValue({ amount: grand }, { emitEvent: false });

    // update Net Payable based on advance
    this.recalcNetPayable();
  }

  onTaxChange(): void {
    const pct = Number(this.form.get('tax')?.value || 0);
    if (pct > 0 && this.taxMode === 'ZERO') {
      this.form.get('taxMode')?.setValue('EXCLUSIVE', { emitEvent: false });
    }
    this.recalcHeaderFromLines();
  }

  onTaxModeChange(): void {
    const mode = this.taxMode;
    if (mode === 'ZERO') {
      this.form.get('tax')?.setValue(0, { emitEvent: false });
    }
    this.recalcHeaderFromLines();
  }

  // ------------------------------------------------------------------
  // SAVE
  // ------------------------------------------------------------------
  private toSqlDate(v: any): string | null {
    if (!v) return null;
    if (typeof v === 'string') return v;
    const d = new Date(v);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private buildLinesJson(): string {
    const arr = this.lines.value.map((l: any) => ({
      item: l.item,
      location: l.location,
      budgetLineId: l.budgetLineId,
      qty: Number(l.qty),
      unitPrice: Number(l.unitPrice),
      discountPct: Number(l.discountPct),
      lineTotal: Number(l.lineTotal),
      dcNoteNo: l.dcNoteNo,
      matchStatus: l.matchStatus,
      mismatchFields: l.mismatchFields
    }));

    return JSON.stringify(arr);
  }

  save(action: 'POST' | 'HOLD' = 'POST'): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.value;
    const payload = {
      grnId: v.grnId,
      grnNo: v.grnNo,
      supplierId: v.supplierId,
      invoiceDate: this.toSqlDate(v.invoiceDate),
      amount: Number(v.amount),        // full invoice amount (grandTotal)
      tax: Number(this.taxAmount),     // tax amount
      currencyId: v.currencyId,
      status: action === 'HOLD' ? 1 : 2,
      linesJson: this.buildLinesJson(),
      createdBy: this.userId,
      updatedBy: this.userId,

      // advance info for backend
      advanceId: this.selectedAdvanceId,
      advanceApplyAmount: this.advanceTotalApplied,
      netPayable: this.netPayable,
      
    };

    const isUpdate = v.id > 0;
    const obs = isUpdate
      ? this.api.update(v.id, payload)
      : this.api.create(payload);

    obs.subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: isUpdate ? 'Updated' : 'Created',
          confirmButtonColor: '#0e3a4c'
        }).then(() => {
          this.router.navigate(['/purchase/list-SupplierInvoice']);
        });
      },
      error: (err) => {
        Swal.fire({
          icon: 'error',
          title: 'Save failed',
          text: err?.error?.message || err?.message,
          confirmButtonColor: '#0e3a4c'
        });
      }
    });
  }

  // ------------------------------------------------------------------
  // GRN DROPDOWN
  // ------------------------------------------------------------------
  loadGrns(): void {
    this.grnService.getAllGRN().subscribe({
      next: (res: any) => {
        const raw = res?.data ?? [];

        this.grnList = raw.map((x: any) => ({
          id: x.id,
          grnNo: x.grnNo,
          poid: x.poid,
          poNo: x.poNo,
          tax: x.tax,
          supplierId: x.supplierId,
          supplierName: x.supplierName,
          grnJson: x.grnJson,
          poLines: x.poLines,
          currencyId: x.currencyId
        }));

        this.grnFiltered = [...this.grnList];
      },
      error: (err: any) => console.error('Error loading GRN list', err)
    });
  }

  onGrnFocus(): void {
    this.grnFiltered = [...this.grnList];
    this.grnOpen = true;
  }

  onGrnSearch(e: any): void {
    const q = e.target.value.toLowerCase();
    this.grnSearch = q;

    this.grnFiltered = this.grnList.filter(g =>
      g.grnNo.toLowerCase().includes(q) ||
      (g.poNo || '').toString().toLowerCase().includes(q) ||
      (g.supplierName || '').toLowerCase().includes(q)
    );

    this.grnOpen = true;
  }

  selectGrn(g: GRNHeader): void {
    const pct = Number(g.tax ?? 0);
    const mode: TaxMode = pct > 0 ? 'EXCLUSIVE' : 'ZERO';

    this.form.patchValue({
      grnId: g.id,
      grnNo: g.grnNo,
      supplierId: g.supplierId ?? null,
      supplierName: g.supplierName ?? '',
      tax: pct,
      taxMode: mode,
      currencyId: g.currencyId
    });

    this.grnSearch = g.grnNo;
    this.grnOpen = false;

    // load AP advances for that supplier
    this.loadSupplierAdvancesForSupplier(g.supplierId);

    this.poLinesList = this.safeParsePoLines(g.poLines ?? g.poLinesJson);
    const items = this.safeParseGrnItems(g.grnJson);
    this.selectedGrnItems = items.filter(it => this.shouldIncludeItem(it));

    this.clearLines();
    this.selectedGrnItems.forEach(it => this.addLineFromGrn(it));
    this.recalcHeaderFromLines();
  }

  // close dropdown when clicking outside
  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (!(ev.target as HTMLElement).closest('.grn-combobox')) {
      this.grnOpen = false;
    }
  }

  // ------------------------------------------------------------------
  // NAV / COA
  // ------------------------------------------------------------------
  goToSupplierInvoice(): void {
    this.router.navigate(['/purchase/list-SupplierInvoice']);
  }

  loadAccountHeads(): void {
    this.coaService.getAllChartOfAccount().subscribe((res: any) => {
      const data = (res?.data || []).filter((x: any) => x.isActive === true);
      this.parentHeadList = data.map((head: any) => ({
        value: Number(head.id),
        label: this.buildFullPath(head, data)
      }));
    });
  }

  /** Build breadcrumb like: Parent >> Child >> This */
  private buildFullPath(item: any, all: any[]): string {
    let path = item.headName;
    let current = all.find((x: any) => x.headCode === item.parentHead);
    while (current) {
      path = `${current.headName} >> ${path}`;
      current = all.find((x: any) => x.headCode === current.parentHead);
    }
    return path;
  }
}
