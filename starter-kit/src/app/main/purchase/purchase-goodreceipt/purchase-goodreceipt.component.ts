import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef, AfterViewInit, AfterViewChecked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import SignaturePad from 'signature_pad';
import { forkJoin, of, Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import feather from 'feather-icons';
import { PurchaseGoodreceiptService } from './purchase-goodreceipt.service';
import { FlagissueService } from 'app/main/master/flagissue/flagissue.service';
import { SupplierService } from 'app/main/businessPartners/supplier/supplier.service';
import { POService } from '../purchase-order/purchase-order.service';

export interface LineRow {
  itemText: string;
  itemCode: string;
  supplierId: number | null;
  supplierName: string;

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
  initial: string;
  remarks: string;

  createdAt: Date;
  photos: string[];

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
export class PurchaseGoodreceiptComponent implements OnInit,AfterViewInit,AfterViewChecked {
  hover = false;
  minDate = '';
  // create-mode summary toggle
  showSummary = false;

  imageViewer = { open: false, src: null as string | null };
  openImage(src: string){ this.imageViewer = { open: true, src }; document.body.style.overflow = 'hidden'; }
  closeImage(){ this.imageViewer = { open: false, src: null }; document.body.style.overflow = ''; }

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

  selectedPO: number | null = null;
  receiptDate = '';
  overReceiptTolerance = 0;

  currentSupplierId: number | null = null;
  currentSupplierName = '';

  grnRows: LineRow[] = [
    {
      itemText: '', itemCode: '',
      supplierId: null, supplierName: '',
      storageType: '', surfaceTemp: '', expiry: '',
      pestSign: '', drySpillage: '', odor: '',
      plateNumber: '', defectLabels: '', damagedPackage: '',
      time: '', initial: '', remarks: '',
      createdAt: new Date(), photos: [],
      isFlagIssue: false, isPostInventory: false, flagIssueId: null
    }
  ];
ngAfterViewInit() {
  feather.replace(); // activates all <i data-feather="...">
}
  ngAfterViewChecked() {
    feather.replace();
  }

  allowOnlyNumbers(event: KeyboardEvent): void {
  const charCode = event.key.charCodeAt(0);
  // Allow only digits 0-9
  if (charCode < 48 || charCode > 57) {
    event.preventDefault();
  }
}
  purchaseOrder: Array<{ id: number; purchaseOrderNo: string; supplierId?: number; poLines?: string }> = [];
  flagIssuesList: any[] = [];
  isPostInventoryDisabled = false;

  generatedGRN: GeneratedGRN | null = null;

  editingGrnId: number | null = null;

  private supplierNameMap = new Map<number, string>();

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
    this.setMinDate();
    this.loadPOs();

    // detect edit mode via route
    this.route.paramMap.subscribe(pm => {
      const idParam = pm.get('id');
      const id = idParam ? Number(idParam) : NaN;
      if (!isNaN(id) && id > 0) {
        this.editingGrnId = id;
        this.loadForEdit(id);
      }
    });
  }


   setMinDate() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    this.minDate = `${yyyy}-${mm}-${dd}`;
  }
  get isEditMode(): boolean { return !!this.editingGrnId; }

  goToDebitNoteList(){ this.router.navigate(['/purchase/list-Purchasegoodreceipt']); }

  /* ===================== CREATE MODE SAVE ===================== */
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

    // prefer create endpoint in create mode
    const call$ = this.purchaseGoodReceiptService.createGRN(payload);

    call$.subscribe({
      next: (res: any) => {
        Swal.fire({
          icon: 'success',
          title: 'Created',
          text: res?.message || 'GRN created.',
          confirmButtonColor: '#0e3a4c'
        });

        // switch to read-only Generated Summary in the SAME page
        const idToShow = res?.data || res?.id || res;
        if (idToShow) {
          this.showSummary = true;
          this.loadSummaryForCreate(idToShow);
        }
      },
      error: (err: any) => {
        console.error('Save failed', err);
        Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to save GRN.', confirmButtonColor: '#0e3a4c' });
      }
    });
  }

  /* ============= AFTER-CREATE: LOAD SUMMARY IN CREATE MODE (READ-ONLY) ============= */
  private loadSummaryForCreate(id: number) {
    this.purchaseGoodReceiptService.getByIdGRN(id).subscribe({
      next: (res: any) => {
        const data = res?.data ?? res;

        // header
        const poid = this.toNum(data?.poid ?? data?.POId);
        this.selectedPO = poid;

        const rec = data?.receptionDate ?? data?.ReceptionDate ?? data?.Reception_Date;
        this.receiptDate = rec ? this.toDateInput(rec) : this.toDateInput(new Date());
        this.overReceiptTolerance = Number(data?.overReceiptTolerance ?? data?.OverReceiptTolerance ?? 0);

        this.currentSupplierId = this.toNum(data?.supplierId ?? data?.SupplierId);

        // parse rows
        let rows: any[] = [];
        try {
          const raw = data?.grnJson ?? data?.GRNJSON ?? '[]';
          rows = Array.isArray(raw) ? raw : JSON.parse(raw);
        } catch { rows = []; }

        const rowsCoerced = rows.map((r: any) => ({
          ...r,
          expiry: r?.expiry ? this.toDateInput(r.expiry) : '',
          isFlagIssue: !!r?.isFlagIssue,
          isPostInventory: !!r?.isPostInventory,
          flagIssueId: r?.flagIssueId ?? null
        }));

        this.generatedGRN = {
          id: data?.id,
          grnNo: data?.grnNo,
          poid: data?.poid ?? data?.POId,
          poNo: '',
          grnJson: rowsCoerced
        };

        // load PO number
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

        // supplier names (display only)
        const ids = new Set<number>();
        rowsCoerced.forEach(r => { const rid = this.toNum(r?.supplierId); if (rid) ids.add(rid); });
        if (this.currentSupplierId) ids.add(this.currentSupplierId);

        const lookups: Observable<[number, string]>[] = Array.from(ids).map(idNum =>
          this._SupplierService.getSupplierById(idNum).pipe(
            map((api: any) => {
              const name =
                api?.data?.name ??
                api?.data?.supplierName ??
                api?.name ??
                api?.supplierName ??
                '';
              return [idNum, name] as [number, string];
            }),
            catchError(() => of([idNum, ''] as [number, string]))
          )
        );

        forkJoin(lookups.length ? lookups : [of([0, ''] as [number, string])]).subscribe(pairs => {
          this.supplierNameMap = new Map<number, string>(pairs.filter(p => !!p[0]));
          // enrich supplierName if missing
          this.generatedGRN = {
            ...this.generatedGRN!,
            grnJson: this.generatedGRN!.grnJson.map(r => ({
              ...r,
              supplierName: r.supplierName || (r.supplierId ? (this.supplierNameMap.get(r.supplierId) || '') : '')
            }))
          };
          this.cdRef.markForCheck();
        });
      },
      error: (err) => console.error('Create Summary load failed', err)
    });
  }

  /* ===================== EDIT MODE: LOAD + SUMMARY ===================== */
  private loadForEdit(id: number) {
    this.purchaseGoodReceiptService.getByIdGRN(id).subscribe({
      next: (res: any) => {
        const data = res?.data ?? res;

        // Header
        const poid = this.toNum(data?.poid ?? data?.POId);
        this.selectedPO = poid;

        const rec = data?.receptionDate ?? data?.ReceptionDate ?? data?.Reception_Date;
        this.receiptDate = rec ? this.toDateInput(rec) : this.toDateInput(new Date());
        this.overReceiptTolerance = Number(data?.overReceiptTolerance ?? data?.OverReceiptTolerance ?? 0);

        this.currentSupplierId = this.toNum(data?.supplierId ?? data?.SupplierId);

        // Parse rows
        let rows: any[] = [];
        try {
          const raw = data?.grnJson ?? data?.GRNJSON ?? '[]';
          rows = Array.isArray(raw) ? raw : JSON.parse(raw);
        } catch { rows = []; }
        if (!rows.length) rows = [{}];

        // Collect supplier ids
        const ids = new Set<number>();
        rows.forEach(r => { const rid = this.toNum(r?.supplierId); if (rid) ids.add(rid); });
        if (this.currentSupplierId) ids.add(this.currentSupplierId);

        const lookups: Observable<[number, string]>[] = Array.from(ids).map(idNum =>
          this._SupplierService.getSupplierById(idNum).pipe(
            map((api: any) => {
              const name =
                api?.data?.name ??
                api?.data?.supplierName ??
                api?.name ??
                api?.supplierName ??
                '';
              return [idNum, name] as [number, string];
            }),
            catchError(() => of([idNum, ''] as [number, string]))
          )
        );

        forkJoin(lookups.length ? lookups : [of([0, ''] as [number, string])]).subscribe(pairs => {
          this.supplierNameMap = new Map<number, string>(pairs.filter(p => !!p[0]));

          // fallback to PO supplier if header missing
          if (!this.currentSupplierId && this.selectedPO) {
            const po = this.purchaseOrder.find(p => p.id === this.selectedPO);
            if (po?.supplierId) this.currentSupplierId = po.supplierId;
          }
          this.currentSupplierName = this.currentSupplierId ? (this.supplierNameMap.get(this.currentSupplierId) || '') : '';

          // Build editable summary rows
          const rowsWithNames = rows.map((r: any) => {
            const rid = this.toNum(r?.supplierId) ?? this.currentSupplierId ?? null;
            const supplierName =
              r?.supplierName ||
              (rid ? (this.supplierNameMap.get(rid) || '') : '') ||
              this.currentSupplierName ||
              '';

            return {
              ...r,
              supplierId: rid,
              supplierName,
              expiry: r?.expiry ? this.toDateInput(r.expiry) : '',
              isFlagIssue: !!r?.isFlagIssue,
              isPostInventory: !!r?.isPostInventory,
              flagIssueId: r?.flagIssueId ?? null
            };
          });

          this.generatedGRN = {
            id: data?.id,
            grnNo: data?.grnNo,
            poid: data?.poid ?? data?.POId,
            poNo: '',
            grnJson: rowsWithNames
          };

          // Load PO number for header display
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

          this.cdRef.markForCheck();
        });
      },
      error: (err) => console.error('Edit load failed', err)
    });
  }

  /* ====== Flag Issues flow ====== */
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
     setTimeout(() => feather.replace(), 0); 
  }

  closeFlagIssuesModal() {
    this.flagModal.open = false;
    document.body.style.overflow = '';
  }

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

    const body = { id: this.generatedGRN.id, GrnNo: this.generatedGRN.grnNo || '', GRNJSON: JSON.stringify(rows) };
    const anySvc: any = this.purchaseGoodReceiptService as any;

    const call$ =
      typeof anySvc.UpdateFlagIssues === 'function'
        ? anySvc.UpdateFlagIssues(body)
        : typeof anySvc.updateGRN === 'function'
          ? anySvc.updateGRN({ ...body, grnJson: body.GRNJSON })
          : null;

    if (!call$) return;

    call$.subscribe({
      next: () => { if (onSuccess) onSuccess(); },
      error: (err) => {
        this.generatedGRN = { ...this.generatedGRN!, grnJson: prevRows };
        console.error('Update failed', err);
        alert('Update failed: ' + (err?.error?.message || err?.message || 'Bad Request'));
      }
    });
  }

  onPostInventoryRow(row: any, index: number) {
    const total = (this.generatedGRN?.grnJson?.length ?? this.grnRows.length) || 0;
    const isLastRow = index === total - 1;

    this.updateRowAndPersist(
      index,
      { isPostInventory: true, isFlagIssue: false, flagIssueId: 0 },
      () => {
        Swal.fire('Posted', 'Row posted to inventory.', 'success');

        // Edit Mode → always go to list
        // Create Mode → go to list only when last row posted/flagged
        if (this.isEditMode || isLastRow) {
          this.goToDebitNoteList();
        }
      }
    );
  }

  onFlagIssuesRow(row: any, index: number) {
    this.selectedRowForFlagIndex = index;
    this.openFlagIssuesModal();
  }

  submitFlagIssue() {
    if (this.selectedRowForFlagIndex == null || !this.selectedFlagIssueId) return;

    const index = this.selectedRowForFlagIndex;
    const total = (this.generatedGRN?.grnJson?.length ?? this.grnRows.length) || 0;
    const isLastRow = index === total - 1;

    this.updateRowAndPersist(
      index,
      { isFlagIssue: true, isPostInventory: false, flagIssueId: this.selectedFlagIssueId },
      () => {
        Swal.fire('Flagged', 'Row flagged successfully.', 'warning');
        this.closeFlagIssuesModal();
        this.selectedRowForFlagIndex = null;

        if (this.isEditMode || isLastRow) {
          this.goToDebitNoteList();
        }
      }
    );
  }

  get editRows() {
    return (this.generatedGRN?.grnJson ?? []).filter((r: any) => !r?.isPostInventory);
  }

  /* ================= Purchase Orders ================= */
  loadPOs() {
    const anySvc: any = this.purchaseorderService as any;
    const obs$ =
      typeof this.purchaseorderService.getPODetailswithGRN === 'function'
        ? this.purchaseorderService.getPODetailswithGRN()
        : typeof anySvc.getAllPurchaseOrder === 'function'
          ? anySvc.getAllPurchaseOrder()
          : null;

    if (!obs$) {
      console.error('PurchaseOrderService missing getPODetailswithGRN()/getAllPurchaseOrder()');
      return;
    }

    obs$.subscribe({
      next: (res: any) => {
        const list = Array.isArray(res?.data) ? res.data : res;
        this.purchaseOrder = (list || []).map((p: any) => ([ 'id','Id' ].some(k => k in p) ? {
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

    this.currentSupplierId = this.toNum(po.supplierId);

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
  if (!lines.length) { lines = [{}]; }

  this.grnRows = lines.map(line => {
    const itemText = String(line?.item || '').trim();
    const itemCode = this.extractItemCode(itemText);

    return {
      itemText,
      itemCode,
      supplierId,
      supplierName,
     storageType: 'Chilled',
      surfaceTemp: '',
      expiry: '',
      pestSign: 'No',           // Default value
      drySpillage: 'No',        // Default value
      odor: 'No',               // Default value
      plateNumber: '',
      defectLabels: 'No',       // Default value
      damagedPackage: 'No',     // Default value
      time: '',
      initial: '',
      remarks: '',
      createdAt: new Date(),
      photos: [],
      isFlagIssue: false,
      isPostInventory: false,
      flagIssueId: null
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
    if (tab === 'signature') setTimeout(() => this.initSignaturePad(), 0);
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (file) this.readFile(file);
  }

  onDragOver(event: DragEvent) { event.preventDefault(); event.stopPropagation(); this.isDragOver = true; }
  onDragLeave(event: DragEvent) { event.preventDefault(); event.stopPropagation(); this.isDragOver = false; }
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
    if (this.isEditMode && this.generatedGRN) {
      this.generatedGRN.grnJson[this.selectedRowIndex].initial = this.uploadedImage;
    } else if (this.showSummary && this.generatedGRN) {
      // create-summary context (read-only display, but we're storing image in memory)
      this.generatedGRN.grnJson[this.selectedRowIndex].initial = this.uploadedImage;
    } else {
      this.grnRows[this.selectedRowIndex].initial = this.uploadedImage;
    }
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
    if (this.isEditMode && this.generatedGRN) {
      this.generatedGRN.grnJson[this.selectedRowIndex].initial = dataURL;
    } else if (this.showSummary && this.generatedGRN) {
      this.generatedGRN.grnJson[this.selectedRowIndex].initial = dataURL;
    } else {
      this.grnRows[this.selectedRowIndex].initial = dataURL;
    }
    this.closeInitialModal();
  }

  /* ================= Utils ================= */
  resetForm() {
    this.selectedPO = null;
    this.receiptDate = '';
    this.overReceiptTolerance = 0;
    this.currentSupplierId = null;
    this.currentSupplierName = '';
    this.showSummary = false;
    this.generatedGRN = null;

    this.grnRows = [
      {
        itemText: '', itemCode: '',
        supplierId: null, supplierName: '',
        storageType: '', surfaceTemp: '', expiry: '',
        pestSign: '', drySpillage: '', odor: '',
        plateNumber: '', defectLabels: '', damagedPackage: '',
        time: '', initial: '', remarks: '',
        createdAt: new Date(), photos: [],
        isFlagIssue: false, isPostInventory: false, flagIssueId: null
      }
    ];
  }

  trackByIndex = (i: number) => i;

  goToList(): void { this.router.navigate(['/purchase/list-Purchasegoodreceipt']); }

  private toDateInput(d: any): string {
    const dt = new Date(d);
    if (isNaN(+dt)) return '';
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private toNum(v: any): number | null {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  
}
