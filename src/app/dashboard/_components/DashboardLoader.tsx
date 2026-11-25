import CardWrapper from '@/app/_components/CardWrapper'
import SkeletonLine from '@/components/SkeletonLine'
import { TotalSkeleton, TotalsSkeleton } from '@/components/Totals'
import { PublicSettings } from '@/types/settings'
import { LibraryType } from '@/types/statsSource'
import { DASHBOARD_PAGE_SIZE, RATING_STATISTICS } from '@/utils/constants'
import { getLinkButtonCount } from '@/utils/externalLinks'
import { TranslateFunction } from '@/utils/formatting'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'

type Props = {
  type: LibraryType | 'users'
  settings: PublicSettings
  rows?: number
  // One user's totals, which have their own count and no size
  isPersonal?: boolean
}

// Built like the real rows for this library and the chosen statistics, so
// nothing moves once the data arrives
export default function DashboardLoader({
  type,
  settings,
  rows = DASHBOARD_PAGE_SIZE,
  isPersonal = false,
}: Props) {
  const t = useTranslations()
  const { activeTotalStatistics } = settings.dashboard
  // The same totals as the dashboard shows for this library. Users have a
  // count of users instead of a library's count and size.
  const totalKeys = [
    activeTotalStatistics.includes('duration') && 'duration',
    activeTotalStatistics.includes('requests') &&
      settings.connection.isSeerrActive &&
      type !== 'artist' &&
      'requests',
    activeTotalStatistics.includes('count') &&
      (type === 'users' ? 'users' : 'count'),
    activeTotalStatistics.includes('size') &&
      type !== 'users' &&
      !isPersonal &&
      'size',
  ].filter((key): key is TotalKey => !!key)

  return (
    <div className='flex flex-1 flex-col'>
      <TotalsSkeleton
        totals={totalKeys.map((key) => ({
          label: getTotalLabel(key, type, t, isPersonal),
          // What one user played is a far smaller number than a library
          kind:
            key === 'count' && isPersonal ? 'smallCount' : SKELETON_KINDS[key],
        }))}
      />

      <CardWrapper>
        <DashboardListSkeleton type={type} settings={settings} rows={rows} />
      </CardWrapper>
    </div>
  )
}

type TotalKey = 'duration' | 'requests' | 'count' | 'size' | 'users'

const SKELETON_KINDS: Record<TotalKey, TotalSkeleton['kind']> = {
  duration: 'duration',
  requests: 'smallCount',
  count: 'count',
  size: 'size',
  users: 'smallCount',
}

export function getTotalLabel(
  key: TotalKey,
  type: Props['type'],
  t: TranslateFunction,
  isPersonal = false,
) {
  switch (key) {
    case 'duration':
      // Users count music too, so neither watched nor listened
      return type === 'users'
        ? t('Totals.playTime')
        : type === 'artist'
          ? t('Totals.listenTime')
          : t('Common.duration')
    case 'requests':
      return t('Common.requests')
    case 'count':
      if (isPersonal) {
        return type === 'movie'
          ? t('Totals.moviesWatched')
          : type === 'show'
            ? t('Totals.episodesWatched')
            : t('Totals.tracksPlayed')
      }

      return type === 'movie'
        ? t('Totals.movies')
        : type === 'show'
          ? t('Totals.episodes')
          : t('Totals.tracks')
    case 'size':
      return t('Common.size')
    case 'users':
      return t('Common.users')
  }
}

// The rows alone, which also size the card for messages shown instead
export function DashboardListSkeleton({
  type,
  settings,
  rows = DASHBOARD_PAGE_SIZE,
}: Pick<Props, 'type' | 'settings' | 'rows'>) {
  return (
    <ul className='flex flex-col overflow-hidden'>
      {[...Array(rows)].map((_, i) => (
        <ListItem key={i} type={type} settings={settings} />
      ))}
    </ul>
  )
}

function ListItem({
  type,
  settings,
}: {
  type: Props['type']
  settings: PublicSettings
}) {
  const activeStats = settings.general.activeItemStatistics
  const isUsers = type === 'users'
  // The ratings under the title. The year, or a user's first play, is on the
  // title's line.
  const hasRatings =
    (type === 'movie' || type === 'show') &&
    RATING_STATISTICS.some((rating) => activeStats.includes(rating))
  // Two at most, which fit on one line on the narrowest phones too
  const pills = [
    activeStats.includes('duration') && 'w-24',
    activeStats.includes('plays') && 'w-16',
    activeStats.includes('plays') && isUsers && 'w-16',
    activeStats.includes('users') && !isUsers && 'w-16',
  ]
    .filter((width): width is string => !!width)
    .slice(0, 2)
  // Users have no links
  const linkCount =
    type === 'movie' || type === 'show' || type === 'artist'
      ? getLinkButtonCount(
          type,
          settings.general.activeExternalLinks,
          settings.connection.isSeerrActive,
        )
      : 0

  return (
    <li className='flex items-center gap-3 py-2.5 not-first:border-t not-first:border-white/10 first:pt-0 last:pb-0 max-sm:flex-wrap sm:gap-4'>
      <div className='flex shrink-0 items-center gap-3 max-sm:pt-1 max-sm:pl-1 sm:gap-4'>
        {/* Phones show the rank as a badge on the poster */}
        <div className='flex w-8 justify-center max-sm:hidden'>
          <div className='skeleton h-6 w-4' />
        </div>
        <div className='skeleton poster max-sm:w-12' />
      </div>
      <div className='@container min-w-0 flex-1 max-sm:contents'>
        <div className='flex flex-col gap-2 max-sm:contents @md:flex-row @md:items-start @md:gap-4'>
          <div className='min-w-0 flex-1'>
            <SkeletonLine
              className='mb-1.5 leading-snug sm:text-lg'
              width='w-2/3 sm:w-1/2'
            />
            {hasRatings && (
              <SkeletonLine className='mb-2 text-xs sm:text-sm' width='w-24' />
            )}
            {/* Pills from sm up, a line of text on phones */}
            <ul className='icon-stats-container max-sm:gap-x-2.5'>
              {pills.map((width, i) => (
                <li key={i} className={clsx('skeleton h-4 sm:h-6', width)} />
              ))}
            </ul>
          </div>
          {linkCount > 0 && (
            <div className='flex shrink-0 flex-wrap gap-x-1.5 gap-y-2.5 max-sm:basis-full max-sm:*:flex-1 @md:mt-0.5 @md:max-w-56 @md:justify-end'>
              {[...Array(linkCount)].map((_, i) => (
                <div key={i} className='skeleton h-6 w-11 rounded-md' />
              ))}
            </div>
          )}
        </div>
      </div>
    </li>
  )
}
