import { Component, OnInit, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import * as feather from 'feather-icons';
import Swal from 'sweetalert2';
import { DepartmentService } from '../department.service';

@Component({
  selector: 'app-department',
  templateUrl: './department.component.html',
  styleUrls: ['./department.component.scss']
})
export class DepartmentComponent implements OnInit {

  @ViewChild('addForm') departmentForm!: NgForm;
  public id = 0;
  departmentCode: string = "";
  departmentName: string = '';
  isDisplay: boolean = false;
  modeHeader: string = 'Add Department';
  resetButton: boolean = true;

  rows: any[] = [];
  departmentValue: any;
  isEditMode: boolean;

  constructor(private _departmentService: DepartmentService) { }

  ngOnInit(): void {
    this.getAllDepartment();
  }

  ngAfterViewInit(): void {
    feather.replace();
  }

  ngAfterViewChecked(): void {
    feather.replace();
  }

  cancel() {
    this.isDisplay = false;
  }

  createDepartment() {
    this.isDisplay = true;
    this.modeHeader = 'Add Department';
    this.reset();
  }

  reset() {
    this.modeHeader = "Create Department";
    this.departmentName = "";
    this.departmentCode = "";
    this.id = 0;
  }

  getAllDepartment() {
    this._departmentService.getDepartment().subscribe((response: any) => {
      this.rows = response.data;
    })
  }

  saveDepartment() {
    debugger

    const obj = {
      id: this.id,
      departmentName: this.departmentName,
      departmentCode: this.departmentCode,
      createdBy: '1',
      createdDate: new Date(),
      updatedBy: '1',
      updatedDate: new Date(),
      isActive: true,
    };
    if (this.id == 0) {
      this._departmentService.insertDepartment(obj).subscribe( {      

         next: () => {
                   Swal.fire({
                     icon: 'success',
                     title: 'Created!',
                     text: 'Department created successfully',
                     confirmButtonText: 'OK',
                     confirmButtonColor: '#0e3a4c'
                   });
                   this.getAllDepartment();
                   this.isDisplay = false;
                   this.isEditMode = false;
                 },
                 error: () => {
                   Swal.fire({
                     icon: 'error',
                     title: 'Error',
                     text: 'Failed to created Department',
                     confirmButtonText: 'OK',
                     confirmButtonColor: '#d33'
                   });
                 }

        
      });
    }
    else {
      this._departmentService.updateDepartment(obj).subscribe( {
          next: () => {
                   Swal.fire({
                     icon: 'success',
                     title: 'Updated!',
                     text: 'Department updated successfully',
                     confirmButtonText: 'OK',
                     confirmButtonColor: '#0e3a4c'
                   });
                   this.getAllDepartment();
                   this.isDisplay = false;
                   this.isEditMode = false;
                 },
                 error: () => {
                   Swal.fire({
                     icon: 'error',
                     title: 'Error',
                     text: 'Failed to update Department',
                     confirmButtonText: 'OK',
                     confirmButtonColor: '#d33'
                   });
                 }
      });
    }
  }



  getDepartmentDetails(id: any) {
    debugger
    this._departmentService.getDepartmentById(id).subscribe((arg: any) => {
      this.departmentValue = arg.data;
      this.id = this.departmentValue.id;
      this.departmentName = this.departmentValue.departmentName;
      this.departmentCode = this.departmentValue.departmentCode;
      this.isDisplay = true;
      this.resetButton = false;
      this.modeHeader = "Edit Department";
      this.isEditMode = true;
    });
  }

  deleteDepartment(id) {
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
        _self._departmentService.deleteDepartment(id).subscribe((response: any) => {
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
          _self.getAllDepartment();
        });
      }
    });
  }


}











