import { PromotionLookup, TrainingCenterLookup } from './lookup.model';

/** Slots per day and training center (UNIQUE ScheduleOn + TrainingCenter_pkid + Slot). */
export const MAX_SLOT = 3;

/** Response model — GET /api/featured-promo-items, GET /api/featured-promo-items/{pkid} */
export interface FeaturedPromoItem {
  pkid: number;
  /** 'yyyy-MM-dd' */
  scheduleOn: string;
  trainingCenterPkid: number;
  slot: number;
  promotionPkid: number;
  topic: string;
  description: string;
  // FK nav objects (JOIN)
  trainingCenter: TrainingCenterLookup | null;
  promotion: PromotionLookup | null;
}

/** Write DTO — POST / PUT /api/featured-promo-items (pkid is IDENTITY: ignored on create) */
export interface FeaturedPromoItemRequest {
  pkid: number;
  scheduleOn: string;
  trainingCenterPkid: number;
  slot: number;
  promotionPkid: number;
  topic: string;
  description: string;
}

/** Search DTO — POST /api/featured-promo-items/query */
export interface FeaturedPromoItemQuery {
  trainingCenterPkid?: number | null;
  /** Any day 'yyyy-MM-dd'; the API filters ScheduleOn to that week's Monday–Sunday. */
  weekOf?: string | null;
}
