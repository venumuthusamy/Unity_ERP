import {
  Component,
  OnInit,
  ViewChild,
  ViewEncapsulation,
  AfterViewInit,
  AfterViewChecked
} from '@angular/core';
import { Router } from '@angular/router';
import { ColumnMode, DatatableComponent } from '@swimlane/ngx-datatable';
import Swal from 'sweetalert2';
import { SupplierInvoiceService } from '../supplier-invoice.service';
import * as feather from 'feather-icons';

interface ThreeWayMatch {
  poId: number;
  poNo: string;
  poQty: number;
  poPrice: number;
  poTotal: number;

  grnId: number;
  grnNo: string;
  grnReceivedQty: number;
  grnVarianceQty: number;
  grnStatus: string;

  pinId: number;
  pinNo: string;
  pinQty: number;
  pinTotal: number;

  pinMatch: boolean; // true = match, false = mismatch
}

@Component({
  selector: 'app-supplier-invoice-list',
  templateUrl: './supplier-invoice-list.component.html',
  styleUrls: ['./supplier-invoice-list.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SupplierInvoiceListComponent
  implements OnInit, AfterViewInit, AfterViewChecked {
  @ViewChild(DatatableComponent) table!: DatatableComponent;

  rows: any[] = [];
  tempData: any[] = [];
  searchValue = '';
  ColumnMode = ColumnMode;
  selectedOption = 10;

  // lines modal
  showLinesModal = false;
  modalLines: any[] = [];
  modalTotalQty = 0;
  modalTotalAmt = 0;

  // 3-way match modal
  showMatchModal = false;
  currentRow: any = null;
  threeWay: ThreeWayMatch | null = null;
  isPosting = false;

  constructor(
    private api: SupplierInvoiceService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadInvoices();
  }

  ngAfterViewInit(): void {
    feather.replace();
  }

  ngAfterViewChecked(): void {
    feather.replace();
  }

  loadInvoices(): void {
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
          status: Number(x.status ?? 0),
          linesJson: x.linesJson || '[]'
        }));
        this.rows = mapped;
        this.tempData = [...mapped];
        if (this.table) this.table.offset = 0;
      },
      error: (e) => console.error(e)
    });
  }

  filterUpdate(event: any): void {
    const val = (event?.target?.value || '').toLowerCase();

    if (!val) {
      this.rows = [...this.tempData];
      if (this.table) this.table.offset = 0;
      return;
    }

    const matches = (d: any) =>
      (d.invoiceNo || '').toLowerCase().includes(val) ||
      (d.currency || '').toLowerCase().includes(val) ||
      String(d.amount || '').toLowerCase().includes(val) ||
      this.statusText(d.status).toLowerCase().includes(val) ||
      (d.invoiceDate
        ? new Date(d.invoiceDate).toLocaleDateString().toLowerCase()
        : ''
      ).includes(val);

    this.rows = this.tempData.filter(matches);
    if (this.table) this.table.offset = 0;
  }

  // 0=Draft, 1=Hold, 2=Flagged, 3=Posted to A/P
  statusText(s: number): string {
    return s === 0
      ? 'Draft'
      : s === 1
      ? 'Hold'
      : s === 2
      ? 'Flagged'
      : s === 3
      ? 'Posted to A/P'
      : 'Unknown';
  }

  goToCreate(): void {
    this.router.navigate(['/purchase/Create-SupplierInvoice']);
  }

  editInvoice(id: number): void {
    this.router.navigate(['/purchase/Edit-SupplierInvoice', id]);
  }

  deleteInvoice(id: number): void {
    Swal.fire({
      title: 'Are you sure?',
      text: 'This will permanently delete the supplier invoice.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!',
      customClass: {
        confirmButton:
          'px-2 py-1 text-xs rounded-md text-white bg-red-600 hover:bg-red-700 mx-1',
        cancelButton:
          'px-2 py-1 text-xs rounded-md text-white bg-blue-600 hover:bg-blue-700 mx-1'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.api.delete(id).subscribe({
          next: () => {
            this.loadInvoices();
            Swal.fire(
              'Deleted!',
              'Supplier invoice has been deleted.',
              'success'
            );
          },
          error: (err) => console.error('Error deleting invoice', err)
        });
      }
    });
  }

  // lines modal
  openLinesModal(row: any): void {
    let lines: any[] = [];
    try {
      lines = JSON.parse(row?.linesJson || '[]');
    } catch {
      lines = [];
    }

    this.modalLines = lines;
    this.modalTotalQty = lines.reduce(
      (s, l) => s + (Number(l?.qty) || 0),
      0
    );
    this.modalTotalAmt = lines.reduce(
      (s, l) => s + (Number(l?.qty) || 0) * (Number(l?.price) || 0),
      0
    );
    this.showLinesModal = true;
  }

  closeLinesModal(): void {
    this.showLinesModal = false;
  }

  // 3-way match modal
  openMatchModal(row: any): void {
    this.currentRow = row;
    this.showMatchModal = true;
    this.threeWay = null;

   this.api.getThreeWayMatch(row.id).subscribe({
  next: (res: any) => {
    const d = res?.data || res || null;
    if (!d) {
      this.threeWay = null;
      return;
    }

    this.threeWay = {
      ...d,
      pinMatch: !!(d.pinMatch ?? d.PinMatch)   // force to boolean
    };
  },
  error: (err) => {
    console.error('Error loading 3-way match', err);
    this.showMatchModal = false;
    Swal.fire('Error', 'Unable to load 3-way match details.', 'error');
  }
});

  }

  closeMatchModal(): void {
    this.showMatchModal = false;
    this.currentRow = null;
    this.threeWay = null;
    this.isPosting = false;
  }

  // Status 2 = Flagged
  flagForReview(): void {
    if (!this.currentRow) return;

    this.isPosting = true;
    this.api.flagForReview(this.currentRow.id).subscribe({
      next: () => {
        this.currentRow.status = 2;
        this.isPosting = false;
        this.closeMatchModal();
        this.loadInvoices();
        Swal.fire('Updated', 'Invoice flagged for review.', 'success');
      },
      error: (err) => {
        console.error('Flag review failed', err);
        this.isPosting = false;
        Swal.fire('Error', 'Failed to flag for review.', 'error');
      }
    });
  }
// NEW: navigate to Debit Note create screen with this PIN
goToDebitNote(): void {
  if (!this.currentRow) { return; }

  this.router.navigate(['/purchase/create-debitnote'], {
    queryParams: {
      pinId: this.currentRow.id
    }
  });

  this.closeMatchModal();
}

  // Status 3 = Posted to A/P
  approveAndPostToAp(): void {
    if (!this.currentRow) return;

    this.isPosting = true;
    this.api.postToAp(this.currentRow.id).subscribe({
      next: () => {
        this.currentRow.status = 3;
        this.isPosting = false;
        this.closeMatchModal();
        this.loadInvoices();
        Swal.fire('Posted', 'Invoice posted to A/P.', 'success');
      },
      error: (err) => {
        console.error('Post to A/P failed', err);
        this.isPosting = false;
        Swal.fire('Error', 'Failed to post to A/P.', 'error');
      }
    });
  }
}
