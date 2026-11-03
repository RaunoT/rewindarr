import SkeletonLine from '@/components/SkeletonLine'
import { HISTORY_PAGE_SIZES } from '@/utils/constants'

type Props = {
  // A page's worth, so the card is as tall as the plays it waits for
  rows?: number
}

// Built like the cards, a play of an episode with ratings, so little moves
// once they load
export default function HistorySkeleton({
  rows = HISTORY_PAGE_SIZES[0],
}: Props) {
  return (
    <div className='w-full'>
      {/* The day's heading */}
      <div className='skeleton mb-3 h-7 w-24 rounded-full' />
      <ul className='flex w-full flex-col overflow-hidden'>
        {[...Array(rows)].map((_, i) => (
          <li
            key={i}
            className='flex items-start gap-3 py-2.5 not-first:border-t not-first:border-white/10 first:pt-0 last:pb-0 sm:items-center sm:gap-4'
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
                  <div className='flex items-start justify-between gap-3'>
                    <div className='min-w-0 flex-1 leading-snug sm:text-lg'>
                      {/* Phones put the episode's numbers small above the
                          name */}
                      <SkeletonLine
                        className='text-xs sm:hidden'
                        width='w-12'
                      />
                      <SkeletonLine width='w-2/3 sm:w-1/2' />
                    </div>
                    <div className='flex shrink-0 @md:hidden'>
                      <SkeletonTime />
                    </div>
                  </div>
                  <SkeletonLine
                    className='mt-1.5 text-xs sm:text-sm'
                    width='w-32'
                  />
                  {/* Pills from sm up, a line of text on phones */}
                  <div className='icon-stats-container mt-2 max-sm:gap-x-2.5'>
                    <div className='skeleton h-4 w-20 sm:h-6 sm:w-24' />
                    <div className='skeleton h-4 w-16 sm:h-6 sm:w-28' />
                  </div>
                </div>
                <div className='hidden shrink-0 @md:flex'>
                  <SkeletonTime />
                </div>
              </div>
            </div>
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
