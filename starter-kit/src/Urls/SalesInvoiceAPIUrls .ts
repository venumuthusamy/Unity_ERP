// Urls/SalesInvoiceAPIUrls.ts
export class SalesInvoiceAPIUrls {
  static readonly List         = '/salesinvoice/List';
  static readonly Get          = '/salesinvoice/';                 // + {id}
  static readonly Create       = '/salesinvoice/Create';
  static readonly Delete       = '/salesinvoice/Delete/';          // + {id}
  static readonly SourceLines  = '/salesinvoice/SourceLines';      // ?sourceType=1&sourceId=#
}
