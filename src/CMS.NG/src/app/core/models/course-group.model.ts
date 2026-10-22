/** Response model — GET /api/course-groups, GET /api/course-groups/{pkid} */
export interface CourseGroup {
  pkid: number;
  description: string;
}

/** Write DTO — POST / PUT /api/course-groups (pkid is IDENTITY: ignored on create) */
export interface CourseGroupRequest {
  pkid: number;
  description: string;
}

/** Search DTO — POST /api/course-groups/query */
export interface CourseGroupQuery {
  keyword?: string | null;
}
