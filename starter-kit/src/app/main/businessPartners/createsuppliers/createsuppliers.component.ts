import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { CurrencyService } from 'app/main/master/currency/currency.service';
import { IncotermsService } from 'app/main/master/incoterms/incoterms.service';
import { ItemsService } from 'app/main/master/items/items.service';
import { PaymentTermsService } from 'app/main/master/payment-terms/payment-terms.service';
import { SupplierService } from '../supplier/supplier.service';

/* =========================
   Types
========================= */
type Term = { id: number; paymentTermsName: string; isActive?: boolean };
type Currency = { id: number; currencyName: string; currencyCode?: string; isActive?: boolean };
type Incoterm = { id: number; incotermsName: string; code?: string; name?: string; isActive?: boolean };
type Item = { id: number; itemName: string; isActive?: boolean };
type StatusOption = { id: number; name: 'Active' | 'Inactive' | 'On Hold' };

interface SupplierModel {
  id?: number;
  name: string;
  code?: string;
  statusId: number;
  leadTime: number | null;
  termsId: number | null;
  currencyId: number | null;
  taxReg: string;
  incotermsId: number | null;
  contact: string;
  email: string;
  phone: string;
  address: string;
  bank: {
    name: string;
    acc: string;
    swift: string;
    branch: string;
  };
}

/** We keep both base64 (for API) and dataUrl (for preview) — NO blob: */
interface ComplianceFile {
  name: string;        // display name
  base64: string;      // pure base64 ONLY (what we send as fileUrl)
  mimeType: string;    // e.g., image/png
  size: number;        // bytes
  dataUrl: string;     // "data:<mime>;base64,<...>" for preview
}

interface ComplianceDoc {
  name: string;
  number: string | null;
  expiry: string | null; // yyyy-mm-dd for <input type="date">
  files: ComplianceFile[];
}

@Component({
  selector: 'app-createsuppliers',
  templateUrl: './createsuppliers.component.html',
  styleUrls: ['./createsuppliers.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class CreatesuppliersComponent implements OnInit {

  /* =========================
     Master lists / selections
  ========================= */
  PaymentTermsList: Term[] = [];
  filteredTerms: Term[] = [];
  selectedTerm: Term | null = null;

  CurrencyList: Currency[] = [];
  filteredCurrencies: Currency[] = [];
  selectedCurrency: Currency | null = null;

  incotermsList: Incoterm[] = [];
  filteredIncoterms: Incoterm[] = [];
  selectedIncoterm: Incoterm | null = null;

  rows: Item[] = [];
  filteredItems: Item[] = [];
  preferredItems: Item[] = [];

  /* =========================
     UI helpers
  ========================= */
  hover = false;
  preferredText = '';

  termsDropdownOpen = false;
  termsSearch = '';

  currencyDropdownOpen = false;
  currencySearch = '';

  incotermDropdownOpen = false;
  incotermSearch = '';

  statuses: StatusOption[] = [
    { id: 1, name: 'Active' },
    { id: 2, name: 'Inactive' },
    { id: 3, name: 'On Hold' }
  ];
  filteredStatus: StatusOption[] = [...this.statuses];
  statusSearch = '';
  statusDropdownOpen = false;
  selectedStatus: StatusOption | null = null;

  /* =========================
     Supplier model
  ========================= */
  supplier: SupplierModel = {
    name: '',
    code: '',
    statusId: 1,
    leadTime: null,
    termsId: null,
    currencyId: null,
    taxReg: '',
    incotermsId: null,
    contact: '',
    email: '',
    phone: '',
    address: '',
    bank: { name: '', acc: '', swift: '', branch: '' }
  };

  /* =========================
     Compliance docs (multiple rows, multiple files per row)
  ========================= */
  docs: ComplianceDoc[] = [
    { name: '', number: '', expiry: null, files: [] }
  ];

  constructor(
    private route: ActivatedRoute,
    private paymentTermsService: PaymentTermsService,
    private _SupplierService: SupplierService,
    private CurrencyService: CurrencyService,
    private incotermsService: IncotermsService,
    private itemsService: ItemsService
  ) {}

  /* =========================
     Lifecycle
  ========================= */
  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? +idParam : null;

    this.loadMasterData()
      .pipe(switchMap(() => id ? this.loadSupplierById(id) : of(null)))
      .subscribe({
        next: () => {
          if (!id) {
            const s = this.statuses.find(x => x.id === this.supplier.statusId) ?? this.statuses[0];
            this.selectedStatus = s;
            this.statusSearch = s.name;
          }
        },
        error: (err) => console.error('Init failed', err)
      });
  }

  /* =========================
     Master Data Loader
  ========================= */
  private loadMasterData() {
    return forkJoin({
      terms: this.paymentTermsService.getAllPaymentTerms(),
      currencies: this.CurrencyService.getAllCurrency(),
      incoterms: this.incotermsService.getAllIncoterms(),
      items: this.itemsService.getAllItem()
    }).pipe(
      switchMap(({ terms, currencies, incoterms, items }) => {
        this.PaymentTermsList = (terms?.data ?? []).filter((x: any) => x.isActive === true);
        this.filteredTerms = [...this.PaymentTermsList];

        this.CurrencyList = (currencies?.data ?? []).filter((x: any) => x.isActive === true);
        this.filteredCurrencies = [...this.CurrencyList];

        this.incotermsList = (incoterms?.data ?? []).filter((x: any) => x.isActive === true);
        this.filteredIncoterms = [...this.incotermsList];

        this.rows = (items?.data ?? []).filter((x: any) => x.isActive === true);
        return of(true);
      })
    );
  }

  /* =========================
     GET BY ID (Hydrate)
  ========================= */
  private loadSupplierById(id: number) {
    return this._SupplierService.getSupplierById(id).pipe(
      switchMap((api: any) => {
        try {
          this.hydrateFromApi(api);
        } catch (e) {
          console.error('Hydrate failed', e);
          Swal.fire('Error', 'Failed to parse supplier data', 'error');
        }
        return of(true);
      })
    );
  }

  private hydrateFromApi(api: any) {
    const item = (api?.data && Array.isArray(api.data) ? api.data[0] : api?.data) ?? api;
    if (!item) return;

    // Supplier fields
    this.supplier = {
      id: item.id,
      name: item.name ?? '',
      code: item.code ?? '',
      statusId: item.statusId ?? 1,
      leadTime: item.leadTime ?? null,
      termsId: item.termsId ?? null,
      currencyId: item.currencyId ?? null,
      taxReg: item.taxReg ?? '',
      incotermsId: item.incotermsId ?? null,
      contact: item.contact ?? '',
      email: item.email ?? '',
      phone: item.phone ?? '',
      address: item.address ?? '',
      bank: {
        name: item.bankName ?? '',
        acc: item.bankAcc ?? '',
        swift: item.bankSwift ?? '',
        branch: item.bankBranch ?? ''
      }
    };

    // Dropdown selections from IDs
    this.selectedStatus = this.statuses.find(x => x.id === this.supplier.statusId) ?? this.statuses[0];
    this.statusSearch = this.selectedStatus.name;

    this.selectedTerm = this.supplier.termsId
      ? (this.PaymentTermsList.find(x => x.id === this.supplier.termsId) || null)
      : null;
    this.termsSearch = this.selectedTerm?.paymentTermsName ?? '';

    this.selectedCurrency = this.supplier.currencyId
      ? (this.CurrencyList.find(x => x.id === this.supplier.currencyId) || null)
      : null;
    this.currencySearch = this.selectedCurrency?.currencyName ?? '';

    this.selectedIncoterm = this.supplier.incotermsId
      ? (this.incotermsList.find(x => x.id === this.supplier.incotermsId) || null)
      : null;
    this.incotermSearch = this.selectedIncoterm?.incotermsName ?? '';

    // Preferred Items from CSV
    const csv = (item.itemID ?? item.ItemID ?? '').toString().trim();
    if (csv) {
      const ids = csv.split(',').map((v: string) => +v.trim()).filter((n: number) => !Number.isNaN(n));
      this.preferredItems = this.rows.filter(r => ids.includes(r.id));
    } else {
      this.preferredItems = [];
    }
    this.preferredText = '';
    this.filteredItems = [];

    // Compliance docs — normalize into our base64 model
    const rawDocs = item.complianceDocuments ?? item.ComplianceDocuments;
    this.docs = this.parseComplianceDocsToBase64Model(rawDocs);
    if (!this.docs.length) {
      this.docs = [{ name: '', number: '', expiry: null, files: [] }];
    }
  }

  /** Convert incoming docs (string/array) into our base64 model.
   *  Handles:
   *   - fileUrl starting with "data:"  -> extract base64
   *   - fileUrl that LOOKS like base64 -> keep base64
   *   - fileUrl starting with "blob:"  -> cannot resolve; leave base64 empty (legacy rows)
   *   - http(s) URL                    -> preview via link; base64 empty
   */
  private parseComplianceDocsToBase64Model(raw: any): ComplianceDoc[] {
    if (!raw) return [];
    let arr: any[] = [];
    try { arr = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return []; }
    if (!Array.isArray(arr)) return [];

    return arr.map((d: any) => {
      const filesIn: any[] = Array.isArray(d?.files) ? d.files : [];
      const files: ComplianceFile[] = filesIn.map((f) => {
        const name = f?.fileName || f?.name || 'file';
        const url = f?.fileUrl || f?.url || '';
        let base64 = '';
        let dataUrl = '';
        let mimeType = f?.mimeType || 'application/octet-stream';

        if (url.startsWith('data:')) {
          // data:<mime>;base64,<payload>
          const comma = url.indexOf(',');
          base64 = comma >= 0 ? url.substring(comma + 1) : '';
          const m = url.match(/^data:([^;]+);base64,/i);
          if (m) mimeType = m[1];
          dataUrl = url;
        } else if (/^[A-Za-z0-9+/=]+$/.test(url) && url.length > 40) {
          // looks like pure base64
          base64 = url;
          dataUrl = `data:${mimeType};base64,${base64}`;
        } else if (url.startsWith('blob:')) {
          // legacy bad value: no way to recover base64 from blob URL
          base64 = '';
          dataUrl = ''; // (could show url as text link, but not useful for preview)
        } else {
          // regular http(s) URL; keep as preview link if you like
          base64 = '';
          dataUrl = url;
        }

        const size = typeof f?.size === 'number' ? f.size : 0;

        return { name, base64, mimeType, size, dataUrl };
      });

      return {
        name: d?.name ?? '',
        number: d?.number ?? '',
        expiry: this.toYMD(d?.expiry),
        files
      };
    });
  }

  /* =========================
     Utils
  ========================= */
  private toYMD(v: any): string | null {
    if (!v) return null;
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const t = Date.parse(v);
    if (Number.isNaN(t)) return null;
    const d = new Date(t);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  private ymdToIso(v?: string | null): string | null {
    if (!v) return null;
    const [y, m, d] = v.split('-').map(n => +n);
    if (!y || !m || !d) return null;
    const dt = new Date(y, m - 1, d);
    return dt.toISOString();
  }

  private readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  /* =========================
     Grid helper (used by HTML)
  ========================= */
  gridColsClass(cols: number) {
    switch (cols) {
      case 1: return 'grid grid-cols-1 gap-3';
      case 2: return 'grid grid-cols-1 md:grid-cols-2 gap-3';
      case 3: return 'grid grid-cols-1 md:grid-cols-3 gap-3';
      case 4: return 'grid grid-cols-1 md:grid-cols-4 gap-3';
      default: return 'grid grid-cols-1 gap-3';
    }
  }

  trackByIndex(index: number) { return index; }

  /* =========================
     Terms / Currency / Incoterms / Status
  ========================= */
  filterTerms() {
    const q = (this.termsSearch || '').toLowerCase();
    this.filteredTerms = this.PaymentTermsList.filter(t =>
      t.paymentTermsName.toLowerCase().includes(q)
    );
  }
  selectTerm(t: Term) {
    this.selectedTerm = t;
    this.termsSearch = t.paymentTermsName;
    this.supplier.termsId = t.id;
    this.termsDropdownOpen = false;
  }

  filterCurrencies() {
    const q = (this.currencySearch || '').toLowerCase();
    this.filteredCurrencies = this.CurrencyList.filter(c =>
      c.currencyName.toLowerCase().includes(q) || c.currencyCode?.toLowerCase().includes(q)
    );
  }
  selectCurrency(c: Currency) {
    this.selectedCurrency = c;
    this.currencySearch = c.currencyName;
    this.supplier.currencyId = c.id;
    this.currencyDropdownOpen = false;
  }

  filterIncoterms() {
    const q = (this.incotermSearch || '').toLowerCase();
    this.filteredIncoterms = this.incotermsList.filter(i =>
      (i.incotermsName || '').toLowerCase().includes(q) ||
      (i.code || '').toLowerCase().includes(q) ||
      (i.name || '').toLowerCase().includes(q)
    );
  }
  selectIncoterm(i: Incoterm) {
    this.selectedIncoterm = i;
    this.incotermSearch = i.incotermsName;
    this.supplier.incotermsId = i.id;
    this.incotermDropdownOpen = false;
  }

  filterStatus() {
    const q = (this.statusSearch || '').toLowerCase();
    this.filteredStatus = this.statuses.filter(s => s.name.toLowerCase().includes(q));
  }
  selectStatus(s: StatusOption) {
    this.selectedStatus = s;
    this.statusSearch = s.name;
    this.supplier.statusId = s.id;
    this.statusDropdownOpen = false;
  }

  /* =========================
     Preferred Items (chips)
  ========================= */
  filterItems(): void {
    const q = (this.preferredText || '').toLowerCase();
    const chosen = new Set(this.preferredItems.map(p => p.id));
    this.filteredItems = this.rows
      .filter(item => item.itemName.toLowerCase().includes(q))
      .filter(item => !chosen.has(item.id));
  }
  selectPreferred(item: Item): void {
    if (!this.preferredItems.some(p => p.id === item.id)) {
      this.preferredItems.push(item);
    }
    this.preferredText = '';
    this.filteredItems = [];
  }
  selectFirstFilteredItem(event: KeyboardEvent): void {
    event.preventDefault();
    if (this.filteredItems.length) this.selectPreferred(this.filteredItems[0]);
  }
  removePreferred(index: number): void {
    this.preferredItems.splice(index, 1);
  }

  /* =========================
     Docs Repeater
  ========================= */
  addDoc() {
    this.docs.push({ name: '', number: '', expiry: null, files: [] });
  }
  removeDoc(i: number) {
    this.docs.splice(i, 1);
  }

  /* =========================
     File Upload (MULTIPLE per row, BASE64 ONLY)
  ========================= */
  async onFileSelected(event: Event, rowIndex: number): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const files = Array.from(input.files);
    for (const file of files) {
      try {
        const dataUrl = await this.readFileAsDataURL(file); // "data:<mime>;base64,<payload>"
        const commaIdx = dataUrl.indexOf(',');
        const base64 = commaIdx >= 0 ? dataUrl.substring(commaIdx + 1) : '';
        const mimeMatch = dataUrl.match(/^data:([^;]+);base64,/i);
        const mimeType = mimeMatch?.[1] || file.type || 'application/octet-stream';

        const entry: ComplianceFile = {
          name: file.name,
          base64,            // pure base64 ONLY
          mimeType,
          size: file.size,
          dataUrl            // used for preview/download in UI
        };
        this.docs[rowIndex].files.push(entry);
      } catch (err) {
        console.error('Failed to read file as base64:', err);
        Swal.fire('Error', `Failed to read file ${file.name}`, 'error');
      }
    }

    input.value = ''; // allow re-selecting same files
  }

  removeFile(rowIndex: number, fileIndex: number): void {
    this.docs[rowIndex].files.splice(fileIndex, 1);
  }

  /* =========================
     Save  (fileUrl = base64 ONLY)
  ========================= */
 save() {
    const preferredItemIds = (this.preferredItems ?? []).map(p => p.id).join(',');

    // Build docs with base64
    const complianceDocsForApi = this.docs.map(d => ({
      name: (d.name || '').trim(),
      number: d.number ?? null,
      expiry: this.ymdToIso(d.expiry),
      files: d.files.map(f => ({
        fileName: f.name,
        fileUrl: f.base64,      // only base64 (no blob, no data: prefix)
        mimeType: f.mimeType,
        size: f.size
      }))
    }));

    const payload: any = {
      id: this.supplier.id ?? 0,
      name: this.supplier.name,
      code: this.supplier.code ?? '',
      leadTime: this.supplier.leadTime,
      taxReg: this.supplier.taxReg,
      contact: this.supplier.contact,
      email: this.supplier.email,
      phone: this.supplier.phone,
      address: this.supplier.address,

      statusId: this.supplier.statusId ?? null,
      termsId: this.supplier.termsId ?? null,
      currencyId: this.supplier.currencyId ?? null,
      incotermsId: this.supplier.incotermsId ?? null,

      itemID: preferredItemIds,
      ComplianceDocuments: JSON.stringify(complianceDocsForApi),

      bankName: this.supplier.bank?.name ?? null,
      bankAcc: this.supplier.bank?.acc ?? null,
      bankSwift: this.supplier.bank?.swift ?? null,
      bankBranch: this.supplier.bank?.branch ?? null,

      createdBy: 'admin',
      updatedBy: 'admin'
    };

    console.log(payload);
    
    // 👇 insert if new, update if existing
    const request$ = payload.id && payload.id > 0
      ? this._SupplierService.updateSupplier(payload)
      : this._SupplierService.insertSupplier(payload);

    request$.subscribe({
      next: (res: any) => {
        if (res?.isSuccess) {
          Swal.fire({
            title: 'Success',
            text: res.message ?? (payload.id > 0 ? 'Supplier updated' : 'Supplier saved'),
            icon: 'success',
            allowOutsideClick: false
          });
          if (payload.id === 0) this.new(); // reset only for new
        } else {
          Swal.fire('Info', res?.message ?? 'Could not save supplier', 'info');
        }
      },
      error: (err) => {
        console.error('Save supplier failed:', err);
        Swal.fire({
          title: 'Error',
          text: err?.error?.title || 'Failed to save supplier.',
          icon: 'error'
        });
      }
    });
  }


  /* =========================
     Reset
  ========================= */
  new() {
    this.supplier = {
      id:0,
      name: '',
      code: '',
      statusId: 1,
      leadTime: null,
      termsId: null,
      currencyId: null,
      taxReg: '',
      incotermsId: null,
      contact: '',
      email: '',
      phone: '',
      address: '',
      bank: { name: '', acc: '', swift: '', branch: '' }
    };

    this.selectedStatus = this.statuses[0];
    this.statusSearch = this.selectedStatus.name;

    this.selectedTerm = null;       this.termsSearch = '';
    this.selectedCurrency = null;   this.currencySearch = '';
    this.selectedIncoterm = null;   this.incotermSearch = '';

    this.preferredItems = []; this.preferredText = ''; this.filteredItems = [];

    this.docs = [{ name: '', number: '', expiry: null, files: [] }];
  }
}
