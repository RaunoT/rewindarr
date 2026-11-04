import { MEDIA_ICONS } from '@/components/icons'
import MediaItems from '@/components/MediaItem/MediaItems'
import { RewindStory } from '@/types/rewind'
import { useTranslations } from 'next-intl'
import RewindCat from '../RewindCat'
import RewindStat from '../RewindStat'
import useCountdown from '../useCountdown'

export default function StoryShowsTop({ userRewind, settings }: RewindStory) {
  const t = useTranslations('Rewind.Common')
  const shownFrom = useCountdown(userRewind.shows.top.length)

  return (
    <>
      <RewindStat noScale>
        <p className='mb-2'>
          {t.rich('topShows', {
            top: (chunks) => (
              <RewindCat icon={<MEDIA_ICONS.show />}>{chunks}</RewindCat>
            ),
            count: userRewind.shows.top.length,
          })}
        </p>

        <div className='text-base leading-normal font-normal tracking-normal'>
          <MediaItems
            type='show'
            items={userRewind.shows.top}
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
