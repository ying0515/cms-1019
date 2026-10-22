import { FeaturedPromoItem } from '@core/models/featured-promo-item.model';
import { PromotionLookup, TrainingCenterLookup } from '@core/models/lookup.model';

export const TRAINING_CENTERS: TrainingCenterLookup[] = [
  { pkid: 1, name: '台北' },
  { pkid: 2, name: '新竹' },
  { pkid: 54, name: '線上研討會' },
];

export const PROMOTIONS: PromotionLookup[] = [
  {
    pkid: 3403,
    promoCode: '20251204_SkillTrainAI',
    topic: '成為能AI協作的程式設計師',
    description: '轉職就業養成班，三大主流語言任你選',
  },
  {
    pkid: 3404,
    promoCode: '251211_GoogleAI',
    topic: 'Google AI工具一次掌握',
    description: '不需技術基礎！最新Google AI實戰課程',
  },
];

/** Week under test: Mon 2026-03-16 … Sun 2026-03-22 (台北). */
export const WEEK_OF = '2026-03-16';

/** Mon 3/16 slot 1 */
export const MON_SLOT1: FeaturedPromoItem = {
  pkid: 101,
  scheduleOn: '2026-03-16',
  trainingCenterPkid: 1,
  slot: 1,
  promotionPkid: 3403,
  topic: '成為能AI協作的程式設計師',
  description: '轉職就業養成班',
  trainingCenter: TRAINING_CENTERS[0],
  promotion: PROMOTIONS[0],
};

/** Mon 3/16 slot 2 */
export const MON_SLOT2: FeaturedPromoItem = {
  pkid: 102,
  scheduleOn: '2026-03-16',
  trainingCenterPkid: 1,
  slot: 2,
  promotionPkid: 3404,
  topic: 'Google AI工具一次掌握',
  description: '不需技術基礎',
  trainingCenter: TRAINING_CENTERS[0],
  promotion: PROMOTIONS[1],
};

/** Sun 3/22 slot 3 */
export const SUN_SLOT3: FeaturedPromoItem = {
  pkid: 103,
  scheduleOn: '2026-03-22',
  trainingCenterPkid: 1,
  slot: 3,
  promotionPkid: 3404,
  topic: '週日主題',
  description: '週日說明',
  trainingCenter: TRAINING_CENTERS[0],
  promotion: PROMOTIONS[1],
};
