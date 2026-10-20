/** Response model — GET /api/model-prices, GET /api/model-prices/{pkid}. Prices are USD per 1M tokens. */
export interface ModelPrice {
  pkid: number;
  model: string;
  /** 'yyyy-MM-dd' */
  effectiveFrom: string;
  inputPrice: number;
  outputPrice: number;
  cacheWritePrice: number;
  cacheReadPrice: number;
}

/** Write DTO — POST / PUT /api/model-prices (pkid is IDENTITY: ignored on create) */
export interface ModelPriceRequest {
  pkid: number;
  model: string;
  /** 'yyyy-MM-dd' */
  effectiveFrom: string;
  inputPrice: number;
  outputPrice: number;
  cacheWritePrice: number;
  cacheReadPrice: number;
}

/** Search DTO — POST /api/model-prices/query (dates inclusive, 'yyyy-MM-dd') */
export interface ModelPriceQuery {
  keyword?: string | null;
  effectiveFromFrom?: string | null;
  effectiveFromTo?: string | null;
}
