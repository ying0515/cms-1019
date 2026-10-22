/** Response model — GET /api/partners, GET /api/partners/{pkid} */
export interface Partner {
  pkid: number;
  name: string;
  appKey: string;
  nameOnPartnerMenu: string;
  nameOnCourseDetailPage: string;
  displayOrder: number;
  imageFilename: string | null;
}

/** Write DTO — POST / PUT /api/partners (pkid is IDENTITY: ignored on create) */
export interface PartnerRequest {
  pkid: number;
  name: string;
  appKey: string;
  nameOnPartnerMenu: string;
  nameOnCourseDetailPage: string;
  displayOrder: number;
  imageFilename: string | null;
}

/** Search DTO — POST /api/partners/query */
export interface PartnerQuery {
  keyword?: string | null;
}
