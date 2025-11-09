// src/app/main/sales/delivery-order/deliveryordercreate.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';

import { DeliveryOrderService } from '../deliveryorder.service';
import { VehicleService } from 'app/main/master/vehicle/vehicle.service';
import { DriverService } from 'app/main/master/driver/driver.service';
import { SalesOrderService } from '../../sales-order/sales-order.service';
import { UomService } from 'app/main/master/uom/uom.service';

// ------------ Contracts ------------
type DoCreateRequest = {
  soId: number | null;
  packId: number | null;
  driverId: number;
  vehicleId: number | null;
  routeName: string | null;
  deliveryDate: string | null;
  lines: Array<{
    soLineId: number | null;
    packLineId: number | null;
    itemId: number | null;
    itemName: string;
    uom: string | null;
    qty: number;
    notes: string | null;
  }>;
};

type DoUpdateHeaderRequest = {
  driverId: number | null;
  vehicleId: number | null;
  routeName: string | null;
  deliveryDate: string | null;
};

type DoHeaderDto = {
  id: number;
  doNumber: string;
  status: number;
  soId: number | null;
  packId: number | null;
  driverId: number | null;
  vehicleId: number | null;
  routeName: string | null;
  deliveryDate: string | null;
  isPosted: boolean;
};

type DoLineDto = {
  id: number;
  doId: number;
  soLineId: number | null;
  packLineId?: number | null;
  itemId: number | null;
  itemName: string;
  uom: string | null;        // may be name or id-ish string
  uomId?: number | null;     // sometimes APIs return this instead
  qty: number;
  notes: string | null;
};

type SoRedeliveryRow = {
  soLineId: number;
  itemId: number | null;
  itemName: string;
  uom: string | null;        // display-ready (name) after normalization
  ordered: number;
  deliveredBefore: number;
  deliveredOnThisDo: number;
  pending: number;
  deliverMore?: number;      // UI input
};

type SoBrief = { id: number; salesOrderNo: string; customerName?: string };
type Driver = { id: number; name: string };
type Vehicle = { id: number; vehicleNo: string; vehicleType?: string };

type UiSoLine = {
  soLineId: number;
  itemId: number;
  itemName: string;
  uom: string;
  orderedQty: number;
  pendingQty: number;
  deliverQty: number;
  notes?: string | null;
};

type UomRow = { id: number; name: string };

@Component({
  selector: 'app-deliveryordercreate',
  templateUrl: './deliveryordercreate.component.html',
  styleUrls: ['./deliveryordercreate.component.scss']
})
export class DeliveryordercreateComponent implements OnInit {
  // ---- mode ----
  isEdit = false;
  doId: number | null = null;

  // lookups
  soList: SoBrief[] = [];
  driverList: Driver[] = [];
  vehicleList: Vehicle[] = [];

  // UOMs
  uoms: UomRow[] = [];
  uomMap = new Map<number, string>();

  // header selections (both modes)
  selectedSoId: number | null = null;
  driverId: number | null = null;
  vehicleId: number | null = null;
  deliveryDate: string | null = null;  // yyyy-MM-dd
  routeText: string | null = null;

  // create-mode SO lines
  soLines: UiSoLine[] = [];
  totalDeliverQty = 0;

  // edit-mode lines
  editLines: DoLineDto[] = [];
  totalEditQty = 0;

  // re-delivery
  redeliveryRows: SoRedeliveryRow[] = [];
  totalPending = 0;
  totalDeliverMore = 0;

  today = this.toDateInput(new Date());

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private vehicleSrv: VehicleService,
    private driverSrv: DriverService,
    private soSrv: SalesOrderService,
    private doSrv: DeliveryOrderService,
    private uomService: UomService
  ) {}

  // ---------------- Lifecycle ----------------
  ngOnInit(): void {
    this.detectMode();
    this.loadUoms();          // load UOMs first (for label resolution)
    this.loadDropdowns();
    if (this.isEdit && this.doId) {
      this.loadForEdit(this.doId);
    }
  }

  private detectMode() {
    const idStr = this.route.snapshot.paramMap.get('id');
    this.isEdit = !!idStr;
    this.doId = idStr ? +idStr : null;
  }

  // ---------------- UOMs ----------------
  private loadUoms() {
    this.uomService.getAllUom().subscribe((res: any) => {
      const arr = res?.data ?? res ?? [];
      this.uoms = arr.map((u: any) => ({
        id: Number(u.id ?? u.Id),
        name: String(u.name ?? u.Name ?? '').trim()
      }));
      this.uomMap.clear();
      for (const u of this.uoms) this.uomMap.set(u.id, u.name);
    });
  }

  /** Convert a uom value (name or id) to display name */
  uomLabel(uom: any): string {
    if (uom == null || uom === '') return '-';
    // numeric-ish? try map
    const n = Number(uom);
    if (!isNaN(n) && `${n}`.trim() === `${uom}`.trim()) {
      return this.uomMap.get(n) || `#${n}`;
    }
    // already a string name
    return String(uom);
  }

  // ---------------- Lookups ----------------
  private loadDropdowns() {
    // Sales Orders
    this.soSrv.getSO().subscribe((res: any) => {
      const arr = res?.data ?? res ?? [];
      this.soList = arr.map((r: any) => ({
        id: Number(r.id ?? r.Id),
        salesOrderNo: String(r.salesOrderNo ?? r.soNumber ?? r.number ?? r.Number ?? ''),
        customerName: String(r.customerName ?? r.CustomerName ?? '')
      }));
    });

    // Drivers
    this.driverSrv.getAllDriver().subscribe((res: any) => {
      const arr = res?.data ?? res ?? [];
      this.driverList = arr.map((r: any) => ({
        id: Number(r.id ?? r.Id),
        name: String(r.name ?? r.Name ?? r.driverName ?? '')
      }));
    });

    // Vehicles
    this.vehicleSrv.getVehicles().subscribe((res: any) => {
      const arr = res?.data ?? res ?? [];
      this.vehicleList = arr.map((r: any) => ({
        id: Number(r.id ?? r.Id),
        vehicleNo: String(r.vehicleNo ?? r.VehicleNo ?? r.vehicleNumber ?? ''),
        vehicleType: r.vehicleType ?? r.VehicleType ?? null
      }));
    });
  }

  // ---------------- Load existing DO (edit) ----------------
  private loadForEdit(id: number) {
    this.doSrv.get(id).subscribe((res: any) => {
      const hdr: DoHeaderDto = res?.data?.header ?? res?.header ?? res;
      const lines: DoLineDto[] = res?.data?.lines ?? res?.lines ?? [];
      if (!hdr) {
        Swal.fire({ icon: 'error', title: 'Delivery Order not found' });
        this.router.navigate(['/Sales/Delivery-order-list']);
        return;
      }

      // bind header
      this.selectedSoId = hdr.soId ?? null;
      this.driverId     = hdr.driverId ?? null;
      this.vehicleId    = hdr.vehicleId ?? null;
      this.routeText    = hdr.routeName ?? null;
      this.deliveryDate = this.toDateInput(hdr.deliveryDate);

      // existing DO lines (normalize qty & uom label)
      this.editLines = (lines || []).map(l => ({
        ...l,
        qty: Number(l.qty || 0),
        // Prefer explicit name if we already have one; else map uomId if present
        uom: l.uom ?? (l.uomId != null ? (this.uomMap.get(Number(l.uomId)) || String(l.uomId)) : null)
      }));
      this.recalcEditTotals();

      // re-delivery snapshot
      if (hdr.soId) {
        this.doSrv.getSoSnapshot(id).subscribe((rows: any[]) => {
          this.redeliveryRows = (rows || []).map(r => ({
            soLineId: Number(r.soLineId),
            itemId:  (r.itemId ?? null) !== null ? Number(r.itemId) : null,
            itemName: String(r.itemName ?? ''),
            // normalize UOM to display name:
            uom: r.uomName
                ?? (r.uomId != null ? (this.uomMap.get(Number(r.uomId)) || String(r.uomId)) : (r.uom ?? null)),
            ordered: +r.ordered || 0,
            deliveredBefore: +r.deliveredBefore || 0,
            deliveredOnThisDo: +r.deliveredOnThisDo || 0,
            pending: +r.pending || 0,
            deliverMore: 0
          }));
          this.computeRedeliveryTotals();
        });
      }
    });
  }

  // ---------------- Re-delivery helpers ----------------
  computeRedeliveryTotals() {
    this.totalPending = this.redeliveryRows.reduce((s, x) => s + (+x.pending || 0), 0);
    this.totalDeliverMore = this.redeliveryRows.reduce((s, x) => s + (+x.deliverMore || 0), 0);
  }

  clampDeliverMore(row: SoRedeliveryRow) {
    const v = Number(row.deliverMore || 0);
    if (isNaN(v) || v < 0) row.deliverMore = 0;
    if (v > (row.pending || 0)) row.deliverMore = row.pending || 0;
    this.computeRedeliveryTotals();
  }

  addSelectedRedeliveries() {
    if (!this.isEdit || !this.doId) return;
    const picks = this.redeliveryRows.filter(r => (Number(r.deliverMore) || 0) > 0);
    if (!picks.length) {
      return Swal.fire({ icon: 'info', title: 'Nothing to add', text: 'Enter Deliver More qty first.' });
    }

    let idx = 0, ok = 0, fail = 0;
    const next = () => {
      if (idx >= picks.length) {
        if (fail === 0) {
          Swal.fire({ icon: 'success', title: 'Lines added', text: `${ok} line(s) added` });
        } else {
          Swal.fire({ icon: 'warning', title: 'Partial', text: `${ok} added, ${fail} failed` });
        }
        this.loadForEdit(this.doId!);
        return;
      }
      const r = picks[idx++];
      this.doSrv.addLine({
        doId: this.doId!,
        soLineId: r.soLineId,
        packLineId: null,
        itemId: r.itemId,
        itemName: r.itemName,
        uom: r.uom, // sending the name; backend can accept name or map to id
        qty: Number(r.deliverMore) || 0,
        notes: null
      }).subscribe({
        next: () => { ok++; next(); },
        error: () => { fail++; next(); }
      });
    };
    next();
  }

  // ---------------- Create mode: SO change -> SO lines ----------------
  onSoChanged(soId: number | null) {
    if (this.isEdit) return; // keep DO lines in edit
    this.soLines = [];
    this.totalDeliverQty = 0;
    if (!soId) return;

    this.soSrv.getSOById(soId).subscribe((res: any) => {
      const dto   = res?.data ?? res ?? {};
      const lines = dto.lineItemsList ?? dto.lineItems ?? dto.lines ?? dto.items ?? [];

      this.soLines = lines.map((l: any) => {
        const ordered   = Number(l.quantity ?? l.orderedQty ?? l.qty ?? 0);
        const delivered = Number(l.deliveredQty ?? l.shippedQty ?? 0);
        const pending   = Math.max(ordered - delivered, 0);

        return {
          soLineId: Number(l.id ?? l.soLineId ?? 0),
          itemId: Number(l.itemId ?? 0),
          itemName: String(l.itemName ?? ''),
          uom: String(l.uomName ?? l.uom ?? ''), // friendly name
          orderedQty: ordered,
          pendingQty: pending || ordered,
          deliverQty: pending || ordered,
          notes: ''
        } as UiSoLine;
      });

      this.recalcTotals();
    });
  }

  // ---------------- Totals ----------------
  recalcTotals() {
    for (const l of this.soLines) {
      const v = Number(l.deliverQty ?? 0);
      if (isNaN(v) || v < 0) l.deliverQty = 0;
      if (l.deliverQty > l.pendingQty) l.deliverQty = l.pendingQty;
    }
    this.totalDeliverQty = this.soLines.reduce((s, x) => s + (Number(x.deliverQty) || 0), 0);
  }

  recalcEditTotals() {
    this.totalEditQty = this.editLines.reduce((s, x) => s + (Number(x.qty) || 0), 0);
  }

  trackBySoLineId = (_: number, row: UiSoLine) => row.soLineId;
  trackByLineId   = (_: number, row: { id: number }) => row.id;

  // ---------------- Save (Create or Edit) ----------------
  saveDo() {
    // validations
    if (!this.selectedSoId) {
      return Swal.fire({ icon: 'warning', title: 'Sales Order required' });
    }
    if (!this.deliveryDate || !this.driverId || !this.vehicleId) {
      return Swal.fire({ icon: 'warning', title: 'Fill Driver, Vehicle and Delivery Date' });
    }

    if (!this.isEdit) {
      // CREATE
      const anyQty = this.soLines.some(l => (Number(l.deliverQty) || 0) > 0);
      if (!anyQty) {
        return Swal.fire({ icon: 'warning', title: 'Enter at least one deliver quantity' });
      }

      const payload: DoCreateRequest = {
        soId: this.selectedSoId,
        packId: null,
        driverId: this.driverId!,
        vehicleId: this.vehicleId!,
        routeName: (this.routeText || '').trim() || null,
        deliveryDate: this.deliveryDate,
        lines: this.soLines
          .filter(l => (Number(l.deliverQty) || 0) > 0)
          .map(l => ({
            soLineId: l.soLineId ?? null,
            packLineId: null,
            itemId: l.itemId ?? null,
            itemName: l.itemName || '',
            uom: (l.uom || '').toString(),
            qty: Number(l.deliverQty) || 0,
            notes: l.notes || null
          }))
      };

      this.doSrv.create(payload).subscribe({
        next: (res: any) => {
          const id = res?.data ?? res;
          Swal.fire({ icon: 'success', title: 'Delivery Order created', text: `DO #${id}` });
          this.router.navigate(['/Sales/Delivery-order-edit', id]);
        },
        error: () => Swal.fire({ icon: 'error', title: 'Failed to create DO' })
      });

    } else {
      // EDIT: update header only
      const payload: DoUpdateHeaderRequest = {
        driverId: this.driverId,
        vehicleId: this.vehicleId,
        routeName: (this.routeText || '').trim() || null,
        deliveryDate: this.deliveryDate
      };

      this.doSrv.updateHeader(this.doId!, payload).subscribe({
        next: () => Swal.fire({ icon: 'success', title: 'Header updated' }),
        error: () => Swal.fire({ icon: 'error', title: 'Failed to update header' })
      });
    }
  }

  // ---------------- Edit lines: remove ----------------
  removeEditLine(lineId: number) {
    if (!this.isEdit) return;
    Swal.fire({
      icon: 'warning',
      title: 'Remove this line?',
      showCancelButton: true,
      confirmButtonText: 'Remove',
      confirmButtonColor: '#d33'
    }).then(result => {
      if (!result.isConfirmed) return;
      this.doSrv.removeLine(lineId).subscribe({
        next: () => this.loadForEdit(this.doId!),
        error: () => Swal.fire({ icon: 'error', title: 'Failed to remove line' })
      });
    });
  }

  // ---------------- Utils ----------------
  resetForm(keepDropdowns = false) {
    if (!keepDropdowns) this.selectedSoId = null;
    this.driverId = null;
    this.vehicleId = null;
    this.routeText = null;
    this.deliveryDate = null;
    this.soLines = [];
    this.editLines = [];
    this.redeliveryRows = [];
    this.totalDeliverQty = 0;
    this.totalEditQty = 0;
    this.totalPending = 0;
    this.totalDeliverMore = 0;
  }

  private toDateInput(d: Date | string | null): string | null {
    if (!d) return null;
    const date = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(date.getTime())) return null;
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  goDoList() { this.router.navigate(['/Sales/Delivery-order-list']); }
}
