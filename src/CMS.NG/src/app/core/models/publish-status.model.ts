/** Response model — GET /api/publish-statuses, GET /api/publish-statuses/{pkid} */
export interface PublishStatus {
  pkid: number;
  description: string;
  isDraft: boolean;
  isPublished: boolean;
  isDiscontinued: boolean;
}

/** Write DTO — POST / PUT /api/publish-statuses (pkid is user-supplied, tinyint 0–255) */
export interface PublishStatusRequest {
  pkid: number;
  description: string;
  isDraft: boolean;
  isPublished: boolean;
  isDiscontinued: boolean;
}

/** Search DTO — POST /api/publish-statuses/query */
export interface PublishStatusQuery {
  keyword?: string | null;
  isDraft?: boolean | null;
  isPublished?: boolean | null;
  isDiscontinued?: boolean | null;
}
