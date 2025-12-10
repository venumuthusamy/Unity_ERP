// src/app/main/financial/accounts-payable/ap-advance-create/ap-advance-create.component.ts

import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

import { AccountsPayableService } from '../accounts-payable.service';
import { SupplierService } from 'app/main/businessPartners/supplier/supplier.service';

interface SimpleSupplier {
  id: number;
  name: string;
}

@Component({
  selector: 'app-ap-advance',
  templateUrl: './ap-advance.component.html',
  styleUrls: ['./ap-advance.component.scss']
})
export class ApAdvanceComponent implements OnInit {

  // ===== form fields =====
  supplierId: number | null = null;
  supplierName: string | null = null;

  advanceDate: string;
  amount: number = 0;
  referenceNo: string = '';
  notes: string = '';

  methodId: number = 2; // 1=Cash,2=Bank,3=Cheque,4=Other
  bankHeadId: number | null = null;

  // ===== lookups =====
  suppliers: SimpleSupplier[] = [];
  bankAccounts: any[] = [];

  // bank balance preview
  bankAvailableBalance: number | null = null;
  bankBalanceAfterAdvance: number | null = null;
  bankName: string | null = null;

  saving = false;

  constructor(
    private apSvc: AccountsPayableService,
    private supplierSvc: SupplierService,
    private router: Router
  ) {
    const today = new Date();
    this.advanceDate = today.toISOString().substring(0, 10);
  }

  ngOnInit(): void {
    this.loadSuppliers();
    this.loadBankAccounts();
  }

  // =================== lookups ===================
  loadSuppliers(): void {
    this.supplierSvc.GetAllSupplier().subscribe({
      next: (res: any) => {
        const raw = res?.data || res || [];
        this.suppliers = (raw || []).map((s: any) => ({
          id: s.id || s.Id,
          name: s.name || s.supplierName || s.SupplierName
        }));
      },
      error: () => {
        Swal.fire('Error', 'Failed to load suppliers', 'error');
      }
    });
  }

  loadBankAccounts(): void {
    this.apSvc.getBankAccounts().subscribe({
      next: (res: any) => {
        this.bankAccounts = res?.data || res || [];
      },
      error: () => {
        // non-blocking
        this.bankAccounts = [];
      }
    });
  }

  // =================== UI helpers ===================
  getMethodName(id: number): string {
    switch (id) {
      case 1: return 'Cash';
      case 2: return 'Bank Transfer';
      case 3: return 'Cheque';
      case 4: return 'Other';
      default: return 'Other';
    }
  }

  onSupplierChange(): void {
    const sup = this.suppliers.find(s => s.id === this.supplierId!);
    this.supplierName = sup?.name || null;
  }

  onDateChange(): void {
    // if you want, you can validate period lock from AP service here
  }

  onAmountChange(): void {
    this.recalcBankBalanceAfterAdvance();
  }

  onMethodChange(): void {
    if (this.methodId === 2 || this.methodId === 3) {
      this.onBankChange();
    } else {
      this.bankHeadId = null;
      this.bankAvailableBalance = null;
      this.bankBalanceAfterAdvance = null;
      this.bankName = null;
    }
  }

  onBankChange(): void {
    const bank = this.bankAccounts.find(x => x.id === this.bankHeadId);
    this.bankAvailableBalance = bank?.availableBalance || bank?.AvailableBalance || null;
    this.bankName = bank?.headName || bank?.HeadName || null;
    this.recalcBankBalanceAfterAdvance();
  }

  recalcBankBalanceAfterAdvance(): void {
    if (this.bankAvailableBalance == null) {
      this.bankBalanceAfterAdvance = null;
      return;
    }
    const amt = Number(this.amount || 0);
    this.bankBalanceAfterAdvance = this.bankAvailableBalance - amt;
  }

  // =================== validation ===================
  canSave(): boolean {
    if (!this.supplierId) return false;
    if (!this.advanceDate) return false;
    if (!this.amount || this.amount <= 0) return false;

    if ((this.methodId === 2 || this.methodId === 3) && !this.bankHeadId) {
      return false;
    }
    return true;
  }

  // =================== actions ===================
  saveAdvance(): void {
    if (!this.canSave()) {
      Swal.fire('Warning', 'Fill mandatory fields before saving', 'warning');
      return;
    }

    this.saving = true;

    const payload: any = {
      supplierId: this.supplierId,
      advanceDate: this.advanceDate,
      amount: this.amount,
      referenceNo: this.referenceNo || null,
      notes: this.notes || null,
      methodId: this.methodId,
      bankHeadId: this.bankHeadId
    };

    this.apSvc.createSupplierAdvance(payload).subscribe({
      next: (res: any) => {
        this.saving = false;

        if (res?.isSuccess === false) {
          Swal.fire('Error', res.message || 'Failed to save advance', 'error');
          return;
        }

        Swal.fire('Success', 'Supplier advance created', 'success').then(() => {
          this.goBack();
        });
      },
      error: err => {
        this.saving = false;
        const msg = err?.error?.message || err?.message || 'Failed to save advance';
        Swal.fire('Error', msg, 'error');
      }
    });
  }

  goBack(): void {
    // Adjust this route to where you want to go after save/back
    this.router.navigate(['/financial/AccountPayable']);
  }
}
