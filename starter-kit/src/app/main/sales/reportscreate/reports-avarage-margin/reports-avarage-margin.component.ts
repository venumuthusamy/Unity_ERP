import { Component, OnInit } from '@angular/core';
import { CoreSidebarComponent } from '@core/components/core-sidebar/core-sidebar.component';
import { CoreSidebarService } from '@core/components/core-sidebar/core-sidebar.service';
import { ReportsService } from '../reports.service';

declare const feather: any;

type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'AED' | string;

interface ReportRow {
  invoiceNo: string;
  invoiceDate: Date | string;
  customerName: string;
  itemName: string;
  category: string;
  netSales: number;
  costOfSales: number;
  marginValue: number;
  marginPct: number;
  currency: CurrencyCode;
  branch: string;
  company: string;
  salesperson: string;
}
@Component({
  selector: 'app-reports-avarage-margin',
  templateUrl: './reports-avarage-margin.component.html',
  styleUrls: ['./reports-avarage-margin.component.scss']
})
export class ReportsAvarageMarginComponent implements OnInit {

   // table data
  rows: ReportRow[] = [];
  allRows: ReportRow[] = [];

  // paging + search
  selectedOption = 10;
  searchValue = '';

  // filters
  dateFrom?: string; // yyyy-MM-dd
  dateTo?: string;   // yyyy-MM-dd
  branchFilter = '';
  companyFilter = '';
  salespersonFilter = '';
  currencyFilter = '';

  constructor(
    private _coreSidebarService: CoreSidebarService,
    private _salesReportService:ReportsService
  ) {}

  ngOnInit(): void {
    this.loadSalesMarginReport();
    // this.loadMockData();
    // this.applyFilters();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      if (typeof feather !== 'undefined' && feather?.replace) feather.replace();
    }, 0);
  }

  onLimitChange(event: any) {
    this.selectedOption = +event.target.value;
  }

 toggleSidebar(name): void {
    this._coreSidebarService.getSidebarRegistry(name).toggleOpen();
  }


  clearFilters() {
    this.searchValue = '';
    this.dateFrom = undefined;
    this.dateTo = undefined;
    this.branchFilter = '';
    this.companyFilter = '';
    this.salespersonFilter = '';
    this.currencyFilter = '';
    this.applyFilters();
  }

  filterUpdate(event?: any) {
    this.searchValue = event?.target?.value ?? this.searchValue ?? '';
    this.applyFilters();
  }

  applyFilters() {
    const search = (this.searchValue || '').toLowerCase();
    const df = this.dateFrom ? new Date(this.dateFrom) : undefined;
    const dt = this.dateTo ? new Date(this.dateTo) : undefined;
    if (dt) { dt.setHours(23,59,59,999); }

    this.rows = this.allRows.filter(r => {
      // quick search across visible fields
      const hit = [
        r.invoiceNo, r.customerName, r.itemName, r.category,
        r.branch, r.company, r.salesperson, r.currency
      ].some(v => String(v).toLowerCase().includes(search));

      if (!hit) return false;

      // date range
      const invDate = new Date(r.invoiceDate);
      if (df && invDate < df) return false;
      if (dt && invDate > dt) return false;

      // dropdown filters
      if (this.branchFilter && r.branch !== this.branchFilter) return false;
      if (this.companyFilter && r.company !== this.companyFilter) return false;
      if (this.salespersonFilter && r.salesperson !== this.salespersonFilter) return false;
      if (this.currencyFilter && r.currency !== this.currencyFilter) return false;

      return true;
    });
  }

  // unique list helpers for dropdowns
 

 

   loadSalesMarginReport(){
this._salesReportService.GetSalesMarginAsync().subscribe((res:any)=>{
  if(res.isSuccess){
    this.rows = res.data;
  }
})
  }
}
