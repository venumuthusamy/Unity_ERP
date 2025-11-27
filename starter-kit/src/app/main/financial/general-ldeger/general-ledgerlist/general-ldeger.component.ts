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

  isControl: boolean;   // AR/AP control
  isActive?: boolean;
}

interface CoaNode extends CoaFlat {
  // original backend values
  ownOpening: number;
  ownDebit: number;
  ownCredit: number;
  ownBalance: number;

  // current display values
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

        const flat: CoaFlat[] = (res.data || []).map((x: any) => {
          const headName = String(x.headName ?? '').trim();

          // mark AR/AP control heads (you can tweak this condition if needed)
          const isControl =
            !!x.isControl ||
            headName === 'Account Payable' ||
            headName.startsWith('Account Receivable');

          return {
            id: Number(x.headId ?? 0),
            headCode: Number(x.headCode ?? 0),
            headName,
            parentHead: x.parentHead == null ? 0 : Number(x.parentHead),

            headType: String(x.headType ?? ''),
            rootHeadType: String(x.rootHeadType ?? ''),

            openingBalance: x.openingBalance == null ? 0 : Number(x.openingBalance),
            debit: x.debit == null ? 0 : Number(x.debit),
            credit: x.credit == null ? 0 : Number(x.credit),
            balance: x.balance == null ? 0 : Number(x.balance),

            isControl,
            isActive: x.isActive ?? true
          };
        });

        const flatActive = flat.filter(r => !!r.isActive);

        const nodesById = new Map<number, CoaNode>();
        const nodesByCode = new Map<number, CoaNode>();

        // create nodes with own* values
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
              // parent not found → treat as root
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

  // ===== aggregate CHILDREN (used for parents & collapsed headings) =====
  private computeChildrenAggregate(node: CoaNode): {
    opening: number; debit: number; credit: number; balance: number;
  } {

    if (!node.children || node.children.length === 0) {
      return { opening: 0, debit: 0, credit: 0, balance: 0 };
    }

    let opening = 0;
    let debit = 0;
    let credit = 0;
    let balance = 0;

    node.children.forEach(ch => {
      // child own values
      const childOwnOpening = ch.ownOpening ?? 0;
      const childOwnDebit   = ch.ownDebit ?? 0;
      const childOwnCredit  = ch.ownCredit ?? 0;
      const childOwnBalance = ch.ownBalance ?? 0;

      // always add child's own row
      opening += childOwnOpening;
      debit   += childOwnDebit;
      credit  += childOwnCredit;
      balance += childOwnBalance;

      // if child is control (Account Payable / AR),
      // DO NOT add its children again (its own row already summary)
      if (!ch.isControl) {
        const subAgg = this.computeChildrenAggregate(ch);
        opening += subAgg.opening;
        debit   += subAgg.debit;
        credit  += subAgg.credit;
        balance += subAgg.balance;
      }
    });

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
          if (node.isControl) {
            // 🔹 Account Payable / AR expanded → show 0, children show detail
            node.openingBalance = 0;
            node.debit          = 0;
            node.credit         = 0;
            node.balance        = 0;
          } else {
            // normal heading expanded → own backend values
            node.openingBalance = node.ownOpening;
            node.debit          = node.ownDebit;
            node.credit         = node.ownCredit;
            node.balance        = node.ownBalance;
          }
        } else {
          if (node.isControl) {
            // 🔹 Account Payable / AR collapsed → show OWN summary
            // (Opening = total credit, Debit = total debit, Balance = OB - Debit)
            node.openingBalance = node.ownOpening;
            node.debit          = node.ownDebit;
            node.credit         = node.ownCredit;
            node.balance        = node.ownBalance;
          } else {
            // other headings collapsed → aggregate from children
            node.openingBalance = agg.opening;
            node.debit          = agg.debit;
            node.credit         = agg.credit;
            node.balance        = agg.balance;
          }
        }
      } else {
        // leaf → always own backend values
        node.openingBalance = node.ownOpening;
        node.debit          = node.ownDebit;
        node.credit         = node.ownCredit;
        node.balance        = node.ownBalance;
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
