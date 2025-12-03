import {
  Component,
  HostListener,
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
  budgetLineId: number

  isPostInventory?: boolean | string | number;
  IsPostInventory?: boolean | string | number;

  [k: string]: any;
}

@Component({
  selector: 'app-supplier-invoice',
  templateUrl: './supplier-invoice.component.html',
  styleUrls: ['./supplier-invoice.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SupplierInvoiceComponent implements OnInit {

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

  // store PO lines (only location + discount needed)
  private poLinesList: any[] = [];
  parentHeadList: any;

  constructor(
    private fb: FormBuilder,
    private api: SupplierInvoiceService,
    private grnService: PurchaseGoodreceiptService,
    private router: Router,
    private route: ActivatedRoute,
    private coaService: ChartofaccountService,
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
      tax: [0, [Validators.min(0)]],
      currencyId: [null],
      status: [0],
      lines: this.fb.array([]) // FormArray
    });
  }

  ngOnInit(): void {
     document.body.classList.add('pin-supplier-invoice-page');
    this.loadAccountHeads()
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

  // ------------------------------- Utilities -------------------------------

  get lines(): FormArray {
    return this.form.get('lines') as FormArray;
  }

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

  // ------------------------------- Load Existing Invoice -------------------------------

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
          supplierId: d.supplierId ?? null,      // ⬅️ NEW (if your DTO exposes it)
          supplierName: d.supplierName ?? '', 
          invoiceDate: dateOnly,
          amount: Number(d.amount ?? 0),
          tax: Number(d.tax ?? 0),
          currencyId: d.currencyId,
          status: Number(d.status ?? 0)
        });

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

  // ------------------------------- Matching PO Lines -------------------------------

  private findPoLineForGrnItem(it: GRNItem): any | undefined {
    if (!this.poLinesList.length) return undefined;

    const code = (it.itemCode || '').toString().toUpperCase();
    if (!code) return undefined;

    return this.poLinesList.find(row => {
      const itemText = (row.item || '').toString().toUpperCase();
      return itemText.startsWith(code + ' ') || itemText === code;
    });
  }

  // ------------------------------- Add Lines -------------------------------

  private calcLineTotal(qty: number, price: number, discount: number): number {
    const gross = qty * price;
    const discAmt = (discount > 0) ? (gross * discount / 100) : 0;
    return +(gross - discAmt).toFixed(2);
  }

  addLineFromGrn(it: GRNItem): void {
    if (!this.shouldIncludeItem(it)) return;

    // PO match only for location + discount
    const po = this.findPoLineForGrnItem(it);

    // Values from GRN ONLY
    const qty = it.qtyReceived != null
      ? Number(it.qtyReceived)
      : Number(it.qty ?? 0);

    const unitPrice = it.unitPrice != null
      ? Number(it.unitPrice)
      : Number(it.price ?? 0);

    // 🎯 ONLY these two values come from PO lines
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

  // ------------------------------- Header Summary -------------------------------

private recalcHeaderFromLines(): void {
  let grossTotal = 0;   // Σ(qty * unitPrice)  👉 this will be Sub-total
  let discount = 0;     // Σ discount amount

  this.lines.value.forEach((l: any) => {
    const q = Number(l.qty) || 0;
    const p = Number(l.unitPrice) || 0;
    const d = Number(l.discountPct) || 0;

    const gross = q * p;                          // full line amount
    const discAmt = d > 0 ? (gross * d / 100) : 0;

    grossTotal += gross;
    discount += discAmt;
  });

  const subtotal = +grossTotal.toFixed(2);        // ❗ no discount removed here
  discount = +discount.toFixed(2);

  const taxPct = Number(this.form.get('tax')?.value || 0);

  // tax on (subtotal - discount)
  const netForTax = subtotal - discount;
  const taxAmt = +(netForTax * taxPct / 100).toFixed(2);

  const grand = +(netForTax + taxAmt).toFixed(2);

  this.subTotal = subtotal;       // shows Qty * Price total
  this.discountTotal = discount;  // total discount
  this.taxAmount = taxAmt;        // tax amount
  this.grandTotal = grand;        // final amount

  // keep Amount = Grand total
  this.form.patchValue(
    { amount: grand },
    { emitEvent: false }
  );
}


  onTaxChange(): void {
    this.recalcHeaderFromLines();
  }

  // ------------------------------- Build Payload -------------------------------

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

  // ------------------------------- Save -------------------------------

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
      amount: Number(v.amount),
      tax: Number(this.taxAmount),
      currencyId: v.currencyId,
      status: action === 'HOLD' ? 1 : 2,
      linesJson: this.buildLinesJson(),
      createdBy: this.userId,
      updatedBy: this.userId
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

  // ------------------------------- GRN Dropdown -------------------------------

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
  this.form.patchValue({
    grnId: g.id,
    grnNo: g.grnNo,
    supplierId: g.supplierId ?? null,
    supplierName: g.supplierName ?? '',   // ⬅️ NEW
    tax: g.tax ?? 0,
    currencyId: g.currencyId
  });

  this.grnSearch = g.grnNo;
  this.grnOpen = false;

  // existing logic...
  this.poLinesList = this.safeParsePoLines(g.poLines ?? g.poLinesJson);
  const items = this.safeParseGrnItems(g.grnJson);
  this.selectedGrnItems = items.filter(it => this.shouldIncludeItem(it));

  this.clearLines();
  this.selectedGrnItems.forEach(it => this.addLineFromGrn(it));
  this.recalcHeaderFromLines();
}


  // close dropdown
  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (!(ev.target as HTMLElement).closest('.grn-combobox')) {
      this.grnOpen = false;
    }
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
