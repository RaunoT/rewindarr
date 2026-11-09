'use client'

import DatePicker from '@/components/DatePicker'
import { getReleaseDay } from '@/utils/rewindPeriod'
import { useTranslations } from 'next-intl'

type Props = {
  // MM-DD
  defaultValue: string
}

// Every year's edition comes out on the same day, so only its day and month
// show. The picker opens on this year's release.
export default function RewindReleaseDate({ defaultValue }: Props) {
  const t = useTranslations('Settings.Rewind')
  const year = new Date().getFullYear()

  return (
    <DatePicker
      label={t('releaseDate')}
      helperText={t('releaseDateDescription', { year: String(year) })}
      name='releaseDate'
      defaultValue={getReleaseDay(year, defaultValue).toString()}
      isYearHidden
      required
    />
  )
}
