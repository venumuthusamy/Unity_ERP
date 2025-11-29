import { Component, OnInit } from '@angular/core';
import {
  ArCollectionForecastDetail,
  ArCollectionForecastInvoiceRow,
  ArCollectionForecastSummary
} from './collection-forecast-model';
import { ArCollectionForecastService } from './collection-forecast-service';
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';

type NumericField =
  | 'bucket0_7'
  | 'bucket8_14'
  | 'bucket15_30'
  | 'bucket30Plus'
  | 'totalOutstanding';

@Component({
  selector: 'app-collection-forecast',
  templateUrl: './collection-forecast.component.html',
  styleUrls: ['./collection-forecast.component.scss']
})
export class CollectionForecastComponent implements OnInit {

  rows: ArCollectionForecastSummary[] = [];
  filteredRows: ArCollectionForecastSummary[] = [];
  invoiceRows: ArCollectionForecastInvoiceRow[] = [];

  // filters
  fromDate: string | null = null;
  toDate: string | null = null;
  customerOptions: { customerId: number; customerName: string }[] = [];
  selectedCustomerId: number | null = null;
  selectedBucket: 'ALL' | '0-7' | '8-14' | '15-30' | '30+' = 'ALL';

  // UI state
  loading = false;

  // totals & KPIs
  totalAll = 0;
  total0_7 = 0;
  total8_14 = 0;
  total15_30 = 0;
  total30Plus = 0;
  expectedNext30 = 0;
  overdueAmount = 0;
  coveragePercent = 0;
  weightedProbability = 0;

  constructor(private api: ArCollectionForecastService) { }

  ngOnInit(): void {
    this.loadSummary();
  }

  // ===== API LOAD =====

  loadSummary(): void {
    this.loading = true;

    this.api.getSummary(this.fromDate, this.toDate).subscribe({
      next: res => {
        this.rows = res.data || [];
        this.filteredRows = [...this.rows];
        this.buildCustomerOptions();
        this.calcTotals();
        this.loadAllInvoices();  // load invoice-level list using same filter
        this.loading = false;
      },
      error: _ => {
        this.loading = false;
        this.rows = [];
        this.filteredRows = [];
        this.invoiceRows = [];
        this.calcTotals();
      }
    });
  }

  /** Load invoice-level forecast for ALL customers in filteredRows[] */
  private loadAllInvoices(): void {
    this.invoiceRows = [];

    if (!this.filteredRows || this.filteredRows.length === 0) {
      return;
    }

    const calls = this.filteredRows.map(r =>
      this.api.getDetail(r.customerId, this.fromDate, this.toDate).pipe(
        map(res => ({
          customerId: r.customerId,
          customerName: r.customerName,
          invoices: res.data || []
        }))
      )
    );

    forkJoin(calls).subscribe({
      next: all => {
        const merged: ArCollectionForecastInvoiceRow[] = [];
        all.forEach(x => {
          x.invoices.forEach((d: ArCollectionForecastDetail) => {
            merged.push({
              ...d,
              customerId: x.customerId,
              customerName: x.customerName
            });
          });
        });
        this.invoiceRows = merged;
      },
      error: _ => {
        this.invoiceRows = [];
      }
    });
  }

  private buildCustomerOptions(): void {
    const map = new Map<number, string>();
    this.rows.forEach(r => {
      if (!map.has(r.customerId)) {
        map.set(r.customerId, r.customerName);
      }
    });

    this.customerOptions = Array.from(map.entries()).map(([id, name]) => ({
      customerId: id,
      customerName: name
    }));
  }

  // ===== FILTER BUTTONS =====

  resetFilters(): void {
    this.fromDate = null;
    this.toDate = null;
    this.selectedCustomerId = null;
    this.selectedBucket = 'ALL';

    this.loadSummary(); // reload all data with no dates
  }

  applyFilters(): void {
    // First filter by customer and bucket on the summary rows
    let src = [...this.rows];

    if (this.selectedCustomerId != null) {
      src = src.filter(r => r.customerId === this.selectedCustomerId);
    }

    if (this.selectedBucket !== 'ALL') {
      switch (this.selectedBucket) {
        case '0-7':
          src = src.filter(r => (r.bucket0_7 || 0) > 0);
          break;
        case '8-14':
          src = src.filter(r => (r.bucket8_14 || 0) > 0);
          break;
        case '15-30':
          src = src.filter(r => (r.bucket15_30 || 0) > 0);
          break;
        case '30+':
          src = src.filter(r => (r.bucket30Plus || 0) > 0);
          break;
      }
    }

    this.filteredRows = src;
    this.calcTotals();
    this.loadAllInvoices(); // reload invoice list for filtered customers, still respecting from/to
  }

  // ===== TOTALS & KPIs =====

  private calcTotals(): void {
    const src = this.filteredRows && this.filteredRows.length ? this.filteredRows : this.rows;

    this.total0_7    = this.sum('bucket0_7', src);
    this.total8_14   = this.sum('bucket8_14', src);
    this.total15_30  = this.sum('bucket15_30', src);
    this.total30Plus = this.sum('bucket30Plus', src);
    this.totalAll    = this.sum('totalOutstanding', src);

    this.expectedNext30 = this.total0_7 + this.total8_14 + this.total15_30;
    this.overdueAmount  = this.total30Plus;

    this.coveragePercent = this.totalAll
      ? Math.round((this.expectedNext30 / this.totalAll) * 100)
      : 0;

    this.weightedProbability = this.coveragePercent;
  }

  private sum(field: NumericField, src: ArCollectionForecastSummary[]): number {
    return src.reduce((a, b) => a + (Number(b[field]) || 0), 0);
  }

  // ===== Helper for pill text =====

  getBucketLabel(bucket: string): string {
    switch ((bucket || '').toLowerCase()) {
      case '0-7':   return '0 - 7 Days';
      case '8-14':  return '8 - 14 Days';
      case '15-30': return '15 - 30 Days';
      case '30+':
      case '>30':   return '30+ Days';
      default:      return bucket;
    }
  }
}
