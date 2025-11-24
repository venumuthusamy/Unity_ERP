import {
  Component,
  OnInit,
  AfterViewInit,
  ViewEncapsulation
} from '@angular/core';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';
import * as feather from 'feather-icons';

import { AccountsPayableService } from './accounts-payable.service';
import { SupplierService } from 'app/main/businessPartners/supplier/supplier.service';

type ApTab = 'invoices' | 'payments' | 'match';

type SupplierInvoiceGroup = {
  supplierId: number;
  supplierName: string;
  totalGrandTotal: number;
  totalPaid: number;
  totalDebitNote: number;
  totalOutstanding: number;
  invoices: any[];
};

@Component({
  selector: 'app-accounts-payable',
  templateUrl: './accounts-payable.component.html',
  styleUrls: ['./accounts-payable.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class AccountsPayableComponent implements OnInit, AfterViewInit {

  activeTab: ApTab = 'invoices';

  // SUPPLIERS
  suppliers: any[] = [];

  // INVOICES TAB
  invoices: any[] = [];
  private allInvoices: any[] = [];
  invoiceSearch = '';

  totalInvAmount = 0;
  totalInvPaid = 0;
  totalInvOutstanding = 0;
  totalInvDebitNote = 0;
payInvSelectAll = false;
  supplierGroups: SupplierInvoiceGroup[] = [];
  expandedSupplierIds = new Set<number>();
  isPeriodLocked = false;
  currentPeriodName = '';
  // ----- Pagination: Invoices (supplier summary) -----
  invPage = 1;
  invPageSize = 10;

  // PAYMENTS TAB
  payments: any[] = [];
  showPaymentForm = false;

  // ----- Pagination: Payments list -----
  payListPage = 1;
  payListPageSize = 10;

  paySupplierId: number | null = null;
  supplierInvoicesAll: any[] = [];   // open invoices for selected supplier

  // ----- Pagination: Supplier invoices in payment screen -----
  payInvPage = 1;
  payInvPageSize = 10;

  payDate: string;
  payMethodId: number = 2;           // Bank Transfer
  payReference = '';
  payAmount: number = 0;             // auto from selected invoices (editable)
  payNotes = '';
  amountEditedManually = false;

  supTotalInvoice = 0;
  supTotalPaid = 0;
  supTotalDebitNote = 0;
  supTotalNetOutstanding = 0;

  // MATCH TAB
  matchRows: any[] = [];

  // ----- Pagination: 3-way match -----
  matchPage = 1;
  matchPageSize = 10;

  constructor(
    private apSvc: AccountsPayableService,
    private supplierSvc: SupplierService
  ) {
    const today = new Date();
    this.payDate = today.toISOString().substring(0, 10);
  }

  // ---------------- LIFECYCLE ----------------
  ngOnInit(): void {
    this.checkPeriodLockForDate(this.payDate);
    this.loadSuppliers();
    this.setTab('invoices');
  }

  ngAfterViewInit(): void {
    feather.replace();
  }

  // ---------------- TABS ----------------
  setTab(tab: ApTab): void {
    this.activeTab = tab;

    if (tab === 'invoices') {
      this.loadInvoices();
    } else if (tab === 'payments') {
      this.showPaymentForm = false;
      this.loadPayments();
      this.cancelPayment(); // reset form state
    } else if (tab === 'match') {
      this.loadMatch();
    }
  }

  // ---------------- COMMON ----------------
  loadSuppliers(): void {
    this.supplierSvc.GetAllSupplier().subscribe({
      next: (res: any) => {
        this.suppliers = res?.data || res || [];
      },
      error: () => Swal.fire('Error', 'Failed to load suppliers', 'error')
    });
  }

  // ---------------- INVOICES TAB ----------------
  loadInvoices(): void {
    this.apSvc.getApInvoices().subscribe({
      next: (res: any) => {
        const rows = res?.data || res || [];
        this.allInvoices = rows;
        this.invoices = [...rows];
        this.calcInvoiceTotals();
        this.buildSupplierGroups();
      },
      error: () => Swal.fire('Error', 'Failed to load AP invoices', 'error')
    });
  }

  calcInvoiceTotals(): void {
    this.totalInvAmount = 0;
    this.totalInvPaid = 0;
    this.totalInvOutstanding = 0;
    this.totalInvDebitNote = 0;

    this.invoices.forEach(i => {
      this.totalInvAmount      += Number(i.grandTotal        || 0);
      this.totalInvPaid        += Number(i.paidAmount        || 0);
      this.totalInvOutstanding += Number(i.outstandingAmount || 0);
      this.totalInvDebitNote   += Number(i.debitNoteAmount   || 0);
    });
  }

  buildSupplierGroups(): void {
    const map = new Map<number, SupplierInvoiceGroup>();

    for (const inv of this.invoices) {
      const supplierId = inv.supplierId || inv.SupplierId;
      if (!supplierId) continue;

      const supplierName = inv.supplierName || inv.SupplierName || '';

      let grp = map.get(supplierId);
      if (!grp) {
        grp = {
          supplierId,
          supplierName,
          totalGrandTotal: 0,
          totalPaid: 0,
          totalDebitNote: 0,
          totalOutstanding: 0,
          invoices: []
        };
        map.set(supplierId, grp);
      }

      const grand = Number(inv.grandTotal        || 0);
      const paid  = Number(inv.paidAmount        || 0);
      const dn    = Number(inv.debitNoteAmount   || 0);
      const os    = Number(inv.outstandingAmount || 0);

      grp.totalGrandTotal  += grand;
      grp.totalPaid        += paid;
      grp.totalDebitNote   += dn;
      grp.totalOutstanding += os;
      grp.invoices.push(inv);
    }

    this.supplierGroups = Array.from(map.values()).sort((a, b) =>
      a.supplierName.localeCompare(b.supplierName)
    );

    this.expandedSupplierIds.clear();
    this.invPage = 1; // reset pagination
  }

  filterInvoices(event: any): void {
    const val = (event.target.value || '').toLowerCase();
    this.invoiceSearch = val;

    if (!val) {
      this.invoices = [...this.allInvoices];
      this.calcInvoiceTotals();
      this.buildSupplierGroups();
      return;
    }

    this.invoices = this.allInvoices.filter(i =>
      (i.invoiceNo || '').toLowerCase().includes(val) ||
      (i.supplierName || '').toLowerCase().includes(val)
    );

    this.calcInvoiceTotals();
    this.buildSupplierGroups();
  }

  toggleSupplierExpand(supplierId: number): void {
    if (this.expandedSupplierIds.has(supplierId)) {
      this.expandedSupplierIds.delete(supplierId);
    } else {
      this.expandedSupplierIds.add(supplierId);
    }
  }

  isSupplierExpanded(supplierId: number): boolean {
    return this.expandedSupplierIds.has(supplierId);
  }

  getInvoiceStatusTextByAmounts(row: any): string {
    const paid = Number(row.paidAmount || 0);
    const dn   = Number(row.debitNoteAmount || 0);
    const os   = Number(row.outstandingAmount || 0);

    if (os <= 0 && (paid > 0 || dn > 0)) return 'Paid';
    if ((paid > 0 || dn > 0) && os > 0)  return 'Partial';
    return 'Unpaid';
  }

  getInvoiceStatusClassByAmounts(row: any): string {
    const txt = this.getInvoiceStatusTextByAmounts(row);
    switch (txt) {
      case 'Paid':    return 'badge-success';
      case 'Partial': return 'badge-warning';
      default:        return 'badge-danger';
    }
  }

  // ----- Pagination helpers: Invoices (supplier summary) -----
  get invTotalPages(): number {
    return Math.max(1, Math.ceil((this.supplierGroups?.length || 0) / this.invPageSize));
  }

  get pagedSupplierGroups(): SupplierInvoiceGroup[] {
    const start = (this.invPage - 1) * this.invPageSize;
    return (this.supplierGroups || []).slice(start, start + this.invPageSize);
  }

  invGoToPage(p: number): void {
    if (p < 1 || p > this.invTotalPages) { return; }
    this.invPage = p;
  }

  // ---------------- PAYMENTS TAB ----------------
  loadPayments(): void {
    this.apSvc.getPayments().subscribe({
      next: (res: any) => {
        this.payments = res?.data || res || [];
        this.payListPage = 1;
      },
      error: () => Swal.fire('Error', 'Failed to load payments', 'error')
    });
  }

  openNewPayment(): void {
    this.showPaymentForm = true;
    this.cancelPayment(); // reset data but keep tab
  }

  backToPaymentList(): void {
    this.showPaymentForm = false;
    this.cancelPayment();
  }

  cancelPaymentForm(): void {
    this.cancelPayment();
  }

  cancelPayment(): void {
    this.resetPaymentForm();
    this.paySupplierId = null;
    this.supplierInvoicesAll = [];
    this.supTotalInvoice = 0;
    this.supTotalPaid = 0;
    this.supTotalDebitNote = 0;
    this.supTotalNetOutstanding = 0;
    this.amountEditedManually = false;
    this.payInvPage = 1;
    this.payInvSelectAll = false;
  }

  onPaySupplierChange(): void {
    this.payAmount = 0;
    this.amountEditedManually = false;
    this.supTotalInvoice = 0;
    this.supTotalPaid = 0;
    this.supTotalDebitNote = 0;
    this.supTotalNetOutstanding = 0;
    this.supplierInvoicesAll = [];
    this.payInvPage = 1;
    this.payInvSelectAll = false;

    if (!this.paySupplierId) return;

    this.apSvc.getApInvoicesBySupplier(this.paySupplierId).subscribe({
      next: (res: any) => {
        const rawRows = res?.data || res || [];

        // only invoices which still have outstanding
        const rows = rawRows
          .filter((x: any) => Number(x.outstandingAmount || 0) > 0)
          .map((x: any) => ({ ...x, isSelected: false }));

        this.supplierInvoicesAll = rows;

        rows.forEach((x: any) => {
          const inv  = Number(x.grandTotal        || 0);
          const paid = Number(x.paidAmount        || 0);
          const dn   = Number(x.debitNoteAmount   || 0);
          const os   = Number(x.outstandingAmount || 0);

          this.supTotalInvoice        += inv;
          this.supTotalPaid           += paid;
          this.supTotalDebitNote      += dn;
          this.supTotalNetOutstanding += os;
        });
      },
      error: () => Swal.fire('Error', 'Failed to load invoices for supplier', 'error')
    });
  }

  // onInvoiceCheckboxChange(inv: any, checked: boolean): void {
  //   inv.isSelected = checked;
  //   this.recalcSelectedAmount();
  // }

  recalcSelectedAmount(): void {
    // if user already edited manually, don't override their value
    if (this.amountEditedManually) {
      return;
    }

    let total = 0;
    for (const x of this.supplierInvoicesAll || []) {
      if (x.isSelected) {
        total += Number(x.outstandingAmount || 0);
      }
    }
    this.payAmount = total;
  }

  onAmountInputChange(): void {
    this.amountEditedManually = true;
  }

  postPayment(): void {
    if (!this.paySupplierId) {
      Swal.fire('Warning', 'Select supplier', 'warning');
      return;
    }

    const selected = (this.supplierInvoicesAll || []).filter(x => x.isSelected);
    if (!selected.length) {
      Swal.fire('Warning', 'Select at least one invoice', 'warning');
      return;
    }

    if (!this.payAmount || this.payAmount <= 0) {
      Swal.fire('Warning', 'Amount is zero – select invoice(s) or enter amount', 'warning');
      return;
    }

    let requests: any[] = [];

    if (selected.length === 1) {
      // Single invoice: use the amount entered in the field
      const inv = selected[0];
      const payload = {
        supplierInvoiceId: inv.id,
        supplierId: this.paySupplierId,
        paymentDate: this.payDate,
        paymentMethodId: this.payMethodId,
        referenceNo: this.payReference,
        amount: this.payAmount,   // <- take from field
        notes: this.payNotes,
        createdBy: 1
      };
      requests = [this.apSvc.createPayment(payload)];
    } else {
      // Multiple invoices: pay full OS for each selected invoice
      requests = selected.map(inv => {
        const payload = {
          supplierInvoiceId: inv.id,
          supplierId: this.paySupplierId,
          paymentDate: this.payDate,
          paymentMethodId: this.payMethodId,
          referenceNo: this.payReference,
          amount: inv.outstandingAmount,
          notes: this.payNotes,
          createdBy: 1
        };
        return this.apSvc.createPayment(payload);
      });
    }

   forkJoin(requests).subscribe({
  next: (results: any[]) => {
    const allOk = results.every(r => r?.isSuccess !== false);
    if (allOk) {
      Swal.fire('Success', 'Payment(s) posted', 'success');
    } else {
      const firstErr = results.find(r => r?.isSuccess === false);
      Swal.fire('Warning', firstErr?.message || 'Some payments may have failed', 'warning');
    }

    this.loadPayments();
    this.loadInvoices();
    this.backToPaymentList();
  },
  error: (err) => {
    const msg = err?.error?.message || err?.message || 'Failed to post payments';

    // if message from backend is about locked period, show clearly
    if (msg.toLowerCase().includes('period') && msg.toLowerCase().includes('locked')) {
      Swal.fire('Period Locked', msg, 'error');
      this.checkPeriodLockForDate(this.payDate);
    } else {
      Swal.fire('Error', msg, 'error');
    }
  }
});

  }

  resetPaymentForm(): void {
    const today = new Date().toISOString().substring(0, 10);
    this.payDate = today;
    this.payMethodId = 2;
    this.payReference = '';
    this.payAmount = 0;
    this.payNotes = '';
    this.amountEditedManually = false;
    this.payInvSelectAll = false;
  }
onSelectAllInvoicesChange(checked: boolean): void {
  this.payInvSelectAll = checked;
  const list = this.supplierInvoicesAll || [];

  list.forEach(x => x.isSelected = checked);

  // User didn't type manually now – we recalc from selection
  this.amountEditedManually = false;
  this.recalcSelectedAmount();
}
onInvoiceCheckboxChange(inv: any, checked: boolean): void {
  inv.isSelected = checked;

  const list = this.supplierInvoicesAll || [];
  this.payInvSelectAll = list.length > 0 && list.every(x => x.isSelected);

  this.recalcSelectedAmount();
}

  getPaymentMethodName(id?: number): string {
    switch (id) {
      case 1: return 'Cash';
      case 2: return 'Bank Transfer';
      case 3: return 'Cheque';
      default: return 'Other';
    }
  }

  // ----- Pagination helpers: Payments list -----
  get payListTotalPages(): number {
    return Math.max(1, Math.ceil((this.payments?.length || 0) / this.payListPageSize));
  }

  get pagedPayments(): any[] {
    const start = (this.payListPage - 1) * this.payListPageSize;
    return (this.payments || []).slice(start, start + this.payListPageSize);
  }

  payListGoToPage(p: number): void {
    if (p < 1 || p > this.payListTotalPages) { return; }
    this.payListPage = p;
  }

  // ----- Pagination helpers: Supplier invoices in payment screen -----
  get payInvTotalPages(): number {
    return Math.max(1, Math.ceil((this.supplierInvoicesAll?.length || 0) / this.payInvPageSize));
  }

  get pagedSupplierInvoices(): any[] {
    const start = (this.payInvPage - 1) * this.payInvPageSize;
    return (this.supplierInvoicesAll || []).slice(start, start + this.payInvPageSize);
  }

  payInvGoToPage(p: number): void {
    if (p < 1 || p > this.payInvTotalPages) { return; }
    this.payInvPage = p;
  }

  // ---------------- 3-WAY MATCH TAB ----------------
  loadMatch(): void {
    this.apSvc.getMatchList().subscribe({
      next: (res: any) => {
        this.matchRows = res?.data || res || [];
        this.matchPage = 1;
      },
      error: () => Swal.fire('Error', 'Failed to load match list', 'error')
    });
  }

  matchStatusClass(status: string): string {
    if (!status) return 'badge-secondary';
    const lower = status.toLowerCase();
    if (lower === 'matched') return 'badge-success';
    if (lower === 'warning') return 'badge-warning';
    return 'badge-danger';
  }

  // ----- Pagination helpers: 3-way match -----
  get matchTotalPages(): number {
    return Math.max(1, Math.ceil((this.matchRows?.length || 0) / this.matchPageSize));
  }

  get pagedMatchRows(): any[] {
    const start = (this.matchPage - 1) * this.matchPageSize;
    return (this.matchRows || []).slice(start, start + this.matchPageSize);
  }

  matchGoToPage(p: number): void {
    if (p < 1 || p > this.matchTotalPages) { return; }
    this.matchPage = p;
  }
  checkPeriodLockForDate(dateStr: string): void {
    if (!dateStr) { return; }

    this.apSvc.getPeriodStatus(dateStr).subscribe({
      next: (res) => {
        this.isPeriodLocked = !!res.isLocked;
        this.currentPeriodName = res.periodName || '';
      },
      error: () => {
        // if API fails, safer to treat as locked or show warning
        this.isPeriodLocked = false;
        this.currentPeriodName = '';
      }
    });
  }

  // whenever user changes payment date, re-check
  onPayDateChange(): void {
    this.checkPeriodLockForDate(this.payDate);
  }
}
