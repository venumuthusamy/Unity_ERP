import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { CreatePurchaseRequestComponent } from '../create-purchase-request.component';
import { PurchaseService } from 'app/main/purchase/purchase.service';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { ColumnMode, DatatableComponent } from '@swimlane/ngx-datatable';
import * as feather from 'feather-icons';

@Component({
  selector: 'app-purchase-request-list',
  templateUrl: './purchase-request-list.component.html',
  styleUrls: ['./purchase-request-list.component.scss'],
  encapsulation: ViewEncapsulation.None
})

export class PurchaseRequestListComponent implements OnInit {
 @ViewChild(CreatePurchaseRequestComponent) purchaseForm?: CreatePurchaseRequestComponent;
 @ViewChild(DatatableComponent) table: DatatableComponent;
   @ViewChild('tableRowDetails') tableRowDetails: any;
   @ViewChild('SweetAlertFadeIn') SweetAlertFadeIn: any;
 colors = ['bg-light-primary', 'bg-light-success', 'bg-light-danger', 'bg-light-warning', 'bg-light-info'];
 rows: any[] = [];
 tempData: any[] = [];
  public searchValue = '';
  public ColumnMode = ColumnMode;
  public selectedOption = 10;
    purchaseRequests: any[] = []; 
      prHeader: any = {
    requester: '',
    departmentID: 0,
    neededBy: null,
    description: '',
    multiLoc: false,
    oversea: false
  };
showLinesModal = false;
modalLines: any[] = [];
modalTotalQty = 0;
  prLines: any[] = [];
  hover = false;
  constructor(private purchaseService: PurchaseService, private router: Router,) {}
   ngOnInit(): void {
    this.loadRequests();
  }
  filterUpdate(event: any) {
  const val = (event.target.value || '').toLowerCase();

  // reset if empty
  if (!val) {
    this.rows = [...this.tempData];
    this.table.offset = 0;
    return;
  }

  this.rows = this.tempData.filter((d: any) =>
    (d.purchaseRequestNo || '').toLowerCase().includes(val) ||
    (d.requester || '').toLowerCase().includes(val) ||
    (d.departmentName || '').toLowerCase().includes(val) ||
    (d.deliveryDate || '').toLowerCase().includes(val)
  );

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
  this.purchaseService.getAll().subscribe({
    next: (res: any) => {
      const mapped = (res.data || []).map((req: any) => ({
        ...req,
        prLines: req.prLines ? JSON.parse(req.prLines) : []
      }));

      this.rows = mapped;
      this.tempData = [...mapped];   // 🔑 set tempData here
      this.table.offset = 0;
    },
    error: (err: any) => console.error('Error loading list', err)
  });
}


// editRequest(req: any) {
//   this.router.navigate(['/purchases/requisition'], { state: { request: req } });
// }

editRequest(id:any){
  this.router.navigateByUrl(`/purchase/Edit-PurchaseRequest/${id}`)
}

goToRequisition() {
  this.router.navigate(['/purchase/Create-PurchaseRequest']);
}

 deleteRequest(id: number) {
    Swal.fire({
      title: 'Are you sure?',
      text: 'This will permanently delete the purchase request.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        this.purchaseService.delete(id).subscribe({
          next: () => {
            this.loadRequests();
            Swal.fire('Deleted!', 'Purchase request has been deleted.', 'success');
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
 
  rowDetailsToggleExpand(row: any) {
  row.$$expanded = !row.$$expanded; // toggle expand
}
onRowExpandClick(row: any) {
  // Expand/Collapse the row
  this.rowDetailsToggleExpand(row);

  // Show SweetAlert fade-in
  this.SweetAlertFadeIn.fire();
}
openLinesModal(row: any) {
  // Normalize lines (supports array or JSON string)
  let lines: any[] = [];
  try {
    lines = Array.isArray(row?.prLines) ? row.prLines : JSON.parse(row?.prLines || '[]');
  } catch {
    lines = [];
  }

  // Compute total qty
  const total = lines.reduce((sum, l) => sum + (Number(l?.qty) || 0), 0);

  this.modalLines = lines;
  this.modalTotalQty = total;
  this.showLinesModal = true;
}

closeLinesModal() {
  this.showLinesModal = false;
}
ngAfterViewChecked(): void {
     feather.replace();  // remove the guard so icons refresh every cycle
   }
   ngAfterViewInit(): void {
     feather.replace();
   }
}
