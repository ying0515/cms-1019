export interface AppUserLookup {
  userId: string;
  userName: string;
  isActive: boolean;
}

export interface AppRoleLookup {
  roleId: string;
  roleName: string;
}

export interface PublishStatusLookup {
  pkid: number;
  description: string;
}

export interface PartnerLookup {
  pkid: number;
  name: string;
}

export interface CourseGroupLookup {
  pkid: number;
  description: string;
}

export interface CertificationLookup {
  pkid: number;
  title: string | null;
  partnerPkid: number;
  partnerName: string;
}

export interface JobCategoryLookup {
  pkid: number;
  description: string;
}

/** Mapped option for p-select / p-multiselect */
export interface LookupOption<T = number | string> {
  pkid: T;
  label: string;
}

export interface TrainingCenterLookup {
  pkid: number;
  name: string;
}

/** Promotion2 slim row; topic / description prefill a FeaturedPromoItem. */
export interface PromotionLookup {
  pkid: number;
  promoCode: string;
  topic: string;
  description: string;
}
