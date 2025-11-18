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
  /**
   * each invoice row:
   * {
   *   id, invoiceNo, invoiceDate, amount,
   *   paidBefore,   // paid before THIS receipt
   * }
   */
  invoices: any[] = [];

  // allocation typed in this screen
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

      // current receipt allocations
      this.allocations = (dto.allocations || []).map(a => ({
        invoiceId: a.invoiceId,
        invoiceNo: a.invoiceNo,
        allocatedAmount: a.allocatedAmount
      }));

      // for the grid we want "amount" and
      // "paid BEFORE this receipt" so it doesn't double count
      this.invoices = (dto.allocations || []).map(a => {
        const allocated = Number(a.allocatedAmount || 0);
        const paidTotal = Number(a.paidAmount || 0); // this INCLUDES this receipt!
        const paidBefore = Math.max(0, paidTotal - allocated);

        return {
          id:          a.invoiceId,
          invoiceNo:   a.invoiceNo,
          invoiceDate: a.invoiceDate,
          amount:      a.amount,
          paidBefore   // custom field for UI calc
        };
      });

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
    // demo only
    this.customerId = 1;
    this.customerName = 'Demo Customer';
    this.loadInvoicesForCustomer();
  }

  loadInvoicesForCustomer(): void {
    if (!this.customerId) return;

    this.receiptService.getOpenInvoices(this.customerId).subscribe(res => {
      // backend returns amount, paidAmount, balance (BEFORE this new receipt)
      const src = res || [];

      this.invoices = src.map((i: any) => ({
        id:          i.id,
        invoiceNo:   i.invoiceNo,
        invoiceDate: i.invoiceDate,
        amount:      i.amount,
        paidBefore:  Number(i.paidAmount || 0)
      }));

      // merge existing allocations if we are editing
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
    } else if (this.paymentMode === 'BANK') {
      // future: fetch from bank reco
    }
  }

  onBankChange(): void {
    if (!this.customerId || !this.selectedBankId) {
      return;
    }
    // TODO: call API for bank amount
  }

  onAmountReceivedChange(): void {
    this.recalculateTotals();
  }

  // ==========================
  // ALLOCATE EVENTS
  // ==========================
  onAllocateChange(index: number): void {
    const inv  = this.invoices[index];
    const alloc = this.allocations[index];
    if (!inv || !alloc) {
      this.recalculateTotals();
      return;
    }

    const basePaid  = Number(inv.paidBefore || 0);     // paid before this receipt
    const maxExtra  = Number(inv.amount || 0) - basePaid;
    let val         = Number(alloc.allocatedAmount || 0);

    if (val < 0) val = 0;
    if (val > maxExtra) val = maxExtra;

    alloc.allocatedAmount = val;
    this.recalculateTotals();
  }

  // row helpers used in HTML
  rowPaid(inv: any, index: number): number {
    const base  = Number(inv.paidBefore || 0);
    const extra = Number(this.allocations[index]?.allocatedAmount || 0);
    return +(base + extra).toFixed(2);
  }

  rowBalance(inv: any, index: number): number {
    const amount = Number(inv.amount || 0);
    const paid   = this.rowPaid(inv, index);
    const bal    = amount - paid;
    return bal < 0 ? 0 : +bal.toFixed(2);
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
    // getters do the work – kept for future logic if needed
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
