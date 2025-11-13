import { Component, OnInit, AfterViewInit } from '@angular/core';
import feather from 'feather-icons';

@Component({
  selector: 'app-reportscreate',
  templateUrl: './reportscreate.component.html',
  styleUrls: ['./reportscreate.component.scss']
})
export class ReportscreateComponent implements OnInit, AfterViewInit {

  activeReport: 'sales' | 'margin' | 'delivery' | null = 'sales';

  constructor() {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    setTimeout(() => feather.replace(), 0);
  }

  openReport(type: 'sales' | 'margin' | 'delivery'): void {
    this.activeReport = this.activeReport === type ? null : type;
    setTimeout(() => feather.replace(), 0);
  }
}
