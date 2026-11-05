import clsx from 'clsx'
import { SummaryStat } from './useRewindSummary'

type Props = {
  stats: SummaryStat[]
  // Its surface, which differs between the story and the saved image
  className?: string
}

// The summary's stats as rows, like the lists in the home page's tiles. The
// story and its saved image both show them. A value takes the room its label
// leaves, which keeps it from wrapping once the image is drawn.
export default function SummaryStatList({ stats, className }: Props) {
  return (
    <dl className={clsx('divide-y divide-white/10 px-4 py-1', className)}>
      {stats.map(({ key, label, value, detail, Icon }) => (
        <div
          key={key}
          className='grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 py-2'
        >
          <dt className='flex items-center gap-3 text-sm text-neutral-300'>
            <Icon className='size-5 shrink-0 text-neutral-400' aria-hidden />
            {label}
          </dt>
          <dd className='truncate text-right font-semibold text-white'>
            {value}
          </dd>
          {/* One line across both columns, so a long label there doesn't
              widen the first. It gives way to the value. */}
          {detail && (
            <dd className='col-span-2 flex justify-between gap-3 pl-8 text-sm text-neutral-400'>
              <span className='truncate'>{detail.label}</span>
              {detail.value && (
                <span className='shrink-0 whitespace-nowrap'>
                  {detail.value}
                </span>
              )}
            </dd>
          )}
        </div>
      ))}
    </dl>
  )
}
