import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ChartofaccountService } from '../../chartofaccount/chartofaccount.service';
import { CustomerMasterService } from 'app/main/businessPartners/customer-master/customer-master.service';
import { SupplierService } from 'app/main/businessPartners/supplier/supplier.service';
import { JournalService } from '../journalservice/journal.service';
import Swal from 'sweetalert2';
import { ItemsService } from 'app/main/master/items/items.service';

@Component({
  selector: 'app-create-journal',
  templateUrl: './create-journal.component.html',
  styleUrls: ['./create-journal.component.scss']
})
export class CreateJournalComponent implements OnInit {

  // Top fields
  showAccount = false; 
  selectedType: string | null = null;
  journalDate: string | null = null;
  description: string = '';

  selectedAccountId: number | null = null;
  selectedCustomerId?: number;
  selectedSupplierId?: number;

  debitAmount: number = 0;
  creditAmount: number = 0;

  AccountList: any[] = [];
  CustomerList: any[] = [];
  SupplierList: any[] = [];

  // ITEM
  ItemList: any[] = [];
  selectedItem: any | null = null;   // full item object

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
  parentHeadList: any;
  budgetLineId: number | null = null;
  submitted = false;

  constructor(
    private router: Router,
    private _chart: ChartofaccountService,
    private _customer: CustomerMasterService,
    private _supplier: SupplierService,
    private _journal: JournalService,
    private _item: ItemsService,
  ) {}

  ngOnInit(): void {
    // Account depends on item selection
    this.loadCustomer();
    this.loadSuppliers();
    this.loadItem();
    this.loadAccountHeads()
  }

  // ---------------- LOADERS ----------------

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

  loadItem() {
    this._item.getAllItem().subscribe((res: any) => {
      this.ItemList = res.data || [];
    });
  }

  // Load account(s) based on budgetLineId (coming from item)
  loadAccount(budgetLineId?: number) {
    if (!budgetLineId) {
      this.AccountList = [];
      this.selectedAccountId = null;
      return;
    }

    // Your API returns a single ChartOfAccount object for this id
    this._chart.getByIdChartOfAccount(budgetLineId).subscribe((res: any) => {
      const acc = res.data;              // single object from API

      // ng-select expects array
      this.AccountList = acc ? [acc] : [];

      if (acc) {
        this.selectedAccountId = acc.id;

        if (!this.description && acc.headName) {
          this.description = acc.headName;
        }
      } else {
        this.selectedAccountId = null;
      }
    });
  }

  // ---------------- CHANGE HANDLERS ----------------

  // because bindValue="id", change event gives only the id
  onAccountChange(accId: any) {
    this.selectedAccountId = accId;

    const acc = this.AccountList.find(a => a.id === accId);
    if (acc && acc.headName) {
      this.description = acc.headName;
    }
  }

  // Item -> budgetLineId -> loadAccount
  onItemChange(selected: any) {
    this.selectedItem = selected;

    if (!selected) {
      this.AccountList = [];
      this.selectedAccountId = null;
      return;
    }

    const budgetLineId = selected.budgetLineId;  // from your Item API
    this.loadAccount(budgetLineId);
  }

  // ---------------- SUBMIT / CANCEL ----------------

onSubmit() {
  if (!this.selectedAccountId || !this.journalDate) {
    Swal.fire('Required', 'Account and Journal Date are required.', 'warning');
    return;
  }

  if (this.debitAmount <= 0 && this.creditAmount <= 0) {
    Swal.fire('Invalid Amount', 'Enter debit or credit amount.', 'warning');
    return;
  }

  const startDate = this.isRecurring
    ? (this.recurringStartDate || this.journalDate)
    : null;

  // 🔹 Plain DTO – this MUST match ManualJournalCreateDto in C#
  const dto = {
    accountId: this.selectedAccountId,
    journalDate: this.journalDate,
    type: this.selectedType,
    customerId: this.selectedType === 'Customer' ? this.selectedCustomerId : null,
    supplierId: this.selectedType === 'Supplier' ? this.selectedSupplierId : null,
    description: this.description,
    debit: this.debitAmount,
    credit: this.creditAmount,
    budgetLineId: this.budgetLineId,

    // Recurring
    isRecurring: this.isRecurring,
    recurringFrequency: this.recurringFrequency,
    recurringInterval: this.recurringInterval,
    recurringStartDate: startDate,
    recurringEndType: this.isRecurring ? this.recurringEndType : null,
    recurringEndDate: this.recurringEndType === 'EndByDate' ? this.recurringEndDate : null,
    recurringCount: this.recurringEndType === 'EndByCount' ? this.recurringCount : null,

    // Timezone – match backend default
    timezone: 'Asia/Kolkata',

    // createdBy – backend also sets 1, but no problem if send
    createdBy: 1,

    // optional
    itemId: this.selectedItem ? this.selectedItem.id : null
  };

  // 🔴 IMPORTANT: send plain dto, NOT { dto: dto }
  const payload = dto;

  this.isSaving = true;
  console.log('Journal payload =', payload);

  this._journal.create(payload).subscribe({
    next: () => {
      this.isSaving = false;
      Swal.fire('Success', 'Journal saved successfully', 'success')
        .then(() => this.router.navigate(['financial/journal']));
    },
    error: (err) => {
      this.isSaving = false;
      console.error('Journal create error', err);

      // If server sends { success: false, message: "..." }
      if (err.error && err.error.message) {
        Swal.fire('Error', err.error.message, 'error');
      } else {
        Swal.fire('Error', 'Error saving journal', 'error');
      }
    }
  });
}


  onCancel() {
    this.router.navigate(['financial/journal']);
  }
  loadAccountHeads(): void {
    this._chart.getAllChartOfAccount().subscribe((res: any) => {
      const data = (res?.data || []).filter((x: any) => x.isActive === true);
      this.parentHeadList = data.map((head: any) => ({
        value: Number(head.id),
        label: this.buildFullPath(head, data)
      }));
    });
  }

  /** Build breadcrumb like: Parent >> Child >> This */
  private buildFullPath(item: any, all: any[]): string {
    let path = item.headName;
    let current = all.find((x: any) => x.headCode === item.parentHead);
    while (current) {
      path = `${current.headName} >> ${path}`;
      current = all.find((x: any) => x.headCode === current.parentHead);
    }
    return path;
  }
}
