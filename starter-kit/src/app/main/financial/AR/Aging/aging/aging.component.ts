import { Component, OnInit } from '@angular/core';
import { ArAgingInvoice, ArAgingSummary } from './aging-model';
import { ArAgingService } from '../aging-service';


@Component({
  selector: 'app-aging',
  templateUrl: './aging.component.html',
  styleUrls: ['./aging.component.scss']
})
export class AgingComponent implements OnInit {



  fromDate: string;
  toDate: string;

  rows: ArAgingSummary[] = [];
  detailRows: ArAgingInvoice[] = [];

  isLoading = false;
  isDetailOpen = false;
  selectedCustomerName = '';

  constructor(private agingService: ArAgingService) {
    const today = new Date();
    this.toDate = today.toISOString().substring(0, 10);

    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    this.fromDate = firstOfMonth.toISOString().substring(0, 10);
  }

  ngOnInit(): void {
    this.loadSummary();
  }

  loadSummary(): void {
    this.isLoading = true;
    this.agingService.getSummary(this.fromDate, this.toDate).subscribe({
      next: res => {
        this.rows = res.data || [];
        this.isLoading = false;
      },
      error: _ => (this.isLoading = false)
    });
  }

  onFilterChange(): void {
    this.loadSummary();
    if (this.isDetailOpen) {
      this.isDetailOpen = false;
      this.detailRows = [];
    }
  }

  openDetail(row: ArAgingSummary): void {
    this.selectedCustomerName = row.customerName;
    this.isDetailOpen = true;

    this.agingService.getCustomerInvoices(row.customerId, this.fromDate, this.toDate)
      .subscribe(res => {
        this.detailRows = res.data || [];
      });
  }

  closeDetail(): void {
    this.isDetailOpen = false;
    this.detailRows = [];
  }

}



