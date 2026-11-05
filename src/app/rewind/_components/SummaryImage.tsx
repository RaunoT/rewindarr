import AppIcon from '@/components/AppIcon'
import Avatar from '@/components/Avatar'
import PosterImage from '@/components/PosterImage'
import { APP_NAME } from '@/utils/constants'
import clsx from 'clsx'
import { Ref } from 'react'
import SummaryStatList from './SummaryStatList'
import { RewindSummary } from './useRewindSummary'

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
// before it's drawn. Edges are borders and there are no shadows, as Safari
// draws no rings and breaks shadows in the saved image.
export default function SummaryImage({ summary, ref }: Props) {
  const { tops, personality } = summary

  return (
    <div
      ref={ref}
      className='flex h-160 w-90 flex-col justify-between bg-neutral-950 p-6 text-left text-base leading-normal font-normal tracking-normal text-white'
      style={{ backgroundImage: BACKGROUND }}
    >
      <div className='flex items-center gap-3.5'>
        {/* As tall as the lines beside it, as in the story */}
        <div
          className={clsx(
            'relative shrink-0 overflow-hidden rounded-full border-2 border-white/20',
            personality ? 'size-18.5' : 'size-12.5',
          )}
        >
          <Avatar
            src={summary.image}
            name={summary.name}
            sizes='12rem'
            priority
          />
        </div>
        {/* As wide as it can be, as the image keeps each box's width, and a
            name that fits it exactly could wrap once drawn */}
        <div className='min-w-0 flex-1'>
          <p className='truncate text-[0.8125rem] font-medium text-neutral-400'>
            {summary.title}
          </p>
          <p className='line-clamp-2 text-2xl leading-tight font-semibold [overflow-wrap:anywhere]'>
            {summary.name}
          </p>
          {personality && (
            <p className='text-plex mt-1 flex items-center gap-1.5 text-sm font-semibold'>
              <personality.Icon className='size-4 shrink-0' />
              <span className='truncate'>{personality.name}</span>
            </p>
          )}
        </div>
      </div>

      {tops.length > 0 && (
        <ul className='flex justify-center gap-3'>
          {tops.map(({ type, label, item, srcs }) => (
            <li key={type} className={tops.length > 2 ? 'w-24' : 'w-28'}>
              <div className='relative aspect-2/3 overflow-hidden rounded-md'>
                <PosterImage srcs={srcs} type={type} sizes='18rem' priority />
              </div>
              <p className='mt-2 truncate text-xs text-neutral-400'>{label}</p>
              <p className='truncate text-sm font-medium'>{item.title}</p>
            </li>
          ))}
        </ul>
      )}

      <SummaryStatList
        stats={summary.stats}
        className='rounded-2xl border border-white/10 bg-white/6'
      />

      <p className='flex items-center justify-center gap-1.5 text-xs font-semibold text-neutral-400'>
        <AppIcon className='size-4' priority />
        {APP_NAME}
      </p>
    </div>
  )
}
