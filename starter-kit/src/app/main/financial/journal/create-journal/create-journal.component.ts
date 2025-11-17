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
  selectedType: string | null = null; // 'Customer' or 'Supplier'
  journalDate: string | null = null;
  reference: string = '';
  description: string = '';

  journalTypes = [
    { value: 'Customer' },
    { value: 'Supplier' }
  ];

  selectedCustomerId?: number;
  selectedSupplierId?: number;
  selectedAccountId?: number;
  debitAmount: number = 0;
  creditAmount: number = 0;
  AccountList: any[] = [];
  CustomerList: any[] = [];
  SupplierList: any[] = [];

  // Recurring fields
  isRecurring: boolean = false;
  recurringFrequency: 'Daily' | 'Weekly' | 'Monthly' | 'Yearly' | null = null;
  recurringInterval: number = 1;
  recurringStartDate: string | null = null;
  recurringEndType: 'NoEnd' | 'EndByDate' | 'EndByCount' = 'NoEnd';
  recurringEndDate: string | null = null;
  recurringCount?: number;

  isSaving = false;

  constructor(
    private router: Router,
    private _chartofAccountService: ChartofaccountService,
    private _customerService: CustomerMasterService,
    private _suppliersService: SupplierService,
    private _journalService: JournalService
  ) { }

  ngOnInit(): void {
    this.loadAccount();
    this.loadCustomer();
    this.loadSuppliers();
  }

  onAccountChange(account: any): void {
    if (account) {
      this.selectedAccountId = account.id;
      this.description = account.headName || account.accountName || '';
    } else {
      this.selectedAccountId = undefined;
      this.description = '';
    }
  }

onSubmit(): void {
  if (!this.selectedAccountId || !this.journalDate) {
    Swal.fire('Required Fields', 'Account and Journal Date are required.', 'warning');
    return;
  }

  if (this.debitAmount <= 0 && this.creditAmount <= 0) {
    Swal.fire('Invalid Amount', 'Enter debit or credit amount.', 'warning');
    return;
  }

  const startDate = this.recurringStartDate || this.journalDate;

  const payload: any = {
    accountId: this.selectedAccountId,
    journalDate: this.journalDate,
    type: this.selectedType,
    customerId: this.selectedType === 'Customer' ? this.selectedCustomerId : null,
    supplierId: this.selectedType === 'Supplier' ? this.selectedSupplierId : null,
    description: this.description,
    debit: this.debitAmount,
    credit: this.creditAmount,

    isRecurring: this.isRecurring,
    recurringFrequency: this.isRecurring ? this.recurringFrequency : null,
    recurringInterval: this.isRecurring ? this.recurringInterval : null,
    recurringStartDate: this.isRecurring ? startDate : null,
    recurringEndType: this.isRecurring ? this.recurringEndType : null,
    recurringEndDate:
      this.isRecurring && this.recurringEndType === 'EndByDate'
        ? this.recurringEndDate
        : null,
    recurringCount:
      this.isRecurring && this.recurringEndType === 'EndByCount'
        ? this.recurringCount
        : null,

    createdBy: 1 // TODO: replace with logged-in user id
  };

  this.isSaving = true;

  this._journalService.create(payload).subscribe({
    next: (res: any) => {
      this.isSaving = false;
      if (res?.success) {
        const jn = res.data?.journalNo || '';

        Swal.fire({
          title: 'Success!',
          text: jn ? `Journal ${jn} saved successfully` : 'Journal saved successfully',
          icon: 'success'
        }).then(() => {
          this.router.navigate(['financial/journal']);
        });

      } else {
        Swal.fire('Failed', res?.message || 'Failed to save journal', 'error');
      }
    },
    error: err => {
      this.isSaving = false;
      console.error(err);
      Swal.fire('Error', 'Error saving journal', 'error');
    }
  });
}


  onCancel(): void {
    this.router.navigate(['financial/journal']);
  }

  loadSuppliers(): void {
    this._suppliersService.GetAllSupplier().subscribe((res: any) => {
      this.SupplierList = res.data || [];
    });
  }

  loadCustomer(): void {
    this._customerService.getAllCustomerMaster().subscribe((res: any) => {
      this.CustomerList = res.data || [];
    });
  }

  loadAccount(): void {
    this._chartofAccountService.getAllChartOfAccount().subscribe((res: any) => {
      this.AccountList = res.data || [];
    });
  }
}
