import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { JournalService } from '../journalservice/journal.service';
import Swal from 'sweetalert2';
import { PeriodCloseService } from '../../period-close-fx/period-close-fx.service';

type JournalRow = {
  id: number;                 // 👈 NEW
  headName: string;
  headCode: number | string;
  amount: number;             // credit
  debitAmount: number;        // debit
  isRecurring: boolean;
  recurringFrequency?: string | null;
  isPosted?: boolean;         // 👈 NEW (optional)
};
export interface PeriodStatusDto {
  isLocked: boolean;
  periodName?: string;
  periodCode?: string;
  startDate?: string;
  endDate?: string;
}

@Component({
  selector: 'app-journal',
  templateUrl: './journal.component.html',
  styleUrls: ['./journal.component.scss']
})
export class JournalComponent implements OnInit {

  // Filters / header
  journalDate: string | null = null;
  reference: string = '';
  selectedType: string | null = null;

  journalTypes = [
    { text: 'Standard',  value: 'Standard'  },
    { text: 'Accrual',   value: 'Accrual'   },
    { text: 'Adjustment',value: 'Adjustment'}
  ];

  // Data
  journalList: JournalRow[] = [];

  // Header info
  entryTypeLabel: string = '-';          // Recurring / One-time payment
  recurringFrequencyLabel: string = '-'; // Daily / Monthly / Every Minute (Test) / -

  // Totals
  totalDebit: number = 0;
  totalCredit: number = 0;

  isLoading = false;
isPeriodLocked = false;
  currentPeriodName = '';
  constructor(
    private router: Router,
    private journalService: JournalService,
    private periodService: PeriodCloseService
  ) { }

  ngOnInit(): void {
    const today = new Date().toISOString().substring(0, 10);
    this.checkPeriodLockForDate(today);
    this.loadJournals();
  }
private checkPeriodLockForDate(dateStr: string): void {
    if (!dateStr) { return; }

    this.periodService.getStatusForDateWithName(dateStr).subscribe({
      next: (res: PeriodStatusDto | null) => {
        this.isPeriodLocked = !!res?.isLocked;
        this.currentPeriodName = res?.periodName || '';
      },
      error: () => {
        // if fails, UI side don’t hard-lock; backend will still protect
        this.isPeriodLocked = false;
        this.currentPeriodName = '';
      }
    });
  }

  private showPeriodLockedSwal(action: string): void {
    Swal.fire(
      'Period Locked',
      this.currentPeriodName
        ? `Period "${this.currentPeriodName}" is locked. You cannot ${action} in this period.`
        : `Selected accounting period is locked. You cannot ${action}.`,
      'warning'
    );
  }
  reload(): void {
    this.loadJournals();
  }

  loadJournals(): void {
    this.isLoading = true;

    this.journalService.GetAllJournals().subscribe({
      next: (res: any) => {
        this.isLoading = false;

        // response shape: { isSuccess, message, data: [...] }
        const rows = res?.data || [];
        this.journalList = rows as JournalRow[];

        this.updateHeaderRecurringInfo();
        this.recalcTotals();
      },
      error: err => {
        console.error(err);
        this.isLoading = false;
        this.journalList = [];
        this.entryTypeLabel = '-';
        this.recurringFrequencyLabel = '-';
        this.totalDebit = 0;
        this.totalCredit = 0;
      }
    });
  }

  private updateHeaderRecurringInfo(): void {
    if (!this.journalList || this.journalList.length === 0) {
      this.entryTypeLabel = '-';
      this.recurringFrequencyLabel = '-';
      return;
    }

    const recurringRow = this.journalList.find(r => r.isRecurring);

    if (recurringRow) {
      this.entryTypeLabel = 'Recurring';
      this.recurringFrequencyLabel = this.getFrequencyLabel(recurringRow.recurringFrequency);
    } else {
      this.entryTypeLabel = 'One-time payment';
      this.recurringFrequencyLabel = '-';
    }
  }

  getFrequencyLabel(freq?: string | null): string {
    switch (freq) {
      case 'Daily':        return 'Daily';
      case 'Weekly':       return 'Weekly';
      case 'Monthly':      return 'Monthly';
      case 'Quarterly':    return 'Quarterly';
      case 'Yearly':       return 'Yearly';
      case 'EveryMinute':  return 'Every minute (Test)';      // 👈 your current response
      case 'TenMin':       return 'Every 10 minutes (Test)';  // 👈 fallback if some old data
      default:             return '-';
    }
  }

  recalcTotals(): void {
    let debit = 0;
    let credit = 0;

    for (const r of this.journalList || []) {
      debit  += Number(r.debitAmount) || 0;
      credit += Number(r.amount) || 0;
    }

    this.totalDebit = debit;
    this.totalCredit = credit;
  }

newJournal(): void {
 this.router.navigate(['financial/create-journal']);
}

  submit(): void {
    debugger
  if (!this.journalList || this.journalList.length === 0) {
    return;
  }

  // only valid ids
  const ids = this.journalList
    .map(r => r.id)
    .filter(id => !!id);

  if (!ids.length) {
    return;
  }

  this.isLoading = true;

  this.journalService.postBatch(ids).subscribe({
    next: res => {
      this.isLoading = false;
      Swal.fire('hi','Journals Posted General Ledger Successfully','success')
      // reload list so we see updated data
      this.loadJournals();
    },
    error: err => {
      this.isLoading = false;
      console.error('Error posting journals', err);
    }
  });
}

}
