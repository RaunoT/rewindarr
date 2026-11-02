'use client'

import { GlobalContext } from '@/app/_components/GlobalContextProvider'
import SkeletonLine from '@/components/SkeletonLine'
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

// Built like an activity card for an episode, so nothing moves once it loads
export default function ActivitiesSkeleton() {
  const {
    activity: { isDetailsHidden },
  } = useContext(GlobalContext)

  return (
    <div className='w-full'>
      <div className='grid grid-cols-[auto_minmax(0,1fr)] gap-4 sm:grid-rows-[1fr_auto] sm:gap-y-0'>
        <div className='skeleton poster sm:row-span-2' />
        <div className='min-w-0 self-center sm:self-start'>
          <SkeletonLine className='text-xs sm:text-sm' width='w-40' />
          <SkeletonLine
            className='mb-1.5 leading-snug sm:text-lg'
            width='w-2/3 sm:w-1/2'
          />
          <SkeletonLine className='text-xs sm:text-sm' width='w-24' />
          {/* The user, the device, the state and the stream */}
          <div className='mt-3 flex flex-wrap gap-1.5'>
            <div className='skeleton h-5 w-28 sm:h-6' />
            <div className='skeleton h-5 w-24 sm:h-6' />
            <div className='skeleton h-5 w-16 sm:h-6 sm:w-20' />
            <div className='skeleton h-5 w-24 sm:h-6 sm:w-32' />
          </div>
        </div>
        <div className='col-span-2 text-xs sm:col-span-1 sm:col-start-2 sm:pt-3'>
          <div className='skeleton h-1.5 w-full' />
          {/* As wide as the real times, so they wrap alike */}
          <div className='mt-1.5 flex flex-wrap justify-between gap-x-3'>
            <SkeletonLine width='w-24' />
            <SkeletonLine className='ml-auto' width='w-36' />
          </div>
        </div>
      </div>
      {!isDetailsHidden && (
        <div className='mt-4 flex flex-wrap gap-x-6 gap-y-3 rounded-2xl bg-black/25 p-4 text-sm ring-1 ring-white/10 ring-inset'>
          {DETAIL_HIDDEN_BELOW.map((hiddenBelow, i) => (
            <div key={i} className={hiddenBelow || undefined}>
              <SkeletonLine className='mb-0.5 text-xs' width='w-16' />
              <SkeletonLine width='w-24' />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
