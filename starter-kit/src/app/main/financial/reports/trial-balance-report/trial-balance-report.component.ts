import { Component, OnInit } from '@angular/core';
import { ReportsService } from './report-service';
import { TrialBalance } from '../trial-balance-model';
import feather from 'feather-icons';

interface TbNode extends TrialBalance {
  parentHead: number | null;
  level: number;
  expanded: boolean;
  isLeaf: boolean;
  children: TbNode[];
}

@Component({
  selector: 'app-trial-balance-report',
  templateUrl: './trial-balance-report.component.html',
  styleUrls: ['./trial-balance-report.component.scss']
})
export class TrialBalanceReportComponent implements OnInit {

  fromDate: string | null = null;
  toDate: string | null = null;
  companyId: number | null = 1;

  // raw rows from API (for debugging)
  rawRows: any[] = [];

  // tree + flattened list for display
  roots: TbNode[] = [];
  displayRows: TbNode[] = [];

  // totals (only leaf accounts)
  totalOpeningDebit = 0;
  totalOpeningCredit = 0;
  totalClosingDebit = 0;
  totalClosingCredit = 0;

  isLoading = false;

  // detail
  selectedHead: TbNode | null = null;
  detailRows: any[] = [];
  detailLoading = false;

  constructor(private reportsService: ReportsService) { }

  ngOnInit(): void { }
   ngAfterViewInit() {
      feather.replace(); // ✅ Required to render the icons
    }

  // ================== RUN TB ==================
 // ================== RUN TB ==================
// ================== RUN TB ==================
runTB(): void {
  const body = {
    fromDate: this.fromDate,
    toDate: this.toDate,
    companyId: this.companyId
  };

  this.isLoading = true;
  this.selectedHead = null;
  this.detailRows = [];

  this.reportsService.getTrialBalance(body).subscribe({
    next: (res: any) => {
      this.rawRows = res.data || [];

      // 1. build nodes dictionary (keyed by HEAD CODE)
      const mapByCode = new Map<string, TbNode>();  // <-- key = headCode

      this.rawRows.forEach((r: any) => {
        const node: TbNode = {
          ...r,
          parentHead: r.parentHead ?? null,   // parent HEAD CODE from API
          level: 0,
          expanded: false,
          isLeaf: true,
          children: []
        };

        mapByCode.set(String(node.headCode), node);
      });

      // 2. build tree using headCode -> parentHead (also headCode)
      const roots: TbNode[] = [];

      mapByCode.forEach(node => {
        const parentCode =
          node.parentHead !== null && node.parentHead !== 0
            ? String(node.parentHead)
            : '';

        if (parentCode && mapByCode.has(parentCode)) {
          const parent = mapByCode.get(parentCode)!;
          parent.children.push(node);
          parent.isLeaf = false;
          node.level = parent.level + 1;
        } else {
          // no parentCode or parent not in result => root node
          roots.push(node);
        }
      });

      // 3. sort children + roots by headCode
      mapByCode.forEach(n => {
        if (n.children?.length) {
          n.children.sort((a, b) => a.headCode.localeCompare(b.headCode));
        }
      });
      roots.sort((a, b) => a.headCode.localeCompare(b.headCode));

      this.roots = roots;

      // 4. recompute parent totals from children (no double counting)
      this.roots.forEach(r => this.recalcTotalsRecursive(r));

      // 5. build flat list (all parents collapsed by default)
      this.roots.forEach(r => (r.expanded = false));
      this.rebuildDisplayRows();

      // 6. grand totals = only leaf accounts
      const leafNodes: TbNode[] = [];
      this.collectLeaves(this.roots, leafNodes);

      this.totalOpeningDebit = leafNodes.reduce(
        (s, n) => s + (n.openingDebit || 0),
        0
      );
      this.totalOpeningCredit = leafNodes.reduce(
        (s, n) => s + (n.openingCredit || 0),
        0
      );
      this.totalClosingDebit = leafNodes.reduce(
        (s, n) => s + (n.closingDebit || 0),
        0
      );
      this.totalClosingCredit = leafNodes.reduce(
        (s, n) => s + (n.closingCredit || 0),
        0
      );

      this.isLoading = false;
    },
    error: () => {
      this.roots = [];
      this.displayRows = [];
      this.totalOpeningDebit =
        this.totalOpeningCredit =
        this.totalClosingDebit =
        this.totalClosingCredit =
          0;
      this.isLoading = false;
    }
  });
}



  // recursively sum children into parent
  private recalcTotalsRecursive(node: TbNode): void {
    if (!node.children.length) {
      // leaf, keep as is
      return;
    }

    node.children.forEach(c => this.recalcTotalsRecursive(c));

    node.openingDebit = node.children.reduce((s, n) => s + (n.openingDebit || 0), 0);
    node.openingCredit = node.children.reduce((s, n) => s + (n.openingCredit || 0), 0);
    node.closingDebit = node.children.reduce((s, n) => s + (n.closingDebit || 0), 0);
    node.closingCredit = node.children.reduce((s, n) => s + (n.closingCredit || 0), 0);
  }

  private collectLeaves(nodes: TbNode[], bucket: TbNode[]): void {
    nodes.forEach(n => {
      if (n.children.length === 0) {
        bucket.push(n);
      } else {
        this.collectLeaves(n.children, bucket);
      }
    });
  }

  // rebuild flat list based on expanded flags
  private rebuildDisplayRows(): void {
    this.displayRows = [];

    const visit = (n: TbNode) => {
      this.displayRows.push(n);
      if (n.expanded && n.children.length) {
        n.children.forEach(c => visit(c));
      }
    };

    this.roots.forEach(r => visit(r));
  }
    // ============= DISPLAY HELPERS (parent expanded => 0) =============

  private isHeadingExpanded(node: TbNode): boolean {
    return !!(node.children && node.children.length && node.expanded);
  }

  getOpeningDebitDisplay(node: TbNode): number {
    return this.isHeadingExpanded(node) ? 0 : (node.openingDebit || 0);
  }

  getOpeningCreditDisplay(node: TbNode): number {
    return this.isHeadingExpanded(node) ? 0 : (node.openingCredit || 0);
  }

  getClosingDebitDisplay(node: TbNode): number {
    return this.isHeadingExpanded(node) ? 0 : (node.closingDebit || 0);
  }

  getClosingCreditDisplay(node: TbNode): number {
    return this.isHeadingExpanded(node) ? 0 : (node.closingCredit || 0);
  }


  toggleNode(node: TbNode, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    if (!node.children.length) {
      return; // leaf, nothing to expand
    }
    node.expanded = !node.expanded;
    this.rebuildDisplayRows();
  }

  // ================== DETAIL ==================
  onRowClick(row: TbNode): void {
    // only drill-down for leaf accounts (Laptop, Mobile, Venugopal, Apple…)
    if (!row.isLeaf && row.children.length) {
      return;
    }

    if (this.selectedHead && this.selectedHead.headId === row.headId) {
      // toggle off
      this.selectedHead = null;
      this.detailRows = [];
      return;
    }

    this.selectedHead = row;
    this.loadDetail(row);
  }

  private loadDetail(row: TbNode): void {
    this.detailLoading = true;

    const body = {
      headId: row.headId,
      fromDate: this.fromDate,
      toDate: this.toDate,
      companyId: this.companyId
    };

    this.reportsService.getTrialBalanceDetail(body).subscribe({
      next: (res: any) => {
        this.detailRows = res.data || [];
        this.detailLoading = false;
      },
      error: () => {
        this.detailRows = [];
        this.detailLoading = false;
      }
    });
  }
}
