'use client'

import { GlobalContext } from '@/app/_components/GlobalContextProvider'
import SkeletonLine from '@/components/SkeletonLine'
import SkeletonLinks from '@/components/SkeletonLinks'
import { PublicSettings } from '@/types/settings'
import { DEFAULT_SETTINGS, RATING_STATISTICS } from '@/utils/constants'
import { getLinkButtonSites } from '@/utils/externalLinks'
import clsx from 'clsx'
import { useContext } from 'react'

type Props = {
  // The ratings and links the card shows. The defaults stand in where the
  // settings can't be read, such as an error that only takes the room.
  general?: Pick<
    PublicSettings['general'],
    'activeExternalLinks' | 'activeItemStatistics'
  >
}

// The rows of the stream's details: what is playing, with a second line for
// a language in a wide list or a conversion in a narrow one, and how it gets
// there
const DETAIL_ROWS = [
  [true, true, true],
  [false, false, false],
]

// Built like a MediaCard for an episode being transcoded, with the same
// wrappers, so nothing moves once it loads
export default function ActivitiesSkeleton({
  general = DEFAULT_SETTINGS.general,
}: Props) {
  const {
    activity: { isDetailsHidden },
  } = useContext(GlobalContext)
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
    <ul className='flex w-full flex-col'>
      <li className='flex flex-wrap items-start gap-3 sm:gap-4'>
        <div className='skeleton poster max-sm:w-12' />
        <div className='@container min-w-0 flex-1 max-sm:contents'>
          <div className='flex flex-col gap-2 max-sm:contents @md:flex-row @md:items-start @md:gap-4'>
            <div className='min-w-0 flex-1'>
              {/* The episode's numbers small above the name, with when it
                  ends beside them where there's no column for it, and how it
                  streams on phones */}
              <div className='flex items-center justify-between gap-3 text-xs leading-snug sm:text-sm'>
                <SkeletonLine width='w-12' />
                <SkeletonEnd className='max-sm:hidden @md:hidden' />
                <div className='skeleton h-5 w-13 shrink-0 sm:hidden' />
              </div>
              <SkeletonLine
                className='leading-snug sm:text-lg'
                width='w-2/3 sm:w-1/2'
              />
              {hasRatings && (
                <SkeletonLine
                  className='mt-1.5 text-xs sm:text-sm'
                  width='w-24'
                />
              )}
              {/* The user, the device and, from sm up, how it streams */}
              <div className='icon-stats-container mt-2 max-sm:gap-x-2.5'>
                <div className='skeleton h-4 w-14 sm:h-6 sm:w-20' />
                <div className='skeleton h-4 w-20 sm:h-6 sm:w-32' />
                <div className='skeleton h-6 w-24 max-sm:hidden' />
              </div>
            </div>
            {/* Wide cards have when it ends with the links under it */}
            <div className='flex shrink-0 flex-col gap-2 max-sm:hidden @md:items-end'>
              <SkeletonEnd className='hidden @md:flex' />
              {linkCount > 0 && <SkeletonLinks count={linkCount} />}
            </div>
          </div>
          {/* The bar, with how far it got under its start and the time
              played under its end. Phones add when it ends to the start. */}
          <div className='text-xs max-sm:basis-full sm:mt-3 sm:text-sm'>
            <div className='skeleton h-1.5 w-full' />
            <div className='mt-2 flex justify-between gap-3'>
              <SkeletonLine width='w-28 sm:w-8' />
              <SkeletonLine width='w-24' />
            </div>
          </div>
          {/* Phones have the links in a row of their own, split evenly */}
          {linkCount > 0 && (
            <SkeletonLinks
              count={linkCount}
              className='basis-full *:flex-1 sm:hidden'
            />
          )}
        </div>
        {!isDetailsHidden && (
          <div className='order-last min-w-0 basis-full'>
            <div className='@container rounded-2xl bg-black/25 p-4 text-sm ring-1 ring-white/10 ring-inset'>
              <div className='flex flex-col @2xl:flex-row @2xl:gap-8'>
                {DETAIL_ROWS.map((rows, i) => (
                  <div
                    key={i}
                    className={clsx(
                      '@container flex-1 divide-y divide-white/5',
                      i > 0 &&
                        'mt-2 border-t border-white/5 pt-2 @2xl:mt-0 @2xl:border-t-0 @2xl:pt-0',
                    )}
                  >
                    {rows.map((hasSecondLine, j) => (
                      <div
                        key={j}
                        className='py-2 first:pt-0 last:pb-0 @sm:flex @sm:gap-3'
                      >
                        <div className='mb-0.5 text-xs @sm:mb-0 @sm:w-28 @sm:shrink-0 @sm:text-sm'>
                          <SkeletonLine width='w-16' />
                          {hasSecondLine && (
                            <SkeletonLine
                              className='hidden text-xs @sm:flex'
                              width='w-12'
                            />
                          )}
                        </div>
                        <div className='flex-1'>
                          <SkeletonLine width='w-32' />
                          {/* A narrow list's conversion wraps */}
                          {hasSecondLine && (
                            <SkeletonLine className='@sm:hidden' width='w-24' />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </li>
    </ul>
  )
}

// When it ends
function SkeletonEnd({ className }: { className: string }) {
  return (
    <div
      className={clsx(
        'shrink-0 justify-end text-xs leading-snug sm:text-sm',
        className,
      )}
    >
      <SkeletonLine width='w-24' />
    </div>
  )
}
