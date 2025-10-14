import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ItemMasterListComponent } from './item-master-list/item-master-list.component';
import { CreateItemMasterComponent } from './create-item-master/create-item-master.component';



@NgModule({
  declarations: [
    ItemMasterListComponent,
    CreateItemMasterComponent
  ],
  imports: [
    CommonModule
  ]
})
export class ItemMasterModule { }
