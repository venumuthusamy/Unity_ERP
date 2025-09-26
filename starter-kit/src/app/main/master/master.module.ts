import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';

import { ApprovalLevelComponent } from './approval-level/approval-level.component';
import { CitiesComponent } from './cities/cities.component';
import { NgxDatatableModule } from '@swimlane/ngx-datatable';
import { FormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { CountriesComponent } from './countries/countries.component';
import { UomComponent } from './uom/uom.component';
import { IncotermsComponent } from './incoterms/incoterms.component';
import { FlagissueComponent } from './flagissue/flagissue.component';

const routes: Routes = [
  { path: 'approval-level', component: ApprovalLevelComponent },
   { path: 'cities', component: CitiesComponent },
   { path: 'uom', component: UomComponent },
   { path: 'incoterms', component: IncotermsComponent },
   { path: 'flagIssue', component: FlagissueComponent },
   { path: 'countries', component: CountriesComponent },
];

@NgModule({
  declarations: [ApprovalLevelComponent, CountriesComponent,CitiesComponent, UomComponent, IncotermsComponent, FlagissueComponent],
  imports: [
    CommonModule,
    RouterModule.forChild(routes)  ,
    NgxDatatableModule,
    FormsModule,
    NgbModule// ✅ child routes
  ]
})
export class MasterModule {}
