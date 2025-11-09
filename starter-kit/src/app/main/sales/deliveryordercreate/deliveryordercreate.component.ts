// components/delivery-order/deliveryordercreate.component.ts
import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';
import { DeliveryOrderService } from './deliveryorder.service';
import { VehicleService } from 'app/main/master/vehicle/vehicle.service';
import { DriverService } from 'app/main/master/driver/driver.service';
import { SalesOrderService } from '../sales-order/sales-order.service';

type SoBrief = { id: number; number: string; customerName?: string };
type Driver = { id: number; name: string };
type Vehicle = { id: number; vehicleNo: string; vehicleType?: string };

type RouteRow = { id: number; name: string }; // if you don’t have a route API yet, you can fill this statically

type UiSoLine = {
  soLineId: number;
  itemId: number;
  itemName: string;
  uom: string;
  orderedQty: number;
  pendingQty: number;
  deliverQty: number;     // user editable
  notes?: string | null;  // optional
};

@Component({
  selector: 'app-deliveryordercreate',
  templateUrl: './deliveryordercreate.component.html',
  styleUrls: ['./deliveryordercreate.component.scss']
})
export class DeliveryordercreateComponent implements OnInit {
  soList: SoBrief[] = [];
  driverList: Driver[] = [];
  vehicleList: Vehicle[] = [];
  routeList: RouteRow[] = []; // supply from API or static seed below

  // header selections
  selectedSoId: number | null = null;
  driverId: number | null = null;
  vehicleId: number | null = null;
  routeId: number | null = null;
  deliveryDate: string | null = null;

  // lines for the chosen SO
  soLines: UiSoLine[] = [];
  totalDeliverQty = 0;

  // date limit for the input
  today = this.toDateInput(new Date());

  constructor(
    private vehicleSrv: VehicleService,
    private driverSrv: DriverService,
    private soSrv: SalesOrderService,
    private doSrv: DeliveryOrderService, // implement create() inside this
  ) {}

  ngOnInit(): void {
    this.loadDropdowns();
  }

  // ---------------- Init helpers ----------------
  private loadDropdowns() {
    // Sales Orders (brief)
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

    // Routes (replace with your RouteService if you have one)
    this.routeList = [
      { id: 1, name: 'Central East' },
      { id: 2, name: 'North' },
      { id: 3, name: 'West' }
    ];
  }

 onSoChanged(soId: number | null) {
  this.soLines = [];
  this.totalDeliverQty = 0;
  if (!soId) return;

  this.soSrv.getSOById(soId).subscribe((res: any) => {
    const dto   = res?.data ?? res ?? {};
    const lines = dto.lineItemsList ?? dto.lineItems ?? dto.lines ?? dto.items ?? [];

    this.soLines = lines.map((l: any) => {
      const ordered = Number(l.quantity ?? l.orderedQty ?? l.qty ?? 0);
      const delivered = Number(l.deliveredQty ?? l.shippedQty ?? 0); // often 0 for now
      const pending = Math.max(ordered - delivered, 0);

      return {
        soLineId: Number(l.id ?? l.soLineId ?? 0),
        itemId: Number(l.itemId ?? 0),
        itemName: String(l.itemName ?? ''),
        uomId: Number(l.uom ?? l.uomId ?? 0) || null,
        uom: String(l.uomName ?? l.uom ?? ''),   // 👈 friendly UOM name from API
        orderedQty: ordered,
        pendingQty: pending || ordered,
        deliverQty: pending || ordered,
        notes: ''
      } as UiSoLine;
    });

    this.recalcTotals();
  });
}


  // ---------------- Calculations ----------------
  recalcTotals() {
    // clamp deliverQty within [0, pendingQty]
    for (const l of this.soLines) {
      const v = Number(l.deliverQty ?? 0);
      if (isNaN(v) || v < 0) l.deliverQty = 0;
      if (l.deliverQty > l.pendingQty) l.deliverQty = l.pendingQty;
    }
    this.totalDeliverQty = this.soLines.reduce((s, x) => s + (Number(x.deliverQty) || 0), 0);
  }

  trackBySoLineId = (_: number, row: UiSoLine) => row.soLineId;

  // ---------------- Save DO ----------------
  saveDo() {
    if (!this.selectedSoId) {
      return Swal.fire({ icon: 'warning', title: 'Sales Order required' });
    }
    if (!this.deliveryDate || !this.driverId || !this.vehicleId) {
      return Swal.fire({ icon: 'warning', title: 'Fill Driver, Vehicle and Delivery Date' });
    }
    const anyQty = this.soLines.some(l => (Number(l.deliverQty) || 0) > 0);
    if (!anyQty) {
      return Swal.fire({ icon: 'warning', title: 'Enter at least one deliver quantity' });
    }

    const header = {
      soId: this.selectedSoId,
      driverId: this.driverId,
      vehicleId: this.vehicleId,
      routeId: this.routeId ?? null,
      deliveryDate: this.deliveryDate
    };

    const lines = this.soLines
      .filter(l => (Number(l.deliverQty) || 0) > 0)
      .map(l => ({
        soLineId: l.soLineId,
        itemId: l.itemId,
        uom: l.uom,
        deliverQty: Number(l.deliverQty),
        notes: l.notes || null
      }));

    const payload = { header, lines };

    this.doSrv.create(payload).subscribe({
      next: (res: any) => {
        const id = res?.data ?? res;
        Swal.fire({ icon: 'success', title: 'Delivery Order created', text: `DO #${id}` });
        this.resetForm(true);
      },
      error: () => Swal.fire({ icon: 'error', title: 'Failed to create DO' })
    });
  }

  // ---------------- Utils ----------------
  resetForm(keepDropdowns = false) {
    if (!keepDropdowns) {
      this.selectedSoId = null;
    }
    this.driverId = null;
    this.vehicleId = null;
    this.routeId = null;
    this.deliveryDate = null;
    this.soLines = [];
    this.totalDeliverQty = 0;
  }

  private toDateInput(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
