import { PublishStatus } from '@core/models/publish-status.model';

export const DRAFT_STATUS: PublishStatus = {
  pkid: 1,
  description: '草稿',
  isDraft: true,
  isPublished: false,
  isDiscontinued: false,
};

export const PUBLISHED_STATUS: PublishStatus = {
  pkid: 2,
  description: '已發布',
  isDraft: false,
  isPublished: true,
  isDiscontinued: false,
};
