import { Component, EventEmitter, Input, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { CoreSidebarService } from '@core/components/core-sidebar/core-sidebar.service';
import { CountriesService } from '../../countries/countries.service';
import { forkJoin } from 'rxjs';
import { StatesService } from '../../states/states.service';
import { CitiesService } from '../../cities/cities.service';
import { WarehouseService } from '../warehouse.service';
import Swal from 'sweetalert2';
import { NgForm } from '@angular/forms';

@Component({
  selector: 'app-warehouse-create',
  templateUrl: './warehouse-create.component.html',
  styleUrls: ['./warehouse-create.component.scss']
})
export class WarehouseCreateComponent implements OnInit {

  @Output() callList = new EventEmitter<void>();
  @Input() passData: any;
  @ViewChild('newWarehouseForm') newWarehouseForm!: NgForm;

  loading = false;

  public name;
  public countryId
  public stateId
  public cityId
  public phone;
  public address
  public description

  countryList: any[] = [];
  stateList: any[] = [];
  cityList: any[] = [];
  stateUpdatedList: any[] = [];
  cityUpdatedList: any[] = [];
  isEdit = false;

  /**
   * Constructor
   *
   * @param {CoreSidebarService} _coreSidebarService
   */
  constructor(private _coreSidebarService: CoreSidebarService,private countryService : CountriesService,
   private stateService : StatesService,  private cityService : CitiesService,
   private warehouseService : WarehouseService
  ) {}

 ngOnChanges(changes: SimpleChanges): void {
  if ('passData' in changes) {
    this.loadData();
  }
}

  ngOnInit(): void {
    this.getAllData()
  }

  getAllData() {
    forkJoin({
      countries: this.countryService.getCountry(),
      states: this.stateService.getState(),
      cities: this.cityService.getCities()
    }).subscribe({
      next: (result: any) => {
        this.countryList = result.countries?.data ?? [];
        this.stateList   = result.states?.data ?? [];
        this.cityList    = result.cities?.data ?? [];
      },
      error: (err) => console.error('Error fetching data', err)
    });
    }
    
  private enterCreateMode() {

  this.isEdit = false;
  this.resetFormModel();

  // Reset Angular NgForm "touched/submitted" flags so errors don’t show
  Promise.resolve().then(() => {
    this.newWarehouseForm?.resetForm({
      name: null,
      countryId: null,
      stateId: null,
      cityId: null,
      phone: null,
      address: null,
      description: null
    });
  });
}  
  private resetFormModel() {
    this.name = this.phone = this.address = this.description = null;
    this.countryId = this.stateId = this.cityId = null;
    this.stateUpdatedList = [];
    this.cityUpdatedList = [];
  }

  private loadData() {
    if (!this.countryList.length || !this.stateList.length || !this.cityList.length) return;

    if (this.passData && this.passData.id) {
      // EDIT mode
      this.isEdit = true;

      this.name        = this.passData.name ?? null;
      this.phone       = this.passData.phone ?? null;
      this.address     = this.passData.address ?? null;
      this.description = this.passData.description ?? null;

      this.countryId = this.passData.countryId ?? null;
      this.onCountryChange(this.countryId);             // builds stateUpdatedList

      this.stateId = this.passData.stateId ?? null;
      this.onStateChange(this.stateId);                 // builds cityUpdatedList

      this.cityId = this.passData.cityId ?? null;

      Promise.resolve().then(() => {
      this.newWarehouseForm?.resetForm({
        name: this.name,
        countryId: this.countryId,
        stateId: this.stateId,
        cityId: this.cityId,
        phone: this.phone,
        address: this.address,
        description: this.description
      });
    });
    } else {
       this.enterCreateMode();
    }
  }
  
onCountryChange(selectedCountryId: number | null, isEdit: boolean = false): void {
  // Reset dependents first
  this.stateId = null;
  this.cityId = null; 
  this.cityUpdatedList = [];
  this.stateUpdatedList = [];

  if (selectedCountryId == null) return;

  // Filter states by country
  this.stateUpdatedList = (this.stateList ?? []).filter(
    (s: any) => Number(s.countryId) === Number(selectedCountryId)
  );

}

onStateChange(selectedStateId: number | null, isEdit: boolean = false): void {
  // Reset dependent city list first
  this.cityUpdatedList = [];

  if (selectedStateId == null) return;

  // Filter cities by state
  this.cityUpdatedList = (this.cityList ?? []).filter(
    (c: any) => Number(c.stateId) === Number(selectedStateId)
  );

}

   /**
   * Toggle the sidebar
   *
   * @param name
   */
  toggleSidebar(name): void {
   
    this._coreSidebarService.getSidebarRegistry(name).toggleOpen();
  }

  /**
   * Submit
   *
   * @param form
   */
  submit(form) {
  // Trigger validation messages
  form.control.markAllAsTouched();

  if (!form.valid || this.loading) return;

  this.loading = true;

  // Build payload (use form.value if all names match your API)
  const basePayload = {
  name: this.name?.trim(),
  countryId: this.countryId,
  stateId: this.stateId,
  cityId: this.cityId,
  phone: this.phone?.trim(),
  address: this.address?.trim() || null,
  description: this.description?.trim() || null
};

const request$ = this.isEdit
  ? this.warehouseService.updateWarehouse({ id: this.passData.id, ...basePayload })
  : this.warehouseService.insertWarehouse(basePayload);

  request$.subscribe({
    next: () => {
      Swal.fire({
        icon: 'success',
        title: this.isEdit ? 'Updated!' : 'Created!',
        text: `Warehouse ${this.isEdit ? 'updated' : 'created'} successfully`,
        confirmButtonText: 'OK',
        confirmButtonColor: '#0e3a4c'
      }).then(() => {
        this.callList.emit();                           // tell parent to refresh
        this.toggleSidebar('app-warehouse-create');     // close sidebar
        if (!this.isEdit) {
          // clear form only for create
          this.enterCreateMode();  
        }
      });
    },
    error: () => {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: `Failed to ${this.isEdit ? 'update' : 'create'} Warehouse`,
        confirmButtonText: 'OK',
        confirmButtonColor: '#d33'
      });
    },
    complete: () => {
      this.loading = false;
    }
  });
}


}




