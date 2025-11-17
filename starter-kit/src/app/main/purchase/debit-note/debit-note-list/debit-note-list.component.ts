// debit-note-list.component.ts
import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { ColumnMode, DatatableComponent } from '@swimlane/ngx-datatable';
import { CoreSidebarService } from '@core/components/core-sidebar/core-sidebar.service';
import { DatePipe } from '@angular/common';
import { DebitNoteService } from '../debit-note.service';

@Component({
  selector: 'app-debit-note-list',
  templateUrl: './debit-note-list.component.html',
  styleUrls: ['./debit-note-list.component.scss'],
  encapsulation: ViewEncapsulation.None,
  providers: [DatePipe]
})
export class DebitNoteListComponent implements OnInit {

  @ViewChild(DatatableComponent) table!: DatatableComponent;

  rows: any[] = [];
  tempData: any[] = [];

  searchValue = '';
  ColumnMode = ColumnMode;
  selectedOption = 10;

  // modal state
  showLinesModal = false;
  modalLines: any[] = [];
  modalTotal = 0;

  constructor(
    private debitNoteService: DebitNoteService,
    private router: Router,
    private _coreSidebarService: CoreSidebarService,
    private datePipe: DatePipe
  ) {}

  ngOnInit(): void {
    this.loadRequests();
  }

 loadRequests(): void {
  this.debitNoteService.getAll().subscribe({
    next: (res: any) => {
      const data = res?.data || res || [];

      this.rows = data.map((req: any) => ({
        ...req,
        // make sure we ALWAYS have "status" in lower-case for the grid
        status: req.status ?? req.Status ?? 0,
        // your HTML uses row.poDate – map it from server fields
        poDate: req.poDate || req.noteDate || req.createdDate
      }));

      this.tempData = [...this.rows];

      if (this.table) {
        this.table.offset = 0;
      }

      // 👉 Quick debug
      console.log('DebitNote rows:', this.rows);
    },
    error: (err: any) => console.error('Error loading debit note list', err)
  });
}


  filterUpdate(event: any): void {
    const val = (event.target.value || '').toLowerCase();

    const temp = this.tempData.filter((d) => {
      const poDate = this.datePipe.transform(d.poDate, 'dd-MM-yyyy')?.toLowerCase() || '';

      if ((d.debitNoteNo || '').toLowerCase().includes(val) || !val) return true;
      if ((d.name || d.supplierName || '').toLowerCase().includes(val) || !val) return true;
      if ((d.reason || '').toLowerCase().includes(val) || !val) return true;
      if (poDate.includes(val) || !val) return true;
      return false;
    });

    this.rows = temp;
    if (this.table) this.table.offset = 0;
  }

  openCreate(): void {
    this.router.navigate(['/purchase/create-debitnote']);
  }

  editDetails(row: any): void {
    this.router.navigate(['/purchase/edit-debitnote', row.id]);
  }

  deleteDetails(id: number): void {
    Swal.fire({
      title: 'Are you sure?',
      text: 'This will permanently delete the Debit Note.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        this.debitNoteService.delete(id).subscribe({
          next: () => {
            this.loadRequests();
            Swal.fire('Deleted!', 'Debit Note has been deleted.', 'success');
          },
          error: (err) => {
            console.error('Error deleting debit note', err);
            Swal.fire('Error', 'Failed to delete debit note.', 'error');
          }
        });
      }
    });
  }

 openLinesModal(row: any): void {
  let lines: any[] = [];

  try {
    // support both camelCase and PascalCase JSON fields
    const raw = row.linesJson || row.LinesJson || '[]';
    lines = JSON.parse(raw);
  } catch {
    lines = [];
  }

  this.modalLines = lines || [];

  // compute total = sum(qty * price)
  this.modalTotal = this.modalLines.reduce(
    (sum, l) =>
      sum +
      (Number(l.qty) || 0) * (Number(l.price) || 0),
    0
  );

  this.showLinesModal = true;
}

  closeLinesModal(): void {
    this.showLinesModal = false;
    this.modalLines = [];
    this.modalTotal = 0;
  }
}
