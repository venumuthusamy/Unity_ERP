import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { OcrResponse, OcrService } from '../ocrservice.service';

@Component({
  selector: 'app-ocr-upload-modal',
  templateUrl: './ocruploadmodal.component.html',
  styleUrls: ['./ocruploadmodal.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class OcruploadmodalComponent {
  @Input() open = false;

  @Input() createdBy?: string;
  @Input() refNo?: string;

  @Output() closed = new EventEmitter<void>();
  @Output() applied = new EventEmitter<OcrResponse>();

  lang = 'eng';
  file?: File;
  previewUrl?: string;

  loading = false;
  error?: string;
  result?: OcrResponse;

  constructor(private ocr: OcrService) {}

  close() {
    this.open = false;
    this.closed.emit();
  }

  onPick(e: any) {
    this.error = undefined;
    this.result = undefined;

    const f = e?.target?.files?.[0] as File | undefined;
    this.file = f;

    if (!f) {
      this.previewUrl = undefined;
      return;
    }

    const reader = new FileReader();
    reader.onload = () => (this.previewUrl = String(reader.result || ''));
    reader.readAsDataURL(f);
  }

  run() {
    if (!this.file) return;

    this.loading = true;
    this.error = undefined;
    this.result = undefined;

    this.ocr.extract(this.file, {
      lang: this.lang,
      module: 'PIN-DRAFT',
      refNo: this.refNo,
      createdBy: this.createdBy
    }).subscribe({
      next: (res) => {
        this.result = res;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || err?.message || 'OCR failed';
      }
    });
  }

  applyToFormOnly() {
    if (!this.result) return;
    this.applied.emit(this.result);
    this.close();
  }

  reset() {
    this.file = undefined;
    this.previewUrl = undefined;
    this.error = undefined;
    this.result = undefined;
  }

  copy() {
    navigator.clipboard.writeText(this.result?.text || '');
  }
}
