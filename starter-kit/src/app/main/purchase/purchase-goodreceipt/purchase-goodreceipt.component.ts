import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import Swal from 'sweetalert2';
import SignaturePad from 'signature_pad';
import { forkJoin, of } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';

import { PurchaseGoodreceiptService } from './purchase-goodreceipt.service';
import { FlagissueService } from 'app/main/master/flagissue/flagissue.service';
import { SupplierService } from 'app/main/businessPartners/supplier/supplier.service';
import { POService } from '../purchase-order/purchase-order.service';

export interface LineRow {
  // Read-only from PO
  itemText: string;
  itemCode: string;
  supplierId: number | null;
  supplierName: string;

  // Editable in GRN
  storageType: string;
  surfaceTemp: string;
  expiry: string;
  pestSign: string;
  drySpillage: string;
  odor: string;
  plateNumber: string;
  defectLabels: string;
  damagedPackage: string;
  time: string;
  initial: string;  // dataURL of image/signature
  remarks: string;

  // Meta
  createdAt: Date;
  photos: string[];
}

// Structure for fetched GRN summary
interface GeneratedGRN {
  id: number;
  grnNo: string;
  poid: number;
   poNo?: string;
  grnJson: any[];  // array of row data
}

@Component({
  selector: 'app-purchase-goodreceipt',
  templateUrl: './purchase-goodreceipt.component.html',
  styleUrls: ['./purchase-goodreceipt.component.scss']
})
export class PurchaseGoodreceiptComponent implements OnInit {
  hover = false;

  /* -------- Modal state -------- */
  showInitialModal = false;
  activeTab: 'image' | 'signature' = 'image';
  uploadedImage: string | ArrayBuffer | null = null;
  selectedRowIndex: number | null = null;

  @ViewChild('signaturePad', { static: false }) signaturePadElement!: ElementRef<HTMLCanvasElement>;
  private signaturePad?: SignaturePad;

  /* -------- Header form -------- */
  selectedPO: number | null = null;
  receiptDate = '';
  overReceiptTolerance = 0;

  /* -------- Current PO supplier -------- */
  currentSupplierId: number | null = null;
  currentSupplierName = '';

  /* -------- Table rows -------- */
  grnRows: LineRow[] = [
    {
      itemText: '',
      itemCode: '',
      supplierId: null,
      supplierName: '',
      storageType: '',
      surfaceTemp: '',
      expiry: '',
      pestSign: '',
      drySpillage: '',
      odor: '',
      plateNumber: '',
      defectLabels: '',
      damagedPackage: '',
      time: '',
      initial: '',
      remarks: '',
      createdAt: new Date(),
      photos: []
    }
  ];

  /* -------- PO list for dropdown -------- */
  purchaseOrder: Array<{ id: number; purchaseOrderNo: string; supplierId?: number; poLines?: string }> = [];

  /* -------- Extras -------- */
  flagIssuesList: any[] = [];
  isPostInventoryDisabled = false;

  /* -------- Generated GRN summary -------- */
  generatedGRN: GeneratedGRN | null = null;

  constructor(
    private purchaseGoodReceiptService: PurchaseGoodreceiptService,
    private flagIssuesService: FlagissueService,
    private purchaseorderService: POService,
    private _SupplierService: SupplierService,
    private cdRef: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // this.loadFlagIssues();
    this.loadPOs();
  }

  /* ===================== SAVE ===================== */
  saveGRN() {
    debugger
    if (!this.selectedPO) {
      alert('Please select a PO.');
      return;
    }

    const rowsForApi = this.grnRows.map(r => ({
      itemCode: r.itemCode,
      supplierId: r.supplierId,
      storageType: r.storageType,
      surfaceTemp: r.surfaceTemp,
      expiry: r.expiry,
      pestSign: r.pestSign,
      drySpillage: r.drySpillage,
      odor: r.odor,
      plateNumber: r.plateNumber,
      defectLabels: r.defectLabels,
      damagedPackage: r.damagedPackage,
      time: r.time,
      initial: r.initial,
      remarks: r.remarks
    }));

    const payload = {
      poid: this.selectedPO,
      supplierId: this.currentSupplierId,
      receptionDate: this.receiptDate ? new Date(this.receiptDate) : new Date(),
      overReceiptTolerance: this.overReceiptTolerance,
      grnJson: JSON.stringify(rowsForApi),
      flagIssuesID: 0,
      grnNo: ''
    };

    this.purchaseGoodReceiptService.createGRN(payload).subscribe({
      next: (res: any) => {
        Swal.fire({
          icon: 'success',
          title: 'Created',
          text: res?.message || 'Your purchase GoodReceipt has been created.',
          confirmButtonColor: '#0e3a4c'
        });

        const createdId = res?.data;
        if (createdId) {
          this.fetchGRNById(createdId);
        }

        // don’t immediately reset form if you want to view the summary
        // but you may clear the input sections if desired
        // this.resetForm();
      },
      error: (err) => {
        console.error('Save failed', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to create GRN. Please try again.',
          confirmButtonColor: '#0e3a4c'
        });
      }
    });
  }

  /** Fetch the saved GRN details by its ID to show the summary */
 
fetchGRNById(id: number) {
  this.purchaseGoodReceiptService.getByIdGRN(id).subscribe({
    next: (data: any) => {
      const payload = data?.data ?? data;

      let grnJsonArr: any[] = [];
      try {
        grnJsonArr = JSON.parse(payload?.grnJson ?? '[]');
      } catch {
        grnJsonArr = [];
      }

      // 1️⃣ Fetch supplier name for each row
      const supplierFetches = grnJsonArr.map((row: any) => {
        const supplierId = row?.supplierId;
        if (!supplierId) return of({ ...row, supplierName: 'Unknown' });

        return this._SupplierService.getSupplierById(supplierId).pipe(
          map((res: any) => {
            const name =
              res?.data?.name ??
              res?.data?.supplierName ??
              res?.name ??
              res?.supplierName ??
              'Unknown';
            return { ...row, supplierName: name };
          }),
          catchError(() => of({ ...row, supplierName: 'Unknown' }))
        );
      });

      // 2️⃣ Combine all fetches and wait for them to finish
      forkJoin(supplierFetches).subscribe((rowsWithNames: any[]) => {
        this.generatedGRN = {
          id: payload?.id,
          grnNo: payload?.grnNo,
          poid: payload?.poid,
          grnJson: rowsWithNames,
          poNo: ''
        };

        // 3️⃣ Load PO Number
        const poId = Number(payload?.poid);
        if (poId) {
          this.purchaseorderService.getPOById(poId).subscribe({
            next: (poRes: any) => {
              const po = poRes?.data ?? poRes;
              const poNo =
                po?.purchaseOrderNo ??
                po?.PurchaseOrderNo ??
                po?.[0]?.purchaseOrderNo ??
                po?.[0]?.PurchaseOrderNo ??
                '';

              this.generatedGRN = {
                ...this.generatedGRN,
                poNo
              };
            },
            error: (err) => console.error('Failed to load PO by id', err)
          });
        }
      });
    },
    error: (err) => console.error('Failed to fetch GRN details', err)
  });
}


  /* ================= Flag Issues ================= */
  loadFlagIssues() {
    this.flagIssuesService.getAllFlagIssue().subscribe({
      next: (data: any[]) => {
        this.flagIssuesList = (data || []).filter(x => x.isActive === true);
      },
      error: (err) => console.error('Flag issues load failed', err)
    });
  }

  /* ================= Purchase Orders ================= */
  loadPOs() {
    const anySvc: any = this.purchaseorderService as any;
    const obs$ =
      typeof this.purchaseorderService.getPO === 'function'
        ? this.purchaseorderService.getPO()
        : typeof anySvc.getAllPurchaseOrder === 'function'
          ? anySvc.getAllPurchaseOrder()
          : null;

    if (!obs$) {
      console.error('PurchaseOrderService missing getAll()/getAllPurchaseOrder()');
      return;
    }

    obs$.subscribe({
      next: (res: any) => {
        const list = Array.isArray(res?.data) ? res.data : res;
        this.purchaseOrder = (list || []).map((p: any) => ({
          id: p.id ?? p.Id,
          purchaseOrderNo: p.purchaseOrderNo ?? p.PurchaseOrderNo,
          supplierId: p.supplierId ?? p.SupplierId,
          poLines: p.poLines ?? p.PoLines
        }));
      },
      error: (err) => console.error('Error loading POs', err)
    });
  }

  onPOChange(selectedId: number | null) {
    if (!selectedId) {
      this.resetForm();
      return;
    }
    const po = this.purchaseOrder.find(p => p.id === selectedId);
    if (!po) {
      this.resetForm();
      return;
    }

    this.currentSupplierId = po.supplierId ?? null;

    this.loadSupplierById(this.currentSupplierId ?? 0).subscribe((name: string) => {
      this.currentSupplierName = name || '';
      this.buildRowsFromPo(po, this.currentSupplierId, this.currentSupplierName);
    });
  }

  /* ================= Supplier Helper ================= */
  private loadSupplierById(id: number) {
    if (!id) return of('');
    return this._SupplierService.getSupplierById(id).pipe(
      map((api: any) =>
        api?.data?.name ??
        api?.data?.supplierName ??
        api?.name ??
        api?.supplierName ??
        ''
      ),
      catchError(() => of(''))
    );
  }

  /* ================= Build rows from PO ================= */
  private buildRowsFromPo(
    po: { poLines?: string },
    supplierId: number | null,
    supplierName: string
  ) {
    let lines: any[] = [];
    try {
      lines = po.poLines ? JSON.parse(po.poLines) : [];
    } catch {
      lines = [];
    }

    if (!lines.length) {
      lines = [ {} ];
    }

    this.grnRows = lines.map(line => {
      const itemText = String(line?.item || '').trim();
      const itemCode = this.extractItemCode(itemText);

      return {
        itemText,
        itemCode,
        supplierId,
        supplierName,
        storageType: '',
        surfaceTemp: '',
        expiry: '',
        pestSign: '',
        drySpillage: '',
        odor: '',
        plateNumber: '',
        defectLabels: '',
        damagedPackage: '',
        time: '',
        initial: '',
        remarks: line?.description ?? '',
        createdAt: new Date(),
        photos: []
      } as LineRow;
    });
  }

  private extractItemCode(itemText: string): string {
    const m = String(itemText).match(/^\s*([A-Za-z0-9_-]+)/);
    return m ? m[1] : '';
  }

  /* ================= Modal: Image/Signature ================= */
  openInitialModal(row: LineRow, index: number) {
    this.selectedRowIndex = index;
    this.activeTab = 'image';
    this.uploadedImage = row.initial || null;
    this.showInitialModal = true;
  }

  closeInitialModal() {
    this.showInitialModal = false;
    this.selectedRowIndex = null;
    this.signaturePad?.off();
    this.signaturePad = undefined;
  }

  switchTab(tab: 'image' | 'signature') {
    this.activeTab = tab;
    if (tab === 'signature') {
      setTimeout(() => this.initSignaturePad(), 0);
    }
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => (this.uploadedImage = e.target?.result ?? null);
    reader.readAsDataURL(file);
  }

  clearImage() {
    this.uploadedImage = null;
  }

  saveImage() {
    if (this.selectedRowIndex == null) return;
    if (typeof this.uploadedImage !== 'string') {
      alert('Please select an image first.');
      return;
    }
    this.grnRows[this.selectedRowIndex].initial = this.uploadedImage;
    this.closeInitialModal();
  }

  private initSignaturePad() {
    const canvas = this.signaturePadElement?.nativeElement;
    if (!canvas) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const width = canvas.clientWidth || 700;
    const height = 180;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(ratio, ratio);

    this.signaturePad = new SignaturePad(canvas, {
      backgroundColor: 'rgba(255,255,255,1)',
      penColor: '#0e3a4c'
    });
  }

  clearSignature() {
    this.signaturePad?.clear();
  }

  saveSignature() {
    if (this.selectedRowIndex == null) return;
    if (!this.signaturePad || this.signaturePad.isEmpty()) {
      alert('Please sign before saving.');
      return;
    }
    const dataURL = this.signaturePad.toDataURL('image/png');
    this.grnRows[this.selectedRowIndex].initial = dataURL;
    this.closeInitialModal();
  }

  /* ================= Actions: Flag & Post Inventory ================= */
  flagIssues(grnId: number) {
    console.log('Flagging issues for GRN ID:', grnId);
    // Navigate or open modal or call API for flagging issues
  }

  postInventory(grnId: number) {
    // console.log('Posting inventory for GRN ID:', grnId);
    // this.purchaseGoodReceiptService.postInventory(grnId).subscribe({
    //   next: () => {
    //     Swal.fire({
    //       icon: 'success',
    //       title: 'Inventory Posted',
    //       text: `GRN #${grnId} has been posted to inventory.`,
    //       confirmButtonColor: '#0e3a4c'
    //     });
    //     this.isPostInventoryDisabled = true;
    //   },
    //   error: (err) => {
    //     console.error('Inventory post failed', err);
    //     Swal.fire({
    //       icon: 'error',
    //       title: 'Error',
    //       text: 'Inventory post failed. Please try again.',
    //       confirmButtonColor: '#0e3a4c'
    //     });
    //   }
    // });
  }

  /* ================= Utils ================= */
  resetForm() {
    this.selectedPO = null;
    this.receiptDate = '';
    this.overReceiptTolerance = 0;
    this.currentSupplierId = null;
    this.currentSupplierName = '';

    this.grnRows = [
      {
        itemText: '',
        itemCode: '',
        supplierId: null,
        supplierName: '',
        storageType: '',
        surfaceTemp: '',
        expiry: '',
        pestSign: '',
        drySpillage: '',
        odor: '',
        plateNumber: '',
        defectLabels: '',
        damagedPackage: '',
        time: '',
        initial: '',
        remarks: '',
        createdAt: new Date(),
        photos: []
      }
    ];
  }

  trackByIndex = (i: number) => i;
}
