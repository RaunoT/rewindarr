import { PersonalityStat } from '@/types/rewindPersonality'
import { secondsToTime } from '@/utils/formatting'
import { useLocale, useTranslations } from 'next-intl'
import { ReactNode, useMemo } from 'react'

type Props = {
  stat: PersonalityStat
}

const TAGS = {
  stat: (chunks: ReactNode) => <span className='rewind-stat'>{chunks}</span>,
  title: (chunks: ReactNode) => <span className='rewind-cat'>{chunks}</span>,
}

// One of the stats that earned the viewer their personality, as a sentence
export default function PersonalityStatText({ stat }: Props) {
  const t = useTranslations('Rewind.Personality.stats')
  const tRoot = useTranslations()
  const locale = useLocale()
  const hourFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
      }),
    [locale],
  )
  const dayFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }),
    [locale],
  )

  function formatHour(hour: number) {
    return hourFormatter.format(new Date(Date.UTC(2024, 0, 1, hour)))
  }

  switch (stat.type) {
    case 'peakHour':
      return t.rich('peakHour', { ...TAGS, hourValue: formatHour(stat.hour) })
    case 'hoursShare':
      return t.rich('hoursShare', {
        ...TAGS,
        share: stat.share,
        fromValue: formatHour(stat.from),
        toValue: formatHour(stat.to),
      })
    case 'weekendShare':
      return t.rich('weekendShare', { ...TAGS, share: stat.share })
    case 'peakDay':
      return t.rich('peakDay', {
        ...TAGS,
        // 2024-01-07 is a Sunday, as in the habits story
        dayValue: dayFormatter.format(
          new Date(Date.UTC(2024, 0, 7 + stat.day)),
        ),
      })
    case 'binge':
      return t.rich('binge', {
        ...TAGS,
        episodes: stat.episodes,
        titleValue: stat.title,
      })
    case 'streak':
      return t.rich('streak', { ...TAGS, days: stat.days })
    case 'completion':
      return t.rich('completion', {
        ...TAGS,
        finished: stat.finished,
        started: stat.started,
      })
    case 'newShows':
    case 'newArtists':
    case 'titles':
      return t.rich(stat.type, { ...TAGS, count: stat.count })
    case 'decade':
      return t.rich('decade', {
        ...TAGS,
        share: stat.share,
        decade: stat.decade,
      })
    case 'oldest':
      return t.rich('oldest', {
        ...TAGS,
        year: stat.year,
        titleValue: stat.title,
      })
    case 'comfortWatch':
      return t.rich(stat.show ? 'comfortWatchEpisode' : 'comfortWatch', {
        ...TAGS,
        watches: stat.watches,
        titleValue: stat.title,
        showValue: stat.show ?? '',
      })
    case 'topTitle':
      return t.rich('topTitle', {
        ...TAGS,
        share: stat.share,
        titleValue: stat.title,
      })
    case 'share':
      return t.rich(`share.${stat.media}`, { ...TAGS, share: stat.share })
    case 'count':
      return t.rich(`count.${stat.media}`, { ...TAGS, count: stat.count })
    case 'total':
      return t.rich('total', {
        ...TAGS,
        durationValue: secondsToTime(stat.duration, tRoot),
      })
  }
}
