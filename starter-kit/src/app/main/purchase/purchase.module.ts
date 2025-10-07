import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { RouterModule } from '@angular/router';
import { CreatePurchaseRequestComponent } from './Purchase-Request/create-purchase-request/create-purchase-request.component';
import { PurchaseRequestListComponent } from './Purchase-Request/create-purchase-request/purchase-request-list/purchase-request-list.component';
import { NgxDatatableModule } from '@swimlane/ngx-datatable';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { PurchaseGoodreceiptComponent } from './purchase-goodreceipt/purchase-goodreceipt.component';
import { PurchaseGoodreceiptlistComponent } from './purchase-goodreceipt/purchase-goodreceiptlist/purchase-goodreceiptlist.component';
import { PurchaseOrdeListComponent } from './purchase-order/purchase-orde-list/purchase-orde-list.component';
import { PurchaseOrderCreateComponent } from './purchase-order/purchase-order-create/purchase-order-create.component';
import { SupplierInvoiceComponent } from './supplier-invoice/supplier-invoice.component';
import { SupplierInvoiceListComponent } from './supplier-invoice/supplier-invoice-list/supplier-invoice-list.component';

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
  },
  {
    path: 'list-Purchasegoodreceipt',
    component: PurchaseGoodreceiptlistComponent,
    data: { animation: 'listpurchasegoodreceipt' }
  },
   {
    path: 'createpurchasegoodreceipt',
    component: PurchaseGoodreceiptComponent,
    data: { animation: 'createpurchasegoodreceipt' }
  },
   {
    path: 'list-purchaseorder',
    component: PurchaseOrdeListComponent,
    data: { animation: 'listpurchaseorder' }
  },
   {
    path: 'create-purchaseorder',
    component: PurchaseOrderCreateComponent,
    data: { animation: 'createpurchaseorder' }
  },
  {
    path: 'edit-purchaseorder/:id',
    component: PurchaseOrderCreateComponent,
    data: { animation: 'editpurchaseorder' }
  },
   {
    path: 'Create-SupplierInvoice',
    component: SupplierInvoiceComponent,
    data: { animation: 'createSupplierInvoice' }
  },
   {
    path: 'Edit-SupplierInvoice/:id',
    component: SupplierInvoiceComponent,
    
  },
 {
    path: 'list-SupplierInvoice',
    component: SupplierInvoiceListComponent,
    data: { animation: 'listSupplierInvoice' }
  },
    {
    path: 'edit-purchasegoodreceipt/:id',
    component: PurchaseGoodreceiptComponent,
    data: { animation: 'editpurchasegoodreceipt' }
  },
];

@NgModule({
  declarations: [CreatePurchaseRequestComponent,PurchaseRequestListComponent,PurchaseGoodreceiptComponent, PurchaseGoodreceiptlistComponent,PurchaseOrdeListComponent, PurchaseOrderCreateComponent, SupplierInvoiceComponent, SupplierInvoiceListComponent],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    NgxDatatableModule,
    FormsModule,
    NgbModule,
    ReactiveFormsModule,
    SweetAlert2Module.forRoot()
  ]
})
export class PurchaseModule { }
