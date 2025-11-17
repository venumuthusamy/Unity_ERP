// src/app/main/finance/ap/accounts-payable.component.ts
import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { AccountsPayableService } from './accounts-payable.service';
import Swal from 'sweetalert2';
import * as feather from 'feather-icons';
import { SupplierService } from 'app/main/businessPartners/supplier/supplier.service';

type ApTab = 'invoices' | 'payments' | 'match';

@Component({
  selector: 'app-accounts-payable',
  templateUrl: './accounts-payable.component.html',
  styleUrls: ['./accounts-payable.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class AccountsPayableComponent implements OnInit {

  activeTab: ApTab = 'invoices';

  // suppliers
  suppliers: any[] = [];

  // INVOICES TAB
  invoices: any[] = [];
  private allInvoices: any[] = [];      // backup for search
  invoiceSearch = '';
  totalInvAmount = 0;
  totalInvPaid = 0;
  totalInvOutstanding = 0;

  // PAYMENTS TAB
  payments: any[] = [];
  paySupplierId: number = null;
  payInvoicesForSupplier: any[] = [];
  payInvoiceId: number = null;
  payDate: string;
  payMethodId: number = 2; // bank transfer
  payReference = '';
  payAmount: number = null;
  payNotes = '';

  // MATCH TAB
  matchRows: any[] = [];

  constructor(
    private apSvc: AccountsPayableService,
    private supplierSvc: SupplierService
  ) {
    const today = new Date();
    this.payDate = today.toISOString().substring(0, 10);
  }

  ngOnInit(): void {
    this.loadSuppliers();
    this.setTab('invoices'); // load invoices first time
  }

  ngAfterViewInit(): void {
    feather.replace();
  }

  // ---------- TABS ----------
  setTab(tab: ApTab): void {
    this.activeTab = tab;

    if (tab === 'invoices') {
      this.loadInvoices();
    } else if (tab === 'payments') {
      this.loadPayments();
    } else if (tab === 'match') {
      this.loadMatch();
    }
  }

  // ---------- COMMON ----------
  loadSuppliers(): void {
    this.supplierSvc.GetAllSupplier().subscribe({
      next: (res: any) => {
        this.suppliers = res?.data || res || [];
      },
      error: () => Swal.fire('Error', 'Failed to load suppliers', 'error')
    });
  }

  // ---------- INVOICES TAB ----------
  loadInvoices(): void {
    this.apSvc.getApInvoices().subscribe({
      next: (res: any) => {
        const rows = res?.data || res || [];
        this.allInvoices = rows;
        this.invoices = [...rows];
        this.calcInvoiceTotals();
      },
      error: () => Swal.fire('Error', 'Failed to load AP invoices', 'error')
    });
  }

  calcInvoiceTotals(): void {
    this.totalInvAmount = 0;
    this.totalInvPaid = 0;
    this.totalInvOutstanding = 0;

    this.invoices.forEach(i => {
      this.totalInvAmount += i.grandTotal || 0;
      this.totalInvPaid += i.paidAmount || 0;
      this.totalInvOutstanding += i.outstandingAmount || 0;
    });
  }

  filterInvoices(event: any): void {
    const val = (event.target.value || '').toLowerCase();
    this.invoiceSearch = val;

    if (!val) {
      this.invoices = [...this.allInvoices];
      this.calcInvoiceTotals();
      return;
    }

    this.invoices = this.allInvoices.filter(i =>
      (i.invoiceNo || '').toLowerCase().includes(val) ||
      (i.supplierName || '').toLowerCase().includes(val)
    );
    this.calcInvoiceTotals();
  }

  getInvoiceStatusClass(status: number): string {
    switch (status) {
      case 2: return 'badge-success'; // Paid
      case 1: return 'badge-warning'; // Partial
      default: return 'badge-danger'; // Unpaid
    }
  }

  // ---------- PAYMENTS TAB ----------
  loadPayments(): void {
    this.apSvc.getPayments().subscribe({
      next: (res: any) => {
        this.payments = res?.data || res || [];
      },
      error: () => Swal.fire('Error', 'Failed to load payments', 'error')
    });
  }

  onPaySupplierChange(): void {
    this.payInvoiceId = null;
    this.payAmount = null;

    if (!this.paySupplierId) {
      this.payInvoicesForSupplier = [];
      return;
    }

    this.apSvc.getApInvoicesBySupplier(this.paySupplierId).subscribe({
      next: (res: any) => {
        const rows = res?.data || res || [];
        // only invoices with outstanding > 0
        this.payInvoicesForSupplier = rows.filter((x: any) => (x.outstandingAmount || 0) > 0);
      },
      error: () => Swal.fire('Error', 'Failed to load invoices for supplier', 'error')
    });
  }

  onPayInvoiceChange(): void {
    if (!this.payInvoiceId) {
      this.payAmount = null;
      return;
    }
    const inv = this.payInvoicesForSupplier.find(x => x.id === +this.payInvoiceId);
    if (inv) {
      this.payAmount = inv.outstandingAmount; // default full OS
    }
  }

  postPayment(): void {
    if (!this.paySupplierId) {
      Swal.fire('Warning', 'Select supplier', 'warning');
      return;
    }
    if (!this.payInvoiceId) {
      Swal.fire('Warning', 'Select invoice', 'warning');
      return;
    }
    if (!this.payAmount || this.payAmount <= 0) {
      Swal.fire('Warning', 'Enter valid amount', 'warning');
      return;
    }

    const inv = this.payInvoicesForSupplier.find(x => x.id === +this.payInvoiceId);
    if (inv && this.payAmount > inv.outstandingAmount) {
      Swal.fire('Warning', 'Amount cannot exceed outstanding', 'warning');
      return;
    }

    const payload = {
      supplierInvoiceId: +this.payInvoiceId,
      supplierId: +this.paySupplierId,
      paymentDate: this.payDate,
      paymentMethodId: this.payMethodId,
      referenceNo: this.payReference,
      amount: this.payAmount,
      notes: this.payNotes,
      createdBy: 1 // TODO: logged-in user id
    };

    this.apSvc.createPayment(payload).subscribe({
      next: (res: any) => {
        if (res?.isSuccess) {
          Swal.fire('Success', 'Payment posted', 'success');
          // refresh everything and stay on AP screen
          this.resetPaymentForm();
          this.loadPayments();
          this.loadInvoices();
          this.onPaySupplierChange();
        } else {
          Swal.fire('Error', res?.message || 'Failed to post payment', 'error');
        }
      },
      error: () => Swal.fire('Error', 'Failed to post payment', 'error')
    });
  }

  resetPaymentForm(): void {
    const today = new Date().toISOString().substring(0, 10);
    this.payDate = today;
    this.payMethodId = 2;
    this.payReference = '';
    this.payAmount = null;
    this.payNotes = '';
    this.payInvoiceId = null;
  }

  getPaymentMethodName(id?: number): string {
    switch (id) {
      case 1: return 'Cash';
      case 2: return 'Bank Transfer';
      case 3: return 'Cheque';
      default: return 'Other';
    }
  }

  // ---------- MATCH TAB ----------
  loadMatch(): void {
    this.apSvc.getMatchList().subscribe({
      next: (res: any) => {
        this.matchRows = res?.data || res || [];
      },
      error: () => Swal.fire('Error', 'Failed to load match list', 'error')
    });
  }

  matchStatusClass(status: string): string {
    if (!status) { return 'badge-secondary'; }
    const lower = status.toLowerCase();
    if (lower === 'matched') return 'badge-success';
    if (lower === 'warning') return 'badge-warning';
    return 'badge-danger';
  }
}
