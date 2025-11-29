import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { InvoiceEmailService } from './invoice-email.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-invoice-email',
  templateUrl: './invoice-email.component.html',
  styleUrls: ['./invoice-email.component.scss'],
  encapsulation:ViewEncapsulation.None
})
export class InvoiceEmailComponent implements OnInit {

  // 'SI' = Sales Invoice, 'PIN' = Supplier Invoice
  docType: 'SI' | 'PIN' = 'SI';

  // invoice dropdown data
  invoiceList: any[] = [];
  selectedInvoiceId: number | null = null;

  // document info
  invoiceNo = '';
  partyName = '';
  partyLabel = 'Customer'; // Customer / Supplier

  // email info
  selectedTemplate = 1;
  toEmail = '';
  ccEmail = '';
  subject = '';
  body = '';

  // loading flag
  isSending = false;

  constructor(private emailService: InvoiceEmailService) {}

  ngOnInit(): void {
    this.partyLabel = this.docType === 'SI' ? 'Customer' : 'Supplier';
    this.loadInvoiceList();
  }

  // change SI / PIN
  onDocTypeChange(): void {
    this.partyLabel = this.docType === 'SI' ? 'Customer' : 'Supplier';

    // reset form
    this.selectedInvoiceId = null;
    this.invoiceNo = '';
    this.partyName = '';
    this.toEmail = '';
    this.ccEmail = '';
    this.subject = '';
    this.body = '';

    this.loadInvoiceList();
  }

  // load invoice dropdown based on docType
  loadInvoiceList(): void {
    this.emailService.getInvoiceList(this.docType).subscribe(list => {
      this.invoiceList = list || [];
    });
  }

  // when invoice selected
  onInvoiceChange(): void {
    if (!this.selectedInvoiceId) {
      this.invoiceNo = '';
      this.partyName = '';
      this.toEmail = '';
      this.ccEmail = '';
      this.subject = '';
      this.body = '';
      return;
    }

    this.emailService.getInvoiceInfo(this.docType, this.selectedInvoiceId)
      .subscribe(info => {
        // expected: { id, invoiceNo, partyName, email, ccEmail, amount ... }
        this.invoiceNo = info.invoiceNo;
        this.partyName = info.partyName;
        this.toEmail = info.email || '';
        this.ccEmail = info.ccEmail || '';

        // apply template
        this.loadTemplate();
      });
  }

  // get subject/body from template ({{InvoiceNo}}, {{PartyName}})
  loadTemplate(): void {
    if (!this.selectedTemplate || !this.invoiceNo) return;

    this.emailService.getTemplate(this.selectedTemplate, this.docType)
      .subscribe(t => {
        this.subject = t.subjectTemplate
          .replace('{{InvoiceNo}}', this.invoiceNo)
          .replace('{{PartyName}}', this.partyName || '');

        this.body = t.bodyTemplate
          .replace('{{InvoiceNo}}', this.invoiceNo)
          .replace('{{PartyName}}', this.partyName || '');
      });
  }

  onTemplateChange(): void {
    if (this.invoiceNo) {
      this.loadTemplate();
    }
  }

 send(): void {
  const invoiceId = this.selectedInvoiceId;
  if (!invoiceId) { /* Swal warning ... */ return; }
  if (!this.toEmail) { /* Swal warning ... */ return; }

  const loginEmail = localStorage.getItem('email') || 'venumuthusamy@gmail.com';
  const loginName  = localStorage.getItem('username') || 'Unity ERP';

  const payload = {
    fromEmail: loginEmail,
    fromName: loginName,
    toEmail: this.toEmail,
    toName: this.partyName,
    subject: this.subject,
    bodyHtml: this.body,
    fileName: `${this.invoiceNo}.pdf`,
    invoiceNo: this.invoiceNo
  };

  this.isSending = true;

  this.emailService.sendEmail(this.docType, invoiceId, payload).subscribe({
    next: res => {
      this.isSending = false;
      Swal.fire({
        icon: res.success ? 'success' : 'info',
        title: res.success ? 'Email Sent' : 'Notice',
        text: res.message || 'Invoice email processed.',
        confirmButtonColor: '#2E5F73'
      });
    },
    error: err => {
      console.error(err);
      this.isSending = false;
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to send invoice email.',
        confirmButtonColor: '#e3342f'
      });
    }
  });
}
}
