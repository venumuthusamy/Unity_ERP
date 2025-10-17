import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { StockTakeService } from '../stock-take.service';
import { forkJoin } from 'rxjs';
import { WarehouseService } from 'app/main/master/warehouse/warehouse.service';
import { StrategyService } from 'app/main/master/strategies/strategy.service';
import * as feather from 'feather-icons';
import Swal from 'sweetalert2';
import { ItemMasterService } from '../../item-master/item-master.service';
import { BinService } from '../../../master/bin/bin.service'

interface SelectOpt { id: number | string; name?: string; label?: string; value?: string; }

interface StockTakeLine {
  id: number;
  itemId: number | string | null;
  itemName: string | null;
  onHand: number | null;
  countedQty: number | null;
  barcode?: string | null;
  remarks?: string | null;
  _error?: string | null; // UI-only
}

@Component({
  selector: 'app-stock-take',
  templateUrl: './stock-take.component.html',
  styleUrls: ['./stock-take.component.scss']
})
export class StockTakeComponent implements OnInit {

  warehouseTypes: any
  LocationTypes: any
  filteredLocationTypes: any
  takeTypes = [
    { id: 1, label: 'Full', },
    { id: 2, label: 'Cycle', }
  ];
  strategies: any
  warehouseTypeId: any
  locationId: any
  takeTypeId: any;
  strategyId: any;
  freeze: boolean = false;

  lines: StockTakeLine[] = [];



  @ViewChild('reviewTpl', { static: true }) reviewTpl!: any;
  private reviewRef?: NgbModalRef;

  strategyCheck: boolean = false;
  stockTakeId: any = 0;
  itemList: any;


  constructor(private router: Router, private modal: NgbModal, private stockTakeService: StockTakeService,
    private warehouseService: WarehouseService, private BinService: BinService,
    private strategyService: StrategyService, private itemMasterService: ItemMasterService,
    private route: ActivatedRoute,
  ) { }

  ngOnInit(): void {
    debugger
    forkJoin({
      warehouse: this.warehouseService.getWarehouse(),
      bin: this.BinService.getAllBin(),
      strategy: this.strategyService.getStrategy(),
      item: this.itemMasterService.getAllItemMaster()
    }).subscribe((results: any) => {
      this.warehouseTypes = results.warehouse.data;
      this.LocationTypes = results.bin.data;
      this.strategies = results.strategy.data;
      this.itemList = results.item.data;
    });
    this.route.paramMap.subscribe((params: any) => {
      const idStr = params.get('id');
      this.stockTakeId = idStr ? Number(idStr) : 0;
      if(this.stockTakeId){
        this.stockTakeService.getStockTakeById(this.stockTakeId).subscribe((res: any) => {
        console.log(res)
        this.warehouseTypeId = res.data.warehouseTypeId,
        this.takeTypeId = res.data.takeTypeId,
        this.strategyId = res.data.strategyId,
        this.freeze = res.data.freeze
        this.lines = res.data.lineItems

        const arr = this.warehouseTypes.filter(x => x.id === this.warehouseTypeId);
        const wh = arr[0];
        const binIds = String(wh?.binID ?? '')
          .split(',')
          .map(s => Number(s.trim()))
          .filter(Number.isFinite);
        const allowedIds = new Set(binIds);
        this.filteredLocationTypes = binIds.length
          ? this.LocationTypes.filter(loc => allowedIds.has(Number(loc.id)))
          : [];
        this.locationId = res.data.locationId  
      })
      }
      
    })
  }
  ngAfterViewInit(): void {
    feather.replace();
  }

  ngAfterViewChecked(): void {
    feather.replace();
  }

  onTypeChanged(id: number) {
    this.takeTypeId = id;
    if (this.takeTypeId == 1) {
      this.strategyCheck = true;
    } else {
      this.strategyCheck = false;
    }

  }


  onExportMobileTasks(): void {
    if (!this.lines.length) { alert('Plan lines first.'); return; }
    console.log('Exporting mobile tasks for', this.lines.length, 'lines');
  }

  onCountChange(r: StockTakeLine): void {
    const n = Math.floor(Number(r.countedQty));
    if (!Number.isFinite(n) || n < 0) {
      r.countedQty = null;
      r._error = 'Enter a valid number (≥ 0)';
    } else {
      r.countedQty = n;
      r._error = null;
    }
  }

  removeLine(i: number): void { this.lines.splice(i, 1); }

  // ===== Helpers for modal/table =====
  toNum(v: any): number { return Number(v) || 0; }
  getVariance(r: StockTakeLine): number { return this.toNum(r.countedQty) - this.toNum(r.onHand); }
  signed(n: number): string { return (n >= 0 ? '+' : '') + n; }

  getItemName(id: number | string | null) {
    const x = this.itemList.find(i => i.id === id);
    return x?.name ?? String(id ?? '');
  }

  onSubmit(): void {

    if (!this.warehouseTypeId || !this.locationId || !this.takeTypeId) {
      Swal.fire({
        title: "Failed",
        text: "Please Fill Mandatory Fields",
        icon: "error",
        allowOutsideClick: false,
      });

      return;
    }

    const req = this.buildPlanReq();

    this.stockTakeService.getWarehouseItems(req).subscribe({
      next: (res: any) => {
        debugger
        const raw = res?.data || [];
        this.lines = raw.map(l => this.mapLine(l));

        if (this.freeze) {
          console.log('Freeze flag was sent; backend should have frozen scope.');
        }
      },
      error: (err) => {
        this.lines = [];
      }
    });
  }
  private buildPlanReq() {
    return {
      warehouseTypeId: this.warehouseTypeId ?? null,
      locationId: this.locationId ?? null,
      takeTypeId: this.takeTypeId ?? null,
      strategyId: this.strategyId ?? null,
      freeze: !!this.freeze
    };
  }

  // Map API line -> UI line
  private mapLine(dto) {
    return {
      id: dto.id,
      itemId: dto.itemId,
      itemName: dto.itemName ?? null,
      onHand: Number(dto.onHand) || 0,
      countedQty: null,
      barcode: dto.barcode ?? '',
      remarks: dto.remarks ?? '',
    };
  }

  // ===== Review modal =====
  openReview(): void {
    if (!this.lines.length) {
      Swal.fire({
        title: "Failed",
        text: "Please Fill Line Items",
        icon: "error",
        allowOutsideClick: false,
      });
      return;
    }
    this.reviewRef = this.modal.open(this.reviewTpl, { size: 'lg', centered: true, backdrop: 'static' });
  }

  onSave(): void {
    debugger
    const errs: string[] = [];

    if (!this.lines.length) errs.push('No lines to post.');
    this.lines.forEach((L, i) => {
      if (!L.itemId) errs.push(`Line ${i + 1}: Item is required.`);
      if (L.countedQty == null || !Number.isFinite(Number(L.countedQty)) || Number(L.countedQty) < 0)
        errs.push(`Line ${i + 1}: countedQty must be ≥ 0.`);
      if (L.onHand == null || !Number.isFinite(Number(L.onHand)) || Number(L.onHand) < 0)
        errs.push(`Line ${i + 1}: Book qty missing (plan again or set).`);
    });

    if (errs.length) {
      // Optional: escape HTML to be safe
      const esc = (s: string) =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      Swal.fire({
        title: 'Fix these issues',
        icon: 'error',
        html:
          `<div style="text-align:left"><ul>` +
          errs.map(e => `<li>${esc(e)}</li>`).join('') +
          `</ul></div>`,
        confirmButtonText: 'OK',
        allowOutsideClick: false,
        confirmButtonColor: '#2E5F73'
      });
      return;
    }

    const payload = {
      id: this.stockTakeId ?? 0,
      warehouseTypeId: this.warehouseTypeId,
      locationId: this.locationId,
      takeTypeId: this.takeTypeId,
      strategyId: this.strategyId,
      freeze: this.freeze,
      lineItems: this.lines.map(L => ({
        id:L.id,
        itemId: L.itemId,
        onHand: this.toNum(L.onHand),
        countedQty: this.toNum(L.countedQty),
        VarianceQty: this.toNum(L.countedQty) - this.toNum(L.onHand),
        barcode: (L.barcode ?? '').trim() || null,
        remarks: (L.remarks ?? '').trim() || null
      }))
    };

    if (this.stockTakeId) {
        this.stockTakeService.updateStockTake(payload).subscribe((res) => {
        if (res.isSuccess) {
          Swal.fire({
            title: "Hi",
            text: res.message,
            icon: "success",
            allowOutsideClick: false,
          });
          this.router.navigateByUrl('/Inventory/list-stocktake')
        }
      });
    }
    else {
    

      this.stockTakeService.insertStockTake(payload).subscribe((res) => {
        if (res.isSuccess) {
          Swal.fire({
            title: "Hi",
            text: res.message,
            icon: "success",
            allowOutsideClick: false,
          });
          this.router.navigateByUrl('/Inventory/list-stocktake')
        }
      });
    }
  }

  // ===== Nav =====
  goToStockTakeList(): void {
    this.router.navigate(['/Inventory/list-stocktake']); // adjust route
  }
  onWarehouseChanged(value) {
    this.locationId = null
    const arr = this.warehouseTypes.filter(x => x.id === value);
    const wh = arr[0];
    const binIds = String(wh?.binID ?? '')
      .split(',')
      .map(s => Number(s.trim()))
      .filter(Number.isFinite);
    const allowedIds = new Set(binIds);
    this.filteredLocationTypes = binIds.length
      ? this.LocationTypes.filter(loc => allowedIds.has(Number(loc.id)))
      : [];

  }

}



