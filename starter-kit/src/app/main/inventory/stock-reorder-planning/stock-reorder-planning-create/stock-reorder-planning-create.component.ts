import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';
import { ReorderPlanningService } from './stock-reorder-planning.service';
import { forkJoin } from 'rxjs';
import { WarehouseService } from 'app/main/master/warehouse/warehouse.service';
import { ActivatedRoute } from '@angular/router';



const METHOD = { MinMax: 1, ROP: 2, MRP: 3 } as const;
type MethodId = typeof METHOD[keyof typeof METHOD];

interface ReorderRow {
  itemId: number;
  itemName: string;
  sku?: string;
  warehouseTypeId: number;
  warehouseName?: string;

  onHand: number;
  reserved: number;
  min: number;
  reorderQty?: number | null;   // if you store a single target level
  max?: number | null;       // if you use Min/Max
  leadDays: number;
  usageHorizon: number;      // usage sum over selected horizon (e.g., 30-day usage)
  safetyStock?: number | null;

  binId?: number | null;
  binName?: string | null;

  suggested?: number;
}

@Component({
  selector: 'app-stock-reorder-planning-create',
  templateUrl: './stock-reorder-planning-create.component.html',
  styleUrls: ['./stock-reorder-planning-create.component.scss']
})
export class StockReorderPlanningCreateComponent implements OnInit {


  warehouses: Array<{ id: number; name: string }> = [];


  warehouseTypeId: number | null = null;


  // Suggestion header controls
  methodId: MethodId | null = null;
  horizonDays: number = 30;
  includeLeadTime: boolean = true;
  status: any

  rows: ReorderRow[] = [];
  loading = false;

  methodOptions = [
    { id: METHOD.MinMax, label: 'Min/Max' },
    { id: METHOD.ROP, label: 'Reorder Point' },
    { id: METHOD.MRP, label: 'MRP (usage & lead)' }
  ];
  stockReorderId: number;


  constructor(private reorderPlanningService: ReorderPlanningService, private warehouseService: WarehouseService,
    private route: ActivatedRoute,
  ) { }

  ngOnInit(): void {

    forkJoin({
      warehouse: this.warehouseService.getWarehouse(),
    }).subscribe((results: any) => {
      this.warehouses = results.warehouse.data;

    });
    this.route.paramMap.subscribe((params: any) => {
      const idStr = params.get('id');
      this.stockReorderId = idStr ? Number(idStr) : 0;
      if (this.stockReorderId) {
        this.reorderPlanningService.getStockReorderById(this.stockReorderId).subscribe((res: any) => {
          console.log(res)
          this.warehouseTypeId = res.data.warehouseTypeId,

            this.status = res.data.status

        })
      }

    })
  }

  onWarehouseChange(_: any) {
    this.reloadRows();
  }

  reloadRows() {
    debugger
    if (!this.warehouseTypeId) { this.rows = []; return; }

    this.loading = true;
    this.rows = [];

    this.reorderPlanningService.getWarehouseItems(
      this.warehouseTypeId,
    )
      .subscribe({
        next: (res:any) => {
          this.rows = (res.data || []).map((x: any) => ({
            itemId: x.itemId,
            itemName: x.itemName,
            sku: x.sku,
            warehouseTypeId: x.warehouseId,
            warehouseName: x.warehouseName,

            onHand: x.onHand ?? 0,
            reserved: x.reserved ?? 0,
            min: x.minQty ?? 0,
            reorderQty: x.reorderQty ,  // your schema may store one or both
            max: x.maxQty,
            leadDays: x.leadDays ?? 0,
            usageHorizon: x.usageHorizon ?? x.usage30d ?? 0,
            safetyStock: x.safetyStock ?? x.minQty ?? 0,

            binId: x.binId ?? null,
            binName: x.binName ?? null,

            suggested: 0
          }));
        },
        error: (err) => {
          const msg = err?.error?.message || err?.message || 'Failed to load warehouse items.';
          Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#d33' });
        },
        complete: () => this.loading = false
      });
  }

  // runSuggestion(): void {
  //   debugger
  //   const selected = this.methodId ?? METHOD.MinMax;   // default fallback
  //   const horizon = Math.max(1, toNum(this.horizonDays, 30));

  //   this.rows = this.rows.map(r => {
  //     const onHand = toNum(r.onHand);
  //     const min = toNum(r.min);
  //     const maxLvl = toNum((r.max ?? r.reorderQty ?? onHand));
  //     const target = toNum((r.reorderQty ?? r.max ?? maxLvl));
  //     const daily = toNum(r.usageHorizon) / horizon;
  //     const lead = this.includeLeadTime ? Math.max(0, toNum(r.leadDays)) : 0;

  //     let suggested = 0;

  //     if (selected === METHOD.MinMax) {
  //       const projected = onHand - daily * lead;
  //       if (projected < min) suggested = Math.max(0, Math.ceil(maxLvl - onHand));
  //     } else if (selected === METHOD.ROP) {
  //       const safety = toNum(r.safetyStock ?? min);
  //       const rop = daily * lead + safety;
  //       if (onHand <= rop) suggested = Math.max(0, Math.ceil(target - onHand));
  //     } else if (selected === METHOD.MRP) {
  //       const projectedFuture = onHand - daily * (lead + horizon);
  //       if (projectedFuture < min) {
  //         suggested = Math.max(0, Math.ceil(target - onHand));
  //       }
  //     }

  //     return { ...r, suggested };
  //   });
  // }

  runSuggestion(): void {
  const selected = this.methodId ?? METHOD.MinMax;   // default fallback
  const horizon = Math.max(1, toNum(this.horizonDays, 30));

  this.rows = this.rows.map(r => {
    const onHand   = toNum(r.onHand);
    const min      = toNum(r.min);
    const maxLvl   = toNum(r.max);                 // explicit Max for Min/Max
    const reorderT = toNum(r.reorderQty);             // explicit Reorder target for ROP/MRP
    const daily    = toNum(r.usageHorizon) / horizon;
    const lead     = this.includeLeadTime ? Math.max(0, toNum(r.leadDays)) : 0;
    const safety   = toNum(r.safetyStock ?? min);

    // sensible fallback for target when a field is empty
    const targetForROPandMRP = reorderT > 0 ? reorderT : (maxLvl > 0 ? maxLvl : onHand);

    let suggested = 0;

    if (selected === METHOD.MinMax) {
      // Project stock at arrival and compare to Min (use <= to trigger at the boundary)
      const projected = onHand - daily * lead;
      if (projected <= min) {
        suggested = Math.ceil(Math.max(0, maxLvl - onHand));
      }
    } else if (selected === METHOD.ROP) {
      // ROP = demand during lead + safety
      const rop = daily * lead + safety;
      if (onHand <= rop) {
        suggested = Math.ceil(Math.max(0, targetForROPandMRP - onHand));
      }
    } else if (selected === METHOD.MRP) {
      // Look ahead: demand during lead + horizon
      const projectedFuture = onHand - daily * (lead + horizon);
      if (projectedFuture < min) {
        suggested = Math.ceil(Math.max(0, targetForROPandMRP - onHand));
      }
    }

    // Guard: don't suggest negative or nonsense if Max/Reorder < OnHand
    if (!Number.isFinite(suggested) || suggested < 0) suggested = 0;

    return { ...r, suggested };
  });
}




  // Per-row recalc uses methodId too
  // recalcRow(row: ReorderRow) {
  //   debugger
  //   const selected = this.methodId ?? METHOD.MinMax;
  //   const horizon = Math.max(1, toNum(this.horizonDays, 30));
  //   const onHand = toNum(row.onHand);
  //   const min = toNum(row.min);
  //   const maxLvl = toNum((row.max ?? row.reorderQty ?? onHand));
  //   const target = toNum((row.reorderQty ?? row.max ?? maxLvl));
  //   const daily = toNum(row.usageHorizon) / horizon;
  //   const lead = this.includeLeadTime ? Math.max(0, toNum(row.leadDays)) : 0;

  //   let suggested = 0;

  //   if (selected === METHOD.MinMax) {
  //     const projected = onHand - daily * lead;
  //     if (projected < min) suggested = Math.max(0, Math.ceil(maxLvl - onHand));
  //   } else if (selected === METHOD.ROP) {
  //     const safety = toNum(row.safetyStock ?? min);
  //     const rop = daily * lead + safety;
  //     if (onHand <= rop) suggested = Math.max(0, Math.ceil(target - onHand));
  //   } else if (selected === METHOD.MRP) {
  //     const projectedFuture = onHand - daily * (lead + horizon);
  //     if (projectedFuture < min) suggested = Math.max(0, Math.ceil(target - onHand));
  //   }

  //   row.suggested = suggested;
  // }

  recalcRow(row: ReorderRow) {
    debugger
  const selected = this.methodId ?? METHOD.MinMax;
  const horizon  = Math.max(1, toNum(this.horizonDays, 30));

  const onHand   = toNum(row.onHand);
  const min      = toNum(row.min);                 // Safety stock / minimum level
  const maxLvl   = toNum(row.max);                 // Order-up-to for Min/Max
  const reorderT = toNum(row.reorderQty);          // Target for ROP/MRP (fallback to Max)
  const target   = reorderT > 0 ? reorderT : (maxLvl > 0 ? maxLvl : onHand);

  const usage    = toNum(row.usageHorizon);        // sum for the horizon window
  const daily    = usage / horizon;
  const lead     = this.includeLeadTime ? Math.max(0, toNum(row.leadDays)) : 0;
  const safety   = toNum(row.safetyStock ?? min);

  let suggested = 0;

  if (selected === METHOD.MinMax) {
    // project stock at arrival; trigger when you hit/below Min
    const projected = onHand - daily * lead;
    if (projected <= min) suggested = Math.ceil(Math.max(0, maxLvl - onHand));
  } else if (selected === METHOD.ROP) {
    // ROP = demand during lead + safety
    const rop = daily * lead + safety;
    if (onHand <= rop) suggested = Math.ceil(Math.max(0, target - onHand));
  } else if (selected === METHOD.MRP) {
    // look ahead across lead + horizon
    const projectedFuture = onHand - daily * (lead + horizon);
    if (projectedFuture < min) suggested = Math.ceil(Math.max(0, target - onHand));
  }

  // final guard
  if (!Number.isFinite(suggested) || suggested < 0) suggested = 0;
  row.suggested = suggested;
}
  isBusy = false;

  onSuggestPO() {

  }

  onConvertToPR() {

  }


}

function toNum(v: any, d = 0) { return Number.isFinite(+v) ? +v : d; }

