// src/app/main/finance/ar/invoice-service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'environments/environment';
import { map } from 'rxjs/operators';

export interface ArInvoiceListItem {
    invoiceId: number;
    invoiceNo: string;
    invoiceDate: string;
    dueDate?: string | null;

    customerId: number;
    customerName: string;

    amount: number;
    paid: number;
    creditNote: number;
    outstanding: number;
    customerCreditNoteAmount?: number;
    customerCreditNoteNo?: string | null;
    customerCreditNoteDate?: string | null;
    customerCreditStatus?: number; 
}

/** Grouped by customer for UI */
export interface ArCustomerGroup {
    customerId: number;
    customerName: string;
    invoiceCount: number;
    totalAmount: number;
    totalPaid: number;
    totalCreditNote: number;
    totalOutstanding: number;

    invoices: ArInvoiceListItem[];
    expanded?: boolean;
    creditNoteNo?: string | null;
    creditNoteDate?: string | null;
     creditNoteStatus?: number; 
}

@Injectable({ providedIn: 'root' })
export class ArInvoiceService {
    private url = environment.apiUrl
    private baseUrl = '/ArInvoice';

    constructor(private http: HttpClient) { }

    getInvoices(): Observable<ArInvoiceListItem[]> {
        return this.http
            .get<{ data: ArInvoiceListItem[] }>(`${this.url + this.baseUrl}/list`)
            .pipe(map(r => r.data || []));
    }
}
