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
type LineRow = { [k: string]: any };

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
    // deliveryId: 0,
    // contactNumber: '',
    incotermsId: 0,
    poDate: new Date(),
    deliveryDate: new Date(),
    remarks: '',
    // currency: 'SGD',
    fxRate: 0,
    tax: 0.00,
    shipping: 0.00,
    discount: 0.00,
    subTotal: 0,
    netTotal: 0,
    // approvalLevel: 'DeptHead',     
    approvalStatus: '',
  };
  purchaseOrderId: any;
  approvalLevel: any;
  paymentTerms: any;
  currencies: any;
  incoterms: any
  allItems: any;
  accounthead:any
  allBudgets: any
  deliveries: any;


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
    delivery: '',
    incoterms: ''
  };

  dropdownOpen: { [key: string]: boolean } = {
    approval: false,
    supplier: false,
    paymentTerms: false,
    currency: false,
    delivery: false,
    incoterms: false
  };
  // approvalLevel = [
  //   { id: 1, name: 'Department Head' },
  //   { id: 2, name: 'Management' },
  //   { id: 3, name: 'Auto-Approve' },
  // ];
  suppliers = [
    { id: 1, name: 'Sangeetha Restaurants' },
    { id: 2, name: 'Rajbhavan' },
    { id: 3, name: 'Crescent' },
  ];


  filteredLists: { [key: string]: any[] } = {
    approval: [],
    supplier: [],
    paymentTerms: [],
    currency: [],
    delivery: [],
    incoterms: []
  };


  allPrNos = ['PO123', 'PO456', 'PO789'];

  // allItems = [
  //   { code: 'ITM001', name: 'Printer' },
  //   { code: 'ITM002', name: 'Scanner' },
  //   { code: 'ITM003', name: 'Monitor' }
  // ];

  // allBudgets = ['Marketing', 'IT', 'HR'];

  allRecurring = ['One-Time', 'Monthly', 'Yearly'];

  allTaxCodes = ['STD', 'ZRL', 'EXM'];


  constructor(private poService: POService, private router: Router,
    private route: ActivatedRoute, private approvalLevelService: ApprovallevelService,
    private paymentTermsService: PaymentTermsService, private currencyService: CurrencyService,
    private locationService: LocationService, private incotermsService: IncotermsService,
    private itemsService: ItemsService, private chartOfAccountService: ChartofaccountService,
  ) { }


  ngOnInit() {
    debugger
    this.route.paramMap.subscribe((params: any) => {
      this.purchaseOrderId = parseInt(params.get('id'));

      if (this.purchaseOrderId) {
        // ✅ Edit mode
        forkJoin({
          approval: this.approvalLevelService.getAllApprovalLevel(),
           //suppliers: this.supplierService.getAll(),
          paymentTerms: this.paymentTermsService.getAllPaymentTerms(),
          currency: this.currencyService.getAllCurrency(),
          incoterms: this.incotermsService.getAllIncoterms(),
          items: this.itemsService.getAllItem(),
          accounthead:this.chartOfAccountService.getAllChartOfAccount(),
          delivery: this.locationService.getLocation(),
          poHdr: this.poService.getPOById(this.purchaseOrderId)
        }).subscribe((results: any) => {
          this.approvalLevel = results.approval.data;
          //this.suppliers = results.suppliers.data;
          this.paymentTerms = results.paymentTerms.data;
          this.currencies = results.currency.data;
          this.incoterms = results.incoterms.data;
          this.allItems = results.items.data;
          this.accounthead = results.accounthead.data
          this.allBudgets = this.accounthead.map((head: any) => ({
          value: head.id,
          label: this.buildFullPath(head)
          }));
          this.deliveries = results.delivery.data;

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
            // delivery: [...this.deliveries],
          };


          const selectedApproveLevel = this.approvalLevel?.find((d: any) => d.id === this.poHdr.approveLevelId);
          if (selectedApproveLevel) {
            this.searchTexts['approval'] = selectedApproveLevel.name;
          }
          const selectedSupplier = this.suppliers?.find((d:any) => d.id === this.poHdr.supplierId);
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
            // const selectedDelivery = this.deliveries?.find((d: any) => d.id === this.poHdr.deliveryId);
          // if (selectedDelivery) {
          //   this.searchTexts['delivery'] = selectedDelivery.name;
          // }


          this.poLines = JSON.parse(results.poHdr.data.poLines);
        });
      } else {
        debugger
        // ✅ Create mode
        forkJoin({
          approval: this.approvalLevelService.getAllApprovalLevel(),
          //suppliers: this.supplierService.getAll()
          paymentTerms: this.paymentTermsService.getAllPaymentTerms(),
          currency: this.currencyService.getAllCurrency(),
          incoterms: this.incotermsService.getAllIncoterms(),
          items: this.itemsService.getAllItem(),
          accounthead:this.chartOfAccountService.getAllChartOfAccount(),
          delivery: this.locationService.getLocation(),
        }).subscribe((results: any) => {
          this.approvalLevel = results.approval.data;
           //this.suppliers = results.suppliers.data;
          this.paymentTerms = results.paymentTerms.data;
          this.currencies = results.currency.data;
          this.incoterms = results.incoterms.data;
          this.allItems = results.items.data;
          this.accounthead = results.accounthead.data
          this.allBudgets = this.accounthead.map((head: any) => ({
          value: head.id,
          label: this.buildFullPath(head)
          }));
          this.deliveries = results.delivery.data;



         

          this.filteredLists = {
            approval: [...this.approvalLevel],
            supplier: [...this.suppliers],
            paymentTerms: [...this.paymentTerms],
            currency: [...this.currencies],
            incoterms: [...this.incoterms],
             // delivery: [...this.deliveries],
          };

          // default poHdr for create
          //this.poHdr = { id: 0, poDate: new Date(), deliveryDate: this.toISODate(new Date()), ... };
        });
      }
    });
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

  setApprovalStatus(status: string) {
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
         // case 'delivery': this.filteredLists[field] = [...this.deliveries]; break;
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
       // case 'delivery':
      //   this.filteredLists[field] = this.deliveries.filter((s: any) => s.name.toLowerCase().includes(search));
      //   break;  
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
        break;
      case 'paymentTerms':
        this.poHdr.paymentTermId = item.id;
        break;
      case 'currency':
        this.poHdr.currencyId = item.id;
        this.poHdr.currencyName = item.currencyName;
        break;
      // case 'delivery':
      //   this.poHdr.deliveryId = item.id;
      //   break;
      case 'incoterms':
        this.poHdr.incotermsId = item.id;
        break;
    }
    this.dropdownOpen[field] = false;
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
        .filter(x => x.toLowerCase().includes(searchValue));
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
    if (field === 'item') {
      this.poLines[index].item = `${option.itemCode} - ${option.itemName}`;
    }else if(field === 'budget') {
      this.poLines[index][field] = option.label;
    }else if(field === 'location') {
      this.poLines[index][field] = option.name;
    } else {
      this.poLines[index][field] = option;
    }

    this.poLines[index].dropdownOpen = ''; // close dropdown
  }

  poAddLine() {
    // this.poLines = [...this.poLines, { tax: 'STD' }]; 
    this.poLines.push({
      prNo: '',
      item: '',
      description: '',
      budget: '',
      recurring: '',
      qty: 0,
      price: '',
      discount: '',
      taxCode: '',
      location: '',
      contactNumber: '',


      dropdownOpen: '',
      filteredOptions: []
    });
  }
  poRemoveLine(i: number) {
    // this.poLines = this.poLines.filter((_, idx) => idx !== i); 
    this.poLines.splice(i, 1);
  }
  poChange(i: number, key: string, val: any) {
    const copy = [...this.poLines]; copy[i] = { ...copy[i], [key]: val }; this.poLines = copy;
  }
  get poTotals() {
    return this.calcTotals(this.poLines, this.poHdr.tax, this.poHdr.shipping, this.poHdr.discount);
  }
  trackByIndex = (i: number, _: any) => i;


  calcTotals(lines: LineRow[], taxRate = 0, shipping = 0, discount = 0) {
    const sum = lines.reduce((acc, l) => {
      const qty = Number(l['qty'] || 0);
      const price = Number(l['price'] || 0);
      const discPct = Number(l['discount'] || 0);
      return acc + qty * price * (1 - discPct / 100);
    }, 0);

    const tax = sum * (Number(taxRate) / 100);
    const grand = sum + tax + Number(shipping || 0) - Number(discount || 0);

    return {
      sum: this.round(sum),
      tax: this.round(tax),
      grand: this.round(grand),
    };
  }

  round(n: any) { return Math.round((Number(n) || 0) * 100) / 100; }

  notify(msg: string) {
    alert(msg);
  }

  saveRequest() {
    debugger
    const payload = {
      id: this.poHdr.id ? this.poHdr.id : 0,
      purchaseOrderNo: this.poHdr.purchaseOrderNo ? this.poHdr.purchaseOrderNo : '',
      supplierId: this.poHdr.supplierId,
      approveLevelId: this.poHdr.approveLevelId,
      paymentTermId: this.poHdr.paymentTermId,
      currencyId: this.poHdr.currencyId,
      fxRate: this.poHdr.fxRate,
      // deliveryId: this.poHdr.deliveryId,
      // contactNumber: this.poHdr.contactNumber,
      incotermsId: this.poHdr.incotermsId,
      poDate: this.poHdr.poDate,
      deliveryDate: this.poHdr.deliveryDate,
      remarks: this.poHdr.remarks,
      // currency: 'SGD',                  
      tax: this.poHdr.tax,
      shipping: this.poHdr.shipping,
      discount: this.poHdr.discount,
      subTotal: parseFloat(this.poTotals.sum.toFixed(2)),
      netTotal: parseFloat(this.poTotals.grand.toFixed(2)),
      // approvalLevel: 'DeptHead',     
      approvalStatus: this.poHdr.approvalStatus,
      poLines: JSON.stringify(this.poLines)
    };

    if (this.poHdr.id && this.poHdr.id > 0) {
      // 🔹 Update request
      this.poService.updatePO(payload).subscribe({
       next: () => {
                      Swal.fire({
                        icon: 'success',
                        title: 'Created!',
                        text: 'PO updated successfully',
                        confirmButtonText: 'OK',
                        confirmButtonColor: '#0e3a4c'
                      });
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

}







