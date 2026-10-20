USE [CMS]
GO
-- Starting ModelPrice rows (USD per 1M tokens), from the claude-api skill pricing reference (cached 2026-10-06).
-- CacheWritePrice = 1-hour cache-write rate (2x input). CacheReadPrice = cache-hit rate.
-- Haiku 5.5: prices for prompts <= 100K tokens; cache read assumes the standard 0.1x input rate.
-- Re-runnable: inserts only missing (Model, EffectiveFrom) rows.
INSERT INTO [dbo].[ModelPrice] ([Model], [EffectiveFrom], [InputPrice], [OutputPrice], [CacheWritePrice], [CacheReadPrice])
SELECT v.Model, v.EffectiveFrom, v.InputPrice, v.OutputPrice, v.CacheWritePrice, v.CacheReadPrice
FROM (VALUES
	(N'claude-opus-5-5',   CAST('2026-01-01' AS date), 4.00, 20.00, 8.00, 0.20),
	(N'claude-sonnet-5-5', CAST('2026-01-01' AS date), 2.00, 10.00, 4.00, 0.20),
	(N'claude-haiku-5-5',  CAST('2026-01-01' AS date), 0.10,  0.50, 0.20, 0.01)
) AS v (Model, EffectiveFrom, InputPrice, OutputPrice, CacheWritePrice, CacheReadPrice)
WHERE NOT EXISTS (SELECT 1 FROM [dbo].[ModelPrice] mp WHERE mp.Model = v.Model AND mp.EffectiveFrom = v.EffectiveFrom)
GO
