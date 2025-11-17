import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ReceiptService } from '../receipt-service';
import Swal from 'sweetalert2';
// import { ArService, Receipt } from '../ar.service';

@Component({
  selector: 'app-receipt',
  templateUrl: './receipt.component.html',
  styleUrls: ['./receipt.component.scss']
})
export class ReceiptComponent implements OnInit {


  
  receipts: any = [];
  filtered: any = [];
  searchValue = '';

  constructor(
    private router: Router,
    private receiptService: ReceiptService,
  ) {}

  ngOnInit(): void {
    this.loadReceipts();
  }

  loadReceipts() {
    this.receiptService.getReceipt().subscribe((res:any) => {
      this.receipts = res.data;
      this.filtered = [...this.receipts];
    });
  }

  onSearch(value: string) {
    this.searchValue = value.toLowerCase();
    this.filtered = this.receipts.filter(r =>
      (r.receiptNo || '').toLowerCase().includes(this.searchValue) ||
      (r.customerName || '').toLowerCase().includes(this.searchValue)
    );
  }

  goCreate() {
    this.router.navigate(['/financial/AR-receipt-create']);
  }

  edit(id: any) {
    debugger
  this.router.navigate(['/financial/AR-receipt-edit', id]); 
}

delete(id: number) {
  Swal.fire({
    title: 'Delete this receipt?',
    text: 'This action cannot be undone.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, delete',
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#d33',
    cancelButtonColor: '#6b7280',
    reverseButtons: true,
  }).then(result => {
    if (!result.isConfirmed) return;

    // Optional: loading state
    Swal.fire({
      title: 'Deleting…',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    this.receiptService.deleteReceipt(id).subscribe({
      next: _ => {
        Swal.fire({
          icon: 'success',
          title: 'Deleted',
          text: 'Receipt has been deleted.'
        });
        this.loadReceipts(); // or this.loadReceipts();
      },
      error: _ => {
        Swal.fire({
          icon: 'error',
          title: 'Delete failed',
          text: 'Something went wrong while deleting the receipt.'
        });
      }
    });
  });
}


}





