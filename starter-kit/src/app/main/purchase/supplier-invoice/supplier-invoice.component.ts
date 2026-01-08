import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  ViewEncapsulation
} from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
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

  // footer totals
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
      tax: [0, [Validators.min(0)]], // tax percent
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

    // start with 1 empty row if needed
    if (this.lines.length === 0) {
      this.addLineFromOcr({ item: '', qty: 1, unitPrice: 0, discountPct: 0, location: '' });
      this.recalcHeaderFromLines();
    }
  }

  ngOnDestroy(): void {
    document.body.classList.remove('pin-supplier-invoice-page');
  }

  // ===== OCR =====
  openOcr(): void { this.ocrOpen = true; }

  // ✅ MAIN OCR APPLY
  onOcrApplied(res: OcrResponse): void {
    const rawText = (res?.text || '').toString();
    const text = this.normalizeText(rawText);

    // 1) Header parse (works even if parsed.* is null)
    const header = this.parseOcrHeader(text);

    if (header.invoiceNo) this.form.get('invoiceNo')?.setValue(header.invoiceNo);
    if (header.invoiceDate) this.form.get('invoiceDate')?.setValue(header.invoiceDate);

    // supplierName (display only; supplierId must still be chosen)
    const supplierName =
      res?.parsed?.supplierName ||
      header.supplierName ||
      this.form.get('supplierName')?.value;

    if (supplierName) this.form.get('supplierName')?.setValue(supplierName);

    // 2) Totals parse from TEXT (PDF has Subtotal/Tax Total/Total)
    const totals = this.parseOcrTotals(text);

    // 3) Determine tax percent:
    // Prefer totals.taxPercent (from "Tax Total (9%)"), else parsed.taxPercent
    const pct =
      this.toNumber(totals.taxPercent) > 0
        ? this.toNumber(totals.taxPercent)
        : this.toNumber(res?.parsed?.taxPercent);

    if (pct > 0) {
      this.form.patchValue({ tax: pct, taxMode: 'EXCLUSIVE' }, { emitEvent: false });
    } else {
      this.form.patchValue({ tax: 0, taxMode: 'ZERO' }, { emitEvent: false });
    }

    // 4) Lines parse (supports BOTH formats)
    const ocrLines = this.parseOcrLinesFlexible(text);

    this.clearLines();

    if (ocrLines.length) {
      ocrLines.forEach(l => this.addLineFromOcr(l));
    } else {
      // fallback: if we have subtotal/total use that as unit price
      const fallbackPrice = this.toNumber(totals.subTotal) || this.toNumber(totals.total) || 0;
      this.addLineFromOcr({ item: 'OCR Item', qty: 1, unitPrice: fallbackPrice, discountPct: 0, location: '' });
    }

    // 5) Discount handling:
    // Prefer totals.discountAmount, else parse "Discount : 4,000.00"
    const discAmt = this.toNumber(totals.discountAmount) || this.parseDiscountAmount(text);

    if (discAmt > 0) {
      this.applyDiscountAmountAcrossLines(discAmt);
    }

    // 6) Recalc totals
    this.recalcHeaderFromLines();

    // 7) If OCR gave us a GRAND TOTAL explicitly, keep it as reference
    // (We still calculate from lines for correctness.)
    // Optional: you can compare and show mismatch warning.

    Swal.fire({
      icon: 'success',
      title: 'OCR Applied',
      text: 'Invoice details filled from OCR (PDF supported)',
      confirmButtonColor: '#0e3a4c'
    });
  }

  // ===== Lines =====
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

  clearLines(): void {
    while (this.lines.length) this.lines.removeAt(0);
  }

  trackByIndex(i: number): number { return i; }
  trackByGrn = (_: number, g: GRNHeader) => g.id;

  onCellChange(i: number): void {
    const row = this.lines.at(i).value;
    const qty = this.toNumber(row.qty);
    const price = this.toNumber(row.unitPrice);
    const discount = this.toNumber(row.discountPct);

    const lineTotal = this.calcLineTotal(qty, price, discount);
    this.lines.at(i).patchValue({ lineTotal }, { emitEvent: false });

    this.recalcHeaderFromLines();
  }

  private calcLineTotal(qty: number, price: number, discount: number): number {
    const gross = qty * price;
    const discAmt = (discount > 0) ? (gross * discount / 100) : 0;
    return +(gross - discAmt).toFixed(2);
  }

  // ✅ This is the only totals source for UI
  private recalcHeaderFromLines(): void {
    let grossTotal = 0;
    let discount = 0;

    this.lines.value.forEach((l: any) => {
      const q = this.toNumber(l.qty);
      const p = this.toNumber(l.unitPrice);
      const d = this.toNumber(l.discountPct);

      const gross = q * p;
      const discAmt = d > 0 ? (gross * d / 100) : 0;

      grossTotal += gross;
      discount += discAmt;
    });

    const subtotal = +grossTotal.toFixed(2);
    discount = +discount.toFixed(2);

    const taxPct = this.toNumber(this.form.get('tax')?.value);
    const rate = taxPct / 100;
    const mode = this.taxMode;

    const netBeforeTax = subtotal - discount;

    let taxAmt = 0;
    let grand = 0;

    if (mode === 'ZERO' || rate === 0) {
      taxAmt = 0;
      grand = +netBeforeTax.toFixed(2);
    } else if (mode === 'EXCLUSIVE') {
      taxAmt = +(netBeforeTax * rate).toFixed(2);
      grand = +(netBeforeTax + taxAmt).toFixed(2);
    } else {
      // INCLUSIVE
      const base = +(netBeforeTax / (1 + rate)).toFixed(2);
      taxAmt = +(netBeforeTax - base).toFixed(2);
      grand = +netBeforeTax.toFixed(2);
    }

    this.subTotal = subtotal;
    this.discountTotal = discount;
    this.taxAmount = taxAmt;
    this.grandTotal = grand;
    this.netPayable = grand;

    // Amount field = grand total (read-only)
    this.form.patchValue({ amount: grand }, { emitEvent: false });
  }

  onTaxChange(): void {
    const pct = this.toNumber(this.form.get('tax')?.value);
    if (pct > 0 && this.taxMode === 'ZERO') {
      this.form.get('taxMode')?.setValue('EXCLUSIVE', { emitEvent: false });
    }
    this.recalcHeaderFromLines();
  }

  onTaxModeChange(): void {
    if (this.taxMode === 'ZERO') this.form.get('tax')?.setValue(0, { emitEvent: false });
    this.recalcHeaderFromLines();
  }

  // ===== OCR Parsing =====

  private normalizeText(t: string): string {
    return (t || '')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private toNumber(v: any): number {
    if (v === null || v === undefined) return 0;
    const s = String(v)
      .replace(/[,]/g, '')
      .replace(/\$/g, '')
      .replace(/SGD/gi, '')
      .trim();
    const n = Number(s);
    return isNaN(n) ? 0 : n;
  }

  private toIsoDateSmart(v?: string | null): string | null {
    if (!v) return null;

    // yyyy-MM-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

    // dd/MM/yyyy
    let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v.trim());
    if (m) {
      const dd = String(m[1]).padStart(2, '0');
      const mm = String(m[2]).padStart(2, '0');
      const yyyy = m[3];
      return `${yyyy}-${mm}-${dd}`;
    }

    // dd-MM-yyyy
    m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(v.trim());
    if (m) {
      const dd = String(m[1]).padStart(2, '0');
      const mm = String(m[2]).padStart(2, '0');
      const yyyy = m[3];
      return `${yyyy}-${mm}-${dd}`;
    }

    return null;
  }

  private parseOcrHeader(text: string): { invoiceNo?: string; invoiceDate?: string; supplierName?: string } {
    const out: any = {};

    // Invoice No patterns:
    // "Invoice No : INV-2025-0145"
    // "Invoice # INV-S-46891"
    let m = /Invoice\s*(?:No|#)\s*[:=]?\s*([A-Z0-9\-\/]+)/i.exec(text);
    if (m) out.invoiceNo = m[1].trim();

    // Date patterns:
    // "Invoice Date : 15/12/2025"
    // "Date 9/12/2025"
    m = /Invoice\s*Date\s*[:=]?\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{4})/i.exec(text);
    if (!m) m = /\bDate\s*[:=]?\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{4})/i.exec(text);
    if (m) out.invoiceDate = this.toIsoDateSmart(m[1]) || undefined;

    // Supplier name: take first meaningful line if present
    // (PDF sometimes starts with "Tax Invoice ... Biopak...")
    const firstLine = (text.split('\n').find(x => x.trim().length > 3) || '').trim();
    if (firstLine && !/invoice/i.test(firstLine)) out.supplierName = firstLine;

    // Better supplier extraction:
    m = /\bBiopak\b.*?(?:Pte\s*Ltd|Ltd)\b/i.exec(text);
    if (m) out.supplierName = m[0].trim();

    return out;
  }

  private parseOcrTotals(text: string): {
    subTotal?: number;
    discountAmount?: number;
    taxPercent?: number;
    taxAmount?: number;
    total?: number;
  } {
    const out: any = {};

    // Subtotal$436.30
    let m = /Sub\s*total\s*\$?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i.exec(text);
    if (m) out.subTotal = this.toNumber(m[1]);

    // Discount : 4,000.00 OR Discount$10.00
    m = /Discount\s*[:=]?\s*\$?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i.exec(text);
    if (m) out.discountAmount = this.toNumber(m[1]);

    // Tax Total (9%)$39.27
    m = /Tax\s*Total\s*\((\d+(?:\.\d+)?)%\)\s*\$?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i.exec(text);
    if (m) {
      out.taxPercent = this.toNumber(m[1]);
      out.taxAmount = this.toNumber(m[2]);
    }

    // Sometimes: "Tax (GST 18%) : 16,920.00"
    m = /Tax\s*\(.*?(\d+(?:\.\d+)?)%\)\s*[:=]?\s*\$?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i.exec(text);
    if (!out.taxPercent && m) {
      out.taxPercent = this.toNumber(m[1]);
      out.taxAmount = this.toNumber(m[2]);
    }

    // Total$475.57 OR GRAND TOTAL : 1,06,920.00
    m = /\bTotal\s*\$?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i.exec(text);
    if (m) out.total = this.toNumber(m[1]);

    m = /Grand\s*Total\s*[:=]?\s*\$?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i.exec(text);
    if (m) out.total = this.toNumber(m[1]);

    return out;
  }

private parseOcrLinesFlexible(text: string): Array<{ item: string; qty: number; unitPrice: number; discountPct: number; location?: string }> {
  const out: any[] = [];
  if (!text) return out;

  const block = this.extractItemsBlock(text);

  // ✅ FORMAT A (your sample image):
  // "1. Laptop Dell Inspiron Qty: 2 Rate: 45,000"
  const reA = /(\d+)\.\s*([A-Za-z0-9 ()&./,+-]+?)\s+Qty\s*[:=]?\s*(\d+(?:\.\d+)?)\s+Rate\s*[:=]?\s*([\d,]+(?:\.\d+)?)/gi;
  let m: RegExpExecArray | null;
  while ((m = reA.exec(block)) !== null) {
    const item = (m[2] || '').trim();
    const qty = this.toNumber(m[3]);
    const rate = this.toNumber(m[4]);
    if (item && qty > 0 && rate > 0) {
      out.push({ item, qty, unitPrice: rate, discountPct: 0, location: '' });
    }
  }
  if (out.length) return out;

  // ✅ FORMAT B (BioPak PDF) – OCR comes like:
  // "1BAG-TA-D-SMALL ... $33.30$33.30  1BAG-TA-T-LARGE ... $39.00$39.00"
  // NO NEWLINES, so do NOT use (^|\n) anchors.
  const reB =
    /(\d+(?:\.\d+)?)\s*([A-Z0-9\-\._]{3,})\s*([\s\S]*?)\s*\$?\s*([0-9,]+(?:\.[0-9]{2})?)\s*\$?\s*([0-9,]+(?:\.[0-9]{2})?)(?=\s*\d+\s*[A-Z0-9\-\._]{3,}\s*|$)/g;

  while ((m = reB.exec(block)) !== null) {
    const qty = this.toNumber(m[1]);
    const code = (m[2] || '').trim();

    let desc = (m[3] || '').trim();
    desc = desc.replace(/\s{2,}/g, ' ');
    desc = desc.replace(/^\-+/, '').trim();

    const unitPrice = this.toNumber(m[4]);
    const amount = this.toNumber(m[5]);

    if (qty <= 0) continue;

    const finalUnitPrice =
      unitPrice > 0 ? unitPrice : (amount > 0 ? +(amount / qty).toFixed(2) : 0);

    const item = `${code} ${desc}`.trim();
    if (!item || finalUnitPrice <= 0) continue;

    out.push({
      item: item.length > 80 ? item.substring(0, 80) : item,
      qty,
      unitPrice: finalUnitPrice,
      discountPct: 0,
      location: ''
    });
  }

  return out;
}
private extractItemsBlock(text: string): string {
  // Make it easy for regex even if OCR text is single-line
  const t = (text || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();

  // Try to cut only the “table rows” part
  const startMarks = [
    'QtyItemDescriptionUnit Price',
    'Qty Item Description Unit Price',
    'QtyItemDescriptionUnitPrice'
  ];

  const endMarks = [
    'Subtotal',
    'Sub total',
    'Tax Total',
    'Total$',
    'Balance Due',
    'How to pay'
  ];

  let start = -1;
  for (const s of startMarks) {
    const idx = t.toLowerCase().indexOf(s.toLowerCase());
    if (idx >= 0) { start = idx + s.length; break; }
  }

  // If cannot find header, still try whole text
  const cut = start >= 0 ? t.substring(start) : t;

  let end = cut.length;
  for (const e of endMarks) {
    const idx = cut.toLowerCase().indexOf(e.toLowerCase());
    if (idx >= 0) { end = Math.min(end, idx); }
  }

  return cut.substring(0, end).trim();
}
  private parseDiscountAmount(text: string): number {
    if (!text) return 0;
    const m = /Discount\s*[:=]?\s*\$?\s*([\d,]+(?:\.\d+)?)/i.exec(text);
    return m ? this.toNumber(m[1]) : 0;
  }

  private applyDiscountAmountAcrossLines(discountAmount: number): void {
    const grossTotal = this.lines.value.reduce((sum: number, l: any) => {
      return sum + (this.toNumber(l.qty) * this.toNumber(l.unitPrice));
    }, 0);

    if (grossTotal <= 0) return;

    const discPct = +(discountAmount / grossTotal * 100).toFixed(4);

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

  // ===== Header/Init helpers =====
  private setMinDate(): void {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    this.minDate = `${yyyy}-${mm}-${dd}`;
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

  // ===== GRN methods =====
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
      path = `${path}`;
      current = all.find((x: any) => x.headCode === current.parentHead);
    }
    return path;
  }

  // keep your existing loadInvoice(...) if needed
  private loadInvoice(_id: number): void {}
}
