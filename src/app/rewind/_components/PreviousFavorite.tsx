import { YearOverYear } from '@/types/yearOverYear'
import { useTranslations } from 'next-intl'
import RewindStat from './RewindStat'

type Props = {
  yearOverYear: YearOverYear | null
  type: 'shows' | 'movies'
  step: number
}

const NAMESPACES = {
  shows: 'Rewind.Shows',
  movies: 'Rewind.Movies',
} as const

// Whether the favourite show or movie was the favourite in the earlier period
// too, after the story has shown it
export default function PreviousFavorite({ yearOverYear, type, step }: Props) {
  const t = useTranslations(NAMESPACES[type])
  const favorite = yearOverYear?.[type]

  if (!yearOverYear || !favorite) {
    return null
  }

  // Only the past year has a year before it
  const period = yearOverYear.isPastYear ? 'year' : 'custom'

  return (
    <RewindStat step={step}>
      <p>
        {favorite.isSame
          ? t.rich('sameFavorite', {
              period,
              before: (chunks) => <span className='rewind-cat'>{chunks}</span>,
            })
          : t.rich('previousFavorite', {
              period,
              titleValue: favorite.title,
              title: (chunks) => <span className='rewind-cat'>{chunks}</span>,
            })}
      </p>
    </RewindStat>
  )
}
