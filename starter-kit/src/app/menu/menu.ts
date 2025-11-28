// menu.ts
import { CoreMenu } from '@core/types'

export const menu: CoreMenu[] = [
  {
    id: 'home',
    title: 'Dashboard',
    translate: 'MENU.HOME',
    type: 'item',
    icon: 'home',
    url: '/home'
  },

  {
    id: 'master',
    title: 'Master',
    type: 'collapsible',
    icon: 'settings',
    children: [
      { id: 'approval-level', title: 'Approval Level', type: 'item', icon: 'circle', url: '/master/approval-level' },
      { id: 'cities', title: 'Cities', type: 'item', icon: 'circle', url: '/master/cities' },
      { id: 'countries', title: 'Countries', type: 'item', icon: 'circle', url: '/master/countries' },
      { id: 'uom', title: 'UOM', type: 'item', icon: 'circle', url: '/master/uom' },
      { id: 'incoterms', title: 'Incoterms', type: 'item', icon: 'circle', url: '/master/incoterms' },
      { id: 'flagissue', title: 'FlagIssue', type: 'item', icon: 'circle', url: '/master/flagIssue' },
      { id: 'paymentTerms', title: 'PaymentTerms', type: 'item', icon: 'circle', url: '/master/paymentTerms' },
      { id: 'currency', title: 'Currency', type: 'item', icon: 'circle', url: '/master/currency' },
      { id: 'location', title: 'Location', type: 'item', icon: 'circle', url: '/master/location' },
      { id: 'states', title: 'States', type: 'item', icon: 'circle', url: '/master/states' },
      { id: 'service', title: 'Services', type: 'item', icon: 'circle', url: '/master/service' },
      { id: 'suppliergroups', title: 'Supplier Groups', type: 'item', icon: 'circle', url: '/master/suppliergroups' },
      { id: 'customergroups', title: 'Customer Groups', type: 'item', icon: 'circle', url: '/master/customergroups' },
      { id: 'regions', title: 'Regions', type: 'item', icon: 'circle', url: '/master/regions' },
      { id: 'deductions', title: 'Deductions', type: 'item', icon: 'circle', url: '/master/deductions' },
      { id: 'income', title: 'Income', type: 'item', icon: 'circle', url: '/master/income' },
      { id: 'department', title: 'Department', type: 'item', icon: 'circle', url: '/master/department' },
      { id: 'items', title: 'Item', type: 'item', icon: 'circle', url: '/master/items' },
      { id: 'warehouse', title: 'Warehouse', type: 'item', icon: 'circle', url: '/master/warehouse' },
      { id: 'recurring', title: 'Recurring', type: 'item', icon: 'circle', url: '/master/recurring' },
      { id: 'taxcode', title: 'Taxcode', type: 'item', icon: 'circle', url: '/master/taxcode' },
      { id: 'catagory', title: 'Catagory', type: 'item', icon: 'circle', url: '/master/catagory' },
      { id: 'coastingmethod', title: 'Coasting Method ', type: 'item', icon: 'circle', url: '/master/coastingmethod' },
      { id: 'strategy', title: 'Strategy', type: 'item', icon: 'circle', url: '/master/strategy' },
      { id: 'stockissue', title: 'StockIssue', type: 'item', icon: 'circle', url: '/master/stockIssue' },
      { id: 'bin', title: 'BIN', type: 'item', icon: 'circle', url: '/master/bin' },
      { id: 'driver', title: 'DRIVER', type: 'item', icon: 'circle', url: '/master/driver' },
       { id: 'Vehicle', title: 'Vechicle', type: 'item', icon: 'circle', url: '/master/vehicle' },
       { id: 'bank', title: 'Bank', type: 'item', icon: 'circle', url: '/master/bank-list' },
       
    ]
  },

  {
    id: 'purchase',
    title: 'Purchase',
    translate: 'MENU.PURCHASE.TITLE',
    type: 'collapsible',
    icon: 'file',
    children: [
      { id: 'PR', title: 'Purchase Request', translate: 'MENU.PURCHASE.PR', type: 'item', icon: 'circle', url: '/purchase/list-PurchaseRequest' },
      { id: 'rfq', title: 'RFQ', translate: 'MENU.PURCHASE.RFQ', type: 'item', icon: 'circle', url: '/purchase/rfq' },
      { id: 'PO', title: 'Purchase Order', type: 'item', translate: 'MENU.PURCHASE.PO', icon: 'circle', url: '/purchase/list-purchaseorder' },
      { id: 'mobilereceiving', title: 'Mobile Receiving', translate: 'MENU.PURCHASE.MobileReceiving', type: 'item', icon: 'circle', url: '/purchase/mobilereceiving' },
      { id: 'GRN', title: 'Goods Receipt Note', translate: 'MENU.PURCHASE.GRN', type: 'item', icon: 'circle', url: '/purchase/list-Purchasegoodreceipt' },
      { id: 'Supplier Invoice', title: 'Supplier Invoice', translate: 'MENU.PURCHASE.SupplierInvoice', type: 'item', icon: 'circle', url: '/purchase/list-SupplierInvoice' },
      { id: 'Debit Note', title: 'Debit Note', translate: 'MENU.PURCHASE.DebitNote', type: 'item', icon: 'circle', url: '/purchase/list-debitnote' },


    ]
  },
  {
    id: 'inventory',
    title: 'Inventory',
    translate: 'MENU.INVENTORY.TITLE',
    type: 'collapsible',
    icon: 'file',
    children: [
     // { id: 'Inventory', title: 'Inventory', translate: 'MENU.INVENTORY.INVENOTYR', type: 'item', icon: 'circle', url: '/Inventory/Create-inventory' },
      { id: 'ItemMaster', title: 'Item Master', translate: 'MENU.INVENTORY.ITEMMASTER', type: 'item', icon: 'circle', url: '/Inventory/List-itemmaster' },
      { id: 'StackOverview', title: 'Stock-Overview', translate: 'MENU.INVENTORY.STACKOVERVIEW', type: 'item', icon: 'circle', url: '/Inventory/list-stackoverview' },
      { id: 'StackTransfer', title: 'Stock-Transfer', translate: 'MENU.INVENTORY.STACKTRANSFER', type: 'item', icon: 'circle', url: '/Inventory/list-stocktransfer' },
      { id: 'StockTake', title: 'Stock-Take', translate: 'MENU.INVENTORY.STOCKTAKE', type: 'item', icon: 'circle', url: '/Inventory/list-stocktake' },
      // { id: 'StockAdjustment', title: 'Stock-Adjustment', translate: 'MENU.INVENTORY.STOCKADJUSTMENT', type: 'item', icon: 'circle', url: '/Inventory/list-stockadjustment' },
      { id: 'StockReorderPlanning', title: 'Stock-Reorder-Planning', translate: 'MENU.INVENTORY.STOCKREORDERPLANNING', type: 'item', icon: 'circle', url: '/Inventory/list-stockreorderplanning' },


    ]
  },
  {
    id: 'sales',
    title: 'Sales',
    translate: 'MENU.SALES.TITLE',
    type: 'collapsible',
    icon: 'shopping-cart',
    children: [
      // { id: 'CustomerMaster', title: 'Customer Master', translate: 'MENU.SALES.CUSTOMERMASTER', type: 'item', icon: 'circle', url: '/Sales/Create-customer-master' },
      { id: 'Quotation', title: 'Quotation', translate: 'MENU.SALES.QUOTATION', type: 'item', icon: 'circle', url: '/Sales/Quotation-list' },
      { id: 'SalesOrder', title: 'Sales Order', translate: 'MENU.SALES.SALESORDER', type: 'item', icon: 'circle', url: '/Sales/Sales-Order-list' },
      { id: 'Picking', title: 'Picking & Packing', translate: 'MENU.SALES.PICKING', type: 'item', icon: 'circle', url: '/Sales/Picking-packing-list' },
      { id: 'DeliveryOrder', title: 'Delivery Order', translate: 'MENU.SALES.DELIVERYORDER', type: 'item', icon: 'circle', url: '/Sales/Delivery-order-list' },
      { id: 'SalesInvoice', title: 'Sales Invoice', translate: 'MENU.SALES.SALESINVOICE', type: 'item', icon: 'circle', url: '/Sales/Sales-Invoice-list' },
      { id: 'ReturnCredit', title: 'Credit Note', translate: 'MENU.SALES.RETURNCREDIT', type: 'item', icon: 'circle', url: '/Sales/Return-credit-list' },
      { id: 'Collections', title: 'Collections', translate: 'MENU.SALES.COLLECTIONS', type: 'item', icon: 'circle', url: '/Sales/Create-collections' },
      { id: 'Report', title: 'Report', translate: 'MENU.SALES.REPORTS', type: 'item', icon: 'circle', url: '/Sales/Reports-create' },
      { id: 'Shared', title: 'Shared', translate: 'MENU.SALES.SHARED', type: 'item', icon: 'circle', url: '/Sales/Shared-create' }
    ]
  },
  {
    id: 'financial',
    title: 'Financial',
    translate: 'MENU.FINANCIAL.TITLE',
    type: 'collapsible',
    icon: 'dollar-sign',
    children: [
      { id: 'ledger', title: 'General-Ledger', translate: 'MENU.FINANCIAL.LEDGER', type: 'item', icon: 'circle', url: '/financial/ledger' },
      { id: 'ChartofAccount', title: 'Chart of Account', translate: 'MENU.FINANCIAL.CHARTOFACCOUNT', type: 'item', icon: 'circle', url: '/financial/ChartOfAccount' },
      { id: 'journal', title: 'Journal', translate: 'MENU.FINANCIAL.JOURNAL', type: 'item', icon: 'circle', url: '/financial/journal' },
       { id: 'AR', title: 'Accounts Receivable', translate: 'MENU.FINANCIAL.ACCCOUNTSRECEIVABLE', type: 'item', icon: 'circle', url: '/financial/AR' },
      { id: 'AccountPayable', title: 'Accounts Payable', translate: 'MENU.FINANCIAL.ACCOUNTPAYABLE', type: 'item', icon: 'circle', url: '/financial/AccountPayable' },
      { id: 'tax-gst', title: 'Tax & Gst', translate: 'MENU.FINANCIAL.TAX', type: 'item', icon: 'circle', url: '/financial/tax-gst' },
      { id: 'Period-close', title: 'Period-close', translate: 'MENU.FINANCIAL.PERIODCLOSE', type: 'item', icon: 'circle', url: '/financial/Period-close' },
      { id: 'report', title: 'Report', translate: 'MENU.FINANCIAL.Report', type: 'item', icon: 'circle', url: '/financial/report' },
      { id: 'profitloss', title: 'Profit & Loss', translate: 'MENU.FINANCIAL.PROFITLOSS', type: 'item', icon: 'circle', url: '/financial/profitloss' }
    ]
  },

  {
    id: 'businesspartners',
    title: 'Business Partners',
    translate: 'MENU.BUSINESSPARTNERS.TITLE', // ✅ match locale below
    type: 'collapsible',
    icon: 'user',
    children: [
      { id: 'supplier', title: 'Supplier', translate: 'MENU.BUSINESSPARTNERS.SUPPLIER', type: 'item', icon: 'circle', url: '/Businesspartners/supplier' },
       { id: 'customermaster', title: 'Customer', translate: 'MENU.BUSINESSPARTNERS.CUSTOMER', type: 'item', icon: 'circle', url: '/Businesspartners/customermaster' }
    ]
  },

];
