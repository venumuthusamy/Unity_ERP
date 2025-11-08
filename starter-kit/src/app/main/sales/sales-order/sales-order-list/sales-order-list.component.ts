import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { ColumnMode, DatatableComponent } from '@swimlane/ngx-datatable';
import { DatePipe } from '@angular/common';
import * as feather from 'feather-icons';
import { forkJoin } from 'rxjs';
import { SalesOrderService } from '../sales-order.service';

@Component({
  selector: 'app-sales-order-list',
  templateUrl: './sales-order-list.component.html',
  styleUrls: ['./sales-order-list.component.scss'],
  encapsulation: ViewEncapsulation.None,
  providers: [DatePipe]
})
export class SalesOrderListComponent implements OnInit {


  @ViewChild(DatatableComponent) table: DatatableComponent;
  @ViewChild('tableRowDetails') tableRowDetails: any;
  @ViewChild('SweetAlertFadeIn') SweetAlertFadeIn: any;
  colors = ['bg-light-primary', 'bg-light-success', 'bg-light-danger', 'bg-light-warning', 'bg-light-info'];
  rows: any[] = [];
  tempData: any[] = [];
  public searchValue = '';
  public ColumnMode = ColumnMode;
  public selectedOption = 10;
  hover = false;
  passData: any;
  showLinesModal = false;
  modalLines: any[] = [];
  modalTotal: any;
  showDraftsModal = false;
  drafts: any[] = [];

  showReorderModal = false;
  reorderAll: any[] = [];     // unfiltered master list (isReorder only)
  reorderRows: any[] = [];    // filtered by search
  reorderSearch = '';
  reorderCount = 0;          // available reorder PRs (not used in any PO)

  constructor(private salesOrderService: SalesOrderService, private router: Router,
    private datePipe: DatePipe,
  ) { }
  ngOnInit(): void {
    this.loadRequests();
  }
  get displayReorderCount() {
    return this.reorderCount > 99 ? '99+' : this.reorderCount;
  }
  filterUpdate(event) {

    const val = event.target.value.toLowerCase();
    const temp = this.tempData.filter((d) => {

      const poDate = this.datePipe.transform(d.poDate, 'dd-MM-yyyy')?.toLowerCase() || '';
      const deliveryDate = this.datePipe.transform(d.deliveryDate, 'dd-MM-yyyy')?.toLowerCase() || '';

      if (d.purchaseOrderNo.toLowerCase().indexOf(val) !== -1 || !val) {
        return d.purchaseOrderNo.toLowerCase().indexOf(val) !== -1 || !val;
      }
      if (d.supplierName.toLowerCase().indexOf(val) !== -1 || !val) {
        return d.supplierName.toLowerCase().indexOf(val) !== -1 || !val;
      }
      if (d.currencyName.toLowerCase().indexOf(val) !== -1 || !val) {
        return d.currencyName.toLowerCase().indexOf(val) !== -1 || !val;
      }
      if (d.approvalStatus.toLowerCase().indexOf(val) !== -1 || !val) {
        return d.approvalStatus.toLowerCase().indexOf(val) !== -1 || !val;
      }
      if (poDate.includes(val) || !val) return true;
      if (deliveryDate.includes(val) || !val) return true;

    });
    this.rows = temp;
    this.table.offset = 0;
  }
  getRandomColor(index: number): string {
    return this.colors[index % this.colors.length];
  }


  getInitial(orgName: string): string {
    // Get the first two characters, or the entire string if it's shorter
    const initials = orgName.slice(0, 2).toUpperCase();
    return initials;
  }
  loadRequests() {
    this.salesOrderService.getSO().subscribe({
      next: (res: any) => {
        this.rows = res.data.map((req: any) => {
          return {
            ...req,
          };
        });
        this.tempData = this.rows
      },
      error: (err: any) => console.error('Error loading list', err)
    });
  }


  editPO(row: any) {
    this.router.navigateByUrl(`/sales/edit-sales/${row.id}`)
  }

  deletePO(id: number) {
    Swal.fire({
      title: 'Are you sure?',
      text: 'This will permanently delete the Sales Order.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        this.salesOrderService.deleteSO(id).subscribe({
          next: () => {
            this.loadRequests();
            Swal.fire('Deleted!', 'Sales Order has been deleted.', 'success');
          },
          error: (err) => console.error('Error deleting request', err)
        });
      }
    });
  }
  toggleLines(req: any) {
    // Toggle showLines only for the clicked PR
    req.showLines = !req.showLines;
  }
  onRowExpandClick(row: any) {
    // Expand/Collapse the row
    this.rowDetailsToggleExpand(row);

    // Show SweetAlert fade-in
    this.SweetAlertFadeIn.fire();
  }
  rowDetailsToggleExpand(row: any) {
    row.$$expanded = !row.$$expanded; // toggle expand
  }
  openCreate() {
    this.passData = {};
    this.router.navigate(['/Sales/Sales-Order-create']);

  }

  openLinesModal(row: any) {
    debugger
    // Normalize lines (supports array or JSON string)
    let lines: any[] = [];
    try {
      lines = Array.isArray(row?.poLines) ? row.poLines : JSON.parse(row?.poLines || '[]');
    } catch {
      lines = [];
    }

    // Compute total 
    const total = lines.reduce((sum, l) => sum + (Number(l?.total) || 0), 0);

    this.modalLines = lines;
    this.modalTotal = total;
    this.showLinesModal = true;
  }

  closeLinesModal() {
    this.showLinesModal = false;
  }
  isRowLocked(row: any): boolean {
    const v = row?.approvalStatus ?? row?.ApprovalStatus ?? row?.status;
    if (v == null) return false;

    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      return s === 'approved' || s === 'rejected';
    }

    // If you use numeric enums, map them here:
    // e.g. 1=Pending, 2=Approved, 3=Rejected  (adjust to your app)
    const code = Number(v);
    return [2, 3].includes(code);
  }
  ngAfterViewChecked(): void {
    feather.replace();  // remove the guard so icons refresh every cycle
  }
  ngAfterViewInit(): void {
    feather.replace();
  }

}






