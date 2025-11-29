import { AfterViewInit, Component, OnInit } from '@angular/core';
import feather from 'feather-icons';
interface DaybookVoucher {
  date: Date;
  voucherNo: string;
  type: 'Journal' | 'Bank Receipt' | 'Bank Payment';
  typeClass?: string;          // extra css class for badge color
  account: string;
  reference: string;
  debit?: number;
  credit?: number;
  runningBalance: number;
}

@Component({
  selector: 'app-daybook-report',
  templateUrl: './daybook-report.component.html',
  styleUrls: ['./daybook-report.component.scss']
})
export class DaybookReportComponent implements OnInit,AfterViewInit {

  vouchers: DaybookVoucher[] = [];

  totalDebit = 0;
  totalCredit = 0;
  netMovement = 0;
  netMovementAbs = 0;
  netMovementType: 'Dr' | 'Cr' = 'Dr';

  viewMode: 'detailed' | 'summary' = 'detailed';

  constructor() { }

  ngOnInit(): void {
    // --- demo data (same as your screenshot) ---
    this.vouchers = [
      {
        date: new Date(2025, 10, 28),            // month index 10 = November
        voucherNo: 'MJ-2025-0008',
        type: 'Journal',
        typeClass: 'db-type-journal',
        account: 'Rent Expense',
        reference: 'November office rent',
        debit: 45000,
        runningBalance: 45000
      },
      {
        date: new Date(2025, 10, 28),
        voucherNo: 'BR-2025-0121',
        type: 'Bank Receipt',
        typeClass: 'db-type-receipt',
        account: 'Gowtham Traders',
        reference: 'Collection against SI-2025-0042',
        credit: 32000,
        runningBalance: 13000
      },
      {
        date: new Date(2025, 10, 28),
        voucherNo: 'BP-2025-0095',
        type: 'Bank Payment',
        typeClass: 'db-type-payment',
        account: 'FBH Distributors',
        reference: 'Payment for PIN-2025-0019',
        debit: 28000,
        runningBalance: 41000
      }
    ];

    this.calculateTotals();
  }

  private calculateTotals(): void {
    this.totalDebit = this.vouchers.reduce((sum, v) => sum + (v.debit || 0), 0);
    this.totalCredit = this.vouchers.reduce((sum, v) => sum + (v.credit || 0), 0);

    this.netMovement = this.totalDebit - this.totalCredit;
    this.netMovementAbs = Math.abs(this.netMovement);
    this.netMovementType = this.netMovement >= 0 ? 'Dr' : 'Cr';
  }

  setViewMode(mode: 'detailed' | 'summary'): void {
    this.viewMode = mode;
    // later you can change table columns/rows based on mode
  }

  onPrintDaybook(): void {
    // hook your print / export logic here
    window.print();
  }


    ngAfterViewInit(): void {
      // initial render (top cards icons)
      setTimeout(() => feather.replace());
    }
  
}
