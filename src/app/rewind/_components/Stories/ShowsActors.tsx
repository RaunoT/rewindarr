import { RewindStory } from '@/types/rewind'
import { UserIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import RewindCat from '../RewindCat'
import RewindStat from '../RewindStat'
import TopPeople from '../TopPeople'
import useCountdown from '../useCountdown'

export default function StoryShowsActors({ userRewind }: RewindStory) {
  const t = useTranslations('Rewind.Common')
  const actors = userRewind.people.showActors
  const shownFrom = useCountdown(actors.length)

  return (
    <RewindStat noScale>
      <p className='mb-2'>
        {t.rich('topShowActors', {
          top: (chunks) => <RewindCat icon={<UserIcon />}>{chunks}</RewindCat>,
          count: actors.length,
        })}
      </p>

      <div className='text-base leading-normal font-normal tracking-normal'>
        <TopPeople people={actors} type='show' shownFrom={shownFrom} />
      </div>
    </RewindStat>
  )
}
