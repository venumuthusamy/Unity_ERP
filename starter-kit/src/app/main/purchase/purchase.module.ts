import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { RouterModule } from '@angular/router';
import { CreatePurchaseRequestComponent } from './create-purchase-request/create-purchase-request.component';
import { PurchaseRequestListComponent } from './purchase-request-list/purchase-request-list.component';
import { NgxDatatableModule } from '@swimlane/ngx-datatable';
import { FormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';

const routes = [
  {
    path: 'Create-PurchaseRequest',
    component: CreatePurchaseRequestComponent,
    data: { animation: 'createpurchaserequest' }
  },
  {
    path: 'Edit-PurchaseRequest/:id',
    component: CreatePurchaseRequestComponent,
    
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
    RouterModule.forChild(routes),
    NgxDatatableModule,
    FormsModule,
    NgbModule,
    SweetAlert2Module.forRoot()
  ]
})
export class PurchaseModule { }
