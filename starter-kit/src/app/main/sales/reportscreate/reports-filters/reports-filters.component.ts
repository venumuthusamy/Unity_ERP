import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { NgForm } from '@angular/forms';

/* --- Types --- */
export type DateRangeValue =
  | 'today' | 'yesterday'
  | 'last7' | 'last30'
  | 'thisMonth' | 'lastMonth'
  | 'custom';

export interface FilterModel {
  dateRange: DateRangeValue | null;
  fromDate: string | null;
  toDate: string | null;
  customerId: number | null;
  branchId: number | null;
  status: string | null;
  salespersonId: number | null;
  categoryId: number | null;
}

export interface FilterApplyPayload extends FilterModel {
  startDate?: string | null;
  endDate?: string | null;
}

@Component({
  selector: 'app-reports-filters',
  templateUrl: './reports-filters.component.html',
  styleUrls: ['./reports-filters.component.scss']
})
export class ReportsFiltersComponent implements OnInit {
  /* Outputs */
  @Output() saved = new EventEmitter<FilterApplyPayload>();
  @Output() canceled = new EventEmitter<void>();

  /* If you want to feed lists from parent, keep these @Input()s.
     Otherwise the defaults below will work for now. */
  @Input() customers: Array<{ id: number; name: string }> = [
    { id: 1, name: 'Alpha Co' }, { id: 2, name: 'Beta Traders' }
  ];
  @Input() branches: Array<{ id: number; name: string }> = [
    { id: 10, name: 'Chennai' }, { id: 11, name: 'Coimbatore' }
  ];
  @Input() salespersons: Array<{ id: number; name: string }> = [
    { id: 100, name: 'Ravi' }, { id: 101, name: 'Meena' }
  ];
  @Input() categories: Array<{ id: number; name: string }> = [
    { id: 201, name: 'Electronics' }, { id: 202, name: 'FMCG' }
  ];
  @Input() statuses: Array<{ value: string; label: string }> = [
    { value: 'draft',    label: 'Draft' },
    { value: 'approved', label: 'Approved' },
    { value: 'posted',   label: 'Posted' },
    { value: 'cancel',   label: 'Cancelled' }
  ];

  brand = '#2E5F73';

  dateRangeOptions: Array<{ value: DateRangeValue; label: string }> = [
    { value: 'today',     label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last7',     label: 'Last 7 days' },
    { value: 'last30',    label: 'Last 30 days' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'lastMonth', label: 'Last Month' },
    { value: 'custom',    label: 'Custom Range' }
  ];

  /* === This matches your HTML bindings === */
  filterModel: FilterModel = {
    dateRange: 'last30',
    fromDate: null,
    toDate: null,
    customerId: null,
    branchId: null,
    status: null,
    salespersonId: null,
    categoryId: null
  };

  constructor() {}

  ngOnInit(): void {}

  toggleSidebar(id: string) {
    console.debug('toggleSidebar:', id);
    // integrate with your layout service if needed
  }

  onSubmit(form: NgForm) {
    form.control.markAllAsTouched();

    if (!this.filterModel.dateRange) return;

    if (this.filterModel.dateRange === 'custom') {
      if (!this.filterModel.fromDate || !this.filterModel.toDate) return;
      if (this.filterModel.fromDate > this.filterModel.toDate) return;
    }

    const payload = this.resolveRange(this.filterModel);
    this.saved.emit(payload);
    this.toggleSidebar('new-user-sidebar'); // same id you already close
  }

  onCancel() {
    this.canceled.emit();
    this.toggleSidebar('new-user-sidebar');
  }

  onReset() {
    this.filterModel = {
      dateRange: 'last30',
      fromDate: null,
      toDate: null,
      customerId: null,
      branchId: null,
      status: null,
      salespersonId: null,
      categoryId: null
    };
  }

  private resolveRange(model: FilterModel): FilterApplyPayload {
    const today = new Date();
    const ymd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    let startDate: string | null = null;
    let endDate: string | null = null;

    const firstDayThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayThisMonth  = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDayLastMonth  = new Date(today.getFullYear(), today.getMonth(), 0);

    switch (model.dateRange) {
      case 'today':      startDate = endDate = ymd(today); break;
      case 'yesterday': { const d = new Date(today); d.setDate(d.getDate() - 1); startDate = endDate = ymd(d); break; }
      case 'last7':     { const d = new Date(today); d.setDate(d.getDate() - 6); startDate = ymd(d); endDate = ymd(today); break; }
      case 'last30':    { const d = new Date(today); d.setDate(d.getDate() - 29); startDate = ymd(d); endDate = ymd(today); break; }
      case 'thisMonth':  startDate = ymd(firstDayThisMonth); endDate = ymd(lastDayThisMonth); break;
      case 'lastMonth':  startDate = ymd(firstDayLastMonth); endDate = ymd(lastDayLastMonth); break;
      case 'custom':     startDate = model.fromDate; endDate = model.toDate; break;
      default:           startDate = null; endDate = null; break;
    }

    return { ...model, startDate, endDate };
  }
}
