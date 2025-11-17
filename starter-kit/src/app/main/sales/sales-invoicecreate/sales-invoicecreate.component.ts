// sales-invoicecreate.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import Swal from 'sweetalert2';

import {
  SalesInvoiceService,
  SiCreateLine,
  SiCreateRequest,
  SiSourceType,
  ApiResponse
} from './sales-invoice.service';

import { TaxCodeService } from 'app/main/master/taxcode/taxcode.service';
import { SalesOrderService } from '../sales-order/sales-order.service';
import { DeliveryOrderService } from '../deliveryorder/deliveryorder.service';
import { ItemsService } from 'app/main/master/items/items.service';

/* ========== Local UI types ========== */
interface SimpleItem {
  id: number;
  itemName: string;
  itemCode: string;
  uomName: string;
  uomId: number;
  catagoryName?: string;
}

// SiCreateLine already has qty, unitPrice, discountPct, gstPct, tax, taxCodeId, lineAmount etc.
type UiLine = SiCreateLine & {
  id?: number;             // server line id (edit mode)
  itemName: string;        // label for UI
  uom?: string | null;     // display UOM
  __new?: boolean;         // unsaved line in edit mode
};

@Component({
  selector: 'app-sales-invoicecreate',
  templateUrl: './sales-invoicecreate.component.html',
  styleUrls: ['./sales-invoicecreate.component.scss']
})
export class SalesInvoicecreateComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // ----- Edit state -----
  isEdit = false;
  siId: number | null = null;
  invoiceNo: string | null = null;

  // ----- UI helpers -----
  sourceTypeOptions = [
    { value: 1 as SiSourceType, label: 'From SO' },
    { value: 2 as SiSourceType, label: 'From DO' }
  ];
  trackById = (_: number, x: any) => x?.id ?? _;
  compareById = (a: any, b: any) => (a != null && b != null ? +a === +b : a === b);
  trackByLine = (idx: number, row: any) => row?.id ?? row?.sourceLineId ?? row?.itemId ?? idx;

  // ----- Header -----
  sourceType: SiSourceType = 1;
  sourceId: number | null = null;
  invoiceDate = new Date().toISOString().slice(0, 10); // yyyy-MM-dd

  // ----- Dropdown data -----
  soList: any[] = [];
  doList: any[] = [];
  taxCodes: any[] = [];
  itemsList: SimpleItem[] = [];

  // ----- Lines & totals -----
  lines: UiLine[] = [];
  total = 0;

  constructor(
    private api: SalesInvoiceService,
    private taxCodeService: TaxCodeService,
    private soSrv: SalesOrderService,
    private doSrv: DeliveryOrderService,
    private itemsService: ItemsService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  // ============================================================
  // Lifecycle
  // ============================================================
  ngOnInit(): void {
    // Handle create -> edit navigation and re-load
    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(pm => {
        const idStr = pm.get('id');
        this.isEdit = !!idStr;
        this.siId = idStr ? +idStr : null;

        // Load static lookups
        forkJoin({
          taxCodes: this.taxCodeService.getTaxCode(),
          soList: this.soSrv.getSOByStatus(3),
          doList: this.doSrv.getAll()
        })
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (bag: any) => {
              this.taxCodes = Array.isArray(bag?.taxCodes?.data) ? bag.taxCodes.data : [];
              this.soList = Array.isArray(bag?.soList?.data) ? bag.soList.data : [];

              const doRaw = Array.isArray(bag?.doList) ? bag.doList : [];
              this.doList = doRaw.map((d: any) => ({
                ...d,
                id: +d.id,
                doNumber: d.doNumber ?? d.DoNumber ?? ''
              }));

              // Load items for labels/UOM
              this.itemsService.getAllItem()
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                  next: (ires: any) => {
                    const raw = ires?.data ?? [];
                    this.itemsList = raw.map((item: any) => ({
                      id: Number(item.id ?? item.itemId ?? 0),
                      itemName: item.itemName ?? item.name ?? '',
                      itemCode: item.itemCode ?? '',
                      uomName: item.uomName ?? item.uom ?? '',
                      uomId: Number(item.uomId ?? item.UomId ?? item.uomid ?? 0),
                      catagoryName: item.catagoryName
                    }) as SimpleItem);

                    if (this.isEdit && this.siId) {
                      this.loadForEdit(this.siId);
                    } else {
                      this.resetForCreate();
                    }
                  },
                  error: () => Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load items.' })
                });
            },
            error: () => Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load initial data.' })
          });
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================================
  // Helpers
  // ============================================================
  private toDateInput(val: string | Date | null): string {
    if (!val) return new Date().toISOString().slice(0, 10);
    const d = typeof val === 'string' ? new Date(val) : val;
    return isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
  }

  private resetForCreate() {
    this.sourceType = 1;
    this.sourceId = null;
    this.invoiceDate = new Date().toISOString().slice(0, 10);
    this.lines = [];
    this.total = 0;
  }

  private isOk(res: any) { return res?.isSuccess ?? res?.success; }

  // ============================================================
  // Tax helper – EXCLUSIVE / INCLUSIVE / EXEMPT
  // ============================================================
  private calcLineAmounts(line: UiLine) {
    const qty  = Number(line.qty || 0);
    const price = Number(line.unitPrice || 0);
    const disc  = Number(line.discountPct || 0);
    const gst   = Number(line.gstPct || 0);

    const mode = (line.tax || 'EXCLUSIVE').toString().toUpperCase();
    const baseAfterDisc = +(qty * price * (1 - disc / 100)).toFixed(2);

    let net   = baseAfterDisc;
    let tax   = 0;
    let gross = baseAfterDisc;

    // EXEMPT or 0% GST -> no tax
    if (!gst || mode === 'EXEMPT') {
      tax = 0;
      gross = net;
    }
    // EXCLUSIVE: price is without GST
    else if (mode === 'EXCLUSIVE') {
      tax   = +(net * gst / 100).toFixed(2);
      gross = +(net + tax).toFixed(2);
    }
    // INCLUSIVE: price already includes GST
    else if (mode === 'INCLUSIVE') {
      gross = baseAfterDisc;
      net   = +(gross * 100 / (100 + gst)).toFixed(2);
      tax   = +(gross - net).toFixed(2);
    }

    // keep on line for UI / save
    line.lineAmount = gross;
    (line as any).taxAmount = tax;

    return { net, tax, gross };
  }

  // ============================================================
  // Load for Edit
  // ============================================================
  private loadForEdit(id: number) {
    this.api.get(id).subscribe({
      next: (res: ApiResponse) => {
        if (!this.isOk(res)) {
          Swal.fire({ icon: 'error', title: 'Error', text: res?.message || 'Failed to load invoice.' });
          return;
        }
        const data = res.data || {};
        const hdr  = data.header || {};
        const rows = data.lines  || [];

        this.invoiceNo   = hdr.invoiceNo || null;
        this.invoiceDate = this.toDateInput(hdr.invoiceDate);
        this.sourceType  = (hdr.sourceType ?? 1) as 1 | 2;
        this.sourceId    = this.sourceType === 1 ? (hdr.soId ?? null) : (hdr.doId ?? null);

        this.lines = (rows as any[]).map(r => ({
          id: Number(r.id ?? 0),
          sourceLineId: r.sourceLineId ?? null,
          itemId: r.itemId ?? null,
          itemName: r.itemName ?? '',
          uom: r.uom ?? null,
          qty: Number(r.qty || 0),
          unitPrice: Number(r.unitPrice || 0),
          discountPct: Number(r.discountPct || 0),
          gstPct: r.gstPct,
          tax: r.tax,
          taxCodeId: r.taxCodeId ?? null,
          lineAmount: r.lineAmount,
          description: r.description ?? r.itemName ?? ''
        })) as UiLine[];

        this.reconcileLinesWithItems();
        this.recalc();
      },
      error: () => Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load invoice.' })
    });
  }

  // ============================================================
  // Header controls
  // ============================================================
  onSourceTypeChanged(): void {
    if (this.isEdit) return; // Lock source in edit
    this.sourceId = null;
    this.lines = [];
    this.total = 0;
  }

  // ============================================================
  // Items / lines helpers
  // ============================================================
  private reconcileLinesWithItems() {
    if (!this.itemsList?.length || !this.lines?.length) return;
    this.lines = this.lines.map(l => {
      const it = this.itemsList.find(ii => +ii.id === +l.itemId!);
      const prevName = l.itemName || '';
      const newItemName = it?.itemName ?? l.itemName;

      const shouldOverwriteDesc =
        !l.description ||
        l.description.trim().toLowerCase() === prevName.trim().toLowerCase();

      return {
        ...l,
        itemName: newItemName ?? l.itemName,
        uom: it?.uomName ?? l.uom ?? null,
        description: shouldOverwriteDesc ? (newItemName ?? l.itemName ?? '') : l.description
      };
    });
  }

  addLine() {
    const row: UiLine = {
      sourceLineId: null,
      itemId: 0,
      itemName: '',
      uom: null,
      qty: null as any,
      unitPrice: 0,
      discountPct: 0,
      gstPct: 0,
      tax: 'EXCLUSIVE',
      taxCodeId: null,
      description: '',
      lineAmount: 0
    };
    if (this.isEdit) row.__new = true;
    this.lines.push(row);
    this.recalc();
  }

  onItemChanged(index: number, itemId: number | null) {
    const line = this.lines[index];
    if (!line) return;

    const prevName = line.itemName || '';
    if (!itemId) {
      line.itemId = 0;
      line.itemName = '';
      line.uom = null;
      this.recalc();
      return;
    }

    const it = this.itemsList.find(x => +x.id === +itemId);
    line.itemId = +itemId;
    line.itemName = it?.itemName ?? line.itemName ?? '';
    line.uom = it?.uomName ?? line.uom ?? null;

    if (!line.description || line.description.trim().toLowerCase() === prevName.trim().toLowerCase()) {
      line.description = line.itemName;
    }

    this.recalc();
  }

  // Create mode: load from SO/DO open lines
  loadSourceLines(): void {
    if (this.isEdit) return;
    if (!this.sourceId) return;

    this.api.sourceLines(this.sourceType, this.sourceId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: ApiResponse) => {
          if (!this.isOk(res)) {
            Swal.fire({ icon: 'error', title: 'Error', text: res?.message || 'Failed to load source lines.' });
            return;
          }
          const rows = Array.isArray(res.data) ? res.data : [];
          this.lines = rows.map((r: any) => ({
            sourceLineId: r.sourceLineId,
            itemId: r.itemId,
            itemName: r.itemName,
            uom: r.uomName ?? null,
            qty: r.qtyOpen,
            unitPrice: r.unitPrice,
            discountPct: r.discountPct ?? 0,
            gstPct: r.gstPct,
            tax: r.tax,
            taxCodeId: r.taxCodeId ?? null,
            description: r.itemName
          })) as UiLine[];

          this.reconcileLinesWithItems();
          this.recalc();
        },
        error: () => Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load source lines.' })
      });
  }

  // ============================================================
  // Totals
  // ============================================================
  lineAmount(r: SiCreateLine): number {
    return this.calcLineAmounts(r as UiLine).gross;
  }

  lineTaxAmount(r: SiCreateLine): number {
    return this.calcLineAmounts(r as UiLine).tax;
  }

  recalc(): void {
    this.total = this.lines.reduce((s, r) => s + this.lineAmount(r), 0);
  }

  // ============================================================
  // Edit: persist lines in place
  // ============================================================
  onCellChanged(line: UiLine) {
    const { gross, tax } = this.calcLineAmounts(line);
    const qty   = Number(line.qty || 0);
    const price = Number(line.unitPrice || 0);
    const disc  = Number(line.discountPct || 0);

    if (!this.isEdit || !line?.id) {
      this.recalc();
      return;
    }

    this.api.updateLine(line.id, {
      qty,
      unitPrice: price,
      discountPct: disc,
      gstPct: line.gstPct,
      tax: line.tax,
      // taxAmount: tax,
      taxCodeId: line.taxCodeId ?? null,
      lineAmount: gross,
      description:
        (line.description && line.description.trim().length > 0)
          ? line.description
          : (line.itemName ?? null)
    }).subscribe({
      next: (r) => {
        if (!this.isOk(r)) {
          Swal.fire({
            icon: 'warning',
            title: 'Line update failed',
            text: (r as any)?.message || ''
          });
        }
        this.recalc();
      },
      error: () => {
        Swal.fire({
          icon: 'error',
          title: 'Failed to update line'
        });
        this.recalc();
      }
    });
  }

  saveNewLines(): void {
    if (!this.isEdit || !this.siId) {
      return;
    }

    const pending = this.lines.filter(l => l.__new && Number(l.qty || 0) > 0);
    if (!pending.length) {
      Swal.fire({ icon: 'info', title: 'Nothing to add' });
      return;
    }

    let i = 0;
    let ok = 0;
    let fail = 0;

    const next = () => {
      if (i >= pending.length) {
        Swal.fire({
          icon: fail ? 'warning' : 'success',
          title: fail ? 'Partial' : 'Lines added',
          text: `${ok} added${fail ? `, ${fail} failed` : ''}`
        });

        if (this.siId) {
          this.loadForEdit(this.siId);
        }
        return;
      }

      const l = pending[i++];
      const { gross, tax } = this.calcLineAmounts(l);

      const qty   = Number(l.qty || 0);
      const price = Number(l.unitPrice || 0);
      const disc  = Number(l.discountPct || 0);

      this.api.addLine(this.siId!, {
        sourceLineId: l.sourceLineId ?? null,
        itemId: l.itemId ?? null,
        itemName: l.itemName ?? null,
        uom: l.uom ?? null,
        qty,
        unitPrice: price,
        discountPct: disc,
        gstPct: l.gstPct,
        tax: l.tax,
        // taxAmount: tax,
        taxCodeId: l.taxCodeId ?? null,
        lineAmount: gross,
        description:
          (l.description && l.description.trim().length > 0)
            ? l.description
            : (l.itemName ?? null)
      }).subscribe({
        next: (r) => {
          if (this.isOk(r)) {
            ok++;
          } else {
            fail++;
          }
          next();
        },
        error: () => {
          fail++;
          next();
        }
      });
    };

    next();
  }

  removeLine(ix: number): void {
    const row = this.lines[ix];

    if (!this.isEdit || !row?.id) {
      this.lines.splice(ix, 1);
      this.recalc();
      return;
    }

    Swal.fire({
      icon: 'warning',
      title: 'Remove this line?',
      showCancelButton: true,
      confirmButtonText: 'Remove',
      confirmButtonColor: '#d33'
    }).then(res => {
      if (!res.isConfirmed) return;
      this.api.removeLine(row.id!).subscribe({
        next: (r) => {
          if (!this.isOk(r)) {
            Swal.fire({ icon: 'error', title: 'Failed', text: (r as any)?.message || 'Remove failed' });
            return;
          }
          this.lines.splice(ix, 1);
          this.recalc();
        },
        error: () => Swal.fire({ icon: 'error', title: 'Failed to remove line' })
      });
    });
  }

  // ============================================================
  // Save
  // ============================================================
  save(): void {
    if (!this.invoiceDate) {
      Swal.fire({ icon: 'warning', title: 'Invoice Date is required' });
      return;
    }

    // CREATE
    if (!this.isEdit) {
      if (!this.sourceId || this.lines.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Missing data', text: 'Select a source and add at least one line.' });
        return;
      }

      const req: SiCreateRequest = {
        sourceType: this.sourceType,
        soId: this.sourceType === 1 ? this.sourceId : null,
        doId: this.sourceType === 2 ? this.sourceId : null,
        invoiceDate: this.invoiceDate,
        total: this.total,
        lines: this.lines.map(l => {
          const { gross, tax } = this.calcLineAmounts(l);

          return {
            sourceLineId: l.sourceLineId ?? null,
            itemId: l.itemId ?? 0,
            itemName: l.itemName ?? null,
            uom: l.uom ?? null,
            qty: Number(l.qty || 0),
            unitPrice: Number(l.unitPrice || 0),
            discountPct: Number(l.discountPct || 0),
            gstPct: l.gstPct,
            tax: l.tax,
            taxAmount: tax,
            taxCodeId: l.taxCodeId ?? null,
            lineAmount: gross,
            description:
              (l.description && l.description.trim().length > 0)
                ? l.description
                : (l.itemName ?? null)
          };
        })
      };

      this.api.create(req)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res: ApiResponse) => {
            if (this.isOk(res)) {
              Swal.fire({ icon: 'success', title: 'Created', text: `Invoice #${res.data} created successfully` });
              this.router.navigate(['/Sales/Sales-Invoice-list']);
            } else {
              Swal.fire({ icon: 'error', title: 'Error', text: (res as any)?.message || 'Failed to create' });
            }
          },
          error: () => Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to create invoice.' })
        });
      return;
    }

    // EDIT: update only header date
    if (!this.siId) return;

    this.api.updateHeader(this.siId, { invoiceDate: this.invoiceDate })
      .subscribe({
        next: (r) => {
          if (this.isOk(r)) Swal.fire({ icon: 'success', title: 'Header updated' });
          else Swal.fire({ icon: 'error', title: 'Update failed', text: (r as any)?.message || '' });
        },
        error: () => Swal.fire({ icon: 'error', title: 'Failed to update header' })
      });
  }
    netPortion(line: UiLine): number {
    const total = this.lineAmount(line);         // already after discount
    const gst = Number(line.gstPct || 0);

    if (!gst) {
      return total; // no GST => whole amount is net
    }

    const base = total / (1 + gst / 100);        // reverse‐calculate net
    return +base.toFixed(2);
  }

  taxPortion(line: UiLine): number {
    const total = this.lineAmount(line);
    const base  = this.netPortion(line);
    const tax   = total - base;
    return +tax.toFixed(2);
  }

  // ============================================================
  // Navigation
  // ============================================================
  goSIList() { this.router.navigate(['/Sales/Sales-Invoice-list']); }
}
