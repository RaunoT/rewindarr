import { RewindStory } from '@/types/rewind'
import { formatMonthYear } from '@/utils/formatting'
import { getServerName } from '@/utils/mediaServerName'
import { BackwardIcon } from '@heroicons/react/24/outline'
import { useLocale, useTranslations } from 'next-intl'
import { getAverageMessage } from '../averageMessage'
import RewindCat from '../RewindCat'
import RewindStat from '../RewindStat'

export default function StoryYearOverYear({
  userRewind,
  settings,
}: RewindStory) {
  const t = useTranslations('Rewind.YearOverYear')
  const locale = useLocale()
  const { yearOverYear } = userRewind

  if (!yearOverYear) {
    return null
  }

  const startValue = formatMonthYear(yearOverYear.since, locale)
  const endValue = formatMonthYear(yearOverYear.until, locale)
  // As in the welcome, a period from a start date is named by its months
  const beforeKey = yearOverYear.isYear
    ? yearOverYear.isSoFar
      ? 'yearBeforeSoFar'
      : 'yearBefore'
    : startValue === endValue
      ? 'monthBefore'
      : 'rangeBefore'
  const changeMessage = getAverageMessage(yearOverYear.difference)

  return (
    <>
      <RewindStat>
        <p>
          {t.rich(beforeKey, {
            startValue,
            endValue,
            durationValue: yearOverYear.duration,
            serverName: getServerName(settings),
            before: (chunks) => (
              <RewindCat icon={<BackwardIcon />}>{chunks}</RewindCat>
            ),
            duration: (chunks) => <span className='rewind-stat'>{chunks}</span>,
          })}
        </p>
      </RewindStat>

      <RewindStat step={1}>
        <p>
          {t.rich(changeMessage.key, {
            ...changeMessage.values,
            difference: (chunks) => (
              <RewindCat icon={<changeMessage.Icon />}>{chunks}</RewindCat>
            ),
          })}
        </p>
      </RewindStat>
    </>
  )
}
