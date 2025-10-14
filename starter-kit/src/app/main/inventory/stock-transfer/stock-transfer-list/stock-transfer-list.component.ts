import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { ColumnMode, DatatableComponent } from '@swimlane/ngx-datatable';
import { DatePipe } from '@angular/common';
import * as feather from 'feather-icons';
import { StockTransferService } from '../stock-transfer.service';

@Component({
  selector: 'app-stock-transfer-list',
  templateUrl: './stock-transfer-list.component.html',
  styleUrls: ['./stock-transfer-list.component.scss'],
  encapsulation: ViewEncapsulation.None,
  providers: [DatePipe]
})
export class StockTransferListComponent implements OnInit {

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



  constructor(private stockTransferService: StockTransferService, private router: Router,
    private datePipe: DatePipe,
  ) { }
  ngOnInit(): void {
    this.loadRequests();
  }
  filterUpdate(event) {

    const val = event.target.value.toLowerCase();
    const temp = this.tempData.filter((d) => {

      if (d.fromWarehouse.toLowerCase().indexOf(val) !== -1 || !val) {
        return d.fromWarehouse.toLowerCase().indexOf(val) !== -1 || !val;
      }
      if (d.toWarehouse.toLowerCase().indexOf(val) !== -1 || !val) {
        return d.toWarehouse.toLowerCase().indexOf(val) !== -1 || !val;
      }
      if (d.reason.toLowerCase().indexOf(val) !== -1 || !val) {
        return d.reason.toLowerCase().indexOf(val) !== -1 || !val;
      }
      if (d.approvalStatus.toLowerCase().indexOf(val) !== -1 || !val) {
        return d.approvalStatus.toLowerCase().indexOf(val) !== -1 || !val;
      }

    });
    this.rows = temp;
    this.table.offset = 0;
  }
 
  loadRequests() {
    this.stockTransferService.getStockTransfer().subscribe({
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


  editStockTransfer(row: any) {
    this.router.navigateByUrl(`/Inventory/edit-stocktransfer/${row.id}`)
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
    }).then((result) => {
      if (result.isConfirmed) {
        this.stockTransferService.deleteStockTransfer(id).subscribe({
          next: () => {
            this.loadRequests();
            Swal.fire('Deleted!', 'Stock Transfer has been deleted.', 'success');
          },
          error: (err) => console.error('Error deleting request', err)
        });
      }
    });
  }

  openCreate() {
    this.passData = {};
    this.router.navigate(['/Inventory/create-stocktransfer']);

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





