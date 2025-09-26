import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';

import { ApprovalLevelComponent } from './approval-level/approval-level.component';
import { CitiesComponent } from './cities/cities.component';
import { NgxDatatableModule } from '@swimlane/ngx-datatable';
import { FormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { CountriesComponent } from './countries/countries.component';

const routes: Routes = [
  { path: 'approval-level', component: ApprovalLevelComponent },
   { path: 'cities', component: CitiesComponent }
];

@NgModule({
  declarations: [ApprovalLevelComponent, CountriesComponent,CitiesComponent],
  imports: [
    CommonModule,
    RouterModule.forChild(routes)  ,
    NgxDatatableModule,
    FormsModule,
    NgbModule// ✅ child routes
  ]
})
export class MasterModule {}
