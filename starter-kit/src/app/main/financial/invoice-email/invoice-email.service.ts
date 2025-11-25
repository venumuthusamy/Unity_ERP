import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'environments/environment';

@Injectable({ providedIn: 'root' })
export class InvoiceEmailService {
  private base = environment.apiUrl + '/invoiceemail';

  constructor(private http: HttpClient) {}

  getTemplate(id: number) {
    return this.http.get<any>(`${this.base}/template/${id}`);
  }

  sendEmail(dto: any) {
    return this.http.post<any>(`${this.base}/send`, dto);
  }
}

