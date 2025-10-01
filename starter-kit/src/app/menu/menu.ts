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
       { id: 'warehouse', title: 'Warehouse', type: 'item', icon: 'circle', url: '/master/warehouse'
      },
    ]
  },

  {
    id: 'purchase',
    title: 'Purchase',
    translate: 'MENU.PURCHASE.TITLE',
    type: 'collapsible',
    icon: 'file',
    children: [
      { id: 'PR', title: 'PR', translate: 'MENU.PURCHASE.PR', type: 'item', icon: 'circle', url: '/purchase/list-PurchaseRequest' }
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
  }
];
