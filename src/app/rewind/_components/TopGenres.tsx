'use client'

import { TopGenre } from '@/types/statsSource'
import ShareBar from './ShareBar'

type Props = {
  genres: TopGenre[]
}

// Each genre's share of the user's time on the type, like the breakdown of the
// total time. Only the top genre is in gold, so it stands out from the rest
export default function TopGenres({ genres }: Props) {
  return (
    <ol className='mt-4 space-y-4 text-xl not-italic sm:text-2xl'>
      {genres.map((genre, i) => {
        const isTop = i === 0

        return (
          <li key={genre.name}>
            <div className='mb-2 flex'>
              <span className={isTop ? 'rewind-cat' : 'font-semibold'}>
                {genre.name}
              </span>
            </div>
            <ShareBar
              share={genre.share}
              delay={i * 0.15}
              variant={isTop ? 'user' : 'muted'}
            />
          </li>
        )
      })}
    </ol>
  )
}
