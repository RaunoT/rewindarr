import clsx from 'clsx'
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
const LABEL_CLASS =
  'flex h-[1lh] items-center gap-1 text-[0.6875rem] text-neutral-400 sm:gap-1.5 sm:text-sm [&>svg]:size-3 [&>svg]:shrink-0 sm:[&>svg]:size-4'
const VALUE_CLASS =
  'mt-0.5 text-base font-semibold tracking-tight whitespace-nowrap sm:mt-1 sm:text-xl'

function toPairs<T>(items: T[]): T[][] {
  return Array.from({ length: Math.ceil(items.length / 2) }, (_, i) =>
    items.slice(i * 2, i * 2 + 2),
  )
}

// The whole label counts towards the row's width, so a row that can't show
// every label wraps. A column is only kept wide enough for the first 6rem of
// its label, though, so a long one is cut short instead of pushing the row
// apart when even half a row is too narrow for it.
function LabelText({
  label,
  children = label,
}: {
  label: string
  // What to show instead of the label, such as a skeleton
  children?: ReactNode
}) {
  return (
    <span className='grid grid-cols-[minmax(min-content,max-content)] *:[grid-area:1/1]'>
      <span className='w-0 min-w-full truncate'>{children}</span>
      {/* Only size the column */}
      <span
        aria-hidden
        className='invisible h-0 max-w-24 overflow-hidden whitespace-nowrap sm:max-w-48'
      >
        {label}
      </span>
      <span aria-hidden className='invisible h-0 overflow-hidden'>
        {label}
      </span>
    </span>
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
                <dt className={LABEL_CLASS}>
                  {total.icon}
                  <LabelText label={total.label} />
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

// About as wide as a typical value of each kind, short and long, so the
// skeleton wraps where the totals would. A size is usually the one value
// wider than its label, so on phones around 390px it can decide alone
// whether four totals fit on one row, as on the Shows page. The sample
// matches a home server's usual 0.98 to 9.99 TB; wider sizes, such as 10 TB or
// more or hundreds of GB, still move the page there.
const SAMPLE_VALUES = {
  duration: ['00d 00h', '00 days 00 hrs'],
  count: ['0,000', '0,000'],
  smallCount: ['000', '000'],
  size: ['0.00 TB', '0.00 TB'],
}

export type TotalSkeleton = {
  label: string
  kind: keyof typeof SAMPLE_VALUES
}

// With the real labels, which are known before the totals, so it wraps like
// they do and nothing moves once they load
export function TotalsSkeleton({ totals }: { totals: TotalSkeleton[] }) {
  if (!totals.length) {
    return null
  }

  return (
    <div className={SHEET_CLASS}>
      <div className={ROWS_CLASS} aria-hidden>
        {toPairs(totals).map((pair) => (
          <div
            key={pair[0].label}
            className={PAIR_CLASS}
            style={{ flexGrow: pair.length }}
          >
            {pair.map(({ label, kind }) => {
              const [short, long] = SAMPLE_VALUES[kind]

              return (
                <div key={label} className={ITEM_CLASS}>
                  {/* One bar for the icon and the label */}
                  <div className={LABEL_CLASS}>
                    <SkeletonText className='pl-4 sm:pl-5.5'>
                      <LabelText label={label}>{label}</LabelText>
                    </SkeletonText>
                  </div>
                  <div className={`${VALUE_CLASS} tabular-nums`}>
                    <SkeletonText className='sm:hidden'>{short}</SkeletonText>
                    <SkeletonText className='max-sm:hidden'>
                      {long}
                    </SkeletonText>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// A bar as wide as the text it stands in for
function SkeletonText({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={clsx(
        'skeleton inline-block h-[0.7em] align-middle leading-[0.7em] text-transparent',
        className,
      )}
    >
      {children}
    </span>
  )
}
