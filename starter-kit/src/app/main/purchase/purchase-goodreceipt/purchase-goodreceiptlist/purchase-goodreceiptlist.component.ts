import { Component, HostListener, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { ColumnMode, DatatableComponent } from '@swimlane/ngx-datatable';
import { PurchaseGoodreceiptService } from '../purchase-goodreceipt.service';
import Swal from 'sweetalert2';

interface GrnRow {
  id: number;
  receptionDate: string | Date | null;
  poid: number | null;
  grnNo: string;
  pono: string;

  itemCode: string;
  itemName: string;

  supplierId: number | null;
  name: string; // supplier name

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
  initial: string; // base64 data URL
}

type ViewerState = { open: boolean; src: string | null };

@Component({
  selector: 'app-grn-list',
  templateUrl: './purchase-goodreceiptlist.component.html',
  styleUrls: ['./purchase-goodreceiptlist.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class PurchaseGoodreceiptlistComponent implements OnInit {
  @ViewChild(DatatableComponent) table!: DatatableComponent;

  public ColumnMode = ColumnMode;
  public selectedOption = 10;
  public searchValue = '';

  rows: GrnRow[] = [];
  allRows: GrnRow[] = [];

  // Image modal state
  imageViewer: ViewerState = { open: false, src: null };

  constructor(
    private grnService: PurchaseGoodreceiptService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadGrns();
  }

  /** Load and normalize API payload -> table rows */
  private loadGrns(): void {
    this.grnService.getAllDetails().subscribe({
      next: (res: any) => {
        const list: any[] = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
        this.allRows = (list || []).map<GrnRow>((g: any) => ({
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
              isFlagIssue: g.isFlagIssue ?? g.isFlagIssue ?? ''
        }));

        this.rows = [...this.allRows];
        if (this.table) this.table.offset = 0;
      },
      error: (err) => {
        console.error('Error loading GRN list', err);
        this.allRows = [];
        this.rows = [];
      }
    });
  }

  /** Global client-side search across common fields */
  filterUpdate(event: Event): void {
    const val = (event.target as HTMLInputElement).value?.toLowerCase().trim() ?? '';
    this.searchValue = val;

    if (!val) {
      this.rows = [...this.allRows];
      if (this.table) this.table.offset = 0;
      return;
    }

    this.rows = this.allRows.filter(r => {
      const dateStr = (r.receptionDate ? new Date(r.receptionDate).toISOString().slice(0, 10) : '');
      const expiryStr = (r.expiry ? new Date(r.expiry).toISOString().slice(0, 10) : '');
      return (
        (r.grnNo ?? '').toLowerCase().includes(val) ||
        (r.pono ?? '').toLowerCase().includes(val) ||
        (r.itemCode ?? '').toLowerCase().includes(val) ||
        (r.itemName ?? '').toLowerCase().includes(val) ||
        (r.name ?? '').toLowerCase().includes(val) ||
        (r.storageType ?? '').toLowerCase().includes(val) ||
        (r.surfaceTemp ?? '').toLowerCase().includes(val) ||
        (r.pestSign ?? '').toLowerCase().includes(val) ||
        (r.drySpillage ?? '').toLowerCase().includes(val) ||
        (r.odor ?? '').toLowerCase().includes(val) ||
        (r.plateNumber ?? '').toLowerCase().includes(val) ||
        (r.defectLabels ?? '').toLowerCase().includes(val) ||
        (r.damagedPackage ?? '').toLowerCase().includes(val) ||
        dateStr.includes(val) ||
        expiryStr.includes(val)
      );
    });

    if (this.table) this.table.offset = 0;
  }

  isDateLike(v: any): boolean {
    // Simple guard so HH:mm strings won't throw
    return !!v && !/^\d{1,2}:\d{2}$/.test(String(v));
  }

  isDataUrl(v: string | null | undefined): boolean {
    const s = String(v ?? '');
    // Accept common image data URLs
    return /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(s);
  }

  /** Thumbnail click -> open modal */
  openImage(src: string): void {
    if (!this.isDataUrl(src)) return;
    this.imageViewer = { open: true, src };
    document.body.style.overflow = 'hidden'; // lock scroll
  }

  closeImage(): void {
    this.imageViewer = { open: false, src: null };
    document.body.style.overflow = ''; // restore scroll
  }

  onImageLoaded(): void {
    // hook for spinner if needed
  }

  @HostListener('document:keydown.escape')
  handleEsc(): void {
    if (this.imageViewer.open) this.closeImage();
  }

  goToCreateGRN(): void {
    this.router.navigate(['/purchase/createpurchasegoodreceipt']);
  }

editGRN(id:any){
  this.router.navigateByUrl(`/purchase/edit-purchasegoodreceipt/${id}`)
}



    deleteGRN(id: number) {
    Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#7367F0',
      cancelButtonColor: '#E42728',
      confirmButtonText: 'Yes, Delete it!',
      customClass: {
        confirmButton: 'btn btn-primary',
        cancelButton: 'btn btn-danger ml-1'
      },
      allowOutsideClick: false,
    }).then((result) => {
      if (result.isConfirmed) {  // note: SweetAlert2 uses isConfirmed instead of value in recent versions
        this.grnService.deleteGRN(id).subscribe((response: any) => {
          Swal.fire({
            icon: response.isSuccess ? 'success' : 'error',
            title: response.isSuccess ? 'Deleted!' : 'Error!',
            text: response.message,
            allowOutsideClick: false,
          });
          this.loadGrns();  // Refresh the list after deletion
        }, error => {
          Swal.fire({
            icon: 'error',
            title: 'Error!',
            text: 'Something went wrong while deleting.',
          });
        });
      }
    });
  }
}
