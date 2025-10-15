import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';

interface SelectOpt { id: number | string; name?: string; label?: string; value?: string; }

interface StockTakeLine {
  id: number;
  locationId: number | string | null;
  itemId: number | string | null;
  itemName: string | null;
  bookQty: number | null;
  counted: number | null;
  barcode?: string | null;
  remarks?: string | null;
  _error?: string | null; // UI-only
}

@Component({
  selector: 'app-stock-take',
  templateUrl: './stock-take.component.html',
  styleUrls: ['./stock-take.component.scss']
})
export class StockTakeComponent implements OnInit {


  // ===== Header selections =====
  warehouseTypes = [
    { label: 'Central', value: 'Central' },
    { label: 'Southern',  value: 'Southern'  }
  ]
  takeTypes = [
    { label: 'Cycle', value: 'Cycle' },
    { label: 'Full',  value: 'Full'  }
  ];
  strategies = [
    { label: 'ABC',         value: 'ABC' },
    { label: 'High Value',  value: 'HighValue' },
    { label: 'Fast Movers', value: 'FastMovers' }
  ];
  warehouseType : any
  takeType: 'Cycle' | 'Full' | null = 'Cycle';
  strategy: string | null = 'ABC';
  freeze = false;

  // ===== Master data (demo) =====
  locations: SelectOpt[] = [
    { id: 1, name: 'A1' },
    { id: 2, name: 'B1' },
    { id: 3, name: 'C1' },
  ];

  items: Array<{ id: number; name: string; defaultBook?: number }> = [
    { id: 101, name: 'Rice 5kg',   defaultBook: 120 },
    { id: 102, name: 'Wheat 10kg', defaultBook:  70 },
    { id: 103, name: 'Sugar 1kg',  defaultBook:  45 },
  ];

  // ===== Lines =====
  private _lineCounter = 0;
  lines: StockTakeLine[] = [];

  @ViewChild('reviewTpl', { static: true }) reviewTpl!: any;
  private reviewRef?: NgbModalRef;

  constructor(private router: Router, private modal: NgbModal) {}

  ngOnInit(): void {}

  // ===== Planning =====
  onPlan(): void {
    const mk = (itId: number, locId: number, book: number): StockTakeLine => ({
      id: ++this._lineCounter,
      locationId: locId,
      itemId: itId,
      itemName: this.items.find(i => i.id === itId)?.name ?? null,
      bookQty: book,
      counted: null,
      barcode: '',
      remarks: '',
      _error: null
    });

    if (this.takeType === 'Full') {
      this.lines = [ mk(101,1,120), mk(102,2,70), mk(103,3,45) ];
    } else {
      this.lines = [ mk(101,1,120), mk(102,2,70) ];
    }

    if (this.freeze) {
      console.log('Freeze requested for planned scope.');
      // TODO: backend call to freeze items/locations
    }
  }

  onExportMobileTasks(): void {
    if (!this.lines.length) { alert('Plan lines first.'); return; }
    console.log('Exporting mobile tasks for', this.lines.length, 'lines');
  }

  // ===== Line ops =====
  addLine(): void {
    this.lines.push({
      id: ++this._lineCounter,
      locationId: null,
      itemId: null,
      itemName: null,
      bookQty: 0,
      counted: null,
      barcode: '',
      remarks: '',
      _error: null
    });
  }
  removeLine(i: number): void { this.lines.splice(i, 1); }
  clearLines(): void { this.lines = []; }

  onItemPicked(r: StockTakeLine): void {
    const it = this.items.find(i => i.id === r.itemId);
    r.itemName = it?.name ?? null;
    if (r.bookQty == null || r.bookQty === 0) r.bookQty = it?.defaultBook ?? 0;
  }

  onCountChange(r: StockTakeLine): void {
    const n = Math.floor(Number(r.counted));
    if (!Number.isFinite(n) || n < 0) {
      r.counted = null;
      r._error = 'Enter a valid number (≥ 0)';
    } else {
      r.counted = n;
      r._error = null;
    }
  }

  // ===== Helpers for modal/table =====
  toNum(v: any): number { return Number(v) || 0; }
  getVariance(r: StockTakeLine): number { return this.toNum(r.counted) - this.toNum(r.bookQty); }
  signed(n: number): string { return (n >= 0 ? '+' : '') + n; }
  getLocationName(id: number | string | null): string {
    const x = this.locations.find(l => l.id === id);
    return x?.name ?? String(id ?? '');
    }
  getItemName(id: number | string | null): string {
    const x = this.items.find(i => i.id === id);
    return x?.name ?? String(id ?? '');
  }

  // Totals
  get totalBook(): number     { return this.lines.reduce((s, L) => s + this.toNum(L.bookQty), 0); }
  get totalCounted(): number  { return this.lines.reduce((s, L) => s + this.toNum(L.counted), 0); }
  get totalVariance(): number { return this.totalCounted - this.totalBook; }

  // ===== Review modal =====
  openReview(): void {
    if (!this.lines.length) { alert('Nothing to review.'); return; }
    this.reviewRef = this.modal.open(this.reviewTpl, { size: 'lg', centered: true, backdrop: 'static' });
  }

  confirmPostFromReview(modalRef: NgbModalRef): void {
    if (!this.canPost()) return;
    modalRef.close();
    this.onPost();
  }

  // ===== Post =====
  canPost(): boolean {
    if (!this.lines.length) return false;
    return this.lines.every(L => L.locationId && L.itemId && L.counted != null && !L._error);
  }

  onPost(): void {
    const errs: string[] = [];
    if (!this.lines.length) errs.push('No lines to post.');
    this.lines.forEach((L, i) => {
      if (!L.locationId) errs.push(`Line ${i+1}: Location is required.`);
      if (!L.itemId)     errs.push(`Line ${i+1}: Item is required.`);
      if (L.counted == null || !Number.isFinite(Number(L.counted)) || Number(L.counted) < 0)
        errs.push(`Line ${i+1}: Counted must be ≥ 0.`);
      if (L.bookQty == null || !Number.isFinite(Number(L.bookQty)) || Number(L.bookQty) < 0)
        errs.push(`Line ${i+1}: Book qty missing (plan again or set).`);
    });
    if (errs.length) { alert('Fix these issues:\n\n' + errs.join('\n')); return; }

    const payload = {
      takeType: this.takeType,
      strategy: this.takeType === 'Cycle' ? this.strategy : null,
      freeze: this.freeze,
      lines: this.lines.map(L => ({
        locationId: L.locationId,
        itemId: L.itemId,
        counted: this.toNum(L.counted),
        bookQty: this.toNum(L.bookQty),
        variance: this.toNum(L.counted) - this.toNum(L.bookQty),
        barcode: (L.barcode ?? '').trim() || null,
        remarks: (L.remarks ?? '').trim() || null
      }))
    };

    console.log('POST COUNTS payload →', payload);
    // TODO: call your API here.
    alert('Counts posted (demo). Check console for payload.');
  }

  // ===== Nav =====
  goToStockTakeList(): void {
    this.router.navigate(['/Inventory/list-inventory']); // adjust route
  }

}



