import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-mobile-receiving',
  templateUrl: './mobile-receiving.component.html',
  styleUrls: ['./mobile-receiving.component.scss']
})
export class MobileReceivingComponent implements OnInit {

  mrPo: string = '';
  mrBarcode: string = '';
  mrOffline: boolean = false;

  mrRows: Array<{
    ts: Date;
    po: string;
    barcode: string;
    qty: number;
  }> = [];

  constructor() { }

  ngOnInit(): void {
    // You can load offline data here if needed
  }

  addScan(): void {
    if (!this.mrPo.trim() || !this.mrBarcode.trim()) {
      alert('Please enter both PO number and barcode');
      return;
    }

    const newRow = {
      ts: new Date(),
      po: this.mrPo.trim(),
      barcode: this.mrBarcode.trim(),
      qty: 1
    };

    this.mrRows.unshift(newRow);  // add new row to the top

    // Clear barcode input
    this.mrBarcode = '';

    if (this.mrOffline) {
      this.saveOffline();
    }
  }

  toggleOffline(): void {
    this.mrOffline = !this.mrOffline;
  }

  syncMobile(): void {
    // This function should send the mrRows to a server or sync it from offline
    if (this.mrRows.length === 0) {
      alert('No scans to sync.');
      return;
    }

    // Dummy sync simulation
    console.log('Syncing...', this.mrRows);

    alert('Sync completed.');
  }

  saveOffline(): void {
    // Example using localStorage for simplicity
    localStorage.setItem('mrRows', JSON.stringify(this.mrRows));
  }

  loadOffline(): void {
    const saved = localStorage.getItem('mrRows');
    if (saved) {
      this.mrRows = JSON.parse(saved);
    }
  }

  trackByIndex(index: number): number {
    return index;
  }

  gridColsClass(cols: number): string {
    return `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-${cols} gap-4`;
  }
}
