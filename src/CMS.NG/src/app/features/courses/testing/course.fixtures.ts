import { Course } from '@core/models/course.model';
import {
  CertificationLookup,
  CourseGroupLookup,
  JobCategoryLookup,
  PartnerLookup,
  PublishStatusLookup,
} from '@core/models/lookup.model';

export const PARTNERS: PartnerLookup[] = [
  { pkid: 1, name: 'Microsoft' },
  { pkid: 2, name: 'Cisco' },
];

export const COURSE_GROUPS: CourseGroupLookup[] = [
  { pkid: 1, description: '雲端運算' },
  { pkid: 3, description: '網路' },
];

export const PUBLISH_STATUSES: PublishStatusLookup[] = [
  { pkid: 1, description: '草稿' },
  { pkid: 2, description: '已發布' },
];

export const CERTIFICATIONS: CertificationLookup[] = [
  { pkid: 1, title: 'Azure Administrator Associate', partnerPkid: 1, partnerName: 'Microsoft' },
  { pkid: 3, title: 'CCNA', partnerPkid: 2, partnerName: 'Cisco' },
];

export const JOB_CATEGORIES: JobCategoryLookup[] = [
  { pkid: 1, description: '系統管理' },
  { pkid: 3, description: '網路工程' },
];

export const AZ104: Course = {
  pkid: 1,
  title: 'Microsoft Azure 管理員',
  officialTitle: 'Microsoft Azure Administrator',
  courseId: 'AZ-104',
  prodCourseId: 'AZ-104T00',
  friendlyUrl: 'az-104',
  displayOrder: 1,
  partnerPkid: 1,
  courseGroupPkid: 1,
  publishStatusPkid: 2,
  scheduleOn: '2026-01-01',
  scheduleOff: '2036-01-01',
  hour: 32,
  listPrice: 28000,
  learningCredit: 4,
  material: null,
  objective: '管理 Azure 訂用帳戶',
  target: null,
  prerequisites: null,
  outline: null,
  towardCertOrExam: null,
  note: null,
  otherInfo: null,
  canRepeat: true,
  partner: PARTNERS[0],
  courseGroup: COURSE_GROUPS[0],
  publishStatus: PUBLISH_STATUSES[1],
  certifications: [CERTIFICATIONS[0]],
  jobCategories: [JOB_CATEGORIES[0]],
};

export const CCNA: Course = {
  pkid: 2,
  title: 'Cisco CCNA 網路認證',
  officialTitle: null,
  courseId: 'CCNA',
  prodCourseId: '200-301',
  friendlyUrl: 'ccna',
  displayOrder: 2,
  partnerPkid: 2,
  courseGroupPkid: null,
  publishStatusPkid: 1,
  scheduleOn: '2026-03-01',
  scheduleOff: '2027-03-01',
  hour: 40,
  listPrice: 35000,
  learningCredit: 5.5,
  material: null,
  objective: null,
  target: null,
  prerequisites: null,
  outline: '第一章\n第二章',
  towardCertOrExam: null,
  note: null,
  otherInfo: null,
  canRepeat: false,
  partner: PARTNERS[1],
  courseGroup: null,
  publishStatus: PUBLISH_STATUSES[0],
  certifications: [],
  jobCategories: [],
};
