import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { ColumnMode, DatatableComponent } from '@swimlane/ngx-datatable';
import Swal from 'sweetalert2';
import { SupplierInvoiceService } from '../supplier-invoice.service';
import { PurchaseGoodreceiptService } from '../../purchase-goodreceipt/purchase-goodreceipt.service';

@Component({
  selector: 'app-supplier-invoice-list',
  templateUrl: './supplier-invoice-list.component.html',
  styleUrls: ['./supplier-invoice-list.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SupplierInvoiceListComponent implements OnInit {
  @ViewChild(DatatableComponent) table!: DatatableComponent;

  rows: any[] = [];
  tempData: any[] = [];
  searchValue = '';
  ColumnMode = ColumnMode;
  selectedOption = 10;

  // modal
  showLinesModal = false;
  modalLines: any[] = [];
  modalTotalQty = 0;
  modalTotalAmt = 0;

  constructor(
    private api: SupplierInvoiceService,
    private router: Router,
    private grnService: PurchaseGoodreceiptService
  ) {}

  ngOnInit(): void {
    this.loadInvoices();
  }

  loadInvoices() {
    this.api.getAll().subscribe({
      next: (res: any) => {
        const data = res?.data || res || [];
        const mapped = data.map((x: any) => ({
          id: x.id,
          invoiceNo: x.invoiceNo,
          invoiceDate: x.invoiceDate,
          amount: x.amount,
          tax: x.tax,
          currency: x.currency || 'SGD',
          status: x.status ?? 0,
          linesJson: x.linesJson || '[]'
        }));
        this.rows = mapped;
        this.tempData = [...mapped];
        if (this.table) this.table.offset = 0;
      },
      error: (e) => console.error(e)
    });
  }

  filterUpdate(event: any) {
    const val = (event?.target?.value || '').toLowerCase();

    if (!val) {
      this.rows = [...this.tempData];
      if (this.table) this.table.offset = 0;
      return;
    }

    const matches = (d: any) =>
      (d.invoiceNo || '').toLowerCase().includes(val) ||
      (d.currency || '').toLowerCase().includes(val) ||
      (d.amount || '').toLowerCase().includes(val) ||
      this.statusText(d.status).toLowerCase().includes(val) ||
      (d.invoiceDate ? new Date(d.invoiceDate).toLocaleDateString() : '').toLowerCase().includes(val);

    this.rows = this.tempData.filter(matches);
    if (this.table) this.table.offset = 0;
  }

  statusText(s: number) {
    return s === 0 ? 'Draft' : s === 1 ? 'Hold' : s === 2 ? 'Posted' : 'Unknown';
  }

  goToCreate() { this.router.navigate(['/purchase/Create-SupplierInvoice']); }
  editInvoice(id: number) { this.router.navigate(['/purchase/Edit-SupplierInvoice', id]); }

deleteInvoice(id: number) {
  Swal.fire({
    title: 'Are you sure?',
    text: 'This will permanently delete the supplier invoice.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Yes, delete it!'
  }).then((result) => {
    if (result.isConfirmed) {
      this.api.delete(id).subscribe({
        next: () => {
          this.loadInvoices();
          Swal.fire('Deleted!', 'Supplier invoice has been deleted.', 'success');
        },
        error: (err) => console.error('Error deleting invoice', err)
      });
    }
  });
}



  openLinesModal(row: any) {
    let lines: any[] = [];
    try { lines = JSON.parse(row?.linesJson || '[]'); } catch { lines = []; }

    this.modalLines = lines;
    this.modalTotalQty = lines.reduce((s, l) => s + (Number(l?.qty) || 0), 0);
    this.modalTotalAmt = lines.reduce((s, l) => s + (Number(l?.qty) || 0) * (Number(l?.price) || 0), 0);
    this.showLinesModal = true;
  }

  closeLinesModal() { this.showLinesModal = false; }
 
}
