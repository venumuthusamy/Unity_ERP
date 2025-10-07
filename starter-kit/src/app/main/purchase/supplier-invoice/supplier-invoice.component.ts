import { Component, HostListener, ViewEncapsulation } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SupplierInvoiceService } from './supplier-invoice.service';
import { PurchaseGoodreceiptService } from '../purchase-goodreceipt/purchase-goodreceipt.service';
import Swal from 'sweetalert2';
import { ActivatedRoute, Router } from '@angular/router';

interface GRNHeader {
  id: number;
  grnNo: string;
  poid: number;
  poNo?: string | number;
  supplierName?: string;
  grnJson?: string;     // JSON string of items
  poLinesJson?: string; // optional fallback
  poLines?: any[];      // optional fallback
}

interface GRNItem {
  item?: string;
  itemCode?: string;
  itemName?: string;
  qty?: number | string;
  price?: number | string;
  supplierId?: number;
  storageType?: string;
  surfaceTemp?: string | number;
  expiry?: string | Date;
  [k: string]: any;
}

@Component({
  selector: 'app-supplier-invoice',
  templateUrl: './supplier-invoice.component.html',
  styleUrls: ['./supplier-invoice.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SupplierInvoiceComponent {
  form: FormGroup;

  // GRN combobox state
  grnOpen = false;
  grnSearch = '';
  grnList: GRNHeader[] = [];
  grnFiltered: GRNHeader[] = [];

  // Preview state
  selectedGrn: GRNHeader | null = null;
  selectedGrnItems: GRNItem[] = [];

  userId: string;

  constructor(
    private fb: FormBuilder,
    private api: SupplierInvoiceService,
    private grnService: PurchaseGoodreceiptService,
     private router: Router ,
      private route: ActivatedRoute
  ) {
    this.userId = localStorage.getItem('id') ?? 'System';

    // form model (include grnId + invoiceNo so we can post FK and show generated number)
    this.form = this.fb.group({
      id: [0],
      invoiceNo: [''],           // filled from API after create
      grnId: [null],             // FK → SupplierInvoicePin.GrnId
      grnNo: [''],
      invoiceDate: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(0)]],
      tax: [0, [Validators.min(0)]],
      currency: ['SGD'],
      status: [0],               // 0=draft, 1=hold, 2=posted
      lines: this.fb.array([])   // FormArray of line rows
    });
  }

  ngOnInit(): void {
    this.loadGrns();
    this.route.paramMap.subscribe(pm => {
    const id = Number(pm.get('id') || 0);
    if (id > 0) this.loadInvoice(id);
  });
  }
 private loadInvoice(id: number) {
  this.api.GetSupplierInvoiceById(id).subscribe({
    next: (res: any) => {
      const d = res?.data || res;

      // ✅ Normalize date for input[type="date"]
      const dateOnly = d.invoiceDate?.includes('T') ? d.invoiceDate.split('T')[0] : d.invoiceDate;

      // ✅ Patch form header
      this.form.patchValue({
        id: d.id ?? 0,
        invoiceNo: d.invoiceNo ?? '',
        grnId: d.grnId ?? null,
        grnNo: d.grnNo ?? '',
        invoiceDate: dateOnly,                // ← Correct format for UI
        amount: Number(d.amount ?? 0),
        tax: Number(d.tax ?? 0),
        currency: (d.currency || 'SGD').toUpperCase(),
        status: Number(d.status ?? 0)
      }, { emitEvent: false });

      // ✅ Make GRN combo show number
      this.grnSearch = d.grnNo || this.grnList.find(g => g.id === d.grnId)?.grnNo || '';

      // ✅ Lines
      const rows = this.safeParseLines(d.linesJson, d.lines);
      this.clearLines();
      rows.forEach((r: any) => {
        this.lines.push(this.fb.group({
          item: [r.item ?? r.itemName ?? r.itemCode ?? ''],
          qty: [Number(r.qty) || 0],
          price: [r.price != null ? Number(r.price) : null],
          matchStatus: [r.matchStatus || 'OK'],
          mismatchFields: [r.mismatchFields || ''],
          dcNoteNo: [r.dcNoteNo || '']
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

private safeParseLines(linesJson?: string, fallback?: any): any[] {
  if (Array.isArray(fallback)) return fallback;
  try {
    const arr = JSON.parse(linesJson || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

  // ---------- Lines helpers ----------
  get lines(): FormArray {
    return this.form.get('lines') as FormArray;
  }

  addLine(prefill?: Partial<GRNItem>) {
    const itemName = prefill?.item ?? prefill?.itemName ?? prefill?.itemCode ?? '';
    const qty = prefill?.qty != null ? Number(prefill?.qty) : null;
    const price = prefill?.price != null ? Number(prefill?.price as number) : null;

    this.lines.push(this.fb.group({
      item: [itemName],
      qty: [qty],
      price: [price],
      matchStatus: ['OK'],
      mismatchFields: [''],
      dcNoteNo: ['']
    }));

    this.recalcHeaderFromLines();
  }

  addLineFromGrn(it: GRNItem) {
    this.addLine({
      item: it.item ?? it.itemName ?? it.itemCode,
      qty: it.qty ?? 1,
      price: it.price ?? null
    });
  }

  importAllFromGrn() {
    if (!this.selectedGrnItems?.length) return;
    this.clearLines();
    this.selectedGrnItems.forEach(it => this.addLineFromGrn(it));
    this.recalcHeaderFromLines();
  }

  removeLine(i: number) {
    this.lines.removeAt(i);
    this.recalcHeaderFromLines();
  }

  clearLines() {
    while (this.lines.length) this.lines.removeAt(0);
  }

  // lightweight local match badge + header amount recalc
  onCellChange(i: number) {
    const r = this.lines.at(i).value;
    const mm: string[] = [];
    if ((+r.qty || 0) <= 0) mm.push('Qty');
    if ((+r.price || 0) < 0) mm.push('Price');

    this.lines.at(i).patchValue({
      matchStatus: mm.length ? 'Mismatch' : 'OK',
      mismatchFields: mm.join(',')
    }, { emitEvent: false });

    this.recalcHeaderFromLines();
  }

  // ---------- Save ----------
  private toSqlDate(d: any): string | null {
    if (!d) return null;
    if (typeof d === 'string') return d; // <input type="date"> already gives YYYY-MM-DD
    try {
      const dt = new Date(d);
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      return `${dt.getFullYear()}-${m}-${day}`;
    } catch { return null; }
  }

  private buildLinesJson(): string {
    const toNum = (x: any) => {
      const n = Number(x);
      return Number.isFinite(n) ? n : 0;
    };

    const arr = (this.lines.value as any[]).map(l => ({
      item: (l.item ?? '') || null,
      qty: toNum(l.qty),
      price: toNum(l.price),
      dcNoteNo: (l.dcNoteNo ?? '') || null,
      matchStatus: (l.matchStatus ?? '') || null,
      mismatchFields: String(l.mismatchFields ?? '')
    }));

    return JSON.stringify(arr);
  }

  // Amount = Σ(qty * price) — tweak or remove if you prefer manual header entry
  private recalcHeaderFromLines() {
    const lines = this.lines.value as Array<{ qty: any; price: any }>;
    const subtotal = lines.reduce((s, l) => s + ((Number(l.qty) || 0) * (Number(l.price) || 0)), 0);
    this.form.patchValue({ amount: Number(subtotal.toFixed(2)) }, { emitEvent: false });
  }

 save(action: 'POST' | 'HOLD' = 'POST') {
  if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }

  const v = this.form.value;
  const payload = {
    grnId: v.grnId ?? null,
    grnNo: v.grnNo || null,
    invoiceDate: this.toSqlDate(v.invoiceDate),  // 'YYYY-MM-DD'
    amount: Number(v.amount ?? 0),
    tax: Number(v.tax ?? 0),
    currency: (v.currency || 'SGD').toUpperCase(),
    status: action === 'HOLD' ? 1 : 2,
    linesJson: this.buildLinesJson(),
    createdBy: this.userId,
    updatedBy: this.userId
  };

  const isUpdate = !!(v.id && v.id > 0);
  const obs = isUpdate ? this.api.update(v.id, payload) : this.api.create(payload);

  obs.subscribe({
    next: (res: any) => {
      const d = res?.data || {};
      // reflect back generated values (Id, InvoiceNo) if API returns them
      this.form.patchValue({
        id: d.id ?? this.form.value.id,
        invoiceNo: d.invoiceNo ?? this.form.value.invoiceNo
      }, { emitEvent: false });

      Swal.fire({
        icon: 'success',
        title: isUpdate ? 'Updated' : (action === 'HOLD' ? 'Saved to Hold' : 'Created'),
        text: res?.message || (isUpdate ? 'Updated successfully' : (action === 'HOLD' ? 'Saved to Hold successfully' : 'Created successfully')),
        confirmButtonColor: '#0e3a4c'
      }).then(() => {
        // refresh and reset just like your PR flow
        this.loadGrns();
        this.resetForm();
        // adjust route if your PIN list path is different
        this.router.navigate(['/purchase/list-SupplierInvoice']);
      });
    },
    error: (err: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Save failed',
        text: err?.error?.message || err?.message || 'Something went wrong.',
        confirmButtonColor: '#0e3a4c'
      });
      console.error(err);
    }
  });
}
private resetForm() {
  // clear lines
  while (this.lines.length) this.lines.removeAt(0);

  // reset header
  this.form.reset({
    id: 0,
    invoiceNo: '',
    grnId: null,
    grnNo: '',
    invoiceDate: '',
    amount: 0,
    tax: 0,
    currency: 'SGD',
    status: 0
  });

  // clear preview state
  this.selectedGrn = null;
  this.selectedGrnItems = [];
  this.grnSearch = '';
}


  // ---------- GRN dropdown ----------
  loadGrns() {
    this.grnService.getAllGRN().subscribe({
      next: (res: any) => {
        const raw: any[] = res?.data ?? [];
        this.grnList = raw.map((x: any) => ({
          id: x.id,
          grnNo: x.grnNo,
          poid: x.poid,
          poNo: x.poNo ?? x.poid,
          supplierName: x.supplierName ?? '',
          grnJson: x.grnJson ?? '[]', // bring items along
          poLinesJson: x.poLinesJson,
          poLines: x.poLines
        }));
        this.grnFiltered = [...this.grnList];
      },
      error: (err: any) => console.error('Error loading GRN list', err)
    });
  }

  onGrnFocus() {
    this.grnFiltered = [...this.grnList];
    this.grnOpen = true;
  }

  onGrnSearch(e: Event) {
    const q = (e.target as HTMLInputElement).value || '';
    this.grnSearch = q;
    const s = q.toLowerCase();
    this.grnFiltered = this.grnList.filter(g =>
      (g.grnNo || '').toLowerCase().includes(s) ||
      (String(g.poNo || '')).toLowerCase().includes(s) ||
      (g.supplierName || '').toLowerCase().includes(s)
    );
    this.grnOpen = true;
  }

  selectGrn(g: GRNHeader) {
    debugger
    // set both FK and display number
    this.form.patchValue({ grnId: g.id, grnNo: g.grnNo });
    this.grnSearch = g.grnNo;
    this.grnOpen = false;
    this.selectedGrn = g;

    // 1) Preferred: fill from GRN items (grnJson on the selected row)
    if (g.grnJson) {
      const items = this.safeParseGrnItems(g.grnJson);
      this.selectedGrnItems = items;
      if (items.length) {
        this.fillLinesFromGRN(items);
        return;
      }
    }

    // 2) Optionally refetch by Id if service supports it
    if (typeof (this.grnService as any).getById === 'function') {
      (this.grnService as any).getById(g.id).subscribe({
        next: (res: any) => {
          const items = this.safeParseGrnItems(res?.data?.grnJson || '[]');
          this.selectedGrnItems = items;
          if (items.length) {
            this.fillLinesFromGRN(items);
            return;
          }
          this.tryFillFromPO(g);
        },
        error: () => this.tryFillFromPO(g)
      });
      return;
    }

    // 3) Fallback to PO lines if retained
    this.tryFillFromPO(g);
  }

  private safeParseGrnItems(jsonStr: string): GRNItem[] {
    try {
      const parsed = JSON.parse(jsonStr || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /** Map GRN items → FormArray rows */
  private fillLinesFromGRN(items: GRNItem[]) {
    debugger
    if (!items?.length) return;
    this.clearLines();
    items.forEach((it: GRNItem) => {
      const itemName = it.item ?? it.itemName ?? it.itemCode ?? '';
      const qty = it.qty != null ? Number(it.qty) : 1; // default to 1 if missing
      const price = it.price != null ? Number(it.price) : null;

      this.lines.push(this.fb.group({
        item: [itemName],
        qty: [qty],
        price: [price],
        matchStatus: ['OK'],
        mismatchFields: [''],
        dcNoteNo: ['']
      }));
    });
    this.recalcHeaderFromLines();
  }

  /** Optional PO fallback chain */
  private tryFillFromPO(g: GRNHeader) {
    const embedded = (g.poLinesJson || g.poLines);
    if (embedded) {
      try {
        const rows = Array.isArray(embedded) ? embedded : JSON.parse(embedded);
        this.fillLinesFromPOLines(rows);
        return;
      } catch { /* ignore */ }
    }
    if (g.poid && typeof (this.grnService as any).getPOById === 'function') {
      (this.grnService as any).getPOById(g.poid).subscribe({
        next: (res: any) => {
          const po = res?.data || res;
          const rows = po?.poLines ? (Array.isArray(po.poLines) ? po.poLines : JSON.parse(po.poLines)) : [];
          this.fillLinesFromPOLines(rows);
        },
        error: () => {}
      });
    }
  }

  /** If you use PO fallback at all */
  private fillLinesFromPOLines(rows: any[]) {
    if (!rows?.length) return;
    this.clearLines();
    rows.forEach(l => {
      this.lines.push(this.fb.group({
        item: [l.item || l.itemName || l.itemCode || ''],
        qty: [Number(l.qty) || 0],
        price: [l.price != null ? Number(l.price) : null],
        matchStatus: ['OK'],
        mismatchFields: [''],
        dcNoteNo: ['']
      }));
    });
    this.recalcHeaderFromLines();
  }

  trackByIndex(i: number) { return i; }
  trackByGrn = (_: number, g: GRNHeader) => g.id || g.grnNo;

  // close dropdown on outside click
  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    const t = ev.target as HTMLElement;
    if (!t.closest('.grn-combobox')) this.grnOpen = false;
  }
   goToSupplierInvoice() {
    this.router.navigateByUrl('/purchase/list-SupplierInvoice');
  }
}
