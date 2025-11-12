import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { ApiResponse, SalesInvoiceService } from '../sales-invoice.service';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
type SiListRow = {
  id: number;
  invoiceNo: string;
  invoiceDate: string | Date;
  sourceType: 1 | 2;    // 1=SO, 2=DO
  sourceRef?: string;
  total: number;
};

type SiLine = {
  id: number;
  siId: number;
  sourceType: number;
  sourceLineId?: number | null;
  itemId?: number | null;
  itemName?: string | null;
  uom?: string | null;
  qty: number;
  unitPrice: number;
  discountPct: number;
  taxCodeId?: number | null;
  currencyId?: number | null;
};
@Component({
  selector: 'app-salesinvoicelist',
  templateUrl: './salesinvoicelist.component.html',
  styleUrls: ['./salesinvoicelist.component.scss'],
  encapsulation:ViewEncapsulation.None
})
export class SalesinvoicelistComponent implements OnInit {
rows: SiListRow[] = [];
  temp: SiListRow[] = [];         // unfiltered copy for ngx-datatable filtering

  // paging / search
  selectedOption = 10;
  searchValue = '';

  // modal
  showLinesModal = false;
  activeSi: SiListRow | null = null;
  modalLines: SiLine[] = [];
  modalGrand = 0;

  loading = false;

  constructor(
    private si: SalesInvoiceService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadList();
  }

  /** Calls controller: GET /salesinvoice/List */
  loadList(): void {
    this.loading = true;
    this.si.list().subscribe({
      next: (res: ApiResponse) => {
        this.loading = false;
        const payload = Array.isArray(res?.data?.items) ? res.data.items : res.data;
        const mapped: SiListRow[] = (payload || []).map((x: any) => ({
          id: x.id,
          invoiceNo: x.invoiceNo || '',
          invoiceDate: x.invoiceDate,
          sourceType: (x.sourceType || 1) as 1|2,
          sourceRef: x.sourceRef || '',
          total: Number(x.total || 0)
        }));
        this.rows = this.temp = mapped;
      },
      error: _ => { this.loading = false; this.rows = this.temp = []; }
    });
  }

  // ---- Filters / paging (same pattern as your DO list) ----
  filterUpdate(_: Event): void {
    const val = (this.searchValue || '').toLowerCase();
    // filter our data
    const filtered = this.temp.filter(d =>
      (d.invoiceNo || '').toLowerCase().includes(val) ||
      (d.sourceRef || '').toLowerCase().includes(val)
    );
    this.rows = filtered;
  }

  onLimitChange(e: Event): void {
    const t = e.target as HTMLSelectElement;
    this.selectedOption = +t.value;
  }

  // ---- Row actions ----
  goToCreate() { 
    debugger
    this.router.navigate(['/Sales/sales-Invoice-create']); }
  edit(id: number) { this.router.navigate(['/Sales/sales-invoice/edit', id]); }
  print(id: number) { this.router.navigate(['/sales/sales-invoice/print', id]); }
 delete(id: number) {
  Swal.fire({
    title: 'Delete this invoice?',
    text: 'This action cannot be undone.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, delete',
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#d33',
    cancelButtonColor: '#6b7280',
    reverseButtons: true,
  }).then(result => {
    if (!result.isConfirmed) return;

    // Optional: show a small loading state
    Swal.fire({
      title: 'Deleting…',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    this.si.delete(id).subscribe({
      next: _ => {
        Swal.fire({
          icon: 'success',
          title: 'Deleted',
          text: 'Invoice has been deleted.'
        });
        this.loadList(); // refresh table
      },
      error: _ => {
        Swal.fire({
          icon: 'error',
          title: 'Delete failed',
          text: 'Something went wrong while deleting the invoice.'
        });
      }
    });
  });
}


  // ---- Modal for lines (uses GET /salesinvoice/{id}) ----
  openLinesModal(row: SiListRow) {
    this.activeSi = row;
    this.showLinesModal = true;
    this.modalLines = [];
    this.modalGrand = 0;

    this.si.get(row.id).subscribe((res: ApiResponse) => {
      const lines = res?.data?.lines || [];
      this.modalLines = lines;
      this.modalGrand = lines.reduce((sum: number, l: SiLine) => sum + this.lineTotal(l), 0);
    });
  }

  closeLinesModal() {
    this.showLinesModal = false;
    this.activeSi = null;
    this.modalLines = [];
    this.modalGrand = 0;
  }

  lineTotal(l: SiLine): number {
    const base = (l.qty || 0) * (l.unitPrice || 0);
    const disc = (l.discountPct || 0) / 100;
    return base * (1 - disc);
  }

  sourceLabel(st: 1|2) { return st === 1 ? 'SO' : 'DO'; }
}

