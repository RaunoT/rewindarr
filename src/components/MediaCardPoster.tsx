import PosterImage from '@/components/PosterImage'
import clsx from 'clsx'
import { ReactNode } from 'react'

type Props = {
  // Tried in turn, so TMDB's can stand in for one the source can't serve
  srcs: (string | null | undefined)[]
  type: string
  alt: string
  isLoading?: boolean
  priority?: boolean
  // Over the poster, such as a stream's pause
  children?: ReactNode
}

// As big as the dashboard's. The buttons beside the title open it elsewhere,
// so the poster isn't a link.
export default function MediaCardPoster({
  srcs,
  type,
  alt,
  isLoading,
  priority,
  children,
}: Props) {
  return (
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
}
