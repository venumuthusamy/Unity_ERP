import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';
import { IngredientRowDto, PlanRowDto, ProductionPlanService, SoHeaderDto } from '../production-plan.service';

@Component({
  selector: 'app-production-planning',
  templateUrl: './production-planning.component.html',
  styleUrls: ['./production-planning.component.scss']
})
export class ProductionPlanningComponent implements OnInit {
  soList: SoHeaderDto[] = [];
  selectedSoId: number | null = null;

  warehouseId = 1; // set from outlet/warehouse selection
  outletId = 1;
  createdBy = 'admin';

  isLoading = false;

  planRows: PlanRowDto[] = [];
  ingredients: IngredientRowDto[] = [];
  disableCreateButton: boolean;

  constructor(private api: ProductionPlanService,private router: Router) {}

  ngOnInit(): void {
    this.api.getSalesOrders().subscribe({
      next: (res) => (this.soList = res || []),
      error: () => Swal.fire('Error', 'Failed to load Sales Orders', 'error')
    });
  }
  shortageCount(): number {
    const list = this.ingredients || [];
    return list.filter(i => (i?.status || '') !== 'OK').length;
  }
  onSoChange() {
    if (!this.selectedSoId) {
      this.planRows = [];
      this.ingredients = [];
      return;
    }
    this.isLoading = true;
    this.api.getBySo(this.selectedSoId, this.warehouseId).subscribe({
      next: (res) => {
        this.planRows = res?.planRows || [];
        this.ingredients = res?.ingredients || [];
        this.isLoading = false;

        if (!this.planRows.length) {
          Swal.fire('No Recipe', 'No recipe found for SO items (RecipeHeader.FinishedItemId not matched).', 'warning');
        }
      },
      error: () => {
        this.isLoading = false;
        Swal.fire('Error', 'Failed to load plan', 'error');
      }
    });
  }

  savePlan() {
    if (!this.selectedSoId) return;

    this.api.savePlan({
      salesOrderId: this.selectedSoId,
      outletId: this.outletId,
      warehouseId: this.warehouseId,
      createdBy: this.createdBy
    }).subscribe({
      next: (res: any) => Swal.fire('Saved', `Production Plan Id: ${res?.productionPlanId}`, 'success'),
      error: () => Swal.fire('Error', 'Save failed', 'error')
    });
  }

  // createPR() {
  //   const shortage = this.ingredients.filter(x => x.status === 'Shortage');
  //   if (!shortage.length) return Swal.fire('OK', 'No shortage items.', 'success');

  //   // Here you can call your PR API later
  //   Swal.fire('Info', `Shortage items: ${shortage.length}. Hook PR insert API here.`, 'info');
  // }
  
  createPR() {
  const payload = {
  salesOrderId: this.selectedSoId,
  warehouseId: this.warehouseId,
  outletId: this.outletId,
  userId: Number(localStorage.getItem('id') || 0),
  userName: (localStorage.getItem('username') || '').trim(),
  deliveryDate: null,
  note: `Auto from Production Planning SO:${this.selectedSoId}`
};

  this.api.createPrFromRecipeShortage(payload).subscribe({
    next: (res) => {
      if (res?.prId > 0) {
        this.disableCreateButton = true
        Swal.fire('Success', `PR created. PR Id: ${res.prId}`, 'success');
      } else {
        this.disableCreateButton = false
        Swal.fire('Info', res?.message || 'No shortage items', 'info');
      }
    },
    error: (err) => {
      Swal.fire('Error', err?.error?.message || 'Failed', 'error');
    }
  });
}


  fmt(v: any) {
    const n = Number(v ?? 0);
    return (Math.round(n * 1000) / 1000).toString();
  }
}

