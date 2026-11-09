'use client'

import DatePicker from '@/components/DatePicker'
import { formatLongDate } from '@/utils/formatting'
import { getReleaseDay } from '@/utils/rewindPeriod'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

type Props = {
  // MM-DD
  defaultValue: string
}

// Every year's edition comes out on the same day, so only its day and month
// show. The picker opens on this year's release.
export default function RewindReleaseDate({ defaultValue }: Props) {
  const t = useTranslations('Settings.Rewind')
  const locale = useLocale()
  // This year's edition, which says whether a date is in the year after
  const year = new Date().getFullYear()
  const [releaseDay, setReleaseDay] = useState(
    getReleaseDay(year, defaultValue),
  )

  return (
    <DatePicker
      label={t('releaseDate')}
      helperText={t('releaseDateDescription', {
        year: String(year),
        date: formatLongDate(releaseDay.toDate('UTC'), locale),
      })}
      name='releaseDate'
      defaultValue={releaseDay.toString()}
      onChange={(value) =>
        value && setReleaseDay(getReleaseDay(year, value.toString().slice(5)))
      }
      isYearHidden
      required
    />
  )
}
