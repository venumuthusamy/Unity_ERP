import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { SalesInvoiceService, SiCreateLine, SiCreateRequest, SiSourceType } from './sales-invoice.service';
import { TaxCodeService } from 'app/main/master/taxcode/taxcode.service';
import { SalesOrderService } from '../sales-order/sales-order.service';
import { DeliveryOrderService } from '../deliveryorder/deliveryorder.service';

@Component({
  selector: 'app-sales-invoicecreate',
  templateUrl: './sales-invoicecreate.component.html',
  styleUrls: ['./sales-invoicecreate.component.scss']
})
export class SalesInvoicecreateComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // UI helpers
  sourceTypeOptions = [
    { value: 1 as SiSourceType, label: 'From SO' },
    { value: 2 as SiSourceType, label: 'From DO' }
  ];
  trackById = (_: number, x: any) => x?.id ?? _;
  compareById = (a: any, b: any) => (a != null && b != null ? +a === +b : a === b);
  trackByLine = (idx: number, row: any) => row?.sourceLineId ?? row?.itemId ?? idx;

  // header
  sourceType: SiSourceType = 1;          // 1=SO, 2=DO
  sourceId: number | null = null;
  invoiceDate = new Date().toISOString().substring(0, 10);
  headerCurrencyId: number | null = null;

  // dropdown data
  soList: any[] = [];
  doList: any[] = [];
  currencies: any[] = [];   // if you need header/line currency; wire your endpoint if required
  taxCodes: any[] = [];

  // lines & totals
  lines: (SiCreateLine & { itemName: string; uom?: string | null })[] = [];
  total = 0;

  constructor(
    private api: SalesInvoiceService,
    private taxCodeService: TaxCodeService,
    private soSrv: SalesOrderService,
    private deliveryOrderService: DeliveryOrderService
  ) {}

  ngOnInit(): void {
    debugger
    // Load dropdowns together
    forkJoin({
      taxCodes: this.taxCodeService.getTaxCode(),      // {isSuccess, message, data}
      soList:   this.soSrv.getSO(),                    // {isSuccess, message, data}
      doList:   this.deliveryOrderService.getAll()     // {isSuccess, message, data}
      // currencies: this.someCurrencyService.getAll() // add if you have it
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: ({ taxCodes, soList, doList }: any) => {
        this.taxCodes = Array.isArray(taxCodes?.data) ? taxCodes.data : [];
        this.soList   = Array.isArray(soList?.data)   ? soList.data   : [];

        // Normalize DO payload: ensure number id and stable doNumber field
        const raw = Array.isArray(doList) ? doList: [];
        this.doList = raw.map((d: any) => ({
          ...d,
          id: +d.id,                                      // normalize id to number
          doNumber: d.doNumber ?? d.DoNumber ?? ''        // normalize label casing
        }));

        // (Optional) currencies → remove if unused or wire your real endpoint
        // this.currencies = (currencies?.data ?? []).map((c:any)=>({...c, id:+c.id}));
      },
      error: () => Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load initial data.' })
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSourceTypeChanged(): void {
    this.sourceId = null;
    this.lines = [];
    this.total = 0;
  }

  loadSourceLines(): void {
    if (!this.sourceId) return;

    this.api.sourceLines(this.sourceType, this.sourceId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          const rows = Array.isArray(res?.data) ? res.data : [];
          this.lines = rows.map(r => ({
            sourceLineId: r.sourceLineId,
            itemId: r.itemId,
            itemName: r.itemName,
            uom: r.uomName,
            qty: r.qtyOpen,
            unitPrice: r.unitPrice,
            discountPct: r.discountPct ?? 0,
            taxCodeId: r.taxCodeId ?? null,
            currencyId: r.defaultCurrencyId ?? this.headerCurrencyId ?? null
          }));
          this.recalc();
        },
        error: () => {
          Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load source lines.' });
        }
      });
  }

  lineAmount(r: SiCreateLine): number {
    const q = Number(r.qty || 0);
    const p = Number(r.unitPrice || 0);
    const d = Number(r.discountPct || 0);
    return +(q * p * (1 - d / 100)).toFixed(2);
  }

  recalc(): void {
    this.total = this.lines.reduce((s, r) => s + this.lineAmount(r), 0);
  }

  removeLine(ix: number): void {
    this.lines.splice(ix, 1);
    this.recalc();
  }

  save(): void {
    if (!this.sourceId || this.lines.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Missing data', text: 'Select a source and have at least one line.' });
      return;
    }

    const req: SiCreateRequest = {
      sourceType: this.sourceType,
      soId: this.sourceType === 1 ? this.sourceId : null,
      doId: this.sourceType === 2 ? this.sourceId : null,
      invoiceDate: this.invoiceDate,
      currencyId: this.headerCurrencyId,
      lines: this.lines.map(l => ({
        sourceLineId: l.sourceLineId ?? null,
        itemId: l.itemId,
        itemName: l.itemName ?? null,
        uom: l.uom ?? null,
        qty: Number(l.qty || 0),
        unitPrice: Number(l.unitPrice || 0),
        discountPct: Number(l.discountPct || 0),
        taxCodeId: l.taxCodeId ?? null,
        currencyId: l.currencyId ?? this.headerCurrencyId ?? null
      }))
    };

    this.api.create(req)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          if (res?.isSuccess) {
            Swal.fire({ icon: 'success', title: 'Created', text: `Invoice #${res.data} created successfully` });
            this.onSourceTypeChanged();
          } else {
            Swal.fire({ icon: 'error', title: 'Error', text: res?.message || 'Failed to create' });
          }
        },
        error: () => {
          Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to create invoice.' });
        }
      });
  }
}
