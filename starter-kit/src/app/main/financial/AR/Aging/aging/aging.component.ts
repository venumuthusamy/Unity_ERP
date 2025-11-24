import { Component, OnInit } from '@angular/core';
import { ArAgingInvoice, ArAgingSummary } from './aging-model';
import { ArAgingService } from '../aging-service';


@Component({
  selector: 'app-aging',
  templateUrl: './aging.component.html',
  styleUrls: ['./aging.component.scss']
})
export class AgingComponent implements OnInit {


  
  asOfDate: string = new Date().toISOString().substring(0, 10);

  rows: ArAgingSummary[] = [];
  detailRows: ArAgingInvoice[] = [];

  isLoading = false;
  isDetailOpen = false;
  selectedCustomerName = '';

  constructor(private agingService: ArAgingService) {}

  ngOnInit(): void {
    this.loadSummary();
  }

  loadSummary(): void {
    this.isLoading = true;
    this.agingService.getSummary(this.asOfDate).subscribe({
      next: res => {
        this.rows = res.data || [];
        this.isLoading = false;
      },
      error: _ => (this.isLoading = false)
    });
  }

  onDateChange(): void {
    this.loadSummary();
    if (this.isDetailOpen) {
      this.isDetailOpen = false;
      this.detailRows = [];
    }
  }

  openDetail(row: ArAgingSummary): void {
    this.selectedCustomerName = row.customerName;
    this.isDetailOpen = true;

    this.agingService.getCustomerInvoices(row.customerId, this.asOfDate)
      .subscribe(res => {
        this.detailRows = res.data || [];
      });
  }

  closeDetail(): void {
    this.isDetailOpen = false;
    this.detailRows = [];
  }

}



