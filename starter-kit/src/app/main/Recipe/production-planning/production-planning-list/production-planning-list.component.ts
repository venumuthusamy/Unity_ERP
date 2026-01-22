import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { ProductionPlanService } from '../production-plan.service';
@Component({
  selector: 'app-production-planning-list',
  templateUrl: './production-planning-list.component.html',
  styleUrls: ['./production-planning-list.component.scss'],
  encapsulation:ViewEncapsulation.None
})
export class ProductionPlanningListComponent implements OnInit {
  rows: any[] = [];
  allRows: any[] = [];
  searchValue = '';

  showExplosionModal = false;
  explosionRows: any[] = [];

  constructor(private srv: ProductionPlanService, private router: Router) {}

  ngOnInit(): void {
    //this.load();
  }

  // load(): void {
  //   this.srv.list().subscribe({
  //     next: (res) => {
  //       const data = res?.data ?? [];
  //       this.rows = data;
  //       this.allRows = data;
  //     },
  //     error: (e) => console.error(e)
  //   });
  // }

  applyFilter(): void {
    const v = (this.searchValue || '').toLowerCase();
    this.rows = this.allRows.filter(r =>
      String(r.id).includes(v) ||
      String(r.salesOrderNo || '').toLowerCase().includes(v) ||
      String(r.status || '').toLowerCase().includes(v)
    );
  }

  // openCreateFromSo(): void {
  //   // simplest: ask SO id and create
  //   Swal.fire({
  //     title: 'Create Production Plan',
  //    input: 'text', 
  //     inputLabel: 'Enter SalesOrderId',
  //     showCancelButton: true,
  //     confirmButtonText: 'Create'
      
  //   }).then(r => {
  //     if (!r.isConfirmed) return;

  //     const soId = Number(r.value || 0);
  //     if (!soId) return;

  //     this.srv.createFromSo({ salesOrderId: soId }).subscribe({
  //       next: () => {
  //         Swal.fire('Created', 'Production plan created', 'success');
  //         this.load();
  //       },
  //       error: (e) => Swal.fire('Failed', e?.error?.message || 'Create failed', 'error')
  //     });
  //   });
  // }

  edit(id: number): void {
    this.router.navigate(['/Recipe/productionplanningedit', id]);
  }

  // remove(id: number): void {
  //   Swal.fire({
  //     title: 'Delete?',
  //     text: 'This will mark plan as Deleted.',
  //     icon: 'warning',
  //     showCancelButton: true,
  //     confirmButtonText: 'Yes, delete'
  //   }).then(r => {
  //     if (!r.isConfirmed) return;

  //     this.srv.delete(id).subscribe({
  //       next: () => {
  //         Swal.fire('Deleted', 'Plan deleted', 'success');
  //         this.load();
  //       },
  //       error: (e) => Swal.fire('Failed', e?.error?.message || 'Delete failed', 'error')
  //     });
  //   });
  // }

  // openExplosion(row: any): void {
  //   const id = Number(row?.id || 0);
  //   if (!id) return;

  //   this.srv.explosion(id).subscribe({
  //     next: (res) => {
  //       this.explosionRows = res?.data ?? [];
  //       this.showExplosionModal = true;
  //     },
  //     error: (e) => Swal.fire('Failed', e?.error?.message || 'Explosion load failed', 'error')
  //   });
  // }

  closeExplosion(): void {
    this.showExplosionModal = false;
    this.explosionRows = [];
  }
}
