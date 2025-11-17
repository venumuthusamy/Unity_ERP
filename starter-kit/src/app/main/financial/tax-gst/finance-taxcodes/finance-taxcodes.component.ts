import { Component, OnInit } from '@angular/core';
import { TaxCodeService } from 'app/main/master/taxcode/taxcode.service';

@Component({
  selector: 'app-finance-taxcodes',
  templateUrl: './finance-taxcodes.component.html',
  styleUrls: ['./finance-taxcodes.component.scss']
})
export class FinanceTaxcodesComponent implements OnInit {

  rows: any[] = [];

  // TypeId → text
  taxTypes: { id: number; name: string }[] = [
    { id: 1, name: 'Input' },
    { id: 2, name: 'Output' }
    // add more if needed
  ];

  // Level → text (adjust to your enum)
  levelMap: { id: number; name: string }[] = [
    { id: 1, name: 'Line' },
    { id: 2, name: 'Invoice' },
    { id: 3, name: 'Line / Invoice' }
  ];

  constructor(private taxCodeService: TaxCodeService) {}

  ngOnInit(): void {
    this.loadTaxCodes();
  }

  loadTaxCodes(): void {
    this.taxCodeService.getTaxCode().subscribe((res: any) => {
      this.rows = res.data || [];
    });
  }

  getTypeName(typeId: number): string {
    const found = this.taxTypes.find(t => t.id === typeId);
    return found ? found.name : '-';
  }

  getLevelName(level: number | string): string {
    if (typeof level === 'string') {
      return level; // if API already sends "Line / Invoice"
    }
    const found = this.levelMap.find(l => l.id === level);
    return found ? found.name : '-';
  }



}
