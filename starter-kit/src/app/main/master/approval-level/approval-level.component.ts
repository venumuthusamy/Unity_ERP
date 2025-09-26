import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { DatatableComponent, ColumnMode } from '@swimlane/ngx-datatable';
import { environment } from 'environments/environment';

@Component({
  selector: 'app-approval-level',
  templateUrl: './approval-level.component.html',
  styleUrls: ['./approval-level.component.scss'],
 encapsulation: ViewEncapsulation.None
})
export class ApprovalLevelComponent implements OnInit {
 // Using any[]
rows: any[] = [];
tempData: any[] = [];

  public ColumnMode = ColumnMode;
  public selectedOption = 10;
  isAdditionalFieldAdded = false;
  public searchValue = '';
 
  public ISCREATE;
  public ISUPDATE;
  public ISDELETE;
  public roleId;
  colors = ['bg-light-primary', 'bg-light-success', 'bg-light-danger', 'bg-light-warning', 'bg-light-info'];
  @ViewChild(DatatableComponent) table: DatatableComponent;
  constructor( ) {}

    //Filter Method
  filterUpdate(event) {

    const val = event.target.value.toLowerCase();
    const temp = this.tempData.filter(function (d) {

      if (d.orgName.toLowerCase().indexOf(val) !== -1 || !val) {
        return d.orgName.toLowerCase().indexOf(val) !== -1 || !val;
      }
      if (d.orgCode.toLowerCase().indexOf(val) !== -1 || !val) {
        return d.orgCode.toLowerCase().indexOf(val) !== -1 || !val;
      }

    });
    this.rows = temp;
    this.table.offset = 0;
  }
  openDetails(guid, id) {
   
  }

  ngOnInit(): void {
    this.getAllOrganizationList();


  }




getAllOrganizationList() {
    // Sample Data
    this.tempData = [
      {
        id: 1,
        orgName: 'Alpha Corp',
        emailAddress: 'contact@alphacorp.com',
        phoneNo: '1234567890',
        contactName: 'John Doe',
        isActive: true
      },
      {
        id: 2,
        orgName: 'Beta Industries',
        emailAddress: 'info@betaind.com',
        phoneNo: '9876543210',
        contactName: 'Jane Smith',
        isActive: false
      },
      {
        id: 3,
        orgName: 'Gamma Solutions',
        emailAddress: 'support@gammasolutions.com',
        phoneNo: '5555555555',
        contactName: 'Alice Johnson',
        isActive: true
      },
      {
        id: 4,
        orgName: 'Delta Services',
        emailAddress: 'sales@deltaservices.com',
        phoneNo: '4444444444',
        contactName: 'Bob Brown',
        isActive: false
      }
    ];

    // Assign to rows for the table
    this.rows = [...this.tempData];
  }


  getRandomColor(index: number): string {     
    return this.colors[index % this.colors.length]; 
  }


  getInitial(orgName: string): string {
    // Get the first two characters, or the entire string if it's shorter
    const initials = orgName.slice(0, 2).toUpperCase();
    return initials;
  }
}
