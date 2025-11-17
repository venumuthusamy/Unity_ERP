import { Component, OnInit } from '@angular/core';
import { JournalService } from '../journalservice/journal.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-journal',
  templateUrl: './journal.component.html',
  styleUrls: ['./journal.component.scss']
})
export class JournalComponent implements OnInit {
journalDate: string | null = null;
reference: string = '';
  journalTypes = [
  { value: 'STANDARD',  text: 'Standard' },
  { value: 'RECURRING', text: 'Recurring' }
];

selectedType: string = 'STANDARD';
  journalList: any;
  constructor(private _journalService:JournalService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadJournals();
  }


  openRecurring(): void {
  // open recurring journal list / modal
}

newJournal(): void {
 this.router.navigate(['financial/create-journal']);
}


loadJournals() {
  this._journalService.GetAllJournals().subscribe((res: any) => {
    if (res.isSuccess && Array.isArray(res.data)) {
      this.journalList = res.data.map((x: any) => ({
        rowType: x.rowType,          // <-- keep it for UI logic
        accountName: x.headCode,
        credit: x.amount,
        description: x.headName,
        debit: x.debitAmount,
        selected: false              // <-- for checkbox
      }));
    } else {
      this.journalList = [];
    }
  });
}


submit(): void {
  if (!this.journalList || !this.journalList.length) {
    alert('No journal lines to submit.');
    return;
  }

  // Only MJ rows + checkbox tick panna rows
  const selected = this.journalList.filter(
    (x: any) => x.rowType === 'MJ' && x.selected
  );

  if (!selected.length) {
    alert('Please select at least one manual journal (MJ) row.');
    return;
  }

  // Ippo selected rows la backend-ku post panna use pannalaam
  console.log('Selected MJ rows:', selected);

  // TODO: backend call later
  // this._journalService.postSomething(selected).subscribe(...)
}

}
