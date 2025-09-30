import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ChartofaccountComponent } from './chartofaccount/chartofaccount-list/chartofaccount.component';
import { NgxDatatableModule } from '@swimlane/ngx-datatable';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { CoreSidebarModule } from '@core/components';
import { ChartOfAccountCreateComponent } from './chartofaccount/chartofaccountcreate/chartofaccountcreate.component';

const routes: Routes = [
  { path: 'ChartOfAccount', component: ChartofaccountComponent },
  
];

@NgModule({
  declarations: [
    ChartofaccountComponent,
   ChartOfAccountCreateComponent
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes)  ,
    NgxDatatableModule,
    FormsModule,
    NgbModule,
    CoreSidebarModule,
    ReactiveFormsModule
  ]
})
export class FinancialModule { }
