import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { SupplierComponent } from './supplier/supplier.component';
import { CreatesuppliersComponent } from './createsuppliers/createsuppliers.component';
import { FormsModule } from '@angular/forms';
import { NgxDatatableModule } from '@swimlane/ngx-datatable';
import { NgSelectModule } from '@ng-select/ng-select';


const routes: Routes = [
  { path: 'supplier', component: SupplierComponent },
  { path: 'supplier/create', component: CreatesuppliersComponent },
  { path: 'supplier/edit/:id', component: CreatesuppliersComponent }
  
];
@NgModule({
  declarations: [
    CreatesuppliersComponent,
    SupplierComponent
  ],
  imports: [
    CommonModule,
      RouterModule.forChild(routes),
       FormsModule,                  
    NgxDatatableModule,
    NgSelectModule
  ]
})
export class BusinesspartnersModule { }
