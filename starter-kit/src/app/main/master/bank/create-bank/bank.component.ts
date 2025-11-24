import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CurrencyService } from '../../currency/currency.service';
import { CountriesService } from '../../countries/countries.service';
import { BankService } from '../bank-service/bank.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-bank',
  templateUrl: './bank.component.html',
  styleUrls: ['./bank.component.scss']
})
export class BankComponent implements OnInit {

  bank: any = {
    bankName: '',
    accountName: '',
    accountNumber: '',
    accountTypeId: null,
    branch: '',
    ifscSwift: '',
    routingNumber: '',
    currencyId: null,
    countryId: null,
    primaryContact: '',
    contactEmail: '',
    contactPhone: '',
    address: ''
  };

  accountTypes: any[] = [
    { id: 1, name: 'Checking' },
    { id: 2, name: 'Savings' },
    { id: 3, name: 'Current' },
    { id: 4, name: 'Other' }
  ];

  currencies: any[] = [];
  countries: any[] = [];

  isSaving = false;
  isEdit = false;
  bankId: number | null = null;

  constructor(
    private _currencyService: CurrencyService,
    private _countryService: CountriesService,
    private _bankService: BankService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  // ------------------------------------
  // INIT
  // ------------------------------------
  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');

    if (idParam) {
      this.bankId = Number(idParam);
      this.isEdit = true;
    }

    this.loadCurrency();
    this.loadCountry();

    if (this.isEdit && this.bankId) {
      this.loadBankById(this.bankId);
    }
  }

  // ------------------------------------
  // LOAD MASTERS
  // ------------------------------------
  loadCurrency(): void {
    this._currencyService.getAllCurrency().subscribe((res: any) => {
      this.currencies = res?.data || [];
    });
  }

  loadCountry(): void {
    this._countryService.getCountry().subscribe((res: any) => {
      this.countries = res?.data || [];
    });
  }

  // ------------------------------------
  // LOAD BANK FOR EDIT
  // ------------------------------------
  loadBankById(id: number): void {
    this._bankService.getByIdBank(id).subscribe((res: any) => {
      const d = res?.data;
      if (!d) return;

      this.bankId = d.id;

      this.bank = {
        bankName: d.bankName || '',
        accountName: d.accountHolderName || '',
        accountNumber: d.accountNo || '',
        accountTypeId: d.accountType || null,
        branch: d.branch || '',
        ifscSwift: d.ifsc || '',
        routingNumber: d.routing || '',
        currencyId: d.currencyId || null,
        countryId: d.countryId || null,
        primaryContact: d.primaryContact || '',
        contactEmail: d.email || '',
        contactPhone: d.contactNo || '',
        address: d.address || ''
      };
    });
  }

  // ------------------------------------
  // RESET FORM
  // ------------------------------------
  onReset(): void {
    this.bank = {
      bankName: '',
      accountName: '',
      accountNumber: '',
      accountTypeId: null,
      branch: '',
      ifscSwift: '',
      routingNumber: '',
      currencyId: null,
      countryId: null,
      primaryContact: '',
      contactEmail: '',
      contactPhone: '',
      address: ''
    };

    if (this.isEdit && this.bankId) {
      this.loadBankById(this.bankId);
    }
  }

  // ------------------------------------
  // SAVE / UPDATE BANK
  // ------------------------------------
onSave(): void {
  // basic required check
  if (!this.bank.bankName ||
      !this.bank.accountName ||
      !this.bank.accountNumber ||
      !this.bank.accountTypeId ||
      !this.bank.currencyId ||
      !this.bank.countryId ||
      !this.bank.contactEmail) {

    Swal.fire('Warning', 'Please fill all required fields', 'warning');
    return;
  }

  // base payload
  const payload: any = {
    bankName: this.bank.bankName,
    accountHolderName: this.bank.accountName,
    accountNo: this.bank.accountNumber,

    accountType: this.bank.accountTypeId,
    branch: this.bank.branch,
    ifsc: this.bank.ifscSwift,
    routing: this.bank.routingNumber,

    currencyId: this.bank.currencyId,
    countryId: this.bank.countryId,

    primaryContact: this.bank.primaryContact,
    email: this.bank.contactEmail,
    contactNo: this.bank.contactPhone,
    address: this.bank.address,
    isActive: true
  };

  this.isSaving = true;

  if (this.isEdit && this.bankId) {
    // 👉 IMPORTANT: send id in edit mode
    payload.id = this.bankId;

    this._bankService.updateBank(this.bankId, payload).subscribe({
      next: (res: any) => {
        this.isSaving = false;
        Swal.fire('Success', res?.message || 'Bank updated successfully', 'success');
        this.router.navigate(['/master/bank-list']);
      },
      error: (err) => {
        this.isSaving = false;
        console.error('Error updating bank', err);
        Swal.fire('Error', 'Error updating bank', 'error');
      }
    });
  } else {
    this._bankService.createBank(payload).subscribe({
      next: (res: any) => {
        this.isSaving = false;
        Swal.fire('Success', res?.message || 'Bank created successfully', 'success');
        this.onReset();
        this.router.navigate(['/master/bank-list']);
      },
      error: (err) => {
        this.isSaving = false;
        console.error('Error creating bank', err);
        Swal.fire('Error', 'Error creating bank', 'error');
      }
    });
  }
}


}
