import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';
import { forkJoin, of } from 'rxjs';
import { WarehouseService } from 'app/main/master/warehouse/warehouse.service';
import { ActivatedRoute, Router } from '@angular/router';
import { ReorderPlanningService } from '../stock-reorder-planning.service';
import { map, switchMap, take } from 'rxjs/operators';
import { SupplierService } from 'app/main/businessPartners/supplier/supplier.service';
import { ItemsService } from 'app/main/master/items/items.service';

const METHOD = { MinMax: 1, ROP: 2, MRP: 3 } as const;
type MethodId = typeof METHOD[keyof typeof METHOD];


// add to your interface
interface SupplierBreakdown {
  id?: number;
  supplierId: number;
  name: string;
  price: number;
  qty: number;         // user editable (10, 15, …)
  selected?: boolean;  // optional: if you want a checkbox
}



interface ReorderRow {
  id: 0,
  itemId: number;
  itemName: string;
  sku?: string;
  warehouseTypeId: number;
  warehouseName?: string;

  onHand: number;
  reserved: number;
  min: number;
  reorderQty?: number | null;
  max?: number | null;
  leadDays: number;
  usageHorizon: number;
  safetyStock?: number | null;

  binId?: number | null;
  binName?: string | null;

  suggested?: number;
  selected: boolean

  // NEW: “tree” children
  supplierBreakdown?: SupplierBreakdown[];
  _loadedChildren?: boolean;  // cache flag so we don’t reload every expand
}
type SuggestLine = {
  supplierId: number;
  warehouseId: number;
  itemId: number;
  qty: number;
  price: number;
};
type Line = { itemId: number; qty: number; price: number };
type Group = { supplierId: number; warehouseId: number; lines: Line[] };

@Component({
  selector: 'app-stock-reorder-planning-create',
  templateUrl: './stock-reorder-planning-create.component.html',
  styleUrls: ['./stock-reorder-planning-create.component.scss']
})
export class StockReorderPlanningCreateComponent implements OnInit {

  warehouses: Array<{ id: number; name: string }> = [];
  warehouseTypeId: number | null = null;

  methodId: MethodId | null = null;
  horizonDays: number = 30;
  includeLeadTime: boolean = true;
  status: any;

  rows: ReorderRow[] = [];
  loading = false;
  isBusy = false;

  methodOptions = [
    { id: METHOD.MinMax, label: 'Min/Max' },
    { id: METHOD.ROP, label: 'Reorder Point' },
    { id: METHOD.MRP, label: 'MRP (usage & lead)' }
  ];
  stockReorderId: number = 0;
  selectedIds = new Set<number>();
  expandedIds = new Set<number>();
  userId: any;
  userName: any;
  suppliers: any
  itemlist: any;



  constructor(
    private reorderPlanningService: ReorderPlanningService,
    private warehouseService: WarehouseService,
    private route: ActivatedRoute,
    private router: Router,
    private _SupplierService: SupplierService,
    private itemsService: ItemsService
  ) {
    this.userId = localStorage.getItem('id'),
      this.userName = localStorage.getItem('username')
  }

  ngOnInit(): void {
    forkJoin({
      warehouse: this.warehouseService.getWarehouse(),
      supplier: this._SupplierService.GetAllSupplier(),
      items: this.itemsService.getAllItem()
    }).subscribe((results: any) => {
      this.warehouses = results.warehouse.data;
      this.suppliers = results.supplier?.data
      this.itemlist = results.items?.data
    });


    this.route.paramMap.subscribe(pm => {
      const id = Number(pm.get('id') || 0);
      this.stockReorderId = id;

      if (!id) { this.rows = []; return; }

      this.reorderPlanningService.getStockReorderById(id)
        .subscribe((res: any) => {
          const h = res.data;

          // header fields (also bound via ngModel)
          this.warehouseTypeId = h.warehouseTypeId ?? null;
          this.methodId = h.methodId ?? 1;
          this.horizonDays = h.horizonDays ?? 30;
          this.includeLeadTime = !!h.includeLeadTime;
          this.status = h.status ?? 0;

          // LINES: make sure selected exists and is boolean,
          // and suppliers array is mapped with all fields you bind to.
          this.rows = (h.lineItems || []).map((l: any) => ({
            id: l.id,
            itemId: l.itemId,
            itemName: this.getItemName(l.itemId),
            binId: l.binId ?? null,
            warehouseTypeId: l.warehouseTypeId ?? h.warehouseTypeId,
            onHand: Number(l.onHand ?? 0),
            min: l.min == null ? null : Number(l.min),
            max: l.max == null ? null : Number(l.max),
            reorderQty: l.reorderQty == null ? null : Number(l.reorderQty),
            leadDays: Number(l.leadDays ?? 0),
            usageHorizon: Number(l.usageHorizon ?? h.horizonDays ?? 0),
            suggested: Number(l.suggested ?? 0),
            status: l.status ?? h.status ?? 0,
            selected: !!l.selected,


            supplierBreakdown: (l.supplierBreakdown || []).map((s: any) => ({
              id: s.id || 0,
              supplierId: s.supplierId,
              name: this.getSupplierName(s.supplierId),
              price: Number(s.price ?? 0),
              qty: Number(s.qty ?? 0),
              selected: !!s.selected
            }))
          }));
          this.selectedIds = new Set(this.rows.filter(r => r.selected).map(r => r.itemId));
        });
    });
  }
  getSupplierName(id: number | string | null) {
    const x = this.suppliers?.find(i => i.id === id);
    return x?.name ?? String(id ?? '');
  }
   getItemName(id: number | string | null) {
    debugger
    const x = this.itemlist?.find(i => i.id === id);
    return x?.itemName ?? String(id ?? '');
  }

  // New explicit load trigger
  onLoadClick() {
    if (!this.warehouseTypeId) {
      Swal.fire({
        icon: 'warning',
        title: 'Select a warehouse',
        text: 'Please choose a warehouse before loading.',
        confirmButtonColor: '#2E5F73'
      });
      return;
    }
    this.reloadRows();
  }

  reloadRows() {
    if (!this.warehouseTypeId) { this.rows = []; return; }

    this.loading = true;
    this.rows = [];

    this.reorderPlanningService.getWarehouseItems(this.warehouseTypeId)
      .subscribe({
        next: (res: any) => {
          debugger
          if (res.data.length == 0) {
            Swal.fire({
              icon: 'warning',
              title: 'No Item in Warehouse',
              confirmButtonColor: '#2E5F73'
            });
            return;
          }
          this.rows = (res.data || []).map((x: any) => ({
            itemId: x.itemId,
            itemName: x.itemName,
            sku: x.sku,
            warehouseTypeId: x.warehouseId,
            warehouseName: x.warehouseName,

            onHand: x.onHand ?? 0,
            reserved: x.reserved ?? 0,
            min: x.minQty ?? 0,
            reorderQty: x.reorderQty,
            max: x.maxQty,
            leadDays: x.leadDays ?? 0,
            usageHorizon: x.usageHorizon ?? x.usage30d ?? 0,
            safetyStock: x.safetyStock ?? x.minQty ?? 0,

            binId: x.binId ?? null,
            binName: x.binName ?? null,

            suggested: 0,

            supplierBreakdown: (x.suppliers || []).map((s: any) => ({
              supplierId: s.supplierId,
              name: s.supplierName,
              price: s.price,
              qty: s.qty ?? 0,
              selected: false
            }))
          }));
        },
        error: (err) => {
          const msg = err?.error?.message || err?.message || 'Failed to load warehouse items.';
          Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#d33' });
        },
        complete: () => this.loading = false
      });
  }

  // Only recalculates suggestions when header fields change
  reloadCalculationsOnly() {
    if (!this.rows.length) { return; }
    // recompute suggestion for each row with the new parameters
    this.rows = this.rows.map(r => {
      this.recalcRow(r);
      return r;
    });
  }

  runSuggestion(): void {
    if (!this.methodId) {
      Swal.fire({
        icon: 'warning',
        title: 'Select a Method',
        confirmButtonColor: '#2E5F73'
      });
      return;
    }
    debugger
    const selected = this.methodId ?? METHOD.MinMax;
    const horizon = Math.max(1, toNum(this.horizonDays, 30));

    this.rows = this.rows.map(r => {
      const onHand = toNum(r.onHand);
      const min = toNum(r.min);
      const maxLvl = toNum(r.max);
      const reorderT = toNum(r.reorderQty);
      const daily = toNum(r.usageHorizon) / horizon;
      const lead = this.includeLeadTime ? Math.max(0, toNum(r.leadDays)) : 0;
      const safety = toNum(r.safetyStock ?? min);

      const targetForROPandMRP = reorderT > 0 ? reorderT : (maxLvl > 0 ? maxLvl : onHand);

      let suggested = 0;

      if (selected === METHOD.MinMax) {
        const projected = onHand - daily * lead;
        if (projected <= min) {
          suggested = Math.ceil(Math.max(0, maxLvl - projected));
        }
      } else if (selected === METHOD.ROP) {
        const rop = daily * lead + safety;
        if (onHand <= rop) {
          const projectedAtArrival = onHand - daily * lead;
          suggested = Math.ceil(Math.max(0, targetForROPandMRP - projectedAtArrival));
        }
      } else if (selected === METHOD.MRP) {
        const projectedFuture = onHand - daily * (lead + horizon);
        if (projectedFuture < min) {
          suggested = Math.ceil(Math.max(0, targetForROPandMRP - projectedFuture));
        }
      }

      if (!Number.isFinite(suggested) || suggested < 0) suggested = 0;
      return { ...r, suggested };
    });
  }

  recalcRow(row: ReorderRow): void {
    const selected = this.methodId ?? METHOD.MinMax;
    const horizon = Math.max(1, toNum(this.horizonDays, 30));

    const onHand = toNum(row.onHand);
    const min = toNum(row.min);
    const maxLvl = toNum(row.max);
    const reorderT = toNum(row.reorderQty);

    const usage = toNum(row.usageHorizon);
    const daily = usage / horizon;
    const lead = this.includeLeadTime ? Math.max(0, toNum(row.leadDays)) : 0;
    const safety = toNum(row.safetyStock ?? min);

    const targetForROPandMRP = reorderT > 0 ? reorderT : (maxLvl > 0 ? maxLvl : onHand);

    let suggested = 0;

    if (selected === METHOD.MinMax) {
      const projectedAtArrival = onHand - daily * lead;
      if (projectedAtArrival <= min) {
        suggested = Math.ceil(Math.max(0, maxLvl - projectedAtArrival));
      }
    } else if (selected === METHOD.ROP) {
      const rop = daily * lead + safety;
      if (onHand <= rop) {
        const projectedAtArrival = onHand - daily * lead;
        suggested = Math.ceil(Math.max(0, targetForROPandMRP - projectedAtArrival));
      }
    } else if (selected === METHOD.MRP) {
      const projectedFuture = onHand - daily * (lead + horizon);
      if (projectedFuture < min) {
        suggested = Math.ceil(Math.max(0, targetForROPandMRP - projectedFuture));
      }
    }

    if (!Number.isFinite(suggested) || suggested < 0) suggested = 0;
    row.suggested = suggested;
  }


  isSelected(id: number) { return this.selectedIds.has(id); }
  isAllSelected() { return this.rows.length > 0 && this.selectedIds.size === this.rows.length; }

  toggleRowSelection(id: number, ev: Event) {
    const checked = (ev.target as HTMLInputElement).checked;
    checked ? this.selectedIds.add(id) : this.selectedIds.delete(id);
    this.rows = this.rows.map(r =>
      r.itemId === id ? { ...r, selected: checked } : r
    );
  }

  toggleSelectAll(ev: Event) {
    const checked = (ev.target as HTMLInputElement).checked;
    this.selectedIds.clear();
    if (checked) this.rows.forEach(r => this.selectedIds.add(r.itemId));
  }

  isExpanded(r: ReorderRow) { return this.expandedIds.has(r.itemId); }

  toggleExpand(r: ReorderRow) {
    debugger
    if (this.isExpanded(r)) {
      this.expandedIds.delete(r.itemId);
      return;
    }
    this.expandedIds.add(r.itemId);

    // Lazy-load children once (call your API if available)
    if (!r._loadedChildren) {
      r._loadedChildren = true;
    }
  }

  // one PR per (supplierId + warehouseId)
  onSuggestPO() {
    
    debugger
    const selectedRows = this.rows.filter(r => this.selectedIds.has(r.itemId));
    if (!selectedRows.length) {
      return Swal.fire({ icon: 'warning', title: 'Select items', confirmButtonColor: '#2E5F73' });
    }

    // validate: each selected item must have at least one supplier checked
    for (const r of selectedRows) {
      const anySup = (r.supplierBreakdown || []).some(s => s.selected);
      if (!anySup) {
        return Swal.fire({
          icon: 'warning',
          title: 'Select supplier',
          html: `Choose a supplier for selected Item <b>${r.itemName}</b>.`,
          confirmButtonColor: '#2E5F73'
        });
      }
    }

    const flat: SuggestLine[] = selectedRows.reduce<SuggestLine[]>((acc, r) => {
      const items = (r.supplierBreakdown ?? [])
        .filter(s => s.selected)
        .map(s => ({
          supplierId: s.supplierId,
          warehouseId: r.warehouseTypeId,
          itemId: r.itemId,
          qty: Number(r.suggested) || 0,   // suggested drives quantity
          price: Number(s.price) || 0      // supplier price
        }))
        .filter(x => x.qty > 0);

      acc.push(...items);
      return acc;
    }, []);

    if (!flat.length) {
      return Swal.fire({
        icon: 'warning', title: 'Nothing to suggest',
        text: 'No positive suggested quantities.', confirmButtonColor: '#2E5F73'
      });
    }

    // group by supplier+warehouse → one PR per group

    const map = new Map<string, Group>();
    for (const ln of flat) {
      const key = `${ln.supplierId}|${ln.warehouseId}`;
      if (!map.has(key)) map.set(key, { supplierId: ln.supplierId, warehouseId: ln.warehouseId, lines: [] });
      map.get(key)!.lines.push({ itemId: ln.itemId, qty: ln.qty, price: ln.price });
    }

    const groups: Group[] = Array.from(map.values());

    // ✅ Wrap in object and include user fields
    const body = {
      groups,
      note: 'Suggest Reorder',
      userId: Number(this.userId),
      userName: this.userName ?? null,
      departmentId: 1
    };

    // POST
    this.isBusy = true;
    this.reorderPlanningService.createPoSuggestions(body).subscribe({
      next: (res: { created: { id: number; purchaseRequestNo: string }[] }) => {
        const count = res?.created?.length ?? 0;
        Swal.fire({
          icon: 'success',
          title: `Created ${count} PR${count === 1 ? '' : 's'}`,
          text: 'PR(s) Created for Suggested POs.Please Click Reorder Button and Proceed further',
          confirmButtonColor: '#2E5F73'
        }).then(() => {
          // navigate to PR list and optionally filter/highlight
          this.router.navigate(['/purchase/list-purchaseorder'], { queryParams: { recent: 'reorder' } });
        });
      },
      error: (err) => {
        const msg = err?.error?.message || err?.message || 'Failed to create PR suggestions.';
        Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#d33' });
      },
      complete: () => this.isBusy = false
    });
  }
  toNum(v: any): number { return Number(v) || 0; }
  
  saveDraft(status) {
    debugger
    this.status = status;

    // Optional helpers
    const toNum = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    const pickDefaultSupplierIndex = (suppliers: any[]): number => {
      // choose cheapest non-null, >0 price; fallback to first
      if (!suppliers || suppliers.length === 0) return -1;
      let idx = -1, best = Number.POSITIVE_INFINITY;
      suppliers.forEach((s, i) => {
        const p = Number(s?.price);
        if (Number.isFinite(p) && p > 0 && p < best) { best = p; idx = i; }
      });
      return idx >= 0 ? idx : 0;
    };

    const payload = {
      id: this.stockReorderId ?? 0,
      warehouseTypeId: this.warehouseTypeId,
      methodId: this.methodId,
      horizonDays: this.horizonDays,
      includeLeadTime: this.includeLeadTime ?? false,
      status: this.status,
      lineItems: (this.rows || []).map(r => {
        const suppliers = Array.isArray(r.supplierBreakdown) ? r.supplierBreakdown : [];

        // If your UI already sets s.selected on each supplier, we’ll use that.
        // Otherwise, pick a default (cheapest) supplier to mark as selected = true.
        // const hasExplicitSelection = suppliers.some(s => !!s?.selected);
        // const defaultIdx = hasExplicitSelection ? -1 : pickDefaultSupplierIndex(suppliers);

        return {
          id: r.id ?? 0,                               // only if your API supports updating existing lines
          itemId: r.itemId,
          binId: r.binId ?? null,                      // your API ignores this if not needed
          WarehouseTypeId: this.warehouseTypeId,       // matches your C# `l.WarehouseTypeId`
          status: this.status,
          onHand: toNum(r.onHand),
          min: toNum(r.min),
          max: toNum(r.max),
          reorderQty: toNum(r.reorderQty),
          leadDays: toNum(r.leadDays),
          usageHorizon: toNum(r.usageHorizon),
          suggested: toNum(r.suggested),
          selected: !!r.selected,                      // row-level checkbox, if you have one

          // IMPORTANT: only send fields your table accepts
          supplierBreakdown: suppliers.map((s, i) => ({

            supplierId: s.supplierId,          // normalize your source
            price: toNum(s.price),
            qty: toNum(s.qty ?? 0),
            selected: s.selected
          }))
        };
      })
    };

    //only insert and below update code not posted in db

     this.reorderPlanningService.insertStockReorder(payload).subscribe((res) => {
      console.log(res)
        // if (res.isSuccess) {
        //   Swal.fire({
        //     title: "Hi",
        //     text: res.message,
        //     icon: "success",
        //     allowOutsideClick: false,
        //   });
        //   this.router.navigateByUrl('/Inventory/list-stockreorderplanning')
        // }
      });


    // if (this.stockReorderId) {
    //   this.reorderPlanningService.updateStockReorder(payload).subscribe({
    //     next: (res: any) => {
    //       if (res?.isSuccess) {
    //         Swal.fire({
    //           icon: 'success',
    //           title: 'Stock Rorder updated',
    //           text: res.message || 'Lines saved.',
    //           confirmButtonColor: '#2E5F73'
    //         });
    //         this.router.navigateByUrl('/Inventory/list-stockreorderplanning');
    //       } else {
    //         Swal.fire({
    //           icon: 'error',
    //           title: 'Failed',
    //           text: res?.message || 'Unable to save review.',
    //           confirmButtonColor: '#2E5F73'
    //         });
    //       }
    //     },
    //     error: () => {
    //       Swal.fire({
    //         icon: 'error',
    //         title: 'Error',
    //         text: 'Something went wrong while saving review.',
    //         confirmButtonColor: '#2E5F73'
    //       });
    //     }
    //   });
    // } else {
     
    // }
  }
  onCancel() {
    this.router.navigateByUrl('/Inventory/list-stockreorderplanning')
  }

  onSupplierToggle(row: { supplierBreakdown }, clicked) {
    // if user turned one ON, force all others OFF
    if (clicked.selected) {
      (row.supplierBreakdown ?? []).forEach(s => {
        if (s !== clicked) s.selected = false;
      });
    }
    // if user turned the only one OFF, we allow “none selected” (no-op)
  }
  runSuggestAndDraft() {
  this.saveDraft(1);
  this.onSuggestPO();
}
}

function toNum(v: any, d = 0) { return Number.isFinite(+v) ? +v : d; }
