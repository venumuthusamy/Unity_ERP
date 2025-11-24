import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ChartofaccountService } from '../../chartofaccount/chartofaccount.service';
import { CustomerMasterService } from 'app/main/businessPartners/customer-master/customer-master.service';
import { SupplierService } from 'app/main/businessPartners/supplier/supplier.service';
import { JournalService } from '../journalservice/journal.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-create-journal',
  templateUrl: './create-journal.component.html',
  styleUrls: ['./create-journal.component.scss']
})
export class CreateJournalComponent implements OnInit {

  selectedType: string | null = null;
  journalDate: string | null = null;
  description: string = '';
  selectedAccountId?: number;
  debitAmount: number = 0;
  creditAmount: number = 0;

  AccountList: any[] = [];
  CustomerList: any[] = [];
  SupplierList: any[] = [];

  selectedCustomerId?: number;
  selectedSupplierId?: number;

  journalTypes = [
    { value: 'Customer' },
    { value: 'Supplier' }
  ];

  // Recurring fields
  isRecurring: boolean = false;
  recurringFrequency: string | null = null;
  recurringInterval: number = 1;
  recurringStartDate: string | null = null;
  recurringEndType: 'NoEnd' | 'EndByDate' | 'EndByCount' = 'NoEnd';
  recurringEndDate: string | null = null;
  recurringCount?: number;

  timezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone;

  isSaving = false;

  constructor(
    private router: Router,
    private _chart: ChartofaccountService,
    private _customer: CustomerMasterService,
    private _supplier: SupplierService,
    private _journal: JournalService
  ) {}

  ngOnInit(): void {
    this.loadAccount();
    this.loadCustomer();
    this.loadSuppliers();
  }

  loadAccount() {
    this._chart.getAllChartOfAccount().subscribe((res: any) => {
      this.AccountList = res.data || [];
    });
  }

  loadCustomer() {
    this._customer.getAllCustomerMaster().subscribe((res: any) => {
      this.CustomerList = res.data || [];
    });
  }

  loadSuppliers() {
    this._supplier.GetAllSupplier().subscribe((res: any) => {
      this.SupplierList = res.data || [];
    });
  }

  onAccountChange(acc: any) {
    this.selectedAccountId = acc?.id;
    this.description = acc?.headName || '';
  }

  onSubmit() {
    if (!this.selectedAccountId || !this.journalDate) {
      Swal.fire('Required', 'Account and Journal Date are required.', 'warning');
      return;
    }

    if (this.debitAmount <= 0 && this.creditAmount <= 0) {
      Swal.fire('Invalid Amount', 'Enter debit or credit amount.', 'warning');
      return;
    }

    // If recurring, start date is either recurringStartDate or journalDate.
    const startDate = this.isRecurring
      ? (this.recurringStartDate || this.journalDate)
      : null;

    const payload = {
      accountId: this.selectedAccountId,
      journalDate: this.journalDate,
      type: this.selectedType,
      customerId: this.selectedType === 'Customer' ? this.selectedCustomerId : null,
      supplierId: this.selectedType === 'Supplier' ? this.selectedSupplierId : null,
      description: this.description,
      debit: this.debitAmount,
      credit: this.creditAmount,

      // Recurring
      isRecurring: this.isRecurring,
      recurringFrequency: this.recurringFrequency,
      recurringInterval: this.recurringInterval,
      recurringStartDate: startDate,
      recurringEndType: this.isRecurring ? this.recurringEndType : null,
      recurringEndDate: this.recurringEndType === 'EndByDate' ? this.recurringEndDate : null,
      recurringCount: this.recurringEndType === 'EndByCount' ? this.recurringCount : null,

      timezone: this.timezone,   // 🔥 AUTO DETECTED BROWSER TIMEZONE
      createdBy: 1
    };

    this.isSaving = true;

    this._journal.create(payload).subscribe({
      next: () => {
        this.isSaving = false;
        Swal.fire('Success', 'Journal saved successfully', 'success')
          .then(() => this.router.navigate(['financial/journal']));
      },
      error: () => {
        this.isSaving = false;
        Swal.fire('Error', 'Error saving journal', 'error');
      }
    });
  }

  onCancel() {
    this.router.navigate(['financial/journal']);
  }
}
