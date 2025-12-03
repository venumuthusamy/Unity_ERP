import { Component, OnInit, AfterViewInit } from '@angular/core';
import feather from 'feather-icons';
import { ProfitlossService } from '../profitloss-service/profitloss.service';

@Component({
  selector: 'app-profitloss-report',
  templateUrl: './profitloss-report.component.html',
  styleUrls: ['./profitloss-report.component.scss']
})
export class ProfitlossReportComponent implements OnInit, AfterViewInit {

  headerTitle = 'Profit & Loss';

  ProfitlossList: any[] = [];

  // Base rows (without Net Profit / Net Loss)
  private purchaseBase: any[] = [];
  private salesBase: any[] = [];

  // Rows actually displayed in UI (include Net Profit / Net Loss line)
  purchaseRows: any[] = [];
  salesRows: any[] = [];

  // Summary numbers
  totalExpense = 0;   // = base purchase total (no net row)
  totalSales   = 0;   // = base sales total (no net row)
  netProfit    = 0;   // sales - purchase

  // Column grand totals (bottom “Total” rows)
  leftGrandTotal  = 0;   // Purchase column final total
  rightGrandTotal = 0;   // Sales column final total

  constructor(private _profitlossService: ProfitlossService) {}

  ngOnInit(): void {
    this.loadProfitlossDetails();
  }

  ngAfterViewInit(): void {
    setTimeout(() => feather.replace());
  }

  // =====================================================
  // API CALL & MAPPING
  // =====================================================
  loadProfitlossDetails() {
    this._profitlossService.GetProfitLossDetails().subscribe((res: any) => {
      this.ProfitlossList = res?.data || [];

      // ----- LEFT: Purchase Accounts (hide 0.00) -----
      this.purchaseBase = this.ProfitlossList
        .filter((x: any) =>
          x.purchase !== null &&
          x.purchase !== undefined &&
          Number(x.purchase) !== 0
        )
        .map((x: any) => ({
          name: x.headName,
          amount: Number(x.purchase),
          code: x.headCode,
          avatarText: this.getInitials(x.headName),
          avatarColor: this.getAvatarColor(x.headName),
          isPnLLine: false
        }));

      // ----- RIGHT: Sales Accounts (hide 0.00) -----
      this.salesBase = this.ProfitlossList
        .filter((x: any) =>
          x.sales !== null &&
          x.sales !== undefined &&
          Number(x.sales) !== 0
        )
        .map((x: any) => ({
          name: x.headName,
          amount: Number(x.sales),
          code: x.headCode,
          avatarText: this.getInitials(x.headName),
          avatarColor: this.getAvatarColor(x.headName),
          isPnLLine: false
        }));

      // Build totals + net row
      this.buildProfitLossView();

      setTimeout(() => feather.replace());
    });
  }

  // =====================================================
  // BUILD VIEW (ADD NET PROFIT / NET LOSS LINE)
  // =====================================================
  private buildProfitLossView(): void {
    // Base totals (without net row)
    this.totalExpense = this.purchaseBase.reduce(
      (sum, r) => sum + (Number(r.amount) || 0), 0
    );

    this.totalSales = this.salesBase.reduce(
      (sum, r) => sum + (Number(r.amount) || 0), 0
    );

    // Net profit (can be negative)
    this.netProfit = this.totalSales - this.totalExpense;

    // Start from base arrays
    this.purchaseRows = [...this.purchaseBase];
    this.salesRows = [...this.salesBase];

    if (this.netProfit > 0) {
      // ---------- PROFIT ----------
      // Add Net Profit to Purchase side so:
      //   Purchase + NetProfit = Sales
      this.purchaseRows.push({
        name: 'Net Profit',
        amount: this.netProfit,
        code: '',
        avatarText: '',
        avatarColor: '',
        isPnLLine: true
      });

      this.leftGrandTotal  = this.totalExpense + this.netProfit; // = totalSales
      this.rightGrandTotal = this.totalSales;

    } else if (this.netProfit < 0) {
      // ---------- LOSS ----------
      const netLoss = Math.abs(this.netProfit);

      // Add Net Loss to Sales side so:
      //   Sales + NetLoss = Purchase
      this.salesRows.push({
        name: 'Net Loss',
        amount: netLoss,
        code: '',
        avatarText: '',
        avatarColor: '',
        isPnLLine: true
      });

      this.leftGrandTotal  = this.totalExpense;
      this.rightGrandTotal = this.totalSales + netLoss; // = totalExpense

    } else {
      // Break-even – both sides already equal
      this.leftGrandTotal  = this.totalExpense;
      this.rightGrandTotal = this.totalSales;
    }
  }

  // =====================================================
  // Helpers
  // =====================================================
  private getInitials(name: string): string {
    if (!name) { return ''; }
    const parts = name.trim().split(' ');
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  private getAvatarColor(key: string): string {
    const colors = ['#FFE1E1', '#FFEAD1', '#E8F2FF', '#EAF7E5', '#F5E1FF'];
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  // For top Net Profit card (green if profit, red if loss)
  get netProfitClass(): string {
    return this.netProfit >= 0 ? 'text-success' : 'text-danger';
  }
}
