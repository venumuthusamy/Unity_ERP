import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-customer-master-list',
  templateUrl: './customer-master-list.component.html',
  styleUrls: ['./customer-master-list.component.scss'],
  encapsulation:ViewEncapsulation.None,
})
export class CustomerMasterListComponent implements OnInit {
    public searchValue = '';
  public selectedOption = 10;
  constructor(private router: Router) { }

  ngOnInit(): void {
  }

    filterUpdate(event: any) {
  
}

 Add() {
  this.router.navigate(['/Businesspartners/customermaster/create']);
}

}
