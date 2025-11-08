import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

// Services
import { QuotationsService } from '../quotations.service';
import { CustomerMasterService } from 'app/main/businessPartners/customer-master/customer-master.service';
import { CurrencyService } from 'app/main/master/currency/currency.service';
import { ItemsService } from 'app/main/master/items/items.service';
import { UomService } from 'app/main/master/uom/uom.service';

type QuotationRow = {
  id: number;
  number: string;
  status: number;          // 0 Draft, 1 Submitted/Pending, 2 Approved, 3 Rejected, 4 Posted
  customerId: number;
  currencyId: number;
  fxRate: number;
  paymentTermsId: number;
  validityDate: string | Date | null;
  subtotal: number;
  taxAmount: number;
  rounding: number;
  grandTotal: number;
  createdDate?: string | Date | null;
  paymentTermsName:string;
};

type QuotationLineRow = {
  id: number;
  quotationId: number;
  itemId: number;
  uomId: number | null;     // <-- store ID (not name)
  qty: number;
  unitPrice: number;
  discountPct: number;
  taxCodeId?: number | null;
  lineNet: number;
  lineTax: number;
  lineTotal: number;
};

@Component({
  selector: 'app-quotationlist',
  templateUrl: './quotationlist.component.html',
  styleUrls: ['./quotationlist.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class QuotationlistComponent implements OnInit {

  // table
  rows: QuotationRow[] = [];
  allRows: QuotationRow[] = [];
  selectedOption = 10;
  searchValue = '';

  // maps for display
  customerMap = new Map<number, string>(); // id -> name
  currencyMap = new Map<number, string>(); // id -> code (CurrencyName)
  uomMap      = new Map<number, string>(); // id -> UOM name
  itemNameMap = new Map<number, string>(); // id -> Item name

  // Lines modal
  showLinesModal = false;
  activeQt: QuotationRow | null = null;
  modalLines: QuotationLineRow[] = [];
  modalTotals = { net: 0, tax: 0, total: 0 };

  // Drafts modal (optional)
  showDraftsModal = false;
  drafts: QuotationRow[] = [];
  draftCount = 0;

  constructor(
    private router: Router,
    private quotationSvc: QuotationsService,
    private customerSvc: CustomerMasterService,
    private currencySvc: CurrencyService,
    private itemsSvc: ItemsService,
    private uomSvc: UomService
  ) {}

  ngOnInit(): void {
    this.loadLookups();
    this.loadQuotations();
  }

  // ---------- Load support lookups ----------
  loadLookups() {
    // Customers
    this.customerSvc.getAllCustomerMaster().subscribe((res: any) => {
      const arr = res?.data ?? [];
      for (const r of arr) {
        const id = Number(r.id ?? r.Id);
        const name = String(r.customerName ?? r.CustomerName ?? '').trim();
        if (id) this.customerMap.set(id, name);
      }
    });

    // Currencies
    this.currencySvc.getAllCurrency().subscribe((res: any) => {
      const arr = res?.data ?? res ?? [];
      for (const r of arr) {
        const id = Number(r.id ?? r.Id);
        const code = String(r.currencyName ?? r.CurrencyName ?? '').trim();
        if (id) this.currencyMap.set(id, code);
      }
    });

    // Items
    this.itemsSvc.getAllItem().subscribe((res: any) => {
      const arr = res?.data ?? [];
      for (const r of arr) {
        const id = Number(r.id ?? r.itemId ?? 0);
        const name = String(r.itemName ?? r.name ?? '').trim();
        if (id) this.itemNameMap.set(id, name);
      }
    });

    // UOMs
    this.uomSvc.getAllUom().subscribe((res: any) => {
      const arr = res?.data ?? res ?? [];
      for (const r of arr) {
        const id = Number(r.id ?? r.Id);
        const name = String(r.name ?? r.Name ?? '').trim();
        if (id) this.uomMap.set(id, name);
      }
    });
  }

  // ---------- Load quotations ----------
  loadQuotations() {
    this.quotationSvc.getAll().subscribe((res: any) => {
      const data = res?.data ?? res ?? [];
      this.allRows = data.map((q: any) => ({
        id: Number(q.id ?? q.Id),
        number: String(q.number ?? q.Number ?? ''),
        status: Number(q.status ?? q.Status ?? 0),
        customerId: Number(q.customerId ?? q.CustomerId ?? 0),
        currencyId: Number(q.currencyId ?? q.CurrencyId ?? 0),
        fxRate: Number(q.fxRate ?? q.FxRate ?? 1),
        paymentTermsId: Number(q.paymentTermsId ?? q.PaymentTermsId ?? 0),
        paymentTermsName: String(q.paymentTermsName),
        validityDate: q.validityDate ?? q.ValidityDate ?? null,
        subtotal: Number(q.subtotal ?? q.Subtotal ?? 0),
        taxAmount: Number(q.taxAmount ?? q.TaxAmount ?? 0),
        rounding: Number(q.rounding ?? q.Rounding ?? 0),
        grandTotal: Number(q.grandTotal ?? q.GrandTotal ?? 0),
        createdDate: q.createdDate ?? q.CreatedDate ?? null
      }));
      this.rows = [...this.allRows];
      this.computeDraftCount();
    });
  }

  computeDraftCount() {
    this.draftCount = this.allRows.filter(r => +r.status === 0).length;
  }

  // ---------- UI helpers ----------
  statusLabel(v: number) {
    return v === 0 ? 'Draft'
         : v === 1 ? 'Pending'
         : v === 2 ? 'Approved'
         : v === 3 ? 'Rejected'
         : v === 4 ? 'Posted'
         : 'Unknown';
  }

  statusClass(v: number) {
    return {
      'badge-secondary': v === 0,
      'badge-warning' : v === 1,
      'badge-success' : v === 2,
      'badge-danger'  : v === 3 || v === 4
    };
  }

  getCustomerName(id?: number) { return (id && this.customerMap.get(id)) || ''; }
  getCurrencyCode(id?: number) { return (id && this.currencyMap.get(id)) || ''; }
  getItemName(id?: number)     { return (id && this.itemNameMap.get(id)) || ''; }
  getUomName(id?: number | null) { return (id != null ? (this.uomMap.get(id) || '') : ''); }

  // ---------- Paging + Search ----------
  onLimitChange(ev: Event) {
    const val = Number((ev.target as HTMLSelectElement).value);
    this.selectedOption = val || 10;
  }

  filterUpdate(_: any) {
    const q = (this.searchValue || '').trim().toLowerCase();
    if (!q) {
      this.rows = [...this.allRows];
      return;
    }
    this.rows = this.allRows.filter(r => {
      const num = (r.number || '').toLowerCase();
      const cust = (this.getCustomerName(r.customerId) || '').toLowerCase();
      const status = this.statusLabel(r.status).toLowerCase();
      return num.includes(q) || cust.includes(q) || status.includes(q);
    });
  }

 openLinesModal(row: QuotationRow) {
  this.activeQt = row;
  this.showLinesModal = true;

  this.quotationSvc.getById(row.id).subscribe((res: any) => {
    const dto = res?.data ?? res ?? null;      // <-- object, not array
    if (!dto) {
      this.modalLines = [];
      this.modalTotals = { net: 0, tax: 0, total: 0 };
      return;
    }

    const apiLines = dto.lines ?? [];          // <-- take lines array
    this.modalLines = apiLines.map((l: any) => {
      const uomId = (l.uomId ?? l.UomId ?? null);
      const lineNet  = Number(l.lineNet  ?? l.LineNet  ?? 0);
      const lineTax  = Number(l.lineTax  ?? l.LineTax  ?? 0);
      const lineTotal= Number(l.lineTotal?? l.LineTotal?? lineNet + lineTax);

      return {
        id: Number(l.id ?? l.Id ?? 0),
        quotationId: Number(l.quotationId ?? l.QuotationId ?? dto.id ?? row.id),
        itemId: Number(l.itemId ?? l.ItemId ?? 0),
        // keep names too (for direct display)
        itemName: String(l.itemName ?? l.ItemName ?? ''),
        uomId: uomId !== null ? Number(uomId) : null,
        uomName: String(l.uomName ?? l.UomName ?? ''),

        qty: Number(l.qty ?? l.Qty ?? 0),
        unitPrice: Number(l.unitPrice ?? l.UnitPrice ?? 0),
        discountPct: Number(l.discountPct ?? l.DiscountPct ?? 0),
        taxCodeId: l.taxCodeId ?? l.TaxCodeId ?? null,

        lineNet,
        lineTax,
        lineTotal
      } as any; // your QuotationLineRow can be extended with itemName/uomName
    });

    // totals
    let net = 0, tax = 0, total = 0;
    for (const l of this.modalLines) {
      net   += +l.lineNet   || 0;
      tax   += +l.lineTax   || 0;
      total += +l.lineTotal || 0;
    }
    this.modalTotals = { net, tax, total };
  });
}


  closeLinesModal() {
    this.showLinesModal = false;
    this.activeQt = null;
    this.modalLines = [];
    this.modalTotals = { net: 0, tax: 0, total: 0 };
  }

  // ---------- Drafts modal (optional) ----------
  openDrafts() {
    this.drafts = this.allRows.filter(r => +r.status === 0);
    this.showDraftsModal = true;
  }
  closeDrafts() { this.showDraftsModal = false; }
  openDraft(id: number) { this.editQuotation(id); }
  deleteDraft(id: number) { this.deleteQuotation(id); }
  trackById = (_: number, row: { id: number }) => row.id;

  // ---------- Actions ----------
  goToCreate() { this.router.navigate(['/Sales/Quotation-create']); }
  editQuotation(id: number) { debugger 
    this.router.navigate([`/Sales/Edit-quotation/${id}`]); }

  deleteQuotation(id: number) {
    Swal.fire({
      icon: 'warning',
      title: 'Delete quotation?',
      text: 'This action cannot be undone.',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#9ca3af',
      confirmButtonText: 'Delete'
    }).then(result => {
      if (!result.isConfirmed) return;
      this.quotationSvc.delete(id).subscribe({
        next: () => {
          this.allRows = this.allRows.filter(r => r.id !== id);
          this.filterUpdate(null);
          this.computeDraftCount();
        //  Swal.fire({ icon: 'success', title: 'Deleted', timer: 900, showConfirmButton: false });
          Swal.fire('Deleted!', 'Quotation has been deleted.', 'success');
        },
        error: () => {
          Swal.fire({ icon: 'error', title: 'Failed to delete' });
        }
      });
    });
  }
}
