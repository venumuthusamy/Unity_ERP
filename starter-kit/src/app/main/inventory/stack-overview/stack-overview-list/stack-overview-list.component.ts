import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { StackOverviewService } from '../stack-overview.service';
// import { ItemMasterService } from '../../item-master/item-master.service'; // keep if you need it

/** Raw row from API */
interface ApiStockRow {
  id: number;
  sku: string;
  name: string;
  category?: string;
  uom?: string;

  warehouseId?: number;
  warehouseName?: string;
  binId?: number;
  binName?: string;

  onHand?: number;
  reserved?: number;
  available?: number;
  minQty?: number;
  maxQty?: number;
  expiryDate?: string; // ISO string
}

/** Location inside an item */
interface ItemLocation {
  warehouseId?: number;
  warehouseName?: string;
  binId?: number;
  binName?: string;
  onHand?: number;
  reserved?: number;
  available?: number;
  minQty?: number;
  maxQty?: number;
  expiryDate?: string | null;
}

/** Grouped row shown in the grid */
export interface ItemMaster {
  id: number;
  sku: string;
  name: string;
  category?: string;
  uom?: string;

  // aggregated from all locations
  totalOnHand?: number;
  totalReserved?: number;
  totalAvailable?: number;

  // details for modal
  locations: ItemLocation[];
}

@Component({
  selector: 'app-stack-overview-list',
  templateUrl: './stack-overview-list.component.html',
  styleUrls: ['./stack-overview-list.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class StackOverviewListComponent implements OnInit {
  rows: ItemMaster[] = [];
  filteredRows: ItemMaster[] = [];

  selectedItem: ItemMaster | null = null;

  // paging + search
  pageSizes = [10, 25, 50, 100];
  pageSize = 10;
  searchValue = '';

  // ui state
  loading = false;
  errorMsg: string | null = null;

  constructor(
    // private itemMasterService: ItemMasterService,
    private router: Router,
    private stockService: StackOverviewService,
    private modal: NgbModal
  ) {}

  ngOnInit(): void {
    this.loadMasterItem();
  }

  /** Build a stable identity for ngx-datatable */
  rowIdentity = (row: ItemMaster) => row.id;

  loadMasterItem(): void {
    this.loading = true;
    this.errorMsg = null;

    this.stockService.GetAllItemStockList().subscribe({
      next: (res: any) => {
        const raw: ApiStockRow[] = Array.isArray(res?.data) ? res.data : [];

        // group by item id
        const map = new Map<number, ItemMaster>();

        for (const r of raw) {
          if (!map.has(r.id)) {
            map.set(r.id, {
              id: r.id,
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

          const item = map.get(r.id)!;

          const onHand = r.onHand ?? 0;
          const reserved = r.reserved ?? 0;
          const available = r.available ?? 0;

          item.totalOnHand = (item.totalOnHand ?? 0) + onHand;
          item.totalReserved = (item.totalReserved ?? 0) + reserved;
          item.totalAvailable = (item.totalAvailable ?? 0) + available;

          item.locations.push({
            warehouseId: r.warehouseId,
            warehouseName: r.warehouseName,
            binId: r.binId,
            binName: r.binName,
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

  /** Search across item fields and inside locations (warehouse/bin) */
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

  /** Open modal with warehouse/bin breakdown */
  openViewModal(row: ItemMaster, tpl: any): void {
    this.selectedItem = row;
    this.modal.open(tpl, { centered: true, size: 'xl', backdrop: 'static' });
  }

  /** Edit action */
  editItem(id: number): void {
    // TODO: replace with your route
    // this.router.navigate(['/inventory/item-master/edit', id]);
    console.log('edit', id);
  }

  /** Create */
  goToCreateItem(): void {
    this.router.navigate(['/Inventory/create-stackoverview']);
  }
}
