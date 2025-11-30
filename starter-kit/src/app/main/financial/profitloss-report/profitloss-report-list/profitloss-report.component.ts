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

  constructor(private _profitlossService: ProfitlossService) {}

  ngOnInit(): void {
    this.loadProfitlossDetails();
  }

  ngAfterViewInit(): void {
    setTimeout(() => feather.replace());
  }

  // ===== API CALL & MAPPING =====
  loadProfitlossDetails() {
    this._profitlossService.GetProfitLossDetails().subscribe((res: any) => {
      this.ProfitlossList = res?.data || [];

      // 🔹 LEFT – Purchase Accounts (HIDE 0.00)
      this.purchaseAccounts = this.ProfitlossList
        .filter((x: any) =>
          x.purchase !== null &&
          x.purchase !== undefined &&
          Number(x.purchase) !== 0               // <- remove all 0.00
        )
        .map((x: any) => ({
          name: x.headName,
          amount: Number(x.purchase),
          code: x.headCode,
          avatarText: this.getInitials(x.headName),
          avatarColor: this.getAvatarColor(x.headName)
        }));

      // 🔹 RIGHT – Sales Accounts (HIDE 0.00)
      this.salesAccounts = this.ProfitlossList
        .filter((x: any) =>
          x.sales !== null &&
          x.sales !== undefined &&
          Number(x.sales) !== 0                  // <- remove all 0.00
        )
        .map((x: any) => ({
          name: x.headName,
          amount: Number(x.sales),
          code: x.headCode,
          avatarText: this.getInitials(x.headName),
          avatarColor: this.getAvatarColor(x.headName)
        }));

      setTimeout(() => feather.replace());
    });
  }

  // ===== Helpers =====
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

  // ===== Totals & summary cards (only non-zero rows counted) =====
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
    return this.salesTotal - this.purchaseTotal;
  }

  get netProfitClass(): string {
    return this.netProfit >= 0 ? 'text-success' : 'text-danger';
  }
}
