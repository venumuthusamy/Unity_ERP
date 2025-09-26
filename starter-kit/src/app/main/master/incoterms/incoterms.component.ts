import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, NgForm } from '@angular/forms';
import Swal from 'sweetalert2';
import { IncotermsService } from './incoterms.service';
import * as feather from 'feather-icons';
@Component({
  selector: 'app-incoterms',
  templateUrl: './incoterms.component.html',
  styleUrls: ['./incoterms.component.scss']
})
export class IncotermsComponent implements OnInit {
 @ViewChild('addForm') addForm!: NgForm;
  incotermsList: any[] = [];
  incotermsName: string = '';
  description: string = '';
  isEditMode = false;
  selectedIncoterms: any = null;
  public isDisplay = false;
  private iconsReplaced = false;
  constructor(private fb: FormBuilder,
    private incotermsService: IncotermsService,) { }

  ngOnInit(): void {
    this.loadIncoterms();
  }
  ngAfterViewChecked(): void {
    feather.replace();  // remove the guard so icons refresh every cycle
  }
  ngAfterViewInit(): void {
    feather.replace();
  }
  // Load data from API
  loadIncoterms() {
  this.incotermsService.getAllIncoterms().subscribe((data: any) => {
    // Filter only active ones
    this.incotermsList = data.filter((item: any) => item.isActive === true);
    setTimeout(() => feather.replace(), 0);
  });
}
 // Show form for creating
  createIncoterms() {
    this.isDisplay = true;
    this.isEditMode = false;
    this.selectedIncoterms = null;
    this.reset();
  }

  // Show form for editing
  editIncoterms(data: any) {
    this.isDisplay = true;       // show the form
    this.isEditMode = true;      // enable edit mode
    this.selectedIncoterms = data;

    // patch the form fields
    this.incotermsName = data.incotermsName;       // bind to input
    this.description = data.description; // bind to textarea
  }
  cancel() {

    this.isEditMode = false;
    this.isDisplay = false;
  }

  reset() {
    this.incotermsName = '';
    this.description = '';
  }

  // Save or update
  onSubmit(form: any) {
    if (!form.valid) {
      Swal.fire({
        icon: 'warning',
        title: 'Warning',
        text: 'Please fill all required fields',
        confirmButtonText: 'OK',
        confirmButtonColor: '#0e3a4c'
      });
      return;
    }

    const payload = {
      IncotermsName: this.incotermsName,
      CreatedBy: "1",
      UpdatedBy: "1",
      CreatedDate: new Date(),
      UpdatedDate: new Date()
    };

    if (this.isEditMode) {
      const updatedIncoterms = { ...this.selectedIncoterms, ...payload };
      this.incotermsService.updateIncoterms(this.selectedIncoterms.id, updatedIncoterms).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Updated!',
            text: 'Incoterms updated successfully',
            confirmButtonText: 'OK',
            confirmButtonColor: '#0e3a4c'
          });
          this.loadIncoterms();
          this.cancel();
        },
        error: () => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to update Incoterms',
            confirmButtonText: 'OK',
            confirmButtonColor: '#d33'
          });
        }
      });
    } else {
      this.incotermsService.createIncoterms(payload).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Created!',
            text: 'Incoterms created successfully',
            confirmButtonText: 'OK',
            confirmButtonColor: '#0e3a4c'
          });
          this.loadIncoterms();
          this.cancel();
        },
        error: () => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to create Incoterms',
            confirmButtonText: 'OK',
            confirmButtonColor: '#d33'
          });
        }
      });
    }
  }
  // Delete
  confirmdeleteIncoterms(data: any) {
    Swal.fire({
      title: 'Confirm Delete',
      text: 'Are you sure you want to delete this item?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6'
    }).then((result) => {
      if (result.isConfirmed) {
        this.deleteIncoterms(data);
        Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          text: 'Incoterms has been deleted.',
          confirmButtonColor: '#3085d6'
        });
      }
    });
  }
  // Delete
  deleteIncoterms(item: any) {
    this.incotermsService.deleteIncoterms(item.id).subscribe({
      next: (res) => {
        Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          text: 'Incoterms deleted successfully',
          confirmButtonColor: '#3085d6'
        });
        this.ngOnInit();
      },
      error: (err) => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to delete Uom',
          confirmButtonColor: '#d33'
        });
      }
    });
  }

}
