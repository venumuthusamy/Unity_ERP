import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollectionscreateComponent } from './collectionscreate/collectionscreate.component';
import { RouterModule } from '@angular/router';
import { CustomermastercreateComponent } from './customermastercreate/customermastercreate.component';
import { DeliveryordercreateComponent } from './deliveryordercreate/deliveryordercreate.component';
import { PermissionscreateComponent } from './permissionscreate/permissionscreate.component';
import { PickingPackingcreateComponent } from './picking-packingcreate/picking-packingcreate.component';
import { QuotationscreateComponent } from './quotationscreate/quotationscreate.component';
import { ReportscreateComponent } from './reportscreate/reportscreate.component';
import { ReturnCreditcreateComponent } from './return-creditcreate/return-creditcreate.component';
import { SalesInvoicecreateComponent } from './sales-invoicecreate/sales-invoicecreate.component';
import { SalesOrderCreateComponent } from './sales-order-create/sales-order-create.component';
import { SharedcreateComponent } from './sharedcreate/sharedcreate.component';
import { NgxDatatableModule } from '@swimlane/ngx-datatable';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { NgSelectModule } from '@ng-select/ng-select';

const routes = [
  {
    path: 'Create-collections',
    component: CollectionscreateComponent,
    data: { animation: 'createcollections' }
  },
   {
    path: 'Create-customer-master',
    component: CustomermastercreateComponent,
    data: { animation: 'createcustomermaster' }
  },
   {
    path: 'Delivery-order-create',
    component: DeliveryordercreateComponent,
    data: { animation: 'deliveryordercreateComponent' }
  },
   {
    path: 'Permission-create',
    component: PermissionscreateComponent,
    data: { animation: 'permissioncreateComponent' }
  },
   {
    path: 'Picking-packing-create',
    component: PickingPackingcreateComponent,
    data: { animation: 'PickingPackingcreateComponent' }
  },
    {
    path: 'Quotation-create',
    component: QuotationscreateComponent,
    data: { animation: 'QuotationscreateComponent' }
  },
    {
    path: 'Reports-create',
    component: ReportscreateComponent,
    data: { animation: 'ReportscreateComponent' }
  },
    {
    path: 'Return-credit-create',
    component: ReturnCreditcreateComponent,
    data: { animation: 'ReturnCreditcreateComponent' }
  },
    {
    path: 'Sales-Invoice-create',
    component: SalesInvoicecreateComponent,
    data: { animation: 'SalesInvoicecreateComponent' }
  },
    {
    path: 'Sales-Order-create',
    component: SalesOrderCreateComponent,
    data: { animation: 'SalesOrderCreateComponent' }
  },
    {
    path: 'Shared-create',
    component: SharedcreateComponent,
    data: { animation: 'SharedcreateComponent' }
  },
]

@NgModule({
  declarations: [
    CollectionscreateComponent,
    CustomermastercreateComponent,
    DeliveryordercreateComponent,
    PermissionscreateComponent,
    PickingPackingcreateComponent,
    QuotationscreateComponent,
    ReportscreateComponent,
    ReturnCreditcreateComponent,
    SalesInvoicecreateComponent,
    SalesOrderCreateComponent,
    SharedcreateComponent
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
  ]
})
export class SalesModule { }
