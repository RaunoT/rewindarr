'use client'

import { MediaIcon } from '@/components/icons'
import MediaCard from '@/components/MediaCard'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { ComponentProps, ReactNode, useId, useState } from 'react'

type Props = Omit<ComponentProps<typeof MediaCard>, 'footer' | 'phoneAside'> & {
  // How many plays it has, such as "2 episodes"
  count: number
  countLabel: string
  // Each of the binge's plays, under the card once it's opened
  plays: ReactNode
}

// A binge's card, its button opening its plays the way an activity card's
// opens the stream's details: among the stats, and on phones at the end of the
// name's line with just the number
export default function HistoryBingeCard({
  count,
  countLabel,
  plays,
  stats,
  ...card
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const playsId = useId()

  // Taps 10px above and below count too, for a 40px tap area. The narrow
  // button gets 10px more on the sides too.
  function toggle(isCompact: boolean) {
    return (
      <button
        type='button'
        className={clsx(
          'icon-stat-wrapper focus-visible:focus-ring relative cursor-pointer pr-2 transition-colors after:absolute after:-inset-y-2.5 hover:bg-white/10',
          // Out of the stats, the compact one takes their text size itself
          isCompact ? 'text-xs after:-inset-x-2.5' : 'after:inset-x-0',
        )}
        aria-expanded={isExpanded}
        aria-controls={playsId}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <MediaIcon type={card.mediaType} aria-hidden='true' />
        {isCompact ? (
          <>
            <span aria-hidden='true'>{count}</span>
            <span className='sr-only'>{countLabel}</span>
          </>
        ) : (
          countLabel
        )}
        <ChevronDownIcon
          className={clsx('transition-transform', isExpanded && 'rotate-180')}
          aria-hidden='true'
        />
      </button>
    )
  }

  return (
    <MediaCard
      {...card}
      stats={
        <>
          {stats}
          <li className='max-sm:hidden'>{toggle(false)}</li>
        </>
      }
      phoneAside={toggle(true)}
      footer={
        isExpanded && (
          <div
            id={playsId}
            className='rounded-2xl bg-black/25 p-3 text-sm ring-1 ring-white/10 ring-inset sm:p-4'
          >
            {plays}
          </div>
        )
      }
    />
  )
}
