import { Component, AfterViewInit, ElementRef, ViewChild, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { CitiesService } from 'app/main/master/cities/cities.service';
import { CountriesService } from 'app/main/master/countries/countries.service';
import { CustomerGroupsService } from 'app/main/master/customer-groups/customer-groups.service';
import { LocationService } from 'app/main/master/location/location.service';
import { PaymentTermsService } from 'app/main/master/payment-terms/payment-terms.service';
import Stepper from 'bs-stepper';
import * as feather from 'feather-icons';

@Component({
  selector: 'app-create-customer-master',
  templateUrl: './create-customer-master.component.html',
  styleUrls: ['./create-customer-master.component.scss']
})
export class CreateCustomerMasterComponent implements AfterViewInit, OnInit {

  @ViewChild('stepper1', { static: true }) stepperEl!: ElementRef<HTMLDivElement>;
  private stepper!: Stepper;
preview: any = {
  drivingLicence: null,
  utilityBill: null,
  bankStatement: null,
  acra: null
};
selectedCountryId: number | null = null;
selectedLocationId: number | null = null;

  currentIndex = 0;
  totalSteps = 3;

  CustomerGroupList: any;
  PaymenttermsList: any;
  CityList: any;
  CountryList: any;
  LocationList: any;

  get isFirstStep() { return this.currentIndex === 0; }
  get isLastStep() { return this.currentIndex === this.totalSteps - 1; }

  // Models
  TDNameVar = '';
  TDLocationNameVar = '';
  TDContactPersonVar = '';
  TDEmailVar = '';
  TDContactNumberVar = '';
TDCreditAmountVar: number | null = null;

  kycDocs: any = {
    aadhar: null,
    pan: null,
    gst: null
  };

  constructor(
    private _customerGroupservice: CustomerGroupsService,
    private _paymentTermsService: PaymentTermsService,
    private _locationService:LocationService,
    private _countryService: CountriesService
  ) { }

  ngOnInit(): void {
    this.loadcustomerGroup();
    this.loadpaymentTerms();
    this.loadcountry();
  }

  loadcustomerGroup() {
    this._customerGroupservice.getCustomer().subscribe((res: any) => {
      if (res?.isSuccess && Array.isArray(res.data)) {
        this.CustomerGroupList = res.data;
      }
    });
  }

  loadpaymentTerms() {
    this._paymentTermsService.getAllPaymentTerms().subscribe((res: any) => {
      if (res?.isSuccess && Array.isArray(res.data)) {
        this.PaymenttermsList = res.data;
      }
    });
  }

   loadLocationbyCountryId(Countryid) {
    this._locationService.getLocationByCountryId(Countryid).subscribe((res: any) => {
      if (res?.isSuccess && Array.isArray(res.data)) {
        this.LocationList = res.data;
      }
    });
  }
   loadcountry() {
    this._countryService.getCountry().subscribe((res: any) => {
      if (res?.isSuccess && Array.isArray(res.data)) {
        this.CountryList = res.data;
      }
    });
  }

  onCountryChange(event: any) {
  this.selectedCountryId = event?.id; // ng-select returns selected object
  this.loadLocationbyCountryId(this.selectedCountryId);
  this.selectedLocationId = null; // Reset location on change
}
  onContactNumberInput() {
    if (this.TDContactNumberVar) {
      this.TDContactNumberVar = this.TDContactNumberVar.replace(/[^0-9]/g, '').slice(0, 10);
    }
  }
onFileChange(event: any, type: string) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    this.preview[type] = reader.result;
  };
  reader.readAsDataURL(file);
}
  ngAfterViewInit(): void {
    this.stepper = new Stepper(this.stepperEl.nativeElement, { linear: true, animation: true });

    const update = () => {
      // @ts-ignore
      this.currentIndex = this.stepper?._currentIndex ?? 0;
      feather.replace();
    };

    this.stepperEl.nativeElement.addEventListener('shown.bs.stepper', update);
    update();
  }

  next(form?: NgForm) {
    if (form && !form.valid) {
      form.control.markAllAsTouched();
      return;
    }
    this.stepper.next();
  }

  prev() {
    this.stepper.previous();
  }

  onSubmit() {
    console.log({
      account: {
        customerName: this.TDNameVar,
        countryId: this.selectedCountryId, // ✅ Store Selected Country
        locationId: this.selectedLocationId, 
        contactPerson: this.TDContactPersonVar,
        email: this.TDEmailVar,
        contactNumber: this.TDContactNumberVar,
         creditAmount: this.TDCreditAmountVar
      },
      kyc: this.kycDocs
    });

    alert('✅ Customer Created Successfully');
  }

}
