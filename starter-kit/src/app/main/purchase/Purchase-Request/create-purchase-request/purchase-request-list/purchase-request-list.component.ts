import {
  Component,
  OnInit,
  ViewChild,
  ViewEncapsulation,
  AfterViewInit,
  AfterViewChecked,
} from '@angular/core';
import { Router } from '@angular/router';
import { ColumnMode, DatatableComponent } from '@swimlane/ngx-datatable';
import Swal from 'sweetalert2';
import * as feather from 'feather-icons';

import { PurchaseService } from 'app/main/purchase/purchase.service';
import { PrDraftService } from '../../pr-draft.service';

@Component({
  selector: 'app-purchase-request-list',
  templateUrl: './purchase-request-list.component.html',
  styleUrls: ['./purchase-request-list.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class PurchaseRequestListComponent implements OnInit, AfterViewInit, AfterViewChecked {
  @ViewChild(DatatableComponent) table!: DatatableComponent;

  // datatable + filters
  rows: any[] = [];
  tempData: any[] = [];
  public ColumnMode = ColumnMode;
  public selectedOption = 10;
  public searchValue = '';

  // PR lines modal
  showLinesModal = false;
  modalLines: any[] = [];
  modalTotalQty = 0;

  // Drafts
  drafts: any[] = [];
  draftCount = 0;
  showDraftsModal = false;

  userId: string;

  constructor(
    private purchaseService: PurchaseService,
    private draftSvc: PrDraftService,
    private router: Router
  ) {
    this.userId = localStorage.getItem('id') || '';
  }

  // ============== Lifecycle ==============

  ngOnInit(): void {
    this.loadRequests();
    this.refreshDraftCount();
  }

  ngAfterViewInit(): void {
    feather.replace();
  }

  ngAfterViewChecked(): void {
    feather.replace();
  }

  // ============== Main PR list ==============

  loadRequests(): void {
    this.purchaseService.getAll().subscribe({
      next: (res: any) => {
        const list = (res?.data || []).map((req: any) => ({
          ...req,
          prLines: Array.isArray(req.prLines) ? req.prLines : this.safeParse(req.prLines),
        }));
        this.rows = list;
        this.tempData = [...list];
        if (this.table) this.table.offset = 0;
      },
      error: (err) => console.error('Error loading PRs', err),
    });
  }

  private safeParse(json: any): any[] {
    try {
      return JSON.parse(json || '[]');
    } catch {
      return [];
    }
  }

  filterUpdate(event: any): void {
    const val = (event?.target?.value ?? '').toString().toLowerCase();
    if (!val) {
      this.rows = [...this.tempData];
      if (this.table) this.table.offset = 0;
      return;
    }
    this.rows = this.tempData.filter((d: any) =>
      (d.purchaseRequestNo || '').toLowerCase().includes(val) ||
      (d.requester || '').toLowerCase().includes(val) ||
      (d.departmentName || '').toLowerCase().includes(val) ||
      (d.deliveryDate || '').toLowerCase().includes(val)
    );
    if (this.table) this.table.offset = 0;
  }

  onLimitChange(e: any): void {
    const v = Number(e?.target?.value || 10);
    this.selectedOption = v > 0 ? v : 10;
    if (this.table) this.table.offset = 0;
  }

  editRequest(id: number): void {
    this.router.navigateByUrl(`/purchase/Edit-PurchaseRequest/${id}`);
  }

  goToCreate(): void {
    this.router.navigate(['/purchase/Create-PurchaseRequest']);
  }

  deleteRequest(id: number): void {
    Swal.fire({
      title: 'Are you sure?',
      text: 'This will permanently delete the purchase request.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!',
    }).then((r) => {
      if (r.value) {
        this.purchaseService.delete(id).subscribe({
          next: () => {
            this.loadRequests();
            Swal.fire('Deleted!', 'Purchase request has been deleted.', 'success');
          },
          error: (err) => console.error('Error deleting request', err),
        });
      }
    });
  }

  // ============== Row lines modal ==============

  openLinesModal(row: any): void {
    const lines = Array.isArray(row?.prLines) ? row.prLines : this.safeParse(row?.prLines);
    const total = (lines || []).reduce((sum: number, l: any) => sum + (Number(l?.qty) || 0), 0);
    this.modalLines = lines || [];
    this.modalTotalQty = total;
    this.showLinesModal = true;
  }

  closeLinesModal(): void {
    this.showLinesModal = false;
  }

  // ============== Drafts ==============

  openDrafts(): void {
    this.showDraftsModal = true;
    this.loadDrafts();
  }

  closeDrafts(): void {
    this.showDraftsModal = false;
  }

  loadDrafts(): void {
    this.draftSvc.getAll().subscribe({
      next: (res) => {
        const list = res?.data ?? [];
        // keep pure drafts only
        this.drafts = list.filter((x: any) => +x.status === 0 || x.status == null);
      },
      error: (err) => console.error('Error loading drafts', err),
    });
  }

  refreshDraftCount(): void {
    this.draftSvc.getAll().subscribe({
      next: (res) => {
        const list = res?.data ?? [];
        this.draftCount = list.filter((x: any) => +x.status === 0 || x.status == null).length;
      },
      error: () => (this.draftCount = 0),
    });
  }

  /**
   * IMPORTANT: Promote button here ONLY opens the draft in the Create screen.
   * It does NOT create a PR yet. The actual promote happens in Create (Convert to PO/RFQ).
   */
  promoteDraft(id: number): void {
    // If you want a confirm before opening, keep this; otherwise navigate directly.
    Swal.fire({
      title: 'Open draft?',
      text: 'Continue editing this draft.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Open',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#2E5F73',
      cancelButtonColor: '#6c757d',
    }).then((r) => {
      if (r.value) {
        this.router.navigate(['/purchase/Create-PurchaseRequest'], { queryParams: { draftId: id } });
      }
    });
  }

  deleteDraft(id: number): void {
    this.draftSvc.delete(id, this.userId).subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: 'Deleted',
          text: 'Draft removed.',
          confirmButtonColor: '#2E5F73',
        });
        this.loadDrafts();
        this.refreshDraftCount();
      },
      error: () =>
        Swal.fire({
          icon: 'error',
          title: 'Delete Failed',
          text: 'Try again.',
          confirmButtonColor: '#2E5F73',
        }),
    });
  }

  // util
  trackById(_: number, row: any) {
    return row?.id ?? _;
  }
}
