/** Report row — POST /api/agent-token-usage/report (usage added up by user × date × project × model) */
export interface AgentTokenUsageReportRow {
  userId: string;
  userName: string;
  /** 'yyyy-MM-dd' (Taipei date) */
  usageDate: string;
  project: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  /** USD; null when no usage row in the group is priced */
  cost: number | null;
  unpricedCount: number;
  sessionCount: number;
}

/** Search DTO — POST /api/agent-token-usage/report (dates inclusive, 'yyyy-MM-dd') */
export interface AgentTokenUsageReportQuery {
  usageDateFrom?: string | null;
  usageDateTo?: string | null;
}
