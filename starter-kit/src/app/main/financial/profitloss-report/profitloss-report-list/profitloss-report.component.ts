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

  purchaseAccounts: any[] = [];
  salesAccounts: any[] = [];
  ProfitlossList: any[] = [];

  constructor(private _profitlossService: ProfitlossService) { }

  ngOnInit(): void {
    this.loadProfitlossDetails();
  }

  ngAfterViewInit(): void {
    // initial render (top cards icons)
    setTimeout(() => feather.replace());
  }

  // ===== API CALL & MAPPING =====
  loadProfitlossDetails() {
    this._profitlossService.GetGeneralLedger().subscribe((res: any) => {
      this.ProfitlossList = res?.data || [];

      // Left side – Purchase Accounts
      this.purchaseAccounts = this.ProfitlossList
        .filter((x: any) => x.purchase && x.purchase !== 0)
        .map((x: any) => ({
          name: x.headName,
          amount: x.purchase,
          code: x.headCode,
          avatarText: this.getInitials(x.headName),
          avatarColor: this.getAvatarColor(x.headName)
        }));

      // Right side – Sales Accounts
      this.salesAccounts = this.ProfitlossList
        .filter((x: any) => x.sales && x.sales !== 0)
        .map((x: any) => ({
          name: x.headName,
          amount: x.sales,
          code: x.headCode,
          avatarText: this.getInitials(x.headName),
          avatarColor: this.getAvatarColor(x.headName)
        }));

      // icons for new rows
      setTimeout(() => feather.replace());
    });
  }

  // ===== Helpers =====
  private getInitials(name: string): string {
    if (!name) { return ''; }
    const parts = name.trim().split(' ');
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();   // "Laptop" -> "LA"
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

  // ===== Totals & summary cards =====
  get purchaseTotal(): number {
    return this.purchaseAccounts.reduce(
      (sum: number, x: any) => sum + (x.amount || 0),
      0
    );
  }

  get salesTotal(): number {
    return this.salesAccounts.reduce(
      (sum: number, x: any) => sum + (x.amount || 0),
      0
    );
  }

  get totalExpense(): number {
    return this.purchaseTotal;
  }

  get totalSales(): number {
    return this.salesTotal;
  }

  get netProfit(): number {
    // same as sum of netProfit from API, but simpler:
    return this.salesTotal - this.purchaseTotal;
  }

  get netProfitClass(): string {
    return this.netProfit >= 0 ? 'text-success' : 'text-danger';
  }

}
