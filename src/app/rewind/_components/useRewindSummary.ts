import { UserRewind } from '@/types/rewind'
import { PublicSettings } from '@/types/settings'
import { ItemRow } from '@/types/statsSource'
import { formatMonthYear, secondsToTime } from '@/utils/formatting'
import { getImageProxyUrl } from '@/utils/imageProxy'
import { getRewindPeriodType } from '@/utils/rewindPeriod'
import {
  CalendarDaysIcon,
  ChartBarIcon,
  ClockIcon,
  FireIcon,
  ForwardIcon,
  TagIcon,
  TrophyIcon,
} from '@heroicons/react/24/outline'
import { useLocale, useTranslations } from 'next-intl'
import { ComponentType, SVGProps } from 'react'
import { getWeekdayDate } from './habitsDate'
import { PERSONALITY_ICONS } from './personalityIcons'
import {
  getSummaryFileName,
  getSummaryHighlights,
  getSummaryTitle,
  getSummaryTops,
  SummaryHighlight,
  SummaryTop,
} from './summary'

type StatIcon = ComponentType<SVGProps<SVGSVGElement>>

export type SummaryStat = {
  key: string
  label: string
  value: string
  // A second line, like the binged show under the label and its time under
  // the value
  detail?: { label: string; value?: string }
  Icon: StatIcon
}

// As in the stories that tell of them
const HIGHLIGHT_ICONS: Record<SummaryHighlight['type'], StatIcon> = {
  topPercent: TrophyIcon,
  genre: TagIcon,
  binge: ForwardIcon,
  streak: FireIcon,
  month: ChartBarIcon,
  day: CalendarDaysIcon,
}

// What the summary story and its saved image both show
export type RewindSummary = {
  title: string
  name: string
  image: string | null | undefined
  tops: (SummaryTop & { label: string; srcs: (string | null)[] })[]
  // The total time first
  stats: SummaryStat[]
  personality: {
    label: string
    name: string
    Icon: StatIcon
  } | null
  fileName: string
}

// TMDB's posters go through the image proxy too, so the saved image has
// nothing cross-origin in it
function getPosterSrcs(item: ItemRow) {
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
  const tRoot = useTranslations()
  const locale = useLocale()
  const { user, personality } = userRewind
  const titleParts = getSummaryTitle(settings.general.serverName, {
    customStartDate:
      getRewindPeriodType(settings) === 'custom'
        ? settings.rewind.startDate
        : undefined,
    editionYear: userRewind.period.year,
  })
  const title = t(`title.${titleParts.type}`, titleParts)

  function toStat(highlight: SummaryHighlight): SummaryStat {
    const label = t(`highlights.${highlight.type}.label`)
    const Icon = HIGHLIGHT_ICONS[highlight.type]

    switch (highlight.type) {
      case 'topPercent':
        return {
          key: highlight.type,
          label,
          Icon,
          value: t('highlights.topPercent.value', {
            percent: highlight.percent / 100,
          }),
        }
      case 'genre':
        return { key: highlight.type, label, Icon, value: highlight.name }
      case 'binge':
        return {
          key: highlight.type,
          label,
          Icon,
          value: t('highlights.binge.value', { count: highlight.episodes }),
          detail: {
            label: highlight.title,
            value: secondsToTime(highlight.duration, tRoot),
          },
        }
      case 'streak':
        return {
          key: highlight.type,
          label,
          Icon,
          value: t('highlights.streak.value', { count: highlight.days }),
        }
      case 'month':
        return {
          key: highlight.type,
          label,
          Icon,
          value: formatMonthYear(`${highlight.month}-01`, locale, 'long'),
        }
      case 'day':
        return {
          key: highlight.type,
          label,
          Icon,
          value: new Intl.DateTimeFormat(locale, {
            weekday: 'long',
            timeZone: 'UTC',
          }).format(getWeekdayDate(highlight.day)),
        }
    }
  }

  return {
    title,
    name: user.name,
    image: user.image,
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
        Icon: ClockIcon,
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
