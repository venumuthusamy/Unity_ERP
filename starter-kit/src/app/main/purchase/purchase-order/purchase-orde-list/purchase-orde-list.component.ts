import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { ColumnMode, DatatableComponent } from '@swimlane/ngx-datatable';
import { CoreSidebarService } from '@core/components/core-sidebar/core-sidebar.service';
import { POService } from '../purchase-order.service';
import { DatePipe } from '@angular/common';
import * as feather from 'feather-icons';
import { POTempService } from '../purchase-order-temp.service';
@Component({
  selector: 'app-purchase-orde-list',
  templateUrl: './purchase-orde-list.component.html',
  styleUrls: ['./purchase-orde-list.component.scss'],
  encapsulation: ViewEncapsulation.None,
  providers: [DatePipe]
})
export class PurchaseOrdeListComponent implements OnInit {

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

  constructor(private poService: POService, private router: Router,
    private _coreSidebarService: CoreSidebarService, private datePipe: DatePipe,
    private poTempService: POTempService,
  ) { }
  ngOnInit(): void {
    this.loadRequests();
     this.loadDrafts();  
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
    this.poService.getPO().subscribe({
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
    this.router.navigateByUrl(`/purchase/edit-purchaseorder/${row.id}`)
  }

  deletePO(id: number) {
    Swal.fire({
      title: 'Are you sure?',
      text: 'This will permanently delete the PO.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        this.poService.deletePO(id).subscribe({
          next: () => {
            this.loadRequests();
            Swal.fire('Deleted!', 'PO has been deleted.', 'success');
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
    this.router.navigate(['/purchase/create-purchaseorder']);

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

   openDraftsModal() {
    this.showDraftsModal = true;
    this.loadDrafts();
  }
  closeDraftsModal() {
    this.showDraftsModal = false;
  }

  loadDrafts() {
    // optionally pass createdBy (current user) if you filter server-side
    this.poTempService.getPODrafts().subscribe({
      next: (res: any) => {
        this.drafts = res?.data || [];
      },
      error: (err) => console.error('Error loading PO drafts', err)
    });
  }

  openDraft(d: any) {
    // Navigate to the create page with a query param draftId
    this.router.navigate(['/purchase/create-purchaseorder'], { queryParams: { draftId: d.id } });
    this.closeDraftsModal();
  }

  deleteDraft(id: number) {
    Swal.fire({
      title: 'Delete draft?',
      text: 'This draft will be permanently removed.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#dc2626'
    }).then(res => {
      if (res.isConfirmed) {
        this.poTempService.deletePODraft(id).subscribe({
          next: () => {
            this.loadDrafts();
            Swal.fire('Deleted', 'Draft removed', 'success');
          },
          error: (err) => console.error('Error deleting draft', err)
        });
      }
    });
  }

}



