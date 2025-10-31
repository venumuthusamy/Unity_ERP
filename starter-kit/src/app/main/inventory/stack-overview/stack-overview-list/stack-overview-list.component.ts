import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { StackOverviewService } from '../stack-overview.service';

/** Raw row from API (per bin / per warehouse row) */
interface ApiStockRow {
  id: number;                // itemId
  sku: string;
  name: string;
  category?: string;
  uom?: string;

  warehouseId?: number;
  warehouseName?: string;
  binId?: number | null;
  binName?: string | null;

  onHand?: number;
  reserved?: number;
  available?: number;
  minQty?: number;
  maxQty?: number;
  expiryDate?: string;       // ISO string
}

/** Location line (bin row for any warehouse) */
interface ItemLocation {
  warehouseId?: number;
  warehouseName?: string;
  binId?: number | null;
  binName?: string | null;
  onHand?: number;
  reserved?: number;
  available?: number;
  minQty?: number;
  maxQty?: number;
  expiryDate?: string | null;
}

/** Grid row: one row per itemId (aggregated across all warehouses) */
export interface ItemWarehouseRow {
  gridKey: string;           // `${itemId}`
  id: number;                // itemId
  sku: string;
  name: string;
  category?: string;
  uom?: string;

  // totals across ALL warehouses
  totalOnHand?: number;
  totalReserved?: number;
  totalAvailable?: number;

  // all bin lines (for modal)
  locations: ItemLocation[];
}

@Component({
  selector: 'app-stack-overview-list',
  templateUrl: './stack-overview-list.component.html',
  styleUrls: ['./stack-overview-list.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class StackOverviewListComponent implements OnInit {
  rows: ItemWarehouseRow[] = [];
  filteredRows: ItemWarehouseRow[] = [];

  selectedItem: ItemWarehouseRow | null = null;

  // paging + search
  pageSizes = [10, 25, 50, 100];
  pageSize = 10;
  searchValue = '';

  // ui state
  loading = false;
  errorMsg: string | null = null;

  constructor(
    private router: Router,
    private stockService: StackOverviewService,
    private modal: NgbModal
  ) {}

  ngOnInit(): void {
    this.loadMasterItem();
  }

  /** Stable identity for ngx-datatable */
  rowIdentity = (row: ItemWarehouseRow) => row.gridKey;

  loadMasterItem(): void {
    this.loading = true;
    this.errorMsg = null;

    this.stockService.GetAllStockList().subscribe({
      next: (res: any) => {
        const raw: ApiStockRow[] = Array.isArray(res?.data) ? res.data : [];

        // Group by itemId ONLY (aggregate across all warehouses)
        const map = new Map<number, ItemWarehouseRow>();

        for (const r of raw) {
          const itemId = r.id;

          if (!map.has(itemId)) {
            map.set(itemId, {
              gridKey: String(itemId),
              id: itemId,
              sku: r.sku,
              name: r.name,
              category: r.category,
              uom: r.uom,

              totalOnHand: 0,
              totalReserved: 0,
              totalAvailable: 0,

              locations: []
            });
          }

          const row = map.get(itemId)!;

          const onHand = r.onHand ?? 0;
          const reserved = r.reserved ?? 0;
          const available = r.available ?? (onHand - reserved);

          row.totalOnHand = (row.totalOnHand ?? 0) + onHand;
          row.totalReserved = (row.totalReserved ?? 0) + reserved;
          row.totalAvailable = (row.totalAvailable ?? 0) + available;

          // Keep every bin line (for modal)
          row.locations.push({
            warehouseId: r.warehouseId,
            warehouseName: r.warehouseName,
            binId: r.binId ?? null,
            binName: r.binName ?? null,
            onHand,
            reserved,
            available,
            minQty: r.minQty ?? 0,
            maxQty: r.maxQty ?? 0,
            expiryDate: r.expiryDate ?? null
          });
        }

        const list = Array.from(map.values());

        this.rows = list;
        this.filteredRows = [...list];
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = 'Failed to load stock list.';
        console.error('Stock list load error', err);
      }
    });
  }

  /** Search across item fields + any warehouse/bin name via locations */
  applyFilter(): void {
    const q = (this.searchValue || '').toLowerCase().trim();
    if (!q) {
      this.filteredRows = [...this.rows];
      return;
    }

    this.filteredRows = this.rows.filter(r => {
      const baseHit =
        String(r.id ?? '').toLowerCase().includes(q) ||
        (r.sku ?? '').toLowerCase().includes(q) ||
        (r.name ?? '').toLowerCase().includes(q) ||
        (r.category ?? '').toLowerCase().includes(q) ||
        (r.uom ?? '').toLowerCase().includes(q);

      if (baseHit) return true;

      return r.locations?.some(loc =>
        (loc.warehouseName ?? '').toLowerCase().includes(q) ||
        (loc.binName ?? '').toLowerCase().includes(q)
      );
    });
  }

  /** Open modal with ALL warehouses/bins for the item */
  openViewModal(row: ItemWarehouseRow, tpl: any): void {
    this.selectedItem = row;
    this.modal.open(tpl, { centered: true, size: 'xl', backdrop: 'static' });
  }

  /** Navigate to create page */
  goToCreateItem(): void {
    this.router.navigate(['/Inventory/create-stackoverview']);
  }
}
