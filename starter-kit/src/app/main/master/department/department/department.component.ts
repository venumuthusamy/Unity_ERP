import { Component, OnInit, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import * as feather from 'feather-icons';
import Swal from 'sweetalert2';
import { DepartmentService } from '../department.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-department',
  templateUrl: './department.component.html',
  styleUrls: ['./department.component.scss']
})
export class DepartmentComponent implements OnInit {
  @ViewChild('addForm') departmentForm!: NgForm;

  public id = 0;
  departmentCode: string = '';
  departmentName: string = '';
  isDisplay: boolean = false;
  modeHeader: string = 'Add Department';
  resetButton: boolean = true;

  rows: any[] = [];
  departmentValue: any;
  isEditMode: boolean = false;

  private readonly DEFAULT_PR_CREATE_ROUTE = '/purchase/Create-PurchaseRequest';
  private returnUrl: string | null = null;

  constructor(
    private _departmentService: DepartmentService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.getAllDepartment();

    // Open create form / capture return url via navigation STATE (not query)
    const st = window.history.state as any;
    if (st?.openCreate) this.createDepartment();
    this.returnUrl = st?.returnUrl || this.DEFAULT_PR_CREATE_ROUTE;
  }

  ngAfterViewInit(): void { feather.replace(); }
  ngAfterViewChecked(): void { feather.replace(); }

  cancel() {
    this.isDisplay = false;
    this.isEditMode = false;
    this.resetButton = true;
  }

  createDepartment() {
    this.isDisplay = true;
    this.modeHeader = 'Add Department';
    this.reset();
  }

  reset() {
    this.modeHeader = 'Create Department';
    this.departmentName = '';
    this.departmentCode = '';
    this.id = 0;
    this.resetButton = true;
    this.isEditMode = false;
  }

  getAllDepartment() {
    this._departmentService.getDepartment().subscribe((response: any) => {
      this.rows = response.data;
    });
  }

  /** After successful save, navigate back to PR using STATE (no query), and replace URL */
  private goToPrCreate(newDeptId?: number) {
    const target = this.returnUrl || this.DEFAULT_PR_CREATE_ROUTE;
    this.router.navigate([target], {
      state: {
        deptId: newDeptId || this.id || null,
        deptName: this.departmentName || null
      },
      replaceUrl: true
    });
  }

  saveDepartment() {
    const obj = {
      id: this.id,
      departmentName: this.departmentName,
      departmentCode: this.departmentCode,
      createdBy: '1',
      createdDate: new Date(),
      updatedBy: '1',
      updatedDate: new Date(),
      isActive: true
    };

    if (this.id === 0) {
      this._departmentService.insertDepartment(obj).subscribe({
        next: (res: any) => {
          const newId = res?.data?.id ?? 0;
          Swal.fire({
            icon: 'success',
            title: 'Created!',
            text: 'Department created successfully',
            confirmButtonText: 'OK',
            confirmButtonColor: '#0e3a4c'
          }).then(() => this.goToPrCreate(newId));
        },
        error: () => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to create Department',
            confirmButtonText: 'OK',
            confirmButtonColor: '#d33'
          });
        }
      });
    } else {
      this._departmentService.updateDepartment(obj).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Updated!',
            text: 'Department updated successfully',
            confirmButtonText: 'OK',
            confirmButtonColor: '#0e3a4c'
          }).then(() => this.goToPrCreate(this.id));
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
    this._departmentService.getDepartmentById(id).subscribe((arg: any) => {
      this.departmentValue = arg.data;
      this.id = this.departmentValue.id;
      this.departmentName = this.departmentValue.departmentName;
      this.departmentCode = this.departmentValue.departmentCode;
      this.isDisplay = true;
      this.resetButton = false;
      this.modeHeader = 'Edit Department';
      this.isEditMode = true;
    });
  }

  deleteDepartment(id: any) {
    const _self = this;
    Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'success',
      showCancelButton: true,
      confirmButtonColor: '#7367F0',
      cancelButtonColor: '#E42728',
      confirmButtonText: 'Yes, Delete it!',
      customClass: {
        confirmButton: 'btn btn-primary',
        cancelButton: 'btn btn-danger ml-1'
      },
      allowOutsideClick: false
    }).then(function (result) {
      if (result.value) {
        _self._departmentService.deleteDepartment(id).subscribe((response: any) => {
          if (response.isSuccess) {
            Swal.fire({
              icon: 'success',
              title: 'Deleted!',
              text: response.message,
              allowOutsideClick: false
            });
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Error!',
              text: response.message,
              allowOutsideClick: false
            });
          }
          _self.getAllDepartment();
        });
      }
    });
  }
}
