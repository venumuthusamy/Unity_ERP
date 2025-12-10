import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

type ArTab = 'invoices' | 'receipts' | 'advance' | 'aging';

@Component({
  selector: 'app-ar-combine',
  templateUrl: './ar-combine.component.html',
  styleUrls: ['./ar-combine.component.scss']
})
export class ARCombineComponent implements OnInit {

  activeTab: ArTab = 'invoices';

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const tab = params.get('tab') as ArTab | null;
      if (tab) {
        this.activeTab = tab;
      }
    });
  }

  setTab(tab: ArTab): void {
    this.activeTab = tab;
  }
}
