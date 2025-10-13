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

const routes = [
  {
    path: 'Create-inventory',
    component: CreateInventoryComponent,
    data: { animation: 'CreateInventoryComponent' }
  },
    {
    path: 'list-stackoverview',
    component: StackOverviewComponent,
    data: { animation: 'list-stackoverview' }
  }
]

@NgModule({
  declarations: [
    CreateInventoryComponent,
    StackOverviewComponent
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
        NgxDatatableModule,
        FormsModule,
        NgbModule,
        ReactiveFormsModule,
        SweetAlert2Module.forRoot(),
        NgSelectModule
  ]
})
export class InventoryModule { }
