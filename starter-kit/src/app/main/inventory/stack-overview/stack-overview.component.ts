import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-stack-overview',
  templateUrl: './stack-overview.component.html',
  styleUrls: ['./stack-overview.component.scss']
})
export class StackOverviewComponent implements OnInit {

  // 🔹 Dropdown options
  warehouses = [
    { id: 'all', name: 'All' },
    { id: 'central', name: 'Central' },
    { id: 'east', name: 'East' }
  ];

  // 🔹 Bound to ngModel
selectedWarehouse: any = null;
  showBelowMinOnly: boolean = false;
  showExpiringOnly: boolean = false;
  searchQuery: string = '';

  // 🔹 Table mock data
  stockItems = [
    {
      item: 'Rice 5kg',
      warehouse: 'Central',
      bin: 'A1',
      onHand: 120,
      min: 50,
      available: 120,
      expiry: '2025-11-12'
    },
    {
      item: 'Oil 2L',
      warehouse: 'Central',
      bin: 'B3',
      onHand: 60,
      min: 20,
      available: 60,
      expiry: '2025-08-01'
    }
  ];

  constructor() {}

  ngOnInit(): void {}

}
