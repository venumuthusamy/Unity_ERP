import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { ColumnMode, DatatableComponent } from '@swimlane/ngx-datatable';
import { CoreSidebarService } from '@core/components/core-sidebar/core-sidebar.service';
import { POService } from '../purchase-order.service';
import { DatePipe } from '@angular/common';

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

  constructor(private poService: POService, private router: Router,
    private _coreSidebarService: CoreSidebarService,private datePipe: DatePipe
  ) { }
  ngOnInit(): void {
    this.loadRequests();
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

}



