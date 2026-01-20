import { Component, OnInit } from '@angular/core';
import { ItemMasterService } from '../../item-master/item-master.service';
import { WarehouseService } from 'app/main/master/warehouse/warehouse.service';
import { MaterialRequisitionService } from '../material-requisition.service';
import Swal from 'sweetalert2';
import { error } from 'console';
import { Router } from '@angular/router';

type IdName = { id: number; name: string };

type ItemMaster = {
  id: number;
  name: string;      // itemName
  sku: string;       // itemCode
  uom: string;       // uomName
  uomId: number | null;
};

type MrqHeader = {
  OutletId: number | null;
  requesterName: string;
  date: string; // yyyy-mm-dd
};

type MrqLine = {
  itemId: number | null;
  sku: string;
  uom: string;
  uomId: number | null;
  qty: number | null;
};

@Component({
  selector: 'app-material-requisition-create',
  templateUrl: './material-requisition-create.component.html',
  styleUrls: ['./material-requisition-create.component.scss']
})
export class MaterialRequisitionCreateComponent implements OnInit {
  OutletList: any[] = [];

  // optional hardcoded
  outlets: IdName[] = [
    { id: 1, name: 'Central Warehouse' },
    { id: 2, name: 'Outlet - T Nagar' },
    { id: 3, name: 'Outlet - Velachery' }
  ];

  items: ItemMaster[] = [];

  header: MrqHeader = {
    OutletId: null,
    requesterName: '',
    date: this.todayISO()
  };

  lines: MrqLine[] = [];

  isSaving = false;

  constructor(
    private itemMasterService: ItemMasterService,
    private outletService: WarehouseService,
    private mrqService: MaterialRequisitionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.lines = [this.emptyRow()];
    this.loadItem();
    this.loadOutlets();

    // ✅ requesterName from localStorage
    this.header.requesterName = String(localStorage.getItem('username') ?? '');
  }

  loadItem(): void {
    this.itemMasterService.getAllItemMaster().subscribe({
      next: (res: any) => {
        const data = res?.data ?? [];

        this.items = (data || []).map((x: any) => ({
          id: Number(x.id),
          name: String(x.itemName ?? ''),
          sku: String(x.itemCode ?? ''),
          uom: String(x.uomName ?? ''),
          uomId: x.uomId != null ? Number(x.uomId) : null
        }));

        this.items.sort((a, b) => a.name.localeCompare(b.name));
      },
      error: (err) => {
        console.error('Item load error:', err);
        this.items = [];
      }
    });
  }

  loadOutlets(): void {
    this.outletService.getWarehouse().subscribe({
      next: (res: any) => (this.OutletList = res?.data ?? []),
      error: (err) => {
        console.error('Outlet load error:', err);
        this.OutletList = [];
      }
    });
  }

  addRow(): void {
    this.lines.push(this.emptyRow());
  }

  removeRow(index: number): void {
    if (this.lines.length === 1) return;
    this.lines.splice(index, 1);
  }

  onItemChanged(rowIndex: number): void {
    const row = this.lines[rowIndex];
    const selectedId = row.itemId != null ? Number(row.itemId) : null;

    const item = this.items.find(x => x.id === selectedId);

    if (!item) {
      row.sku = '';
      row.uom = '';
      row.uomId = null;
      return;
    }

    row.sku = item.sku;
    row.uom = item.uom;
    row.uomId = item.uomId;
  }

save(): void {
  if (this.isSaving) return;

  if (!this.header.OutletId) {
    Swal.fire('Validation', 'Please select Outlet', 'warning');
    return;
  }

  const requester = (this.header.requesterName ?? '').trim();
  if (!requester) {
    Swal.fire('Validation', 'Requester name missing', 'warning');
    return;
  }

  const validLines = this.lines
    .filter(l => l.itemId && (l.qty ?? 0) > 0)
    .map(l => {
      const item = this.items.find(x => x.id === Number(l.itemId));

      return {
        itemId: Number(l.itemId),
        itemCode: item?.sku ?? l.sku ?? '',
        itemName: item?.name ?? '',
        uomId: item?.uomId ?? l.uomId ?? null,
        uomName: item?.uom ?? l.uom ?? '',
        qty: Number(l.qty)
      };
    });

  if (validLines.length === 0) {
    Swal.fire('Validation', 'Please add at least 1 item with Qty', 'warning');
    return;
  }

  const payload = {
    outletId: Number(this.header.OutletId),
    requesterName: requester,
    reqDate: this.header.date,
    status: 1,
    remarks: null,
    createdBy: requester,
    isActive: true,
    lines: validLines
  };

  console.log('MRQ payload:', payload);

  this.isSaving = true;

  // optional: loading popup
  Swal.fire({
    title: 'Saving...',
    text: 'Please wait',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  this.mrqService.CreateMaterialRequest(payload).subscribe({
    next: (res: any) => {
      this.isSaving = false;

      if (res?.isSuccess === false) {
        Swal.fire('Material Requisition', res?.message ?? 'Save failed', 'error');
             this.router.navigate(['/Inventory/list-material-requisition']);
        return;
      }

      const savedReqNo = res?.data?.reqNo || res?.data?.ReqNo || res?.reqNo;

      Swal.fire(
        'Material Requisition',
        savedReqNo
          ? `Saved Successfully<br><b>${savedReqNo}</b>`
          : (res?.message ?? 'Saved successfully'),
        'success'
      );
     this.router.navigate(['/Inventory/list-material-requisition']);
      // reset
      this.header.OutletId = null;
      this.lines = [this.emptyRow()];
    },
    error: (err) => {
      this.isSaving = false;
      console.error('MRQ save error:', err);

      Swal.fire(
        'Server Error',
        err?.error?.message ?? 'Server error while saving',
        'error'
      );
    }
  });
}


  close(): void {
    this.router.navigate(['/Inventory/list-material-requisition']);
  }

  private emptyRow(): MrqLine {
    return { itemId: null, sku: '', uom: '', uomId: null, qty: null };
  }

  private todayISO(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
