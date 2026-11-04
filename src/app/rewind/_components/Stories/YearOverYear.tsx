import { RewindStory } from '@/types/rewind'
import { formatMonthYear } from '@/utils/formatting'
import { getMediaServerName } from '@/utils/mediaServerName'
import { BackwardIcon } from '@heroicons/react/24/outline'
import { useLocale, useTranslations } from 'next-intl'
import { getAverageMessage } from '../averageMessage'
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
  const beforeKey = yearOverYear.isPastYear
    ? 'yearBefore'
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
            serverName:
              settings.general.serverName ||
              getMediaServerName(settings.connection.mediaServerType),
            before: (chunks) => (
              <span className='rewind-cat'>
                {chunks}
                <BackwardIcon />
              </span>
            ),
            duration: (chunks) => <span className='rewind-stat'>{chunks}</span>,
            plex: (chunks) => chunks,
          })}
        </p>
      </RewindStat>

      <RewindStat step={1}>
        <p>
          {t.rich(changeMessage.key, {
            ...changeMessage.values,
            difference: (chunks) => (
              <span className='rewind-cat'>
                {chunks} <changeMessage.Icon />
              </span>
            ),
          })}
        </p>
      </RewindStat>
    </>
  )
}
