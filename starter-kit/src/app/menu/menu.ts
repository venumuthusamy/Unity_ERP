import { CoreMenu } from '@core/types'

export const menu: CoreMenu[] = [
  {
    id: 'home',
    title: 'Home',
    translate: 'MENU.HOME',
    type: 'item',
    icon: 'home',
    url: 'home'
  },
  {
    id: 'sample',
    title: 'Sample',
    translate: 'MENU.SAMPLE',
    type: 'collapsible', 
    icon: 'file',
    children: [
      {
        id: 'sample-sub1',
        title: 'Sub Item 1',
        translate: 'MENU.SAMPLE_SUB1',
        type: 'item',
        icon: 'circle',
        url: 'sample/sub1'
      },
      {
        id: 'sample-sub2',
        title: 'Sub Item 2',
        translate: 'MENU.SAMPLE_SUB2',
        type: 'item',
        icon: 'circle',
        url: 'sample/sub2'
      }
    ]
  }
];

