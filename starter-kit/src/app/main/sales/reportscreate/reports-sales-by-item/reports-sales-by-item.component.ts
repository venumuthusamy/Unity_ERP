import { Component, OnInit, AfterViewInit, ViewEncapsulation } from '@angular/core';
import { CoreSidebarService } from '@core/components/core-sidebar/core-sidebar.service';
import feather from 'feather-icons';
import { ReportsService } from '../reports.service';

@Component({
  selector: 'app-reports-sales-by-item',
  templateUrl: './reports-sales-by-item.component.html',
  styleUrls: ['./reports-sales-by-item.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class ReportsSalesByItemComponent implements OnInit, AfterViewInit {

  rows: any[] = [];
  selectedOption = 10;
  searchValue = '';

  constructor(
    private _coreSidebarService: CoreSidebarService,
    private _salesReportService : ReportsService
  ) {}

  ngOnInit(): void {
    this.loadSalesByItemReport();
  }

  ngAfterViewInit(): void {
    setTimeout(() => feather.replace(), 0);
  }

  onLimitChange(event: any) {
    this.selectedOption = +event.target.value;
  }


  filterUpdate(event: any) {
    const val = event.target.value.toLowerCase();
    this.rows = this.allRows.filter((r: any) =>
      Object.values(r).some(v => String(v).toLowerCase().includes(val))
    );
  }

 toggleSidebar(name): void {
    this._coreSidebarService.getSidebarRegistry(name).toggleOpen();
  }

  allRows: any[] = [];

  // loadMockData() {
  //   this.allRows = [
  //     {
  //       itemCode: 'ITM-001',
  //       itemName: 'Steel Rod 10mm',
  //       category: 'Hardware',
  //       subcategory: 'Construction',
  //       uom: 'PCS',
  //       quantitySold: 120,
  //       netSales: 24000,
  //       discountPct: 5,
  //       discountValue: 1200,
  //       taxAmount: 3600,
  //       grossSales: 27600,
  //       cost: 18000,
  //       marginPct: 25,
  //       marginValue: 6000,
  //       branch: 'Chennai',
  //       salesperson: 'Ravi Kumar',
  //       channel: 'Direct',
  //       period: new Date()
  //     },
  //     {
  //       itemCode: 'ITM-002',
  //       itemName: 'Cement Bag 50kg',
  //       category: 'Building Material',
  //       subcategory: 'Cement',
  //       uom: 'Bag',
  //       quantitySold: 300,
  //       netSales: 45000,
  //       discountPct: 3,
  //       discountValue: 1350,
  //       taxAmount: 6750,
  //       grossSales: 50400,
  //       cost: 36000,
  //       marginPct: 20,
  //       marginValue: 9000,
  //       branch: 'Madurai',
  //       salesperson: 'Selvi',
  //       channel: 'Dealer',
  //       period: new Date()
  //     }
  //   ];
  //   this.rows = [...this.allRows];
  // }



  loadSalesByItemReport(){
this._salesReportService.GetSalesByItemAsync().subscribe((res:any)=>{
  if(res.isSuccess){
    this.rows = res.data;
  }
})
  }
}
