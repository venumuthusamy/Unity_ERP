import { TestBed } from '@angular/core/testing';

import { PurchaseGoodreceiptService } from './purchase-goodreceipt.service';

describe('PurchaseGoodreceiptService', () => {
  let service: PurchaseGoodreceiptService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PurchaseGoodreceiptService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
