import { Component, HostListener, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { POService } from '../purchase-order.service';
import { IncotermsService } from 'app/main/master/incoterms/incoterms.service';
import { LocationService } from 'app/main/master/location/location.service';
import { CurrencyService } from 'app/main/master/currency/currency.service';
import { PaymentTermsService } from 'app/main/master/payment-terms/payment-terms.service';
import { ApprovallevelService } from 'app/main/master/approval-level/approvallevel.service';
import Swal from 'sweetalert2';
import { ItemsService } from 'app/main/master/items/items.service';
import { ChartofaccountService } from 'app/main/financial/chartofaccount/chartofaccount.service';
import { PurchaseService } from '../../purchase.service';
import { SupplierService } from 'app/main/businessPartners/supplier/supplier.service';
import { RecurringService } from 'app/main/master/recurring/recurring.service';
import { TaxCodeService } from 'app/main/master/taxcode/taxcode.service';
import { CountriesService } from 'app/main/master/countries/countries.service';
type LineRow = { [k: string]: any };
import * as feather from 'feather-icons';
import { POTempService } from '../purchase-order-temp.service';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-purchase-order-create',
  templateUrl: './purchase-order-create.component.html',
  styleUrls: ['./purchase-order-create.component.scss']
})
export class PurchaseOrderCreateComponent implements OnInit {
  hover = false;
  poHdr: any = {
    id: 0,
    purchaseOrderNo: '',
    supplierId: 0,
    approveLevelId: 0,
    paymentTermId: 0,
    currencyId: 0,
    incotermsId: 0,
    poDate: new Date(),
    deliveryDate: '',
    remarks: '',
    fxRate: 0,
    tax: 0,
    shipping: 0.00,
    discount: 0.00,
    subTotal: 0,
    netTotal: 0,
    approvalStatus: '',
  };
  purchaseOrderId: any;
  approvalLevel: any;
  suppliers: any
  paymentTerms: any;
  currencies: any;
  incoterms: any;
  allPrNos: any;
  allItems: any;
  accounthead: any
  allBudgets: any
  allRecurring: any
  allTaxCodes: any
  deliveries: any;
  submitted: boolean;
  iserrorDelivery: boolean;
  countries: any
  minDate = '';
  private draftId: number | null = null;
  userId: string;

  formatDate(date: Date | string): string {
    if (!date) return '';
    const d = new Date(date);
    const day = ('0' + d.getDate()).slice(-2);
    const month = ('0' + (d.getMonth() + 1)).slice(-2);
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }
  poLines: any[] = [];

  searchTexts: { [key: string]: string } = {
    approval: '',
    supplier: '',
    paymentTerms: '',
    currency: '',
    incoterms: '',
  };

  dropdownOpen: { [key: string]: boolean } = {
    approval: false,
    supplier: false,
    paymentTerms: false,
    currency: false,
    incoterms: false
  };


  filteredLists: { [key: string]: any[] } = {
    approval: [],
    supplier: [],
    paymentTerms: [],
    currency: [],
    incoterms: []
  };

  requiredKeys = ['supplier', 'approval', 'paymentTerms']; // add more if needed

  isEmpty(v: any): boolean {
    return (v ?? '').toString().trim() === '';
  }
  ///// for temp data------////
  private cleanHash = '';

  private computeHash(): string {
    // keep only the data that matters
    const data = {
      poHdr: this.poHdr,
      poLines: this.poLines
    };
    return JSON.stringify(data);
  }

  private markClean(): void {
    this.cleanHash = this.computeHash();
  }

  get isDirty(): boolean {
    debugger
    return this.computeHash() !== this.cleanHash;
  }

  ///// for temp data------////


  constructor(private poService: POService, private router: Router,
    private route: ActivatedRoute, private approvalLevelService: ApprovallevelService,
    private paymentTermsService: PaymentTermsService, private currencyService: CurrencyService,
    private locationService: LocationService, private incotermsService: IncotermsService,
    private itemsService: ItemsService, private chartOfAccountService: ChartofaccountService,
    private purchaseService: PurchaseService, private _SupplierService: SupplierService,
    private recurringService: RecurringService, private taxCodeService: TaxCodeService,
    private _countriesService: CountriesService, private poTempService: POTempService,
  ) { this.userId = localStorage.getItem('id') || 'System'; }


  ngOnInit() {
    debugger
    this.setMinDate();
    this.route.queryParamMap.subscribe(q => {
      const dId = Number(q.get('draftId'));
      this.draftId = Number.isFinite(dId) && dId > 0 ? dId : null;
    });
    this.route.paramMap.subscribe((params: any) => {
      this.purchaseOrderId = parseInt(params.get('id'));

      if (this.purchaseOrderId) {
        // ✅ Edit mode
        forkJoin({
          approval: this.approvalLevelService.getAllApprovalLevel(),
          suppliers: this._SupplierService.GetAllSupplier(),
          paymentTerms: this.paymentTermsService.getAllPaymentTerms(),
          currency: this.currencyService.getAllCurrency(),
          incoterms: this.incotermsService.getAllIncoterms(),
          // prlist: this.purchaseService.getAll(),
          prlist: this.purchaseService.GetAvailablePurchaseRequests(),
          items: this.itemsService.getAllItem(),
          accounthead: this.chartOfAccountService.getAllChartOfAccount(),
          recurring: this.recurringService.getRecurring(),
          taxcode: this.taxCodeService.getTaxCode(),
          delivery: this.locationService.getLocation(),
          country: this._countriesService.getCountry(),
          poHdr: this.poService.getPOById(this.purchaseOrderId)
        }).subscribe((results: any) => {
          this.approvalLevel = results.approval.data;
          this.suppliers = results.suppliers.data;
          this.paymentTerms = results.paymentTerms.data;
          this.currencies = results.currency.data;
          this.incoterms = results.incoterms.data;
          this.allPrNos = results.prlist.data;
          this.allItems = results.items.data;
          this.accounthead = results.accounthead.data
          this.allBudgets = this.accounthead.map((head: any) => ({
            value: head.id,
            label: this.buildFullPath(head)
          }));
          this.allRecurring = results.recurring.data;
          this.allTaxCodes = results.taxcode.data;
          this.deliveries = results.delivery.data;
          this.countries = results.country.data;

          this.poHdr = {
            ...results.poHdr.data,
            poDate: new Date(results.poHdr.data.poDate),
            deliveryDate: this.toISODate(new Date(results.poHdr.data.deliveryDate))
          };

          this.filteredLists = {
            approval: [...this.approvalLevel],
            supplier: [...this.suppliers],
            paymentTerms: [...this.paymentTerms],
            currency: [...this.currencies],
            incoterms: [...this.incoterms],
          };


          const selectedApproveLevel = this.approvalLevel?.find((d: any) => d.id === this.poHdr.approveLevelId);
          if (selectedApproveLevel) {
            this.searchTexts['approval'] = selectedApproveLevel.name;
          }
          const selectedSupplier = this.suppliers?.find((d: any) => d.id === this.poHdr.supplierId);
          if (selectedSupplier) {
            this.searchTexts['supplier'] = selectedSupplier.name;
          }
          const selectedPaymentTerms = this.paymentTerms?.find((d: any) => d.id === this.poHdr.paymentTermId);
          if (selectedPaymentTerms) {
            this.searchTexts['paymentTerms'] = selectedPaymentTerms.paymentTermsName;
          }
          const selectedCurrency = this.currencies?.find((d: any) => d.id === this.poHdr.currencyId);
          if (selectedCurrency) {
            this.searchTexts['currency'] = selectedCurrency.currencyName;
          }
          const selectedIncoterms = this.incoterms?.find((d: any) => d.id === this.poHdr.incotermsId);
          if (selectedIncoterms) {
            this.searchTexts['incoterms'] = selectedIncoterms.incotermsName;
          }



          this.poLines = JSON.parse(results.poHdr.data.poLines);
          this.calculateFxTotal()
        });
      } else {
        debugger
        // ✅ Create mode
        forkJoin({
          approval: this.approvalLevelService.getAllApprovalLevel(),
          suppliers: this._SupplierService.GetAllSupplier(),
          paymentTerms: this.paymentTermsService.getAllPaymentTerms(),
          currency: this.currencyService.getAllCurrency(),
          incoterms: this.incotermsService.getAllIncoterms(),
          // prlist: this.purchaseService.getAll(),
          prlist: this.purchaseService.GetAvailablePurchaseRequests(),
          items: this.itemsService.getAllItem(),
          accounthead: this.chartOfAccountService.getAllChartOfAccount(),
          recurring: this.recurringService.getRecurring(),
          taxcode: this.taxCodeService.getTaxCode(),
          delivery: this.locationService.getLocation(),
          country: this._countriesService.getCountry(),
        }).subscribe((results: any) => {
          this.approvalLevel = results.approval.data;
          this.suppliers = results.suppliers.data;
          this.paymentTerms = results.paymentTerms.data;
          this.currencies = results.currency.data;
          this.incoterms = results.incoterms.data;
          this.allPrNos = results.prlist.data;
          this.allItems = results.items.data;
          this.accounthead = results.accounthead.data
          this.allBudgets = this.accounthead.map((head: any) => ({
            value: head.id,
            label: this.buildFullPath(head)
          }));
          this.allRecurring = results.recurring.data;
          this.allTaxCodes = results.taxcode.data;
          this.deliveries = results.delivery.data;
          this.countries = results.country.data;

          this.filteredLists = {
            approval: [...this.approvalLevel],
            supplier: [...this.suppliers],
            paymentTerms: [...this.paymentTerms],
            currency: [...this.currencies],
            incoterms: [...this.incoterms],
          };

          if (this.draftId) {
            this.loadDraftIntoCreate(this.draftId);
          }
        });
      }
    });
    setTimeout(() => this.markClean());
  }
  ngAfterViewChecked(): void {
    feather.replace();  // remove the guard so icons refresh every cycle
  }
  ngAfterViewInit(): void {
    feather.replace();
  }
  private loadDraftIntoCreate(id: number) {
    this.poTempService.getPODraftById(id).subscribe({
      next: (res: any) => {
        const raw = res?.data;
        if (!raw) return;

        // 1) normalize keys/casing and coerce numbers/dates
        const d = {
          id: Number(raw.id ?? raw.Id ?? 0),
          purchaseOrderNo: raw.purchaseOrderNo ?? raw.PurchaseOrderNo ?? '',
          supplierId: Number(raw.supplierId ?? raw.SupplierId ?? 0),
          approveLevelId: Number(raw.approveLevelId ?? raw.ApproveLevelId ?? 0),
          paymentTermId: Number(raw.paymentTermId ?? raw.PaymentTermId ?? 0),
          currencyId: Number(raw.currencyId ?? raw.CurrencyId ?? 0),
          incotermsId: Number(raw.incotermsId ?? raw.IncotermsId ?? 0),
          poDate: raw.poDate ?? raw.PoDate,
          deliveryDate: raw.deliveryDate ?? raw.DeliveryDate,
          remarks: raw.remarks ?? raw.Remarks ?? '',
          fxRate: Number(raw.fxRate ?? raw.FxRate ?? 0),
          tax: Number(raw.tax ?? raw.Tax ?? 0),
          shipping: Number(raw.shipping ?? raw.Shipping ?? 0),
          discount: Number(raw.discount ?? raw.Discount ?? 0),
          subTotal: Number(raw.subTotal ?? raw.SubTotal ?? 0),
          netTotal: Number(raw.netTotal ?? raw.NetTotal ?? 0),
          approvalStatus: Number(
            raw.approvalStatus ?? raw.ApprovalStatus ?? 0
          ),
          poLines: raw.poLines ?? raw.PoLines ?? '[]',
        };

        // 2) set header (stay in CREATE mode → id = 0)
        this.poHdr = {
          ...this.poHdr,
          id: 0,
          purchaseOrderNo: d.purchaseOrderNo,
          supplierId: d.supplierId,
          approveLevelId: d.approveLevelId,
          paymentTermId: d.paymentTermId,
          currencyId: d.currencyId,
          incotermsId: d.incotermsId,
          poDate: d.poDate ? new Date(d.poDate) : new Date(),
          deliveryDate: d.deliveryDate ? this.toISODate(new Date(d.deliveryDate)) : '',
          remarks: d.remarks,
          fxRate: d.fxRate,
          tax: d.tax,
          shipping: d.shipping,
          discount: d.discount,
          approvalStatus: d.approvalStatus
        };

        // 3) bind visible dropdown texts from master lists (by Id)
        const approve = this.approvalLevel?.find((x: any) => x.id === d.approveLevelId);
        const supplier = this.suppliers?.find((x: any) => x.id === d.supplierId);
        const payTerm = this.paymentTerms?.find((x: any) => x.id === d.paymentTermId);
        const currency = this.currencies?.find((x: any) => x.id === d.currencyId);
        const inco = this.incoterms?.find((x: any) => x.id === d.incotermsId);

        this.searchTexts['approval'] = approve?.name ?? '';
        this.searchTexts['supplier'] = supplier?.name ?? '';
        this.searchTexts['paymentTerms'] = payTerm?.paymentTermsName ?? '';
        this.searchTexts['currency'] = currency?.currencyName ?? '';
        this.searchTexts['incoterms'] = inco?.incotermsName ?? '';

        // keep currencyName/fxRate consistent with your existing logic
        this.poHdr.currencyName = currency?.currencyName ?? '';
        this.poHdr.fxRate = (this.poHdr.currencyName || '').toUpperCase() === 'SGD' ? (this.poHdr.fxRate || 1) : (this.poHdr.fxRate || 0);

        // 4) lines
        try {
          this.poLines = Array.isArray(d.poLines) ? d.poLines : JSON.parse(d.poLines || '[]');
        } catch { this.poLines = []; }

        // 5) totals and clean state
        this.calculateFxTotal();
        this.markClean();
      },
      error: (err) => console.error('Failed to load PO draft', err)
    });
  }

  setMinDate() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    this.minDate = `${yyyy}-${mm}-${dd}`;
  }

  buildFullPath(item: any): string {
    let path = item.headName;
    let current = this.accounthead.find((x: any) => x.id === item.parentHead);
    while (current) {
      path = `${current.headName} >> ${path}`;
      current = this.accounthead.find((x: any) => x.id === current.parentHead);
    }
    return path;
  }

  toISODate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  gridColsClass(cols: number) {
    return {
      'grid grid-cols-1 gap-3': true,
      'md:grid-cols-1': cols === 1,
      'md:grid-cols-2': cols === 2,
      'md:grid-cols-3': cols === 3,
      'md:grid-cols-4': cols === 4,
      'md:grid-cols-5': cols === 5,
      'md:grid-cols-6': cols === 6,
    };
  }

  setApprovalStatus(status) {
    debugger
    this.poHdr.approvalStatus = status;
    // this.notify(`PO ${status} at ${this.poHdr.approvalLevel} level`);
    this.saveRequest()
  }


  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;

    // Check if click is outside any dropdown
    this.poLines.forEach(line => {
      if (!target.closest('.dropdown-cell')) {
        line.dropdownOpen = '';
      }
    });
    if (!target.closest('.relative')) {
      for (let key in this.dropdownOpen) {
        this.dropdownOpen[key] = false;
      }
    }
  }

  toggleDropdown(field: string, open?: boolean) {
    debugger
    this.dropdownOpen[field] = open !== undefined ? open : !this.dropdownOpen[field];
    if (this.dropdownOpen[field]) {
      switch (field) {
        case 'approval': this.filteredLists[field] = [...this.approvalLevel]; break;
        case 'supplier': this.filteredLists[field] = [...this.suppliers]; break;
        case 'paymentTerms': this.filteredLists[field] = [...this.paymentTerms]; break;
        case 'currency': this.filteredLists[field] = [...this.currencies]; break;
        case 'incoterms': this.filteredLists[field] = [...this.incoterms]; break;
      }
    }
  }

  // Filter function
  filter(field: string) {

    const search = this.searchTexts[field].toLowerCase();

    switch (field) {
      case 'approval':
        this.filteredLists[field] = this.approvalLevel.filter((s: any) => s.name.toLowerCase().includes(search));
        break;
      case 'supplier':
        this.filteredLists[field] = this.suppliers.filter((s: any) => s.name.toLowerCase().includes(search));
        break;
      case 'paymentTerms':
        this.filteredLists[field] = this.paymentTerms.filter((p: any) => p.paymentTermsName.toLowerCase().includes(search));
        break;
      case 'currency':
        this.filteredLists[field] = this.currencies.filter((s: any) => s.currencyName.toLowerCase().includes(search));
        break;
      case 'incoterms':
        this.filteredLists[field] = this.incoterms.filter((s: any) => s.incotermsName.toLowerCase().includes(search));
        break;
    }
  }

  //  Select item
  select(field: string, item: any) {

    this.searchTexts[field] = item.name || item.paymentTermsName || item.currencyName || item.incotermsName;
    switch (field) {
      case 'approval':
        this.poHdr.approveLevelId = item.id;
        break;
      case 'supplier':
        this.poHdr.supplierId = item.id;
        // find matching currency in currency list
        const found = this.currencies.find(x => x.id === item.currencyId);

        // update header + input
        this.poHdr.currencyId = item.currencyId;
        this.poHdr.currencyName = found?.currencyName || found?.name || '';
        if (this.poHdr.currencyName === 'SGD') {
          this.poHdr.fxRate = 1
        } else {
          this.poHdr.fxRate = 0
        }
        this.searchTexts['currency'] = this.poHdr.currencyName;

        const foundGst = this.countries.find(x => x.id === item.countryId);
        this.poHdr.tax = foundGst?.gstPercentage || '';
        break;
      case 'paymentTerms':
        this.poHdr.paymentTermId = item.id;
        break;
      case 'currency':
        this.poHdr.currencyId = item.id;
        this.poHdr.currencyName = item.currencyName;
        break;
      case 'incoterms':
        this.poHdr.incotermsId = item.id;
        break;
    }
    this.dropdownOpen[field] = false;
  }
  isSGDCurrency(): boolean {
    const code = (this.poHdr.currencyName || '').toUpperCase();
    return code === 'SGD';
  }
  // Clear search
  onClearSearch(field: string) {
    this.searchTexts[field] = '';
    this.dropdownOpen[field] = false;
  }


  //--------------- table ----------//

  openDropdown(index: number, field: string) {
    debugger
    this.poLines[index].dropdownOpen = field;
    // this.filterOptions(index, field); // show all initially
    if (field === 'prNo') {
      this.poLines[index].filteredOptions = [...this.allPrNos];
    }
    if (field === 'item') {
      this.poLines[index].filteredOptions = [...this.allItems];
    }
    if (field === 'budget') {
      this.poLines[index].filteredOptions = [...this.allBudgets];
    }
    if (field === 'recurring') {
      this.poLines[index].filteredOptions = [...this.allRecurring];
    }
    if (field === 'taxCode') {
      this.poLines[index].filteredOptions = [...this.allTaxCodes];
    }
    if (field === 'location') {
      this.poLines[index].filteredOptions = [...this.deliveries];
    }
  }

  filterOptions(index: number, field: string) {
    debugger
    const searchValue = (this.poLines[index][field] || '').toLowerCase();

    if (field === 'prNo') {
      this.poLines[index].filteredOptions = this.allPrNos
        .filter(x => x.purchaseRequestNo.toLowerCase().includes(searchValue));
    }

    if (field === 'item') {
      this.poLines[index].filteredOptions = this.allItems
        .filter(x =>
          x.itemCode.toLowerCase().includes(searchValue) ||
          x.itemName.toLowerCase().includes(searchValue)
        );
    }

    if (field === 'budget') {
      this.poLines[index].filteredOptions = this.allBudgets
        .filter(x => x.toLowerCase().includes(searchValue));
    }

    if (field === 'recurring') {
      this.poLines[index].filteredOptions = this.allRecurring
        .filter(x => x.toLowerCase().includes(searchValue));
    }

    if (field === 'taxCode') {
      this.poLines[index].filteredOptions = this.allTaxCodes
        .filter(x => x.toLowerCase().includes(searchValue));
    }
    if (field === 'location') {
      this.poLines[index].filteredOptions = this.deliveries
        .filter(x => x.toLowerCase().includes(searchValue));
    }
  }

  selectOption(index: number, field: string, option: any) {
    debugger
    if (field === 'prNo') {
      const chosenNo: string = option?.purchaseRequestNo ?? option;
      const pr = this.allPrNos.find((p: any) => p.purchaseRequestNo === chosenNo);
      if (!pr) return;

      // Close dropdown on the clicked row
      this.poLines[index].dropdownOpen = '';
      this.poLines[index].filteredOptions = [];

      // ✅ Append PR lines
      this.appendPRToPOLines(pr);

      // ✅ Remove the picker row if it's empty or only has PR No
      if (this.isOnlyPrNo(this.poLines[index]) || this.isEmptyLine(this.poLines[index])) {
        this.poLines.splice(index, 1);
        this.recalculateTotals();
      }

      return;
    }

    // Other fields
    if (field === 'item') {
      this.poLines[index].item = `${option.itemCode} - ${option.itemName}`;
    } else if (field === 'budget') {
      this.poLines[index][field] = option.label;
    } else if (field === 'location') {
      this.poLines[index][field] = option.name;
    } else if (field === 'recurring') {
      this.poLines[index][field] = option.recurringName;
    } else if (field === 'taxCode') {
      this.poLines[index][field] = option.name;
    } else {
      this.poLines[index][field] = option;
    }

    this.poLines[index].dropdownOpen = ''; // close dropdown
  }

  /** ========= APPEND PR → PO LINES (no replace) ========= */
  private appendPRToPOLines(pr: any) {
    const lines = this.safeParsePrLines(pr?.prLines);
    if (!lines.length) return;

    const newPOLines = lines.map((l: any) =>
      this.mapPRLineToPOLine(pr.purchaseRequestNo, l)
    );

    // ✅ 1) Remove ALL empty/placeholder rows before appending
    this.poLines = this.poLines.filter(line => !this.isEmptyLine(line) && !this.isOnlyPrNo(line));

    // ✅ 2) Append new PR lines (avoid duplicates — or merge qty)
    for (const nl of newPOLines) {
      const dupIdx = this.poLines.findIndex(pl => this.isSameLine(pl, nl));
      if (dupIdx === -1) {
        this.poLines.push(nl);
      } else {
        // If you prefer merging quantities for identical lines, uncomment:
        // this.poLines[dupIdx].qty = (Number(this.poLines[dupIdx].qty) || 0) + (Number(nl.qty) || 0);
      }
    }
  }

  private safeParsePrLines(raw: any): any[] {
    if (Array.isArray(raw)) return raw;
    if (!raw) return [];
    try {
      const parsed = JSON.parse(String(raw));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private mapPRLineToPOLine(prNo: string, line: any) {
    const po = this.makeEmptyPOLine();
    po.prNo = prNo;

    // Prefer "code - name" if both exist; fallback to whatever is present
    const itemCode = line.itemCode ?? line.itemSearch ?? '';
    const itemName = line.itemName ?? line.itemSearch ?? '';
    po.item = itemName && itemCode ? `${itemCode} - ${itemName}` : (itemCode || itemName || '');

    po.description = line.remarks ?? '';
    po.budget = line.budget ?? '';
    po.location = line.location ?? line.locationSearch ?? '';
    const contactNumber = this.deliveries.find(x => x.name == line.location).contactNumber
    po.contactNumber = contactNumber ?? '';
    po.qty = Number(line.qty) || 0;

    return po;
  }

  private makeEmptyPOLine() {
    return {
      prNo: '',
      item: '',
      description: '',
      budget: '',
      recurring: '',
      taxCode: '',
      location: '',
      contactNumber: '',
      qty: 0,
      price: '',
      discount: '',
      total: '',

      dropdownOpen: '',
      filteredOptions: []
    };
  }

  /** Treat a row with no meaningful data as empty */
  private isEmptyLine(line: any): boolean {
    return !line?.prNo &&
      !line?.item &&
      !line?.budget &&
      !line?.location &&
      !String(line?.description ?? '').trim() &&
      (Number(line?.qty) || 0) === 0;
  }

  /** Row that has ONLY a PR number (typical "picker" row after selection) */
  private isOnlyPrNo(line: any): boolean {
    const empty = (v: any) => !String(v ?? '').trim();
    return !!line?.prNo &&
      empty(line?.item) &&
      empty(line?.budget) &&
      empty(line?.location) &&
      empty(line?.description) &&
      (Number(line?.qty) || 0) === 0;
  }

  /** Equality used to prevent duplicate rows */
  private isSameLine(a: any, b: any): boolean {
    const norm = (v: any) => String(v ?? '').trim().toLowerCase();
    return (
      norm(a.prNo) === norm(b.prNo) &&
      norm(a.item) === norm(b.item) &&
      norm(a.location) === norm(b.location) &&
      norm(a.budget) === norm(b.budget) &&
      norm(a.description) === norm(b.description)
    );
  }

  poAddLine() {
    // this.poLines = [...this.poLines, { tax: 'STD' }]; 
    this.poLines.push({
      prNo: '',
      item: '',
      description: '',
      budget: '',
      recurring: '',
      taxCode: '',
      location: '',
      contactNumber: '',
      qty: 0,
      price: '',
      discount: '',
      total: '',

      dropdownOpen: '',
      filteredOptions: []
    });
  }

  poRemoveLine(i: number) {
    // this.poLines = this.poLines.filter((_, idx) => idx !== i); 
    this.poLines.splice(i, 1);
     this.recalculateTotals();
  }

  poChange(i: number, key: string, val: any) {
    const copy = [...this.poLines]; copy[i] = { ...copy[i], [key]: val }; this.poLines = copy;
  }

  trackByIndex = (i: number, _: any) => i;


  calculateLineTotal(line: any) {
    const qty = Number(line.qty) || 0;
    const price = Number(line.price) || 0;
    const discount = Number(line.discount) || 0;

    // If discount is percentage
    const sub = qty * price;
    line.total = sub - (sub * discount) / 100;

    // Round to 2 decimals
    line.total = Number(line.total.toFixed(2));

    // Recalculate overall totals whenever a line changes
    this.recalculateTotals();
  }

  recalculateTotals() {
    // Just force Angular change detection by re-assigning the header object
    this.poHdr = { ...this.poHdr };
    this.calculateFxTotal();
  }


  /** Compute totals dynamically */
  get poTotals() {
    return this.calcTotals(this.poLines, this.poHdr.shipping, this.poHdr.discount, this.poHdr.tax);
  }

  /** Do the math: subtotal → +shipping → -discount → +GST */
  calcTotals(lines: any[], shipping = 0, discount = 0, gstPercent = 0) {
    const subTotal = lines.reduce((sum, l) => sum + (Number(l.total) || 0), 0);

    const afterShipping = subTotal + Number(shipping || 0);
    const afterDiscount = afterShipping - Number(discount || 0);
    const gstAmount = afterDiscount * (Number(gstPercent) / 100);
    const netTotal = afterDiscount + gstAmount;

    return {
      subTotal: this.round(subTotal),
      gstAmount: this.round(gstAmount),
      netTotal: this.round(netTotal)
    };
  }

  /** Utility rounder */
  round(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  calculateFxTotal() {
    const fx = Number(this.poHdr.fxRate) || 1;
    const netTotal = this.poTotals?.netTotal || 0;

    if (this.isSGDCurrency()) {
      // Base currency = SGD → no conversion needed
      this.poHdr.netTotalBase = netTotal;
    } else {
      // Convert to base SGD
      this.poHdr.netTotalBase = Number((netTotal * fx).toFixed(2));
    }
  }
  notify(msg: string) {
    alert(msg);
  }
  deliveryChange() {
    this.iserrorDelivery = false
  }
  validatePO(): boolean {

    // Case 1: No lines
    if (this.poLines.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Required', text: 'Please add at least one line item.' });
      return false;
    }

    // Case 2: Missing or invalid price
    const invalidLine = this.poLines.find(line => !line.price || line.price <= 0);
    if (invalidLine) {
      Swal.fire({ icon: 'warning', title: 'Required', text: 'Please enter a valid price for all Line items.' });
      return false;
    }

    return true; // ✅ everything is okay
  }
  saveRequest() {

    if (this.draftId) {

    this.submitted = true;
    if (!this.poHdr.deliveryDate) {
      this.iserrorDelivery = true
    } else {
      this.iserrorDelivery = false;
    }

    const missing = this.requiredKeys.filter(k => this.isEmpty(this.searchTexts[k]));
    if (missing.length || this.iserrorDelivery) {

      Swal.fire({
        icon: 'warning',
        title: 'Required',
        text: 'Please fill required Fields',
        confirmButtonColor: '#0e3a4c'
      });
      return;
    }


    if (!this.validatePO()) return;
     const draftPayload = this.buildPayloadForSaveDraft();

       this.poTempService.updatePODraft(this.draftId, draftPayload).pipe(
      // 2) Only after save succeeds, promote
      switchMap(() => this.poTempService.promotePODraft(this.draftId, this.userId))
    ).subscribe({
      next: (res) => {
        const newPoId = res?.data?.id;
        Swal.fire({ icon: 'success', title: 'Converted', text: 'Draft converted to PO' });
        this.router.navigate(['/purchase/list-purchaseorder']);
      },
      error: () => Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to convert draft' })
    });
      return;
    }

    this.submitted = true;
    if (!this.poHdr.deliveryDate) {
      this.iserrorDelivery = true
    } else {
      this.iserrorDelivery = false;
    }

    const missing = this.requiredKeys.filter(k => this.isEmpty(this.searchTexts[k]));
    if (missing.length || this.iserrorDelivery) {

      Swal.fire({
        icon: 'warning',
        title: 'Required',
        text: 'Please fill required Fields',
        confirmButtonColor: '#0e3a4c'
      });
      return;
    }


    if (!this.validatePO()) return;

    const payload = {
      id: this.poHdr.id ? this.poHdr.id : 0,
      purchaseOrderNo: this.poHdr.purchaseOrderNo ? this.poHdr.purchaseOrderNo : '',
      supplierId: this.poHdr.supplierId,
      approveLevelId: this.poHdr.approveLevelId,
      paymentTermId: this.poHdr.paymentTermId,
      currencyId: this.poHdr.currencyId,
      fxRate: this.poHdr.fxRate,
      incotermsId: this.poHdr.incotermsId,
      poDate: this.poHdr.poDate,
      deliveryDate: this.poHdr.deliveryDate,
      remarks: this.poHdr.remarks,
      tax: this.poHdr.tax,
      shipping: this.poHdr.shipping,
      discount: this.poHdr.discount,
      subTotal: Number(this.poTotals.subTotal.toFixed(2)),
      netTotal: Number(this.poTotals.netTotal.toFixed(2)),
      approvalStatus: this.poHdr.approvalStatus,
      poLines: JSON.stringify(this.poLines)
    };

    if (this.poHdr.id && this.poHdr.id > 0) {
      // 🔹 Update request
      this.poService.updatePO(payload).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Updated!',
            text: 'PO updated successfully',
            confirmButtonText: 'OK',
            confirmButtonColor: '#0e3a4c'
          });
          this.markClean();
          this.router.navigateByUrl(`/purchase/list-purchaseorder`)

        },
        error: () => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to updated PO',
            confirmButtonText: 'OK',
            confirmButtonColor: '#d33'
          });
        }
      });
    } else {
      // 🔹 Create request
      this.poService.insertPO(payload).subscribe({

        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Created!',
            text: 'PO created successfully',
            confirmButtonText: 'OK',
            confirmButtonColor: '#0e3a4c'
          });
          this.markClean();
          this.router.navigateByUrl(`/purchase/list-purchaseorder`)

        },
        error: () => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to created PO',
            confirmButtonText: 'OK',
            confirmButtonColor: '#d33'
          });
        }
      });
    }
  }

  cancel() {
    this.router.navigate(['/purchase/list-purchaseorder']);
  }

  allowOnlyNumbers(event: KeyboardEvent) {
    const invalidKeys = ['e', 'E', '+', '-', '.'];
    if (invalidKeys.includes(event.key)) {
      event.preventDefault();
    }
  }
  sanitizeNumberInput(field: string, index: number) {
    this.poLines[index][field] = this.poLines[index][field]
      ?.toString()
      .replace(/\D/g, '') || '';
  }

  ///// for temp data------////

  async goToPurchaseorder() {
    if (this.purchaseOrderId) {
      this.router.navigate(['/purchase/list-purchaseorder']);
      return;
    }
    if (this.draftId) {
      if (this.isDirty) {
        const ok = await this.saveDraft(); // this calls updatePODraft(draftId, payload)
        if (!ok) return;                   // stop if save failed
      }
      this.router.navigate(['/purchase/list-purchaseorder']);
      return;
    }
    const ok = await this.confirmLeave();
    if (ok) this.router.navigate(['/purchase/list-purchaseorder']);

  }
  async confirmLeave(): Promise<boolean> {
    debugger
    // Never prompt in EDIT mode
    if (this.purchaseOrderId) return true;

    // Only prompt if user actually changed something
    if (!this.isDirty) return true;

    const result = await Swal.fire({
      icon: 'question',
      title: 'Leave this page?',
      text: 'You have unsaved changes. Save as draft before leaving?',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'Save as Draft',
      denyButtonText: 'Discard',
      cancelButtonText: 'Stay',
      confirmButtonColor: '#0e3a4c'
    });

    if (result.isConfirmed) return await this.saveDraft(); // save then leave
    if (result.isDenied) return true;                       // discard and leave
    return false;                                           // stay
  }


  private buildPayloadForSaveDraft() {
    debugger
    return {
      id: this.draftId ?? 0,
      purchaseOrderNo: this.poHdr.purchaseOrderNo || '',
      supplierId: this.poHdr.supplierId || 0,
      approveLevelId: this.poHdr.approveLevelId || 0,
      paymentTermId: this.poHdr.paymentTermId || 0,
      currencyId: this.poHdr.currencyId || 0,
      fxRate: this.poHdr.fxRate || 0,
      incotermsId: this.poHdr.incotermsId || 0,
      poDate: this.poHdr.poDate,
      deliveryDate: this.poHdr.deliveryDate || null,
      remarks: this.poHdr.remarks || '',
      tax: this.poHdr.tax || 0,
      shipping: this.poHdr.shipping || 0,
      discount: this.poHdr.discount || 0,
      subTotal: Number(this.poTotals.subTotal.toFixed(2)),
      netTotal: Number(this.poTotals.netTotal.toFixed(2)),
      approvalStatus:this.poHdr.approvalStatus === '' || this.poHdr.approvalStatus == null ? 0: this.poHdr.approvalStatus,
      poLines: JSON.stringify(this.poLines || [])
    };
  }

  private saveDraft(): Promise<boolean> {
    const payload = this.buildPayloadForSaveDraft();
    return new Promise<boolean>((resolve) => {
      const obs = this.draftId
        ? this.poTempService.updatePODraft(this.draftId, payload)
        : this.poTempService.createPODraft(payload);

      obs.subscribe({
        next: (res) => {
          // if create, remember new draft id
          if (!this.draftId) {
            // API returns { success, message, data: { id } }
            this.draftId = res?.data?.id ?? null;
          }
          this.markClean();
          Swal.fire({
            icon: 'success',
            title: 'Saved as Draft',
            text: 'Your PO was saved as draft.',
            timer: 1200,
            showConfirmButton: false
          });
          resolve(true);
        },
        error: () => {
          Swal.fire({ icon: 'error', title: 'Error', text: 'Draft save failed', confirmButtonColor: '#d33' });
          resolve(false);
        }
      });
    });
  }
  ///// for temp data------////


}







