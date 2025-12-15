// menu.ts
import { CoreMenu } from '@core/types';

/**
 * ✅ RULES (your requirement)
 * - approvalRoles  => Super Admin / Admin / Manager (Approval Levels)
 * - teams          => Purchase Team / Sales Team / Finance Team (UserRole/Teams)
 *
 * NOTE:
 * - If you don't give teams/approvalRoles => everyone can see (so we ALWAYS set for secured menus)
 * - Dashboard is common for all
 */
export const menu: any[] = [
  // =========================
  // DASHBOARD (ALL LOGGED USERS)
  // =========================
  {
    id: 'home',
    title: 'Dashboard',
    translate: 'MENU.HOME',
    type: 'item',
    icon: 'home',
    url: '/home'
    // no teams/approvalRoles => allow all
  },

  // =========================
  // MASTER (ONLY ADMIN / SUPER ADMIN)
  // =========================
  {
    id: 'master',
    title: 'Master',
    type: 'collapsible',
    icon: 'settings',
    approvalRoles: ['Admin', 'Super Admin'],
    children: [
      // ONLY SUPER ADMIN
      {
        id: 'approval-level',
        title: 'Approval Level',
        type: 'item',
        icon: 'circle',
        url: '/master/approval-level',
        approvalRoles: ['Super Admin']
      },

      // ADMIN OR SUPER ADMIN
      { id: 'cities', title: 'Cities', type: 'item', icon: 'circle', url: '/master/cities', approvalRoles: ['Admin', 'Super Admin'] },
      { id: 'countries', title: 'Countries', type: 'item', icon: 'circle', url: '/master/countries', approvalRoles: ['Admin', 'Super Admin'] },
      { id: 'uom', title: 'UOM', type: 'item', icon: 'circle', url: '/master/uom', approvalRoles: ['Admin', 'Super Admin'] },
      { id: 'incoterms', title: 'Incoterms', type: 'item', icon: 'circle', url: '/master/incoterms', approvalRoles: ['Admin', 'Super Admin'] },
      { id: 'flagissue', title: 'FlagIssue', type: 'item', icon: 'circle', url: '/master/flagIssue', approvalRoles: ['Admin', 'Super Admin'] },
      { id: 'paymentTerms', title: 'PaymentTerms', type: 'item', icon: 'circle', url: '/master/paymentTerms', approvalRoles: ['Admin', 'Super Admin'] },
      { id: 'currency', title: 'Currency', type: 'item', icon: 'circle', url: '/master/currency', approvalRoles: ['Admin', 'Super Admin'] },
      { id: 'location', title: 'Location', type: 'item', icon: 'circle', url: '/master/location', approvalRoles: ['Admin', 'Super Admin'] },
      { id: 'states', title: 'States', type: 'item', icon: 'circle', url: '/master/states', approvalRoles: ['Admin', 'Super Admin'] },
      { id: 'service', title: 'Services', type: 'item', icon: 'circle', url: '/master/service', approvalRoles: ['Admin', 'Super Admin'] },
      { id: 'suppliergroups', title: 'Supplier Groups', type: 'item', icon: 'circle', url: '/master/suppliergroups', approvalRoles: ['Admin', 'Super Admin'] },
      { id: 'customergroups', title: 'Customer Groups', type: 'item', icon: 'circle', url: '/master/customergroups', approvalRoles: ['Admin', 'Super Admin'] },
      { id: 'department', title: 'Department', type: 'item', icon: 'circle', url: '/master/department', approvalRoles: ['Admin', 'Super Admin'] },
      { id: 'items', title: 'Item', type: 'item', icon: 'circle', url: '/master/items', approvalRoles: ['Admin', 'Super Admin'] },
      { id: 'warehouse', title: 'Warehouse', type: 'item', icon: 'circle', url: '/master/warehouse', approvalRoles: ['Admin', 'Super Admin'] },
      { id: 'recurring', title: 'Recurring', type: 'item', icon: 'circle', url: '/master/recurring', approvalRoles: ['Admin', 'Super Admin'] },
      { id: 'taxcode', title: 'Taxcode', type: 'item', icon: 'circle', url: '/master/taxcode', approvalRoles: ['Admin', 'Super Admin'] },
      { id: 'catagory', title: 'Catagory', type: 'item', icon: 'circle', url: '/master/catagory', approvalRoles: ['Admin', 'Super Admin'] },
      { id: 'costingmethod', title: 'Costing Method', type: 'item', icon: 'circle', url: '/master/coastingmethod', approvalRoles: ['Admin', 'Super Admin'] },
      { id: 'strategy', title: 'Strategy', type: 'item', icon: 'circle', url: '/master/strategy', approvalRoles: ['Admin', 'Super Admin'] },
      { id: 'stockissue', title: 'StockIssue', type: 'item', icon: 'circle', url: '/master/stockIssue', approvalRoles: ['Admin', 'Super Admin'] },
      { id: 'bin', title: 'Bin', type: 'item', icon: 'circle', url: '/master/bin', approvalRoles: ['Admin', 'Super Admin'] },
      { id: 'driver', title: 'Driver', type: 'item', icon: 'circle', url: '/master/driver', approvalRoles: ['Admin', 'Super Admin'] },
      { id: 'vehicle', title: 'Vechicle', type: 'item', icon: 'circle', url: '/master/vehicle', approvalRoles: ['Admin', 'Super Admin'] },
      { id: 'bank', title: 'Bank', type: 'item', icon: 'circle', url: '/master/bank-list', approvalRoles: ['Admin', 'Super Admin'] }
      { id: 'approval-level', title: 'Approval Level', type: 'item', icon: 'circle', url: '/master/approval-level' },
      { id: 'countries', title: 'Countries', type: 'item', icon: 'circle', url: '/master/countries' },
      { id: 'states', title: 'States', type: 'item', icon: 'circle', url: '/master/states' },
      { id: 'cities', title: 'Cities', type: 'item', icon: 'circle', url: '/master/cities' },
      { id: 'location', title: 'Location', type: 'item', icon: 'circle', url: '/master/location' },
      { id: 'currency', title: 'Currency', type: 'item', icon: 'circle', url: '/master/currency' },
      { id: 'uom', title: 'UOM', type: 'item', icon: 'circle', url: '/master/uom' },
      { id: 'incoterms', title: 'Incoterms', type: 'item', icon: 'circle', url: '/master/incoterms' },
      { id: 'flagissue', title: 'FlagIssue', type: 'item', icon: 'circle', url: '/master/flagIssue' },
      { id: 'paymentTerms', title: 'PaymentTerms', type: 'item', icon: 'circle', url: '/master/paymentTerms' },
      { id: 'service', title: 'Services', type: 'item', icon: 'circle', url: '/master/service' },
      { id: 'customergroups', title: 'Customer Groups', type: 'item', icon: 'circle', url: '/master/customergroups' },
      { id: 'suppliergroups', title: 'Supplier Groups', type: 'item', icon: 'circle', url: '/master/suppliergroups' },
    //  { id: 'regions', title: 'Regions', type: 'item', icon: 'circle', url: '/master/regions' },
     // { id: 'deductions', title: 'Deductions', type: 'item', icon: 'circle', url: '/master/deductions' },
     // { id: 'income', title: 'Income', type: 'item', icon: 'circle', url: '/master/income' },
      { id: 'department', title: 'Department', type: 'item', icon: 'circle', url: '/master/department' },
      { id: 'items', title: 'Item', type: 'item', icon: 'circle', url: '/master/items' },
      { id: 'warehouse', title: 'Warehouse', type: 'item', icon: 'circle', url: '/master/warehouse' },
      { id: 'recurring', title: 'Recurring', type: 'item', icon: 'circle', url: '/master/recurring' },
      { id: 'taxcode', title: 'Taxcode', type: 'item', icon: 'circle', url: '/master/taxcode' },
      { id: 'catagory', title: 'Catagory', type: 'item', icon: 'circle', url: '/master/catagory' },
      { id: 'costingmethod', title: 'Costing Method ', type: 'item', icon: 'circle', url: '/master/coastingmethod' },
      { id: 'strategy', title: 'Strategy', type: 'item', icon: 'circle', url: '/master/strategy' },
      { id: 'stockissue', title: 'StockIssue', type: 'item', icon: 'circle', url: '/master/stockIssue' },
      { id: 'bin', title: 'Bin', type: 'item', icon: 'circle', url: '/master/bin' },
      { id: 'driver', title: 'Driver', type: 'item', icon: 'circle', url: '/master/driver' },
       { id: 'Vehicle', title: 'Vechicle', type: 'item', icon: 'circle', url: '/master/vehicle' },
       { id: 'bank', title: 'Bank', type: 'item', icon: 'circle', url: '/master/bank-list' },
       
    ]
  },

  // =========================
  // PURCHASE (TEAM BASED)
  // =========================
  {
    id: 'purchase',
    title: 'Purchase',
    translate: 'MENU.PURCHASE.TITLE',
    type: 'collapsible',
    icon: 'file',
    teams: ['Purchase Team'],
    children: [
      { id: 'PR', title: 'Purchase Request', translate: 'MENU.PURCHASE.PR', type: 'item', icon: 'circle', url: '/purchase/list-PurchaseRequest', teams: ['Purchase Team'] },
      { id: 'rfq', title: 'RFQ', translate: 'MENU.PURCHASE.RFQ', type: 'item', icon: 'circle', url: '/purchase/rfq', teams: ['Purchase Team'] },
      { id: 'PO', title: 'Purchase Order', translate: 'MENU.PURCHASE.PO', type: 'item', icon: 'circle', url: '/purchase/list-purchaseorder', teams: ['Purchase Team'] },
      { id: 'mobilereceiving', title: 'Mobile Receiving', translate: 'MENU.PURCHASE.MobileReceiving', type: 'item', icon: 'circle', url: '/purchase/mobilereceiving', teams: ['Purchase Team'] },
      { id: 'GRN', title: 'Goods Receipt Note', translate: 'MENU.PURCHASE.GRN', type: 'item', icon: 'circle', url: '/purchase/list-Purchasegoodreceipt', teams: ['Purchase Team'] },
      { id: 'SupplierInvoice', title: 'Supplier Invoice', translate: 'MENU.PURCHASE.SupplierInvoice', type: 'item', icon: 'circle', url: '/purchase/list-SupplierInvoice', teams: ['Purchase Team'] },
      { id: 'DebitNote', title: 'Debit Note', translate: 'MENU.PURCHASE.DebitNote', type: 'item', icon: 'circle', url: '/purchase/list-debitnote', teams: ['Purchase Team'] }
    ]
  },

  // =========================
  // INVENTORY (TEAM BASED - usually Purchase Team)
  // =========================
  {
    id: 'inventory',
    title: 'Inventory',
    translate: 'MENU.INVENTORY.TITLE',
    type: 'collapsible',
    icon: 'file',
    teams: ['Purchase Team'],
    children: [
      { id: 'ItemMaster', title: 'Item Master', translate: 'MENU.INVENTORY.ITEMMASTER', type: 'item', icon: 'circle', url: '/Inventory/List-itemmaster', teams: ['Purchase Team'] },
      { id: 'StackOverview', title: 'Stock-Overview', translate: 'MENU.INVENTORY.STACKOVERVIEW', type: 'item', icon: 'circle', url: '/Inventory/list-stackoverview', teams: ['Purchase Team'] },
      { id: 'StackTransfer', title: 'Stock-Transfer', translate: 'MENU.INVENTORY.STACKTRANSFER', type: 'item', icon: 'circle', url: '/Inventory/list-stocktransfer', teams: ['Purchase Team'] },
      { id: 'StockTake', title: 'Stock-Take', translate: 'MENU.INVENTORY.STOCKTAKE', type: 'item', icon: 'circle', url: '/Inventory/list-stocktake', teams: ['Purchase Team'] },
      { id: 'StockReorderPlanning', title: 'Stock-Reorder-Planning', translate: 'MENU.INVENTORY.STOCKREORDERPLANNING', type: 'item', icon: 'circle', url: '/Inventory/list-stockreorderplanning', teams: ['Purchase Team'] }
    ]
  },

  // =========================
  // SALES (TEAM BASED)
  // =========================
  {
    id: 'sales',
    title: 'Sales',
    translate: 'MENU.SALES.TITLE',
    type: 'collapsible',
    icon: 'shopping-cart',
    teams: ['Sales Team'],
    children: [
      { id: 'Quotation', title: 'Quotation', translate: 'MENU.SALES.QUOTATION', type: 'item', icon: 'circle', url: '/Sales/Quotation-list', teams: ['Sales Team'] },
      { id: 'SalesOrder', title: 'Sales Order', translate: 'MENU.SALES.SALESORDER', type: 'item', icon: 'circle', url: '/Sales/Sales-Order-list', teams: ['Sales Team'] },
      { id: 'Picking', title: 'Picking & Packing', translate: 'MENU.SALES.PICKING', type: 'item', icon: 'circle', url: '/Sales/Picking-packing-list', teams: ['Sales Team'] },
      { id: 'DeliveryOrder', title: 'Delivery Order', translate: 'MENU.SALES.DELIVERYORDER', type: 'item', icon: 'circle', url: '/Sales/Delivery-order-list', teams: ['Sales Team'] },
      { id: 'SalesInvoice', title: 'Sales Invoice', translate: 'MENU.SALES.SALESINVOICE', type: 'item', icon: 'circle', url: '/Sales/Sales-Invoice-list', teams: ['Sales Team'] },
      { id: 'ReturnCredit', title: 'Credit Note', translate: 'MENU.SALES.RETURNCREDIT', type: 'item', icon: 'circle', url: '/Sales/Return-credit-list', teams: ['Sales Team'] },
      { id: 'Collections', title: 'Collections', translate: 'MENU.SALES.COLLECTIONS', type: 'item', icon: 'circle', url: '/Sales/Create-collections', teams: ['Sales Team'] },
      { id: 'Report', title: 'Report', translate: 'MENU.SALES.REPORTS', type: 'item', icon: 'circle', url: '/Sales/Reports-create', teams: ['Sales Team'] },
      { id: 'Shared', title: 'Shared', translate: 'MENU.SALES.SHARED', type: 'item', icon: 'circle', url: '/Sales/Shared-create', teams: ['Sales Team'] }
      // { id: 'CustomerMaster', title: 'Customer Master', translate: 'MENU.SALES.CUSTOMERMASTER', type: 'item', icon: 'circle', url: '/Sales/Create-customer-master' },
      { id: 'Quotation', title: 'Quotation', translate: 'MENU.SALES.QUOTATION', type: 'item', icon: 'circle', url: '/Sales/Quotation-list' },
      { id: 'SalesOrder', title: 'Sales Order', translate: 'MENU.SALES.SALESORDER', type: 'item', icon: 'circle', url: '/Sales/Sales-Order-list' },
      { id: 'Picking', title: 'Picking & Packing', translate: 'MENU.SALES.PICKING', type: 'item', icon: 'circle', url: '/Sales/Picking-packing-list' },
      { id: 'DeliveryOrder', title: 'Delivery Order', translate: 'MENU.SALES.DELIVERYORDER', type: 'item', icon: 'circle', url: '/Sales/Delivery-order-list' },
      { id: 'SalesInvoice', title: 'Sales Invoice', translate: 'MENU.SALES.SALESINVOICE', type: 'item', icon: 'circle', url: '/Sales/Sales-Invoice-list' },
      { id: 'ReturnCredit', title: 'Credit Note', translate: 'MENU.SALES.RETURNCREDIT', type: 'item', icon: 'circle', url: '/Sales/Return-credit-list' },
      // { id: 'Collections', title: 'Collections', translate: 'MENU.SALES.COLLECTIONS', type: 'item', icon: 'circle', url: '/Sales/Create-collections' },
      { id: 'Report', title: 'Report', translate: 'MENU.SALES.REPORTS', type: 'item', icon: 'circle', url: '/Sales/Reports-create' },
      // { id: 'Shared', title: 'Shared', translate: 'MENU.SALES.SHARED', type: 'item', icon: 'circle', url: '/Sales/Shared-create' }
    ]
  },

  // =========================
  // FINANCIAL (TEAM BASED)
  // =========================
  {
    id: 'financial',
    title: 'Financial',
    translate: 'MENU.FINANCIAL.TITLE',
    type: 'collapsible',
    icon: 'dollar-sign',
    teams: ['Finance Team'],
    children: [
      { id: 'ledger', title: 'General Ledger', translate: 'MENU.FINANCIAL.LEDGER', type: 'item', icon: 'circle', url: '/financial/ledger', teams: ['Finance Team'] },
      { id: 'ChartofAccount', title: 'Chart of Account', translate: 'MENU.FINANCIAL.CHARTOFACCOUNT', type: 'item', icon: 'circle', url: '/financial/ChartOfAccount', teams: ['Finance Team'] },
      { id: 'journal', title: 'Journal', translate: 'MENU.FINANCIAL.JOURNAL', type: 'item', icon: 'circle', url: '/financial/journal', teams: ['Finance Team'] },
      { id: 'AR', title: 'Accounts Receivable', translate: 'MENU.FINANCIAL.ACCCOUNTSRECEIVABLE', type: 'item', icon: 'circle', url: '/financial/AR', teams: ['Finance Team'] },
      { id: 'AccountPayable', title: 'Accounts Payable', translate: 'MENU.FINANCIAL.ACCOUNTPAYABLE', type: 'item', icon: 'circle', url: '/financial/AccountPayable', teams: ['Finance Team'] },
      { id: 'tax-gst', title: 'Tax & Gst', translate: 'MENU.FINANCIAL.TAX', type: 'item', icon: 'circle', url: '/financial/tax-gst', teams: ['Finance Team'] },
      { id: 'Period-close', title: 'Period-close', translate: 'MENU.FINANCIAL.PERIODCLOSE', type: 'item', icon: 'circle', url: '/financial/Period-close', teams: ['Finance Team'] },
      { id: 'invoice-email', title: 'Invoice Email', translate: 'MENU.FINANCIAL.INVOICEEMAIL', type: 'item', icon: 'circle', url: '/financial/Invoice-email', teams: ['Finance Team'] },
      { id: 'report', title: 'Trail Balance', translate: 'MENU.FINANCIAL.Report', type: 'item', icon: 'circle', url: '/financial/report', teams: ['Finance Team'] },
      { id: 'finance-report', title: 'Reports', translate: 'MENU.FINANCIAL.FinanceReport', type: 'item', icon: 'circle', url: '/financial/finance-report', teams: ['Finance Team'] }
      { id: 'ledger', title: 'General Ledger', translate: 'MENU.FINANCIAL.LEDGER', type: 'item', icon: 'circle', url: '/financial/ledger' },
      { id: 'ChartofAccount', title: 'Chart of Account', translate: 'MENU.FINANCIAL.CHARTOFACCOUNT', type: 'item', icon: 'circle', url: '/financial/ChartOfAccount' },
      { id: 'journal', title: 'Journal', translate: 'MENU.FINANCIAL.JOURNAL', type: 'item', icon: 'circle', url: '/financial/journal' },
       { id: 'AR', title: 'Accounts Receivable', translate: 'MENU.FINANCIAL.ACCCOUNTSRECEIVABLE', type: 'item', icon: 'circle', url: '/financial/AR' },
      { id: 'AccountPayable', title: 'Accounts Payable', translate: 'MENU.FINANCIAL.ACCOUNTPAYABLE', type: 'item', icon: 'circle', url: '/financial/AccountPayable' },
      { id: 'tax-gst', title: 'Tax & Gst', translate: 'MENU.FINANCIAL.TAX', type: 'item', icon: 'circle', url: '/financial/tax-gst' },
      { id: 'Period-close', title: 'Period-close', translate: 'MENU.FINANCIAL.PERIODCLOSE', type: 'item', icon: 'circle', url: '/financial/Period-close' },
      // { id: 'invoice-email', title: 'Invoice Email', translate: 'MENU.FINANCIAL.INVOICEEMAIL', type: 'item', icon: 'circle', url: '/financial/Invoice-email' },
      { id: 'report', title: 'Trail Balance', translate: 'MENU.FINANCIAL.Report', type: 'item', icon: 'circle', url: '/financial/report' },
      { id: 'finance-report', title: 'Reports', translate: 'MENU.FINANCIAL.FinanceReport', type: 'item', icon: 'circle', url: '/financial/finance-report' },
            // { id: 'opening-balance', title: 'Opening-Balance', translate: 'MENU.FINANCIAL.OpeningBalance', type: 'item', icon: 'circle', url: '/financial/opening-balance' },

    ]
  },

  // =========================
  // BUSINESS PARTNERS (ADMIN ONLY)
  // =========================
  {
    id: 'businesspartners',
    title: 'Business Partners',
    translate: 'MENU.BUSINESSPARTNERS.TITLE',
    type: 'collapsible',
    icon: 'user',
    approvalRoles: ['Admin', 'Super Admin'],
    children: [
      { id: 'supplier', title: 'Supplier', translate: 'MENU.BUSINESSPARTNERS.SUPPLIER', type: 'item', icon: 'circle', url: '/Businesspartners/supplier', approvalRoles: ['Admin', 'Super Admin'] },
      { id: 'customermaster', title: 'Customer', translate: 'MENU.BUSINESSPARTNERS.CUSTOMER', type: 'item', icon: 'circle', url: '/Businesspartners/customermaster', approvalRoles: ['Admin', 'Super Admin'] },
       { id: 'customermaster', title: 'Customer', translate: 'MENU.BUSINESSPARTNERS.CUSTOMER', type: 'item', icon: 'circle', url: '/Businesspartners/customermaster' },
      { id: 'supplier', title: 'Supplier', translate: 'MENU.BUSINESSPARTNERS.SUPPLIER', type: 'item', icon: 'circle', url: '/Businesspartners/supplier' },
       { id: 'users', title: 'Users', translate: 'MENU.BUSINESSPARTNERS.USER', type: 'item', icon: 'circle', url: '/admin/users' },


      // ONLY SUPER ADMIN
      { id: 'users', title: 'Users', translate: 'MENU.BUSINESSPARTNERS.USER', type: 'item', icon: 'circle', url: '/admin/users', approvalRoles: ['Super Admin'] }
    ]
  }
];
