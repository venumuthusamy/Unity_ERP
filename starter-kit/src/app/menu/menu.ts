import { CoreMenu } from '@core/types'

export const menu: CoreMenu[] = [
  {
    id: 'home',
    title: 'Dashboard',
    translate: 'MENU.HOME',
    type: 'item',
    icon: 'home',
    url: 'home'
  },
 
     {
    id: 'master',
    title: 'Master',
    type: 'collapsible',
    icon: 'settings',
    children: [
    {
  id: 'approval-level',
  title: 'Approval Level',
  type: 'item',
  icon: 'circle',
  url: '/master/approval-level'   // ✅ must start with /master
},

      {
        id: 'cities',
        title: 'Cities',
        type: 'item',
        icon: 'circle',
        url: '/master/cities' 
      },
       {
        id: 'countries',
        title: 'Countries',
        type: 'item',
        icon: 'circle',
        url: '/master/countries'
      },
       {
        id: 'uom',
        title: 'UOM',
        type: 'item',
        icon: 'circle',
        url: '/master/uom' 
      },
       {
        id: 'incoterms',
        title: 'Incoterms',
        type: 'item',
        icon: 'circle',
        url: '/master/incoterms' 
      },
       {
        id: 'flagissue',
        title: 'FlagIssue',
        type: 'item',
        icon: 'circle',
        url: '/master/flagIssue' 
      },
    ]
    
  },
  {
    id: 'purchase',
    title: 'Purchase',
    translate: 'MENU.PURCHASE',
    type: 'collapsible',
    icon: 'file',
    children: [
      {
        id: 'PR',
        title: 'PR',
        translate: 'MENU.PURCHASE.PR',
        type: 'item',
        icon: 'circle',
        url: 'purchase/list-PurchaseRequest'
      }
   
    ]
  }
];

