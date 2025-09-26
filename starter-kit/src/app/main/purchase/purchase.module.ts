import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { RouterModule } from '@angular/router';
import { CreatePurchaseRequestComponent } from './create-purchase-request/create-purchase-request.component';
import { PurchaseRequestListComponent } from './purchase-request-list/purchase-request-list.component';

const routes = [
  {
    path: 'Create-PurchaseRequest',
    component: CreatePurchaseRequestComponent,
    data: { animation: 'createpurchaserequest' }
  },
  {
    path: 'list-PurchaseRequest',
    component: PurchaseRequestListComponent,
    data: { animation: 'listpurchaserequest' }
  }
];

@NgModule({
  declarations: [CreatePurchaseRequestComponent,PurchaseRequestListComponent],
  imports: [
    CommonModule,
    RouterModule.forChild(routes)
  ]
})
export class PurchaseModule { }
