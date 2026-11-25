import { RewindStory } from '@/types/rewind'
import { formatMonthYear, secondsToTime } from '@/utils/formatting'
import { ChartBarIcon } from '@heroicons/react/24/outline'
import { useLocale, useTranslations } from 'next-intl'
import { useMemo } from 'react'
import {
  getMonthLabels,
  getYearLabels,
  SHORT_LABEL_MONTHS,
  WIDE_SHORT_LABEL_MONTHS,
} from '../monthLabels'
import RewindBarChart from '../RewindBarChart'
import RewindCat from '../RewindCat'
import RewindStat from '../RewindStat'

const HOUR = 60 * 60

export default function StoryMonths({ userRewind }: RewindStory) {
  const t = useTranslations('Rewind.Moments')
  const tRoot = useTranslations()
  const locale = useLocale()
  const { monthly } = userRewind.moments
  const labels = useMemo(() => {
    const months = monthly?.months.map(({ month }) => month) ?? []

    return {
      phone: getMonthLabels(months, locale, SHORT_LABEL_MONTHS),
      wide: getMonthLabels(months, locale, WIDE_SHORT_LABEL_MONTHS),
      years: getYearLabels(months, locale),
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
              <RewindCat icon={<ChartBarIcon />}>{chunks}</RewindCat>
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
          yearLabels={labels.years}
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
