'use client'

import MediaCard from '@/components/MediaCard'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { ComponentProps, ReactNode, useId, useState } from 'react'

type Props = Omit<ComponentProps<typeof MediaCard>, 'footer'> & {
  // What the button says, such as how many episodes, with an icon before it
  count: ReactNode
  // Each of the binge's plays, under the card once it's opened
  plays: ReactNode
}

// A binge's card, its button among the stats opening its plays, the way an
// activity card's opens the stream's details
export default function HistoryBingeCard({
  count,
  plays,
  stats,
  ...card
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const playsId = useId()

  return (
    <MediaCard
      {...card}
      stats={
        <>
          {stats}
          {/* Taps 10px above and below count too, for a 40px tap area */}
          <li>
            <button
              type='button'
              className='icon-stat-wrapper focus-visible:focus-ring relative cursor-pointer pr-2 transition-colors after:absolute after:inset-x-0 after:-inset-y-2.5 hover:bg-white/10'
              aria-expanded={isExpanded}
              aria-controls={playsId}
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {count}
              <ChevronDownIcon
                className={clsx(
                  'transition-transform',
                  isExpanded && 'rotate-180',
                )}
              />
            </button>
          </li>
        </>
      }
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
