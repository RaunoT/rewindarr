import { RewindStory } from '@/types/rewind'
import { VideoCameraIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import RewindStat from '../RewindStat'
import TopPeople from '../TopPeople'
import useCountdown from '../useCountdown'

export default function StoryMoviesDirectors({ userRewind }: RewindStory) {
  const t = useTranslations('Rewind.Common')
  const directors = userRewind.people.directors
  const shownFrom = useCountdown(directors.length)

  return (
    <RewindStat noScale>
      <p className='mb-2'>
        {t.rich('topDirectors', {
          top: (chunks) => (
            <span className='rewind-cat'>
              {chunks}
              <VideoCameraIcon />
            </span>
          ),
          count: directors.length,
        })}
      </p>

      <div className='text-base leading-normal font-normal tracking-normal'>
        <TopPeople people={directors} type='movie' shownFrom={shownFrom} />
      </div>
    </RewindStat>
  )
}
