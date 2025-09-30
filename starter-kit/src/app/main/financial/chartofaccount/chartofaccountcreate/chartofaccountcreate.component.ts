import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { ChartofaccountService } from '../chartofaccount.service';

@Component({
  selector: 'app-chartofaccountcreate',
  templateUrl: './chartofaccountcreate.component.html',
  styleUrls: ['./chartofaccountcreate.component.scss']
})
export class ChartOfAccountCreateComponent implements OnInit {
  addForm!: FormGroup;
  isEditMode = false;
  chartOfAccountId!: number | null;

  accountHeads: any[] = [];
  parentHeadList: Array<{ value: number; label: string }> = [];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private chartOfAccountService: ChartofaccountService
  ) {}

  ngOnInit(): void {
    this.loadAccountHeads();

    this.addForm = this.fb.group({
      headName: [null, Validators.required],
      headCode: [{ value: null, disabled: true }],
      parentHead: [0],
      pHeadName: [{ value: null, disabled: true }],
      headLevel: [{ value: null, disabled: true }],
      headType: [{ value: null, disabled: true }],
      isTransaction: [false],
      isGI: [false],
      headCodeName: [null]
    });

    this.route.paramMap.subscribe((params: any) => {
      const idParam = params.get('id');
      this.chartOfAccountId = idParam ? parseInt(idParam, 10) : null;

      if (this.chartOfAccountId) {
        this.isEditMode = true;
        this.chartOfAccountService.getByIdChartOfAccount(this.chartOfAccountId).subscribe((res: any) => {
          // Patch the form with server data
          this.addForm.patchValue({
            headName: res.data.headName,
            headCode: res.data.headCode,
            parentHead: res.data.parentHead,
            pHeadName: res.data.pHeadName,
            headLevel: res.data.headLevel,
            headType: res.data.headType,
            isTransaction: res.data.isTransaction,
            isGI: res.data.isGI,
            headCodeName: res.data.headCodeName
          });

          // Disable the readonly fields (already configured as disabled in form def)
          this.addForm.get('headCode')?.disable();
          this.addForm.get('pHeadName')?.disable();
          this.addForm.get('headLevel')?.disable();
          this.addForm.get('headType')?.disable();
        });
      } else {
        this.isEditMode = false;
      }
    });
  }

  /** Use this if your modal wrapper is in the template */
  toggleModal(show: boolean) {
    const modal = document.getElementById('coa-modal');
    if (modal) modal.style.display = show ? 'block' : 'none';
  }

  /** Load all COA items and build Parent dropdown list */
  loadAccountHeads(): void {
    this.chartOfAccountService.getAllChartOfAccount().subscribe((data: any[]) => {
      this.accountHeads = data || [];
      this.parentHeadList = this.accountHeads.map((head: any) => ({
        value: head.id,
        label: this.buildFullPath(head)
      }));
    });
  }

  /** Build breadcrumb label like: Parent >> Child >> This */
  buildFullPath(item: any): string {
    let path = item.headName;
    let current = this.accountHeads.find((x: any) => x.id === item.parentHead);
    while (current) {
      path = `${current.headName} >> ${path}`;
      current = this.accountHeads.find((x: any) => x.id === current.parentHead);
    }
    return path;
  }

  /** When typing a Head Name for a root-level node (no parent selected) */
  onChangeHeadName(_: any): void {
    // We only need to compute for top-level when parentHead is 0
    const parentId = Number(this.addForm.get('parentHead')?.value || 0);
    if (parentId !== 0) return;

    // Compute next top-level code = count(level 1) + 1
    const levelOneItems = this.accountHeads.filter((i: any) => Number(i.headLevel) === 1);
    const nextCode = (levelOneItems?.length || 0) + 1;

    this.addForm.patchValue({
      headCode: nextCode,
      pHeadName: 'COA',
      headLevel: 1,
      headType: 'A',
      isTransaction: false,
      isGI: false,
      headCodeName: null
    });
  }

  /** Native <select> change handler (NO PrimeNG) */
  onChangeParentHead(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const parentId = parseInt(value, 10);

    this.addForm.patchValue({ parentHead: parentId });

    // If none selected, reset dependent fields to top-level defaults
    if (!parentId) {
      this.addForm.patchValue({
        pHeadName: 'COA',
        headLevel: 1,
        headType: 'A',
        headCode: (this.accountHeads.filter(i => Number(i.headLevel) === 1).length || 0) + 1
      });
      return;
    }

    const parent = this.accountHeads.find(p => p.id === parentId);
    if (!parent) return;

    const parentCode = (parent.headCode ?? '').toString();
    const parentLevel = Number(parent.headLevel);

    // Existing children one level below this parent
    const childCodes: string[] = this.accountHeads
      .filter(acc =>
        (acc.headCode ?? '').toString().startsWith(parentCode) &&
        Number(acc.headLevel) === parentLevel + 1
      )
      .map(acc => (acc.headCode ?? '').toString());

    // Determine next numeric suffix
    const suffixes = childCodes
      .map(code => parseInt(code.substring(parentCode.length) || '0', 10))
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b);

    const nextSeq = suffixes.length ? suffixes[suffixes.length - 1] + 1 : 1;

    // Keep suffix padding consistent with existing children (min 2)
    const maxSuffixLen = Math.max(
      2,
      ...childCodes.map(code => Math.max(0, code.length - parentCode.length))
    );

    const seqStr = String(nextSeq).padStart(maxSuffixLen, '0');
    const newHeadCode = parentCode + seqStr;

    this.addForm.patchValue({
      pHeadName: parent.headName,
      headLevel: parentLevel + 1,
      headType: parent.headType,
      headCode: newHeadCode
    });
  }

  onSubmit(): void {
    if (this.addForm.invalid) {
      Swal.fire({
        icon: 'warning',
        title: 'Required Fields Missing',
        text: 'Please fill all required fields.',
        confirmButtonColor: '#2199e8'
      });
      return;
    }

    // Use rawValue so disabled controls are included
    const payload = this.addForm.getRawValue();
    payload.parentHead = payload.parentHead || 0;

    if (this.isEditMode && this.chartOfAccountId) {
      // Update
      this.chartOfAccountService.updateChartOfAccount(this.chartOfAccountId, payload).subscribe(
        () => {
          Swal.fire({
            icon: 'success',
            title: 'Updated Successfully',
            text: 'Chart Of Account has been updated successfully.',
            confirmButtonColor: '#28a745'
          }).then(() => {
            this.toggleModal(false);
            this.router.navigateByUrl('financial/coa');
          });
        },
        (err) => {
          Swal.fire({
            icon: 'error',
            title: 'Update Failed',
            text: err?.message || 'An error occurred while updating the Chart Of Account.',
            confirmButtonColor: '#dc3545'
          });
        }
      );
    } else {
      // Create
      this.chartOfAccountService.createChartOfAccount(payload).subscribe(
        () => {
          Swal.fire({
            icon: 'success',
            title: 'Created Successfully',
            text: 'Chart Of Account has been created successfully.',
            confirmButtonColor: '#28a745'
          }).then(() => {
            this.toggleModal(false);
            
          });
        },
        (err) => {
          Swal.fire({
            icon: 'error',
            title: 'Creation Failed',
            text: err?.message || 'An error occurred while creating the Chart Of Account.',
            confirmButtonColor: '#dc3545'
          });
        }
      );
    }
  }
}
