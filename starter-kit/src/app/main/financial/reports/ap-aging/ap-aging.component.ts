import { Component, OnInit } from '@angular/core';
import { ApAgingInvoice, ApAgingSummary } from './ap-aging-model';
import { ApAgingService } from './ap-aging-service';
import { SupplierService } from 'app/main/businessPartners/supplier/supplier.service';
import feather from 'feather-icons';

@Component({
  selector: 'app-ap-aging',
  templateUrl: './ap-aging.component.html',
  styleUrls: ['./ap-aging.component.scss']
})
export class APAgingComponent implements OnInit {

  fromDate: string;
  toDate: string;

  rows: ApAgingSummary[] = [];
  filteredRows: ApAgingSummary[] = [];
  detailRows: ApAgingInvoice[] = [];

  supplierOptions: any[] = [];
  selectedSupplierId: number | null = null;

  isLoading = false;
  isDetailOpen = false;
  selectedSupplierName = '';

  // 🔹 NEW: totals for top summary cards
  totalOutstandingAll = 0;
  total0_30 = 0;
  total31_60 = 0;
  total61_90_90Plus = 0;

  constructor(
    private agingService: ApAgingService,
    private _supplierMasterService: SupplierService,
  ) {
    const today = new Date();
    this.toDate = today.toISOString().substring(0, 10);
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    this.fromDate = firstOfMonth.toISOString().substring(0, 10);
  }

  ngOnInit(): void {
    this.loadSummary();
    this.loadSuppliers();
  }

     ngAfterViewInit() {
        feather.replace(); // ✅ Required to render the icons
      }
  
  // 🔹 Load AP aging summary
  loadSummary(): void {
    this.isLoading = true;
    this.agingService.getSummary(this.fromDate, this.toDate).subscribe({
      next: res => {
        this.rows = res.data || [];
        this.isLoading = false;

        // apply filter + recompute totals
        this.applySupplierFilter();
      },
      error: _ => {
        this.isLoading = false;
        this.rows = [];
        this.filteredRows = [];
        this.recalculateTotals();  // clear summary cards
      }
    });
  }

  // 🔹 Load suppliers for dropdown
 // 🔹 Load suppliers for dropdown (normalize to supplierId + name)
loadSuppliers(): void {
  this._supplierMasterService.GetAllSupplier()
    .subscribe((res: any) => {
      const data = res?.data || [];

      this.supplierOptions = data.map((x: any) => ({
        // try all common possibilities and pick one that exists
        supplierId: x.supplierId ?? x.SupplierId ?? x.id ?? x.Id,
        name: x.name ?? x.supplierName ?? x.SupplierName ?? x.Name
      }));
    });
}


  onFilterChange(): void {
    this.loadSummary();
    if (this.isDetailOpen) {
      this.isDetailOpen = false;
      this.detailRows = [];
    }
  }

  private applySupplierFilter(): void {
    if (this.selectedSupplierId == null) {
      this.filteredRows = this.rows;
    } else {
      this.filteredRows = this.rows.filter(
        r => r.supplierId === this.selectedSupplierId
      );
    }

    // 🔹 recompute card totals after filtering
    this.recalculateTotals();
  }

  // 🔹 NEW: calculate totals for cards
  private recalculateTotals(): void {
    const src = this.filteredRows || [];

    this.totalOutstandingAll = src
      .reduce((sum, r) => sum + (r.totalOutstanding || 0), 0);

    this.total0_30 = src
      .reduce((sum, r) => sum + (r.bucket0_30 || 0), 0);

    this.total31_60 = src
      .reduce((sum, r) => sum + (r.bucket31_60 || 0), 0);

    const total61_90 = src
      .reduce((sum, r) => sum + (r.bucket61_90 || 0), 0);

    const total90Plus = src
      .reduce((sum, r) => sum + (r.bucket90Plus || 0), 0);

    this.total61_90_90Plus = total61_90 + total90Plus;
  }

  onSupplierChange(): void {
    this.applySupplierFilter();
    this.isDetailOpen = false;
    this.detailRows = [];
  }

  openDetail(row: ApAgingSummary): void {
    this.selectedSupplierName = row.supplierName;
    this.isDetailOpen = true;

    this.agingService.getSupplierInvoices(
      row.supplierId,
      this.fromDate,
      this.toDate
    ).subscribe(res => {
      this.detailRows = res.data || [];
    });
  }

  closeDetail(): void {
    this.isDetailOpen = false;
    this.detailRows = [];
  }
}
