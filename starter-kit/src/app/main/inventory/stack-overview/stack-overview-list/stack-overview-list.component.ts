import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { ItemMasterService } from '../../item-master/item-master.service';
import { Router } from '@angular/router';
export interface ItemMaster {
  id: number;
  sku: string;
  name: string;
  category?: string;
  uom?: string;
  wareHouse?: string; // matches your payload key
  // add other keys if your API returns them (e.g., bin, brand, etc.)
}
@Component({
  selector: 'app-stack-overview-list',
  templateUrl: './stack-overview-list.component.html',
  styleUrls: ['./stack-overview-list.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class StackOverviewListComponent implements OnInit {
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
  constructor(private itemMasterService : ItemMasterService,  private router: Router) { }

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
    // TODO: route to edit screen
    // this.router.navigate(['/inventory/item-master/edit', id]);
    console.log('edit', id);
  }

  /** Create button */


    goToCreateItem(): void {
    this.router.navigate(['/Inventory/create-stackoverview']);
  }
  
}
