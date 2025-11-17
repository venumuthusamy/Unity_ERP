import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-ar-combine',
  templateUrl: './ar-combine.component.html',
  styleUrls: ['./ar-combine.component.scss']
})
export class ARCombineComponent implements OnInit {

  // active tab: 'invoices' | 'receipts' | 'aging'
  activeTab: 'invoices' | 'receipts' | 'aging' = 'invoices';

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const tab = params.get('tab') as 'invoices' | 'receipts' | 'aging' | null;
      if (tab) {
        this.activeTab = tab;
      }
    });
  }

  setTab(tab: 'invoices' | 'receipts' | 'aging') {
    this.activeTab = tab;
  }
}
