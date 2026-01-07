// app/main/sales/sales-order/list/sales-order-list.component.ts
import { Component, OnInit, ViewChild, ViewEncapsulation, AfterViewInit, AfterViewChecked } from '@angular/core';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { ColumnMode, DatatableComponent } from '@swimlane/ngx-datatable';
import { DatePipe } from '@angular/common';
import * as feather from 'feather-icons';
import { SalesOrderService } from '../sales-order.service';
import { PeriodCloseService } from 'app/main/financial/period-close-fx/period-close-fx.service';

type SoLine = {
  id?: number;
  salesOrderId?: number;
  itemId?: number;
  itemName?: string;
  item?: string;
  uom?: string;
  quantity?: number;
  qty?: number;
  unitPrice?: number;
  price?: number;
  discount?: number;
  tax?: string | number;
  total?: number;
  warehouseId?: number | null;
  binId?: number | null;
  supplierId?: number | null;
  lockedQty?: number | null;
};

type SoHeader = {
  id: number;
  salesOrderNo: string;
  customerName: string;
  requestedDate: string | Date;
  deliveryDate: string | Date;
  status: number | string;
  approvalStatus?: number | string;
  isActive?: boolean | number;
  lineItems?: SoLine[] | string;
  approvedBy?: number | null;
  subtotal?: number;
  grandTotal?: number;
};

export interface PeriodStatusDto {
  isLocked: boolean;
  periodName?: string;
  periodCode?: string;
  startDate?: string;
  endDate?: string;
}

@Component({
  selector: 'app-sales-order-list',
  templateUrl: './sales-order-list.component.html',
  styleUrls: ['./sales-order-list.component.scss'],
  encapsulation: ViewEncapsulation.None,
  providers: [DatePipe]
})
export class SalesOrderListComponent implements OnInit, AfterViewInit, AfterViewChecked {
  @ViewChild(DatatableComponent) table!: DatatableComponent;

  // list data
  rows: SoHeader[] = [];
  tempData: SoHeader[] = [];
  searchValue = '';
  ColumnMode = ColumnMode;
  selectedOption = 10;

  // drafts modal
  showDraftsModal = false;
  draftRows: any[] = [];
  draftLoading = false;
  get draftCount(): number { return this.draftRows?.length || 0; }

  // SO Lines modal (dynamic columns)
  showLinesModal = false;
  modalLines: SoLine[] = [];
  modalTotal = 0;
  lineCols = {
    uom: true,
    qty: true,
    unitPrice: true,
    discount: false,
    tax: false,
    total: true,
    lockedQty: true
  };

  isPeriodLocked = false;
  currentPeriodName = '';

  getLinesColsCount(): number {
    return 1 + Object.values(this.lineCols).filter(Boolean).length; // 1 for Item
  }

  constructor(
    private salesOrderService: SalesOrderService,
    private router: Router,
    private datePipe: DatePipe,
    private periodService: PeriodCloseService
  ) {}

  ngOnInit(): void {
    const today = new Date().toISOString().substring(0, 10);
    this.checkPeriodLockForDate(today);
    this.loadRequests();
    this.prefetchDraftsCount(); // badge immediately
  }

  ngAfterViewInit(): void { feather.replace(); }
  ngAfterViewChecked(): void { feather.replace(); }

  private checkPeriodLockForDate(dateStr: string): void {
    if (!dateStr) { return; }

    this.periodService.getStatusForDateWithName(dateStr).subscribe({
      next: (res: PeriodStatusDto | null) => {
        this.isPeriodLocked = !!res?.isLocked;
        this.currentPeriodName = res?.periodName || '';
      },
      error: () => {
        this.isPeriodLocked = false;
        this.currentPeriodName = '';
      }
    });
  }

  private showPeriodLockedSwal(action: string): void {
    Swal.fire(
      'Period Locked',
      this.currentPeriodName
        ? `Period "${this.currentPeriodName}" is locked. You cannot ${action} in this period.`
        : `Selected accounting period is locked. You cannot ${action}.`,
      'warning'
    );
  }

  // ✅ NEW: shortage = ordered - allocated
  getShortageQty(r: any): number {
    const qty = Number(r?.quantity ?? r?.qty ?? 0);
    const locked = Number(r?.lockedQty ?? 0);
    const s = qty - locked;
    return s > 0 ? s : 0;
  }

  // ---------- Data load ----------
  loadRequests(): void {
    this.salesOrderService.getSO().subscribe({
      next: (res: any) => {
        const list: SoHeader[] = (res?.data ?? []).map((r: any) => ({ ...r }));
        this.rows = list;
        this.tempData = list;
        this.filterUpdate({ target: { value: this.searchValue } });
      },
      error: (err) => console.error('Error loading SO list', err)
    });
  }

  // ---------- Search ----------
  filterUpdate(event: any): void {
    const val = (event?.target?.value ?? this.searchValue ?? '').toString().toLowerCase().trim();
    const temp = this.tempData.filter((d: SoHeader) => {
      const soNo = (d.salesOrderNo || '').toString().toLowerCase();
      const cust = (d.customerName || '').toString().toLowerCase();
      const reqDateStr = this.datePipe.transform(d.requestedDate, 'dd-MM-yyyy')?.toLowerCase() || '';
      const delDateStr = this.datePipe.transform(d.deliveryDate, 'dd-MM-yyyy')?.toLowerCase() || '';
      const statusCode = (d.approvalStatus ?? d.status);
      const statusStr = this.statusToText(statusCode).toLowerCase();

      return (
        !val ||
        soNo.includes(val) ||
        cust.includes(val) ||
        reqDateStr.includes(val) ||
        delDateStr.includes(val) ||
        statusStr.includes(val)
      );
    });

    this.rows = temp;
    if (this.table) this.table.offset = 0;
  }

  // ---------- Status helpers ----------
  statusToText(v: any): string {
    const code = Number(v);
    switch (code) {
      case 0: return 'Draft';
      case 1: return 'Pending';
      case 2: return 'Approved';
      case 3: return 'Rejected';
      default: return (v ?? '').toString();
    }
  }

  isRowLocked(row: SoHeader): boolean {
    const v = row?.approvalStatus ?? row?.status;
    if (v == null) return false;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      return s === 'approved' || s === 'rejected';
    }
    const code = Number(v);
    return [2, 3].includes(code);
  }

  // ---------- Routing / CRUD ----------
  openCreate(): void {
    if (this.isPeriodLocked) {
      this.showPeriodLockedSwal('create Sales Orders');
      return;
    }
    this.router.navigate(['/Sales/Sales-Order-create']);
  }

  editSO(row: SoHeader): void {
    if (this.isPeriodLocked) {
      this.showPeriodLockedSwal('edit Sales Orders');
      return;
    }
    this.router.navigateByUrl(`/Sales/Sales-Order-edit/${row.id}`);
  }

  deleteSO(id: number): void {
    if (this.isPeriodLocked) {
      this.showPeriodLockedSwal('delete Sales Orders');
      return;
    }

    Swal.fire({
      title: 'Are you sure?',
      text: 'This will delete the Sales Order (soft delete).',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    }).then(res => {
      if (!res.isConfirmed) return;
      this.salesOrderService.deleteSO(id, 1).subscribe({
        next: () => { this.loadRequests(); Swal.fire('Deleted!', 'Sales Order has been deleted.', 'success'); },
        error: (err) => { console.error(err); Swal.fire('Error', 'Delete failed.', 'error'); }
      });
    });
  }

  // ---------- Approve / Reject ----------
  onApprove(row: SoHeader): void {
    Swal.fire({
      title: 'Approve this Sales Order?',
      text: `SO #${row.salesOrderNo} will be marked as Approved.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, approve',
      confirmButtonColor: '#2E5F73'
    }).then(res => {
      if (!res.isConfirmed) return;
      this.salesOrderService.approveSO(row.id, 1).subscribe({
        next: () => {
          row.status = 2;
          row.approvalStatus = 2;
          row.approvedBy = 1;
          Swal.fire('Approved', 'Sales Order approved successfully.', 'success');
          this.prefetchDraftsCount(); // refresh badge
        },
        error: (err) => { console.error(err); Swal.fire('Error', 'Failed to approve Sales Order.', 'error'); }
      });
    });
  }

  onReject(row: SoHeader): void {
    Swal.fire({
      title: 'Reject this Sales Order?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, reject',
      confirmButtonColor: '#b91c1c'
    }).then(res => {
      if (!res.isConfirmed) return;
      this.salesOrderService.rejectSO(row.id).subscribe({
        next: () => {
          row.status = 3;
          row.approvalStatus = 3;
          row.isActive = false;
          Swal.fire('Rejected', 'Sales Order rejected and lines unlocked.', 'success');
          this.prefetchDraftsCount(); // refresh badge
        },
        error: (err) => { console.error(err); Swal.fire('Error', 'Failed to reject Sales Order.', 'error'); }
      });
    });
  }

  // ---------- Lines modal ----------
  openLinesModal(row: SoHeader): void {
    let lines: SoLine[] = [];
    try {
      if (Array.isArray(row?.lineItems)) lines = row.lineItems as SoLine[];
      else if (row?.lineItems) lines = JSON.parse(row.lineItems as unknown as string);
      else if ((row as any)?.poLines) {
        const poLines = (row as any).poLines;
        lines = Array.isArray(poLines) ? poLines : JSON.parse(poLines);
      }
    } catch { lines = []; }

    const total = (lines ?? []).reduce((sum, l) => sum + (Number((l as any)?.total) || 0), 0);
    this.modalLines = lines ?? [];
    this.modalTotal = total;
    this.showLinesModal = true;
  }

  closeLinesModal(): void { this.showLinesModal = false; }

  // ---------- Drafts ----------
  /** Preload badge on first paint */
  prefetchDraftsCount(): void {
    this.salesOrderService.getDrafts().subscribe({
      next: (res) => { this.draftRows = (res?.data ?? []); },
      error: (err) => console.error('draft count error', err)
    });
  }

  /** Open modal + refresh list */
  openDrafts(): void {
    this.draftLoading = true;
    this.salesOrderService.getDrafts().subscribe({
      next: (res) => {
        this.draftRows = (res?.data ?? []).map((x: any) => ({
          ...x,
          // reason message (you can change)
          reason: this.getShortageQty(x) > 0
            ? 'Insufficient stock / allocation incomplete'
            : 'Allocation missing (WH/SUP/BIN)'
        }));
        this.draftLoading = false;
        this.showDraftsModal = true;
      },
      error: (err) => { this.draftLoading = false; console.error(err); }
    });
  }

  closeDrafts(): void { this.showDraftsModal = false; }
}
