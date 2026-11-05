import SkeletonLine from '@/components/SkeletonLine'
import SkeletonLinks from '@/components/SkeletonLinks'
import { PublicSettings } from '@/types/settings'
import {
  DEFAULT_SETTINGS,
  HISTORY_PAGE_SIZES,
  RATING_STATISTICS,
} from '@/utils/constants'
import { getLinkButtonSites } from '@/utils/externalLinks'

type Props = {
  // A page's worth, so the card is as tall as the plays it waits for
  rows?: number
  // The ratings and links the cards show. The defaults stand in where the
  // settings can't be read, such as an error that only takes the room.
  general?: Pick<
    PublicSettings['general'],
    'activeExternalLinks' | 'activeItemStatistics'
  >
}

// Built like the cards, a play of an episode with ratings, so little moves
// once they load
export default function HistorySkeleton({
  rows = HISTORY_PAGE_SIZES[0],
  general = DEFAULT_SETTINGS.general,
}: Props) {
  const { activeExternalLinks, activeItemStatistics } = general
  const hasRatings = RATING_STATISTICS.some((rating) =>
    activeItemStatistics.includes(rating),
  )
  // A site whose rating is shown opens from it
  const linkCount = getLinkButtonSites(
    'show',
    activeExternalLinks,
    activeItemStatistics,
  ).length

  return (
    <div className='w-full'>
      {/* The day's heading */}
      <div className='skeleton mb-3 h-7 w-24 rounded-full' />
      <ul className='flex w-full flex-col overflow-hidden'>
        {[...Array(rows)].map((_, i) => (
          <li
            key={i}
            className='flex items-start gap-3 py-2.5 not-first:border-t not-first:border-white/10 first:pt-0 last:pb-0 max-sm:flex-wrap sm:items-center sm:gap-4'
          >
            {/* Phones show how far a play got under the poster */}
            <div className='flex shrink-0 flex-col gap-1.5'>
              <div className='skeleton poster max-sm:w-12' />
              <div className='flex flex-col items-center gap-1 text-xs sm:hidden'>
                <div className='skeleton h-1 w-full' />
                <SkeletonLine width='w-7' />
              </div>
            </div>
            <div className='@container min-w-0 flex-1'>
              <div className='flex flex-col gap-2 @md:flex-row @md:items-start @md:gap-4'>
                <div className='min-w-0 flex-1'>
                  {/* The time small above the name, where there's no column
                      for it, with the year and episode on phones. From sm up
                      they follow the name. */}
                  <SkeletonLine
                    className='text-xs leading-snug sm:text-sm @md:hidden'
                    width='w-32 sm:w-14'
                  />
                  <SkeletonLine
                    className='leading-snug sm:text-lg'
                    width='w-5/6 sm:w-2/3'
                  />
                  {hasRatings && (
                    <SkeletonLine
                      className='mt-1.5 text-xs sm:text-sm'
                      width='w-32'
                    />
                  )}
                  {/* The user, the time and, from sm up, how far it got. Pills
                      from sm up, a line of text on phones. */}
                  <div className='icon-stats-container mt-2 max-sm:gap-x-2.5'>
                    <div className='skeleton h-4 w-20 sm:h-6 sm:w-24' />
                    <div className='skeleton h-4 w-16 sm:h-6 sm:w-28' />
                    <div className='skeleton h-6 w-24 max-sm:hidden' />
                  </div>
                </div>
                {/* Wide cards have the time with the links under it */}
                <div className='flex shrink-0 flex-col gap-2 max-sm:hidden @md:items-end'>
                  <div className='hidden @md:flex'>
                    <SkeletonTime />
                  </div>
                  {linkCount > 0 && <SkeletonLinks count={linkCount} />}
                </div>
              </div>
            </div>
            {/* Phones have the links in a row of their own, split evenly */}
            {linkCount > 0 && (
              <SkeletonLinks
                count={linkCount}
                className='basis-full *:flex-1 sm:hidden'
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

// The time, where the card puts it
function SkeletonTime() {
  return (
    <div className='flex shrink-0 justify-end text-xs leading-snug sm:text-sm'>
      <SkeletonLine width='w-12' />
    </div>
  )
}
