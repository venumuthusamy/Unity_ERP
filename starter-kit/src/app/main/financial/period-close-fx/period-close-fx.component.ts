import { Component, OnInit } from '@angular/core';
import { PeriodCloseService, PeriodOption, PeriodStatus } from '../period-close-fx/period-close-fx.service';

@Component({
  selector: 'app-period-close-fx',
  templateUrl: './period-close-fx.component.html',
  styleUrls: ['./period-close-fx.component.scss']
})
export class PeriodCloseFxComponent implements OnInit {

  periods: PeriodOption[] = [];
  selectedPeriodId: number | null = null;

  fxRevalDate: string = '';
  isLocking = false;
  isRunningFx = false;
  status: PeriodStatus | null = null;

  // runtime flags
  get isLocked(): boolean {
    return !!this.status?.isLocked;
  }

  // role info – normally auth serviceல இருந்து வரும்
  isAdmin = true; // demo காக true-ஆ வைத்திருக்கிறேன்

  constructor(private periodService: PeriodCloseService) { }

  ngOnInit(): void {
    this.loadPeriods();
  }

  loadPeriods(): void {
    this.periodService.getPeriods().subscribe({
      next: (list) => {
        this.periods = list || [];
        if (this.periods.length) {
          // default = latest (last item)
          const last = this.periods[this.periods.length - 1];
          this.selectedPeriodId = last.id;
          this.onPeriodChange(this.selectedPeriodId);
        }
      },
      error: err => console.error('Error loading periods', err)
    });
  }

  onPeriodChange(id: number | null): void {
    if (!id) {
      this.selectedPeriodId = null;
      this.status = null;
      return;
    }

    this.selectedPeriodId = id;

    this.periodService.getStatus(id).subscribe({
      next: s => {
        this.status = s;
        // default FX date = period end date
        if (s && s.periodEndDate) {
          this.fxRevalDate = s.periodEndDate.substring(0, 10);
        }
      },
      error: err => console.error('Error loading period status', err)
    });
  }

  onToggleLock(): void {
    if (!this.selectedPeriodId || !this.isAdmin || !this.status) {
      return;
    }

    const targetLock = !this.status.isLocked;
    if (!confirm(targetLock ? 'Lock this period?' : 'Unlock this period?')) {
      return;
    }

    this.isLocking = true;

    this.periodService.setLock(this.selectedPeriodId, targetLock).subscribe({
      next: s => {
        this.status = s;
        this.isLocking = false;
      },
      error: err => {
        console.error('Error changing lock', err);
        this.isLocking = false;
      }
    });
  }

  runFxRevaluation(): void {
    if (!this.selectedPeriodId || !this.fxRevalDate) {
      alert('Please choose period and FX Reval Date.');
      return;
    }

    if (!confirm('Run FX revaluation for this period?')) {
      return;
    }

    this.isRunningFx = true;

    this.periodService.runFxReval({
      periodId: this.selectedPeriodId,
      fxDate: this.fxRevalDate
    }).subscribe({
      next: result => {
        this.isRunningFx = false;
        alert('FX Revaluation completed successfully.');
      },
      error: err => {
        console.error('Error running FX revaluation', err);
        this.isRunningFx = false;
      }
    });
  }

  openTrialBalance(): void {
    if (!this.selectedPeriodId) { return; }
    // TB routeக்கு navigate பண்ணலாம் / report open பண்ணலாம்
    // உதாரணம்:
    window.open(`/reports/trial-balance?periodId=${this.selectedPeriodId}`, '_blank');
  }
}
