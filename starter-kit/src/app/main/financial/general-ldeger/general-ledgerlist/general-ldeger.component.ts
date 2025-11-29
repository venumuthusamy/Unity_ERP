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
  // ORIGINAL backend values
  ownOpening: number;
  ownDebit: number;
  ownCredit: number;
  ownBalance: number;

  // CURRENT display values
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

  // ===== COMMON BALANCE FORMULA =====
  private calcBalance(opening: number, debit: number, credit: number, rootHeadType: string): number {
    const t = (rootHeadType || '').toUpperCase();

    // Asset / Expense → Debit nature
    if (t === 'ASSET' || t === 'EXPENSE') {
      return opening + debit - credit;
    }

    // Liability / Equity / Income → Credit nature
    return opening - debit + credit;
  }

  // ================= LOAD DATA =================
  load(): void {
    this.isLoading = true;

    this.service.GetGeneralLedger().subscribe({
      next: (res: any) => {
        const flat: CoaFlat[] = (res.data || []).map((x: any) => {
          const headName = String(x.headName ?? '').trim();
          const rootHeadType = String(x.rootHeadType ?? '');

          const isControl =
            !!x.isControl ||
            headName === 'Accounts Payable' ||
            headName.startsWith('Account Receivable');

          const opening = x.openingBalance == null ? 0 : Number(x.openingBalance);
          const debit   = x.debit           == null ? 0 : Number(x.debit);
          const credit  = x.credit          == null ? 0 : Number(x.credit);

          const balance = this.calcBalance(opening, debit, credit, rootHeadType);

          return {
            id: Number(x.headId ?? 0),
            headCode: Number(x.headCode ?? 0),
            headName,
            parentHead: x.parentHead == null ? 0 : Number(x.parentHead),

            headType: String(x.headType ?? ''),
            rootHeadType,

            openingBalance: opening,
            debit,
            credit,
            balance,

            isControl,
            isActive: x.isActive ?? true
          };
        });

        const flatActive = flat.filter(r => !!r.isActive);

        const nodesById = new Map<number, CoaNode>();
        const nodesByCode = new Map<number, CoaNode>();

        // ---------- create nodes ----------
        flatActive.forEach(f => {
          const node: CoaNode = {
            ...f,
            ownOpening: f.openingBalance,
            ownDebit: f.debit,
            ownCredit: f.credit,
            ownBalance: f.balance,

            openingBalance: f.openingBalance,
            debit: f.debit,
            credit: f.credit,
            balance: f.balance,

            children: [],
            hasChildren: false,
            $$expanded: false,   // initial: collapsed
            level: 0,
            parent: null
          };
          nodesById.set(node.id, node);
          nodesByCode.set(node.headCode, node);
        });

        const roots: CoaNode[] = [];

        // 🔴 ParentHead IS HEADCODE → link ONLY by headCode
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

        // ---------- sort & set level ----------
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

        // all parents collapsed initially
        roots.forEach(r => r.$$expanded = false);

        this.roots = roots;
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

  // ===== aggregate CHILDREN =====
  private computeChildrenAggregate(node: CoaNode): {
    opening: number; debit: number; credit: number; balance: number;
  } {
    if (!node.children || node.children.length === 0) {
      return { opening: 0, debit: 0, credit: 0, balance: 0 };
    }

    let opening = 0;
    let debit   = 0;
    let credit  = 0;

    node.children.forEach(ch => {
      const childOwnOpening = ch.ownOpening ?? 0;
      const childOwnDebit   = ch.ownDebit   ?? 0;
      const childOwnCredit  = ch.ownCredit  ?? 0;

      opening += childOwnOpening;
      debit   += childOwnDebit;
      credit  += childOwnCredit;

      if (!ch.isControl) {
        const subAgg = this.computeChildrenAggregate(ch);
        opening += subAgg.opening;
        debit   += subAgg.debit;
        credit  += subAgg.credit;
      }
    });

    // balance based on aggregated opening/debit/credit
    const balance = this.calcBalance(opening, debit, credit, node.rootHeadType);

    return { opening, debit, credit, balance };
  }

  // ================= FLATTEN TREE =================
  private rebuildDisplayRows(): void {
    const out: CoaNode[] = [];

    const visit = (node: CoaNode) => {
      const hasChildren = node.hasChildren && node.children.length > 0;

      if (hasChildren) {
        const agg = this.computeChildrenAggregate(node);

        if (node.$$expanded) {
          // expanded → show own values
          node.openingBalance = node.ownOpening;
          node.debit          = node.ownDebit;
          node.credit         = node.ownCredit;
          node.balance        = this.calcBalance(
            node.ownOpening,
            node.ownDebit,
            node.ownCredit,
            node.rootHeadType
          );
        } else {
          // collapsed → show aggregate
          // 👉 if aggregated opening is 0 but credit > 0,
          //    treat child total credit as opening balance
          const openingForDisplay =
            agg.opening !== 0 ? agg.opening : agg.credit;

          node.openingBalance = openingForDisplay;
          node.debit          = agg.debit;
          node.credit         = agg.credit;
          node.balance        = this.calcBalance(
            openingForDisplay,
            agg.debit,
            agg.credit,
            node.rootHeadType
          );
        }
      } else {
        // leaf → always own values
        node.openingBalance = node.ownOpening;
        node.debit          = node.ownDebit;
        node.credit         = node.ownCredit;
        node.balance        = this.calcBalance(
          node.ownOpening,
          node.ownDebit,
          node.ownCredit,
          node.rootHeadType
        );
      }

      out.push(node);

      if (hasChildren && node.$$expanded) {
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
