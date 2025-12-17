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

import { OcrResponse } from 'app/main/ocrmodule/ocrservice.service';

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
  tax?: number;
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

type TaxMode = 'EXCLUSIVE' | 'INCLUSIVE' | 'ZERO';

type PinLine = {
  item: string;
  qty: number;
  unitPrice: number;
  discountPct: number;
  location?: string;
  budgetLineId?: number | null;
};

@Component({
  selector: 'app-supplier-invoice',
  templateUrl: './supplier-invoice.component.html',
  styleUrls: ['./supplier-invoice.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SupplierInvoiceComponent implements OnInit, OnDestroy {

  form: FormGroup;

  grnOpen = false;
  grnSearch = '';
  grnList: GRNHeader[] = [];
  grnFiltered: GRNHeader[] = [];

  selectedGrn: GRNHeader | null = null;
  selectedGrnItems: GRNItem[] = [];

  minDate = '';
  userId: string;

  // footer totals (UI uses these)
  subTotal = 0;
  discountTotal = 0;
  taxAmount = 0;
  grandTotal = 0;
  netPayable = 0;

  private poLinesList: any[] = [];
  parentHeadList: any;

  ocrOpen = false;

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
      taxMode: ['ZERO'],
      tax: [0, [Validators.min(0)]],
      currencyId: [null],
      status: [0],
      lines: this.fb.array([])
    });
  }

  get lines(): FormArray { return this.form.get('lines') as FormArray; }
  get taxMode(): TaxMode { return (this.form.get('taxMode')?.value || 'ZERO') as TaxMode; }

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

  // ===== OCR =====
  openOcr(): void { this.ocrOpen = true; }

  // ✅ This is the ONLY method called from modal (applied)
  onOcrApplied(res: OcrResponse): void {
    const p = res?.parsed || {};

    // header
    if (p.invoiceNo) this.form.get('invoiceNo')?.setValue(p.invoiceNo);
    if (p.invoiceDate) this.form.get('invoiceDate')?.setValue(this.toIsoDate(p.invoiceDate) || p.invoiceDate);

    // set tax mode from OCR tax %
    const pct = Number(p.taxPercent ?? 0);
    if (pct > 0) {
      this.form.patchValue({ tax: pct, taxMode: 'EXCLUSIVE' }, { emitEvent: false });
    } else {
      this.form.patchValue({ tax: 0, taxMode: 'ZERO' }, { emitEvent: false });
    }

    // parse invoice lines from OCR TEXT (Laptop/Mouse...)
    const ocrLines = this.parseOcrLines(res.text);

    // replace lines in form
    this.clearLines();

    if (ocrLines.length) {
      ocrLines.forEach(l => this.addLineFromOcr(l));
    } else {
      // fallback single row (still totals will work)
      const total = Number(p.total ?? 0);
      this.addLineFromOcr({
        item: 'OCR Item',
        qty: 1,
        unitPrice: total,
        discountPct: 0
      });
    }
// ✅ apply OCR discount (amount) into line-wise discount%
const discAmt = this.parseDiscountAmount(res.text);
if (discAmt > 0) {
  // total gross (qty * unitPrice)
  const grossTotal = this.lines.value.reduce((sum: number, l: any) => {
    return sum + (this.toNumber(l.qty) * this.toNumber(l.unitPrice));
  }, 0);

  if (grossTotal > 0) {
    // discount percent for all lines (same %)
    const discPct = +(discAmt / grossTotal * 100).toFixed(4);

    for (let i = 0; i < this.lines.length; i++) {
      const row = this.lines.at(i);
      const qty = this.toNumber(row.get('qty')?.value);
      const unitPrice = this.toNumber(row.get('unitPrice')?.value);

      row.patchValue({
        discountPct: discPct,
        lineTotal: this.calcLineTotal(qty, unitPrice, discPct)
      }, { emitEvent: false });
    }
  }
}

    // ✅ IMPORTANT: update totals (Tax + Grand total + Net Payable)
    this.recalcHeaderFromLines();

    Swal.fire({
      icon: 'success',
      title: 'OCR Applied',
      text: 'Invoice details filled from OCR',
      confirmButtonColor: '#0e3a4c'
    });
  }

  private addLineFromOcr(l: PinLine): void {
    const qty = Number(l.qty || 0);
    const unitPrice = Number(l.unitPrice || 0);
    const discountPct = Number(l.discountPct || 0);
    const lineTotal = this.calcLineTotal(qty, unitPrice, discountPct);

    this.lines.push(this.fb.group({
      item: [l.item || '', Validators.required],
      location: [l.location || ''],
      budgetLineId: [l.budgetLineId ?? null],
      qty: [qty, [Validators.required, Validators.min(0.0001)]],
      unitPrice: [unitPrice, [Validators.required, Validators.min(0)]],
      discountPct: [discountPct],
      lineTotal: [lineTotal],
      matchStatus: ['OK'],
      mismatchFields: [''],
      dcNoteNo: ['']
    }));
  }

  // ===== Header/Init helpers =====
  private setMinDate(): void {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    this.minDate = `${yyyy}-${mm}-${dd}`;
  }

  trackByIndex(i: number): number { return i; }
  trackByGrn = (_: number, g: GRNHeader) => g.id;

  // ===== Lines / Totals =====
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

  private calcLineTotal(qty: number, price: number, discount: number): number {
    const gross = qty * price;
    const discAmt = (discount > 0) ? (gross * discount / 100) : 0;
    return +(gross - discAmt).toFixed(2);
  }

  private recalcHeaderFromLines(): void {
    let grossTotal = 0;
    let discount = 0;

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
    } else {
      const base = +(netBeforeTax / (1 + rate)).toFixed(2);
      taxAmt = +(netBeforeTax - base).toFixed(2);
      grand = netBeforeTax;
    }

    this.subTotal = subtotal;
    this.discountTotal = discount;
    this.taxAmount = taxAmt;
    this.grandTotal = grand;

    this.form.patchValue({ amount: grand }, { emitEvent: false });

    // if you later apply advance, keep it simple now:
    this.netPayable = grand;
  }

  onTaxChange(): void {
    const pct = Number(this.form.get('tax')?.value || 0);
    if (pct > 0 && this.taxMode === 'ZERO') {
      this.form.get('taxMode')?.setValue('EXCLUSIVE', { emitEvent: false });
    }
    this.recalcHeaderFromLines();
  }

  onTaxModeChange(): void {
    if (this.taxMode === 'ZERO') this.form.get('tax')?.setValue(0, { emitEvent: false });
    this.recalcHeaderFromLines();
  }

  // ===== OCR TEXT parsing =====
  private parseOcrLines(text: string): PinLine[] {
    if (!text) return [];

    const t = text.replace(/\r/g, '');

    // Matches:
    // "1. Laptop Dell Inspiron   Qty: 2   Rate: 45,000"
    // "2. Wireless Mouse         Qty: 5   Rate: 800"
    const re = /(\d+)\.\s*([A-Za-z0-9 ()&./,+-]+?)\s+Qty\s*[:=]?\s*(\d+(?:\.\d+)?)\s+Rate\s*[:=]?\s*([\d,]+(?:\.\d+)?)/gi;

    const out: PinLine[] = [];
    let m: RegExpExecArray | null;

    while ((m = re.exec(t)) !== null) {
      const item = (m[2] || '').trim();
      const qty = this.toNumber(m[3]);
      const rate = this.toNumber(m[4]);
      if (!item || qty <= 0 || rate <= 0) continue;

      out.push({
        item,
        qty,
        unitPrice: rate,
        discountPct: 0,
        location: ''
      });
    }

    return out;
  }

  private toNumber(v: any): number {
    if (v === null || v === undefined) return 0;
    const s = String(v).replace(/,/g, '').trim();
    const n = Number(s);
    return isNaN(n) ? 0 : n;
  }

  private toIsoDate(v?: string | null): string | null {
    if (!v) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

    // dd/MM/yyyy
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;

    return null;
  }

  // ===== Save =====
  save(action: 'HOLD' | 'POST' = 'POST') {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.form.value.supplierId) {
      Swal.fire('Supplier required');
      return;
    }

    const v = this.form.value;

    const payload = {
      invoiceNo: v.invoiceNo,
      invoiceDate: v.invoiceDate,
      supplierId: v.supplierId,
      currencyId: v.currencyId,
      amount: Number(v.amount || 0),
      tax: Number(this.taxAmount || 0),
      status: action === 'HOLD' ? 1 : 2,
      linesJson: JSON.stringify(this.lines.value),
      createdBy: this.userId,
      updatedBy: this.userId
    };

    this.api.create(payload).subscribe({
      next: () => {
        Swal.fire('Saved successfully');
        this.router.navigate(['/purchase/list-SupplierInvoice']);
      },
      error: (err) => Swal.fire('Save failed', err?.error?.message || err?.message, 'error')
    });
  }

  // ===== GRN methods (keep your existing ones) =====
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
    const q = (e.target.value || '').toLowerCase();
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

    // (your GRN line load continues...)
    this.recalcHeaderFromLines();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (!(ev.target as HTMLElement).closest('.grn-combobox')) this.grnOpen = false;
  }

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

  private buildFullPath(item: any, all: any[]): string {
    let path = item.headName;
    let current = all.find((x: any) => x.headCode === item.parentHead);
    while (current) {
      path = `${current.headName} >> ${path}`;
      current = all.find((x: any) => x.headCode === current.parentHead);
    }
    return path;
  }

  // keep your existing loadInvoice(...) if needed
  private loadInvoice(_id: number): void {}
  private parseDiscountAmount(text: string): number {
  if (!text) return 0;

  // matches: "Discount : 4,000.00" or "Discount 4000" etc.
  const m = /Discount\s*[:=]?\s*([\d,]+(?:\.\d+)?)/i.exec(text);
  if (!m) return 0;

  return this.toNumber(m[1]);
}

}
