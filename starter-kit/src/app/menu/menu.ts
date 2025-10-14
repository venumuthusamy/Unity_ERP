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
      { id: 'cities',          title: 'Cities',          type: 'item', icon: 'circle', url: '/master/cities' },
      { id: 'countries',       title: 'Countries',       type: 'item', icon: 'circle', url: '/master/countries' },
      { id: 'uom',             title: 'UOM',             type: 'item', icon: 'circle', url: '/master/uom' },
      { id: 'incoterms',       title: 'Incoterms',       type: 'item', icon: 'circle', url: '/master/incoterms' },
      { id: 'flagissue',       title: 'FlagIssue',       type: 'item', icon: 'circle', url: '/master/flagIssue' },
      { id: 'paymentTerms',    title: 'PaymentTerms',    type: 'item', icon: 'circle', url: '/master/paymentTerms' },
      { id: 'currency',        title: 'Currency',        type: 'item', icon: 'circle', url: '/master/currency' },
      { id: 'location',        title: 'Location',        type: 'item', icon: 'circle', url: '/master/location' },
      { id: 'states',          title: 'States',          type: 'item', icon: 'circle', url: '/master/states' },
      { id: 'service',         title: 'Services',        type: 'item', icon: 'circle', url: '/master/service' },
      { id: 'suppliergroups',  title: 'Supplier Groups', type: 'item', icon: 'circle', url: '/master/suppliergroups' },
      { id: 'customergroups',  title: 'Customer Groups', type: 'item', icon: 'circle', url: '/master/customergroups' },
      { id: 'regions',         title: 'Regions',         type: 'item', icon: 'circle', url: '/master/regions' },
      { id: 'deductions',      title: 'Deductions',      type: 'item', icon: 'circle', url: '/master/deductions' },
      { id: 'income',          title: 'Income',          type: 'item', icon: 'circle', url: '/master/income' },
      { id: 'department',      title: 'Department',      type: 'item', icon: 'circle', url: '/master/department' },
      { id: 'items', title: 'Item',   type: 'item',   icon: 'circle',   url: '/master/items'},
      { id: 'warehouse', title: 'Warehouse', type: 'item', icon: 'circle', url: '/master/warehouse'},
      { id: 'recurring', title: 'Recurring', type: 'item', icon: 'circle', url: '/master/recurring'},
      { id: 'taxcode', title: 'Taxcode', type: 'item', icon: 'circle', url: '/master/taxcode'},
      { id: 'catagory', title: 'Catagory', type: 'item', icon: 'circle', url: '/master/catagory'},
      { id: 'coastingmethod', title: 'Coasting Method ', type: 'item', icon: 'circle', url: '/master/coastingmethod'},
    ]
  },

  {
    id: 'purchase',
    title: 'Purchase',
    translate: 'MENU.PURCHASE.TITLE',
    type: 'collapsible',
    icon: 'file',
    children: [
      { id: 'PR', title: 'PR', translate: 'MENU.PURCHASE.PR', type: 'item', icon: 'circle', url: '/purchase/list-PurchaseRequest' },
        { id: 'rfq', title: 'RFQ', translate: 'MENU.PURCHASE.RFQ', type: 'item', icon: 'circle', url: '/purchase/rfq' },
      { id: 'PO', title: 'PO', type: 'item',translate: 'MENU.PURCHASE.PO', icon: 'circle', url: '/purchase/list-purchaseorder' },
       { id: 'mobilereceiving', title: 'Mobile Receiving', translate: 'MENU.PURCHASE.MobileReceiving', type: 'item', icon: 'circle', url: '/purchase/mobilereceiving' },
      { id: 'GRN', title: 'GRN', translate: 'MENU.PURCHASE.GRN', type: 'item', icon: 'circle', url: '/purchase/list-Purchasegoodreceipt' },
      { id: 'Supplier Invoice', title: 'Supplier Invoice', translate: 'MENU.PURCHASE.SupplierInvoice', type: 'item', icon: 'circle', url: '/purchase/list-SupplierInvoice' },
      { id: 'Debit Note', title: 'Debit Note',translate: 'MENU.PURCHASE.DebitNote', type: 'item', icon: 'circle', url: '/purchase/list-debitnote' },
     
     
    ]
  },
 {
    id: 'inventory',
    title: 'Inventory',
    translate: 'MENU.INVENTORY.TITLE',
    type: 'collapsible',
    icon: 'file',
    children: [
      { id: 'Inventory', title: 'Inventory', translate: 'MENU.INVENTORY.INVENOTYR', type: 'item', icon: 'circle', url: '/Inventory/Create-inventory' },
      { id: 'ItemMaster', title: 'Item Master', translate: 'MENU.INVENTORY.ITEMMASTER', type: 'item', icon: 'circle', url: '/Inventory/Create-itemmaster' },
      { id: 'StackOverview', title: 'Stock-Overview', translate: 'MENU.INVENTORY.STACKOVERVIEW', type: 'item', icon: 'circle', url: '/Inventory/list-stackoverview' },
      { id: 'StackTransfer', title: 'Stock-Transfer',translate: 'MENU.INVENTORY.STACKTRANSFER',type: 'item', icon: 'circle', url: '/Inventory/list-stocktransfer' },
      
      
     
     
    ]
  },
  {
    id: 'financial',
    title: 'Financial',
    translate: 'MENU.FINANCIAL.TITLE',
    type: 'collapsible',
    icon: 'dollar-sign',
    children: [
      { id: 'ChartofAccount', title: 'Chart of Account', translate: 'MENU.FINANCIAL.CHARTOFACCOUNT', type: 'item', icon: 'circle', url: '/financial/ChartOfAccount' }
    ]
  },

  {
    id: 'businesspartners',
    title: 'Business Partners',
    translate: 'MENU.BUSINESSPARTNERS.TITLE', // ✅ match locale below
    type: 'collapsible',
    icon: 'user',
    children: [
      { id: 'supplier', title: 'Supplier', translate: 'MENU.BUSINESSPARTNERS.SUPPLIER', type: 'item', icon: 'circle', url: '/Businesspartners/supplier' }
    ]
  },

];
