'use client'

import { GlobalContext } from '@/app/_components/GlobalContextProvider'
import SkeletonLine from '@/components/SkeletonLine'
import clsx from 'clsx'
import { useContext } from 'react'

// One row of details, so the empty card stays short: as many as fit on one
// row at each width
const DETAIL_HIDDEN_BELOW = [
  '',
  '',
  'max-sm:hidden',
  'max-sm:hidden',
  'max-md:hidden',
]

// Built like a MediaCard for an episode being transcoded, with the same
// wrappers, so nothing moves once it loads
export default function ActivitiesSkeleton() {
  const {
    activity: { isDetailsHidden },
  } = useContext(GlobalContext)

  return (
    <ul className='flex w-full flex-col'>
      <li className='flex flex-wrap items-start gap-3 sm:gap-4'>
        <div className='skeleton poster max-sm:w-12' />
        <div className='@container min-w-0 flex-1 max-sm:contents'>
          <div className='flex flex-col gap-2 max-sm:contents @md:flex-row @md:items-start @md:gap-4'>
            <div className='min-w-0 flex-1'>
              <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0 flex-1 leading-snug sm:text-lg'>
                  {/* Phones put the episode's numbers small above the name */}
                  <SkeletonLine className='text-xs sm:hidden' width='w-12' />
                  <SkeletonLine width='w-2/3 sm:w-1/2' />
                </div>
                <SkeletonAside className='flex max-sm:hidden @md:hidden' />
                {/* Phones have how it streams next to the title */}
                <div className='skeleton h-5 w-13 shrink-0 sm:hidden' />
              </div>
              <SkeletonLine
                className='mt-1.5 text-xs sm:text-sm'
                width='w-24'
              />
              {/* The user, the device and, from sm up, how it streams */}
              <div className='icon-stats-container mt-2 max-sm:gap-x-2.5'>
                <div className='skeleton h-4 w-14 sm:h-6 sm:w-20' />
                <div className='skeleton h-4 w-24 sm:h-6 sm:w-32' />
                <div className='skeleton h-6 w-24 max-sm:hidden' />
              </div>
            </div>
            <div className='flex shrink-0 flex-col gap-2 max-sm:hidden @md:items-end'>
              <SkeletonAside className='hidden @md:flex' />
            </div>
          </div>
          {/* The progress, with the times under it on phones */}
          <div className='text-xs max-sm:basis-full sm:mt-3 sm:text-sm'>
            <div className='flex items-center gap-3'>
              <div className='skeleton h-1.5 flex-1' />
              <SkeletonLine className='max-sm:hidden' width='w-8' />
            </div>
            <div className='mt-1.5 flex justify-between gap-3 sm:hidden'>
              <SkeletonLine width='w-24' />
              <SkeletonLine width='w-20' />
            </div>
          </div>
        </div>
        {!isDetailsHidden && (
          <div className='order-last min-w-0 basis-full'>
            <div className='flex flex-wrap gap-x-6 gap-y-3 rounded-2xl bg-black/25 p-4 text-sm ring-1 ring-white/10 ring-inset'>
              {DETAIL_HIDDEN_BELOW.map((hiddenBelow, i) => (
                <div key={i} className={hiddenBelow || undefined}>
                  <SkeletonLine className='mb-0.5 text-xs' width='w-16' />
                  <SkeletonLine width='w-24' />
                </div>
              ))}
            </div>
          </div>
        )}
      </li>
    </ul>
  )
}

// Where the play is and when it ends
function SkeletonAside({ className }: { className: string }) {
  return (
    <div
      className={clsx(
        'shrink-0 flex-col items-end text-xs leading-snug sm:text-sm',
        className,
      )}
    >
      <SkeletonLine width='w-24' />
      <SkeletonLine width='w-20' />
    </div>
  )
}
