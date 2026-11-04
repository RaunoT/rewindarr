import { RewindStory } from '@/types/rewind'
import { TagIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import RewindCat from '../RewindCat'
import RewindStat from '../RewindStat'
import TopGenres from '../TopGenres'

export default function StoryShowsGenres({ userRewind }: RewindStory) {
  const t = useTranslations('Rewind.Common')
  const genres = userRewind.genres.shows

  return (
    <RewindStat noScale>
      <p>
        {t.rich('topShowGenres', {
          top: (chunks) => <RewindCat icon={<TagIcon />}>{chunks}</RewindCat>,
          count: genres.length,
        })}
      </p>

      <TopGenres genres={genres} />
    </RewindStat>
  )
}
