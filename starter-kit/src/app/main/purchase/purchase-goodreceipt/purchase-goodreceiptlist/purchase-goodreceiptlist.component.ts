import { Component, HostListener, OnInit, ViewChild, AfterViewInit, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { ColumnMode, DatatableComponent } from '@swimlane/ngx-datatable';
import { PurchaseGoodreceiptService } from '../purchase-goodreceipt.service';
import Swal from 'sweetalert2';
import * as feather from 'feather-icons';

interface GrnRow {
  id: number;
  receptionDate: string | Date | null;
  poid: number | null;
  grnNo: string;
  pono: string;
  itemCode: string;
  itemName: string;
  supplierId: number | null;
  name: string;
  storageType: string;
  surfaceTemp: string;
  expiry: string | Date | null;
  pestSign: string;
  drySpillage: string;
  odor: string;
  plateNumber: string;
  defectLabels: string;
  damagedPackage: string;
  time: string | Date | null;
  initial: string;
  isFlagIssue: boolean;
  isPostInventory: boolean;

  /** NEW fields you asked to preview */
  qtyReceived?: number | null;
  qualityCheck?: string | null;
  batchSerial?: string | null;
}

type ViewerState = { open: boolean; src: string | null };

@Component({
  selector: 'app-grn-list',
  templateUrl: './purchase-goodreceiptlist.component.html',
  styleUrls: ['./purchase-goodreceiptlist.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class PurchaseGoodreceiptlistComponent implements OnInit, AfterViewInit {
  @ViewChild(DatatableComponent) table!: DatatableComponent;

  public ColumnMode = ColumnMode;
  public selectedOption = 10;
  public searchValue = '';

  rows: GrnRow[] = [];
  allRows: GrnRow[] = [];

  // Image modal
  imageViewer: ViewerState = { open: false, src: null };

  // Lines modal
  showLinesModal = false;
  modalLines: any[] = [];
  modalHeader: { grnNo?: string; pono?: string; name?: string; receptionDate?: any } = { grnNo: '' };

  constructor(
    private grnService: PurchaseGoodreceiptService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadGrns();
  }

  ngAfterViewInit(): void {
    this.refreshFeatherIcons();
  }

  /** Refresh Feather icons (call after table or DOM updates) */
  refreshFeatherIcons(): void {
    setTimeout(() => feather.replace(), 0);
  }

  /** Load GRNs from API */
  private loadGrns(): void {
    this.grnService.getAllDetails().subscribe({
      next: (res: any) => {
        const list: any[] = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
        const normalized = (list || []).map<GrnRow>((g: any) => ({
          id: g.id ?? g.ID ?? null,
          receptionDate: g.receptionDate ?? g.ReceptionDate ?? null,
          poid: g.poid ?? g.POID ?? g.poId ?? null,
          grnNo: g.grnNo ?? g.GrnNo ?? '',
          pono: g.pono ?? g.Pono ?? '',
          itemCode: g.itemCode ?? g.ItemCode ?? '',
          itemName: g.itemName ?? g.ItemName ?? '',
          supplierId: g.supplierId ?? g.SupplierId ?? null,
          name: g.name ?? g.Name ?? '',
          storageType: g.storageType ?? g.StorageType ?? '',
          surfaceTemp: (g.surfaceTemp ?? g.SurfaceTemp ?? '').toString(),
          expiry: g.expiry ?? g.Expiry ?? null,
          pestSign: g.pestSign ?? g.PestSign ?? '',
          drySpillage: g.drySpillage ?? g.DrySpillage ?? '',
          odor: g.odor ?? g.Odor ?? '',
          plateNumber: g.plateNumber ?? g.PlateNumber ?? '',
          defectLabels: g.defectLabels ?? g.DefectLabels ?? '',
          damagedPackage: g.damagedPackage ?? g.DamagedPackage ?? '',
          time: g.time ?? g.Time ?? null,
          initial: g.initial ?? g.Initial ?? '',
          isFlagIssue: this.truthy(g.isFlagIssue ?? g.IsFlagIssue ?? false),
          isPostInventory: this.truthy(g.isPostInventory ?? g.IsPostInventory ?? false),

          /** NEW mappings */
          qtyReceived: g.qtyReceived ?? g.QtyReceived ?? null,
          qualityCheck: g.qualityCheck ?? g.QualityCheck ?? null,
          batchSerial: g.batchSerial ?? g.BatchSerial ?? null,
        }));

        this.allRows = normalized;
        this.rows = this.collapseByGrn(normalized);
        if (this.table) this.table.offset = 0;

        this.refreshFeatherIcons(); // ensure icons render after table load
      },
      error: (err) => {
        console.error('Error loading GRN list', err);
        this.allRows = [];
        this.rows = [];
      }
    });
  }

  /** Collapse multiple items by GRN */
  private collapseByGrn(rows: GrnRow[]): GrnRow[] {
    const map = new Map<string, { base: GrnRow; items: Set<string> }>();
    for (const r of rows) {
      const key = `${r.grnNo}__${this.truthy(r.isFlagIssue)}__${this.truthy(r.isPostInventory)}`;
      if (!map.has(key)) {
        map.set(key, { base: { ...r }, items: new Set<string>([r.itemName?.trim() || '']) });
      } else {
        const bucket = map.get(key)!;
        if (!bucket.base.name && r.name) bucket.base.name = r.name;
        if (!bucket.base.pono && r.pono) bucket.base.pono = r.pono;
        bucket.items.add(r.itemName?.trim() || '');
      }
    }

    return Array.from(map.values()).map(({ base, items }) => {
      const list = [...items].filter(Boolean);
      const summary = list.join(', ');
      return { ...base, itemName: list.length > 1 ? `${summary} (${list.length})` : (summary || base.itemName) };
    });
  }

  /** Search filter */
  filterUpdate(event: Event): void {
    const val = (event.target as HTMLInputElement).value?.toLowerCase().trim() ?? '';
    this.searchValue = val;
    if (!val) {
      this.rows = this.collapseByGrn(this.allRows);
      if (this.table) this.table.offset = 0;
      this.refreshFeatherIcons();
      return;
    }

    const filtered = this.allRows.filter(r =>
      (r.grnNo ?? '').toLowerCase().includes(val) ||
      (r.pono ?? '').toLowerCase().includes(val) ||
      (r.itemCode ?? '').toLowerCase().includes(val) ||
      (r.itemName ?? '').toLowerCase().includes(val) ||
      (r.name ?? '').toLowerCase().includes(val)
    );

    this.rows = this.collapseByGrn(filtered);
    if (this.table) this.table.offset = 0;
    this.refreshFeatherIcons();
  }

  /** Lines modal */
  openLinesModal(row: GrnRow): void {
    this.refreshFeatherIcons();
    if (!row?.grnNo) return;

    // Show these in the modal header strip if you added it in HTML
    this.modalHeader = {
      grnNo: row.grnNo || '',
      pono: row.pono || '',
      name: row.name || '',
      receptionDate: row.receptionDate || null
    };

    this.modalLines = [];
    this.showLinesModal = true;

    // Try to build from cached rows for same GRN + same status (for consistent display)
    const sameGrnRows = this.allRows.filter(r => (r.grnNo || '') === (row.grnNo || ''));
    const sameStatusRows = sameGrnRows.filter(r =>
      this.truthy(r.isPostInventory) === this.truthy(row.isPostInventory) &&
      this.truthy(r.isFlagIssue) === this.truthy(row.isFlagIssue)
    );

    if (sameStatusRows.length) {
      this.modalLines = sameStatusRows.map(r => this.toModalLine(r, r.name));
      return;
    }

    // Fallback: fetch by id and try to derive a single matching line
    this.grnService.getByIdGRN(row.id).subscribe({
      next: (res: any) => {
        const data = res?.data ?? res ?? {};
        let lines: any[] = [];
        try {
          const raw = data?.grnJson ?? data?.GRNJSON ?? '[]';
          lines = Array.isArray(raw) ? raw : JSON.parse(raw);
        } catch { lines = []; }

        const picked = this.pickOneLine(lines, row);
        if (!picked.supplierName) picked.supplierName = row.name ?? '';
        this.modalLines = [ this.toModalLine(picked, row.name) ];
      },
      error: (err) => {
        console.error('Failed to load GRN by id', err);
        this.modalLines = [ this.toModalLine(row, row.name) ];
      }
    });
  }

  closeLinesModal(): void {
    this.showLinesModal = false;
    this.modalLines = [];
  }

  /** Convert any source (row or json line) to modal line object */
  private toModalLine(src: any, fallbackName?: string) {
    const timeDate = this.parseTime(src.time);
    return {
      itemName: src.itemName ?? src.itemText ?? src.item ?? '',
      item: src.item ?? '',
      itemCode: src.itemCode ?? '',
      supplierName: src.supplierName ?? fallbackName ?? '',
      storageType: src.storageType ?? '',
      surfaceTemp: src.surfaceTemp ?? '',
      expiry: src.expiry ? this.toDate(src.expiry) : null,
      pestSign: src.pestSign ?? '',
      drySpillage: src.drySpillage ?? '',
      odor: src.odor ?? '',
      plateNumber: src.plateNumber ?? '',
      defectLabels: src.defectLabels ?? '',
      damagedPackage: src.damagedPackage ?? '',
      time: timeDate,
      timeText: this.coerceTimeText(src.time),
      isFlagIssue: this.truthy(src.isFlagIssue),
      isPostInventory: this.truthy(src.isPostInventory),

      /** NEW fields surfaced into the modal table */
      qtyReceived: this.toNumberOrNull(src.qtyReceived ?? src.QtyReceived),
      qualityCheck: src.qualityCheck ?? src.QualityCheck ?? null,
      batchSerial: src.batchSerial ?? src.BatchSerial ?? null,
    };
  }

  private toNumberOrNull(v: any): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  }

  private parseTime(v: any): Date | null {
    if (!v) return null;
    const s = String(v).trim();
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
    if (m) {
      const d = new Date();
      d.setHours(+m[1], +m[2], m[3] ? +m[3] : 0, 0);
      return d;
    }
    const d = new Date(v);
    return isNaN(+d) ? null : d;
  }

  private pickOneLine(lines: any[], row: GrnRow) {
    return (
      lines.find(l => (l.itemCode ?? l.item ?? '') === (row.itemCode ?? '')) ||
      lines.find(l =>
        (l.itemCode ?? l.item ?? '') === (row.itemCode ?? '') &&
        (String(l.storageType ?? '') === String(row.storageType ?? '') ||
         String(l.surfaceTemp ?? '') === String(row.surfaceTemp ?? ''))
      ) ||
      lines[0] || {}
    );
  }

  isDataUrl(v: string | null | undefined): boolean {
    const s = String(v ?? '');
    return /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(s);
  }

  openImage(src: string): void {
    if (!this.isDataUrl(src)) return;
    this.imageViewer = { open: true, src };
    document.body.style.overflow = 'hidden';
  }

  closeImage(): void {
    this.imageViewer = { open: false, src: null };
    document.body.style.overflow = '';
  }

  @HostListener('document:keydown.escape') handleEsc(): void {
    if (this.imageViewer.open) this.closeImage();
    if (this.showLinesModal) this.closeLinesModal();
  }

  goToCreateGRN(): void {
    this.router.navigate(['/purchase/createpurchasegoodreceipt']);
  }

  editGRN(id: any) {
    this.router.navigateByUrl(`/purchase/edit-purchasegoodreceipt/${id}`);
  }

  // deleteGRN(id: number) {
  //   Swal.fire({
  //     title: 'Are you sure?',
  //     text: "You won't be able to revert this!",
  //     icon: 'warning',
  //     showCancelButton: true,
  //     confirmButtonColor: '#7367F0',
  //     cancelButtonColor: '#E42728',
  //     confirmButtonText: 'Yes, Delete it!',
  //     customClass: { confirmButton: 'btn btn-primary', cancelButton: 'btn btn-danger ml-1' },
  //     allowOutsideClick: false,
  //   }).then((result) => {
  //     if (result.isConfirmed) {
  //       this.grnService.deleteGRN(id).subscribe({
  //         next: (response: any) => {
  //           Swal.fire({
  //             icon: response.isSuccess ? 'success' : 'error',
  //             title: response.isSuccess ? 'Deleted!' : 'Error!',
  //             text: response.message,
  //             allowOutsideClick: false,
  //           });
  //           this.loadGrns();
  //         },
  //         error: () => {
  //           Swal.fire({ icon: 'error', title: 'Error!', text: 'Something went wrong while deleting.' });
  //         }
  //       });
  //     }
  //   });
  // }

  private toDate(d: any): Date | null {
    const dt = new Date(d);
    if (isNaN(+dt)) return null;
    if (dt.getFullYear() === 1900) return null;
    return dt;
  }

  private truthy(v: any): boolean {
    if (v === true || v === 1) return true;
    if (v === false || v === 0 || v === null || v === undefined) return false;
    const s = String(v).trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'yes';
  }

  statusText(row: any): 'Posted' | 'Flagged' | 'Pending' {
    const isPost = this.truthy(row?.isPostInventory);
    const isFlag = this.truthy(row?.isFlagIssue);
    if (isPost) return 'Posted';
    if (isFlag) return 'Flagged';
    return 'Pending';
  }

  statusClass(row: any): string {
    const t = this.statusText(row);
    if (t === 'Posted') return 'badge-success';
    if (t === 'Flagged') return 'badge-warning';
    return 'badge-danger';
  }

  private coerceTimeText(v: any): string | null {
    if (!v) return null;
    const d = this.parseTime(v);
    if (!d) return null;
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}
