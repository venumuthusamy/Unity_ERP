
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

    @ViewChild(DatatableComponent) table: DatatableComponent;
  @ViewChild('tableRowDetails') tableRowDetails: any;
  @ViewChild('SweetAlertFadeIn') SweetAlertFadeIn: any;
  colors = ['bg-light-primary', 'bg-light-success', 'bg-light-danger', 'bg-light-warning', 'bg-light-info'];
  rows: any[] = [];
  tempData: any[] = [];
  public searchValue = '';
  public ColumnMode = ColumnMode;
  public selectedOption = 10;
  hover = false;
  passData: any;
  showLinesModal = false;
  modalLines: any[] = [];
  modalTotal: any;

  constructor(private debitNoteService: DebitNoteService, private router: Router,
    private _coreSidebarService: CoreSidebarService,private datePipe: DatePipe
  ) { }
  ngOnInit(): void {
    this.loadRequests();
  }
  filterUpdate(event) {

    const val = event.target.value.toLowerCase();
    const temp = this.tempData.filter((d) => {

      const poDate = this.datePipe.transform(d.poDate, 'dd-MM-yyyy')?.toLowerCase() || '';
      const deliveryDate = this.datePipe.transform(d.deliveryDate, 'dd-MM-yyyy')?.toLowerCase() || '';

      if (d.debitNoteNo.toLowerCase().indexOf(val) !== -1 || !val) {
        return d.debitNoteNo.toLowerCase().indexOf(val) !== -1 || !val;
      }
       if (d.supplierName.toLowerCase().indexOf(val) !== -1 || !val) {
        return d.supplierName.toLowerCase().indexOf(val) !== -1 || !val;
      }
      if (d.approvalStatus.toLowerCase().indexOf(val) !== -1 || !val) {
        return d.approvalStatus.toLowerCase().indexOf(val) !== -1 || !val;
      }
       if (poDate.includes(val) || !val) return true;
       if (deliveryDate.includes(val) || !val) return true;

    });
    this.rows = temp;
    this.table.offset = 0;
  }
  getRandomColor(index: number): string {
    return this.colors[index % this.colors.length];
  }


  getInitial(orgName: string): string {
    // Get the first two characters, or the entire string if it's shorter
    const initials = orgName.slice(0, 2).toUpperCase();
    return initials;
  }
  loadRequests() {
    this.debitNoteService.getDebitNote().subscribe({
      next: (res: any) => {
        this.rows = res.data.map((req: any) => {
          return {
            ...req,
          };
        });
        this.tempData = this.rows
      },
      error: (err: any) => console.error('Error loading list', err)
    });
  }


  editDetails(row: any) {
    this.router.navigateByUrl(`/purchase/edit-debitnote/${row.id}`)
  }

  deleteDetails(id: number) {
    Swal.fire({
      title: 'Are you sure?',
      text: 'This will permanently delete the PO.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        this.debitNoteService.deleteDebitNote(id).subscribe({
          next: () => {
            this.loadRequests();
            Swal.fire('Deleted!', 'Debit Note has been deleted.', 'success');
          },
          error: (err) => console.error('Error deleting request', err)
        });
      }
    });
  }
  toggleLines(req: any) {
    // Toggle showLines only for the clicked PR
    req.showLines = !req.showLines;
  }
  onRowExpandClick(row: any) {
    // Expand/Collapse the row
    this.rowDetailsToggleExpand(row);

    // Show SweetAlert fade-in
    this.SweetAlertFadeIn.fire();
  }
  rowDetailsToggleExpand(row: any) {
    row.$$expanded = !row.$$expanded; // toggle expand
  }
  openCreate() {
    this.passData = {};   
    this.router.navigate(['/purchase/create-debitnote']);
    
  } 
}








