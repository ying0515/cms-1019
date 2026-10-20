/** One change in a record's history (GET /api/rowaudit). `dateTime` is UTC without a zone suffix. */
export interface RowAuditEntry {
  dateTime: string;
  userName: string;
  /** 'Insert' | 'Update' | 'Delete' */
  actionType: string;
  /** Insert / Delete: the record's name; Update: comma-separated changed property names. */
  actionDesc: string | null;
}
