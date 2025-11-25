import { Component, OnInit } from '@angular/core';
import { InvoiceEmailService } from './invoice-email.service';

@Component({
  selector: 'app-invoice-email',
  templateUrl: './invoice-email.component.html',
  styleUrls: ['./invoice-email.component.scss']
})
export class InvoiceEmailComponent implements OnInit {

  invoiceNo = 'SI-000231';
  selectedTemplate = 1;
  toEmail = 'ap@customer.com';
  ccEmail = 'accounts@fbh.com.sg';
  subject = '';
  body = '';

  constructor(private emailService: InvoiceEmailService) {}

  ngOnInit(): void {
    this.loadTemplate();
  }

  loadTemplate(): void {
    this.emailService.getTemplate(this.selectedTemplate).subscribe(t => {
      this.subject = t.subjectTemplate.replace('{{InvoiceNo}}', this.invoiceNo);
      this.body = t.bodyTemplate.replace('{{InvoiceNo}}', this.invoiceNo);
    });
  }

  onTemplateChange(): void {
    this.loadTemplate();
  }

  send(): void {
    const dto = {
      invoiceNo: this.invoiceNo,
      toEmail: this.toEmail,
      ccEmail: this.ccEmail,
      subject: this.subject,
      body: this.body,
      templateId: this.selectedTemplate
    };

    this.emailService.sendEmail(dto).subscribe(res => {
      alert(res.message || 'Email sent');
    });
  }
}

