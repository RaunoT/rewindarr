import SkeletonLine from '@/components/SkeletonLine'
import { HISTORY_PAGE_SIZES } from '@/utils/constants'

type Props = {
  // A page's worth, so the card is as tall as the plays it waits for
  rows?: number
}

// Built like a day of plays, so nothing moves once they load
export default function HistorySkeleton({
  rows = HISTORY_PAGE_SIZES[0],
}: Props) {
  return (
    <div className='w-full'>
      <SkeletonLine className='mb-1 text-sm' width='w-24' />
      <ul className='divide-y divide-white/10'>
        {[...Array(rows)].map((_, i) => (
          <li key={i} className='flex items-center gap-3 py-2 last:pb-0'>
            <div className='skeleton poster w-8 rounded-sm!' />
            <div className='min-w-0 flex-1'>
              <SkeletonLine className='text-sm' width='w-2/3 sm:w-1/2' />
              <SkeletonLine className='text-xs' width='w-32' />
            </div>
            <SkeletonLine className='text-xs' width='w-10' />
          </li>
        ))}
      </ul>
    </div>
  )
}
