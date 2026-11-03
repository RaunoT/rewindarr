import SkeletonLine from '@/components/SkeletonLine'
import { HISTORY_PAGE_SIZES } from '@/utils/constants'

type Props = {
  // A page's worth, so the card is as tall as the plays it waits for
  rows?: number
}

// Built like the cards, an episode's with ratings and a link, so little moves
// once they load
export default function HistorySkeleton({
  rows = HISTORY_PAGE_SIZES[0],
}: Props) {
  return (
    <ul className='flex w-full flex-col overflow-hidden'>
      {[...Array(rows)].map((_, i) => (
        <li
          key={i}
          className='flex items-center gap-3 py-2.5 not-first:border-t not-first:border-white/10 first:pt-0 last:pb-0 max-sm:flex-wrap sm:gap-4'
        >
          <div className='skeleton poster max-sm:w-12' />
          <div className='@container min-w-0 flex-1 max-sm:contents'>
            <div className='flex flex-col gap-2 max-sm:contents @md:flex-row @md:items-start @md:gap-4'>
              <div className='min-w-0 flex-1'>
                <div className='flex items-start justify-between gap-3'>
                  <div className='min-w-0 flex-1'>
                    <SkeletonLine
                      className='leading-snug sm:text-lg'
                      width='w-2/3 sm:w-1/2'
                    />
                  </div>
                  <SkeletonDate className='@md:hidden' />
                </div>
                <SkeletonLine className='mt-1.5 text-sm' width='w-32' />
                <div className='mt-2 flex gap-2.5'>
                  <div className='skeleton h-5 w-24 sm:h-6' />
                  <div className='skeleton h-5 w-28 sm:h-6' />
                </div>
              </div>
              <div className='flex shrink-0 flex-col gap-2 max-sm:contents @md:items-end'>
                <div className='flex shrink-0 gap-1.5 max-sm:basis-full max-sm:*:flex-1 @md:mt-0.5'>
                  <div className='skeleton h-6 w-20' />
                  <div className='skeleton h-6 w-9' />
                </div>
                <SkeletonDate className='hidden @md:flex' />
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

// The date over the time, where the card puts them
function SkeletonDate({ className }: { className: string }) {
  return (
    <div
      className={`flex shrink-0 flex-col items-end text-xs leading-snug sm:text-sm ${className}`}
    >
      <SkeletonLine width='w-20' />
      <SkeletonLine width='w-14' />
    </div>
  )
}
