import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CreateInventoryComponent } from './create-inventory/create-inventory.component';
import { RouterModule } from '@angular/router';
import { NgxDatatableModule } from '@swimlane/ngx-datatable';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { StackOverviewComponent } from './stack-overview/stack-overview.component';
import { NgSelectModule } from '@ng-select/ng-select';
import { CreateItemMasterComponent } from './item-master/create-item-master/create-item-master.component';
import { ItemMasterListComponent } from './item-master/item-master-list/item-master-list.component';
import { StockTransferListComponent } from './stock-transfer/stock-transfer-list/stock-transfer-list.component';
import { StockTransferCreateComponent } from './stock-transfer/stock-transfer-create/stock-transfer-create.component';
import { StockTakeComponent } from './stock-take/stock-take/stock-take.component';
import { StackOverviewListComponent } from './stack-overview/stack-overview-list/stack-overview-list.component';
import { StockTakeListComponent } from './stock-take/stock-take-list/stock-take-list.component';
import { OverlayModule } from '@angular/cdk/overlay';
import { PortalModule } from '@angular/cdk/portal';
import { StockHistoryComponent } from './stock-transfer/stock-history/stock-history.component';
import { StockAdjustmentComponent } from './stock-adjustment/stock-adjustment.component';
import { SharedModule } from 'app/shared/shared.module';
import { StockReorderPlanningCreateComponent } from './stock-reorder-planning/stock-reorder-planning-create/stock-reorder-planning-create.component';
import { StockReorderPlanningListComponent } from './stock-reorder-planning/stock-reorder-planning-list/stock-reorder-planning-list.component';
const routes = [
  {
    path: 'Create-inventory',
    component: CreateInventoryComponent,
    data: { animation: 'CreateInventoryComponent' }
  },
  {
    path: 'list-stackoverview',
    component: StackOverviewListComponent,
    data: { animation: 'list-stackoverview' }
  },
  {
    path: 'create-stackoverview',
    component: StackOverviewComponent,
    data: { animation: 'create-stackoverview' }
  },
  {
    path: 'Create-itemmaster',
    component: CreateItemMasterComponent,
    data: { animation: 'CreateItemMasterComponent' }
  },
   {
      path: 'Edit-itemmaster/:id',
      component: CreateItemMasterComponent,
      
    },
  {
    path: 'List-itemmaster',
    component: ItemMasterListComponent,
    data: { animation: 'ItemMasterListComponent' }
  },
  {
    path: 'list-stocktransfer',
    component: StockTransferListComponent,
    data: { animation: 'list-stocktransfer' }
  },
    {
    path: 'stock-history',
    component: StockHistoryComponent,
    data: { animation: 'stock-history' }
  },
  {
    path: 'create-stocktransfer',
    component: StockTransferCreateComponent,
    data: { animation: 'create-stocktransfer' }
  },
  {
    path: 'edit-stocktransfer/:id',
    component: StockTransferCreateComponent,
    data: { animation: 'edit-stocktransfer' }
  },
  {
    path: 'list-stocktake',
    component: StockTakeListComponent,
    data: { animation: 'list-stocktake' }
  },
  {
    path: 'list-stockadjustment',
    component: StockAdjustmentComponent,
    data: { animation: 'list-stockadjustment' }
  },
  {
    path: 'create-stocktake',
    component: StockTakeComponent,
    data: { animation: 'create-stocktake' }
  },
   {
    path: 'edit-stocktake/:id',
    component: StockTakeComponent,
    data: { animation: 'edit-stocktake' }
  },
    {
    path: 'list-stockreorderplanning',
    component: StockReorderPlanningListComponent,
    data: { animation: 'list-stockreorderplanning' }
  },
   {
    path: 'create-stockreorderplanning',
    component: StockReorderPlanningCreateComponent,
    data: { animation: 'create-stockreorderplanning' }
  },
  {
    path: 'edit-stockreorderplanning/:id',
    component: StockReorderPlanningCreateComponent,
    data: { animation: 'edit-stockreorderplanning' }
  },
]

@NgModule({
  declarations: [
    CreateInventoryComponent,
    StackOverviewComponent,
    CreateItemMasterComponent,
    StockTransferListComponent,
    StockTransferCreateComponent,
    StockTakeComponent,
    StackOverviewListComponent,
    StockTakeListComponent,
     ItemMasterListComponent,
     StockHistoryComponent,
     StockAdjustmentComponent,
     StockReorderPlanningCreateComponent,
     StockReorderPlanningListComponent,
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    NgxDatatableModule,
    FormsModule,
    NgbModule,
    ReactiveFormsModule,
    SweetAlert2Module.forRoot(),
    NgSelectModule,
 OverlayModule,
    PortalModule,
    SharedModule
  ]
})
export class InventoryModule { }
