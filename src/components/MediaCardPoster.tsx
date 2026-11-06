import PosterImage from '@/components/PosterImage'
import ProgressBar from '@/components/ProgressBar'
import { formatPercent } from '@/utils/formatting'
import clsx from 'clsx'
import { useLocale } from 'next-intl'
import { ReactNode } from 'react'

type Props = {
  // Tried in turn, so TMDB's can stand in for one the source can't serve
  srcs: (string | null | undefined)[]
  type: string
  alt: string
  isLoading?: boolean
  priority?: boolean
  // How far a play got, from 0 to 100. Phones show it under the poster, where
  // wider cards have it among the stats.
  progress?: number | null
  // Over the poster, such as a stream's pause
  children?: ReactNode
}

// As big as the dashboard's. The card makes it a link to the item in the media
// server or its request.
export default function MediaCardPoster({
  srcs,
  type,
  alt,
  isLoading,
  priority,
  progress,
  children,
}: Props) {
  const locale = useLocale()
  const poster = (
    <div className={clsx('poster max-sm:w-12', { skeleton: isLoading })}>
      {!isLoading && (
        <>
          <PosterImage
            srcs={srcs}
            type={type}
            alt={alt}
            sizes='10rem'
            priority={priority}
          />
          {children}
        </>
      )}
    </div>
  )

  if (progress == null) {
    return poster
  }

  return (
    <div className='flex shrink-0 flex-col gap-1.5'>
      {poster}
      <div className='flex flex-col items-center gap-1 text-xs text-neutral-400 tabular-nums sm:hidden'>
        <ProgressBar value={progress / 100} className='h-1! w-full' />
        {formatPercent(progress, locale)}
      </div>
    </div>
  )
}
