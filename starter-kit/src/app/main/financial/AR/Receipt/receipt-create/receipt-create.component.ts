import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';

import { ReceiptService, ReceiptDetailDto } from '../receipt-service';
import { CustomerMasterService } from 'app/main/businessPartners/customer-master/customer-master.service';

@Component({
  selector: 'app-receipt-create',
  templateUrl: './receipt-create.component.html',
  styleUrls: ['./receipt-create.component.scss']
})
export class ReceiptCreateComponent implements OnInit {

  // ------- edit state -------
  isEdit = false;
  receiptId: number | null = null;
  receiptNo: string | null = null;

  // ------- header -------
  customerId: number | null = null;
  customerName = '';
  receiptDate: string;

  paymentMode: 'CASH' | 'BANK' = 'CASH';
  banks: { id: number; name: string }[] = [];
  selectedBankId: number | null = null;

  amountReceived: number = 0;

  // ------- grid -------
  invoices: any[] = [];
  allocations: { invoiceId: number; invoiceNo: string; allocatedAmount: number }[] = [];

  isSaving = false;
  customerList: any[] = [];

  constructor(
    private receiptService: ReceiptService,
    private location: Location,
    private router: Router,
    private route: ActivatedRoute,
    private _customerMasterService: CustomerMasterService,
  ) {
    const today = new Date();
    this.receiptDate = today.toISOString().substring(0, 10);
  }

  ngOnInit(): void {
    // temp static banks
    this.banks = [
      { id: 1, name: 'HDFC Bank A/C' },
      { id: 2, name: 'SBI Current A/C' },
      { id: 3, name: 'ICICI Bank A/C' }
    ];

    this._customerMasterService.GetAllCustomerDetails().subscribe((res: any) => {
      this.customerList = res.data || [];
    });

    // check route param for edit
    this.route.paramMap.subscribe(pm => {
      const idStr = pm.get('id');
      if (idStr) {
        this.isEdit = true;
        this.receiptId = +idStr;
        this.loadReceiptForEdit(this.receiptId);
      }
    });
  }

  // ==========================
  // LOAD EXISTING RECEIPT
  // ==========================
  private loadReceiptForEdit(id: number): void {
  this.receiptService.getReceiptById(id).subscribe((dto: ReceiptDetailDto) => {
    if (!dto) { return; }

    this.receiptId      = dto.id;
    this.receiptNo      = dto.receiptNo;
    this.customerId     = dto.customerId;
    this.customerName   = dto.customerName;
    this.receiptDate    = dto.receiptDate.toString().substring(0, 10);
    this.paymentMode    = dto.paymentMode === 'BANK' ? 'BANK' : 'CASH';
    this.selectedBankId = dto.bankId ?? null;
    this.amountReceived = dto.amountReceived;

    // allocations (for saving)
    this.allocations = (dto.allocations || []).map(a => ({
      invoiceId: a.invoiceId,
      invoiceNo: a.invoiceNo,
      allocatedAmount: a.allocatedAmount
    }));

    // rows for the grid (to show amount/paid/balance)
    this.invoices = (dto.allocations || []).map(a => ({
      id:         a.invoiceId,
      invoiceNo:  a.invoiceNo,
      invoiceDate: a.invoiceDate,
      amount:     a.amount,
      paidAmount: a.paidAmount,
      balance:    a.balance
    }));

    this.recalculateTotals();
  });
}


  // ==========================
  // CUSTOMER
  // ==========================
  onCustomerChange(event: any): void {
    this.customerId = event.customerId;
    const selected = this.customerList.find(c => c.id === this.customerId);
    this.customerName = selected ? selected.customerName : '';
    this.loadInvoicesForCustomer();
  }

  openCustomerLookup(): void {
    // replace with real lookup; now just demo
    this.customerId = 1;
    this.customerName = 'Demo Customer';
    this.loadInvoicesForCustomer();
  }

  loadInvoicesForCustomer(): void {
    if (!this.customerId) return;

    this.receiptService.getOpenInvoices(this.customerId).subscribe(res => {
      this.invoices = res || [];

      // merge existing allocations if edit mode
      const existing = new Map<number, number>();
      this.allocations.forEach(a => existing.set(a.invoiceId, a.allocatedAmount));

      this.allocations = this.invoices.map((i: any) => ({
        invoiceId: i.id,
        invoiceNo: i.invoiceNo,
        allocatedAmount: existing.get(i.id) || 0
      }));

      this.recalculateTotals();
    });
  }

  // ==========================
  // HEADER EVENTS
  // ==========================
  onPaymentModeChange(): void {
    if (this.paymentMode === 'CASH') {
      this.selectedBankId = null;
      // user types amount manually
    } else if (this.paymentMode === 'BANK') {
      // in future: fetch amount from bank reconciliation
      // this.onBankChange();
    }
  }

  onBankChange(): void {
    if (!this.customerId || !this.selectedBankId) {
      return;
    }

    // TODO: call API to get bank amount for this receipt
    // this.receiptService.getBankReceiptAmount(this.customerId, this.selectedBankId)
    //   .subscribe(amount => {
    //     this.amountReceived = amount || 0;
    //     this.recalculateTotals();
    //   });
  }

  onAmountReceivedChange(): void {
    this.recalculateTotals();
  }

  // ==========================
  // TOTALS
  // ==========================
  get totalAllocated(): number {
    return this.allocations.reduce((s, a) => s + (a.allocatedAmount || 0), 0);
  }

  get unallocatedAmount(): number {
    return (this.amountReceived || 0) - this.totalAllocated;
  }

  recalculateTotals(): void {
    // you can auto-limit allocations to amountReceived here if needed
  }

  // ==========================
  // SAVE
  // ==========================
  canSave(): boolean {
    return !!this.customerId &&
           this.totalAllocated > 0 &&
           this.amountReceived >= this.totalAllocated &&
           !this.isSaving;
  }

  save(): void {
    if (!this.canSave()) return;

    const payload: any = {
      id: this.isEdit ? this.receiptId : null,
      customerId: this.customerId!,
      receiptDate: this.receiptDate,
      paymentMode: this.paymentMode,
      bankId: this.paymentMode === 'BANK' ? this.selectedBankId : null,
      amountReceived: this.amountReceived,
      allocations: this.allocations.filter(a => a.allocatedAmount > 0)
    };

    this.isSaving = true;

    const obs = this.isEdit && this.receiptId
      ? this.receiptService.updateReceipt(this.receiptId, payload)
      : this.receiptService.insertReceipt(payload);

    obs.subscribe({
      next: () => {
        this.isSaving = false;
        this.router.navigate(['/financial/AR'], { queryParams: { tab: 'receipts' } });
      },
      error: () => {
        this.isSaving = false;
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/financial/AR'], { queryParams: { tab: 'receipts' } });
  }
}
