import { Component, OnInit } from '@angular/core';
import {
  ArInvoiceListItem,
  ArInvoiceService,
  ArCustomerGroup
} from '../invoice-service';

@Component({
  selector: 'app-invoice-create',
  templateUrl: './invoice-create.component.html',
  styleUrls: ['./invoice-create.component.scss']
})
export class InvoiceCreateComponent implements OnInit {
  // groups by customer
  groups: ArCustomerGroup[] = [];
  filteredGroups: ArCustomerGroup[] = [];

  searchTerm = '';
  loading = false;

  // header totals
  totalInvoiceAmount = 0;
  totalPaid = 0;
  totalCreditNote = 0;
  netOutstanding = 0;

  constructor(private arService: ArInvoiceService) { }

  ngOnInit(): void {
    this.loadInvoices();
  }

  loadInvoices(): void {
    this.loading = true;
    this.arService.getInvoices().subscribe({
      next: data => {
        this.buildGroups(data);
        this.computeHeaderTotals();
        this.filteredGroups = [...this.groups];
        this.loading = false;
      },
      error: _ => {
        this.loading = false;
      }
    });
  }

  private buildGroups(rows: ArInvoiceListItem[]): void {
  const map = new Map<number, ArCustomerGroup>();

  for (const r of rows) {
    if (!map.has(r.customerId)) {
      map.set(r.customerId, {
        customerId: r.customerId,
        customerName: r.customerName,
        invoiceCount: 0,
        totalAmount: 0,
        totalPaid: 0,
        totalCreditNote: 0,
        totalOutstanding: 0,
        invoices: [],
        expanded: false,
        creditNoteNo: undefined,
        creditNoteDate: undefined,
        creditNoteStatus: undefined
      });
    }

    const g = map.get(r.customerId)!;

    g.invoices.push(r);
    g.totalAmount += r.amount || 0;
    g.totalPaid += r.paid || 0;
    g.totalCreditNote = r.customerCreditNoteAmount || g.totalCreditNote;

    if (r.customerCreditNoteAmount && r.customerCreditNoteAmount > 0) {
      g.creditNoteNo = r.customerCreditNoteNo || g.creditNoteNo;
      g.creditNoteDate = r.customerCreditNoteDate || g.creditNoteDate;
      g.creditNoteStatus = r.customerCreditStatus ?? g.creditNoteStatus;
    }
  }

  this.groups = Array.from(map.values()).map(g => {
    g.invoiceCount = g.invoices.length;
    g.totalOutstanding = g.totalAmount - g.totalPaid - g.totalCreditNote;
    return g;
  });
}


  private computeHeaderTotals(): void {
    this.totalInvoiceAmount = 0;
    this.totalPaid = 0;
    this.totalCreditNote = 0;
    this.netOutstanding = 0;

    for (const g of this.groups) {
      this.totalInvoiceAmount += g.totalAmount;
      this.totalPaid += g.totalPaid;
      this.totalCreditNote += g.totalCreditNote;
      this.netOutstanding += g.totalOutstanding;
    }
  }

  onSearchChange(term: string): void {
    this.searchTerm = term || '';
    const t = this.searchTerm.toLowerCase();

    if (!t) {
      this.filteredGroups = [...this.groups];
      return;
    }

    this.filteredGroups = this.groups.filter(g =>
      (g.customerName || '').toLowerCase().includes(t)
    );
  }

  toggleExpand(group: ArCustomerGroup): void {
    group.expanded = !group.expanded;
  }

  getInvoiceStatus(row: ArInvoiceListItem): string {
    if ((row.outstanding || 0) === 0) {
      return 'Paid';
    }
    if ((row.paid || 0) > 0 || (row.creditNote || 0) > 0) {
      return 'Partial';
    }
    return 'Unpaid';
  }

  getStatusClassFromString(status: string): string {
    const s = (status || '').toLowerCase();
    if (s === 'paid') return 'status-pill status-paid';
    if (s === 'partial') return 'status-pill status-partial';
    if (s === 'unpaid') return 'status-pill status-unpaid';
    return 'status-pill';
  }

  printInvoice(row: ArInvoiceListItem): void {
    // TODO: hook to your SI print
    // this.router.navigate(['/sales/sales-invoice-print', row.invoiceId]);
  }
}
