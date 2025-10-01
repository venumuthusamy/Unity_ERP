import { Component, HostListener, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ChartofaccountService } from 'app/main/financial/chartofaccount/chartofaccount.service';
import { DepartmentService } from 'app/main/master/department/department.service';
import { ItemsService } from 'app/main/master/items/items.service';
import { LocationService } from 'app/main/master/location/location.service';
import { UomService } from 'app/main/master/uom/uom.service';
import Swal from 'sweetalert2';
import { PurchaseService } from '../purchase.service';

@Component({
  selector: 'app-create-purchase-request',
  templateUrl: './create-purchase-request.component.html',
  styleUrls: ['./create-purchase-request.component.scss']
})
export class CreatePurchaseRequestComponent implements OnInit {
 prStep = 0;
  prSteps = ['Header', 'Lines', 'Review'];
  hover = false;
  selectedRequest: any = null;
  showEditForm: boolean = false;
  selectedDepartmentID: string = '';
  allPurchaseRequests: any[] = [];

  prHeader: any = {
    requester: '',
    departmentID: 0,
    neededBy: null,
    description: '',
    multiLoc: false,
    oversea: false
  };

  prLines: any[] = [];
  purchaseRequests: any[] = [];
  isEditMode = false;
  departments: any[] = [];
  activeDropdown: string | null = null;
  dropdownOpen = false;
  searchText: string = '';
  filteredDepartments = [...this.departments];
  parentHeadList: any;
  accountHeads: any;
  itemsList: any = [];
  uomList: any = [];
  locationList: any = [];
  minDate: string = '';
  public prid: any;

  // Modal state
  showModal = false;
  modalLine: any = {};

  constructor(
    private purchaseService: PurchaseService,
    private router: Router,
    private route: ActivatedRoute,
    private deptService: DepartmentService,
    private itemService: ItemsService,
    private chartOfAccountService: ChartofaccountService,
    private uomService: UomService,
    private locationService: LocationService
  ) {}

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown-wrapper')) {
      this.dropdownOpen = false;
      this.prLines.forEach(line => {
        line.dropdownOpen = false;
        line.uomDropdownOpen = false;
        line.locationDropdownOpen = false;
      });
      if (this.modalLine) {
        this.modalLine.dropdownOpen = false;
        this.modalLine.uomDropdownOpen = false;
        this.modalLine.locationDropdownOpen = false;
      }
    }
  }

  ngOnInit() {
    this.mindate();
    this.loadRequests();
    this.loadDepartments();
    this.loadItems();
    this.loadUom();
    this.loadLocation();
    this.filteredDepartments = [...this.departments];

    this.route.paramMap.subscribe((params: any) => {
      this.prid = parseInt(params.get('id'));
      if (this.prid) {
        this.isEditMode = true;
        this.purchaseService.GetPurchaseById(this.prid).subscribe((data: any) => {
          this.editRequest(data);
          this.prStep = 0;
        });
      }
    });
  }

  // =======================
  // Utility Methods
  // =======================
  badgeClass(color: string) {
    return `px-2 py-1 rounded-full text-xs font-medium bg-${color}-100 text-${color}-800`;
  }

  gridColsClass(cols: number) {
    return {
      'grid grid-cols-1 gap-3': true,
      'md:grid-cols-1': cols === 1,
      'md:grid-cols-2': cols === 2,
      'md:grid-cols-3': cols === 3,
      'md:grid-cols-4': cols === 4,
      'md:grid-cols-5': cols === 5,
      'md:grid-cols-6': cols === 6
    };
  }

  trackByIndex(index: number): number {
    return index;
  }

  prGo(step: number) {
    this.prStep += step;
  }

  prRemoveLine(index: number) {
    this.prLines.splice(index, 1);
  }

  mindate() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    this.minDate = `${yyyy}-${mm}-${dd}`;
  }

  // =======================
  // Loading Methods
  // =======================
  loadDepartments() {
    this.deptService.getDepartment().subscribe((data: any) => {
      this.departments = data;
      this.filteredDepartments = data;
    });
  }

  loadItems() {
    this.chartOfAccountService.getAllChartOfAccount().subscribe((data) => {
      this.accountHeads = data;
      this.parentHeadList = this.accountHeads.map((head: any) => ({
        value: head.id,
        label: this.buildFullPath(head)
      }));

      this.itemService.getAllItem().subscribe((data: any) => {
        this.itemsList = data.map((item: any) => {
          const matched = this.parentHeadList.find((head: any) => head.value === item.budgetLineId);
          return { ...item, label: matched ? matched.label : null };
        });
      });
    });
  }

  loadUom() {
    this.uomService.getAllUom().subscribe((data: any) => {
      this.uomList = data;
    });
  }

  loadLocation() {
    // this.locationService.getAll().subscribe((data: any) => {
    //   this.locationList = data;
    // });
  }

  buildFullPath(item: any): string {
    let path = item.headName;
    let current = this.accountHeads.find((x: any) => x.id === item.parentHead);
    while (current) {
      path = `${current.headName} >> ${path}`;
      current = this.accountHeads.find((x: any) => x.id === current.parentHead);
    }
    return path;
  }

  // =======================
  // Modal Methods
  // =======================
  prAddLine() {
    this.showModal = true;
    this.resetModal();
  }
addAnotherPR() {
  if (this.modalLine.itemSearch && this.modalLine.qty) {
    // Deep copy using JSON
    const lineCopy = JSON.parse(JSON.stringify(this.modalLine));
    this.prLines.push(lineCopy); // push independent copy
    this.resetModal();
    this.showModal = false; // close modal
  } else {
    Swal.fire({
      icon: 'warning',
      title: 'Required',
      text: 'Item and Qty are required',
      confirmButtonColor: '#0e3a4c'
    });
  }
}

  resetModal() {
    this.modalLine = {
      itemSearch: '',
      itemCode: '',
      qty: null,
      uomSearch: '',
      locationSearch: '',
      budget: '',
      remarks: '',
      filteredItems: [],
      filteredUoms: [],
      filteredLocations: []
    };
  }

  closeModal() {
    this.showModal = false;
  }

  // addAnotherPR() {
  //   if (this.modalLine.itemSearch && this.modalLine.qty) {
  //     this.prLines.push({ ...this.modalLine });
  //     this.resetModal();
  //   } else {
  //     Swal.fire({ icon: 'warning', title: 'Required', text: 'Item and Qty are required', confirmButtonColor: '#0e3a4c' });
  //   }
  // }

  // =======================
  // Department Dropdown
  // =======================
  filterDepartments() {
    const query = this.searchText.toLowerCase();
    this.filteredDepartments = this.departments.filter(d =>
      d.departmentName.toLowerCase().includes(query)
    );
  }

  toggleDropdown(force?: boolean) {
    this.dropdownOpen = force !== undefined ? force : !this.dropdownOpen;
  }

  selectDepartment(dept: any) {
    this.prHeader.departmentID = dept.id;
    this.searchText = dept.departmentName;
    this.dropdownOpen = false;
  }

  // =======================
  // Item Dropdown (Lines & Modal)
  // =======================
  onItemFocus(line: any) {
    line.filteredItems = [...this.itemsList];
    line.dropdownOpen = true;
  }

  filterItems(line: any) {
    const query = line.itemSearch.toLowerCase();
    line.filteredItems = this.itemsList.filter(
      (item: any) =>
        item.itemName.toLowerCase().includes(query) ||
        item.itemCode.toLowerCase().includes(query)
    );
  }

  selectItem(line: any, item: any) {
    line.itemSearch = item.itemName;
    line.itemName = item.itemName;
    line.itemCode = item.itemCode;
    line.uom = item.uomName;
    line.uomSearch = item.uomName;
    line.budget = item.label || '';
    line.dropdownOpen = false;
  }

  onModalItemFocus() {
    this.modalLine.filteredItems = [...this.itemsList];
    this.modalLine.dropdownOpen = true;
  }

  filterModalItems() {
    const query = this.modalLine.itemSearch.toLowerCase();
    this.modalLine.filteredItems = this.itemsList.filter(
      (item: any) =>
        item.itemName.toLowerCase().includes(query) ||
        item.itemCode.toLowerCase().includes(query)
    );
  }

  selectModalItem(item: any) {
    this.modalLine.itemSearch = item.itemName;
    this.modalLine.itemCode = item.itemCode;
    this.modalLine.uomSearch = item.uomName;
    this.modalLine.budget = item.label || '';
    this.modalLine.dropdownOpen = false;
    this.modalLine.filteredItems = [];
  }

  // =======================
  // UOM Dropdown
  // =======================
  onUomFocus(line: any) {
    line.filteredUoms = [...this.uomList];
    line.uomDropdownOpen = true;
  }

  filterUoms(line: any) {
    const search = line.uomSearch?.toLowerCase() || '';
    line.filteredUoms = this.uomList.filter((u: any) =>
      u.name.toLowerCase().includes(search)
    );
  }

  selectUom(line: any, uom: any) {
    line.uom = uom.name;
    line.uomSearch = uom.name;
    line.uomDropdownOpen = false;
    this.modalLine.filteredUoms = [];
  }

  onModalUomFocus() {
    this.modalLine.filteredUoms = [...this.uomList];
    this.modalLine.uomDropdownOpen = true;
  }

  filterModalUoms() {
    const search = this.modalLine.uomSearch?.toLowerCase() || '';
    this.modalLine.filteredUoms = this.uomList.filter((u: any) =>
      u.name.toLowerCase().includes(search)
    );
  }

  selectModalUom(uom: any) {
    this.modalLine.uomSearch = uom.name;
    this.modalLine.uom = uom.name;
    this.modalLine.uomDropdownOpen = false;
    this.modalLine.filteredLocations = [];
  }

  // =======================
  // Location Dropdown
  // =======================
  onLocationFocus(line: any) {
    line.filteredLocations = [...this.locationList];
    line.locationDropdownOpen = true;
  }

  filterLocations(line: any) {
    const search = line.locationSearch?.toLowerCase() || '';
    line.filteredLocations = this.locationList.filter((loc: any) =>
      loc.name.toLowerCase().includes(search)
    );
    line.locationDropdownOpen = true;
  }

  selectLocation(line: any, location: any) {
    line.locationSearch = location.name;
    line.location = location.name;
    line.locationDropdownOpen = false;
  }

  onModalLocationFocus() {
    this.modalLine.filteredLocations = [...this.locationList];
    this.modalLine.locationDropdownOpen = true;
  }

  filterModalLocations() {
    const search = this.modalLine.locationSearch?.toLowerCase() || '';
    this.modalLine.filteredLocations = this.locationList.filter((loc: any) =>
      loc.name.toLowerCase().includes(search)
    );
  }

  selectModalLocation(location: any) {
    this.modalLine.locationSearch = location.name;
    this.modalLine.location = location.name;
    this.modalLine.locationDropdownOpen = false;
  }

  // =======================
  // Save Request
  // =======================
  saveRequest() {
    const payload = {
      requester: this.prHeader.requester,
      departmentID: this.prHeader.departmentID,
      deliveryDate: this.prHeader.neededBy,
      description: this.prHeader.description,
      multiLoc: this.prHeader.multiLoc,
      oversea: this.prHeader.oversea,
      PurchaseRequestNo: '',
      prLines: JSON.stringify(this.prLines)
    };

    if (this.prHeader.id && this.prHeader.id > 0) {
      this.purchaseService.update(this.prHeader.id, payload).subscribe({
        next: (res: any) => {
          Swal.fire({ icon: 'success', title: 'Updated', text: res.message || 'Updated successfully', confirmButtonColor: '#0e3a4c' });
          this.loadRequests();
          this.resetForm();
        },
        error: (err: any) => console.error(err)
      });
    } else {
      this.purchaseService.create(payload).subscribe({
        next: (res: any) => {
          Swal.fire({ icon: 'success', title: 'Created', text: res.message || 'Created successfully', confirmButtonColor: '#0e3a4c' });
          this.loadRequests();
          this.resetForm();
        },
        error: (err: any) => console.error(err)
      });
    }
  }

  loadRequests() {
    this.purchaseService.getAll().subscribe({
      next: (res: any) => {
        this.purchaseRequests = res.data.map((req: any) => ({
          ...req,
          prLines: req.prLines ? JSON.parse(req.prLines) : []
        }));
      },
      error: (err: any) => console.error(err)
    });
  }

  resetForm() {
    this.prHeader = { requester: '', departmentID: 0, neededBy: null, description: '', multiLoc: false, oversea: false };
    this.searchText = '';
    this.filteredDepartments = [];
    this.dropdownOpen = false;
    this.prLines = [];
    this.prStep = 0;
  }

  editRequest(res: any) {
    const data = res.data;
    this.prHeader = {
      id: data.id,
      requester: data.requester,
      departmentID: data.departmentID,
      neededBy: data.deliveryDate ? data.deliveryDate.split('T')[0] : null,
      description: data.description,
      multiLoc: data.multiLoc,
      oversea: data.oversea,
      purchaseRequestNo: data.purchaseRequestNo
    };
    this.searchText = this.departments.find(d => d.id === data.departmentID)?.departmentName || '';
    this.prLines = data.prLines ? JSON.parse(data.prLines) : [];
  }
}
