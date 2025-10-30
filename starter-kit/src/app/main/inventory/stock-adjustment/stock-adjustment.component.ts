import { Component, EventEmitter, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { ItemMasterService } from '../item-master/item-master.service';
import { NgSelectComponent } from '@ng-select/ng-select';
import { StockIssueService } from 'app/main/master/stock-issue/stock-issue.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

type AdjType = 'Increase' | 'Decrease';
type ReasonCode = 'Damage' | 'Shrinkage' | 'Correction';

interface AdjustmentHeader {
  type: AdjType;
  reason: ReasonCode | null;
  threshold: number | null;
}

interface AdjustmentLine {
  itemId: number | null;
  item: string;
  sku?: string;

  available?: number | null;
  warehouseId?: number | null;
  warehouseName?: string | null;
  binId?: number | null;
  binName?: string | null;
  supplierId?: number | null;
  supplierName?: string | null;
  price?: number | null;

  qty: number | null;

  // 👉 Reason and Remarks now only used in modal
  reason?: ReasonCode | null;
  remarks?: string;
  type?: AdjType | null;
  faultyQty?: number | null;
}

type ItemOption = {
  id: number;
  sku: string;
  name: string;
  onHand?: number | null;
  reserved?: number | null;
  availableQty?: number | null;
  display: string;
};

@Component({
  selector: 'app-stock-adjustment',
  templateUrl: './stock-adjustment.component.html',
  styleUrls: ['./stock-adjustment.component.scss']
})
export class StockAdjustmentComponent implements OnInit {
  @ViewChild('itemSelect', { static: false }) itemSelect?: NgSelectComponent;

  adjTypes = [
    { label: 'Increase', value: 'Increase' as AdjType },
    { label: 'Decrease', value: 'Decrease' as AdjType }
  ];

  itemsLoading = false;
  itemOptions: ItemOption[] = [];
  itemSearch$ = new EventEmitter<string>();
  selectedItemId: number | null = null;

  adjHdr: AdjustmentHeader = {
    type: 'Decrease',
    reason: null,
    threshold: 0
  };

  adjLines: AdjustmentLine[] = [];
  gridLoading = false;
  stockIssueOptions: { id: number; name: string }[] = [];

  // 👇 Modal state
  selectedRow: AdjustmentLine | null = null;

  constructor(
    private itemMasterService: ItemMasterService,
    private stockIssueService: StockIssueService,
    private modalService: NgbModal
  ) {}

  ngOnInit(): void {
    this.loadItems();
    this.loadStockissue();
  }

  // 🔹 Open modal and bind selected row
  openAdjustModal(modalTpl: TemplateRef<any>, row: AdjustmentLine) {
    this.selectedRow = { ...row }; // clone the row
    this.modalService.open(modalTpl, { centered: true, size: 'md', backdrop: 'static' });
  }

  // 🔹 Submit adjustment from modal
  submitAdjustment() {
    if (!this.selectedRow) return;

    const index = this.adjLines.findIndex(l => l.itemId === this.selectedRow?.itemId);
    if (index > -1) {
      this.adjLines[index] = { ...this.selectedRow };
    }

    console.log('Adjusted row:', this.selectedRow);
    this.modalService.dismissAll();
  }

  cancelModal() {
    this.modalService.dismissAll();
  }

  // 🔹 Load items for dropdown
  private loadItems(): void {
    this.itemsLoading = true;
    this.itemMasterService.getAllItemMaster().subscribe({
      next: (res: any) => {
        const data = Array.isArray(res) ? res : (res?.data ?? []);
        this.itemOptions = (data || []).map((r: any) => {
          const id = Number(r.id ?? r.itemId ?? 0);
          const sku = String(r.sku ?? r.itemCode ?? '');
          const name = String(r.itemName ?? r.name ?? '');
          const onHand = Number(r.onHand ?? 0);
          const reserved = Number(r.reserved ?? 0);
          return {
            id,
            sku,
            name,
            onHand,
            reserved,
            availableQty: onHand - reserved,
            display: `${sku} — ${name}`
          } as ItemOption;
        });
      },
      error: (err) => console.error('Error loading items', err),
      complete: () => (this.itemsLoading = false)
    });
  }

  onItemPicked(val: any): void {
    const itemId = (val && typeof val === 'object') ? Number(val.id) : Number(val);
    if (!itemId) return;

    this.selectedItemId = itemId;
    this.loadGridData(itemId);
    this.itemSelect?.filter('');
  }

  loadGridData(itemId: number): void {
    this.gridLoading = true;

    this.itemMasterService.GetItemDetailsByItemId(itemId).subscribe({
      next: (res: any) => {
        const raw = Array.isArray(res) ? res
                 : Array.isArray(res?.data) ? res.data
                 : (res?.data ? [res.data] : []);
        const picked = this.itemOptions.find(x => x.id === itemId);

        this.adjLines = (raw || []).map((r: any) => ({
          itemId: Number(r.itemId ?? itemId),
          item: String(r.itemName ?? r.name ?? picked?.name ?? ''),
          sku: String(r.sku ?? picked?.sku ?? ''),
          available: Number(r.available ?? r.availableQty ?? 0),
          warehouseId: r.warehouseId != null ? Number(r.warehouseId) : null,
          warehouseName: String(r.warehouseName ?? r.warehoueName ?? ''),
          binId: r.binId != null ? Number(r.binId) : null,
          binName: String(r.binName ?? ''),
          supplierId: r.supplierId != null ? Number(r.supplierId) : null,
          supplierName: String(r.supplierName ?? ''),
          price: r.price != null ? Number(r.price) : null,
          qty: r.qty != null ? Number(r.qty) : 0,
          // Reason, remarks, type handled only in modal
          reason: null,
          remarks: '',
          type: null,
          faultyQty: null
        }));

        if (this.adjLines.length === 0 && picked) {
          this.adjLines = [{
            itemId,
            item: picked.name,
            sku: picked.sku,
            available: picked.availableQty ?? 0,
            warehouseId: null,
            warehouseName: null,
            binId: null,
            binName: null,
            supplierId: null,
            supplierName: null,
            price: null,
            qty: 0,
            reason: null,
            remarks: '',
            type: null,
            faultyQty: null
          }];
        }
      },
      error: (err) => {
        console.error('GetItemDetailsByItemId error', err);
      },
      complete: () => {
        this.gridLoading = false;
      }
    });
  }

  trackByIdx = (i: number) => i;

  onQtyChange(i: number): void {
    const l = this.adjLines[i];
    if (!l) return;
    if (l.qty !== null && !Number.isFinite(Number(l.qty))) l.qty = 0;
  }

  saveDraft(): void {
    const dto = this.buildDto();
    console.log('Saving draft (DTO):', dto);
    alert('Draft saved (dummy). Check console for payload.');
  }

  submitForApproval(): void {
    if (!this.adjHdr.reason) {
      alert('Please select a header reason.');
      return;
    }
    if (this.adjLines.length === 0) {
      alert('Please select an item to load rows.');
      return;
    }

    const dto = this.buildDto();
    console.log('Submitting (DTO):', dto);
    alert('Submitted (dummy). Check console for payload.');
  }

  private buildDto() {
    return {
      header: {
        type: this.adjHdr.type,
        reason: this.adjHdr.reason,
        threshold: Number(this.adjHdr.threshold ?? 0)
      },
      lines: this.adjLines.map(l => ({
        itemId: Number(l.itemId),
        sku: l.sku ?? null,
        qty: Number(l.qty ?? 0),
        reason: l.reason ?? null,
        remarks: l.remarks ?? '',
        supplierId: l.supplierId ?? null,
        warehouseId: l.warehouseId ?? null,
        binId: l.binId ?? null,
        price: l.price ?? null,
        type: l.type ?? null,
        faultyQty: l.faultyQty ?? null
      }))
    };
  }

  loadStockissue() {
    this.stockIssueService.getAllStockissue().subscribe(res => {
      const raw = Array.isArray(res?.data) ? res.data : [];
      this.stockIssueOptions = raw
        .filter((item: any) => item.isActive)
        .map((item: any) => ({
          id: Number(item.id),
          name: String(item.stockIssuesNames ?? item.name ?? '')
        }));
    });
  }

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

  compareById(o1: any, o2: any): boolean {
    return o1 && o2 ? o1.id === o2.id : o1 === o2;
  }
}
