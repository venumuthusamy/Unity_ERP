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

  // Visible rows
  liabilityAccounts: any[] = [];
  assetAccounts: any[] = [];

  // Raw totals (without balancing row)
  liabilitiesTotal = 0;
  assetsTotal = 0;

  // Totals shown on screen (after adding balancing figure)
  displayLiabilitiesTotal = 0;
  displayAssetsTotal = 0;

  // Raw API rows
  allRows: any[] = [];

  // Maps
  private headMap = new Map<number, any>();                 // headId -> row
  private liabilityChildrenMap = new Map<number, any[]>();  // parentHead -> children[]
  private assetChildrenMap = new Map<number, any[]>();      // parentHead -> children[]

  // Subtree totals
  private liabilitySubtreeTotals = new Map<number, number>(); // headId -> total
  private assetSubtreeTotals = new Map<number, number>();     // headId -> total

  // Expand states
  private liabilityExpanded = new Set<number>();
  private assetExpanded = new Set<number>();

  constructor(private _balanceSheetService: BalanceSheetService) {}

  ngOnInit(): void {
    this.loadBalanceSheetDetails();
  }

  ngAfterViewInit(): void {
    feather.replace();
  }

  // ---------- helpers ----------

  private parseAmount(value: any): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/,/g, '').trim();
      const n = parseFloat(cleaned);
      return isNaN(n) ? 0 : n;
    }
    return 0;
  }

  // climb parent chain to find Asset / Liability info
  private getSideForRow(row: any): 'A' | 'L' | null {
    let current = row;
    let safety = 0;

    while (current && safety < 100) {
      const sideText   = (current.side || '').toString().toLowerCase();
      const groupName  = (current.groupHeadName || '').toString().toLowerCase();
      const headName   = (current.headName || '').toString().toLowerCase();

      if (sideText.startsWith('asset') ||
          groupName.startsWith('asset') ||
          headName === 'assets') {
        return 'A';
      }
      if (sideText.startsWith('liabilit') ||
          groupName.startsWith('liabilit') ||
          headName === 'liabilities') {
        return 'L';
      }

      if (!current.parentHead || current.parentHead === 0) break;
      current = this.headMap.get(current.parentHead);
      safety++;
    }

    return null;
  }

  // ---------- load from API ----------

  loadBalanceSheetDetails() {
    this._balanceSheetService.GetBalanceSheetDetails().subscribe({
      next: (res: any) => {
        const raw = res?.data || [];

        // normalise keys & add numeric balance
        this.allRows = raw.map((r: any) => ({
          ...r,
          headId:        r.headId        ?? r.HeadId,
          parentHead:    r.parentHead    ?? r.ParentHead,
          headName:      r.headName      ?? r.HeadName,
          groupHeadName: r.groupHeadName ?? r.GroupHeadName,
          side:          r.side          ?? r.Side,
          balance:       r.balance       ?? r.Balance ?? 0,
          balanceNum:    this.parseAmount(r.balance ?? r.Balance ?? 0)
        }));

        // build head map
        this.headMap.clear();
        this.allRows.forEach(r => {
          if (r && r.headId != null) {
            this.headMap.set(r.headId, r);
          }
        });

        // split into asset / liability trees
        this.buildChildrenMaps();

        // compute subtree totals
        this.liabilitySubtreeTotals = this.computeSubtreeTotals(this.liabilityChildrenMap);
        this.assetSubtreeTotals     = this.computeSubtreeTotals(this.assetChildrenMap);

        // visible views
        this.buildLiabilityView();
        this.buildAssetView();

        // apply balancing line so both totals match
        this.applyBalancingFigure();

        setTimeout(() => feather.replace(), 0);
      },
      error: err => {
        console.error('Error loading balance sheet', err);
        this.allRows = [];
        this.liabilityAccounts = [];
        this.assetAccounts = [];
        this.liabilitiesTotal = 0;
        this.assetsTotal = 0;
        this.displayLiabilitiesTotal = 0;
        this.displayAssetsTotal = 0;
      }
    });
  }

  // ---------- build children maps ----------

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
      if (!row) return;

      const side = this.getSideForRow(row);   // 'A', 'L', or null

      if (side === 'L') {
        addToMap(this.liabilityChildrenMap, row);
      } else if (side === 'A') {
        addToMap(this.assetChildrenMap, row);
      }
      // others (equity, income, expense) ignored for this screen
    });
  }

  // ---------- subtree totals ----------

  private computeSubtreeTotals(childrenMap: Map<number, any[]>): Map<number, number> {
    const memo = new Map<number, number>();

    const dfs = (row: any): number => {
      if (!row) return 0;
      const id = row.headId;
      if (id == null) return 0;

      if (memo.has(id)) return memo.get(id)!;

      const children = childrenMap.get(id) || [];
      if (!children.length) {
        const val = row.balanceNum ?? 0;
        memo.set(id, val);
        return val;
      }

      let sum = 0;
      children.forEach(ch => sum += dfs(ch));
      memo.set(id, sum);
      return sum;
    };

    (childrenMap.get(0) || []).forEach(root => dfs(root));
    return memo;
  }

  // ---------- build visible liabilities ----------

  private buildLiabilityView(): void {
    this.liabilityAccounts = [];

    const totalsMap = this.liabilitySubtreeTotals;

    const visit = (row: any, level: number) => {
      const id        = row.headId;
      const children  = this.liabilityChildrenMap.get(id) || [];
      const hasChildren = children.length > 0;

      const baseAmount   = Number(row.balance) || 0;
      const subtreeTotal = (totalsMap.get(id) ?? baseAmount);

      // hide this head + its subtree if everything is 0
      if (subtreeTotal === 0) {
        return;
      }

      let displayAmount = baseAmount;
      if (hasChildren) {
        if (this.liabilityExpanded.has(id)) {
          displayAmount = 0;           // expanded → parent 0
        } else {
          displayAmount = subtreeTotal; // collapsed → sum of children
        }
      }

      this.liabilityAccounts.push({
        ...row,
        level,
        hasChildren,
        expanded: this.liabilityExpanded.has(id),
        amount: displayAmount,
        isSynthetic: false
      });

      if (hasChildren && this.liabilityExpanded.has(id)) {
        children.forEach(ch => visit(ch, level + 1));
      }
    };

    const roots = this.liabilityChildrenMap.get(0) || [];
    let total = 0;

    roots.forEach(r => {
      const st = (totalsMap.get(r.headId) || Number(r.balance) || 0);
      if (st !== 0) {
        total += st;
        visit(r, 0);
      }
    });

    this.liabilitiesTotal = total;
  }

  // ---------- build visible assets ----------

  private buildAssetView(): void {
    this.assetAccounts = [];

    const totalsMap = this.assetSubtreeTotals;

    const visit = (row: any, level: number) => {
      const id        = row.headId;
      const children  = this.assetChildrenMap.get(id) || [];
      const hasChildren = children.length > 0;

      const baseAmount   = Number(row.balance) || 0;
      const subtreeTotal = (totalsMap.get(id) ?? baseAmount);

      // hide this head + its subtree if everything is 0
      if (subtreeTotal === 0) {
        return;
      }

      let displayAmount = baseAmount;
      if (hasChildren) {
        if (this.assetExpanded.has(id)) {
          displayAmount = 0;
        } else {
          displayAmount = subtreeTotal;
        }
      }

      this.assetAccounts.push({
        ...row,
        level,
        hasChildren,
        expanded: this.assetExpanded.has(id),
        amount: displayAmount,
        isSynthetic: false
      });

      if (hasChildren && this.assetExpanded.has(id)) {
        children.forEach(ch => visit(ch, level + 1));
      }
    };

    const roots = this.assetChildrenMap.get(0) || [];
    let total = 0;

    roots.forEach(r => {
      const st = (totalsMap.get(r.headId) || Number(r.balance) || 0);
      if (st !== 0) {
        total += st;
        visit(r, 0);
      }
    });

    this.assetsTotal = total;
  }

  // ---------- balancing figure (make totals equal) ----------

  private applyBalancingFigure(): void {
    // remove any old synthetic rows
    this.liabilityAccounts = this.liabilityAccounts.filter(x => !x.isSynthetic);
    this.assetAccounts     = this.assetAccounts.filter(x => !x.isSynthetic);

    const liab  = this.liabilitiesTotal || 0;
    const asset = this.assetsTotal || 0;

    this.displayLiabilitiesTotal = liab;
    this.displayAssetsTotal      = asset;

    const diff = asset - liab;   // >0 → assets bigger

    // already equal (or tiny rounding difference)
    if (Math.abs(diff) < 0.005) {
      return;
    }

    if (diff > 0) {
      // need extra Liability row so Liabilities + diff = Assets
      this.liabilityAccounts.push({
        headId: null,
        headName: 'Balancing Figure',
        level: 0,
        hasChildren: false,
        expanded: false,
        amount: diff,
        isSynthetic: true
      });
      this.displayLiabilitiesTotal = liab + diff;
    } else {
      // need extra Asset row so Assets + (-diff) = Liabilities
      const add = -diff;
      this.assetAccounts.push({
        headId: null,
        headName: 'Balancing Figure',
        level: 0,
        hasChildren: false,
        expanded: false,
        amount: add,
        isSynthetic: true
      });
      this.displayAssetsTotal = asset + add;
    }
  }

  // ---------- toggle ----------

  toggleLiability(acc: any, event?: MouseEvent) {
    if (event) event.stopPropagation();
    if (!acc || !acc.headId || !acc.hasChildren || acc.isSynthetic) return;

    if (this.liabilityExpanded.has(acc.headId)) {
      this.liabilityExpanded.delete(acc.headId);
    } else {
      this.liabilityExpanded.add(acc.headId);
    }

    this.buildLiabilityView();
    this.applyBalancingFigure();
    setTimeout(() => feather.replace(), 0);
  }

  toggleAsset(acc: any, event?: MouseEvent) {
    if (event) event.stopPropagation();
    if (!acc || !acc.headId || !acc.hasChildren || acc.isSynthetic) return;

    if (this.assetExpanded.has(acc.headId)) {
      this.assetExpanded.delete(acc.headId);
    } else {
      this.assetExpanded.add(acc.headId);
    }

    this.buildAssetView();
    this.applyBalancingFigure();
    setTimeout(() => feather.replace(), 0);
  }

  // amount display helper – if 0, show nothing
  displayAmount(value: any): string | null {
    const num = Number(value) || 0;
    if (num === 0) { return null; }
    return num.toString();
  }
}
