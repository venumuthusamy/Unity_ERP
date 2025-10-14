import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-stock-transfer-create',
  templateUrl: './stock-transfer-create.component.html',
  styleUrls: ['./stock-transfer-create.component.scss']
})
export class StockTransferCreateComponent implements OnInit {

  warehouses = [
    { id: 'all', name: 'All' },
    { id: 'central', name: 'Central' },
    { id: 'east', name: 'East' }
  ];
  fromWarehouse: any = null;
  toWarehouse: any = null;
  reason: string = '';
  stockLines: Array<any> = [];

  constructor() { }

  ngOnInit(): void {
  }

   // Badge tone helpers (avoid Tailwind purge issues by mapping)
  badgeToneClasses(tone: 'blue' | 'green' | 'amber' | 'red' = 'blue') {
    const map: Record<string, { bg: string; text: string; border: string }> = {
      blue:  { bg: 'bg-blue-50',  text: 'text-blue-700',  border: 'border-blue-100'  },
      green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100' },
      amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
      red:   { bg: 'bg-red-50',   text: 'text-red-700',   border: 'border-red-100'   },
    };
    const t = map[tone] ?? map.blue;
    return `${t.bg} ${t.text} ${t.border}`;
  }
  onSaveDraft(): void {
  // build your payload here
  const payload = {
    fromWarehouseId: this.fromWarehouse,
    toWarehouseId: this.toWarehouse,
    reason: this.reason?.trim() || null,
    lines: this.stockLines
  };

  // TODO: replace with your service call
  console.log('Saving draft…', payload);
  // this.stockTransferService.saveDraft(payload).subscribe(...)
}

onSubmitForApproval(): void {
  const payload = {
    fromWarehouseId: this.fromWarehouse,
    toWarehouseId: this.toWarehouse,
    reason: this.reason?.trim(),
    lines: this.stockLines
  };
}
}


