import { Component, OnInit, AfterViewInit } from '@angular/core';
import { BalanceSheetService } from '../balance-sheet-service/balance-sheet.service';
import feather from 'feather-icons';

interface BsRow {
  headId: number;
  headCode?: string;
  headName: string;
  parentHead: number | null;
  rootHeadType?: string | null;   // 'A' / 'L' / etc.
  headType?: string | null;
  balance: number;
  balanceNum: number;
  groupHeadName?: string | null;
  side?: string | null;
  [key: string]: any;
}

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
  allRows: BsRow[] = [];

  // Maps
  private headMap = new Map<number, BsRow>();               // headId -> row
  private liabilityChildrenMap = new Map<number, BsRow[]>(); // parentHead -> children[]
  private assetChildrenMap = new Map<number, BsRow[]>();     // parentHead -> children[]

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

  private getSideForRow(row: BsRow): 'A' | 'L' | null {
    // First priority: RootHeadType from backend
    const rootType = (row.rootHeadType ||
                      row.headType ||
                      row['HeadType'] ||
                      '')
                      .toString()
                      .toUpperCase();

    if (rootType === 'A') return 'A';
    if (rootType === 'L') return 'L';

    // Fallback (if ever needed): text-based detection
    const sideText  = (row.side || '').toString().toLowerCase();
    const groupName = (row.groupHeadName || '').toString().toLowerCase();
    const headName  = (row.headName || '').toString().toLowerCase();

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

    return null;
  }

  // ---------- load from API ----------

  loadBalanceSheetDetails() {
    this._balanceSheetService.GetBalanceSheetDetails().subscribe({
      next: (res: any) => {
        const raw = res?.data || [];

        // Normalise keys & make sure balance ibuildChildrenMapss numeric
        this.allRows = raw.map((r: any) => {
          const headId      = r.headId      ?? r.HeadId;
          const parentHead  = r.parentHead  ?? r.ParentHead ?? null;
          const headName    = r.headName    ?? r.HeadName ?? '';
          const groupHead   = r.groupHeadName ?? r.GroupHeadName ?? null;
          const side        = r.side        ?? r.Side ?? null;
          const rootType    = (r.rootHeadType ?? r.RootHeadType ?? null) as string | null;
          const headType    = (r.headType ?? r.HeadType ?? null) as string | null;

          const balRaw      = r.balance ?? r.Balance ?? 0;
          const balNum      = this.parseAmount(balRaw);

          const row: BsRow = {
            ...r,
            headId,
            parentHead,
            headName,
            groupHeadName: groupHead,
            side,
            rootHeadType: rootType,
            headType,
            balance: balNum,
            balanceNum: balNum
          };

          return row;
        });

        // build head map FIRST
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

  // ---------- build children maps (Assets / Liabilities) ----------

 private buildChildrenMaps(): void {
  this.liabilityChildrenMap.clear();
  this.assetChildrenMap.clear();

  const addToMap = (map: Map<number, BsRow[]>, row: BsRow) => {
    let pid = (row.parentHead ?? 0) || 0;

    // If parent is itself OR parent does not exist in headMap, treat as root
    if (pid === row.headId || !this.headMap.has(pid)) {
      pid = 0;
    }

    const arr = map.get(pid) || [];
    arr.push(row);
    map.set(pid, arr);
  };

  this.allRows.forEach(row => {
    if (!row) return;

    const side = this.getSideForRow(row);  // uses rootHeadType 'A' / 'L'

    if (side === 'A') {
      addToMap(this.assetChildrenMap, row);
    } else if (side === 'L') {
      addToMap(this.liabilityChildrenMap, row);
    }
  });
}


  // ---------- subtree totals ----------

private computeSubtreeTotals(childrenMap: Map<number, BsRow[]>): Map<number, number> {
  const memo = new Map<number, number>();
  const visiting = new Set<number>();   // to detect cycles

  const dfs = (row: BsRow): number => {
    if (!row) return 0;
    const id = row.headId;
    if (id == null) return 0;

    // already computed
    if (memo.has(id)) return memo.get(id)!;

    // cycle detected – stop here and just use own balance
    if (visiting.has(id)) {
      console.warn('Cycle detected in Balance Sheet tree at headId', id, row);
      const valCycle = row.balanceNum ?? 0;
      memo.set(id, valCycle);
      return valCycle;
    }

    visiting.add(id);

    const children = childrenMap.get(id) || [];
    let sum: number;

    if (!children.length) {
      sum = row.balanceNum ?? 0;
    } else {
      sum = 0;
      for (const ch of children) {
        sum += dfs(ch);
      }
    }

    visiting.delete(id);
    memo.set(id, sum);
    return sum;
  };

  const roots = childrenMap.get(0) || [];
  roots.forEach(root => dfs(root));

  return memo;
}


  // ---------- build visible liabilities ----------

  private buildLiabilityView(): void {
    this.liabilityAccounts = [];

    const totalsMap = this.liabilitySubtreeTotals;

    const visit = (row: BsRow, level: number) => {
      const id          = row.headId;
      const children    = this.liabilityChildrenMap.get(id) || [];
      const hasChildren = children.length > 0;

      const baseAmount   = row.balance ?? 0;
      const subtreeTotal = (totalsMap.get(id) ?? baseAmount);

      // hide this head + its subtree if everything is 0
      if (subtreeTotal === 0) {
        return;
      }

      let displayAmount = baseAmount;
      if (hasChildren) {
        if (this.liabilityExpanded.has(id)) {
          displayAmount = 0;
        } else {
          displayAmount = subtreeTotal;
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
      const st = (totalsMap.get(r.headId) || (r.balance ?? 0));
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

    const visit = (row: BsRow, level: number) => {
      const id          = row.headId;
      const children    = this.assetChildrenMap.get(id) || [];
      const hasChildren = children.length > 0;

      const baseAmount   = row.balance ?? 0;
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
      const st = (totalsMap.get(r.headId) || (r.balance ?? 0));
      if (st !== 0) {
        total += st;
        visit(r, 0);
      }
    });

    this.assetsTotal = total;
  }

  // ---------- balancing figure ----------

// ---------- balancing figure ----------
private applyBalancingFigure(): void {
  // remove old synthetic rows
  this.liabilityAccounts = this.liabilityAccounts.filter(x => !x.isSynthetic);
  this.assetAccounts     = this.assetAccounts.filter(x => !x.isSynthetic);

  // raw totals from trees (may be negative)
  const liabRaw  = this.liabilitiesTotal || 0;
  const assetRaw = this.assetsTotal || 0;

  // for balance sheet we work with absolute values
  const liabAbs  = Math.abs(liabRaw);
  const assetAbs = Math.abs(assetRaw);

  // start cards with raw abs totals
  this.displayLiabilitiesTotal = liabAbs;
  this.displayAssetsTotal      = assetAbs;

  const diff = assetAbs - liabAbs;   // +ve -> assets bigger, -ve -> liabs bigger

  if (Math.abs(diff) < 0.005) {
    // already balanced, no synthetic row
    return;
  }

  if (diff > 0) {
    // Assets > Liabilities  -> balancing figure on Liabilities side
    this.liabilityAccounts.push({
      headId: null,
      headName: 'Balancing Figure',
      level: 0,
      hasChildren: false,
      expanded: false,
      amount: diff,             // always +ve
      isSynthetic: true
    });
    // after balancing, both sides equal to assetAbs
    this.displayLiabilitiesTotal = liabAbs + diff; // = assetAbs
    this.displayAssetsTotal      = assetAbs;
  } else {
    // Liabilities > Assets -> balancing figure on Assets side
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
    // both sides equal to liabAbs
    this.displayAssetsTotal      = assetAbs + add; // = liabAbs
    this.displayLiabilitiesTotal = liabAbs;
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
