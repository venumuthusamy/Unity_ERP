import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

import { WarehouseService } from 'app/main/master/warehouse/warehouse.service';
import { StackOverviewService } from './stack-overview.service';
import { MaterialRequisitionService } from '../material-requisation/material-requisition.service';

interface ApiItemRow {
  id?: number | string;
  sku?: string;
  name?: string;
  itemName?: string;
  warehouseName?: string;
  binName?: string;
  onHand?: number;
  reserved?: number;
  available?: number;
  warehouseId?: number;
  binId?: number;
  supplierId?: number | null;
  supplierName?: string | null;
}

interface StockRow {
  idKey: string;
  warehouse: string;
  bin: string;
  onHand: number;
  available: number;
  sku: string | null;
  item: string;
  supplierId?: number | null;
  supplierName: string;
  warehouseId?: number;
  binId?: number;
  apiRow?: ApiItemRow;
}

interface MrListItem {
  id: number;
  mrqNo: string;
  outletId: number | null;
  display: string;
}

interface FromOutletOption {
  id: number;
  name: string;
  label: string;
  reqQty: number;
  onHand: number;
}

@Component({
  selector: 'app-stack-overview',
  templateUrl: './stack-overview.component.html',
  styleUrls: ['./stack-overview.component.scss']
})
export class StackOverviewComponent implements OnInit {

  warehouses: Array<{ id: number; name: string }> = [];
  mrList: MrListItem[] = [];
  fromOutletOptions: FromOutletOption[] = [];

  // ✅ transferred MR ids cache
  transferredMrIds = new Set<number>();

  selectedMrId: number | null = null;
  selectedMrNo: string | null = null;

  destinationOutletId: number | null = null;
  destinationOutletName: string | null = null;

  destinationBinId: number | null = null;
  destinationBinName: string | null = null;

  selectedFromOutletId: number | null = null;
  selectedFromOutletName: string | null = null;

  selectedSku: string | null = null;
  selectedItemName: string | null = null;

  requestedQty: number = 0;
  requesterName: string | null = null;
  reqDate: string | null = null;

  rows: StockRow[] = [];
  filteredRows: StockRow[] = [];

  loading = false;
  errorMsg: string | null = null;
  transferErrorText: string | null = null;

  constructor(
    private warehouseService: WarehouseService,
    private stockService: StackOverviewService,
    private mrService: MaterialRequisitionService,
    private router: Router
  ) {}

  compareById = (a: any, b: any) => String(a) === String(b);

  ngOnInit(): void {
    this.loadWarehouses();
    this.loadStockRows();

    // ✅ Load transferred MR ids first, then load MR list and filter it
    this.loadTransferredMrIdsAndMrList();
  }

  private loadTransferredMrIdsAndMrList(): void {
    this.stockService.getTransferredMrIds().subscribe({
      next: (res: any) => {
        const ids = Array.isArray(res?.data) ? res.data : [];
        this.transferredMrIds = new Set<number>(ids.map((x: any) => Number(x)));
        this.loadMrList(); // load MR list after we know transferred ids
      },
      error: (err) => {
        console.error('Failed to load transferred MR ids', err);
        // even if fail, still show MR list (fallback)
        this.loadMrList();
      }
    });
  }

  private loadWarehouses(): void {
    this.warehouseService.getWarehouse().subscribe({
      next: (res: any) => {
        const data = Array.isArray(res?.data) ? res.data : [];
        this.warehouses = data.map((w: any) => ({
          id: Number(w.id),
          name: w.name || w.warehouseName || `WH-${w.id}`
        }));
        this.rebuildFromOutletOptions();
      },
      error: (err) => console.error('Error loading warehouses', err)
    });
  }

  private loadMrList(): void {
    this.mrService.GetMaterialRequest().subscribe({
      next: (res: any) => {
        const data = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        const list: MrListItem[] = (data || []).map((x: any) => {
          const id = Number(x.id ?? x.mrqId ?? 0);
          const mrqNo = String(x.reqNo ?? x.mrqNo ?? x.mrNo ?? `MRQ-${id}`);
          const outletId = x.outletId ?? x.OutletId ?? null;
          return {
            id,
            mrqNo,
            outletId: outletId != null ? Number(outletId) : null,
            display: mrqNo
          };
        });

        // ✅ FILTER: remove already transferred MR IDs
        this.mrList = list.filter(m => !this.transferredMrIds.has(Number(m.id)));

        // ✅ if currently selected MR became invalid, reset
        if (this.selectedMrId && this.transferredMrIds.has(Number(this.selectedMrId))) {
          this.resetAll();
        }
      },
      error: (err) => console.error('Failed to load MRQ list', err)
    });
  }

  private loadStockRows(): void {
    this.loading = true;
    this.errorMsg = null;

    this.stockService.GetAllStockList().subscribe({
      next: (res: any) => {
        if (res?.isSuccess && Array.isArray(res.data)) {
          this.rows = res.data.map((item: ApiItemRow) => this.toStockRow(item));
          this.applyGrid();
          this.rebuildFromOutletOptions();
        } else {
          this.errorMsg = 'No stock data found.';
        }
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = 'Failed to load stock list.';
        console.error('Stock list load error', err);
      }
    });
  }

  private toStockRow(api: ApiItemRow): StockRow {
    const warehouse = String(api.warehouseName ?? '');
    const bin = String(api.binName ?? '');

    const sku = (api.sku ?? '').toString().trim() || null;
    const item = (api.name ?? api.itemName ?? '').toString();

    const onHand = Number(api.onHand ?? 0);
    const reserved = Number(api.reserved ?? 0);
    const available = Number(api.available != null ? api.available : (onHand - reserved));

    const supplierName = (api.supplierName ?? '').toString().trim() || '-';
    const supplierId = api.supplierId ?? null;

    const idKey = [
      api.id ?? '',
      warehouse,
      bin,
      sku ?? '',
      item,
      String(supplierId ?? '')
    ].join('|').toLowerCase();

    return {
      idKey,
      warehouse,
      bin,
      onHand,
      available,
      sku,
      item,
      supplierName,
      supplierId,
      warehouseId: api.warehouseId,
      binId: api.binId,
      apiRow: api
    };
  }

  trackByRow = (_: number, r: StockRow) => r.idKey;

  onMrChanged(mrId: number | null): void {
    this.transferErrorText = null;

    if (!mrId) {
      this.resetAll();
      return;
    }

    // ✅ prevent selecting already transferred MR (edge-case)
    if (this.transferredMrIds.has(Number(mrId))) {
      Swal.fire({
        icon: 'warning',
        title: 'Already Transferred',
        text: 'This MRQ already transferred, so it is not allowed.'
      });
      this.resetAll();
      return;
    }

    this.selectedMrId = Number(mrId);

    this.mrService.GetMaterialRequestById(Number(mrId)).subscribe({
      next: (res: any) => {
        const dto = res?.data ?? res ?? {};

        this.selectedMrNo = String(dto.reqNo ?? dto.mrqNo ?? dto.mrNo ?? `MRQ-${mrId}`);

        const outletId = dto.outletId ?? dto.OutletId ?? null;
        this.destinationOutletId = outletId != null ? Number(outletId) : null;
        this.destinationOutletName = this.getWarehouseNameById(this.destinationOutletId);

        const bId = dto.binId ?? dto.BinId ?? null;
        this.destinationBinId = bId != null ? Number(bId) : null;
        this.destinationBinName = String(dto.binName ?? dto.BinName ?? '') || null;

        this.requesterName = String(dto.requesterName ?? dto.RequesterName ?? '');
        this.reqDate = String(dto.reqDate ?? dto.date ?? '');

        const lines = dto.lines ?? dto.lineItemsList ?? dto.items ?? [];
        const first = (Array.isArray(lines) && lines.length) ? lines[0] : {};

        const sku = String(first.sku ?? first.Sku ?? first.itemCode ?? '');
        const itemName = String(first.itemName ?? first.ItemName ?? first.name ?? '');

        this.selectedSku = sku || null;
        this.selectedItemName = itemName || null;
        this.requestedQty = Number(first.qty ?? first.quantity ?? 0);

        if (this.selectedFromOutletId != null && this.destinationOutletId != null) {
          if (Number(this.selectedFromOutletId) === Number(this.destinationOutletId)) {
            this.selectedFromOutletId = null;
            this.selectedFromOutletName = null;
          }
        }

        this.rebuildFromOutletOptions();
        this.applyGrid();
      },
      error: (err) => {
        console.error('Failed to load MRQ detail', err);
        Swal.fire({
          icon: 'error',
          title: 'MRQ Load Failed',
          text: 'Could not load Material Requisition details.'
        });
      }
    });
  }

  onFromOutletChanged(fromId: any): void {
    const idNum = fromId == null || fromId === '' ? null : Number(fromId);
    if (!idNum || Number.isNaN(idNum)) {
      this.selectedFromOutletId = null;
      this.selectedFromOutletName = null;
    } else {
      this.selectedFromOutletId = idNum;
      this.selectedFromOutletName = this.getWarehouseNameById(idNum);
    }

    this.applyGrid();
    this.rebuildFromOutletOptions();
  }

  private rebuildFromOutletOptions(): void {
    const req = Number(this.requestedQty ?? 0);
    const sku = (this.selectedSku ?? '').toLowerCase();
    const onHandByWhId = new Map<number, number>();

    if (sku) {
      for (const r of this.rows) {
        if ((r.sku ?? '').toLowerCase() !== sku) continue;
        const wid = Number(r.warehouseId ?? 0);
        if (!wid) continue;
        onHandByWhId.set(wid, (onHandByWhId.get(wid) ?? 0) + Number(r.onHand ?? 0));
      }
    }

    const destId = Number(this.destinationOutletId ?? -999);
    const base = this.warehouses.filter(w => Number(w.id) !== destId);

    this.fromOutletOptions = base.map(w => {
      const whId = Number(w.id);
      const onHand = Number(onHandByWhId.get(whId) ?? 0);
      const name = w.name;
      return {
        id: whId,
        name,
        reqQty: req,
        onHand,
        label: `${name} | Req: ${req} | OnHand: ${onHand}`
      };
    });
  }

  private applyGrid(): void {
    let filtered = [...this.rows];

    if (this.selectedSku) {
      const sku = this.selectedSku.toLowerCase();
      filtered = filtered.filter(r => (r.sku ?? '').toLowerCase() === sku);
    }

    if (this.destinationOutletName) {
      const dn = this.destinationOutletName.toLowerCase();
      filtered = filtered.filter(r => (r.warehouse ?? '').toLowerCase() !== dn);
    }

    if (this.selectedFromOutletId != null) {
      const fromName = this.getWarehouseNameById(this.selectedFromOutletId);
      if (fromName) filtered = filtered.filter(r => (r.warehouse ?? '').toLowerCase() === fromName.toLowerCase());
    }

    this.filteredRows = filtered;
  }

  canTransfer(): boolean {
    this.transferErrorText = null;

    if (!this.selectedMrId) return (this.transferErrorText = 'Select a Material Requisition.'), false;
    if (!this.destinationOutletId) return (this.transferErrorText = 'Destination outlet not found.'), false;
    if (!this.selectedFromOutletId) return (this.transferErrorText = 'Select From Outlet.'), false;
    if (!this.selectedSku) return (this.transferErrorText = 'SKU not found from MR.'), false;
    if (!this.filteredRows?.length) return (this.transferErrorText = 'No rows available for this outlet.'), false;

    return true;
  }

  submitTransfer(): void {
    if (!this.canTransfer()) return;

    const mrId = Number(this.selectedMrId ?? 0);
    const fromWarehouseID = Number(this.selectedFromOutletId ?? 0);
    const toWarehouseID = Number(this.destinationOutletId ?? 0);
    const toBinId = Number(this.destinationBinId ?? 0);

    const now = new Date();
    const userId = 1001;

    const payload = (this.filteredRows ?? []).map(r => ({
      ItemId: Number(r.apiRow?.id ?? 0),
      MrId: mrId,
      FromWarehouseID: fromWarehouseID,
      ToWarehouseID: toWarehouseID,
      ToBinId: toBinId,
      Available: Number(r.available ?? 0),
      OnHand: Number(r.onHand ?? 0),
      isApproved: true,
      CreatedBy: userId,
      CreatedDate: now,
      UpdatedBy: userId,
      UpdatedDate: now,
      FromWarehouseName: this.selectedFromOutletName ?? '',
      ItemName: r.item ?? '',
      Sku: r.sku ?? '',
      BinId: r.binId ?? null,
      BinName: r.bin ?? '',
      Remarks: '',
      SupplierId: (r.supplierId == null ? null : Number(r.supplierId)),
      IsSupplierBased: false
    }));

    this.loading = true;

    this.stockService.insertStock(payload).subscribe({
      next: (_res: any) => {
        this.loading = false;

        // ✅ Remove this MR from dropdown immediately (UX)
        this.transferredMrIds.add(mrId);
        this.mrList = (this.mrList || []).filter(x => Number(x.id) !== mrId);

        Swal.fire({
          icon: 'success',
          title: 'Transfer Created',
          text: `MRQ saved and removed from dropdown.`,
          confirmButtonColor: '#2E5F73'
        }).then(() => {
          // optional: reset current selection after transfer
          this.resetAll();

          this.router.navigate(['/Inventory/create-stocktransfer'], {
            state: { mrId, toWarehouseID, fromWarehouseID, toBinId }
          });
        });
      },
      error: (err) => {
        this.loading = false;
        console.error('Transfer failed', err);
        Swal.fire({
          icon: 'error',
          title: 'Transfer Failed',
          text: err?.error?.message || 'Something went wrong during transfer.'
        });
      }
    });
  }

  private getWarehouseNameById(id: number | null | undefined): string | null {
    if (!id) return null;
    const w = this.warehouses.find(x => Number(x.id) === Number(id));
    return w ? w.name : null;
  }

  private resetAll(): void {
    this.selectedMrId = null;
    this.selectedMrNo = null;

    this.destinationOutletId = null;
    this.destinationOutletName = null;

    this.destinationBinId = null;
    this.destinationBinName = null;

    this.selectedFromOutletId = null;
    this.selectedFromOutletName = null;

    this.selectedSku = null;
    this.selectedItemName = null;

    this.requestedQty = 0;
    this.requesterName = null;
    this.reqDate = null;

    this.rebuildFromOutletOptions();
    this.applyGrid();
  }

  goToStockOverviewList() {
    this.router.navigate(['/Inventory/list-stackoverview']);
  }
}
