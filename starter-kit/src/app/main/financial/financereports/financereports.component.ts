import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-financereports',
  templateUrl: './financereports.component.html',
  styleUrls: ['./financereports.component.scss']
})
export class FinancereportsComponent implements OnInit {

  constructor(private router : Router) { }

  ngOnInit(): void {
  }

    goToProfitLoss(): void {
 this.router.navigate(['financial/profitloss']);
}

  goToBalanceSheet(): void {
 this.router.navigate(['financial/balance-sheet']);
}

  goToGstReport(): void {
 this.router.navigate(['financial/Gst-report']);
}

goToAging(): void {
 this.router.navigate(['financial/aging']);
}
}
