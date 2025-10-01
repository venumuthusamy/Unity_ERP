import { Component, OnInit, ViewEncapsulation } from '@angular/core';

type Term = { id: number; paymentTermsName: string };
type Currency = { id: number; currencyName: string };
type Item = { id: number; itemName: string };

@Component({
  selector: 'app-createsuppliers',
  templateUrl: './createsuppliers.component.html',
  styleUrls: ['./createsuppliers.component.scss'],
  encapsulation:ViewEncapsulation.None
})
export class CreatesuppliersComponent implements OnInit {
  // ----- UI helpers -----
  hover = false; // for Save button hover color
  gridColsClass = (cols = 1) => `grid grid-cols-1 md:grid-cols-${cols} gap-3`;

  // ----- Supplier model (matches your bindings) -----
  supplier: any = {
    name: '',
    code: '',
    statusId: 1,            // 1=Active, 2=Inactive, 3=On Hold
    leadTime: null,
    termsId: null,
    currencyId: null,
    taxReg: '',
    incotermsId: null,      // you can use numeric ID or string key
    contact: '',
    email: '',
    phone: '',
    address: '',
    bank: {
      name: '',
      acc: '',
      swift: '',
      branch: ''
    }
  };

  // ----- Status dropdown -----
  statusDropdownOpen = false;
  statusSearch = '';
  statusMap: Record<number, string> = { 1: 'Active', 2: 'Inactive', 3: 'On Hold' };
  statuses: string[] = Object.values(this.statusMap);
  filteredStatus: string[] = [...this.statuses];

  filterStatus() {
    const q = (this.statusSearch || '').toLowerCase();
    this.filteredStatus = this.statuses.filter(s => s.toLowerCase().includes(q));
  }

  selectStatus(label: string) {
    // reverse-lookup: label -> id
    const id = Number(Object.keys(this.statusMap)
      .find(k => this.statusMap[+k] === label));
    this.supplier.statusId = id || 1;
    this.statusSearch = label;
    this.statusDropdownOpen = false;
  }

  // ----- Terms dropdown -----
  termsDropdownOpen = false;
  termsSearch = '';
  terms: Term[] = [
    { id: 1, paymentTermsName: 'NET 30' },
    { id: 2, paymentTermsName: 'NET 45' },
    { id: 3, paymentTermsName: 'COD' },
    { id: 4, paymentTermsName: 'NET 15' }
  ];
  filteredTerms: Term[] = [...this.terms];
allItems: Item[] = [
  { id: 11, itemName: 'Containers' },
  { id: 12, itemName: 'Pallets' },
  { id: 13, itemName: 'Labels' },
  { id: 14, itemName: 'Shrink Wrap' },
  { id: 15, itemName: 'Dry Ice' }
];
  filterTerms() {
    const q = (this.termsSearch || '').toLowerCase();
    this.filteredTerms = this.terms.filter(t =>
      t.paymentTermsName.toLowerCase().includes(q)
    );
  }

  selectTerm(t: Term) {
    this.supplier.termsId = t.id;
    this.termsSearch = t.paymentTermsName; // show selected text in input
    this.termsDropdownOpen = false;
  }

  // ----- Currency dropdown -----
  currencyDropdownOpen = false;
  currencySearch = '';
  currencies: Currency[] = [
    { id: 1, currencyName: 'USD' },
    { id: 2, currencyName: 'EUR' },
    { id: 3, currencyName: 'INR' },
    { id: 4, currencyName: 'SGD' }
  ];
  filteredCurrencies: Currency[] = [...this.currencies];

  filterCurrencies() {
    const q = (this.currencySearch || '').toLowerCase();
    this.filteredCurrencies = this.currencies.filter(c =>
      c.currencyName.toLowerCase().includes(q)
    );
  }

  selectCurrency(c: Currency) {
    this.supplier.currencyId = c.id;
    this.currencySearch = c.currencyName;
    this.currencyDropdownOpen = false;
  }

  // ----- Incoterms dropdown -----
  incotermDropdownOpen = false;
  incotermSearch = '';
  incoterms: string[] = ['FOB', 'CIF', 'EXW', 'DAP', 'DDP'];
  filteredIncoterms: string[] = [...this.incoterms];

  filterIncoterms() {
    const q = (this.incotermSearch || '').toLowerCase();
    this.filteredIncoterms = this.incoterms.filter(i =>
      i.toLowerCase().includes(q)
    );
  }

  selectIncoterm(label: string) {
    // If you have IDs for incoterms, map here. For now store label in search box.
    this.supplier.incotermsId = label; // or map to numeric id if needed
    this.incotermSearch = label;
    this.incotermDropdownOpen = false;
  }

  // ----- Preferred items chips with autocomplete -----
  preferredItems: Item[] = [];          // selected chips
  preferredText = '';

  filteredItems: Item[] = [];

  filterItems() {
    const q = (this.preferredText || '').toLowerCase();
    if (!q) { this.filteredItems = []; return; }
    this.filteredItems = this.allItems
      .filter(i => i.itemName.toLowerCase().includes(q))
      // hide already-selected
      .filter(i => !this.preferredItems.some(p => p.id === i.id));
  }

  selectPreferred(item: Item) {
    this.preferredItems.push(item);
    this.preferredText = '';
    this.filteredItems = [];
  }

  selectFirstFilteredItem(ev: KeyboardEvent) {
    ev.preventDefault();
    if (this.filteredItems.length) {
      this.selectPreferred(this.filteredItems[0]);
    }
  }

  removePreferred(index: number) {
    this.preferredItems.splice(index, 1);
    this.filterItems();
  }

  trackByIndex = (i: number) => i;

  // ----- Compliance docs repeater -----
  docs: Array<{ name: string; number: string; expiry: string | null }> = [
    { name: '', number: '', expiry: null }
  ];

  addDoc() {
    this.docs.push({ name: '', number: '', expiry: null });
  }

  removeDoc(i: number) {
    this.docs.splice(i, 1);
  }

  // ----- Actions -----
  save() {
    // assemble payload (example)
    const payload = {
      ...this.supplier,
      preferredItemIds: this.preferredItems.map(p => p.id),
      documents: this.docs
    };
    console.log('SAVE supplier payload →', payload);
    // call your service here
    // this.supplierService.create(payload).subscribe(...)
  }

  new() {
    this.supplier = {
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
    this.statusSearch = this.statusMap[this.supplier.statusId];
    this.termsSearch = '';
    this.currencySearch = '';
    this.incotermSearch = '';
    this.preferredItems = [];
    this.preferredText = '';
    this.filteredItems = [];
    this.docs = [{ name: '', number: '', expiry: null }];
  }

  // ----- Lifecycle -----
  ngOnInit(): void {
    // initialize the visible text for the default status
    this.statusSearch = this.statusMap[this.supplier.statusId];
  }


}
