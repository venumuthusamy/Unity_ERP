import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { DatatableComponent } from '@swimlane/ngx-datatable';
import Swal from 'sweetalert2';
import { GeneralLedgerService } from '../general-ledger-service/general-ledger.service';

interface CoaFlat {
  id: number;
  headCode: number;
  headName: string;
  parentHead: number;

  headType: string;
  rootHeadType: string;

  openingBalance: number;
  debit: number;
  credit: number;
  balance: number;

  isControl: boolean;
  isActive?: boolean;
}

interface CoaNode extends CoaFlat {
  ownOpening: number;
  ownDebit: number;
  ownCredit: number;
  ownBalance: number;

  openingBalance: number;
  debit: number;
  credit: number;
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

  constructor(private service: GeneralLedgerService) {}

  ngOnInit(): void {
    this.load();
  }

  // balance = opening + credit - debit
  private calcBalance(opening: number, debit: number, credit: number): number {
    return opening + credit - debit;
  }

  // ================= LOAD DATA =================
  load(): void {
    this.isLoading = true;

    this.service.GetGeneralLedger().subscribe({
      next: (res: any) => {
        const flat: CoaFlat[] = (res.data || []).map((x: any) => {
          const headName = String(x.headName ?? '').trim();

          const isControl =
            !!x.isControl ||
            headName === 'Accounts Payable' ||
            headName.startsWith('Accounts Receivable');

          return {
            id: Number(x.headId ?? 0),
            headCode: Number(x.headCode ?? 0),
            headName,
            parentHead: x.parentHead == null ? 0 : Number(x.parentHead),

            headType: String(x.headType ?? ''),
            rootHeadType: String(x.rootHeadType ?? ''),

            openingBalance: Number(x.openingBalance ?? 0),
            debit: Number(x.debit ?? 0),
            credit: Number(x.credit ?? 0),
            balance: Number(x.balance ?? 0),

            isControl,
            isActive: x.isActive ?? true
          };
        });

        const flatActive = flat.filter(r => !!r.isActive);

        // Map by ID and by HeadCode (because ParentHead = HeadCode)
        const nodesById = new Map<number, CoaNode>();
        const nodesByCode = new Map<number, CoaNode>();

        // ---------- create nodes ----------
        flatActive.forEach(f => {
          const node: CoaNode = {
            ...f,
            ownOpening: f.openingBalance,
            ownDebit:   f.debit,
            ownCredit:  f.credit,
            ownBalance: f.balance,

            openingBalance: f.openingBalance,
            debit:   f.debit,
            credit:  f.credit,
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

        // ---------- build tree ----------
        const roots: CoaNode[] = [];

        nodesById.forEach(node => {
          const p = node.parentHead ?? 0;
          if (!p) {
            roots.push(node);
          } else {
            const parent = nodesByCode.get(p);
            if (parent) {
              node.parent = parent;
              parent.children.push(node);
              parent.hasChildren = true;
            } else {
              roots.push(node);
            }
          }
        });

        // ---------- sort ----------
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
        this.roots.forEach(r => r.$$expanded = false);
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

  // ===== CHILDREN AGGREGATE (recursive) =====
  private computeChildrenAggregate(node: CoaNode): {
    opening: number; debit: number; credit: number;
  } {
    if (!node.children || node.children.length === 0) {
      return { opening: 0, debit: 0, credit: 0 };
    }

    let opening = 0;
    let debit   = 0;
    let credit  = 0;

    node.children.forEach(ch => {
      opening += (ch.ownOpening ?? 0);
      debit   += (ch.ownDebit   ?? 0);
      credit  += (ch.ownCredit  ?? 0);

      const sub = this.computeChildrenAggregate(ch);
      opening += sub.opening;
      debit   += sub.debit;
      credit  += sub.credit;
    });

    return { opening, debit, credit };
  }

  // ================= FLATTEN TREE =================
private rebuildDisplayRows(): void {
  const output: CoaNode[] = [];

  // ---------------- FIRST PASS: normalize leaves ----------------
  const normalizeLeaves = (node: CoaNode) => {
    if (!node.hasChildren || node.children.length === 0) {
      const o = node.ownOpening;
      const d = node.ownDebit;
      const c = node.ownCredit;
      const bal = this.calcBalance(o, d, c);

      // fully settled leaf
      if (o === 0 && bal === 0) {
        node.ownOpening = 0;
        node.ownDebit = 0;
        node.ownCredit = 0;
        node.ownBalance = 0;

        node.openingBalance = 0;
        node.debit = 0;
        node.credit = 0;
        node.balance = 0;
      } else {
        // ✅ KEEP opening balance
        node.openingBalance = o;
        node.debit = d;
        node.credit = c;
        node.balance = Math.abs(bal);
      }
      return;
    }

    // normalize children recursively
    node.children.forEach(ch => normalizeLeaves(ch));
  };

  this.roots.forEach(r => normalizeLeaves(r));

  // ---------------- SECOND PASS: parent aggregation ----------------
  const visit = (node: CoaNode) => {
    const hasChildren = node.hasChildren && node.children.length > 0;
    const agg = hasChildren ? this.computeChildrenAggregate(node) : null;

    if (hasChildren) {
      if (node.$$expanded) {
        // when expanded, parent shows 0 so children carry details
        node.openingBalance = 0;
        node.debit = 0;
        node.credit = 0;
        node.balance = 0;
      } else {
        const o = node.ownOpening + (agg?.opening ?? 0);
        const d = node.ownDebit   + (agg?.debit   ?? 0);
        const c = node.ownCredit  + (agg?.credit  ?? 0);
        const bal = this.calcBalance(o, d, c);

        if (o === 0 && bal === 0) {
          node.openingBalance = 0;
          node.debit = 0;
          node.credit = 0;
          node.balance = 0;
        } else {
          // ✅ show aggregated opening + movement on collapsed parent
          node.openingBalance = o;
          node.debit = d;
          node.credit = c;
          node.balance = Math.abs(bal);
        }
      }
    }

    output.push(node);

    if (hasChildren && node.$$expanded) {
      node.children.forEach(ch => visit(ch));
    }
  };

  this.roots.forEach(r => visit(r));

  // Search filter
  const term = (this.searchValue || '').toLowerCase();
  this.displayRows = term
    ? output.filter(n =>
        n.headName.toLowerCase().includes(term) ||
        String(n.headCode).includes(term)
      )
    : output;
}


  // Toggle expand/collapse
  toggleRow(row: CoaNode): void {
    if (!row.hasChildren) return;
    row.$$expanded = !row.$$expanded;
    this.rebuildDisplayRows();
  }

  filterUpdate(): void {
    this.rebuildDisplayRows();
  }

  private errMsg(err: any): string {
    return err?.error?.message || err?.message || 'Try again';
  }
}
