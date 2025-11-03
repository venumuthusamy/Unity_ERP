import {
  Component,
  OnInit,
  ViewChild,
  ViewEncapsulation,
  AfterViewInit,
  AfterViewChecked
} from '@angular/core';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { ColumnMode, DatatableComponent } from '@swimlane/ngx-datatable';
import { DatePipe } from '@angular/common';
import * as feather from 'feather-icons';

import { StockTransferService } from '../stock-transfer.service';
import { StackOverviewService } from '../../stack-overview/stack-overview.service';

type TransferStatus = 'Draft' | 'Pending' | 'Transferred';

interface TransferLine {
  sku?: string;
  itemCode?: string;
  name?: string;
  item?: string;
  uom?: string;
  unit?: string;
  onHand?: number | string;
  reserved?: number | string;
  available?: number;
  binName?: string;
  locationName?: string;
  expiryDate?: string | Date | null;
  remarks?: string;
  reason?: string;
  qty?: number | string;
  quantity?: number | string;
  qtyTransferred?: number | string;
  movedQty?: number | string;
  transferQty?: number | string;
}

interface ApiRow {
  id: number;

  // ✅ IDs you need from the API
  stockId?: number | string;
  itemId?: number | string;
  warehouseId?: number | string;

  // header fields (from API)
  fromWarehouseName?: string;
  toWarehouseName?: string;
  remarks?: string | null;
  isTransfered?: boolean | 'true' | 'false' | 'Y' | 'N' | 0 | 1;
  isApproved?: boolean | 'true' | 'false' | 'Y' | 'N' | 0 | 1;

  // sometimes the API also puts sku/name on the header (optional)
  sku?: string;
  name?: string;

  // lines can come under many names or as a JSON string
  poLines?: TransferLine[] | string;
  lines?: TransferLine[] | string;
  transferLines?: TransferLine[] | string;
  stockTransferLines?: TransferLine[] | string;
  stockTransferLineList?: TransferLine[] | string;
  details?: TransferLine[] | string;
  items?: TransferLine[] | string;
}

interface UiRow extends ApiRow {
  // ✅ normalized numeric ids for easy use
  stockIdNum?: number;
  itemIdNum?: number;
  warehouseIdNum?: number;

  isTransferedBool: boolean;
  isApprovedBool: boolean;
  transferStatus: TransferStatus;
   isPartialTransferBool?: boolean;
}

@Component({
  selector: 'app-stock-transfer-list',
  templateUrl: './stock-transfer-list.component.html',
  styleUrls: ['./stock-transfer-list.component.scss'],
  encapsulation: ViewEncapsulation.None,
  providers: [DatePipe]
})
export class StockTransferListComponent
  implements OnInit, AfterViewInit, AfterViewChecked {

  @ViewChild(DatatableComponent) table: DatatableComponent;

  rows: UiRow[] = [];
  tempData: UiRow[] = [];

  public searchValue = '';
  public ColumnMode = ColumnMode;
  public selectedOption = 10;

  showLinesModal = false;
  modalLines: {
    sku: string;
    name: string;
    uom: string;
    onHand: number;
    reserved: number;
    available?: number;
    availableComputed: number;
    binName: string;
    expiryDate: string | Date | null;
    remarks: string;
    transferQty?: number;
  }[] = [];
  modalTotalAvailable = 0;

  constructor(
    private stockTransferService: StockTransferService,
    private router: Router,
    private datePipe: DatePipe,
    private stockService: StackOverviewService
  ) {}

  // ------------ Lifecycle ------------

  ngOnInit(): void {
    this.loadMasterItem();
  }

  ngAfterViewInit(): void {
    feather.replace();
  }
  ngAfterViewChecked(): void {
    feather.replace();
  }

  // ------------ Utilities ------------

  private toNum(v: any): number | undefined {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }

  private normalizeBool(v: any): boolean {
    return v === true || v === 'true' || v === 'Y' || v === 1 || v === '1';
  }

private computeStatus(
  isTransfered: boolean,
  isApproved: boolean,
  isPartialTransfer: boolean
): TransferStatus {
  // 🔹 Priority: if partial transfer → Transferred
  if (isPartialTransfer) return 'Transferred';

  // 🔹 Next: if not yet transferred → Draft
  if (!isTransfered) return 'Draft';

  // 🔹 Otherwise: approved or pending
  return isApproved ? 'Transferred' : 'Pending';
}


private toUiRow(api: ApiRow): UiRow {
  const isTransferedBool = this.normalizeBool(api.isTransfered);
  const isApprovedBool   = this.normalizeBool(api.isApproved);
  const isPartialTransferBool = this.normalizeBool((api as any).isPartialTransfer);

  const stockIdNum     = this.toNum((api as any).stockId ?? (api as any).StockId);
  const itemIdNum      = this.toNum((api as any).itemId  ?? (api as any).ItemId  ?? (api as any).id);
  const warehouseIdNum = this.toNum((api as any).warehouseId ?? (api as any).WarehouseId);

  return {
    ...api,
    stockIdNum,
    itemIdNum,
    warehouseIdNum,
    isTransferedBool,
    isApprovedBool,
    isPartialTransferBool,
    transferStatus: this.computeStatus(isTransferedBool, isApprovedBool, isPartialTransferBool)
  };
}

  // ------------ Data load ------------

  loadMasterItem(): void {
    this.stockService.GetAllStockTransferedList().subscribe({
      next: (res: any) => {
        const list: ApiRow[] = (res?.data ?? []) as ApiRow[];

        // For the main grid, if sku/name are missing on the header,
        // populate from the first line so those two columns show something meaningful.
        this.rows = list.map(r => {
          const ui = this.toUiRow(r);
          if (!ui.sku || !ui.name) {
            const lines = this.extractLinesFromRow(r);
            const first = lines[0];
            if (first) {
              ui.sku  = ui.sku  ?? (first.sku ?? first.itemCode ?? '');
              ui.name = ui.name ?? (first.name ?? first.item ?? '');
            }
          }
          return ui;
        });

        this.tempData = [...this.rows];
      },
      error: (err) => {
        console.error('Load stock transfer list failed', err);
        this.rows = [];
        this.tempData = [];
      }
    });
  }

  // ------------ Search ------------

  filterUpdate(event: any) {
    const val = (event?.target?.value ?? this.searchValue ?? '')
      .toString()
      .toLowerCase()
      .trim();

    if (!val) {
      this.rows = [...this.tempData];
      if (this.table) this.table.offset = 0;
      return;
    }

    const contains = (s?: any) => (s ?? '').toString().toLowerCase().includes(val);

    const filtered = this.tempData.filter(d =>
      contains(d.sku) ||
      contains(d.name) ||
      contains(d.fromWarehouseName) ||
      contains(d.toWarehouseName)   ||
      contains(d.remarks)           ||
      contains(d.transferStatus)
    );

    this.rows = filtered;
    if (this.table) this.table.offset = 0;
  }

  // ------------ Actions ------------

  openCreate() {
    this.router.navigate(['/Inventory/create-stocktransfer']);
  }

  editStockTransfer(row: UiRow) {
    this.router.navigateByUrl(`/Inventory/edit-stocktransfer/${row.id}`);
  }

  deleteStockTransfer(id: number) {
    Swal.fire({
      title: 'Are you sure?',
      text: 'This will permanently delete the Stock Transfer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    }).then(result => {
      if (result.isConfirmed) {
        this.stockTransferService.deleteStockTransfer(id).subscribe({
          next: () => {
            this.loadMasterItem();
            Swal.fire('Deleted!', 'Stock Transfer has been deleted.', 'success');
          },
          error: (err) => console.error('Error deleting request', err)
        });
      }
    });
  }

  // ------------ Lines Modal ------------

  /** Try very hard to find line items on the row.
   *  - Checks common keys (case-insensitive)
   *  - Falls back to scanning ALL props
   *  - Parses JSON strings that look like arrays/objects
   *  - Unwraps { data | items | lines } wrappers
   */
  private extractLinesFromRow(row: any): any[] {
    if (!row || typeof row !== 'object') return [];

    // 1) Case-insensitive lookup on common names
    const wanted = [
      'polines', 'lines', 'transferlines', 'stocktransferlines',
      'stocktransferlinelist', 'details', 'items'
    ];
    const keys = Object.keys(row);
    const byLower: Record<string,string> = {};
    for (const k of keys) byLower[k.toLowerCase()] = k;

    for (const low of wanted) {
      const realKey = byLower[low];
      if (!realKey) continue;
      const found = this.normalizeToArray(row[realKey]);
      if (found.length) return found;
    }

    // 2) Fallback: scan every property
    for (const k of keys) {
      const val = row[k];
      const arr = this.normalizeToArray(val);
      if (arr.length && this.looksLikeLines(arr)) return arr;
    }

    return [];
  }

  /** Convert a value to an array of objects if possible:
   *  - raw array
   *  - JSON string -> parse
   *  - wrapper objects { data | items | lines }
   *  - single object -> [obj]
   */
  private normalizeToArray(raw: any): any[] {
    let v = raw;

    // JSON string?
    if (typeof v === 'string') {
      const s = v.trim();
      if (
        (s.startsWith('[') && s.endsWith(']')) ||
        (s.startsWith('{') && s.endsWith('}'))
      ) {
        try { v = JSON.parse(s); } catch { return []; }
      } else {
        return [];
      }
    }

    // Unwrap common wrappers
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (Array.isArray((v as any).data))  v = (v as any).data;
      else if (Array.isArray((v as any).items)) v = (v as any).items;
      else if (Array.isArray((v as any).lines)) v = (v as any).lines;
      else v = [v]; // single object
    }

    return Array.isArray(v) ? v : [];
  }

  /** Heuristic: does this array look like line items? */
  private looksLikeLines(arr: any[]): boolean {
    if (!arr.length || typeof arr[0] !== 'object') return false;
    const sample = arr[0];
    const keys = Object.keys(sample).map(k => k.toLowerCase());
    // any of these fields is a good signal
    const signals = [
      'sku','itemcode','name','item','uom','unit',
      'onhand','reserved','available','binname','locationname',
      'expiry','expirydate','remarks','reason','qty','quantity','transferqty'
    ];
    return keys.some(k => signals.includes(k));
  }

  openLinesModal(row: UiRow) {
    console.log('row clicked:', row);

    // try to extract an array first (for true multi-line transfers)
    let lines = this.extractLinesFromRow(row);

    // if no nested lines exist, but the row itself looks like a line, show that as single-line
    if (!lines.length && this.rowLooksLikeSingleLine(row)) {
      lines = [row];
    }

    this.modalLines = lines.map(l => this.mapAnyToLine(l));

    this.modalTotalAvailable = this.modalLines
      .map(x => Number(x.availableComputed) || 0)
      .reduce((a, b) => a + b, 0);

    this.showLinesModal = true;

    if (!this.modalLines.length) {
      console.warn('No lines found. Row keys:', Object.keys(row));
    }
  }

  closeLinesModal() {
    this.showLinesModal = false;
    this.modalLines = [];
    this.modalTotalAvailable = 0;
  }

  private rowLooksLikeSingleLine(row: any): boolean {
    if (!row || typeof row !== 'object') return false;
    const keys = Object.keys(row).map(k => k.toLowerCase());
    const mustHave = ['sku','name','uom','onhand','reserved','available','binname'];
    // consider it a “line-like” row if it has at least 3 of the core fields
    const hits = mustHave.filter(k => keys.includes(k)).length;
    return hits >= 3;
  }

  private mapAnyToLine(l: any) {
    const onHand   = Number((l?.onHand ?? l?.qtyOnHand ?? l?.quantityOnHand) || 0);
    const reserved = Number((l?.reserved ?? l?.qtyReserved) || 0);
    const availableComputed =
      typeof l?.available === 'number' ? l.available : (onHand - reserved);

    const transferQty = Number(
      (l?.transferQty ?? l?.qtyTransferred ?? l?.movedQty ?? l?.qty ?? l?.quantity ?? 0)
    );

    return {
      sku:  l?.sku ?? l?.itemCode ?? '',
      name: l?.name ?? l?.item ?? '',
      uom:  l?.uom ?? l?.unit ?? '',
      onHand,
      reserved,
      available: l?.available,
      availableComputed,
      binName: l?.binName ?? l?.locationName ?? '',
      expiryDate: l?.expiryDate ?? l?.expiry ?? null,
      remarks: l?.remarks ?? l?.reason ?? '',
      transferQty
    };
  }

  // ------------ Handy: navigate to history with stockId ------------

  goToHistory(row: UiRow) {
    const stockId = row.stockIdNum ?? this.toNum((row as any).stockId);
    if (!stockId) {
      Swal.fire('Missing stockId', 'Cannot open history for this row.', 'warning');
      return;
    }
    const itemId = row.itemIdNum ?? this.toNum((row as any).itemId) ?? row.id;
    const warehouseId = row.warehouseIdNum ?? this.toNum((row as any).warehouseId);

    this.router.navigate(['/Inventory/stock-history'], {
      queryParams: {
        sku: row.sku,
        itemId,
        warehouseId,
        stockId
      }
    });
  }
}
