// stock-transfer-create.component.ts
import { Component, OnInit, AfterViewInit, AfterViewChecked } from '@angular/core';
import { Router } from '@angular/router';
import * as feather from 'feather-icons';

interface MoveRow {
  selected: boolean;          // user-selected to move
  id: number | string;
  itemName: string;
  available: number;          // current stock available
  qty: number | null;         // qty to move
  batchSerial?: string | null;
  remarks?: string | null;
  
}

interface StockTransferLine {
  itemId: number | string;
  itemName: string;
  qty: number;
  batchSerial: string | null;
  remarks: string | null;
}

@Component({
  selector: 'app-stock-transfer-create',
  templateUrl: './stock-transfer-create.component.html',
  styleUrls: ['./stock-transfer-create.component.scss']
})
export class StockTransferCreateComponent implements OnInit, AfterViewInit, AfterViewChecked {

  // Warehouses (use numbers if your API expects them)
  warehouses = [
    { id: 'all',     name: 'All' },
    { id: 'central', name: 'Central' },
    { id: 'east',    name: 'East' }
  ];

  fromWarehouse: string | number | null = null;
  toWarehouse:   string | number | null = null;
  reason = '';

  // table rows
  rows: MoveRow[] = [];

  // selected lines used by Save/Submit
  stockLines: StockTransferLine[] = [];

  constructor(private router: Router) {}

  // Feather icons refresh
  ngAfterViewInit(): void {
    feather.replace();
  }
  ngAfterViewChecked(): void {
    feather.replace();
  }

  ngOnInit(): void {
    // Seed demo rows — replace with your API
    this.rows = [
      { id: 101, itemName: 'Rice 5kg',   available: 120, qty: null, batchSerial: '', remarks: '', selected: false },
      { id: 102, itemName: 'Wheat 10kg', available: 70,  qty: null, batchSerial: '', remarks: '', selected: false },
    ];
  }

  // ===== Badge helper (as you had) =====
  badgeToneClasses(tone: 'blue' | 'green' | 'amber' | 'red' = 'blue') {
    const map: Record<string, { bg: string; text: string; border: string }> = {
      blue:  { bg: 'bg-blue-50',  text: 'text-blue-700',  border: 'border-blue-100' },
      green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100' },
      amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
      red:   { bg: 'bg-red-50',   text: 'text-red-700',   border: 'border-red-100' },
    };
    const t = map[tone] ?? map.blue;
    return `${t.bg} ${t.text} ${t.border}`;
  }

  // ===== Selection logic (checkbox version) =====
  /** Valid when 1 ≤ qty ≤ available */
  canSelect(r: MoveRow): boolean {
    debugger
    const q = Number(r.qty);
    return Number.isFinite(q) && q >= 1 && q <= r.available;
  }

  /** Clamp qty and unselect if invalid */
  onQtyChange(r: MoveRow): void {
    debugger
    if (r.qty == null || isNaN(Number(r.qty))) {
      r.qty = null;
    } else {
      const q = Math.floor(Number(r.qty));
      if (q < 1) r.qty = null;
      else if (q > r.available) r.qty = r.available;
      else r.qty = q;
    }
    if (!this.canSelect(r)) r.selected = false;
  }

  /** Count of selected rows */
  get selectedCount(): number {
    return this.rows.filter(r => r.selected).length;
  }

  /** Header checkbox: true when all selectable rows are selected */
  get allSelected(): boolean {
    debugger
    const selectable = this.rows.filter(r => this.canSelect(r));
    return selectable.length > 0 && selectable.every(r => r.selected);
  }

  /** For header checkbox indeterminate state */
  get someSelected(): boolean {
    return this.rows.some(r => r.selected);
  }

  /** Header checkbox toggle */
  toggleAll(checked: boolean): void {
    debugger
    this.rows.forEach(r => {
      if (this.canSelect(r)) r.selected = checked;
    });
  }

  /** Buttons: select all / clear all */
  selectAll(): void {
    this.rows.forEach(r => {
      if (this.canSelect(r)) r.selected = true;
    });
  }
  clearAll(): void {
    this.rows.forEach(r => (r.selected = false));
  }

  // ===== Actions =====
  /** Build lines from selected rows */
  private buildSelectedLines(): StockTransferLine[] {
    return this.rows
      .filter(r => r.selected && this.canSelect(r))
      .map<StockTransferLine>(r => ({
        itemId: r.id,
        itemName: r.itemName,
        qty: r.qty as number,
        batchSerial: (r.batchSerial ?? '').trim() || null,
        remarks: (r.remarks ?? '').trim() || null,
      }));
  }

  onSaveDraft(): void {
    this.stockLines = this.buildSelectedLines();

    const payload = {
      fromWarehouseId: this.fromWarehouse,
      toWarehouseId: this.toWarehouse,
      reason: (this.reason ?? '').trim() || null,
      lines: this.stockLines
    };

    console.log('Saving draft…', payload);
    // this.stockTransferService.saveDraft(payload).subscribe(...)
  }

  onSubmitForApproval(): void {
    this.stockLines = this.buildSelectedLines();

    // Basic header validations
    if (!this.fromWarehouse || !this.toWarehouse) {
      alert('Please choose both From and To warehouses.');
      return;
    }
    if (this.fromWarehouse === this.toWarehouse) {
      alert('From and To warehouses must be different.');
      return;
    }
    if (this.stockLines.length === 0) {
      alert('Please select at least one line with a valid quantity.');
      return;
    }

    const payload = {
      fromWarehouseId: this.fromWarehouse,
      toWarehouseId: this.toWarehouse,
      reason: (this.reason ?? '').trim() || null,
      lines: this.stockLines
    };

    console.log('Submitting for approval…', payload);
    // this.stockTransferService.submit(payload).subscribe(...)
  }

  // ===== Navigation =====
  goToStockTransfer() {
    this.router.navigate(['/Inventory/list-stocktransfer']);
  }
  cancel() {
    this.router.navigate(['/Inventory/list-stocktransfer']);
  }
}
