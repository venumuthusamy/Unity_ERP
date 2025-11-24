import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { DatatableComponent } from '@swimlane/ngx-datatable';
import Swal from 'sweetalert2';
import { GeneralLedgerService } from '../general-ledger-service/general-ledger.service';

interface CoaFlat {
  id: number;
  headCode: number;
  headName: string;
  openingBalance: number;
  received: number;
  balance: number;
  parentHead: number;   // 0 = root
  isActive?: boolean;
}

interface CoaNode extends CoaFlat {
  // original backend values (for parent when expanded)
  ownOpening: number;
  ownReceived: number;
  ownBalance: number;

  // current display values
  openingBalance: number;
  received: number;
  balance: number;

  children: CoaNode[];
  hasChildren: boolean;
  $$expanded: boolean;
  level: number;
  parent?: CoaNode | null;
}

@Component({
  selector: 'app-general-ldeger',
  templateUrl: './general-ldeger.component.html',
  styleUrls: ['./general-ldeger.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class GeneralLdegerComponent implements OnInit {

  @ViewChild('table') table: DatatableComponent | any;

  headervalue = 'General Ledger';
  selectedOption = 10;
  searchValue = '';
  isLoading = false;

  roots: CoaNode[] = [];
  displayRows: CoaNode[] = [];

  constructor(
    private service: GeneralLedgerService
  ) { }

  ngOnInit(): void {
    this.load();
  }

  // ================= LOAD DATA =================
  load(): void {
    this.isLoading = true;

    this.service.GetGeneralLedger().subscribe({
      next: (res: any) => {

        const flat: CoaFlat[] = (res.data || []).map((x: any) => ({
          id: Number(x.headId ?? 0),
          headCode: Number(x.headCode ?? 0),
          headName: String(x.headName ?? ''),
          openingBalance: x.openingBalance == null ? 0 : Number(x.openingBalance),
          received: x.received == null ? 0 : Number(x.received),
          balance: x.balance == null ? 0 : Number(x.balance),
          parentHead: x.parentHead == null ? 0 : Number(x.parentHead),
          isActive: x.isActive ?? true
        }));

        const flatActive = flat.filter(r => !!r.isActive);

        const nodesById = new Map<number, CoaNode>();
        const nodesByCode = new Map<number, CoaNode>();

        // create nodes with own* values
        flatActive.forEach(f => {
          const node: CoaNode = {
            ...f,
            ownOpening: f.openingBalance,
            ownReceived: f.received,
            ownBalance: f.balance,
            openingBalance: f.openingBalance,
            received: f.received,
            balance: f.balance,
            children: [],
            hasChildren: false,
            $$expanded: false,
            level: 0,
            parent: null
          };
          nodesById.set(node.id, node);
          nodesByCode.set(node.headCode, node);
        });

        const roots: CoaNode[] = [];

        // link parents / children
        nodesById.forEach(node => {
          const p = node.parentHead ?? 0;

          if (p === 0) {
            roots.push(node);
          } else {
            const parentById = nodesById.get(p);
            const parentByCode = nodesByCode.get(p);
            const parent = parentById ?? parentByCode;

            if (parent) {
              node.parent = parent;
              parent.children.push(node);
              parent.hasChildren = true;
            } else {
              roots.push(node);
            }
          }
        });

        // sort & set level
        const sortAndSetLevel = (list: CoaNode[], level: number) => {
          list.sort((a, b) => a.headCode - b.headCode);
          list.forEach(n => {
            n.level = level;
            if (n.children.length) {
              sortAndSetLevel(n.children, level + 1);
            }
          });
        };
        sortAndSetLevel(roots, 0);

        this.roots = roots;

        // initial collapsed
        this.roots.forEach(r => (r.$$expanded = false));

        this.rebuildDisplayRows();
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: this.errMsg(err),
          confirmButtonColor: '#d33'
        });
      }
    });
  }

  // ===== aggregate CHILDREN ONLY (for collapsed parent display) =====
  private computeChildrenAggregate(node: CoaNode): { opening: number; received: number; balance: number } {

    // leaf → children total = 0 (because leaf has no children)
    if (!node.children || node.children.length === 0) {
      return {
        opening: 0,
        received: 0,
        balance: 0
      };
    }

    let opening = 0;
    let received = 0;
    let balance = 0;

    node.children.forEach(ch => {
      // each child contributes its own + its descendants
      const childOwnOpening = ch.ownOpening ?? 0;
      const childOwnReceived = ch.ownReceived ?? 0;
      const childOwnBalance = ch.ownBalance ?? 0;

      opening += childOwnOpening;
      received += childOwnReceived;
      balance += childOwnBalance;

      const subAgg = this.computeChildrenAggregate(ch);
      opening += subAgg.opening;
      received += subAgg.received;
      balance += subAgg.balance;
    });

    return { opening, received, balance };
  }

  // ================= FLATTEN TREE =================
  private rebuildDisplayRows(): void {
    const out: CoaNode[] = [];

    const visit = (node: CoaNode) => {

      if (node.hasChildren) {
        if (node.$$expanded) {
          // expanded → parent shows its OWN backend values
          node.openingBalance = node.ownOpening;
          node.received = node.ownReceived;
          node.balance = node.ownBalance;
        } else {
          // collapsed → parent shows CHILDREN TOTAL only
          const agg = this.computeChildrenAggregate(node);
          node.openingBalance = agg.opening;
          node.received = agg.received;
          node.balance = agg.balance;
        }
      } else {
        // leaf → always own
        node.openingBalance = node.ownOpening;
        node.received = node.ownReceived;
        node.balance = node.ownBalance;
      }

      out.push(node);

      if (node.hasChildren && node.$$expanded) {
        node.children.forEach(ch => visit(ch));
      }
    };

    this.roots.forEach(r => visit(r));

    const term = (this.searchValue || '').toLowerCase().trim();
    if (!term) {
      this.displayRows = out;
    } else {
      this.displayRows = out.filter(n =>
        (n.headName || '').toLowerCase().includes(term) ||
        String(n.headCode).includes(term)
      );
    }
  }

  // ================= EVENTS =================
  toggleRow(row: CoaNode): void {
    if (!row.hasChildren) { return; }
    row.$$expanded = !row.$$expanded;
    this.rebuildDisplayRows();
  }

  filterUpdate(): void {
    this.rebuildDisplayRows();
  }

  // ================= HELPERS =================
  private errMsg(err: any): string {
    return err?.error?.message || err?.message || 'Try again';
  }
}
