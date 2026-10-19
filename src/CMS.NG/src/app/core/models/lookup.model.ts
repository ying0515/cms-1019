export interface AppUserLookup {
  userId: string;
  userName: string;
  isActive: boolean;
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

/** Mapped option for p-select / p-multiselect */
export interface LookupOption<T = number | string> {
  pkid: T;
  label: string;
}
