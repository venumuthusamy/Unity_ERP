import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { ItemMasterService } from '../item-master.service';
import { Router } from '@angular/router';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';

export interface ItemMaster {
  id: number;
  sku: string;
  name: string;
  category?: string;
  uom?: string;
  wareHouse?: string; // matches your payload key
  // add other keys if your API returns them (e.g., bin, brand, etc.)
}
interface ListRow { id: number; sku: string; name: string;}
@Component({
  selector: 'app-item-master-list',
  templateUrl: './item-master-list.component.html',
  styleUrls: ['./item-master-list.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class ItemMasterListComponent implements OnInit {
@ViewChild('itemViewModal') itemViewModalTemplate: any;
  ItemMasterList: any;
 rows: ItemMaster[] = [];
  filteredRows: ItemMaster[] = [];

   // paging + search
  pageSizes = [10, 25, 50, 100];
  pageSize = 10;
  searchValue = '';

    // ui state
  loading = false;
  errorMsg: string | null = null;
   currentItem: { id: number; sku: string; name: string } | null = null;
  activeTab: 'warehouse' | 'supplier' | 'audit' = 'warehouse';
  modalRef?: NgbModalRef;

  warehouseRows: any[] = [];
  supplierRows: any[] = [];
  auditRows: any[] = [];
  selectedAudit: any | null = null;
  constructor(private itemMasterService : ItemMasterService,  private router: Router,private modal: NgbModal) { }

  ngOnInit(): void {
    this.loadMasterItem();
  }


  loadMasterItem(): void {
    this.loading = true;
    this.errorMsg = null;

    this.itemMasterService.getAllItemMaster().subscribe({
      next: (res: any) => {
        // expecting: { isSuccess: true, data: [...] }
        const list: ItemMaster[] = Array.isArray(res?.data) ? res.data : [];
        this.rows = list;
        this.filteredRows = [...list]; // initial render
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = 'Failed to load Item Master list.';
        console.error('Item Master load error', err);
      }
    });
  }

  /** Search filter across common fields */
  applyFilter(): void {
    const q = (this.searchValue || '').toLowerCase().trim();
    if (!q) {
      this.filteredRows = [...this.rows];
      return;
    }

    this.filteredRows = this.rows.filter(r => {
      const id = String(r.id ?? '').toLowerCase();
      const sku = String(r.sku ?? '').toLowerCase();
      const name = String(r.name ?? '').toLowerCase();
      const cat = String(r.category ?? '').toLowerCase();
      const uom = String(r.uom ?? '').toLowerCase();
      const wh  = String(r.wareHouse ?? '').toLowerCase();

      return (
        id.includes(q) ||
        sku.includes(q) ||
        name.includes(q) ||
        cat.includes(q) ||
        uom.includes(q) ||
        wh.includes(q)
      );
    });
  }

  /** Eye action */
  openView(row: ItemMaster): void {
    // TODO: open a modal or navigate to a detail page
    // this.router.navigate(['/inventory/item-master/view', row.id]);
    console.log('view', row);
  }

  /** Edit action */
  editItem(id: number): void {
   this.router.navigateByUrl(`/purchase/Edit-itemmaster/${id}`);
  }

 
    goToCreateItem(): void {
    this.router.navigate(['/Inventory/Create-itemmaster']);
  }
    openLinesModal(row: ListRow) {
    this.currentItem = { id: Number(row.id), sku: row.sku, name: row.name };
    this.activeTab = 'warehouse';
    this.modalRef = this.modal.open(this.itemViewModalTemplate, { size: 'xl', centered: true, scrollable: true });
    // load default tab
    this.loadWarehouse();
  }

  switchTab(tab: 'warehouse' | 'supplier' | 'audit') {
    if (!this.currentItem) return;
    this.activeTab = tab;
    if (tab === 'warehouse') this.loadWarehouse();
    if (tab === 'supplier') this.loadSupplier();
    if (tab === 'audit') this.loadAudit();
  }

   loadWarehouse() {
    if (!this.currentItem) return;
    this.itemMasterService.getWarehouseStock(this.currentItem.id).subscribe(rows => {
      // Optionally compute Available if your DB column is null
      this.warehouseRows = rows.map((r: any) => ({
        ...r,
        available: r.available ?? (Number(r.onHand || 0) - Number(r.reserved || 0))
      }));
    });
  }

   loadSupplier() {
    if (!this.currentItem) return;
    this.itemMasterService.getSupplierPrices(this.currentItem.id).subscribe(rows => this.supplierRows = rows);
  }

   loadAudit() {
    if (!this.currentItem) return;
    this.itemMasterService.getAudit(this.currentItem.id).subscribe(rows => {
      this.auditRows = rows;
      this.selectedAudit = null;
    });
  }

  onAuditRowSelect(row: any) { this.selectedAudit = row; }
}