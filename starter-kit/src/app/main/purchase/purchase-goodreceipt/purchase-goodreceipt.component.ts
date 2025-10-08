import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import SignaturePad from 'signature_pad';
import { forkJoin, of,  } from 'rxjs';
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
  remarks: '';

  // Meta
  createdAt: Date;
  photos: string[];

  // Flags
  isFlagIssue?: boolean;
  isPostInventory?: boolean;
  flagIssueId?: number | null;
}

interface GeneratedGRN {
  id: number;
  grnNo: string;
  poid: number;
  poNo?: string;
  grnJson: any[];
}

@Component({
  selector: 'app-purchase-goodreceipt',
  templateUrl: './purchase-goodreceipt.component.html',
  styleUrls: ['./purchase-goodreceipt.component.scss']
})
export class PurchaseGoodreceiptComponent implements OnInit {
  hover = false;

  // Image lightbox
  imageViewer = { open: false, src: null as string | null };
  openImage(src: string){ this.imageViewer = { open: true, src }; document.body.style.overflow = 'hidden'; }
  closeImage(){ this.imageViewer = { open: false, src: null }; document.body.style.overflow = ''; }
  normalizeImg(s: string){ return s?.startsWith('data:image') ? s : `data:image/png;base64,${s}`; }

  /* -------- Modal state -------- */
  showInitialModal = false;
  activeTab: 'image' | 'signature' = 'image';
  uploadedImage: string | ArrayBuffer | null = null;
  selectedRowIndex: number | null = null;

  flagModal = { open: false };
  selectedFlagIssueId: number | null = null;
  selectedRowForFlagIndex: number | null = null;

  isDragOver = false;

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
      photos: [],
      isFlagIssue: false,
      isPostInventory: false,
      flagIssueId: null,
    }
  ];

  /* -------- PO list for dropdown -------- */
  purchaseOrder: Array<{ id: number; purchaseOrderNo: string; supplierId?: number; poLines?: string }> = [];

  /* -------- Extras -------- */
  flagIssuesList: any[] = [];
  isPostInventoryDisabled = false;

  /* -------- Generated GRN summary -------- */
  generatedGRN: GeneratedGRN | null = null;

  /* -------- Edit mode -------- */
  editingGrnId: number | null = null;

  constructor(
    private purchaseGoodReceiptService: PurchaseGoodreceiptService,
    private flagIssuesService: FlagissueService,
    private purchaseorderService: POService,
    private _SupplierService: SupplierService,
    private cdRef: ChangeDetectorRef,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.loadPOs();

    // If navigated via /purchase/edit-Purchasegoodreceipt/:id, prefill everything
    this.route.paramMap.subscribe(async pm => {
      const idParam = pm.get('id');
      const id = idParam ? Number(idParam) : NaN;
      if (!isNaN(id) && id > 0) {
        this.editingGrnId = id;
        this.loadForEdit(id);
      }
    });
  }

  /* ===================== SAVE ===================== */
  saveGRN() {
    if (!this.selectedPO) {
      Swal.fire({ icon: 'warning', title: 'Required', text: 'Please select a PO.', confirmButtonColor: '#0e3a4c' });
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
      remarks: r.remarks,
      isFlagIssue: !!r.isFlagIssue,
      isPostInventory: !!r.isPostInventory,
      flagIssueId: r.flagIssueId ?? null
    }));

    const payload = {
      id: this.editingGrnId ?? 0,
      poid: this.selectedPO,
      supplierId: this.currentSupplierId,
      receptionDate: this.receiptDate ? new Date(this.receiptDate) : new Date(),
      overReceiptTolerance: this.overReceiptTolerance,
      grnJson: JSON.stringify(rowsForApi),
      grnNo: this.generatedGRN?.grnNo ?? '',
       isActive: true
    };

    // Decide endpoint depending on create vs update
    const svc: any = this.purchaseGoodReceiptService as any;
    const call$ =
      this.editingGrnId && typeof svc.updateGRN === 'function'
        ? svc.updateGRN(payload) // full update when available
        : this.editingGrnId && typeof svc.UpdateFlagIssues === 'function'
          ? svc.UpdateFlagIssues({ // fallback: update GRN JSON only (no header FlagIssuesID)
              id: payload.id,
              GrnNo: payload.grnNo || '',
              GRNJSON: payload.grnJson
            })
          : this.purchaseGoodReceiptService.createGRN(payload);

    call$.subscribe({
      next: (res: any) => {
        Swal.fire({
          icon: 'success',
          title: this.editingGrnId ? 'Updated' : 'Created',
          text: res?.message || (this.editingGrnId ? 'GRN updated.' : 'GRN created.'),
          confirmButtonColor: '#0e3a4c'
        });

        const idToShow = this.editingGrnId || res?.data;
        if (idToShow) this.loadForEdit(idToShow);
      },
      error: (err: any) => {
        console.error('Save failed', err);
        Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to save GRN.', confirmButtonColor: '#0e3a4c' });
      }
    });
  }

  /** Fetch & hydrate editor + summary for an existing GRN */
  private loadForEdit(id: number) {
    this.purchaseGoodReceiptService.getByIdGRN(id).subscribe({
      next: async (res: any) => {
        const data = res?.data ?? res;

        // Header
        const poid = Number(data?.poid ?? data?.POId ?? 0);
        this.selectedPO = poid || null;

        const rec = data?.receptionDate ?? data?.ReceptionDate ?? data?.Reception_Date;
        this.receiptDate = rec ? this.toDateInput(rec) : this.toDateInput(new Date());
        this.overReceiptTolerance = Number(data?.overReceiptTolerance ?? data?.OverReceiptTolerance ?? 0);

        // Supplier (header)
      if (this.currentSupplierId) {
  this.loadSupplierById(this.currentSupplierId).subscribe(name => {
    this.currentSupplierName = name;
  });
}


        // Editable rows
        let rows: any[] = [];
        try {
          const raw = data?.grnJson ?? data?.GRNJSON ?? '[]';
          rows = Array.isArray(raw) ? raw : JSON.parse(raw);
        } catch { rows = []; }

        this.grnRows = (rows.length ? rows : [{}]).map((r: any) => ({
          itemText: r.itemText ?? `${r.itemCode ?? r.item ?? ''}`,
          itemCode: r.itemCode ?? r.item ?? '',
          supplierId: r.supplierId ?? this.currentSupplierId ?? null,
          supplierName: r.supplierName ?? this.currentSupplierName ?? '',
          storageType: r.storageType ?? '',
          surfaceTemp: r.surfaceTemp ?? '',
          expiry: r.expiry ? this.toDateInput(r.expiry) : '',
          pestSign: r.pestSign ?? '',
          drySpillage: r.drySpillage ?? '',
          odor: r.odor ?? '',
          plateNumber: r.plateNumber ?? '',
          defectLabels: r.defectLabels ?? '',
          damagedPackage: r.damagedPackage ?? '',
          time: r.time ?? '',
          initial: r.initial ?? '',
          remarks: r.remarks ?? '',
          createdAt: new Date(),
          photos: [],
          isFlagIssue: !!r.isFlagIssue,
          isPostInventory: !!r.isPostInventory,
          flagIssueId: r.flagIssueId ?? null
        }));

        // Summary
        this.hydrateSummaryFromPayload(data);
      },
      error: (err) => console.error('Edit load failed', err)
    });
  }

  /** Build summary + enrich with supplier names & PO number */
  private hydrateSummaryFromPayload(payload: any) {
    let grnJsonArr: any[] = [];
    try {
      const raw = payload?.grnJson ?? payload?.GRNJSON ?? '[]';
      grnJsonArr = Array.isArray(raw) ? raw : JSON.parse(raw);
    } catch { grnJsonArr = []; }

    const supplierFetches = grnJsonArr.map((row: any) => {
      const supplierId = row?.supplierId;
      if (!supplierId) return of({ ...row, supplierName: row?.supplierName ?? 'Unknown' });
      return this._SupplierService.getSupplierById(supplierId).pipe(
        map((res: any) => ({
          ...row,
          supplierName: res?.data?.name ?? res?.data?.supplierName ?? row?.supplierName ?? 'Unknown'
        })),
        catchError(() => of({ ...row, supplierName: row?.supplierName ?? 'Unknown' }))
      );
    });

    forkJoin(supplierFetches).subscribe((rowsWithNames: any[]) => {
      this.generatedGRN = {
        id: payload?.id,
        grnNo: payload?.grnNo,
        poid: payload?.poid ?? payload?.POId,
        poNo: '',
        grnJson: rowsWithNames.map(r => ({
          ...r,
          isFlagIssue: !!r.isFlagIssue,
          isPostInventory: !!r.isPostInventory,
          flagIssueId: r.flagIssueId ?? null
        }))
      };

      // Load PO number
      const poId = Number(this.generatedGRN.poid);
      if (poId) {
        this.purchaseorderService.getPOById(poId).subscribe({
          next: (poRes: any) => {
            const po = poRes?.data ?? poRes;
            const poNo =
              po?.purchaseOrderNo ?? po?.PurchaseOrderNo ??
              po?.[0]?.purchaseOrderNo ?? po?.[0]?.PurchaseOrderNo ?? '';
            this.generatedGRN = { ...this.generatedGRN!, poNo };
          },
          error: (err) => console.error('Failed to load PO by id', err)
        });
      }
    });
  }

  /* ================= Flag Issues ================= */
  loadFlagIssues() {
    this.flagIssuesService.getAllFlagIssue().subscribe({
      next: (res: any) => { this.flagIssuesList = res?.data || []; },
      error: (err) => console.error('Flag issues load failed', err)
    });
  }

  openFlagIssuesModal() {
    this.loadFlagIssues();
    this.selectedFlagIssueId = null;
    this.flagModal.open = true;
    document.body.style.overflow = 'hidden';
  }

  closeFlagIssuesModal() {
    this.flagModal.open = false;
    document.body.style.overflow = '';
  }

  /** mutate one row, persist whole GRN JSON, rollback on error */
 private updateRowAndPersist(
  rowIndex: number,
  changes: { isFlagIssue?: boolean; isPostInventory?: boolean; flagIssueId?: number | null },
  onSuccess?: () => void
) {
  if (!this.generatedGRN?.id) return;

  const prevRows = JSON.parse(JSON.stringify(this.generatedGRN.grnJson || []));

  const rows = (this.generatedGRN.grnJson || []).map((r: any, i: number) =>
    i === rowIndex
      ? {
          ...r,
          isFlagIssue: changes.hasOwnProperty('isFlagIssue') ? !!changes.isFlagIssue : !!r.isFlagIssue,
          isPostInventory: changes.hasOwnProperty('isPostInventory') ? !!changes.isPostInventory : !!r.isPostInventory,
          flagIssueId: changes.hasOwnProperty('flagIssueId') ? (changes.flagIssueId ?? null) : (r.flagIssueId ?? null)
        }
      : r
  );

  this.generatedGRN = { ...this.generatedGRN, grnJson: rows };

  const body = {
    id: this.generatedGRN.id,
    GrnNo: this.generatedGRN.grnNo || '',
    GRNJSON: JSON.stringify(rows)
  };

  this.purchaseGoodReceiptService.UpdateFlagIssues(body).subscribe({
    next: () => {
      if (onSuccess) onSuccess();
    },
    error: (err) => {
      this.generatedGRN = { ...this.generatedGRN!, grnJson: prevRows };
      console.error('Update failed', err);
      alert('Update failed: ' + (err?.error?.message || err?.message || 'Bad Request'));
    }
  });
}

// Optional helper (nice readability)
get isEditMode(): boolean {
  return !!this.editingGrnId;
}

// Optional helper to compute total rows from whichever table you're acting on
private totalActionRows(): number {
  // actions are triggered from the summary table -> prefer generatedGRN.grnJson
  return (this.generatedGRN?.grnJson?.length ?? this.grnRows.length) || 0;
}
  /** User clicked "Post Inventory" — set post=true, flag=false, clear flagIssueId */
onPostInventoryRow(row: any, index: number) {
  const total = this.totalActionRows();
  const isLastRow = index === total - 1;

  this.updateRowAndPersist(
    index,
    { isPostInventory: true, isFlagIssue: false, flagIssueId: 0 },
    () => {
      Swal.fire('Posted', 'Row posted to inventory.', 'success');

      if (this.isEditMode) {
        // EDIT: redirect always
        this.resetForm();
        this.goToList();
      } else if (isLastRow) {
        // CREATE: redirect only when last row succeeded
        this.resetForm();
        this.goToList();
      }
      // else (create + not last) -> stay on page
    }
  );
}





  /** Open modal to select reason, then submit */
  onFlagIssuesRow(row: any, index: number) {
    this.selectedRowForFlagIndex = index;
    this.openFlagIssuesModal();
  }

submitFlagIssue() {
  if (this.selectedRowForFlagIndex == null || !this.selectedFlagIssueId) return;

  const index = this.selectedRowForFlagIndex;
  const total = this.totalActionRows();
  const isLastRow = index === total - 1;

  this.updateRowAndPersist(
    index,
    { isFlagIssue: true, isPostInventory: false, flagIssueId: this.selectedFlagIssueId },
    () => {
      Swal.fire('Flagged', 'Row flagged successfully.', 'warning');
      this.closeFlagIssuesModal();
      this.selectedRowForFlagIndex = null;

      if (this.isEditMode) {
        // EDIT: redirect always
        this.resetForm();
        this.goToList();
      } else if (isLastRow) {
        // CREATE: redirect only when last row succeeded
        this.resetForm();
        this.goToList();
      }
      // else (create + not last) -> stay on page
    }
  );
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
      console.error('PurchaseOrderService missing getPO()/getAllPurchaseOrder()');
      return;
    }

    obs$.subscribe({
      next: (res: any) => {
        const list = Array.isArray(res?.data) ? res.data : res;
        this.purchaseOrder = (list || []).map((p: any) => ([
          'id','Id'
        ].some(k => k in p) ? {
          id: p.id ?? p.Id,
          purchaseOrderNo: p.purchaseOrderNo ?? p.PurchaseOrderNo,
          supplierId: p.supplierId ?? p.SupplierId,
          poLines: p.poLines ?? p.PoLines
        } : {
          id: p?.id ?? 0,
          purchaseOrderNo: p?.purchaseOrderNo ?? '',
          supplierId: p?.supplierId ?? null,
          poLines: p?.poLines ?? '[]'
        }));
      },
      error: (err) => console.error('Error loading POs', err)
    });
  }

  onPOChange(selectedId: number | null) {
    if (!selectedId) { this.resetForm(); return; }

    const po = this.purchaseOrder.find(p => p.id === selectedId);
    if (!po) { this.resetForm(); return; }

    this.currentSupplierId = po.supplierId ?? null;

    this.loadSupplierById(this.currentSupplierId ?? 0).subscribe((name: string) => {
      this.currentSupplierName = name || '';
      this.buildRowsFromPo(po, this.currentSupplierId, this.currentSupplierName);
    });
  }

  /* ================= Supplier Helper ================= */
  private loadSupplierById(id: number) {
    if (!id) return of('' as string);
    return this._SupplierService.getSupplierById(id).pipe(
      map((api: any) => api?.data?.name ?? api?.data?.supplierName ?? api?.name ?? api?.supplierName ?? ''),
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
    try { lines = po.poLines ? JSON.parse(po.poLines) : []; } catch { lines = []; }

    if (!lines.length) { lines = [ {} ]; }

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
        photos: [],
        isFlagIssue: false,
        isPostInventory: false,
        flagIssueId: null,
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
    this.isDragOver = false;
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
    if (file) this.readFile(file);
  }

  onDragOver(event: DragEvent) { event.preventDefault(); event.stopPropagation(); this.isDragOver = true; }
  onDragLeave(event: DragEvent) { event.preventDefault(); event.stopPropagation(); this.isDragOver = false; }

  // NOTE: HTML calls (drop)="onDrop($event)"
  onDrop(event: DragEvent) {
    event.preventDefault(); event.stopPropagation(); this.isDragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.readFile(file);
  }

  private readFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => (this.uploadedImage = e.target?.result ?? null);
    reader.readAsDataURL(file);
  }

  clearImage() { this.uploadedImage = null; }

  saveImage() {
    if (this.selectedRowIndex == null) return;
    if (typeof this.uploadedImage !== 'string') { alert('Please select an image first.'); return; }
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

    this.signaturePad = new SignaturePad(canvas, { backgroundColor: 'rgba(255,255,255,1)', penColor: '#0e3a4c' });
  }

  clearSignature() { this.signaturePad?.clear(); }

  saveSignature() {
    if (this.selectedRowIndex == null) return;
    if (!this.signaturePad || this.signaturePad.isEmpty()) { alert('Please sign before saving.'); return; }
    const dataURL = this.signaturePad.toDataURL('image/png');
    this.grnRows[this.selectedRowIndex].initial = dataURL;
    this.closeInitialModal();
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
        photos: [],
        isFlagIssue: false,
        isPostInventory: false,
        flagIssueId: null,
      }
    ];
  }

  trackByIndex = (i: number) => i;

  goToList(): void {
    this.router.navigate(['/purchase/list-Purchasegoodreceipt']);
  }

  private toDateInput(d: any): string {
    const dt = new Date(d);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
