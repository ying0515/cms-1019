import {
  CertificationLookup,
  CourseGroupLookup,
  JobCategoryLookup,
  PartnerLookup,
  PublishStatusLookup,
} from './lookup.model';

/** Response model — GET /api/courses, GET /api/courses/{pkid} */
export interface Course {
  pkid: number;
  title: string;
  officialTitle: string | null;
  courseId: string;
  prodCourseId: string;
  friendlyUrl: string;
  displayOrder: number;
  partnerPkid: number;
  courseGroupPkid: number | null;
  publishStatusPkid: number;
  /** 'yyyy-MM-dd' */
  scheduleOn: string;
  /** 'yyyy-MM-dd' */
  scheduleOff: string;
  hour: number;
  listPrice: number;
  learningCredit: number;
  material: string | null;
  objective: string | null;
  target: string | null;
  prerequisites: string | null;
  outline: string | null;
  towardCertOrExam: string | null;
  note: string | null;
  otherInfo: string | null;
  canRepeat: boolean;
  // FK nav objects (JOIN)
  partner: PartnerLookup | null;
  courseGroup: CourseGroupLookup | null;
  publishStatus: PublishStatusLookup | null;
  // n-n, populated on GET by pkid (empty in lists)
  certifications: CertificationLookup[];
  jobCategories: JobCategoryLookup[];
}

/** Write DTO — POST / PUT /api/courses (pkid is IDENTITY: ignored on create) */
export interface CourseRequest {
  pkid: number;
  title: string;
  officialTitle: string | null;
  courseId: string;
  prodCourseId: string;
  friendlyUrl: string;
  displayOrder: number;
  partnerPkid: number;
  courseGroupPkid: number | null;
  publishStatusPkid: number;
  scheduleOn: string;
  scheduleOff: string;
  hour: number;
  listPrice: number;
  learningCredit: number;
  material: string | null;
  objective: string | null;
  target: string | null;
  prerequisites: string | null;
  outline: string | null;
  towardCertOrExam: string | null;
  note: string | null;
  otherInfo: string | null;
  canRepeat: boolean;
  certificationPkids: number[];
  jobCategoryPkids: number[];
}

/** Search DTO — POST /api/courses/query (dates 'yyyy-MM-dd', inclusive) */
export interface CourseQuery {
  keyword?: string | null;
  partnerPkid?: number | null;
  courseGroupPkid?: number | null;
  publishStatusPkid?: number | null;
  scheduleOnFrom?: string | null;
  scheduleOnTo?: string | null;
  scheduleOffFrom?: string | null;
  scheduleOffTo?: string | null;
  canRepeat?: boolean | null;
}
