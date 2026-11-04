import MediaItems from '@/components/MediaItem/MediaItems'
import { RewindStory } from '@/types/rewind'
import { FilmIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import RewindCat from '../RewindCat'
import RewindStat from '../RewindStat'
import useCountdown from '../useCountdown'

export default function StoryMoviesTop({ userRewind, settings }: RewindStory) {
  const t = useTranslations('Rewind.Common')
  const shownFrom = useCountdown(userRewind.movies.top.length)

  return (
    <>
      <RewindStat noScale>
        <p className='mb-2'>
          {t.rich('topMovies', {
            top: (chunks) => (
              <RewindCat icon={<FilmIcon />}>{chunks}</RewindCat>
            ),
            count: userRewind.movies.top.length,
          })}
        </p>

        <div className='text-base leading-normal font-normal tracking-normal'>
          <MediaItems
            type='movie'
            items={userRewind.movies.top}
            mediaServer={userRewind.media_server}
            rows
            settings={settings}
            shownFrom={shownFrom}
          />
        </div>
      </RewindStat>
    </>
  )
}
