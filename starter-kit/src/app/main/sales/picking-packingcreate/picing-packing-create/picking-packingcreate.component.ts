import { Component, OnInit } from '@angular/core';
import { Observable, of } from 'rxjs';

type SoLite = { id: number; number: string; customerName: string; soDate?: string };
type Carton = { id: number; name: string };

type Row = {
  id: number;           // SO line id
  itemId: number;
  sku: string;
  itemName: string;
  uom: string;
  pendingQty: number | null;
  deliverQty: number;
  pickBin?: string | null;
  cartonId?: number | null;
};

@Component({
  selector: 'app-picking-packingcreate',
  templateUrl: './picking-packingcreate.component.html',
  styleUrls: ['./picking-packingcreate.component.scss']
})
export class PickingPackingcreateComponent implements OnInit {
  // -------- Header / dropdown ----------
  soList: SoLite[] = [];
  selectedSoId: number | null = null;
  soHdr?: { customerName?: string; soDate?: string };

  // -------- Grid ----------
  rows: Row[] = [];
  totalDeliverQty = 0;

  // Cartons (replace with API data)
  cartonOptions: Carton[] = [
    { id: 1, name: 'Carton 1' },
    { id: 2, name: 'Carton 2' },
    { id: 3, name: 'Carton 3' }
  ];

  constructor(
    // TODO: inject your services here
    // private soService: SalesOrdersService,
    // private pickService: PickingService,
    // private toast: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadSoList().subscribe(list => (this.soList = list));
  }

  // ===================== Data loads (replace with real API) =====================
  loadSoList(): Observable<SoLite[]> {
    // return this.soService.getLite(); // example
    return of([
      { id: 101, number: 'SO-000101', customerName: 'Alpha Foods', soDate: '2025-11-06' },
      { id: 102, number: 'SO-000102', customerName: 'Bravo Retail', soDate: '2025-11-07' }
    ]);
  }

  loadSoLines(soId: number): Observable<Row[]> {
    // return this.pickService.getSoLines(soId);
    const mock: Record<number, Row[]> = {
      101: [
        { id: 1, itemId: 11, sku: 'UHT-1L', itemName: 'UHT Milk 1L', uom: 'EA', pendingQty: 50, deliverQty: 50, pickBin: 'A-01-01', cartonId: 1 },
        { id: 2, itemId: 12, sku: 'CRM-500', itemName: 'Cream 500ml', uom: 'EA', pendingQty: 20, deliverQty: 0,  pickBin: 'A-01-02', cartonId: null }
      ],
      102: [
        { id: 3, itemId: 21, sku: 'JUI-200', itemName: 'Juice 200ml', uom: 'EA', pendingQty: 100, deliverQty: 0, pickBin: 'B-02-05', cartonId: 2 }
      ]
    };
    return of(mock[soId] ?? []);
  }
  // ============================================================================

  // Dropdown change -> load header + lines
  onSoChanged(soId: number | null) {
    this.rows = [];
    this.totalDeliverQty = 0;
    this.soHdr = undefined;

    if (!soId) return;

    const so = this.soList.find(s => s.id === soId);
    if (so) this.soHdr = { customerName: so.customerName, soDate: so.soDate };

    this.loadSoLines(soId).subscribe(lines => {
      this.rows = (lines ?? []).map(l => ({ ...l, deliverQty: +(+l.deliverQty || 0).toFixed(2) }));
      this.recalcTotals();
    });
  }

  // Totals / helpers
  recalcTotals() {
    this.totalDeliverQty = (this.rows ?? []).reduce((sum, r) => sum + (+r.deliverQty || 0), 0);
  }

  hasAnyDeliverQty(): boolean {
    return (this.rows ?? []).some(r => (r.deliverQty ?? 0) > 0);
  }

  trackByLine = (_: number, r: Row) => r.id;

  // Header actions
  resetForm() {
    this.selectedSoId = null;
    this.soHdr = undefined;
    this.rows = [];
    this.totalDeliverQty = 0;
  }

  // Save / Generate DO
  saveDo() {
    if (!this.selectedSoId || !this.hasAnyDeliverQty()) {
      // this.toast.warning('Select a Sales Order and enter at least one quantity.');
      return;
    }

    const payload = {
      soId: this.selectedSoId,
      lines: this.rows
        .filter(r => (r.deliverQty ?? 0) > 0)
        .map(r => ({
          soLineId: r.id,
          itemId: r.itemId,
          qty: r.deliverQty,
          uom: r.uom,            // include uomId if you track it
          pickBin: r.pickBin,
          cartonId: r.cartonId ?? null
        }))
    };

    // TODO: call your API
    // this.pickService.createDo(payload).subscribe(() => { ... });
    console.log('Generate DO payload', payload);
  }
}
