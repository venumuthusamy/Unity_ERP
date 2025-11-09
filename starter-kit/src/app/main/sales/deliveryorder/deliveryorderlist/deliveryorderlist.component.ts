import { Component, OnInit, ViewEncapsulation, AfterViewInit, AfterViewChecked } from '@angular/core';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import * as feather from 'feather-icons';

// Services (adjust import paths if yours differ)
import { DeliveryOrderService } from '../deliveryorder.service';
import { DriverService } from 'app/main/master/driver/driver.service';
import { VehicleService } from 'app/main/master/vehicle/vehicle.service';
import { ItemsService } from 'app/main/master/items/items.service';
import { UomService } from 'app/main/master/uom/uom.service';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

// -------- Types for rows/lines (UI) ----------
type DoRow = {
  id: number;
  doNumber: string;
  status: number;        // 0 Draft, 1 Pending, 2 Approved, 3 Rejected, 4 Posted
  soId: number | null;
  salesOrderNo:string;
  packId: number | null;
  driverId: number | null;
  vehicleId: number | null;
  routeName: string | null;
  deliveryDate: string | Date | null;
  isPosted: boolean | number; // could be 0/1 from API
};

type DoLineRow = {
  id: number;
  doId: number;
  soLineId: number | null;
  packLineId: number | null;
  itemId: number | null;
  itemName: string;
  uomId?: number | null; // sometimes you may have ID
  uom?: string | null;   // often text for DO
  qty: number;
  notes?: string | null;
};

@Component({
  selector: 'app-deliveryorderlist',
  templateUrl: './deliveryorderlist.component.html',
  styleUrls: ['./deliveryorderlist.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class DeliveryorderlistComponent implements OnInit, AfterViewInit, AfterViewChecked {

  // table
  rows: DoRow[] = [];
  allRows: DoRow[] = [];
  selectedOption = 10;
  searchValue = '';

  // lookups
  driverMap  = new Map<number, string>(); // id -> driver name
  vehicleMap = new Map<number, string>(); // id -> vehicle no
  itemNameMap = new Map<number, string>(); // id -> item name
  uomMap      = new Map<number, string>(); // id -> uom name

  // lines modal
  showLinesModal = false;
  activeDo: DoRow | null = null;
  modalLines: DoLineRow[] = [];
  modalTotalQty = 0;

  constructor(
    private router: Router,
    private doSvc: DeliveryOrderService,
    private driverSvc: DriverService,
    private vehicleSvc: VehicleService,
    private itemsSvc: ItemsService,
    private uomSvc: UomService,
  ) {}

  ngOnInit(): void {
    this.loadLookups();
    this.loadList();
  }

  ngAfterViewInit(): void { feather.replace(); }
  ngAfterViewChecked(): void { feather.replace(); }

  // ---------------- Lookups ----------------
  private loadLookups(): void {
    // Drivers
    this.driverSvc.getAllDriver().subscribe((res: any) => {
      const arr = res?.data ?? res ?? [];
      for (const r of arr) {
        const id = Number(r.id ?? r.Id);
        const name = String(r.name ?? r.Name ?? r.driverName ?? '').trim();
        if (id) this.driverMap.set(id, name);
      }
    });

    // Vehicles
    this.vehicleSvc.getVehicles().subscribe((res: any) => {
      const arr = res?.data ?? res ?? [];
      for (const r of arr) {
        const id = Number(r.id ?? r.Id);
        const no = String(r.vehicleNo ?? r.VehicleNo ?? r.vehicleNumber ?? '').trim();
        if (id) this.vehicleMap.set(id, no);
      }
    });

    // Items (for modal)
    this.itemsSvc.getAllItem().subscribe((res: any) => {
      const arr = res?.data ?? res ?? [];
      for (const r of arr) {
        const id = Number(r.id ?? r.itemId ?? 0);
        const name = String(r.itemName ?? r.name ?? '').trim();
        if (id) this.itemNameMap.set(id, name);
      }
    });

    // UOMs (if ever referenced by id in lines)
    this.uomSvc.getAllUom().subscribe((res: any) => {
      const arr = res?.data ?? res ?? [];
      for (const r of arr) {
        const id = Number(r.id ?? r.Id);
        const name = String(r.name ?? r.Name ?? '').trim();
        if (id) this.uomMap.set(id, name);
      }
    });
  }

  // ---------------- List ----------------
  private loadList(): void {
    // Expect your API to expose GET /DeliveryOrder/GetAll (or similar)
    // If your service doesn't have getAll(), add it there to call that endpoint.
    this.doSvc.getAll().subscribe((res: any) => {
      const data = res?.data ?? res ?? [];
      this.allRows = data.map((d: any) => ({
        id: Number(d.id ?? d.Id),
        doNumber: String(d.doNumber ?? d.DoNumber ?? ''),
        status: Number(d.status ?? d.Status ?? 0),
        soId: d.soId ?? d.SoId ?? null,
        salesOrderNo:d.salesOrderNo,
        packId: d.packId ?? d.PackId ?? null,
        driverId: (d.driverId ?? d.DriverId ?? null) !== null ? Number(d.driverId ?? d.DriverId) : null,
        vehicleId: (d.vehicleId ?? d.VehicleId ?? null) !== null ? Number(d.vehicleId ?? d.VehicleId) : null,
        routeName: String(d.routeName ?? d.RouteName ?? '') || null,
        deliveryDate: d.deliveryDate ?? d.DeliveryDate ?? null,
        isPosted: (d.isPosted ?? d.IsPosted ?? 0)
      })) as DoRow[];

      this.rows = [...this.allRows];
    });
  }

  // ---------------- UI helpers ----------------
  statusLabel(v: number) {
    return v === 0 ? 'Pending'
         : v === 1 ? 'Delivered'
         : v === 2 ? 'Approved'
         : v === 3 ? 'Rejected'
         : v === 4 ? 'Posted'
         : 'Unknown';
  }

  statusClass(v: number) {
    return {
      'badge-secondary': v === 0,
      'badge-warning' : v === 1,
      'badge-success' : v === 2,
      'badge-danger'  : v === 3 || v === 4
    };
  }

  getDriverName(id?: number | null)  { return id ? (this.driverMap.get(id) || '') : ''; }
  getVehicleNo(id?: number | null)   { return id ? (this.vehicleMap.get(id) || '') : ''; }
  getItemName(id?: number | null)    { return id ? (this.itemNameMap.get(id) || '') : ''; }
  getUomName(id?: number | null)     { return id != null ? (this.uomMap.get(id) || '') : ''; }

  // ---------------- Paging + Search ----------------
  onLimitChange(ev: Event) {
    const val = Number((ev.target as HTMLSelectElement).value);
    this.selectedOption = val || 10;
  }

  filterUpdate(_: any) {
    const q = (this.searchValue || '').trim().toLowerCase();
    if (!q) {
      this.rows = [...this.allRows];
      return;
    }

    this.rows = this.allRows.filter(r => {
      const doNum  = (r.doNumber || '').toLowerCase();
      const route  = (r.routeName || '').toLowerCase();
      const driver = this.getDriverName(r.driverId)?.toLowerCase() || '';
      const status = this.statusLabel(r.status).toLowerCase();
      const soId   = String(r.salesOrderNo ?? '').toLowerCase();

      return doNum.includes(q) || route.includes(q) || driver.includes(q) || status.includes(q) || soId.includes(q);
    });
  }

  // ---------------- Lines Modal ----------------
 openLinesModal(row: DoRow) {
  this.activeDo = row;
  this.showLinesModal = true;

  // Normalize to Observable<any>
  let loadLines$: Observable<any>;

  // If your service has getLines(id), use it; else fallback to get(id)
  if ('getLines' in this.doSvc && typeof (this.doSvc as any).getLines === 'function') {
    loadLines$ = (this.doSvc as any).getLines(row.id).pipe(
      // many APIs wrap in { data: [...] }
      map((res: any) => res?.data ?? res),
      catchError(err => of({ __error: err }))
    );
  } else {
    loadLines$ = this.doSvc.get(row.id).pipe(
      // many APIs return { data: { header, lines } }
      map((res: any) => res?.data ?? res),
      catchError(err => of({ __error: err }))
    );
  }

  loadLines$.subscribe({
    next: (res: any) => {
      if (res?.__error) {
        this.modalLines = [];
        this.modalTotalQty = 0;
        return;
      }

      // res can be either an array of lines OR an object with { header, lines }
      const linesRaw =
        Array.isArray(res) ? res :
        res?.lines ?? res?.Lines ?? [];

      this.modalLines = (linesRaw || []).map((l: any) => ({
        id: Number(l.id ?? l.Id ?? 0),
        doId: Number(l.doId ?? l.DoId ?? row.id),
        soLineId: (l.soLineId ?? l.SoLineId ?? null) !== null ? Number(l.soLineId ?? l.SoLineId) : null,
        packLineId: (l.packLineId ?? l.PackLineId ?? null) !== null ? Number(l.packLineId ?? l.PackLineId) : null,
        itemId: (l.itemId ?? l.ItemId ?? null) !== null ? Number(l.itemId ?? l.ItemId) : null,
        itemName: String(l.itemName ?? l.ItemName ?? ''),
        uom: (l.uom ?? l.Uom ?? null),
        uomId: (l.uomId ?? l.UomId ?? null) !== null ? Number(l.uomId ?? l.UomId) : null,
        qty: Number(l.qty ?? l.Qty ?? 0),
        notes: l.notes ?? l.Notes ?? null
      })) as DoLineRow[];

      this.modalTotalQty = this.modalLines.reduce((s, x) => s + (+x.qty || 0), 0);
    },
    error: _err => {
      // (won’t usually run due to catchError above, but safe)
      this.modalLines = [];
      this.modalTotalQty = 0;
    }
  });
}

  closeLinesModal() {
    this.showLinesModal = false;
    this.activeDo = null;
    this.modalLines = [];
    this.modalTotalQty = 0;
  }

  // ---------------- Actions ----------------
  goToCreate() { this.router.navigate(['/Sales/Delivery-order-create']); }

  editDo(id: number) {
    this.router.navigate(['/Sales/Delivery-order-edit', id]);
  }

  deleteDo(id: number) {
    Swal.fire({
      icon: 'warning',
      title: 'Delete Delivery Order?',
      text: 'This action cannot be undone.',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#9ca3af',
      confirmButtonText: 'Delete'
    }).then(result => {
      if (!result.isConfirmed) return;

      // implement delete endpoint in service if you haven't yet:
      // e.g., this.doSvc.delete(id).subscribe(...)
      if (!('delete' in this.doSvc) || typeof (this.doSvc as any).delete !== 'function') {
        Swal.fire({ icon: 'info', title: 'Delete not wired yet' });
        return;
      }

      (this.doSvc as any).delete(id).subscribe({
        next: () => {
          this.allRows = this.allRows.filter(r => r.id !== id);
          this.filterUpdate(null);
          Swal.fire('Deleted!', 'Delivery Order has been deleted.', 'success');
        },
        error: () => Swal.fire({ icon: 'error', title: 'Failed to delete' })
      });
    });
  }
}
