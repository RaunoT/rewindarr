import { RewindStory } from '@/types/rewind'
import { CalendarDaysIcon } from '@heroicons/react/24/outline'
import { useLocale, useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { getWeekdayDate } from '../habitsDate'
import RewindBarChart from '../RewindBarChart'
import RewindCat from '../RewindCat'
import RewindStat from '../RewindStat'

function weekday(index: number, formatter: Intl.DateTimeFormat) {
  return formatter.format(getWeekdayDate(index))
}

// The plays per day start on Sunday, as Date.getDay() does, but the chart
// starts the week on Monday.
const WEEK = [1, 2, 3, 4, 5, 6, 0]

export default function StoryHabitsDay({ userRewind }: RewindStory) {
  const t = useTranslations('Rewind.Habits')
  const tCommon = useTranslations('Common')
  const locale = useLocale()
  const shortFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }),
    [locale],
  )
  const longFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }),
    [locale],
  )
  const { peakDayIndex, daily } = userRewind.habits

  if (peakDayIndex === null) {
    return null
  }

  const labels = WEEK.map((day) => weekday(day, shortFormatter))
  const data = WEEK.map((day) => daily[day])
  const peakDay = weekday(peakDayIndex, longFormatter)

  return (
    <>
      <RewindStat>
        <p>
          {t.rich('day', {
            dayValue: peakDay,
            day: (chunks) => (
              <RewindCat icon={<CalendarDaysIcon />}>{chunks}</RewindCat>
            ),
          })}
        </p>
      </RewindStat>

      <RewindStat step={1} noScale className='pt-4'>
        <RewindBarChart
          data={data}
          labels={labels}
          peakIndex={WEEK.indexOf(peakDayIndex)}
          axisLabel={tCommon('plays')}
          ariaLabel={t('dayChart', {
            dayValue: peakDay,
            count: daily[peakDayIndex],
          })}
        />
      </RewindStat>
    </>
  )
}
