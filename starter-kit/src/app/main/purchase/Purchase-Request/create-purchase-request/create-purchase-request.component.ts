import {
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnInit,
  OnDestroy,
  ViewEncapsulation,
  ViewChild
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';

import { ChartofaccountService } from 'app/main/financial/chartofaccount/chartofaccount.service';
import { DepartmentService } from 'app/main/master/department/department.service';
import { ItemsService } from 'app/main/master/items/items.service';
import { LocationService } from 'app/main/master/location/location.service';
import { UomService } from 'app/main/master/uom/uom.service';
import { PurchaseService } from '../../purchase.service';
import { PrDraftService } from '../pr-draft.service';

@Component({
  selector: 'app-create-purchase-request',
  templateUrl: './create-purchase-request.component.html',
  styleUrls: ['./create-purchase-request.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class CreatePurchaseRequestComponent implements OnInit, OnDestroy {
  prStep = 0;
  prSteps = ['Header', 'Lines', 'Review'];
  hover = false;

  prHeader: any = {
    id: 0,
    requester: '',
    departmentID: 0,
    neededBy: null,
    description: '',
    multiLoc: false,
    oversea: false
  };

  prLines: any[] = [];
  purchaseRequests: any[] = [];
  departments: any[] = [];
  filteredDepartments: any[] = [];

  accountHeads: any[] = [];
  parentHeadList: any[] = [];
  itemsList: any[] = [];
  uomList: any[] = [];
  locationList: any[] = [];

  dropdownOpen = false;
  searchText = '';            // visible department name
  minDate = '';
  showModal = false;

  modalLine: any = {
    itemSearch: '',
    itemCode: '',
    qty: null,
    uomSearch: '',
    uom: '',
    locationSearch: '',
    location: '',
    budget: '',
    remarks: '',
    filteredItems: [],
    filteredUoms: [],
    filteredLocations: [],
    dropdownOpen: false,
    uomDropdownOpen: false,
    locationDropdownOpen: false,
    isDraft: true
  };
  draftIndex: number | null = null;
  editingIndex: number | null = null;

  userId: string;
  prid: number | null = null;
  isEditMode = false;

  // Draft handling
  private tempDraftId: number | null = null;
  private suppressAutosave = false;

  // Department name resolution
  private departmentsLoaded = false;
  private headerLoaded = false;
  private pendingDeptId: number | null = null;
  private pendingDeptName: string | null = null;

  private captureHandler!: (e: MouseEvent) => void;
  private readonly RETURN_URL = '/purchase/Create-PurchaseRequest';

  constructor(
    private purchaseService: PurchaseService,
    private router: Router,
    private route: ActivatedRoute,
    private deptService: DepartmentService,
    private itemService: ItemsService,
    private chartOfAccountService: ChartofaccountService,
    private uomService: UomService,
    private locationService: LocationService,
    private eRef: ElementRef,
    private zone: NgZone,
    private draft: PrDraftService
  ) {
    this.userId = localStorage.getItem('id') || 'System';
  }

  // === NEW: anchors to scroll ===
  @ViewChild('topOfWizard') topOfWizard!: ElementRef<HTMLDivElement>;
  @ViewChild('bottomOfWizard') bottomOfWizard!: ElementRef<HTMLDivElement>;

  // === NEW: baseline snapshot for “unsaved” detection ===
  private initialSignature = '';

  // ---------------- Lifecycle ----------------

  ngOnInit(): void {
    this.setMinDate();

    this.loadDepartments();   // important: sets departmentsLoaded true later
    this.loadCatalogs();
    this.loadRequests();

    // Edit PR via :id
    this.route.paramMap.subscribe(params => {
      const idStr = params.get('id');
      this.prid = idStr ? +idStr : null;
      if (this.prid) {
        this.isEditMode = true;
        this.draft.clear();
        this.purchaseService.GetPurchaseById(this.prid).subscribe((res: any) => {
          if (res?.data) {
            this.editRequest(res);
            this.prStep = 0;
            // NEW: after loading an existing PR, set baseline
            this.updateBaseline();
          }
        });
      }
    });

    // Opened from a Draft via ?draftId=...
    this.route.queryParamMap.subscribe(pm => {
      const draftIdStr = pm.get('draftId');
      if (draftIdStr) {
        this.tempDraftId = +draftIdStr;
        this.loadDraftById(this.tempDraftId);
      } else {
        // Restore local (client) draft if any
        const d = this.draft.load();
        if (d) {
          this.prHeader = { ...this.prHeader, ...(d.prHeader || {}) };
          this.prLines = d.prLines || [];
          this.searchText = d.departmentName ?? '';
          this.prStep = typeof d.step === 'number' ? d.step : 0;
          this.headerLoaded = true;
          this.resolveDepartmentName(); // try if departments already loaded

          // NEW: baseline after restoring local draft
          this.updateBaseline();
        } else {
          // NEW: baseline for a clean, empty form
          this.updateBaseline();
        }
      }
    });

    // Global capture click for closing dropdowns
    this.captureHandler = (ev: MouseEvent) => this.onGlobalClickCapture(ev);
    document.addEventListener('click', this.captureHandler, { capture: true });
  }

  ngOnDestroy(): void {
    if (this.captureHandler) {
      document.removeEventListener('click', this.captureHandler, { capture: true } as any);
    }
  }

  // ---------------- Draft load ----------------

  private loadDraftById(id: number) {
    this.draft.getById(id).subscribe((res: any) => {
      const d = res?.data;
      if (!d) return;

      this.tempDraftId = d.id ?? id;

      // Fill header (not a real PR)
      this.prHeader = {
        id: 0,
        requester: d.requester || '',
        departmentID: this.toNum(d.departmentID),
        neededBy: d.deliveryDate ? String(d.deliveryDate).split('T')[0] : null,
        description: d.description || '',
        multiLoc: !!d.multiLoc,
        oversea: !!d.oversea
      };

      // Use name if API sent it; otherwise resolve later
      if (d.departmentName) {
        this.searchText = d.departmentName;
        this.pendingDeptName = d.departmentName;
      } else {
        this.searchText = '';
        this.pendingDeptId = this.prHeader.departmentID || null;
      }

      try {
        this.prLines = Array.isArray(d.prLines) ? d.prLines : JSON.parse(d.prLines || '[]');
      } catch {
        this.prLines = [];
      }

      this.prStep = 0;
      this.headerLoaded = true;
      this.resolveDepartmentName(); // try resolving now if departments already loaded

      // NEW: set baseline after draft is fully loaded
      this.updateBaseline();
    });
  }

  // ---------------- Name resolution ----------------

  /** Convert possible string/undefined to number (0 if NaN) */
  private toNum(v: any): number {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  }

  /** Try to resolve the visible department name after both sides are ready */
  private resolveDepartmentName(): void {
    if (!this.departmentsLoaded || !this.headerLoaded) return;

    // If we already have a name from API/local draft, keep it
    if (this.searchText && this.searchText.trim().length) return;

    const depId = this.toNum(this.prHeader?.departmentID);
    if (!depId || !Array.isArray(this.departments) || this.departments.length === 0) return;

    // Tolerate various shapes/cases for id and name
    const match = this.departments.find((d: any) => {
      const idCandidates = [d.id, d.Id, d.departmentID, d.DepartmentID].map(this.toNum);
      return idCandidates.includes(depId);
    });

    const name = match?.departmentName ?? match?.DepartmentName ?? null;
    if (name) {
      this.searchText = name;
    } else if (this.pendingDeptName) {
      this.searchText = this.pendingDeptName;
    }
  }

  // ---------------- Leave guard (UPDATED to use baseline) ----------------

  /** Create a normalized signature of the current state (header + lines) */
  private computeSignature(): string {
    const header = {
      requester: this.prHeader?.requester ?? '',
      departmentID: Number(this.prHeader?.departmentID || 0),
      neededBy: this.prHeader?.neededBy ?? null,
      description: this.prHeader?.description ?? '',
      multiLoc: !!this.prHeader?.multiLoc,
      oversea: !!this.prHeader?.oversea
    };

    // strip UI-only fields from lines
    const lines = (this.prLines || []).map(l => {
      const {
        filteredItems, filteredUoms, filteredLocations,
        dropdownOpen, uomDropdownOpen, locationDropdownOpen,
        isDraft, ...rest
      } = l || {};
      return rest;
    });

    // IMPORTANT: exclude searchText from signature (it may resolve later)
    return JSON.stringify({ header, lines });
  }

  /** Set the current state as "clean" */
  private updateBaseline(): void {
    this.initialSignature = this.computeSignature();
  }

  /** Should we warn before leaving? TRUE only if something actually changed */
  private hasUnsavedChanges(): boolean {
    const currentSig = this.computeSignature();
    const changed = currentSig !== this.initialSignature;

    // If you still want to warn purely because it's a server draft, add:
    // return changed || !!this.tempDraftId;
    return changed;
  }

  /** Navigate back to PR list with Save / Discard / Stay options */
  onGoToPRList(): void {
    if (!this.hasUnsavedChanges()) {
      this.router.navigate(['/purchase/list-PurchaseRequest']);
      return;
    }

    Swal.fire({
      title: 'Unsaved Changes',
      text: 'Do you want to save changes before leaving?',
      icon: 'warning',
      showCancelButton: true,     // "Discard"
      showCloseButton: true,      // X = "Stay"
      allowEscapeKey: true,
      allowOutsideClick: false,
      confirmButtonText: 'Save Changes',
      cancelButtonText: 'Discard',
      confirmButtonColor: '#2E5F73',
      cancelButtonColor: '#d33'
    }).then(result => {
      if (result.isConfirmed) {
        this.saveAsDraft();
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        this.discardAndGo();
      }
    });
  }

  private discardAndGo(): void {
    this.suppressAutosave = true;
    try { this.draft?.clear?.(); } catch {}
    this.router.navigate(['/purchase/list-PurchaseRequest']);
  }

  // ---------------- Draft save ----------------

  saveAsDraft(): void {
    const payload = {
      id: this.tempDraftId ?? 0,
      PurchaseRequestNo: 'pr-temp',
      requester: this.prHeader.requester,
      departmentID: this.prHeader.departmentID,
      deliveryDate: this.prHeader.neededBy,
      description: this.prHeader.description,
      multiLoc: this.prHeader.multiLoc,
      oversea: this.prHeader.oversea,
      prLines: JSON.stringify(this.prLines || []),
      status: 0,
      isActive: true,
      userId: this.userId,
      CreatedBy: this.userId,
      UpdatedBy: this.userId,
      DepartmentName: this.searchText || null
    };

    const goList = () => this.router.navigate(['/purchase/list-PurchaseRequest']);

    if (this.tempDraftId) {
      this.draft.update(this.tempDraftId, payload).subscribe({
        next: _ => Swal.fire({
          icon: 'success', title: 'Saved', text: 'Draft updated.', confirmButtonColor: '#2E5F73'
        }).then(() => {
          // NEW: reset baseline after successful save
          this.updateBaseline();
          goList();
        }),
        error: _ => Swal.fire({
          icon: 'error', title: 'Save Failed', text: 'Try again.', confirmButtonColor: '#2E5F73'
        })
      });
    } else {
      this.draft.create(payload).subscribe({
        next: (res: any) => {
          this.tempDraftId = res?.data ?? res?.id ?? null;
          Swal.fire({
            icon: 'success', title: 'Saved', text: 'Draft saved.', confirmButtonColor: '#2E5F73'
          }).then(() => {
            // NEW: baseline after creating draft
            this.updateBaseline();
            goList();
          });
        },
        error: _ => Swal.fire({
          icon: 'error', title: 'Save Failed', text: 'Try again.', confirmButtonColor: '#2E5F73'
        })
      });
    }
  }

  // ---------------- Client-only draft ----------------

  private saveDraft(): void {
    this.draft.save({
      prHeader: this.prHeader,
      prLines: this.prLines,
      departmentName: this.searchText,
      step: this.prStep
    });
  }

  onAddDepartmentClick(): void {
    this.saveDraft();
    this.router.navigate(['/master/department'], {
      state: { openCreate: true, returnUrl: this.RETURN_URL },
      replaceUrl: false
    });
  }

  // ---------------- UI dropdown close capture ----------------

  private onGlobalClickCapture(ev: MouseEvent) {
    const t = ev.target as HTMLElement;
    if (t.closest('.dropdown-wrapper') || t.closest('.prl-dropdown') || t.closest('.prl-menu')) return;

    this.zone.run(() => {
      this.dropdownOpen = false;
      this.prLines.forEach(l => {
        l.dropdownOpen = false;
        l.uomDropdownOpen = false;
        l.locationDropdownOpen = false;
      });
      if (this.modalLine) {
        this.modalLine.dropdownOpen = false;
        this.modalLine.uomDropdownOpen = false;
        this.modalLine.locationDropdownOpen = false;
      }
    });
  }

  onModalRootClick(ev: MouseEvent) {
    ev.stopPropagation();
    const t = ev.target as HTMLElement;
    const insideDropdown = t.closest('.prl-dropdown') || t.closest('.prl-menu');
    if (insideDropdown) return;
    this.modalLine.dropdownOpen = false;
    this.modalLine.uomDropdownOpen = false;
    this.modalLine.locationDropdownOpen = false;
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEsc(_e: KeyboardEvent) {}

  // ---------------- UI helpers ----------------

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

  trackByIndex(index: number) { return index; }

  // === NEW: centralized scroll helper ===
  private scrollTo(position: 'top' | 'bottom') {
    // Prefer anchors if present
    const anchor = position === 'bottom'
      ? this.bottomOfWizard?.nativeElement
      : this.topOfWizard?.nativeElement;

    if (anchor?.scrollIntoView) {
      anchor.scrollIntoView({ behavior: 'auto', block: 'start', inline: 'nearest' });
    }

    // Try parent container (for overflow layouts)
    anchor?.parentElement?.scrollTo?.({
      top: position === 'bottom'
        ? anchor.parentElement.scrollHeight
        : 0,
      left: 0,
      behavior: 'auto'
    });

    // Document/window fallbacks
    const scrollingElement = document.scrollingElement || document.documentElement;
    if (position === 'bottom') {
      scrollingElement.scrollTop = scrollingElement.scrollHeight;
      window.scrollTo({ top: document.body.scrollHeight, left: 0, behavior: 'auto' });
    } else {
      scrollingElement.scrollTop = 0;
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }

  // === UPDATED: go to step and scroll (down for Review, up otherwise) ===
  prGo(step: number) {
    (document.activeElement as HTMLElement | null)?.blur?.();

    const next = this.prStep + step;
    this.prStep = Math.max(0, Math.min(next, this.prSteps.length - 1));

    setTimeout(() => {
      requestAnimationFrame(() => {
        if (this.prStep === 2) {
          this.scrollTo('bottom');   // <- scroll down on Review
        } else {
          this.scrollTo('top');      // <- scroll up on other steps
        }
      });
    }, 0);
  }

  prRemoveLine(index: number) {
    if (this.draftIndex !== null && this.draftIndex === index) {
      this.closeModal();
      return;
    }
    this.prLines.splice(index, 1);
  }

  setMinDate() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    this.minDate = `${yyyy}-${mm}-${dd}`;
  }

  // ---------------- Loads ----------------

  loadDepartments() {
    this.deptService.getDepartment().subscribe((res: any) => {
      // normalize ids to numbers, keep original fields
      this.departments = (res?.data ?? []).map((x: any) => ({
        ...x,
        id: this.toNum(x.id ?? x.Id ?? x.departmentID ?? x.DepartmentID)
      }));
      this.filteredDepartments = [...this.departments];

      this.departmentsLoaded = true;

      if (this.pendingDeptName && !this.searchText) {
        this.searchText = this.pendingDeptName;
      }
      if (!this.searchText && (this.prHeader?.departmentID || this.pendingDeptId)) {
        if (this.pendingDeptId) this.prHeader.departmentID = this.pendingDeptId;
      }

      this.resolveDepartmentName();
    });
  }

  loadCatalogs() {
    this.chartOfAccountService.getAllChartOfAccount().subscribe((res: any) => {
      this.accountHeads = res?.data ?? [];
      this.parentHeadList = this.accountHeads.map((head: any) => ({
        value: head.id,
        label: this.buildFullPath(head)
      }));

      this.itemService.getAllItem().subscribe((ires: any) => {
        const raw = ires?.data ?? [];
        this.itemsList = raw.map((item: any) => {
          const matched = this.parentHeadList.find(h => +h.value === +item.budgetLineId);
          return { ...item, label: matched ? matched.label : null };
        });
      });
    });

    this.uomService.getAllUom().subscribe((res: any) => {
      this.uomList = res?.data ?? [];
    });

    this.locationService.getLocation().subscribe((res: any) => {
      this.locationList = res?.data ?? [];
    });
  }

  loadRequests() {
    this.purchaseService.getAll().subscribe({
      next: (res: any) => {
        this.purchaseRequests = (res?.data || []).map((req: any) => ({
          ...req,
          prLines: req.prLines ? JSON.parse(req.prLines) : []
        }));
      },
      error: (err: any) => console.error('Error loading list', err)
    });
  }

  buildFullPath(item: any): string {
    if (!item) return '';
    let path = item.headName;
    let current = this.accountHeads.find((x: any) => x.id === item.parentHead);
    while (current) {
      path = `${current.headName} >> ${path}`;
      current = this.accountHeads.find((x: any) => x.id === current.parentHead);
    }
    return path;
  }

  // ---------------- Department dropdown ----------------

  filterDepartments() {
    const q = (this.searchText || '').toLowerCase();
    this.filteredDepartments = this.departments.filter(d =>
      ((d.departmentName ?? d.DepartmentName ?? '') as string).toLowerCase().includes(q)
    );
  }

  toggleDropdown(force?: boolean) {
    this.dropdownOpen = force !== undefined ? !!force : !this.dropdownOpen;
  }

  selectDepartment(dept: any) {
    const id =
      this.toNum(dept?.id ?? dept?.Id ?? dept?.departmentID ?? dept?.DepartmentID);
    const name = dept?.departmentName ?? dept?.DepartmentName ?? '';

    this.prHeader.departmentID = id;
    this.searchText = name;
    this.pendingDeptId = null;
    this.pendingDeptName = null;
    this.dropdownOpen = false;
  }

  // ---------------- Modal / lines ----------------

  private makeEmptyDraft() {
    return {
      itemSearch: '',
      itemCode: '',
      qty: null,
      uomSearch: '',
      uom: '',
      locationSearch: '',
      location: '',
      budget: '',
      remarks: '',
      filteredItems: [] as any[],
      filteredUoms: [] as any[],
      filteredLocations: [] as any[],
      dropdownOpen: false,
      uomDropdownOpen: false,
      locationDropdownOpen: false,
      isDraft: true
    };
  }

  private validateModal(): boolean {
    if (!this.modalLine?.itemSearch || !this.modalLine?.qty) {
      Swal.fire({
        icon: 'warning',
        title: 'Required',
        text: 'Item and Qty are required',
        confirmButtonColor: '#0e3a4c'
      });
      return false;
    }
    return true;
  }

  prAddLine() {
    if (this.draftIndex !== null) {
      this.showModal = true;
      return;
    }
    const draft = this.makeEmptyDraft();
    this.prLines.push(draft);
    this.draftIndex = this.prLines.length - 1;
    this.modalLine = this.prLines[this.draftIndex];
    this.showModal = true;
  }

  addAnotherPR() {
    if (!this.validateModal()) return;
    if (this.draftIndex !== null) {
      this.prLines[this.draftIndex].isDraft = false;
    }
    const draft = this.makeEmptyDraft();
    this.prLines.push(draft);
    this.draftIndex = this.prLines.length - 1;
    this.modalLine = this.prLines[this.draftIndex];
  }

  addAndClose() {
    if (!this.validateModal()) return;
    if (this.draftIndex !== null) {
      this.prLines[this.draftIndex].isDraft = false;
      this.draftIndex = null;
    }
    this.showModal = false;
  }

  closeModal() {
    if (this.draftIndex !== null) {
      if (this.prLines[this.draftIndex]?.isDraft) {
        this.prLines.splice(this.draftIndex, 1);
      }
    }
    this.draftIndex = null;
    this.editingIndex = null;
    this.showModal = false;

    this.modalLine.dropdownOpen = false;
    this.modalLine.uomDropdownOpen = false;
    this.modalLine.locationDropdownOpen = false;
  }

  onModalItemFocus() {
    this.modalLine.filteredItems = [...this.itemsList];
    this.modalLine.dropdownOpen = true;
  }
  filterModalItems() {
    const q = (this.modalLine.itemSearch || '').toLowerCase();
    this.modalLine.filteredItems = this.itemsList.filter(
      (it: any) => (it.itemName || '').toLowerCase().includes(q) || (it.itemCode || '').toLowerCase().includes(q)
    );
  }
  selectModalItem(item: any) {
    this.modalLine.itemSearch = item.itemName;
    this.modalLine.itemCode = item.itemCode;
    this.modalLine.uomSearch = item.uomName;
    this.modalLine.uom = item.uomName;
    this.modalLine.budget = item.label || '';
    this.modalLine.dropdownOpen = false;
    this.modalLine.filteredItems = [];
  }

  onModalUomFocus() {
    this.modalLine.filteredUoms = [...this.uomList];
    this.modalLine.uomDropdownOpen = true;
  }
  filterModalUoms() {
    const q = (this.modalLine.uomSearch || '').toLowerCase();
    this.modalLine.filteredUoms = this.uomList.filter((u: any) => (u.name || '').toLowerCase().includes(q));
  }
  selectModalUom(uom: any) {
    this.modalLine.uomSearch = uom.name;
    this.modalLine.uom = uom.name;
    this.modalLine.uomDropdownOpen = false;
    this.modalLine.filteredUoms = [];
  }

  onModalLocationFocus() {
    this.modalLine.filteredLocations = [...this.locationList];
    this.modalLine.locationDropdownOpen = true;
  }
  filterModalLocations() {
    const q = (this.modalLine.locationSearch || '').toLowerCase();
    this.modalLine.filteredLocations = this.locationList.filter((loc: any) => (loc.name || '').toLowerCase().includes(q));
  }
  selectModalLocation(location: any) {
    this.modalLine.locationSearch = location.name;
    this.modalLine.location = location.name;
    this.modalLine.locationDropdownOpen = false;
    this.modalLine.filteredLocations = [];
  }

  editLine(index: number) {
    if (this.draftIndex !== null) {
      this.prLines[this.draftIndex].isDraft = false;
      this.draftIndex = null;
    }
    this.editingIndex = index;

    this.modalLine = JSON.parse(JSON.stringify(this.prLines[index] || {}));
    this.modalLine.filteredItems = [];
    this.modalLine.filteredUoms = [];
    this.modalLine.filteredLocations = [];
    this.modalLine.dropdownOpen = false;
    this.modalLine.uomDropdownOpen = false;
    this.modalLine.locationDropdownOpen = false;
    this.modalLine.isDraft = false;

    this.showModal = true;
  }

  onSubmitModal() {
    if (this.editingIndex !== null) {
      this.saveEdit();
    } else {
      this.addAndClose();
    }
  }

  private saveEdit() {
    if (!this.modalLine?.itemSearch || !this.modalLine?.qty) {
      Swal.fire({
        icon: 'warning',
        title: 'Required',
        text: 'Item and Qty are required',
        confirmButtonColor: '#0e3a4c'
      });
      return;
    }

    const idx = this.editingIndex!;
    const {
      filteredItems, filteredUoms, filteredLocations,
      dropdownOpen, uomDropdownOpen, locationDropdownOpen,
      isDraft, ...clean
    } = this.modalLine;

    this.prLines[idx] = { ...this.prLines[idx], ...clean, isDraft: false };
    this.editingIndex = null;
    this.showModal = false;
  }

  // ---------------- Final save (Convert) ----------------

  saveRequest() {
    if (this.tempDraftId) {
      this.draft.promote(this.tempDraftId, this.userId).subscribe({
        next: (res: any) => {
          const newPrId = res?.data ?? res;
          Swal.fire({
            icon: 'success',
            title: 'Converted',
            text: 'Draft converted to Purchase Request.',
            confirmButtonColor: '#0e3a4c'
          }).then(() => this.router.navigate(['/purchase/list-PurchaseRequest']));
        },
        error: _ => Swal.fire({
          icon: 'error',
          title: 'Convert Failed',
          text: 'Try again.',
          confirmButtonColor: '#0e3a4c'
        })
      });
      return;
    }

    // Normal PR create/update (not from a server draft)
    const strippedLines = this.prLines.map(l => {
      const { filteredItems, filteredUoms, filteredLocations, dropdownOpen, uomDropdownOpen, locationDropdownOpen, isDraft, ...rest } = l;
      return rest;
    });

    const payload: any = {
      id: this.prHeader.id || 0,
      requester: this.prHeader.requester,
      departmentID: this.prHeader.departmentID,
      deliveryDate: this.prHeader.neededBy,
      description: this.prHeader.description,
      multiLoc: this.prHeader.multiLoc,
      oversea: this.prHeader.oversea,
      PurchaseRequestNo: '',
      CreatedBy: this.userId,
      UpdatedBy: this.userId,
      IsActive: true,
      Status: 1,
      prLines: JSON.stringify(strippedLines)
    };

    if (payload.id > 0) {
      this.purchaseService.update(payload.id, payload).subscribe({
        next: (res: any) => {
          Swal.fire({ icon: 'success', title: 'Updated', text: res?.message || 'Updated successfully', confirmButtonColor: '#0e3a4c' });
          this.draft.clear();
          this.loadRequests();
          this.resetForm();
          // NEW: baseline after successful update (if you choose to stay)
          this.updateBaseline();
          this.router.navigate(['/purchase/list-PurchaseRequest']);
        },
        error: (err: any) => console.error(err)
      });
    } else {
      this.purchaseService.create(payload).subscribe({
        next: (res: any) => {
          Swal.fire({ icon: 'success', title: 'Created', text: res?.message || 'Created successfully', confirmButtonColor: '#0e3a4c' });
          this.draft.clear();
          this.loadRequests();
          this.resetForm();
          // NEW: baseline after successful create (if you choose to stay)
          this.updateBaseline();
          this.router.navigate(['/purchase/list-PurchaseRequest']);
        },
        error: (err: any) => console.error(err)
      });
    }
  }

  resetForm() {
    this.prHeader = { id: 0, requester: '', departmentID: 0, neededBy: null, description: '', multiLoc: false, oversea: false };
    this.searchText = '';
    this.filteredDepartments = [...this.departments];
    this.dropdownOpen = false;
    this.prLines = [];
    this.prStep = 0;
    this.draftIndex = null;
    this.editingIndex = null;

    // Reset resolution flags
    this.headerLoaded = false;
    this.pendingDeptId = null;
    this.pendingDeptName = null;

    // NEW: reset baseline for a clean form
    this.updateBaseline();
  }

  editRequest(res: any) {
    const data = res.data;
    this.prHeader = {
      id: data.id,
      requester: data.requester,
      departmentID: this.toNum(data.departmentID),
      neededBy: data.deliveryDate ? String(data.deliveryDate).split('T')[0] : null,
      description: data.description,
      multiLoc: data.multiLoc,
      oversea: data.oversea,
      purchaseRequestNo: data.purchaseRequestNo
    };

    // for edit mode resolve name once depts loaded
    this.headerLoaded = true;
    this.resolveDepartmentName();

    try { this.prLines = data.prLines ? JSON.parse(data.prLines) : []; }
    catch { this.prLines = []; }

    // NEW: baseline is set in ngOnInit after editRequest call completes
  }

  goToPurchaseRequest() {
    this.router.navigateByUrl('/purchase/list-PurchaseRequest');
  }

  get totalQty(): number {
    return (this.prLines || []).reduce((sum: number, l: any) => {
      const q = Number(l?.qty) || 0;
      return sum + q;
    }, 0);
  }
}
