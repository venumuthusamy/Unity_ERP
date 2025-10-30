import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { ColumnMode, DatatableComponent } from '@swimlane/ngx-datatable';
import { DatePipe } from '@angular/common';
import * as feather from 'feather-icons';
import { ReorderPlanningService } from '../stock-reorder-planning.service';

const METHOD_NAME: Record<number, string> = { 1: 'MinMax', 2: 'ROP', 3: 'MRP' };

@Component({
  selector: 'app-stock-reorder-planning-list',
  templateUrl: './stock-reorder-planning-list.component.html',
  styleUrls: ['./stock-reorder-planning-list.component.scss'],
  encapsulation: ViewEncapsulation.None,
  providers: [DatePipe]
})
export class StockReorderPlanningListComponent implements OnInit {


  @ViewChild(DatatableComponent) table: DatatableComponent;
  @ViewChild('tableRowDetails') tableRowDetails: any;
  @ViewChild('SweetAlertFadeIn') SweetAlertFadeIn: any;
  colors = ['bg-light-primary', 'bg-light-success', 'bg-light-danger', 'bg-light-warning', 'bg-light-info'];
  rows: any[] = [];
  tempData: any[] = [];
  public searchValue = '';
  public ColumnMode = ColumnMode;
  public selectedOption = 10;
  hover = false;
  passData: any;
  showLinesModal = false;
  modalLines: any[] = [];
  userId: any;
  modalTotal: any;
 

  constructor(   private reorderPlanningService: ReorderPlanningService, private router: Router,
    private datePipe: DatePipe, 
  ) { this.userId = localStorage.getItem('id'); }
  ngOnInit(): void {
    this.loadRequests();
  
  }
  filterUpdate(event) {

    const val = event.target.value.toLowerCase();
    const temp = this.tempData.filter((d) => {

      if (d.warehouseName.toLowerCase().indexOf(val) !== -1 || !val) {
        return d.warehouseName.toLowerCase().indexOf(val) !== -1 || !val;
      }
      if (d.methodName.toLowerCase().indexOf(val) !== -1 || !val) {
        return d.methodName.toLowerCase().indexOf(val) !== -1 || !val;
      }

    });
    this.rows = temp;
    this.table.offset = 0;
  }


  loadRequests() {
  
    this.reorderPlanningService.getStockReorder().subscribe({
      next: (res: any) => {
        this.rows = res.data.map((req: any) => {
          return {
            ...req,
             methodname: METHOD_NAME[+req.methodId] || '-'
          };
        });
        this.tempData = this.rows
      },
      error: (err: any) => console.error('Error loading list', err)
    });
  }


  openCreate() {
    this.passData = {};
    this.router.navigate(['/Inventory/create-stockreorderplanning']);

  }
  openLinesModal(row: any) {
    debugger
    // 1) get array safely
    const raw = Array.isArray(row?.lineItems) ? row.lineItems : JSON.parse(row?.lineItems || '[]');

    // 2) normalize to numbers + safe strings
    const N = (v: any) => Number.isFinite(Number(v)) ? Number(v) : 0;

    const lines = raw.map((l: any) => ({
      barcode: (l?.barcode ?? '-') as string,
      binId: (l?.binId),
      itemId: (l?.itemId),
      itemName: (l?.itemName ?? l?.name ?? '-') as string,
      onHand: N(l?.onHand ?? l?.available),
      countedQty: N(l?.countedQty),
      badCountedQty: N(l?.badCountedQty),
      totalQty: N(l?.countedQty) + N(l?.badCountedQty),
      variance: (l.countedQty + l.badCountedQty) - N(l.onHand),
      reason: (l?.reason ?? '-') as string,
      remarks: (l?.remarks ?? '-') as string
    }));

    // 3) compute totals
    this.modalTotal = {
      available: lines.reduce((s, x) => s + x.onHand, 0),
      counted: lines.reduce((s, x) => s + x.countedQty, 0),
      variance: lines.reduce((s, x) => s + x.varianceQty, 0)
    };

    this.modalLines = lines;
    this.showLinesModal = true;
  }


  closeLinesModal() {
    this.showLinesModal = false;
  }

  ngAfterViewChecked(): void {
    feather.replace();  // remove the guard so icons refresh every cycle
  }
  ngAfterViewInit(): void {
    feather.replace();
  }

   editStockReorder(row: any) {
    this.router.navigateByUrl(`/Inventory/edit-stockreorderplanning/${row.id}`)
  }
  deleteStockReorder(){

  }

}














