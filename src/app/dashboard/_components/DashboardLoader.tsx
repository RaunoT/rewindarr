import CardWrapper from '@/app/_components/CardWrapper'
import SkeletonLine from '@/components/SkeletonLine'
import { TotalsSkeleton } from '@/components/Totals'
import { PublicSettings } from '@/types/settings'
import { TautulliMediaType } from '@/types/tautulli'
import { DASHBOARD_PAGE_SIZE, RATING_STATISTICS } from '@/utils/constants'
import { getLinkButtonSites } from '@/utils/externalLinks'
import clsx from 'clsx'

type Props = {
  type: TautulliMediaType | 'users'
  settings: PublicSettings
  rows?: number
}

// Built like the real rows for this library and the chosen statistics, so
// nothing moves once the data arrives
export default function DashboardLoader({
  type,
  settings,
  rows = DASHBOARD_PAGE_SIZE,
}: Props) {
  const { activeTotalStatistics } = settings.dashboard
  // The same totals as the dashboard shows for this library
  const totalsCount = [
    activeTotalStatistics.includes('duration'),
    activeTotalStatistics.includes('requests') &&
      settings.connection.isSeerrActive &&
      type !== 'artist',
    activeTotalStatistics.includes('count'),
    activeTotalStatistics.includes('size') && type !== 'users',
  ].filter(Boolean).length

  return (
    <div className='flex flex-1 flex-col'>
      <TotalsSkeleton count={totalsCount} />

      <CardWrapper>
        <DashboardListSkeleton type={type} settings={settings} rows={rows} />
      </CardWrapper>
    </div>
  )
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
  // Music has no links, and a site whose rating is shown opens from it
  const linkCount =
    type === 'movie' || type === 'show'
      ? getLinkButtonSites(
          type,
          settings.general.activeExternalLinks,
          activeStats,
        ).length
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
