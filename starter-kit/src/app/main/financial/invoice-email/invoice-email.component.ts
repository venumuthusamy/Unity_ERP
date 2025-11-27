import { Component, OnInit } from '@angular/core';
import { InvoiceEmailService } from './invoice-email.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-invoice-email',
  templateUrl: './invoice-email.component.html',
  styleUrls: ['./invoice-email.component.scss']
})
export class InvoiceEmailComponent implements OnInit {

  // SI = Sales Invoice, PIN = Supplier Invoice
  docType: 'SI' | 'PIN' = 'SI';

  // invoice dropdown data
  invoiceList: any[] = [];
  selectedInvoiceId: number | null = null;

  // document info
  invoiceNo = '';
  partyName = '';
  partyLabel = 'Customer'; // or 'Supplier' based on docType

  // email info
  selectedTemplate = 1;
  toEmail = '';
  ccEmail = '';
  subject = '';
  body = '';

  constructor(private emailService: InvoiceEmailService) {}

  ngOnInit(): void {
    this.partyLabel = this.docType === 'SI' ? 'Customer' : 'Supplier';
    this.loadInvoiceList();
    // template is static "Standard" for now, so just load template when needed
  }

  // when Sales Invoice / Supplier Invoice changes
  onDocTypeChange(): void {
    this.partyLabel = this.docType === 'SI' ? 'Customer' : 'Supplier';
    this.selectedInvoiceId = null;
    this.invoiceNo = '';
    this.partyName = '';
    this.toEmail = '';
    this.ccEmail = '';
    this.subject = '';
    this.body = '';

    this.loadInvoiceList();
  }

  // get invoices based on docType
  loadInvoiceList(): void {
    this.emailService.getInvoiceList(this.docType).subscribe(list => {
      this.invoiceList = list || [];
    });
  }

  // when user selects an invoice in dropdown
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

    // Call API to get full info (customer/supplier + email)
    this.emailService.getInvoiceInfo(this.docType, this.selectedInvoiceId)
      .subscribe(info => {
        // expected: { invoiceNo, partyName, email, ccEmail }
        this.invoiceNo = info.invoiceNo;
        this.partyName = info.partyName;
        this.toEmail = info.email || '';
        this.ccEmail = info.ccEmail || '';

        // now apply template for this invoice
        this.loadTemplate();
      });
  }

  // get subject/body from template and replace {{InvoiceNo}}
  loadTemplate(): void {
    if (!this.selectedTemplate || !this.invoiceNo) {
      return;
    }

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
    // Re-apply template for selected invoice
    if (this.invoiceNo) {
      this.loadTemplate();
    }
  }

  // send(): void {
  //   const dto = {
  //     docType: this.docType,          // 'SI' or 'PIN'
  //     invoiceId: this.selectedInvoiceId,
  //     invoiceNo: this.invoiceNo,
  //     toEmail: this.toEmail,
  //     ccEmail: this.ccEmail,
  //     subject: this.subject,
  //     body: this.body,
  //     templateId: this.selectedTemplate
  //   };

  //   this.emailService.sendEmail(dto).subscribe(res => {
  //     alert(res.message || 'Email sent');
  //   });
  // }
  send() {
  const loginEmail = localStorage.getItem('email'); // 👈 your login email key
  const loginName  = localStorage.getItem('username');  // optional

  const payload = {
    fromEmail: loginEmail,                      // FROM = login user
    fromName: loginName,

    toEmail: this.toEmail,          // TO = user entered
     toName:this.partyName,            

    subject: `Invoice ${this.invoiceNo}`,
    bodyHtml: `<p>Dear ${this.partyName || ''},</p>
               <p>Please find attached invoice ${this.invoiceNo}.</p>`,

    fileName: `${this.invoiceNo}.pdf`
  };

 this.emailService.sendEmail(payload).subscribe({
  next: (res: any) => {
    const ok = res?.success ?? res?.Success ?? false;

    Swal.fire({
      icon: ok ? 'success' : 'error',
      title: ok ? 'Email sent' : 'Failed to send',
      text: res?.message || (ok ? 'Email sent successfully.' : 'Something went wrong.'),
      confirmButtonColor: '#2E5F73'
    });
  },
  error: (err) => {
    
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Unable to send email. Please try again.',
      confirmButtonColor: '#2E5F73'
    });
  }
});
}

}
