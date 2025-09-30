import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule, Routes } from '@angular/router';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';

import 'hammerjs';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { ToastrModule } from 'ngx-toastr';

import { CoreModule } from '@core/core.module';
import { CoreCommonModule } from '@core/common.module';
import { CoreSidebarModule, CoreThemeCustomizerModule } from '@core/components';

import { coreConfig } from 'app/app-config';

import { AppComponent } from 'app/app.component';
import { LayoutModule } from 'app/layout/layout.module';
import { SampleModule } from 'app/main/sample/sample.module';
import { NgxDatatableModule } from '@swimlane/ngx-datatable';
import { ChartofaccountComponent } from './main/financial/chartofaccount/chartofaccount-list/chartofaccount.component';

const appRoutes: Routes = [
  {
    path: 'pages',
    loadChildren: () =>
      import('./main/pages/pages.module').then(m => m.PagesModule)
  },
  {
    path: 'master',
    loadChildren: () =>
      import('./main/master/master.module').then(m => m.MasterModule)  // ✅ lazy loading only
  },
  {
    path: 'purchase',
    loadChildren: () => import('./main/purchase/purchase.module').then(m => m.PurchaseModule)
  },
   {
    path: 'financial',
    loadChildren: () => import('./main/financial/financial.module').then(m => m.FinancialModule)
  },
  {
    path: '',
    redirectTo: '/home',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: '/pages/miscellaneous/error'
  }
];

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    NgxDatatableModule,
    RouterModule.forRoot(appRoutes, {
      scrollPositionRestoration: 'enabled',
      relativeLinkResolution: 'legacy'
    }),
    TranslateModule.forRoot(),
    NgbModule,
    ToastrModule.forRoot(),
    CoreModule.forRoot(coreConfig),
    CoreCommonModule,
    CoreSidebarModule,
    CoreThemeCustomizerModule,
    LayoutModule,
    SampleModule
    // ❌ Removed MasterModule from here
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
