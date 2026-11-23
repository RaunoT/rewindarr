import SkeletonLine from '@/components/SkeletonLine'
import { ReactNode } from 'react'

export type Total = {
  key: string
  icon: ReactNode
  label: string
  value: ReactNode
  // Shown on phones instead, where the totals share one narrow row
  shortValue?: ReactNode
}

// One row with dividers. When that's too narrow for the text, such as on
// small phones, with long numbers or in a wordier language, the second pair
// of totals wraps under the first.
const SHEET_CLASS =
  'glass-sheet mb-4 rounded-3xl px-1.5 py-3 sm:rounded-[1.75rem] sm:px-0 sm:py-4'
// Clips the divider before whichever pair starts a row
const ROWS_CLASS = 'flex flex-wrap gap-y-3 overflow-hidden'
// Sized by its text on phones, so the row wraps only when it has to
const PAIR_CLASS = '-ml-px flex border-l border-white/10 sm:basis-0'
// Shares the pair evenly, but never narrower than its value
const ITEM_CLASS = 'flex-1 border-white/10 px-2.5 not-first:border-l sm:px-5'
const LABEL_CLASS = 'text-[0.6875rem] sm:text-sm'
const VALUE_CLASS =
  'mt-0.5 text-base font-semibold tracking-tight whitespace-nowrap sm:mt-1 sm:text-xl'

function toPairs<T>(items: T[]): T[][] {
  return Array.from({ length: Math.ceil(items.length / 2) }, (_, i) =>
    items.slice(i * 2, i * 2 + 2),
  )
}

// What the page's period and filters add up to, above the list they belong to
export default function Totals({ totals }: { totals: Total[] }) {
  if (!totals.length) {
    return null
  }

  return (
    <div className={SHEET_CLASS}>
      <div className={ROWS_CLASS}>
        {toPairs(totals).map((pair) => (
          <dl
            key={pair[0].key}
            className={PAIR_CLASS}
            // A lone total takes as much room as a pair's two
            style={{ flexGrow: pair.length }}
          >
            {pair.map((total) => (
              <div key={total.key} className={ITEM_CLASS}>
                <dt
                  className={`${LABEL_CLASS} flex items-center gap-1 text-neutral-400 sm:gap-1.5 [&>svg]:size-3 [&>svg]:shrink-0 sm:[&>svg]:size-4`}
                >
                  {total.icon}
                  {/* Capped, so a long label is cut short instead of
                      pushing the row apart */}
                  <span className='max-w-24 truncate sm:max-w-48'>
                    {total.label}
                  </span>
                </dt>
                <dd className={`${VALUE_CLASS} tabular-nums`}>
                  {total.shortValue ? (
                    <>
                      <span className='sm:hidden'>{total.shortValue}</span>
                      <span className='max-sm:hidden'>{total.value}</span>
                    </>
                  ) : (
                    total.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        ))}
      </div>
    </div>
  )
}

// Capped on phones, where four totals share the row
const LABEL_WIDTHS = ['w-20', 'w-14', 'w-16', 'w-12'].map(
  (width) => `${width} max-w-full`,
)
const VALUE_WIDTHS = [
  'w-14 sm:w-32',
  'w-10 sm:w-16',
  'w-12 sm:w-20',
  'w-10 sm:w-14',
]

// As tall as the totals, so nothing moves once they load
export function TotalsSkeleton({ count }: { count: number }) {
  if (!count) {
    return null
  }

  return (
    <div className={SHEET_CLASS}>
      <div className={ROWS_CLASS}>
        {toPairs([...Array(count).keys()]).map((pair) => (
          <div
            key={pair[0]}
            className={PAIR_CLASS}
            style={{ flexGrow: pair.length }}
          >
            {pair.map((i) => (
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
        ))}
      </div>
    </div>
  )
}
