import { Component, OnInit } from '@angular/core';
import { WarehouseService } from 'app/main/master/warehouse/warehouse.service';
import { StockAdjustmentService } from './stock-adjustment.service';

type AdjType = 'Increase' | 'Decrease';
type ReasonCode = 'Damage' | 'Shrinkage' | 'Correction';

interface AdjustmentHeader {
  type: AdjType;
  reason: ReasonCode | null;
  threshold: number | null;
  warehouseId: number | null;
  binId: number | null;
}

interface AdjustmentLine {
  itemId: number | null;    // can be null (API-driven rows)
  item: string;             // name from API
  sku?: string;             // Sku from API
  binName?: string;         // optional
  qty: number | null;       // available from API
  reason: ReasonCode | null;
  remarks: string;
}

type WarehouseDto = { id: number; name: string };
type BinDto       = { id: number; name: string; warehouseId: number };

@Component({
  selector: 'app-stock-adjustment',
  templateUrl: './stock-adjustment.component.html',
  styleUrls: ['./stock-adjustment.component.scss']
})
export class StockAdjustmentComponent implements OnInit {

  // ---------- sources ----------
  adjTypes = [
    { label: 'Increase', value: 'Increase' as AdjType },
    { label: 'Decrease', value: 'Decrease' as AdjType }
  ];

  reasons = [
    { label: 'Damage',     value: 'Damage' as ReasonCode },
    { label: 'Shrinkage',  value: 'Shrinkage' as ReasonCode },
    { label: 'Correction', value: 'Correction' as ReasonCode }
  ];

  // Optional: keep if you still allow manual add lines
  itemOptions = [
    { id: 1, name: 'Laptop 14"' },
    { id: 2, name: 'Mouse Wireless' },
    { id: 3, name: 'Keyboard TKL' }
  ];

  // Warehouses and bins
  warehouses: WarehouseDto[] = [];
  filteredBins: BinDto[] = [];

  // If you want to inspect raw API results:
  itemDetails: any[] = [];

  // ---------- header model ----------
  adjHdr: AdjustmentHeader = {
    type: 'Increase',
    reason: null,
    threshold: 0,
    warehouseId: null,
    binId: null
  };

  // ---------- lines model ----------
  adjLines: AdjustmentLine[] = [];

  constructor(
    private warehouseService: WarehouseService,
    private stockadjustmentService: StockAdjustmentService
  ) {}

  // ---------------- lifecycle ----------------
  ngOnInit(): void {
    this.loadWarehouses();
  }

  // ---------------- data loads ----------------
  private loadWarehouses(): void {
    this.warehouseService.getWarehouse().subscribe({
      next: (res: any) => {
        this.warehouses = (res?.data ?? []).map((w: any) => ({
          id: Number(w.id),
          name: String(w.name)
        }));
      },
      error: err => console.error('Error loading warehouses', err)
    });
  }

  private loadBinsForWarehouse(warehouseId: number): void {
    this.stockadjustmentService.GetBinDetailsbywarehouseID(warehouseId).subscribe({
      next: (res: any) => {
        this.filteredBins = (res?.data ?? []).map((b: any) => ({
          id: Number(b.id),
          name: String(b.binName ?? b.name ?? b.bin),
          warehouseId
        }));
      },
      error: err => console.error('Error loading bins', err)
    });
  }

  // ---------------- ui handlers ----------------
  /** Warehouse change → reset bin and fetch bins */
  onWarehouseChange(warehouseId: number | null): void {
    this.adjHdr.warehouseId = warehouseId;
    this.adjHdr.binId = null;
    this.filteredBins = [];
    this.itemDetails = [];
    this.adjLines = []; // clear grid when warehouse changes

    if (warehouseId) this.loadBinsForWarehouse(warehouseId);
  }

  /** Bin change → if both IDs exist, fetch item details and bind to grid */
  onBinChange(binId: number | null): void {
    this.adjHdr.binId = binId;
    const wId = this.adjHdr.warehouseId ?? null;
    if (wId && binId) this.getItemDetails(wId, binId);
  }

  /** Call service with BOTH ids; map to grid */
  private getItemDetails(warehouseId: number, binId: number): void {
    this.stockadjustmentService
      .GetItemDetailswithwarehouseandBinID(warehouseId, binId)
      .subscribe({
        next: (res: any) => {
          // expecting: { isSuccess, message, data: [{ name, sku, available, binName }] }
          const rows = Array.isArray(res?.data) ? res.data : [];
          this.itemDetails = rows;

          // Overwrite grid with API result
          this.adjLines = rows.map((d: any) => ({
            itemId: null,
            item: String(d?.name ?? d?.itemName ?? ''),
            sku: String(d?.sku ?? ''),
            binName: String(d?.binName ?? ''),
            qty: Number(d?.available ?? d?.availableQty ?? 0),
            reason: null,
            remarks: ''
          }));

          // If you want at least one empty row when API returns nothing:
          if (this.adjLines.length === 0) {
            this.addLine();
          }

          console.log('Mapped lines:', this.adjLines);
        },
        error: (err: any) => console.error('API Error:', err)
      });
  }

  // Public alias with your original casing (optional)
  GetItemDetails(warehouseId: number, binId: number): void {
    this.getItemDetails(warehouseId, binId);
  }

  // ---------------- grid helpers ----------------
  trackByIdx = (i: number) => i;

  addLine(target: AdjustmentLine[] = this.adjLines): void {
    target.push({ itemId: null, item: '', sku: '', qty: null, reason: null, remarks: '' });
  }

  removeLine(target: AdjustmentLine[] = this.adjLines, index: number): void {
    if (index >= 0 && index < target.length) target.splice(index, 1);
  }

  changeLine(target: AdjustmentLine[], index: number, key: keyof AdjustmentLine, value: any): void {
    const row = target[index];
    if (!row) return;

    if (key === 'qty') {
      const n = Number(value);
      row.qty = Number.isFinite(n) ? n : null;
      return;
    }
    if (key === 'item') {
      row.item = (value ?? '').toString();
      return;
    }
    if (key === 'reason') {
      row.reason = (value ?? null) as ReasonCode | null;
      return;
    }
    if (key === 'itemId') {
      row.itemId = value === undefined || value === null ? null : Number(value);
      const found = this.itemOptions.find(o => o.id === row.itemId);
      if (found) row.item = found.name;
      return;
    }
    if (key === 'sku') {
      row.sku = (value ?? '').toString();
      return;
    }

    (row as any)[key] = value;
  }

  // ---------------- actions ----------------
  saveDraft(): void {
    console.log('Saving draft...', { header: this.adjHdr, lines: this.adjLines });
    alert('Draft saved (dummy). Check console for payload.');
  }

  submitForApproval(): void {
    const headerOk = !!this.adjHdr.reason && !!this.adjHdr.warehouseId && !!this.adjHdr.binId;
    const hasLines = this.adjLines.length > 0;
    const linesOk = hasLines && this.adjLines.every(l =>
      (l.item?.trim()?.length ?? 0) > 0 && l.qty !== null
    );

    if (!headerOk) {
      alert('Header required: Reason, Warehouse, and Bin.');
      return;
    }
    if (!linesOk) {
      alert('Please complete Item and Qty for all lines.');
      return;
    }

    console.log('Submitting for approval...', { header: this.adjHdr, lines: this.adjLines });
    alert('Submitted (dummy). Check console for payload.');
  }
}
