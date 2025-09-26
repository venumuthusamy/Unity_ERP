import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { CreatePurchaseRequestComponent } from '../create-purchase-request/create-purchase-request.component';
import { PurchaseService } from '../purchase.service';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { ColumnMode, DatatableComponent } from '@swimlane/ngx-datatable';


@Component({
  selector: 'app-purchase-request-list',
  templateUrl: './purchase-request-list.component.html',
  styleUrls: ['./purchase-request-list.component.scss'],
  encapsulation: ViewEncapsulation.None
})

export class PurchaseRequestListComponent implements OnInit {
 @ViewChild(CreatePurchaseRequestComponent) purchaseForm?: CreatePurchaseRequestComponent;
 @ViewChild(DatatableComponent) table: DatatableComponent;
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

  prLines: any[] = [];
  hover = false;
  constructor(private purchaseService: PurchaseService, private router: Router,) {}
   ngOnInit(): void {
    this.loadRequests();
  }
  filterUpdate(event) {

    const val = event.target.value.toLowerCase();
    const temp = this.tempData.filter(function (d) {

      if (d.orgName.toLowerCase().indexOf(val) !== -1 || !val) {
        return d.orgName.toLowerCase().indexOf(val) !== -1 || !val;
      }
      if (d.orgCode.toLowerCase().indexOf(val) !== -1 || !val) {
        return d.orgCode.toLowerCase().indexOf(val) !== -1 || !val;
      }

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
    this.purchaseService.getAll().subscribe({
      next: (res: any) => {
        this.rows = res.data.map((req: any) => {
          return {
            ...req,
            prLines: req.prLines ? JSON.parse(req.prLines) : []
          };
        });
      },
      error: (err: any) => console.error('Error loading list', err)
    });
  }
// editRequest(req: any) {
//   this.router.navigate(['/purchases/requisition'], { state: { request: req } });
// }

editRequest(id:any){
  this.router.navigateByUrl(`/purchases/requisition/edit/${id}`)
}

goToRequisition() {
  this.router.navigate(['/purchases/requisition']);
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
}
