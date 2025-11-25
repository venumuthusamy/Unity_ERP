import {
  Component,
  OnInit,
  ViewChild,
  ViewEncapsulation,
  AfterViewInit,
  AfterViewChecked
} from '@angular/core';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { ColumnMode, DatatableComponent } from '@swimlane/ngx-datatable';
import { DatePipe } from '@angular/common';
import * as feather from 'feather-icons';

import { POService } from '../purchase-order.service';
import { POTempService } from '../purchase-order-temp.service';
import { PurchaseService } from '../../purchase.service';
import { forkJoin } from 'rxjs';
import { PeriodCloseService } from 'app/main/financial/period-close-fx/period-close-fx.service';
export interface PeriodStatusDto {
  isLocked: boolean;
  periodName?: string;
  periodCode?: string;
  startDate?: string;
  endDate?: string;
}

// this matches what you showed
export interface PeriodStatusResponseRaw {
  isSuccess?: boolean;
  isLocked?: boolean;
  periodName?: string;
  startDate?: string;
  endDate?: string;
  // in case backend later wraps in data
  data?: PeriodStatusDto | null;
}
@Component({
  selector: 'app-purchase-orde-list',
  templateUrl: './purchase-orde-list.component.html',
  styleUrls: ['./purchase-orde-list.component.scss'],
  encapsulation: ViewEncapsulation.None,
  providers: [DatePipe]
})
export class PurchaseOrdeListComponent
  implements OnInit, AfterViewInit, AfterViewChecked {

  @ViewChild(DatatableComponent) table!: DatatableComponent;

  rows: any[] = [];
  tempData: any[] = [];

  public searchValue = '';
  public ColumnMode = ColumnMode;
  public selectedOption = 10;

  // PO lines modal
  showLinesModal = false;
  modalLines: any[] = [];
  modalTotal: number = 0;

  // Drafts
  showDraftsModal = false;
  drafts: any[] = [];

  // Reorder modal
  showReorderModal = false;
  reorderAll: any[] = [];   // master list (reorder PRs)
  reorderRows: any[] = [];  // filtered list
  reorderSearch = '';
  reorderCount = 0;         // available reorder PRs (not used in any PO)
isPeriodLocked = false;
  currentPeriodName = '';
  constructor(
    private poService: POService,
    private router: Router,
    private datePipe: DatePipe,
    private poTempService: POTempService,
    private purchaseService: PurchaseService,
    private periodService: PeriodCloseService
  ) {}

  // ================== Lifecycle ==================

  ngOnInit(): void {
     const today = new Date().toISOString().substring(0, 10);
    this.checkPeriodLockForDate(today);
    this.loadRequests();
    this.loadDrafts();
    this.loadReorderCount();
  }

  ngAfterViewInit(): void {
    feather.replace();
  }

  ngAfterViewChecked(): void {
    feather.replace();
  }

  // ================== Helpers ==================

  get displayReorderCount() {
    return this.reorderCount > 99 ? '99+' : this.reorderCount;
  }

  private checkPeriodLockForDate(dateStr: string): void {
    if (!dateStr) { return; }

    this.periodService.getStatusForDateWithName(dateStr).subscribe({
      next: (res: PeriodStatusDto | null) => {
        this.isPeriodLocked = !!res?.isLocked;
        this.currentPeriodName = res?.periodName || '';
      },
      error: () => {
        // if fails, UI side don’t hard-lock; backend will still protect
        this.isPeriodLocked = false;
        this.currentPeriodName = '';
      }
    });
  }
  // ================== List / Search ==================

  loadRequests(): void {
    this.poService.getPO().subscribe({
      next: (res: any) => {
        const data = res?.data || [];
        this.rows = data.map((req: any) => ({ ...req }));
        this.tempData = [...this.rows];
        if (this.table) this.table.offset = 0;
      },
      error: (err: any) => console.error('Error loading list', err)
    });
  }

  filterUpdate(event: any): void {
    const val = (event?.target?.value || '').toString().toLowerCase();

    if (!val) {
      this.rows = [...this.tempData];
      if (this.table) this.table.offset = 0;
      return;
    }

    const temp = this.tempData.filter((d: any) => {
      const poNo = (d.purchaseOrderNo || '').toString().toLowerCase();
      const supplierName = (d.supplierName || '').toString().toLowerCase();
      const currencyName = (d.currencyName || '').toString().toLowerCase();
      const approvalStatusStr = (d.approvalStatus || '').toString().toLowerCase();
      const poDate = this.datePipe.transform(d.poDate, 'dd-MM-yyyy')?.toLowerCase() || '';
      const deliveryDate = this.datePipe.transform(d.deliveryDate, 'dd-MM-yyyy')?.toLowerCase() || '';

      return (
        poNo.includes(val) ||
        supplierName.includes(val) ||
        currencyName.includes(val) ||
        approvalStatusStr.includes(val) ||
        poDate.includes(val) ||
        deliveryDate.includes(val)
      );
    });

    this.rows = temp;
    if (this.table) this.table.offset = 0;
  }

  // ================== Navigation / Actions ==================

  openCreate(): void {
      if (this.isPeriodLocked) {
      this.showPeriodLockedSwal('create Purchase Requests');
      return;
    }
    this.router.navigate(['/purchase/create-purchaseorder']);
  }

  editPO(row: any): void {
     if (this.isPeriodLocked) {
      this.showPeriodLockedSwal('edit Purchase Requests');
      return;
    }
    this.router.navigateByUrl(`/purchase/edit-purchaseorder/${row.id}`);
  }

  deletePO(id: number): void {
     if (this.isPeriodLocked) {
      this.showPeriodLockedSwal('delete Purchase Requests');
      return;
    }
    Swal.fire({
      title: 'Are you sure?',
      text: 'This will permanently delete the PO.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        this.poService.deletePO(id).subscribe({
          next: () => {
            this.loadRequests();
            Swal.fire('Deleted!', 'PO has been deleted.', 'success');
          },
          error: (err) => console.error('Error deleting request', err)
        });
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
  // Lock edit/delete if approved/rejected
  isRowLocked(row: any): boolean {
    const v = row?.approvalStatus ?? row?.ApprovalStatus ?? row?.status;
    if (v == null) return false;

    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      return s === 'approved' || s === 'rejected';
    }

    const code = Number(v);
    // adjust if your numeric codes differ
    // e.g. 1=Pending, 2=Approved, 3=Rejected
    return [2, 3].includes(code);
  }

  // ================== PO Lines Modal ==================

  openLinesModal(row: any): void {
    let lines: any[] = [];
    try {
      lines = Array.isArray(row?.poLines)
        ? row.poLines
        : JSON.parse(row?.poLines || '[]');
    } catch {
      lines = [];
    }

    const total = lines.reduce(
      (sum, l) => sum + (Number(l?.total) || 0),
      0
    );

    this.modalLines = lines;
    this.modalTotal = total;
    this.showLinesModal = true;
  }

  closeLinesModal(): void {
    this.showLinesModal = false;
  }

  // ================== Drafts ==================

  openDraftsModal(): void {
    this.showDraftsModal = true;
    this.loadDrafts();
  }

  closeDraftsModal(): void {
    this.showDraftsModal = false;
  }

  loadDrafts(): void {
    this.poTempService.getPODrafts().subscribe({
      next: (res: any) => {
        this.drafts = res?.data || [];
      },
      error: (err) => console.error('Error loading PO drafts', err)
    });
  }

  openDraft(d: any): void {
    this.router.navigate(
      ['/purchase/create-purchaseorder'],
      { queryParams: { draftId: d.id } }
    );
    this.closeDraftsModal();
  }

  deleteDraft(id: number): void {
    Swal.fire({
      title: 'Delete draft?',
      text: 'This draft will be permanently removed.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#dc2626'
    }).then(res => {
      if (res.isConfirmed) {
        this.poTempService.deletePODraft(id).subscribe({
          next: () => {
            this.loadDrafts();
            Swal.fire('Deleted', 'Draft removed', 'success');
          },
          error: (err) => console.error('Error deleting draft', err)
        });
      }
    });
  }

  // ================== Reorder PRs ==================

  openReorderDetails(): void {
    this.showReorderModal = true;
    this.loadReorders();
  }

  closeReorderModal(): void {
    this.showReorderModal = false;
    this.reorderSearch = '';
  }

  private safeParseReorder(raw: any, fallback: any[] = []): any[] {
    if (Array.isArray(raw)) return raw;
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(String(raw));
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  loadReorders(): void {
    forkJoin({
      prs: this.purchaseService.getAll(), // { data: [...] }
      pos: this.poService.getPO()         // { data: [...] }
    }).subscribe({
      next: (results: any) => {
        const prsRes = results?.prs;
        const posRes = results?.pos;

        // 1) collect PR numbers already used by any PO
        const usedPrNos = new Set<string>();
        (posRes?.data || []).forEach((po: any) => {
          const lines = Array.isArray(po?.poLines)
            ? po.poLines
            : this.safeParseReorder(po?.poLines, []);
          (lines || []).forEach((ln: any) => {
            const prNo = (ln?.prNo ?? ln?.PRNo ?? ln?.prno ?? ln?.pr_no ?? '')
              .toString()
              .trim();
            if (prNo) usedPrNos.add(prNo);
          });
        });

        // 2) PRs that are reorder AND not used in any PO
        const list = (prsRes?.data || []).map((req: any) => ({
          ...req,
          prLines: Array.isArray(req.prLines)
            ? req.prLines
            : this.safeParseReorder(req.prLines, []),
        }));

        this.reorderAll = list.filter(
          (r: any) =>
            (r.isReorder === true ||
             r.isReorder === 1 ||
             String(r?.isReorder).toLowerCase() === 'true') &&
            !usedPrNos.has((r.purchaseRequestNo || '').toString().trim())
        );

        this.reorderRows = [...this.reorderAll];
        this.filterReorders();
      },
      error: (err) => console.error('Error loading reorder PRs/POs', err)
    });
  }

  loadReorderCount(): void {
    forkJoin({
      prs: this.purchaseService.getAll(), // PRs
      pos: this.poService.getPO()         // POs
    }).subscribe({
      next: (results: any) => {
        const prs = results?.prs?.data || [];
        const pos = results?.pos?.data || [];

        // 1) PR numbers already used in any PO (search in poLines)
        const usedPrNos = new Set<string>();
        pos.forEach((po: any) => {
          const lines = Array.isArray(po?.poLines)
            ? po.poLines
            : this.safeParseReorder(po?.poLines, []);
          lines.forEach((ln: any) => {
            const prNo = (ln?.prNo ?? ln?.PRNo ?? ln?.prno ?? ln?.pr_no ?? '')
              .toString()
              .trim();
            if (prNo) usedPrNos.add(prNo);
          });
        });

        // 2) Normalize PRs, keep reorder ones
        const reorderPRs = prs
          .map((r: any) => ({
            ...r,
            purchaseRequestNo: (r?.purchaseRequestNo || '').toString().trim(),
            prLines: Array.isArray(r?.prLines)
              ? r.prLines
              : this.safeParseReorder(r?.prLines, []),
            isReorder:
              r?.isReorder === true ||
              r?.isReorder === 1 ||
              String(r?.isReorder).toLowerCase() === 'true'
          }))
          .filter((r: any) => r.isReorder);

        // 3) Available PRs (not used by any PO)
        const available = reorderPRs.filter(
          (r: any) => !usedPrNos.has(r.purchaseRequestNo)
        );

        this.reorderAll = reorderPRs;
        this.reorderRows = [...available];

        // 4) set badge count
        this.reorderCount = available.length;
      },
      error: (err) => console.error('Error computing reorder count', err)
    });
  }

  // Client-side search inside Reorder modal
  filterReorders(): void {
    const q = (this.reorderSearch || '').trim().toLowerCase();
    if (!q) {
      this.reorderRows = [...this.reorderAll];
      return;
    }

    this.reorderRows = this.reorderAll.filter((r: any) => {
      const prNo = (r.purchaseRequestNo || r.prNo || '').toString().toLowerCase();
      const req = (r.requester || '').toString().toLowerCase();
      const dep = (r.department || r.departmentName || '').toString().toLowerCase();
      const dd = this.datePipe.transform(r.deliveryDate, 'dd-MM-yyyy')?.toLowerCase() || '';

      return (
        prNo.includes(q) ||
        req.includes(q) ||
        dep.includes(q) ||
        dd.includes(q)
      );
    });
  }

  // when user clicks "Create" on a reorder PR
  createFromReorder(pr: any): void {
    this.router.navigate(
      ['/purchase/create-purchaseorder'],
      { queryParams: { fromReorderPrId: pr.id } }
    );
    this.closeReorderModal();
  }
}
