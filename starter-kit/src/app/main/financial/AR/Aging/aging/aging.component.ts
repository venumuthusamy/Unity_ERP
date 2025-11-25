import { Component, OnInit } from '@angular/core';
import { ArAgingInvoice, ArAgingSummary } from './aging-model';
import { ArAgingService } from '../aging-service';
import { CustomerMasterService } from 'app/main/businessPartners/customer-master/customer-master.service';

@Component({
  selector: 'app-aging',
  templateUrl: './aging.component.html',
  styleUrls: ['./aging.component.scss']
})
export class AgingComponent implements OnInit {

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

  // 🔹 load aging summary
  loadSummary(): void {
    this.isLoading = true;
    this.agingService.getSummary(this.fromDate, this.toDate).subscribe({
      next: res => {
        this.rows = res.data || [];
        this.isLoading = false;

        // re-apply customer filter whenever new data comes
        this.applyCustomerFilter();
      },
      error: _ => {
        this.isLoading = false;
        this.rows = [];
        this.filteredRows = [];
      }
    });
  }

  // 🔹 load customers only once for dropdown
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
  }

  onCustomerChange(): void {
    this.applyCustomerFilter();
    this.isDetailOpen = false;
    this.detailRows = [];
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
    });
  }

  closeDetail(): void {
    this.isDetailOpen = false;
    this.detailRows = [];
  }
}
