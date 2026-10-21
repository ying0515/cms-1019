import { Course } from '@core/models/course.model';

/**
 * Long text fields of a course, in display order, with their labels.
 * A new field must also be classified in HANDOUT_CONTENT_KEYS or HANDOUT_EXCLUDED_KEYS:
 * the handout is printed for students and only shows whitelisted fields.
 */
export const CONTENT_FIELDS = [
  { key: 'material', label: '教材' },
  { key: 'objective', label: '課程目標' },
  { key: 'target', label: '適合對象' },
  { key: 'prerequisites', label: '先備知識' },
  { key: 'outline', label: '課程大綱' },
  { key: 'towardCertOrExam', label: '考試／認證說明' },
  { key: 'note', label: '備註' },
  { key: 'otherInfo', label: '其他資訊' },
] as const satisfies readonly { key: keyof Course; label: string }[];

export type ContentKey = (typeof CONTENT_FIELDS)[number]['key'];

/**
 * Content fields printed on the student handout, in reading order. Kept as an explicit whitelist
 * so a field added to CONTENT_FIELDS for back-office viewers never ends up on paper.
 */
export const HANDOUT_CONTENT_KEYS: readonly ContentKey[] = [
  'objective',
  'target',
  'prerequisites',
  'outline',
  'towardCertOrExam',
  'material',
  'note',
  'otherInfo',
];

/** Content fields deliberately left off the handout. */
export const HANDOUT_EXCLUDED_KEYS: readonly ContentKey[] = [];
