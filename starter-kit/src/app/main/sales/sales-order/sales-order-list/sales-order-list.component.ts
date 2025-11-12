// app/main/sales/sales-order/list/sales-order-list.component.ts
import { Component, OnInit, ViewChild, ViewEncapsulation, AfterViewInit, AfterViewChecked } from '@angular/core';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { ColumnMode, DatatableComponent } from '@swimlane/ngx-datatable';
import { DatePipe } from '@angular/common';
import * as feather from 'feather-icons';
import { SalesOrderService } from '../sales-order.service';

type SoLine = {
  id?: number;
  salesOrderId?: number;
  itemId?: number;
  itemName?: string;
  uom?: string;
  quantity?: number;
  unitPrice?: number;
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
    discount: true,
    tax: true,
    total: true,
    lockedQty: true
  };
  getLinesColsCount(): number {
    return 1 + Object.values(this.lineCols).filter(Boolean).length; // 1 for Item
  }

  constructor(
    private salesOrderService: SalesOrderService,
    private router: Router,
    private datePipe: DatePipe
  ) {}

  ngOnInit(): void {
    this.loadRequests();
    this.prefetchDraftsCount(); // show Drafts badge immediately
  }
  ngAfterViewInit(): void { feather.replace(); }
  ngAfterViewChecked(): void { feather.replace(); }

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
  statusClass(row: SoHeader): string {
    const v = Number(row?.status ?? row?.approvalStatus);
    return v === 1 ? 'badge-warning'
         : v === 2 ? 'badge-success'
         : v === 3 ? 'badge-primary'
         : 'badge-secondary';
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
  canApprove(row: SoHeader): boolean {
    const status = Number(row?.status ?? row?.approvalStatus);
    const isActive = (row?.isActive ?? true) === true || row?.isActive === 1;
    return isActive && status === 1;
  }

  // ---------- Routing / CRUD ----------
  openCreate(): void { this.router.navigate(['/Sales/Sales-Order-create']); }
  editSO(row: SoHeader): void { this.router.navigateByUrl(`/Sales/Sales-Order-edit/${row.id}`); }
  deletePO(id: number): void {
    Swal.fire({
      title: 'Are you sure?',
      text: 'This will permanently delete the Sales Order.',
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
        next: () => { row.status = 2; row.approvalStatus = 2; row.approvedBy = 1; Swal.fire('Approved', 'Sales Order approved successfully.', 'success'); },
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
        next: () => { row.isActive = false; Swal.fire('Rejected', 'Sales Order rejected and lines unlocked.', 'success'); },
        error: (err) => { console.error(err); Swal.fire('Error', 'Failed to reject Sales Order.', 'error'); }
      });
    });
  }

  // ---------- Lines modal ----------
  openLinesModal(row: SoHeader): void {
    // Example: hide discount & tax
    this.lineCols.discount = false;
    this.lineCols.tax = false;

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
          reason: 'Warehouse and Supplier is not in the item'
        }));
        this.draftLoading = false;
        this.showDraftsModal = true;
      },
      error: (err) => { this.draftLoading = false; console.error(err); }
    });
  }
  closeDrafts(): void { this.showDraftsModal = false; }
}
