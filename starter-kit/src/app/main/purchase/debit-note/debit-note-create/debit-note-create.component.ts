import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
type LineRow = { [k: string]: any };

@Component({
  selector: 'app-debit-note-create',
  templateUrl: './debit-note-create.component.html',
  styleUrls: ['./debit-note-create.component.scss']
})
export class DebitNoteCreateComponent implements OnInit {

  hover = false;
  // Returns
  retRows: LineRow[] = [];
  retAddRow() { this.retRows = [...this.retRows, {}]; }
  retRemoveRow(i: number) { this.retRows = this.retRows.filter((_, idx) => idx !== i); }
  retChange(i: number, key: string, val: any) {
    const copy = [...this.retRows]; copy[i] = { ...copy[i], [key]: val }; this.retRows = copy;
  }

  constructor(private router: Router,) { }
  
  ngOnInit(): void {
    
  }
  // Track by index for *ngFor
  trackByIndex(index: number) {
    return index;
  }
  gridColsClass(cols: number) {
    return {
      'grid grid-cols-1 gap-3': true,
      'md:grid-cols-1': cols === 1,
      'md:grid-cols-2': cols === 2,
      'md:grid-cols-3': cols === 3,
      'md:grid-cols-4': cols === 4,
      'md:grid-cols-5': cols === 5,
      'md:grid-cols-6': cols === 6,
    };
  }
 
  goToDebitNoteList(){
    this.router.navigate(['/purchase/list-debitnote']);
  }
}



