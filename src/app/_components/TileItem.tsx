import PosterImage from '@/components/PosterImage'
import SkeletonLine from '@/components/SkeletonLine'
import clsx from 'clsx'
import { ReactNode } from 'react'
import TileGlow from './TileGlow'

// How many items each home tile lists
export const TILE_ITEM_COUNT = 3

type Props = {
  // Tried in turn, so TMDB's can stand in for one the source can't serve
  posters: (string | null | undefined)[]
  type: string
  isPosterLoading?: boolean
  title: string
  // Small above the title, such as an episode's numbers or a track's title,
  // like a media card's on phones
  detail?: string | null
  // Before the poster, such as when it was played
  lead?: ReactNode
  // After the title, such as who played it
  aside?: ReactNode
  // Over the poster, such as a paused stream's icon
  posterOverlay?: ReactNode
  // The poster also lights up the tile, for the first row
  hasGlow?: boolean
}

// A home tile's row, with a poster about as tall as two lines of text
export default function TileItem({
  posters,
  type,
  isPosterLoading,
  title,
  detail,
  lead,
  aside,
  posterOverlay,
  hasGlow,
}: Props) {
  return (
    <li className='group/tile-item flex min-w-0 items-center gap-3'>
      {hasGlow && !isPosterLoading && <TileGlow srcs={posters} />}
      {lead}
      <div
        className={clsx(
          'poster w-7 rounded-sm!',
          isPosterLoading && 'skeleton',
        )}
      >
        {!isPosterLoading && (
          <>
            <PosterImage srcs={posters} type={type} sizes='3rem' />
            {posterOverlay}
          </>
        )}
      </div>
      <span className='flex min-w-0 flex-1 flex-col'>
        <span className='truncate'>{title}</span>
        {detail && (
          <span className='order-first truncate text-xs text-neutral-400'>
            {detail}
          </span>
        )}
      </span>
      {aside}
    </li>
  )
}

// `lead` is a placeholder for what the loaded rows show before their poster,
// such as History's time, so nothing moves when they arrive
export function TileItemsSkeleton({ lead }: { lead?: ReactNode }) {
  return (
    <ul className='space-y-2 text-sm'>
      {[...Array(TILE_ITEM_COUNT)].map((_, i) => (
        <li key={i} className='flex items-center gap-3'>
          {lead}
          <div className='skeleton poster w-7 rounded-sm!' />
          <SkeletonLine width={i % 2 ? 'w-1/2' : 'w-2/3'} />
        </li>
      ))}
    </ul>
  )
}
