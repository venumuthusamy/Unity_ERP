import { Component, OnInit, AfterViewInit } from '@angular/core';
import { ArAgingInvoice, ArAgingSummary } from './aging-model';
import { ArAgingService } from '../aging-service';
import { CustomerMasterService } from 'app/main/businessPartners/customer-master/customer-master.service';
import feather from 'feather-icons';

@Component({
  selector: 'app-aging',
  templateUrl: './aging.component.html',
  styleUrls: ['./aging.component.scss']
})
export class AgingComponent implements OnInit, AfterViewInit {

  fromDate: string;
  toDate: string;

  rows: ArAgingSummary[] = [];
  filteredRows: ArAgingSummary[] = [];
  detailRows: ArAgingInvoice[] = [];

  customerOptions: any[] = [];
  selectedCustomerId: number | null = null;

  isLoading = false;
  isDetailOpen = false;
  selectedCustomerName = '';

  totalOutstandingAll = 0;
  total0_30 = 0;
  total31_60 = 0;
  total61_90_90Plus = 0;

  constructor(
    private agingService: ArAgingService,
    private _customerMasterService: CustomerMasterService
  ) {
    const today = new Date();
    this.toDate = today.toISOString().substring(0, 10);
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    this.fromDate = firstOfMonth.toISOString().substring(0, 10);
  }

  ngOnInit(): void {
    this.loadSummary();
    this.loadCustomers();
  }

  ngAfterViewInit(): void {
    // first pass, in case anything is already visible
    feather.replace();
  }

  // load aging summary
  loadSummary(): void {
    this.isLoading = true;
    this.agingService.getSummary(this.fromDate, this.toDate).subscribe({
      next: res => {
        this.rows = res.data || [];
        this.isLoading = false;

        this.applyCustomerFilter();

        // 🔹 run after Angular has rendered the *ngIf block
        setTimeout(() => feather.replace(), 0);
      },
      error: _ => {
        this.isLoading = false;
        this.rows = [];
        this.filteredRows = [];
        this.recalculateTotals(); // clear cards

        setTimeout(() => feather.replace(), 0);
      }
    });
  }

  // rest of your code unchanged...
  loadCustomers(): void {
    this._customerMasterService.GetAllCustomerDetails()
      .subscribe((res: any) => {
        this.customerOptions = res.data || [];
      });
  }

  onFilterChange(): void {
    this.loadSummary();
    if (this.isDetailOpen) {
      this.isDetailOpen = false;
      this.detailRows = [];
    }
  }

  private applyCustomerFilter(): void {
    if (this.selectedCustomerId == null) {
      this.filteredRows = this.rows;
    } else {
      this.filteredRows = this.rows.filter(
        r => r.customerId === this.selectedCustomerId
      );
    }
    this.recalculateTotals();
  }

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

  onCustomerChange(): void {
    this.applyCustomerFilter();
    this.isDetailOpen = false;
    this.detailRows = [];
    setTimeout(() => feather.replace(), 0);
  }

  openDetail(row: ArAgingSummary): void {
    this.selectedCustomerName = row.customerName;
    this.isDetailOpen = true;

    this.agingService.getCustomerInvoices(
      row.customerId,
      this.fromDate,
      this.toDate
    )
    .subscribe(res => {
      this.detailRows = res.data || [];
      setTimeout(() => feather.replace(), 0);
    });
  }

  closeDetail(): void {
    this.isDetailOpen = false;
    this.detailRows = [];
  }
}
