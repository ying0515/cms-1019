import { Partner } from '@core/models/partner.model';

export const MICROSOFT: Partner = {
  pkid: 1,
  name: 'Microsoft',
  appKey: 'MS',
  nameOnPartnerMenu: '微軟 Microsoft',
  nameOnCourseDetailPage: '微軟',
  displayOrder: 1,
  imageFilename: 'ms.png',
};

export const CISCO: Partner = {
  pkid: 2,
  name: 'Cisco',
  appKey: 'CISCO',
  nameOnPartnerMenu: '思科 Cisco',
  nameOnCourseDetailPage: '思科',
  displayOrder: 2,
  imageFilename: null,
};
