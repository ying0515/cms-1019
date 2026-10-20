import { ModelPrice } from '@core/models/model-price.model';

export const OPUS: ModelPrice = {
  pkid: 1,
  model: 'claude-opus-5-5',
  effectiveFrom: '2026-01-01',
  inputPrice: 4,
  outputPrice: 20,
  cacheWritePrice: 8,
  cacheReadPrice: 0.2,
};

export const HAIKU: ModelPrice = {
  pkid: 3,
  model: 'claude-haiku-5-5',
  effectiveFrom: '2026-01-01',
  inputPrice: 0.1,
  outputPrice: 0.5,
  cacheWritePrice: 0.2,
  cacheReadPrice: 0.01,
};
