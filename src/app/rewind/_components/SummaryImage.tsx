import AppIcon from '@/components/AppIcon'
import Avatar from '@/components/Avatar'
import PosterImage from '@/components/PosterImage'
import { APP_NAME } from '@/utils/constants'
import clsx from 'clsx'
import { Ref } from 'react'
import { RewindSummary, SummaryStat } from './useRewindSummary'

type Props = {
  summary: RewindSummary
  ref?: Ref<HTMLDivElement>
}

// Plex gold glowing in from the corners, like the stories' highlights
const BACKGROUND = [
  'radial-gradient(130% 55% at 0% 0%, rgb(229 160 13 / 30%), transparent 70%)',
  'radial-gradient(110% 45% at 100% 100%, rgb(229 160 13 / 16%), transparent 70%)',
  'linear-gradient(to bottom, #1a1a1a, #070707)',
].join(', ')

// The summary as a phone-shaped image: 360 × 640 here, three times that once
// saved. Its pictures load right away, so one that's missing has fallen back
// before it's drawn.
export default function SummaryImage({ summary, ref }: Props) {
  const { tops, stats, personality } = summary
  const [total, ...highlights] = stats

  return (
    <div
      ref={ref}
      className='flex h-160 w-90 flex-col justify-between bg-neutral-950 p-6 text-left text-base leading-normal font-normal tracking-normal text-white'
      style={{ backgroundImage: BACKGROUND }}
    >
      <div>
        <p className='text-plex truncate text-xs font-semibold tracking-[0.2em] uppercase'>
          {summary.title}
        </p>
        <div className='mt-4 flex items-center gap-3.5'>
          <div className='relative size-14 shrink-0 overflow-hidden rounded-full ring-2 ring-white/20'>
            <Avatar
              src={summary.image}
              name={summary.name}
              sizes='12rem'
              priority
            />
          </div>
          <div className='min-w-0'>
            <p className='line-clamp-2 text-[1.625rem] leading-tight font-bold [overflow-wrap:anywhere]'>
              {summary.name}
            </p>
            <p className='mt-0.5 text-sm text-neutral-400'>{summary.period}</p>
          </div>
        </div>
      </div>

      {tops.length > 0 && (
        <ul className='flex justify-center gap-3'>
          {tops.map(({ type, label, item, srcs }) => (
            <li key={type} className={tops.length > 2 ? 'w-21' : 'w-26'}>
              <div className='relative aspect-2/3 overflow-hidden rounded-lg shadow-lg ring-1 shadow-black/50 ring-white/15'>
                <PosterImage srcs={srcs} type={type} sizes='18rem' priority />
              </div>
              <p className='text-plex mt-2 text-[0.625rem] leading-tight font-semibold tracking-[0.14em] uppercase'>
                {label}
              </p>
              <p className='mt-0.5 truncate text-[0.8125rem] font-medium'>
                {item.title}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className='grid grid-cols-2 gap-2'>
        {/* The time can be long, so it gets a row of its own */}
        <SummaryImageStat stat={total} isWide />
        {highlights.map((stat, index) => (
          <SummaryImageStat
            key={stat.key}
            stat={stat}
            // An odd one out at the end fills its row
            isWide={index === highlights.length - 1 && index % 2 === 0}
          />
        ))}
        {personality && (
          <div className='col-span-2 flex items-center gap-3 rounded-xl bg-white/6 px-3.5 py-2 ring-1 ring-white/10 ring-inset'>
            <span className='bg-plex/15 text-plex ring-plex/30 flex size-9 shrink-0 items-center justify-center rounded-full ring-1'>
              <personality.Icon className='size-5' />
            </span>
            <dl className='min-w-0'>
              <dt className='text-[0.625rem] leading-tight font-semibold tracking-[0.14em] text-neutral-400 uppercase'>
                {personality.label}
              </dt>
              <dd className='text-plex mt-0.5 text-lg leading-tight font-bold'>
                {personality.name}
              </dd>
            </dl>
          </div>
        )}
      </div>

      <p className='flex items-center justify-center gap-1.5 text-xs font-semibold text-neutral-400'>
        <AppIcon className='size-4' priority />
        {APP_NAME}
      </p>
    </div>
  )
}

type StatProps = {
  stat: SummaryStat
  isWide?: boolean
}

function SummaryImageStat({ stat, isWide }: StatProps) {
  const { label, value, detail } = stat

  return (
    <dl
      className={clsx(
        'min-w-0 rounded-xl bg-white/6 px-3.5 py-2 ring-1 ring-white/10 ring-inset',
        isWide && 'col-span-2',
      )}
    >
      <dt className='text-[0.625rem] leading-tight font-semibold tracking-[0.14em] text-neutral-400 uppercase'>
        {label}
      </dt>
      <dd className='mt-0.5 truncate text-lg leading-tight font-bold'>
        {value}
      </dd>
      {detail && (
        <dd className='truncate text-xs text-neutral-400'>{detail}</dd>
      )}
    </dl>
  )
}
