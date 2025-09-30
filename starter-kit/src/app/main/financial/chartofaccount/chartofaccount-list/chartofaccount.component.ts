// chartofaccount.component.ts
import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
// If your service path differs, update the import:
import { ChartofaccountService } from '../chartofaccount.service';
import { CoreConfigService } from '@core/services/config.service';
import { CoreSidebarService } from '@core/components/core-sidebar/core-sidebar.service';
// import { DatatableComponent } from '@swimlane/ngx-datatable'; // optional strong typing

/** Raw flat shape from API */
interface CoaFlat {
  id: number;
  headCode: number;
  headName: string;
  openingBalance: number;
  balance: number;
  parentHead?: number | null; // parent = Id of parent row
  isActive?: boolean;
}

/** Node used by table (parent with children) */
interface CoaNode extends CoaFlat {
  children: CoaFlat[];
  hasChildren: boolean;
  $$expanded?: boolean;
}

@Component({
  selector: 'app-chartofaccount',
  templateUrl: './chartofaccount.component.html',
  styleUrls: ['./chartofaccount.component.scss'],
  encapsulation:ViewEncapsulation.None
})
export class ChartofaccountComponent implements OnInit {
  // @ViewChild(DatatableComponent) table!: DatatableComponent;
  @ViewChild('table') table: any;

  headervalue = 'Chart of Accounts';
  selectedOption = 10;          // page size (ngx-datatable [limit])
  searchValue = '';
  isLoading = false;

  /** Parents only (each can have children) */
  rows: CoaNode[] = [];
  /** Bound to datatable (filtered rows) */
  displayRows: CoaNode[] = [];

  constructor(
    private router: Router,
    private service: ChartofaccountService,
    private _coreSidebarService: CoreSidebarService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  /** Fetch and build parent->children structure */
  private load(): void {
    this.isLoading = true;
    this.service.getAllChartOfAccount().subscribe({
      next: (res: any) => {
        const flat: CoaFlat[] = (res.data || []).map(x => ({
          id: Number(x.id),
          headCode: Number(x.headCode ?? 0),
          headName: String(x.headName ?? ''),
          openingBalance: Number(x.openingBalance ?? 0),
          balance: Number(x.balance ?? 0),
          parentHead: x.parentHead == null ? 0 : Number(x.parentHead),
          isActive: x.isActive ?? true
        }));

        // Group children by parent Id
        const childrenByParent = new Map<number, CoaFlat[]>();
        flat.forEach(r => {
          const p = Number(r.parentHead || 0);
          if (!p) return; // only children have a non-zero parent
          if (!childrenByParent.has(p)) childrenByParent.set(p, []);
          childrenByParent.get(p)!.push(r);
        });

        // Parents are rows with parentHead 0 / null
        this.rows = flat
          .filter(r => !r.parentHead || r.parentHead === 0)
          .sort((a, b) => a.headCode - b.headCode)
          .map(p => {
            const kids = (childrenByParent.get(p.id) || []).sort((a, b) => a.headCode - b.headCode);
            return {
              ...p,
              children: kids,
              hasChildren: kids.length > 0
            } as CoaNode;
          });

        this.displayRows = [...this.rows];
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.alert('error', 'Failed to load Chart of Accounts', this.errMsg(err));
      }
    });
  }

  /** Expand/collapse a parent row */
  toggleRow(row: CoaNode) {
    if (!row.hasChildren || !this.table) return;
    this.table.rowDetail.toggleExpandRow(row);
  }

  /** Search across code/name/balances; keeps matching children under parents */
  filterUpdate(): void {
    const term = (this.searchValue || '').toLowerCase().trim();
    if (!term) {
      this.displayRows = [...this.rows];
      return;
    }

    const contains = (v?: string | number) => (v ?? '').toString().toLowerCase().includes(term);

    this.displayRows = this.rows
      .map(parent => {
        const parentMatch =
          contains(parent.headCode) ||
          contains(parent.headName) ||
          contains(parent.openingBalance) ||
          contains(parent.balance);

        const filteredChildren = parent.children.filter(c =>
          contains(c.headCode) ||
          contains(c.headName) ||
          contains(c.openingBalance) ||
          contains(c.balance)
        );

        return {
          ...parent,
          children: filteredChildren,
          hasChildren: filteredChildren.length > 0
        } as CoaNode;
      })
      .filter(p => p.hasChildren || (
        contains(p.headCode) ||
        contains(p.headName) ||
        contains(p.openingBalance) ||
        contains(p.balance)
      ));
  }

  /** Actions */
  create(): void {
    this.router.navigateByUrl('financial/coa/create');
  }

  edit(id: number): void {
    this.router.navigateByUrl(`financial/coa/edit/${id}`);
  }

  async del(id: number): Promise<void> {
    const result = await Swal.fire({
      title: 'Confirm Delete',
      text: 'Are you sure you want to delete this item?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#d33'
    });

    if (!result.isConfirmed) return;

    this.service.deleteChartOfAccount(id).subscribe({
      next: () => {
        this.toast('success', 'Deleted successfully');
        this.load();
      },
      error: (err) => {
        this.alert('error', 'Delete failed', this.errMsg(err));
      }
    });
  }

  // ---------- SweetAlert helpers ----------
  private alert(
    icon: 'success' | 'error' | 'warning' | 'info' | 'question',
    title: string,
    text?: string
  ) {
    Swal.fire({ icon, title, text: text || undefined });
  }

  private toast(
    icon: 'success' | 'error' | 'warning' | 'info' | 'question',
    title: string
  ) {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon,
      title,
      showConfirmButton: false,
      timer: 1800,
      timerProgressBar: true
    });
  }

  private errMsg(err: any): string {
    return err?.error?.message || err?.message || 'Please try again.';
  }
    toggleSidebar(name): void {
    this._coreSidebarService.getSidebarRegistry(name).toggleOpen();
  }
}
