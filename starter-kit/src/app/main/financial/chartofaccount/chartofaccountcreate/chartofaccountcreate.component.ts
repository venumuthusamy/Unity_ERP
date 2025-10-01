import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { ChartofaccountService } from '../chartofaccount.service';
import { CoreSidebarService } from '@core/components/core-sidebar/core-sidebar.service';

@Component({
  selector: 'app-chartofaccountcreate',
  templateUrl: './chartofaccountcreate.component.html',
  styleUrls: ['./chartofaccountcreate.component.scss']
})
export class ChartOfAccountCreateComponent implements OnInit, OnChanges {
  @Output() onDepartmentChange = new EventEmitter<any>();
  @Input() editId: number | null = null;   // used by sidebar flow

  addForm!: FormGroup;
  isEditMode = false;

  /** used by routed flow (/edit/:id) */
  private chartOfAccountId: number | null = null;

  accountHeads: any[] = [];
  parentHeadList: Array<{ value: number; label: string }> = [];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private chartOfAccountService: ChartofaccountService,
    private _coreSidebarService: CoreSidebarService
  ) {}

  // ---------------- Lifecycle ----------------
  ngOnInit(): void {
    this.initForm();
    this.loadAccountHeads();

    // Routed flow support (if you navigate to /edit/:id). If you only use sidebar, this is harmless.
    this.route.paramMap.subscribe(params => {
      const idParam = params.get('id');
      this.chartOfAccountId = idParam ? parseInt(idParam, 10) : null;
      this.resolveModeAndLoad();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // When parent sets [editId] (sidebar flow), re-evaluate mode & load
    if ('editId' in changes && !changes['editId']?.firstChange) {
      this.resolveModeAndLoad();
    }
  }

  // ---------------- Init helpers ----------------
  private initForm(): void {
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
  }

  /** Decide whether we’re in edit/create based on editId (sidebar) or chartOfAccountId (route) */
  private resolveModeAndLoad(): void {
    const effectiveId = this.editId ?? this.chartOfAccountId;

    if (effectiveId) {
      this.isEditMode = true;
      this.loadById(effectiveId);
    } else {
      this.isEditMode = false;
      this.enterCreateDefaults();
    }
  }

  private loadById(id: number): void {
    if (!this.addForm) return;
    this.chartOfAccountService.getByIdChartOfAccount(id).subscribe({
      next: (res: any) => {
        const d = res?.data || {};
        this.addForm.patchValue({
          headName: d.headName ?? null,
          headCode: d.headCode ?? null,
          parentHead: d.parentHead ?? 0,
          pHeadName: d.pHeadName ?? null,
          headLevel: d.headLevel ?? null,
          headType: d.headType ?? null,
          isTransaction: !!d.isTransaction,
          isGI: !!d.isGI,
          headCodeName: d.headCodeName ?? null
        });
      },
      error: (err) => this.alert('error', 'Failed to load record', this.errMsg(err))
    });
  }

   enterCreateDefaults(): void {
    if (!this.addForm) return;
    this.addForm.reset({
      headName: null,
      headCode: null,
      parentHead: 0,
      pHeadName: null,
      headLevel: null,
      headType: null,
      isTransaction: false,
      isGI: false,
      headCodeName: null
    });
  }

toggleModal(name: string): void {
  const sidebar = this._coreSidebarService.getSidebarRegistry(name);
  sidebar.toggleOpen();

  // If closing, reset the form
  if (!sidebar.open) {
    this.enterCreateDefaults();
  }
}
// chartofaccountcreate.component.ts (only the new method shown)
public resetForm(): void {
  if (!this.addForm) return;
  this.addForm.reset({
    headName: null,
    headCode: null,
    parentHead: 0,
    pHeadName: null,
    headLevel: null,
    headType: null,
    isTransaction: false,
    isGI: false,
    headCodeName: null
  });
  this.isEditMode = false;
  this.chartOfAccountId = null;
}


  // ---------------- Data needed for dropdown ----------------
  loadAccountHeads(): void {
    this.chartOfAccountService.getAllChartOfAccount().subscribe({
      next: (res: any) => {
        this.accountHeads = res?.data || [];
        this.parentHeadList = this.accountHeads.map((head: any) => ({
          value: head.id,
          label: this.buildFullPath(head)
        }));
      },
      error: (err) => this.alert('error', 'Failed to load heads', this.errMsg(err))
    });
  }

  /** Build breadcrumb like: Parent >> Child >> This */
  buildFullPath(item: any): string {
    let path = item.headName;
    let current = this.accountHeads.find((x: any) => x.id === item.parentHead);
    while (current) {
      path = `${current.headName} >> ${path}`;
      current = this.accountHeads.find((x: any) => x.id === current.parentHead);
    }
    return path;
  }

  // ---------------- Form auto values ----------------
  onChangeHeadName(_: any): void {
    // only compute for top-level when parentHead is 0
    const parentId = Number(this.addForm.get('parentHead')?.value || 0);
    if (parentId !== 0) return;

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

  onChangeParentHead(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const parentId = parseInt(value, 10);
    this.addForm.patchValue({ parentHead: parentId });

    // reset to top-level
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

    // children exactly one level below this parent
    const childCodes: string[] = this.accountHeads
      .filter(acc =>
        (acc.headCode ?? '').toString().startsWith(parentCode) &&
        Number(acc.headLevel) === parentLevel + 1
      )
      .map(acc => (acc.headCode ?? '').toString());

    const suffixes = childCodes
      .map(code => parseInt(code.substring(parentCode.length) || '0', 10))
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b);

    const nextSeq = suffixes.length ? suffixes[suffixes.length - 1] + 1 : 1;

    // keep suffix padding consistent with siblings (min 2)
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

  // ---------------- Submit ----------------
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

    const payload = this.addForm.getRawValue();
    payload.parentHead = payload.parentHead || 0;

    const effectiveId = this.editId ?? this.chartOfAccountId;

    if (this.isEditMode && effectiveId) {
      // Update
       payload.id = effectiveId; 
      this.chartOfAccountService.updateChartOfAccount(effectiveId, payload).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Updated Successfully',
            text: 'Chart Of Account has been updated successfully.',
            confirmButtonColor: '#28a745'
          }).then(() => {
            this.toggleModal('app-chartofaccountcreate');  // close sidebar
            this.onDepartmentChange.emit();                // notify parent to reload
          });
        },
        error: (err) => {
          Swal.fire({
            icon: 'error',
            title: 'Update Failed',
            text: this.errMsg(err),
            confirmButtonColor: '#dc3545'
          });
        }
      });
    } else {
      // Create
      this.chartOfAccountService.createChartOfAccount(payload).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Created Successfully',
            text: 'Chart Of Account has been created successfully.',
            confirmButtonColor: '#28a745'
          }).then(() => {
            this.toggleModal('app-chartofaccountcreate');  // close sidebar
            this.onDepartmentChange.emit();                // notify parent to reload
            this.enterCreateDefaults();                    // reset if sidebar stays open
          });
        },
        error: (err) => {
          Swal.fire({
            icon: 'error',
            title: 'Creation Failed',
            text: this.errMsg(err),
            confirmButtonColor: '#dc3545'
          });
        }
      });
    }
  }

  // ---------------- Utils ----------------
  private alert(
    icon: 'success' | 'error' | 'warning' | 'info' | 'question',
    title: string,
    text?: string
  ) {
    Swal.fire({ icon, title, text: text || undefined });
  }

  private errMsg(err: any): string {
    return err?.error?.message || err?.message || 'An error occurred. Please try again.';
  }
}
