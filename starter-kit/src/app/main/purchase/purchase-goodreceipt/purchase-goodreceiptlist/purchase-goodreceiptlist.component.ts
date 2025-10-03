import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { ColumnMode, DatatableComponent } from '@swimlane/ngx-datatable';
import { PurchaseGoodreceiptService } from '../purchase-goodreceipt.service';


@Component({
  selector: 'app-grn-list',
  templateUrl: './purchase-goodreceiptlist.component.html',
  styleUrls: ['./purchase-goodreceiptlist.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class PurchaseGoodreceiptlistComponent implements OnInit {
  @ViewChild(DatatableComponent) table: DatatableComponent;
  @ViewChild('SweetAlertFadeIn') SweetAlertFadeIn: any;

  public ColumnMode = ColumnMode;
  public selectedOption = 10;
  public searchValue = '';

  rows: any[] = [];
  tempData: any[] = [];

  constructor(private grnService: PurchaseGoodreceiptService, private router: Router) {}

  ngOnInit(): void {
    this.loadGrns();
  }

    /** Safely parse GRNJson whether it is a string or already an object */
  private parseLines(grnJson: any): any[] {
    if (!grnJson) return [];
    if (Array.isArray(grnJson)) return grnJson;
    try {
      const parsed = JSON.parse(grnJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
 loadGrns() {
    this.grnService.getAllGRN().subscribe({
      next: (res: any) => {
        const data = Array.isArray(res?.data) ? res.data : [];

        this.rows = data.map((g: any) => {
          const lines = this.parseLines(g.grnJson ?? g.GRNJson);
          const first = lines.length ? lines[0] : {};

          return {
            id: g.id ?? g.Id,
            grnNo: g.grnNo ?? g.GrnNo ?? '',
            receptionDate: g.receptionDate ?? g.ReceptionDate ?? null,
            poId: g.poId ?? g.POID ?? null,

            // Flatten from first GRNJson line (if present)
            storageType: first.storageType ?? '',
            surfaceTemp: first.surfaceTemp ?? '',
            expiryDate: first.expiry ? new Date(first.expiry) : null,
            supplierId: first.supplier ?? null,
            plateNumber: first.plateNumber ?? '',
            pestSign: first.pestSign ?? '',
            damagedPackage: first.damagedPackage ?? '',
            remarks: first.remarks ?? g.remarks ?? g.Remarks ?? ''
          };
        });

        // Keep a copy for filtering
        this.tempData = [...this.rows];
      },
      error: (err: any) => console.error('Error loading GRN list', err)
    });
  }

  filterUpdate(event) {
    const val = event.target.value.toLowerCase();

    const temp = this.tempData.filter((d: any) => {
      return (
        d.grnNo?.toLowerCase().includes(val) ||
        d.product?.toString().includes(val) ||
        d.supplier?.toString().includes(val) ||
        d.type?.toLowerCase().includes(val)
      );
    });

    this.rows = temp;
    this.table.offset = 0;
  }

  goToCreateGRN() {
    this.router.navigate(['/purchase/createpurchasegoodreceipt']);
  }

  editGRN(id: number) {
    this.router.navigateByUrl(`/purchase/grn/edit/${id}`);
  }

  // deleteGRN(id: number) {
  //   Swal.fire({
  //     title: 'Are you sure?',
  //     text: 'This will permanently delete the GRN.',
  //     icon: 'warning',
  //     showCancelButton: true,
  //     confirmButtonColor: '#d33',
  //     cancelButtonColor: '#3085d6',
  //     confirmButtonText: 'Yes, delete it!'
  //   }).then((result) => {
  //     if (result.isConfirmed) {
  //       this.grnService.delete(id).subscribe({
  //         next: () => {
  //           this.loadGrns();
  //           Swal.fire('Deleted!', 'GRN has been deleted.', 'success');
  //         },
  //         error: (err) => console.error('Error deleting GRN', err)
  //       });
  //     }
  //   });
  // }
}
