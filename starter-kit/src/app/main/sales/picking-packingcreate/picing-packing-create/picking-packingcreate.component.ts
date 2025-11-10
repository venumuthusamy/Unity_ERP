import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, Observable } from 'rxjs';
import { PackingService } from '../picking-packing.service';
import { SalesOrderService } from '../../sales-order/sales-order.service';

type Row = {
  id: number;
  pickId: number;
  soLineId: number;
  itemId: number;
  sku: string;
  itemName: string;
  warehouseId: number;
  warehousName?: string;
  supplierId: number;
  supplierName: string;
  binId: number;
  bin?: string | null;
  deliverQty: number;
  cartonId?: number | null;
};

type SoLite = {
  id: number;
  number?: string;
  QuotationNumber?: string;
  customerName: string;
  soDate?: string;
  lineItems?: Row[];
};

type Carton = { id: number; name: string };

type SoHdr = {
  id?: number;
  QuotationNumber?: string;
  customerName?: string;
  soDate?: string;
  lineItems?: Row[];

  // codes (unchanged names)
  barCode?: string | null;
  qrCode?: string | null;
  barCodeSrc?: string | null;  // base64 or data-url if API ever sends here
  qrCodeSrc?: string | null;   // base64 or data-url if API ever sends here
};

type CodesResp = {
  barCode?: string | null;
  qrCode?: string | null;
  qrText?: string | null;
  barCodeSrcBase64?: string | null;
  qrCodeSrcBase64?: string | null;
};


@Component({
  selector: 'app-picking-packingcreate',
  templateUrl: './picking-packingcreate.component.html',
  styleUrls: ['./picking-packingcreate.component.scss']
})
export class PickingPackingcreateComponent implements OnInit {
  // -------- Header / dropdown ----------
  soList: SoLite[] = [];
  selectedSoId: number | null = null;
  soHdr: SoHdr | null = null;

  // -------- Grid ----------
  rows: Row[] = [];
  totalDeliverQty = 0;

  // Code images
  barCodeSrc: string = '';
  qrCodeSrc: string = '';

  // Cartons
  cartonOptions: Carton[] = [
    { id: 1, name: 'Carton 1' },
    { id: 2, name: 'Carton 2' },
    { id: 3, name: 'Carton 3' }
  ];

  constructor(
    private salesOrderService: SalesOrderService,
    private packingService: PackingService,
    private router: Router,
  ) { }

  ngOnInit(): void {
    this.salesOrderService.getSO().subscribe({
      next: (res: any) => {
        const items = res?.data ?? [];   // <-- use data from the wrapper
        this.soList = items.map((s: any) => ({
          ...s,
          number: s.number ?? s.QuotationNumber
        }));
      },
      error: err => {
        console.error('Failed to load SO list', err);
        this.soList = [];
      }
    });
  }

  // ------- helpers -------
  private normalizeHdr(hdr: any): any {
    // Some APIs return array; convert to object safely
    if (Array.isArray(hdr)) return hdr[0] ?? {};
    return hdr ?? {};
  }

  private pickLines(hdr: any): Row[] {
    const obj = this.normalizeHdr(hdr);
    const lines: Row[] = (obj?.lines ?? obj?.lineItems ?? []) as Row[];

    // Normalize only what template expects
    return lines.map((m: any) => ({
      ...m,
      warehouseName: m.warehouseName ?? m.warehousName,
      pickBin: m.pickBin ?? m.bin ?? null
    }));
  }
  // ------- UI events -------
  onSoChanged(soId: number | null) {
    debugger
    this.rows = [];
    this.totalDeliverQty = 0;
    this.soHdr = null;
    this.barCodeSrc = '';
    this.qrCodeSrc = '';
    if (!soId) return;

    // make the streams explicit and typed
    const hdr$: Observable<any> = this.salesOrderService.getSOById(soId) as unknown as Observable<any>;
    const codes$: Observable<CodesResp> = this.packingService.getPackingCodes(soId) as unknown as Observable<CodesResp>;

    forkJoin({ hdr: hdr$, codes: codes$ }).subscribe({
      next: ({ hdr, codes }) => {
        const hdrPayload = (hdr as any)?.data ?? hdr;
        const H: any = Array.isArray(hdrPayload) ? (hdrPayload[0] ?? {}) : (hdrPayload ?? {});
        const lines = this.pickLines(H);

        this.soHdr = { ...H, lineItems: lines, barCode: codes?.barCode ?? null, qrCode: codes?.qrText ?? null };

        // show images
        this.barCodeSrc = codes?.barCodeSrcBase64 ?? '';
        this.qrCodeSrc = codes?.qrCodeSrcBase64 ?? '';

        const fallback = this.soList.find(s => s.id === this.selectedSoId)?.lineItems ?? [];
        this.rows = (lines?.length ? lines : (fallback ?? [])) as Row[];
        this.recalcTotals();
      },
      error: err => {
        console.error('Failed to load SO details/codes', err);
        this.soHdr = null;
      }
    });

  }

  recalcTotals() {
    this.totalDeliverQty = (this.rows ?? []).reduce((sum, r) => sum + (+r.deliverQty || 0), 0);
  }

  hasAnyDeliverQty(): boolean {
    return (this.rows ?? []).some(r => (r.deliverQty ?? 0) > 0);
  }

  trackByLine = (_: number, r: Row) => r.id;

  // Header actions
  cancelForm() {
    this.router.navigate(['/Sales/Sales-Order-list']);
  }

  // Save / Generate DO
  saveDo() {
    if (!this.selectedSoId || !this.hasAnyDeliverQty()) return;

    const payload = {
      soId: this.selectedSoId,
      lines: this.rows
        .filter(r => (r.deliverQty ?? 0) > 0)
        .map(r => ({
          soLineId: r.id,
          itemId: r.itemId,
          warehouseId: r.warehouseId,
          warehousName: r.warehousName,
          supplierId: r.supplierId,
          supplierName: r.supplierName,
          bin: r.binId,
          qty: r.deliverQty,
          cartonId: r.cartonId ?? null
        }))
    };

    // this.packingService.generateDo(payload).subscribe(...)
  }

  DownloadPickingList() {
    // this.packingService.downloadPickList(this.selectedSoId!).subscribe(...)
  }
}
