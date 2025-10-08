import {
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnInit,
  OnDestroy,
  ViewEncapsulation
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
  searchText = '';
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

  ngOnInit(): void {
    this.setMinDate();

    // If route is new (no :id), restore draft first
    const urlHasId = !!this.route.snapshot.paramMap.get('id');
    if (!urlHasId) {
      const d = this.draft.load();
      if (d) {
        this.prHeader = { ...this.prHeader, ...(d.prHeader || {}) };
        this.prLines = d.prLines || [];
        this.searchText = d.departmentName ?? '';
        this.prStep = typeof d.step === 'number' ? d.step : 0;
      }
    }

    // Apply department data passed from Department screen via navigation state (one-time, not in URL)
    const st = window.history.state as any;
    if (st?.deptId || st?.deptName) {
      if (st.deptId) this.prHeader.departmentID = +st.deptId;
      if (st.deptName) this.searchText = st.deptName;
      // nothing to clear; state isn’t in the URL
    }

    // Load lists
    this.loadRequests();
    this.loadDepartments();
    this.loadCatalogs();

    // Edit mode (/:id)
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
          }
        });
      }
    });

    // Capture-phase global click to close dropdowns
    this.captureHandler = (ev: MouseEvent) => this.onGlobalClickCapture(ev);
    document.addEventListener('click', this.captureHandler, { capture: true });
  }

  ngOnDestroy(): void {
    if (this.captureHandler) {
      document.removeEventListener('click', this.captureHandler, { capture: true } as any);
    }
  }

  // ===== Navigation helpers =====
  private saveDraft(): void {
    this.draft.save({
      prHeader: this.prHeader,
      prLines: this.prLines,
      departmentName: this.searchText,
      step: this.prStep
    });
  }

  /** (+) button beside Department input */
  onAddDepartmentClick(): void {
    this.saveDraft();
    this.router.navigate(['/master/department'], {
      state: { openCreate: true, returnUrl: this.RETURN_URL },
      // optional: keep history clean
      replaceUrl: false
    });
  }

  // ====== Outside click (capture-phase) ======
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
  onEsc(_e: KeyboardEvent) { /* keep modal open */ }

  // ===== UI helpers =====
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

  trackByIndex(index: number) { return index; }

  prGo(step: number) {
    const next = this.prStep + step;
    this.prStep = Math.max(0, Math.min(next, this.prSteps.length - 1));
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

  // ===== Loads =====
  loadDepartments() {
    this.deptService.getDepartment().subscribe((res: any) => {
      this.departments = res?.data ?? [];
      this.filteredDepartments = [...this.departments];
      this.syncDepartmentName();
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

  // ===== Department dropdown =====
  filterDepartments() {
    const q = (this.searchText || '').toLowerCase();
    this.filteredDepartments = this.departments.filter(d =>
      (d.departmentName || '').toLowerCase().includes(q)
    );
  }

  toggleDropdown(force?: boolean) {
    this.dropdownOpen = force !== undefined ? !!force : !this.dropdownOpen;
  }

  selectDepartment(dept: any) {
    this.prHeader.departmentID = dept?.id ?? 0;
    this.searchText = dept?.departmentName ?? '';
    this.dropdownOpen = false;
  }

  private syncDepartmentName(): void {
    if (!this.prHeader?.departmentID || !Array.isArray(this.departments)) return;
    const match = this.departments.find((d: any) => +d.id === +this.prHeader.departmentID);
    if (match) this.searchText = match.departmentName;
  }

  // ===== Table line dropdowns =====
  onItemFocus(line: any) {
    line.filteredItems = [...this.itemsList];
    line.dropdownOpen = true;
  }
  filterItems(line: any) {
    const q = (line.itemSearch || '').toLowerCase();
    line.filteredItems = this.itemsList.filter(
      (it: any) => (it.itemName || '').toLowerCase().includes(q) || (it.itemCode || '').toLowerCase().includes(q)
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
    line.filteredItems = [];
  }

  onUomFocus(line: any) {
    line.filteredUoms = [...this.uomList];
    line.uomDropdownOpen = true;
  }
  filterUoms(line: any) {
    const q = (line.uomSearch || '').toLowerCase();
    line.filteredUoms = this.uomList.filter((u: any) => (u.name || '').toLowerCase().includes(q));
  }
  selectUom(line: any, uom: any) {
    line.uom = uom.name;
    line.uomSearch = uom.name;
    line.uomDropdownOpen = false;
    line.filteredUoms = [];
  }

  onLocationFocus(line: any) {
    line.filteredLocations = [...this.locationList];
    line.locationDropdownOpen = true;
  }
  filterLocations(line: any) {
    const q = (line.locationSearch || '').toLowerCase();
    line.filteredLocations = this.locationList.filter((loc: any) => (loc.name || '').toLowerCase().includes(q));
    line.locationDropdownOpen = true;
  }
  selectLocation(line: any, location: any) {
    line.location = location.name;
    line.locationSearch = location.name;
    line.locationDropdownOpen = false;
    line.filteredLocations = [];
  }

  // ===== Modal helpers =====
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
    this.modalLine.filteredUms = [];
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

  saveRequest() {
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
  }

  editRequest(res: any) {
    const data = res.data;
    this.prHeader = {
      id: data.id,
      requester: data.requester,
      departmentID: data.departmentID,
      neededBy: data.deliveryDate ? String(data.deliveryDate).split('T')[0] : null,
      description: data.description,
      multiLoc: data.multiLoc,
      oversea: data.oversea,
      purchaseRequestNo: data.purchaseRequestNo
    };
    this.syncDepartmentName();
    this.searchText = this.departments.find(d => +d.id === +data.departmentID)?.departmentName || '';
    this.prLines = data.prLines ? JSON.parse(data.prLines) : [];
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
