import { RewindStory } from '@/types/rewind'
import { formatMonthYear, secondsToTime } from '@/utils/formatting'
import { ChartBarIcon } from '@heroicons/react/24/outline'
import { useLocale, useTranslations } from 'next-intl'
import { useMemo } from 'react'
import RewindBarChart from '../RewindBarChart'
import RewindStat from '../RewindStat'

const HOUR = 60 * 60
// Phones have room for the months' short names up to 6 months, and wider
// screens up to 13, a year with the partial months at its ends. Otherwise each
// gets a letter, and past 24 months only each January is labelled, with its
// year.
const SHORT_LABEL_MONTHS = 6
const WIDE_SHORT_LABEL_MONTHS = 13
const NARROW_LABEL_MONTHS = 24

// YYYY-MM months, which are calendar months, so they're read in UTC
function getLabels(
  months: string[],
  locale: string,
  shortLabelMonths: number,
): (string | null)[] {
  if (months.length > NARROW_LABEL_MONTHS) {
    const formatter = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      timeZone: 'UTC',
    })

    return months.map((month) =>
      month.endsWith('-01')
        ? formatter.format(Date.parse(`${month}-01`))
        : null,
    )
  }

  const formatter = new Intl.DateTimeFormat(locale, {
    month: months.length > shortLabelMonths ? 'narrow' : 'short',
    timeZone: 'UTC',
  })

  return months.map((month) => formatter.format(Date.parse(`${month}-01`)))
}

export default function StoryMonths({ userRewind }: RewindStory) {
  const t = useTranslations('Rewind.Moments')
  const tRoot = useTranslations()
  const locale = useLocale()
  const { monthly } = userRewind.moments
  const labels = useMemo(() => {
    const months = monthly?.months.map(({ month }) => month) ?? []

    return {
      phone: getLabels(months, locale, SHORT_LABEL_MONTHS),
      wide: getLabels(months, locale, WIDE_SHORT_LABEL_MONTHS),
    }
  }, [monthly, locale])

  if (!monthly) {
    return null
  }

  const peak = monthly.months[monthly.peakIndex]
  const peakMonth = formatMonthYear(`${peak.month}-01`, locale, 'long')
  const peakDuration = secondsToTime(peak.duration, tRoot)

  return (
    <>
      <RewindStat>
        <p>
          {t.rich('month', {
            monthValue: peakMonth,
            durationValue: peakDuration,
            month: (chunks) => (
              <span className='rewind-cat'>
                {chunks}
                <ChartBarIcon />
              </span>
            ),
            duration: (chunks) => <span className='rewind-stat'>{chunks}</span>,
          })}
        </p>
      </RewindStat>

      <RewindStat step={1} noScale className='pt-4'>
        <RewindBarChart
          data={monthly.months.map(({ duration }) => duration / HOUR)}
          labels={labels.phone}
          wideLabels={labels.wide}
          peakIndex={monthly.peakIndex}
          axisLabel={t('hours')}
          ariaLabel={t('monthChart', {
            monthValue: peakMonth,
            durationValue: peakDuration,
          })}
        />
      </RewindStat>
    </>
  )
}
