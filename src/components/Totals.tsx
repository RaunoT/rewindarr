import SkeletonLine from '@/components/SkeletonLine'
import { ReactNode } from 'react'

export type Total = {
  key: string
  icon: ReactNode
  label: string
  value: ReactNode
}

// Two to a row on phones, one row with dividers from sm up
const LIST_CLASS =
  'glass-sheet mb-4 grid grid-cols-2 gap-4 rounded-[1.75rem] p-4 sm:flex sm:gap-0 sm:divide-x sm:divide-white/10 sm:px-0'
const ITEM_CLASS = 'min-w-0 sm:flex-1 sm:px-5'
const LABEL_CLASS = 'text-xs sm:text-sm'
const VALUE_CLASS = 'mt-1 text-lg font-semibold tracking-tight sm:text-xl'

// What the page's period and filters add up to, above the list they belong to
export default function Totals({ totals }: { totals: Total[] }) {
  if (!totals.length) {
    return null
  }

  return (
    <dl className={LIST_CLASS}>
      {totals.map((total) => (
        <div key={total.key} className={ITEM_CLASS}>
          <dt
            className={`${LABEL_CLASS} flex items-center gap-1.5 text-neutral-400 [&>svg]:size-4 [&>svg]:shrink-0`}
          >
            {total.icon}
            <span className='truncate'>{total.label}</span>
          </dt>
          <dd className={`${VALUE_CLASS} tabular-nums`}>{total.value}</dd>
        </div>
      ))}
    </dl>
  )
}

const LABEL_WIDTHS = ['w-20', 'w-14', 'w-16', 'w-12']
const VALUE_WIDTHS = ['w-32', 'w-16', 'w-20', 'w-14']

// As tall as the totals, so nothing moves once they load
export function TotalsSkeleton({ count }: { count: number }) {
  if (!count) {
    return null
  }

  return (
    <div className={LIST_CLASS}>
      {[...Array(count)].map((_, i) => (
        <div key={i} className={ITEM_CLASS}>
          <SkeletonLine
            className={LABEL_CLASS}
            width={LABEL_WIDTHS[i % LABEL_WIDTHS.length]}
          />
          <SkeletonLine
            className={VALUE_CLASS}
            width={VALUE_WIDTHS[i % VALUE_WIDTHS.length]}
          />
        </div>
      ))}
    </div>
  )
}
