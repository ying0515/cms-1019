-- Lab 04 preparation: shift FeaturedPromoItem.ScheduleOn into the current window
-- so the weekly (Mon–Sun) ScheduleOn filter has rows to show once the feature is built.
--
-- The newest existing ScheduleOn is moved to ~30 days from today; every other row is
-- shifted by the same delta, preserving the relative spacing between promo items.

DECLARE @diff INT

SELECT TOP 1
@diff=DATEDIFF(d,ScheduleOn, DATEADD(d, 30,GETDATE()))
FROM FeaturedPromoItem ORDER BY scheduleON DESC


PRINT '@diff='+CAST(@diff AS VARCHAR(10))

SELECT ScheduleOn,
newSchedule = DATEADD(d, @diff, ScheduleOn)
FROM FeaturedPromoItem ORDER BY scheduleON DESC

UPDATE FeaturedPromoItem
SET ScheduleOn=  DATEADD(d, @diff, ScheduleOn)
