import { AfterViewInit, AfterViewChecked, Component, OnInit, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import * as feather from 'feather-icons';
import Swal from 'sweetalert2';
import { TaxCodeService } from './taxcode.service';

@Component({
  selector: 'app-taxcode',
  templateUrl: './taxcode.component.html',
  styleUrls: ['./taxcode.component.scss']
})
export class TaxcodeComponent implements OnInit {

   @ViewChild('addForm') taxCodeForm!: NgForm;
  public id = 0;
  public name = "";
  isDisplay: boolean = false;
  modeHeader: string = 'Add TaxCode';
  resetButton: boolean = true;
  rows: any[] = [];
  tempData: any;
  taxCodeValue: any;
  isEditMode: boolean;

  constructor(private taxCodeService: TaxCodeService) { }

  ngOnInit(): void {
    this.getAllTaxCode();
  }

  ngAfterViewInit(): void {
    feather.replace();
  }

  ngAfterViewChecked(): void {
    feather.replace();
  }

  cancel() {
    this.isDisplay = false;
    this.isEditMode = false;
  }

  createTaxCode() {
    this.isDisplay = true;

    this.modeHeader = 'Add TaxCode';
    this.reset();
  }


  reset() {
    this.modeHeader = "Create TaxCode";
    this.name = "";
    this.id = 0;
  }


  getAllTaxCode() {
    this.taxCodeService.getTaxCode().subscribe((response: any) => {
      this.rows = response.data;
      this.tempData = this.rows;
    })
  }


  saveTaxCode(data: any) {
    debugger

    const obj = {
      id: this.id,
      name: this.name,
      createdBy: '1',
      createdDate: new Date(),
      updatedBy: '1',
      updatedDate: new Date(),
      isActive: true,
    };
    if (this.id == 0) {
      this.taxCodeService.insertTaxCode(obj).subscribe((res) => {
        if (res.isSuccess) {
          Swal.fire({
            title: "Hi",
            text: res.message,
            icon: "success",
            allowOutsideClick: false,
          });

          this.getAllTaxCode();
          this.isDisplay = false;
          this.isEditMode = false;
        }
        else{
              Swal.fire({
            title: "Hi",
            text: res.message,
            icon: "error",
            allowOutsideClick: false,
          });
        }
      });
    }
    else {
      this.taxCodeService.updateTaxCode(obj).subscribe((res) => {
        if (res.isSuccess) {
          Swal.fire({
            title: "Hi",
            text: res.message,
            icon: "success",
            allowOutsideClick: false,
          });

          this.getAllTaxCode();
          this.isDisplay = false;
          this.isEditMode = false;
        }
         else{
              Swal.fire({
            title: "Hi",
            text: res.message,
            icon: "error",
            allowOutsideClick: false,
          });
        }
      });
    }
  }



  getTaxCodeDetails(id: any) {
    debugger
    this.taxCodeService.getTaxCodeById(id).subscribe((arg: any) => {
      this.taxCodeValue = arg.data;
      this.id = this.taxCodeValue.id;
      this.name = this.taxCodeValue.name;
      this.isDisplay = true;
      this.resetButton = false;
      this.modeHeader = "Edit TaxCode";
      this.isEditMode = true;
    });
  }

  deleteTaxCode(id) {
    const _self = this;
    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "success",
      showCancelButton: true,
      confirmButtonColor: "#7367F0",
      cancelButtonColor: "#E42728",
      confirmButtonText: "Yes, Delete it!",
      customClass: {
        confirmButton: "btn btn-primary",
        cancelButton: "btn btn-danger ml-1",
      },
      allowOutsideClick: false,
    }).then(function (result) {
      if (result.value) {
        _self.taxCodeService.deleteTaxCode(id).subscribe((response: any) => {
          if (response.isSuccess) {
            Swal.fire({
              icon: "success",
              title: "Deleted!",
              text: response.message,
              allowOutsideClick: false,
            });
          } else {
            Swal.fire({
              icon: "error",
              title: "Error!",
              text: response.message,
              allowOutsideClick: false,
            });
          }
          _self.getAllTaxCode();
        });
      }
    });
  }

}












