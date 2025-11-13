// credit-note-create.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { CreditNoteService, CnHeader, CnLine, } from '../return-creditcreate/return-credit.service';
import { DeliveryOrderService } from '../deliveryorder/deliveryorder.service';
import { TaxCodeService } from 'app/main/master/taxcode/taxcode.service';
import { StockIssueService } from 'app/main/master/stock-issue/stock-issue.service';
import { CustomerMasterService } from 'app/main/businessPartners/customer-master/customer-master.service';

type ApiResponse<T> = { isSuccess: boolean; message: string; data: T };
type DoItem = {
  doLineId: number;
  itemId: number;
  itemName: string;
  uom?: string | null;
  deliveredQty: number;
  unitPrice: number;
  discountPct: number;
  taxCodeId?: number | null;
  warehouseId: number;
  supplierId: number;
  binId: number;
};

@Component({
  selector: 'app-return-creditcreate',
  templateUrl: './return-creditcreate.component.html',
  styleUrls: ['./return-creditcreate.component.scss']
})
export class ReturnCreditcreateComponent implements OnInit {

  private destroy$ = new Subject<void>();

  isEdit = false;
  cnId: number | null = null;
  cnNo: string | null = null;

  doList: any[] = [];
  taxCodes: any[] = [];
  reasons: any[] = [];        // bind to CreditNoteReason
  dispositions = [
    { id: 1, name: 'RESTOCK' },
    { id: 2, name: 'SCRAP' },
  ];

  // header fields
  doId: number | null = null;
  doNumber: string | null = null;
  siId: number | null = null;
  siNumber: string | null = null;
  customerId: number | null = null;
  customerName: string | null = null;
  creditNoteDate: string = new Date().toISOString().slice(0, 10);
  status: number = 1;

  // lines
  lines: CnLine[] = [];
  subtotal = 0;

  trackByLine = (_: number, r: CnLine) => r?.id ?? r?.doLineId ?? r?.itemId ?? _;
  customers: any;
  doPool: DoItem[] = [];
  availableItems: DoItem[] = [];

  constructor(
    private api: CreditNoteService,
    private router: Router,
    private route: ActivatedRoute,
    private doSvc: DeliveryOrderService,
    private taxCodeService: TaxCodeService,
    private StockissueService: StockIssueService,
    private _customerMasterService: CustomerMasterService,
  ) { }

  ngOnInit(): void {
    debugger
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(pm => {
      const idStr = pm.get('id');
      this.isEdit = !!idStr;
      this.cnId = idStr ? +idStr : null;

      forkJoin({
        doList: this.doSvc.getAll(),
        taxCodes: this.taxCodeService.getTaxCode(),
        reasons: this.StockissueService.getAllStockissue(),
        customer: this._customerMasterService.GetAllCustomerDetails()
      })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (bag: any) => {
            this.doList = bag?.doList ?? [];
            this.taxCodes = (bag?.taxCodes?.data ?? []).map((t: any) => ({ id: +t.id, taxName: t.taxName ?? t.name ?? `#${t.id}` }));
            this.reasons = (bag?.reasons?.data ?? []);
            this.customers = (bag?.customer?.data ?? []);
            if (this.isEdit && this.cnId) this.loadForEdit(this.cnId);
          },
          error: _ => Swal.fire({ icon: 'error', title: 'Load failed', text: 'Init data' })
        });
    });
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  private refreshAvailable() {
    const used = new Set(
      this.lines
        .filter(x => x?.doLineId != null)
        .map(x => `${x.doLineId}|${x.itemId}|${x.warehouseId}|${x.supplierId}|${x.binId ?? 'null'}`)
    );

    this.availableItems = this.doPool.filter(p =>
      !used.has(`${p.doLineId}|${p.itemId}|${p.warehouseId}|${p.supplierId}|${p.binId ?? 'null'}`)
    );
  }



  private loadForEdit(id: number) {
    this.api.getCreditNoteById(id).subscribe({
      next: (res: any) => {
        const data = res?.data;
        if (!data) return;
        this.cnNo = data.creditNoteNo;
        this.doId = data.doId;
        this.doNumber = data.doNumber;
        this.siId = data.siId,
          this.siNumber = data.siNumber;
        this.customerId = data.customerId;
        this.customerName = data.customerName;
        this.creditNoteDate = this.toDateInput(data.creditNoteDate);
        this.status = data.status ?? 1;

        this.lines = (data.lines ?? []).map((l: any) => ({
          id: l.id,
          creditNoteId: l.creditNoteId,
          doLineId: l.doLineId,
          siId: l.siId,
          itemId: l.itemId,
          itemName: l.itemName,
          uom: l.uom,
          deliveredQty: +l.deliveredQty,
          returnedQty: +l.returnedQty,
          unitPrice: +l.unitPrice,
          discountPct: +l.discountPct,
          taxCodeId: l.taxCodeId,
          lineNet: +l.lineNet,
          reasonId: l.reasonId,
          restockDispositionId: l.restockDispositionId,
          warehouseId: l.warehouseId,
          supplierId: l.supplierId,
          binId: l.binId
        }));
        this.recalcAll();
      }
    });
  }

  private toDateInput(v: any) {
    if (!v) return this.today();

    // Parse 'YYYY-MM-DD' as local date; otherwise fall back to Date(...)
    const d = typeof v === 'string'
      ? this.parseLocalYmd(v)
      : new Date(v);

    if (isNaN(d.getTime())) return this.today();
    return this.formatYmdLocal(d);
  }

  private parseLocalYmd(s: string): Date {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s);
  }

  private formatYmdLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private today(): string {
    return this.formatYmdLocal(new Date());
  }
  onDoChanged() {
    const row = this.doList.find(d => +d.id === +this.doId!);
    if (!row) { this.clearHeaderFromDo(); return; }

    // header bindings
    this.doNumber = row.doNumber ?? row.DoNumber ?? '';
    this.siNumber = row.siNumber ?? row.invoiceNo ?? row.SiNumber ?? '';
    this.siId = row.siId
    this.customerId = row.customerId;
    this.customerName = this.customers?.find(c => c.customerId == this.customerId)?.customerName ?? '';


    // load DO lines -> only to the "pool", NOT table
    this.api.getLines(this.doId, this.isEdit ? this.cnId : null).subscribe({
      next: (res: any) => {
        const raw = Array.isArray(res) ? res : [];
        this.doPool = raw.map((r: any) => ({
          doLineId: r.DoLineId ?? r.id ?? 0,
          itemId: +r.ItemId,
          itemName: r.ItemName,
          uom: r.Uom ?? 'Pieces',
          deliveredQty: +(
            r.QtyRemaining   // ✅ use remaining from API
            ?? r.QtyDelivered // fallback if you call old API
            ?? r.qty
            ?? 0
          ),
          unitPrice: +(r.UnitPrice ?? 0),
          discountPct: +(r.DiscountPct ?? 0),
          taxCodeId: r.TaxCodeId ?? null,
          warehouseId: r.WarehouseId ?? null,
          supplierId: r.SupplierId ?? null,
          binId: r.BinId ?? null
        })) as DoItem[];

        this.lines = [];
        this.subtotal = 0;
        this.refreshAvailable();
      },
      error: _ => Swal.fire({ icon: 'error', title: 'Failed', text: 'Load DO lines' })
    });

  }


  private clearHeaderFromDo() {
    this.doNumber = null; this.siNumber = null;
    this.customerId = null; this.customerName = null;

  }

  addLine() {
    // blank row waiting for item selection from the restricted list
    this.lines.push({
      doLineId: null as any,
      siId: 0,
      itemId: 0,
      itemName: '',
      uom: null,
      deliveredQty: 0,
      returnedQty: 0,
      unitPrice: 0,
      discountPct: 0,
      taxCodeId: null,
      lineNet: 0,
      reasonId: null,
      restockDispositionId: 1,
      warehouseId: 0,
      supplierId: 0,
      binId: 0
    });
    this.refreshAvailable();
  }
  onItemPicked(ix: number, pickedItemId: number | null) {
    const row = this.lines[ix]; if (!row) return;

    if (!pickedItemId) { /* clear row… */ return; }

    const src = this.doPool.find(p => +p.itemId === +pickedItemId);
    if (!src) return;

    row.doLineId = src.doLineId;
    row.itemId = src.itemId;
    row.itemName = src.itemName;
    row.uom = src.uom ?? 'Pieces';
    row.deliveredQty = src.deliveredQty;   // ✅ remaining
    row.returnedQty = 0;
    row.unitPrice = src.unitPrice;
    row.discountPct = src.discountPct ?? 0;
    row.taxCodeId = src.taxCodeId ?? null;

    // carry keys (needed for stock update logic)
    row.warehouseId = src.warehouseId ?? null;
    row.supplierId = src.supplierId ?? null;
    row.binId = src.binId ?? null;

    this.refreshAvailable();
    this.recalc(ix);
  }



  removeLine(ix: number) {
    const removed = this.lines[ix];
    this.lines.splice(ix, 1);   // just drop from UI
    this.refreshAvailable();    // put that item back into the dropdown
    this.recalcAll();           // update subtotal
  }

  recalc(i: number) {
    debugger
    const r = this.lines[i];
    const qty = Math.max(0, +r.returnedQty || 0);
    // cap returned <= delivered
    r.returnedQty = qty > r.deliveredQty ? r.deliveredQty : qty;
    const net = (+r.unitPrice || 0) * r.returnedQty * (1 - (+r.discountPct || 0) / 100);
    r.lineNet = +net.toFixed(2);
    this.subtotal = +this.lines.reduce((s, x) => s + (+x.lineNet || 0), 0).toFixed(2);
  }

  private recalcAll() {
    this.lines.forEach((_, i) => this.recalc(i));
  }

  save(status) {
    this.status = status
    debugger
    if (!this.creditNoteDate) { Swal.fire({ icon: 'warning', title: 'Credit note date required' }); return; }
    if (!this.doId) { Swal.fire({ icon: 'warning', title: 'Select a Delivery Order' }); return; }
    if (this.lines.length === 0) { Swal.fire({ icon: 'warning', title: 'Add at least one line' }); return; }

    const payload: CnHeader = {
      ...(this.isEdit && this.cnId ? { id: this.cnId } : {}),
      doId: this.doId,
      doNumber: this.doNumber ?? null,
      siId: this.siId,
      siNumber: this.siNumber ?? null,
      customerId: this.customerId ?? null,
      customerName: this.customerName ?? null,
      creditNoteDate: this.creditNoteDate,
      status: this.status,
      subtotal: this.subtotal,
      lines: this.lines.map(l => ({
        id: l.id ? l.id : 0,
        doLineId: l.doLineId ?? null,
        siId: l.siId,
        itemId: l.itemId,
        itemName: l.itemName,
        uom: l.uom ?? null,
        deliveredQty: +l.deliveredQty,
        returnedQty: +l.returnedQty,
        unitPrice: +l.unitPrice,
        discountPct: +l.discountPct,
        taxCodeId: l.taxCodeId ?? null,
        lineNet: +l.lineNet,
        reasonId: l.reasonId ?? null,
        restockDispositionId: l.restockDispositionId ?? 1,
        warehouseId: l.warehouseId,
        supplierId: l.supplierId,
        binId: l.binId
      }))
    };

    if (!this.isEdit) {
      this.api.insertCreditNote(payload).subscribe({
        next: (res: any) => {
          if (res?.isSuccess) { Swal.fire({ icon: 'success', title: 'Created', text: `CN #${res.data}` }); this.router.navigate(['/Sales/Return-credit-list']); }
          else Swal.fire({ icon: 'error', title: 'Create failed', text: res?.message || '' });
        },
        error: _ => Swal.fire({ icon: 'error', title: 'Create failed' })
      });
    } else if (this.cnId) {
      this.api.updateCreditNote(payload).subscribe({
        next: (r: any) => {
          if (r?.isSuccess) { Swal.fire({ icon: 'success', title: 'Header updated' }); this.router.navigate(['/Sales/Return-credit-list']); }
          else Swal.fire({ icon: 'error', title: 'Update failed', text: r?.message || '' });
        },
        error: _ => Swal.fire({ icon: 'error', title: 'Update failed' })
      });
    }
  }

  goList() { this.router.navigate(['/Sales/Return-credit-list']); }

}




