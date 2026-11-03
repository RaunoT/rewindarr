import PosterImage from '@/components/PosterImage'

type Props = {
  // Tried in turn, so TMDB's can stand in for one the source can't serve
  srcs: (string | null | undefined)[]
  type: string
  alt: string
  // The same as the title's, when it has one
  href?: string | null
}

// The poster and the title link to the same place, so hovering either lights
// up both. Goes with `group/item` on the row.
export const ITEM_LINK_CLASS_NAME =
  'transition-opacity group-has-[[data-item-link]:hover]/item:opacity-80'

// As big as the dashboard's. The title next to it links to the same place, so
// the poster's link stays out of the tab order and away from screen readers.
export default function HistoryPoster({ srcs, type, alt, href }: Props) {
  const image = <PosterImage srcs={srcs} type={type} alt={alt} sizes='10rem' />

  if (!href) {
    return <div className='poster max-sm:w-12'>{image}</div>
  }

  return (
    <a
      href={href}
      target='_blank'
      rel='noopener noreferrer'
      className={`poster block max-sm:w-12 ${ITEM_LINK_CLASS_NAME}`}
      data-item-link
      tabIndex={-1}
      aria-hidden='true'
    >
      {image}
    </a>
  )
}
