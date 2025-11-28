import { Component, OnInit, AfterViewInit } from '@angular/core';
import { BalanceSheetService } from '../balance-sheet-service/balance-sheet.service';
import feather from 'feather-icons';

@Component({
  selector: 'app-balance-sheet',
  templateUrl: './balance-sheet.component.html',
  styleUrls: ['./balance-sheet.component.scss']
})
export class BalanceSheetComponent implements OnInit, AfterViewInit {

  headerTitle = 'Balance Sheet';

  // ===== Visible rows for UI =====
  liabilityAccounts: any[] = [];
  assetAccounts: any[] = [];

  // Totals (always full total, not affected by expand/collapse)
  liabilitiesTotal = 0;
  assetsTotal = 0;

  // Raw API list
  allRows: any[] = [];

  // Maps
  private headMap = new Map<number, any>();                 // headId -> row
  private liabilityChildrenMap = new Map<number, any[]>();  // parentHead -> children[]
  private assetChildrenMap = new Map<number, any[]>();      // parentHead -> children[]

  // Subtree totals (sum of all descendants incl. leaf values)
  private liabilitySubtreeTotals = new Map<number, number>(); // headId -> total
  private assetSubtreeTotals = new Map<number, number>();     // headId -> total

  // Expand states
  private liabilityExpanded = new Set<number>();
  private assetExpanded = new Set<number>();

  constructor(private _balanceSheetService: BalanceSheetService) { }

  ngOnInit(): void {
    this.loadBalanceSheetDetails();
  }

  ngAfterViewInit(): void {
    feather.replace();
  }

  // =====================================================
  // LOAD FROM API
  // =====================================================
  loadBalanceSheetDetails() {
    this._balanceSheetService.GetBalanceSheetDetails().subscribe({
      next: (res: any) => {
        this.allRows = res?.data || [];

        // Build head map
        this.headMap.clear();
        this.allRows.forEach(r => {
          if (r && r.headId != null) {
            this.headMap.set(r.headId, r);
          }
        });

        // Build children maps
        this.buildChildrenMaps();

        // Compute subtree totals for each side
        this.liabilitySubtreeTotals = this.computeSubtreeTotals(this.liabilityChildrenMap);
        this.assetSubtreeTotals = this.computeSubtreeTotals(this.assetChildrenMap);

        // Build visible views
        this.buildLiabilityView();
        this.buildAssetView();

        setTimeout(() => feather.replace(), 0);
      },
      error: err => {
        console.error('Error loading balance sheet', err);
        this.allRows = [];
        this.liabilityAccounts = [];
        this.assetAccounts = [];
        this.liabilitiesTotal = 0;
        this.assetsTotal = 0;
      }
    });
  }

  // =====================================================
  // BUILD CHILDREN MAPS (split by root head name)
  // =====================================================
  private buildChildrenMaps(): void {
    this.liabilityChildrenMap.clear();
    this.assetChildrenMap.clear();

    const addToMap = (map: Map<number, any[]>, row: any) => {
      const pid = row.parentHead || 0;
      const arr = map.get(pid) || [];
      arr.push(row);
      map.set(pid, arr);
    };

    this.allRows.forEach(row => {
      if (!row) { return; }

      const root = this.getRootHead(row);
      const rootName = (root?.headName || '').trim().toLowerCase();

      if (rootName.startsWith('liabilit')) {
        // Liabilities tree
        addToMap(this.liabilityChildrenMap, row);
      } else if (rootName.startsWith('asset')) {
        // Assets tree
        addToMap(this.assetChildrenMap, row);
      } else {
        // Equity / Income / Expense → ignore for this screen
        return;
      }
    });
  }

  // parentHead chain follow pannitu top root head find pannum
  private getRootHead(row: any): any {
    if (!row) { return null; }
    let current = row;
    let safety = 0;

    while (current && current.parentHead && current.parentHead !== 0 && safety < 100) {
      const parent = this.headMap.get(current.parentHead);
      if (!parent) { break; }
      current = parent;
      safety++;
    }

    return current;
  }

  // =====================================================
  // SUBTREE TOTALS (FOR COLLAPSED PARENT AMOUNT & TOTALS)
  // =====================================================
  private computeSubtreeTotals(childrenMap: Map<number, any[]>): Map<number, number> {
    const memo = new Map<number, number>();

    const dfs = (row: any): number => {
      if (!row) { return 0; }
      const id = row.headId;
      if (id == null) { return 0; }

      if (memo.has(id)) {
        return memo.get(id)!;
      }

      const children = childrenMap.get(id) || [];
      if (!children.length) {
        const val = Number(row.balance) || 0;
        memo.set(id, val);
        return val;
      }

      let sum = 0;
      children.forEach(ch => sum += dfs(ch));
      memo.set(id, sum);
      return sum;
    };

    // run for all roots
    (childrenMap.get(0) || []).forEach(root => dfs(root));

    return memo;
  }

  // =====================================================
  // BUILD VISIBLE VIEW – LIABILITIES
  // =====================================================
  private buildLiabilityView(): void {
    this.liabilityAccounts = [];

    const totalsMap = this.liabilitySubtreeTotals;

    const visit = (row: any, level: number) => {
      const id = row.headId;
      const children = this.liabilityChildrenMap.get(id) || [];
      const hasChildren = children.length > 0;

      const baseAmount = Number(row.balance) || 0;
      const subtreeTotal = totalsMap.get(id) || 0;

      let displayAmount = baseAmount;

      if (hasChildren) {
        if (this.liabilityExpanded.has(id)) {
          // expanded → show 0 on parent, values on children
          displayAmount = 0;
        } else {
          // collapsed → parent shows sum of all children
          displayAmount = subtreeTotal;
        }
      }

      this.liabilityAccounts.push({
        ...row,
        level,
        hasChildren,
        expanded: this.liabilityExpanded.has(id),
        amount: displayAmount
      });

      // if expanded → visit children
      if (hasChildren && this.liabilityExpanded.has(id)) {
        children.forEach(ch => visit(ch, level + 1));
      }
    };

    // roots where parentHead = 0 in liabilities tree
    const roots = this.liabilityChildrenMap.get(0) || [];
    let total = 0;

    roots.forEach(r => {
      total += totalsMap.get(r.headId) || 0;   // full tree total
      visit(r, 0);
    });

    this.liabilitiesTotal = total;
  }

  // =====================================================
  // BUILD VISIBLE VIEW – ASSETS
  // =====================================================
  private buildAssetView(): void {
    this.assetAccounts = [];

    const totalsMap = this.assetSubtreeTotals;

    const visit = (row: any, level: number) => {
      const id = row.headId;
      const children = this.assetChildrenMap.get(id) || [];
      const hasChildren = children.length > 0;

      const baseAmount = Number(row.balance) || 0;
      const subtreeTotal = totalsMap.get(id) || 0;

      let displayAmount = baseAmount;

      if (hasChildren) {
        if (this.assetExpanded.has(id)) {
          displayAmount = 0;         // expanded → 0 in parent
        } else {
          displayAmount = subtreeTotal; // collapsed → sum of children
        }
      }

      this.assetAccounts.push({
        ...row,
        level,
        hasChildren,
        expanded: this.assetExpanded.has(id),
        amount: displayAmount
      });

      if (hasChildren && this.assetExpanded.has(id)) {
        children.forEach(ch => visit(ch, level + 1));
      }
    };

    const roots = this.assetChildrenMap.get(0) || [];
    let total = 0;

    roots.forEach(r => {
      total += totalsMap.get(r.headId) || 0;
      visit(r, 0);
    });

    this.assetsTotal = total;
  }

  // =====================================================
  // TOGGLE EXPAND / COLLAPSE
  // =====================================================
  toggleLiability(acc: any, event?: MouseEvent) {
    if (event) { event.stopPropagation(); }
    if (!acc || !acc.headId || !acc.hasChildren) { return; }

    if (this.liabilityExpanded.has(acc.headId)) {
      this.liabilityExpanded.delete(acc.headId);
    } else {
      this.liabilityExpanded.add(acc.headId);
    }

    this.buildLiabilityView();
    setTimeout(() => feather.replace(), 0);
  }

  toggleAsset(acc: any, event?: MouseEvent) {
    if (event) { event.stopPropagation(); }
    if (!acc || !acc.headId || !acc.hasChildren) { return; }

    if (this.assetExpanded.has(acc.headId)) {
      this.assetExpanded.delete(acc.headId);
    } else {
      this.assetExpanded.add(acc.headId);
    }

    this.buildAssetView();
    setTimeout(() => feather.replace(), 0);
  }

  // amount display helper – if 0, show nothing
  displayAmount(value: any): string | null {
    const num = Number(value) || 0;
    if (num === 0) { return null; }
    return num.toString();
  }

}
