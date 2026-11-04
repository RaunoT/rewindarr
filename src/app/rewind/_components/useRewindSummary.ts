import { UserRewind } from '@/types/rewind'
import { PublicSettings } from '@/types/settings'
import { TautulliItemRow } from '@/types/tautulli'
import { formatMonthYear } from '@/utils/formatting'
import { getRewindStartDate } from '@/utils/helpers'
import { getImageProxyUrl } from '@/utils/imageProxy'
import { useLocale, useTranslations } from 'next-intl'
import { ComponentType, SVGProps } from 'react'
import { PERSONALITY_ICONS } from './personalityIcons'
import {
  getSummaryFileName,
  getSummaryHighlights,
  getSummaryTitle,
  getSummaryTops,
  SummaryHighlight,
  SummaryTop,
} from './summary'

export type SummaryStat = {
  key: string
  label: string
  value: string
  // A line under the value, like the binged show
  detail?: string
}

// What the summary story and its saved image both show
export type RewindSummary = {
  title: string
  name: string
  image: string | null | undefined
  period: string
  tops: (SummaryTop & { label: string; srcs: (string | null)[] })[]
  // The total time first
  stats: SummaryStat[]
  personality: {
    label: string
    name: string
    Icon: ComponentType<SVGProps<SVGSVGElement>>
  } | null
  fileName: string
}

// TMDB's posters go through the image proxy too, so the saved image has
// nothing cross-origin in it
function getPosterSrcs(item: TautulliItemRow) {
  return [item.thumb, item.tmdb_poster].map((src) =>
    src ? getImageProxyUrl(src) : null,
  )
}

export default function useRewindSummary(
  userRewind: UserRewind,
  settings: PublicSettings,
): RewindSummary {
  const t = useTranslations('Rewind.Summary')
  const tPersonality = useTranslations('Rewind.Personality')
  const locale = useLocale()
  const { user, personality } = userRewind
  const startDate = getRewindStartDate(settings)
  const start = formatMonthYear(startDate, locale)
  // The period always runs to now, as in the welcome story
  const end = formatMonthYear(new Date().toISOString().split('T')[0], locale)
  const titleParts = getSummaryTitle(settings.general.serverName, startDate)
  const title = t(`title.${titleParts.type}`, titleParts)

  function toStat(highlight: SummaryHighlight): SummaryStat {
    const label = t(`highlights.${highlight.type}.label`)

    switch (highlight.type) {
      case 'topPercent':
        return {
          key: highlight.type,
          label,
          value: t('highlights.topPercent.value', {
            percent: highlight.percent / 100,
          }),
        }
      case 'genre':
        return { key: highlight.type, label, value: highlight.name }
      case 'binge':
        return {
          key: highlight.type,
          label,
          value: t('highlights.binge.value', { count: highlight.episodes }),
          detail: highlight.title,
        }
      case 'streak':
        return {
          key: highlight.type,
          label,
          value: t('highlights.streak.value', { count: highlight.days }),
        }
      case 'month':
        return {
          key: highlight.type,
          label,
          value: formatMonthYear(`${highlight.month}-01`, locale, 'long'),
        }
      case 'day':
        return {
          key: highlight.type,
          label,
          // 2024-01-07 is a Sunday, as in the habits story
          value: new Intl.DateTimeFormat(locale, {
            weekday: 'long',
            timeZone: 'UTC',
          }).format(new Date(Date.UTC(2024, 0, 7 + highlight.day))),
        }
    }
  }

  return {
    title,
    name: user.name,
    image: user.image,
    period: start === end ? start : t('period', { start, end }),
    tops: getSummaryTops(userRewind).map((top) => ({
      ...top,
      label: t(`top.${top.type}`),
      srcs: getPosterSrcs(top.item),
    })),
    stats: [
      {
        key: 'total',
        label: t('totalTime'),
        value: userRewind.duration.user,
      },
      ...getSummaryHighlights(userRewind).map(toStat),
    ],
    personality: personality
      ? {
          label: t('personality'),
          name: tPersonality(`types.${personality.type}.name`),
          Icon: PERSONALITY_ICONS[personality.type],
        }
      : null,
    fileName: getSummaryFileName(title, user.name),
  }
}
