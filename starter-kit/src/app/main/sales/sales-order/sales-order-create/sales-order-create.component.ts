// sales-order-create.component.ts
import { Component, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';

import { CustomerMasterService } from 'app/main/businessPartners/customer-master/customer-master.service';
import { QuotationsService } from '../../quotations/quotations.service';
import { CountriesService } from 'app/main/master/countries/countries.service';
import { SalesOrderService } from '../sales-order.service';

type WarehouseInfo = {
  warehouseId: number;
  warehouseName: string;
  onHand: number;
  reserved: number;
  available: number;
};

type SoLine = {
  item?: string;
  itemId?: number;
  uom?: string;
  quantity?: number | string;
  unitPrice?: number | string;
  discount?: number | string;
  tax?: 'EXCLUSIVE' | 'INCLUSIVE' | 'EXEMPT';
  lineNet?: number;
  lineTax?: number;
  total?: number;

  warehouses?: WarehouseInfo[];
  selectedWarehouseId?: number | null;
  selectedWh?: WarehouseInfo | null;

  dropdownOpen?: '' | 'item' | 'tax';
  filteredOptions?: any[];
};

@Component({
  selector: 'app-sales-order-create',
  templateUrl: './sales-order-create.component.html',
  styleUrls: ['./sales-order-create.component.scss']
})
export class SalesOrderCreateComponent implements OnInit {

  soHdr: any = {
    id: 0,
    quotationNo: '',
    customerId: 0,
    requestedDate: '',
    deliveryDate: '',
    shipping: 0,
    discount: 0,
    gstPct: 0,
    status: 1,
    statusText: 'Pending'
  };

  customers: any[] = [];
  quotationList: any[] = [];
  items: any[] = [];
  taxCodes: any[] = [];

  soLines: SoLine[] = [];

  submitted = false;
  searchTexts: Record<string,string> = { quotationNo:'', customer:'' };
  dropdownOpen: Record<string,boolean> = { quotationNo:false, customer:false };
  filteredLists: Record<string,any[]> = { quotationNo:[], customer:[] };

  constructor(
    private router: Router,
    private customerSvc: CustomerMasterService,
    private quotationSvc: QuotationsService,
    private countriesSvc: CountriesService,
    private salesOrderService: SalesOrderService
  ) {}

  ngOnInit(): void {
    this.countriesSvc.getCountry().subscribe((res: any) => {
      const countries = (res?.data ?? []);
      this._countryCache = countries.map((c: any) => ({
        id: Number(c.id ?? c.Id),
        gstPercentage: Number(c.gstPercentage ?? c.GSTPercentage ?? 0)
      }));
    });

    forkJoin({
      quotations: this.quotationSvc.getAll(),
      customers: this.customerSvc.GetAllCustomerDetails(),
    }).subscribe((res: any) => {
      this.quotationList = res.quotations?.data ?? [];
      this.customers = res.customers?.data ?? [];
      this.filteredLists.quotationNo = [...this.quotationList];
      this.filteredLists.customer = [...this.customers];
    });
  }

  private _countryCache: any[] = [];
  isEmpty(v:any){ return (v ?? '').toString().trim() === ''; }

  toggleDropdown(field:'quotationNo'|'customer', open?:boolean){
    this.dropdownOpen[field] = open !== undefined ? open : !this.dropdownOpen[field];
    this.filteredLists[field] = field==='quotationNo' ? [...this.quotationList] : [...this.customers];
  }
  filter(field:'quotationNo'|'customer'){
    const q = (this.searchTexts[field]||'').toLowerCase();
    this.filteredLists[field] = (field==='quotationNo'?this.quotationList:this.customers)
      .filter((x:any)=>((field==='quotationNo'?x.number:x.customerName)||'').toLowerCase().includes(q));
  }
  onClearSearch(field:'quotationNo'|'customer'){
    this.searchTexts[field]=''; this.dropdownOpen[field]=false;
    if(field==='quotationNo') this.soHdr.quotationNo=0;
    if(field==='customer') this.soHdr.customerId=0;
  }

  select(field:'quotationNo'|'customer', item:any){
    if(field==='quotationNo'){
      this.soHdr.quotationNo = item.id;
      this.searchTexts['quotationNo'] = item.number ?? '';
      this.searchTexts['customer'] = item.customerName ?? '';

      const match = (this.customers ?? []).find((c:any) =>
        (c.customerName ?? '').toLowerCase() === (item.customerName ?? '').toLowerCase());
      this.soHdr.customerId = match?.customerId ?? 0;

      const cust = this.customers.find((x:any)=>x.customerId===this.soHdr.customerId) || null;
      const country = this._countryCache.find((c:any)=>c.id===(cust?.countryId ?? -1)) || null;
      this.soHdr.gstPct = country?.gstPercentage ?? 0;

      // Load quotation lines (with per-line warehouses JSON)
      this.salesOrderService.GetByQuatitonDetails(this.soHdr.quotationNo).subscribe((res:any)=>{
        const lines = res?.data?.lines ?? [];
        this.soLines = lines.map((l:any): SoLine => {
          const wh = parseWarehouses(l.warehouses, l.warehousesJson);
          return {
            item: l.itemName,
            itemId: l.itemId,
            uom: l.uomName ?? '',
            quantity: Number(l.qty) || 0,
            unitPrice: Number(l.unitPrice) || 0,
            discount: Number(l.discountPct) || 0,
            tax: (l.taxMode || 'EXCLUSIVE'),
            lineNet: Number(l.lineNet) || 0,
            lineTax: Number(l.lineTax) || 0,
            total: Number(l.lineTotal) || 0,
            warehouses: wh,
            selectedWarehouseId: null,
            selectedWh: null,
            dropdownOpen:'', filteredOptions:[]
          };
        });

        // auto-pick a warehouse for every line
        this.soLines.forEach((_,i)=>this.autoSelectWarehouseForLine(i));
        this.recalcTotals();
      });

      this.dropdownOpen['quotationNo']=false; this.dropdownOpen['customer']=false;
      return;
    }
    // customer select
    this.soHdr.customerId = item.id;
    this.searchTexts['customer'] = item.customerName ?? '';
    this.dropdownOpen['customer']=false;
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event) {
    const el = e.target as HTMLElement;
    if (!el.closest('.so-header-dd')) {
      this.dropdownOpen.quotationNo = false;
      this.dropdownOpen.customer = false;
    }
    this.soLines.forEach(l => {
      if (!el.closest('.so-line-dd')) l.dropdownOpen = '';
    });
  }

  // ---------- Auto-pick logic ----------
  private autoSelectWarehouseForLine(i:number){
    const L = this.soLines[i];
    const qty = Number(L.quantity)||0;
    const list = [...(L.warehouses||[])].sort((a,b)=>(b.available||0)-(a.available||0));
    const best = list.find(w => (w.available||0) >= qty) || null;
    L.selectedWarehouseId = best ? best.warehouseId : null;
    L.selectedWh = best ? {...best} : null;
  }

  // ---------- Calculations ----------
  private round2 = (v:number)=>Math.round((v+Number.EPSILON)*100)/100;

  recalcLine(i:number){
    const L = this.soLines[i];
    const qty = Number(L.quantity)||0;
    const price = Number(L.unitPrice)||0;
    const disc = Number(L.discount)||0;
    const rate = (Number(this.soHdr.gstPct)||0)/100;

    const sub = qty*price;
    const afterDisc = sub - (sub*disc/100);

    let net=afterDisc, tax=0, tot=afterDisc;
    switch(L.tax){
      case 'EXCLUSIVE': net=afterDisc; tax=net*rate; tot=net+tax; break;
      case 'INCLUSIVE': tot=afterDisc; net=rate>0?(tot/(1+rate)):tot; tax=tot-net; break;
      default: net=afterDisc; tax=0; tot=afterDisc; break;
    }

    L.lineNet=this.round2(net);
    L.lineTax=this.round2(tax);
    L.total=this.round2(tot);

    // re-decide best warehouse when qty changes
    this.autoSelectWarehouseForLine(i);
    this.recalcTotals();
  }

  get totals(){
    const net = this.soLines.reduce((s,x)=>s+(x.lineNet||0),0);
    const tax = this.soLines.reduce((s,x)=>s+(x.lineTax||0),0);
    const ship = Number(this.soHdr.shipping||0);
    const hdrDc = Number(this.soHdr.discount||0);
    return {
      subTotal: this.round2(net),
      gstAmount: this.round2(tax),
      netTotal: this.round2(net+tax+ship-hdrDc)
    };
  }
  recalcTotals(){ this.soHdr = {...this.soHdr}; }

  // ---------- Save ----------
  private validateSO(): boolean {
    if (this.isEmpty(this.searchTexts.quotationNo) || this.isEmpty(this.searchTexts.customer)){
      this.submitted = true;
      Swal.fire({ icon: 'warning', title: 'Required', text: 'Quotation & Customer are required.'});
      return false;
    }
    if (this.soLines.length===0){
      Swal.fire({ icon: 'warning', title: 'Required', text: 'Add at least one line.'});
      return false;
    }
    const bad = this.soLines.find(l => !l.itemId || !(Number(l.quantity)>0) || !(Number(l.unitPrice)>0));
    if (bad){
      Swal.fire({ icon: 'warning', title: 'Required', text: 'Each line needs Item, Qty>0, Unit Price>0.'});
      return false;
    }
    return true;
  }

  post(): void {
    if (!this.validateSO()) return;

    const payload = {
      id: this.soHdr.id,
      quotationNo: this.soHdr.quotationNo,
      customerId: this.soHdr.customerId,
      requestedDate: this.soHdr.requestedDate,
      deliveryDate: this.soHdr.deliveryDate,
      shipping: Number(this.soHdr.shipping||0),
      discount: Number(this.soHdr.discount||0),
      gstPct: Number(this.soHdr.gstPct||0),
      status: this.soHdr.status,
      customerName: this.searchTexts.customer,

      lineItems: this.soLines.map(l => ({
        itemId: l.itemId!,
        itemName: (l.item||'').toString(),
        uom: l.uom||'',
        quantity: Number(l.quantity)||0,
        unitPrice: Number(l.unitPrice)||0,
        discount: Number(l.discount)||0,
        tax: l.tax||null,
        total: Number(l.total)||0,
        selectedWarehouseId: l.selectedWarehouseId ?? null
      })),

      totals: this.totals
    };

    this.salesOrderService.insertSO(payload).subscribe({
      next: () => {
        Swal.fire({ icon: 'success', title: 'Created!', text: 'Sales Order created' });
        this.router.navigate(['/Sales/Sales-Order-list']);
      },
      error: () => {
        Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to create Sales Order' });
      }
    });
  }

  removeLine(i:number){ this.soLines.splice(i,1); this.recalcTotals(); }
  trackByIndex = (i:number)=>i;
}

function parseWarehouses(arr:any, json:any): WarehouseInfo[] {
  if (Array.isArray(arr)) return arr;
  if (json && typeof json === 'string') { try { return JSON.parse(json); } catch {} }
  return [];
}


