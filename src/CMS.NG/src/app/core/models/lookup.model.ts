export interface AppUserLookup {
  userId: string;
  userName: string;
  isActive: boolean;
}

/** Mapped option for p-select / p-multiselect */
export interface LookupOption<T = number | string> {
  pkid: T;
  label: string;
}
