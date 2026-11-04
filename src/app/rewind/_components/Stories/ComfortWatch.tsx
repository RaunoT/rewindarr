import { RewindStory } from '@/types/rewind'
import { HeartIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import RewindCat from '../RewindCat'
import RewindStat from '../RewindStat'
import TitleMomentCard from '../TitleMomentCard'

export default function StoryComfortWatch({
  userRewind,
  settings,
}: RewindStory) {
  const t = useTranslations('Rewind.ComfortWatch')
  const { comfortWatch } = userRewind.titleMoments

  if (!comfortWatch) {
    return null
  }

  const { episode } = comfortWatch
  const isEpisode = episode !== null

  return (
    <>
      <RewindStat>
        <p>
          {t.rich(isEpisode ? 'episode' : 'movie', {
            comfort: (chunks) => (
              <RewindCat icon={<HeartIcon />}>{chunks}</RewindCat>
            ),
            countValue: comfortWatch.watches,
            count: (chunks) => <span className='rewind-stat'>{chunks}</span>,
          })}
        </p>
      </RewindStat>

      <RewindStat step={1} noScale>
        {/* The card is the show, so the episode is named above it. An episode
            without a title is left to the card. */}
        {episode && (
          <p className='mb-2'>
            {t.rich('episodeTitle', {
              titleValue: episode,
              title: (chunks) => <span className='rewind-cat'>{chunks}</span>,
              showValue: comfortWatch.item.title,
              show: (chunks) => <span className='rewind-cat'>{chunks}</span>,
            })}
          </p>
        )}

        <TitleMomentCard
          card={comfortWatch}
          mediaServer={userRewind.media_server}
          settings={settings}
        />
      </RewindStat>
    </>
  )
}
