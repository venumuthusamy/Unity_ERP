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
import { InvoiceComponent } from './AR/Invoice/invoice/invoice.component';
import { ReceiptComponent } from './AR/Receipt/receipt/receipt.component';
import { ARCombineComponent } from './AR/AR-Component/ar-combine/ar-combine.component';
import { ReceiptCreateComponent } from './AR/Receipt/receipt-create/receipt-create.component';
import { InvoiceCreateComponent } from './AR/Invoice/invoice-create/invoice-create.component';
import { GeneralLdegerComponent } from './general-ldeger/general-ledgerlist/general-ldeger.component';
import { AgingComponent } from './AR/Aging/aging/aging.component';
import { PeriodCloseFxComponent } from './period-close-fx/period-close-fx.component';
import { InvoiceEmailComponent } from './invoice-email/invoice-email.component';
import { TrialBalanceReportComponent } from './reports/trial-balance-report/trial-balance-report.component';


const routes: Routes = [
  { path: 'ChartOfAccount', component: ChartofaccountComponent },
  { path: 'journal', component: JournalComponent },
  { path: 'create-journal', component: CreateJournalComponent },
  { path: 'tax-gst', component: TaxGstComponent },
  { path: 'AccountPayable', component: AccountsPayableComponent },
  { path: 'AR', component: ARCombineComponent },
  { path: 'AR-invoice', component: InvoiceComponent },
  { path: 'AR-invoice-create', component: InvoiceCreateComponent },
  { path: 'AR-receipt', component: ReceiptComponent },
  { path: 'AR-receipt-create', component: ReceiptCreateComponent },
  { path: 'AR-receipt-edit/:id', component: ReceiptCreateComponent },
    { path: 'ledger', component: GeneralLdegerComponent },
{ path: 'Period-close', component: PeriodCloseFxComponent },
{ path: 'Invoice-email', component: InvoiceEmailComponent },
{ path: 'report', component: TrialBalanceReportComponent },

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
    CreateJournalComponent,
    InvoiceComponent,
    ReceiptComponent,
    ARCombineComponent,
    ReceiptCreateComponent,
    InvoiceCreateComponent,
    GeneralLdegerComponent,
    AgingComponent,
    PeriodCloseFxComponent,
    InvoiceEmailComponent,
    TrialBalanceReportComponent
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    NgxDatatableModule,
    FormsModule,
    NgbModule,
    CoreSidebarModule,
    ReactiveFormsModule,
    NgSelectModule,
  ]
})
export class FinancialModule { }
