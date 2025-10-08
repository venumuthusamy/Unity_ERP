import { Injectable } from '@angular/core';

export interface PrDraft {
  prHeader: any;
  prLines: any[];
  departmentName?: string;
  step?: number;
}

@Injectable({ providedIn: 'root' })
export class PrDraftService {
  private KEY = 'pr_draft_v1';

  save(draft: PrDraft) {
    try {
      sessionStorage.setItem(this.KEY, JSON.stringify(draft));
    } catch { /* ignore */ }
  }

  load(): PrDraft | null {
    try {
      const s = sessionStorage.getItem(this.KEY);
      return s ? (JSON.parse(s) as PrDraft) : null;
    } catch {
      return null;
    }
  }

  clear() {
    try {
      sessionStorage.removeItem(this.KEY);
    } catch { /* ignore */ }
  }
}
