import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ChartofaccountComponent } from './chartofaccount/chartofaccount-list/chartofaccount.component';
import { NgxDatatableModule } from '@swimlane/ngx-datatable';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { CoreSidebarModule } from '@core/components';
import { JournalComponent } from './journal/journal/journal.component';
import { ChartOfAccountCreateComponent } from './chartofaccount/chartofaccountcreate/chartofaccountcreate.component';
import { NgSelectModule } from '@ng-select/ng-select';

import { FinanceTaxcodesComponent } from './tax-gst/finance-taxcodes/finance-taxcodes.component';
import { FinanceGstreturnsComponent } from './tax-gst/finance-gstreturns/finance-gstreturns.component';
import { FinanceGstdetailsComponent } from './tax-gst/finance-gstdetails/finance-gstdetails.component';
import { TaxGstComponent } from './tax-gst/taxmain/tax-gst.component';
import { CreateJournalComponent } from './journal/create-journal/create-journal.component';
import { AccountsPayableComponent } from './accounts-payable/accounts-payable.component';


const routes: Routes = [
  { path: 'ChartOfAccount', component: ChartofaccountComponent },
   { path: 'journal', component: JournalComponent },
    { path: 'create-journal', component: CreateJournalComponent },
   { path: 'tax-gst', component: TaxGstComponent },
   { path: 'AccountPayable', component: AccountsPayableComponent },
  
];

@NgModule({
  declarations: [
    ChartofaccountComponent,
   ChartOfAccountCreateComponent,
   JournalComponent,
   TaxGstComponent,
   FinanceTaxcodesComponent,
   FinanceGstreturnsComponent,
   FinanceGstdetailsComponent,
   CreateJournalComponent
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes)  ,
    NgxDatatableModule,
    FormsModule,
    NgbModule,
    CoreSidebarModule,
    ReactiveFormsModule,
      NgSelectModule,
  ]
})
export class FinancialModule { }
