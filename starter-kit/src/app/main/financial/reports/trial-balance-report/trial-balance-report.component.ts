import { Component, OnInit } from '@angular/core';
import { ReportsService } from './report-service';
import { TrialBalance } from '../trial-balance-model';

@Component({
  selector: 'app-trial-balance-report',
  templateUrl: './trial-balance-report.component.html',
  styleUrls: ['./trial-balance-report.component.scss']
})
export class TrialBalanceReportComponent implements OnInit {


  fromDate: string | null = null;
  toDate: string | null = null;
  companyId: number | null = 1;

  rows: TrialBalance[] = [];
  totalDebit = 0;
  totalCredit = 0;
  isLoading = false;

  constructor(private reportsService: ReportsService) { }

  ngOnInit(): void {

  }

  runTB(): void {
    const body = {
      fromDate: this.fromDate,
      toDate: this.toDate,
      companyId: this.companyId
    };

    this.isLoading = true;
    this.reportsService.getTrialBalance(body).subscribe({
      next: (res: any) => {
        this.rows = res.data || [];
        this.totalDebit = this.rows.reduce((sum, r) => sum + (r.debit || 0), 0);
        this.totalCredit = this.rows.reduce((sum, r) => sum + (r.credit || 0), 0);
        this.isLoading = false;
      },
      error: () => {
        this.rows = [];
        this.totalDebit = 0;
        this.totalCredit = 0;
        this.isLoading = false;
      }
    });
  }

}




