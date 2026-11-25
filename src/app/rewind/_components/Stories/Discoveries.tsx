import { RewindStory } from '@/types/rewind'
import { BookmarkIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import RewindCat from '../RewindCat'
import RewindStat from '../RewindStat'
import { TITLE_STEPS } from '../storyMusic'
import TitleMomentCard from '../TitleMomentCard'

export default function StoryDiscoveries({
  userRewind,
  settings,
}: RewindStory) {
  const t = useTranslations('Rewind.Discoveries')
  const { discoveries, gaveUp } = userRewind.titleMoments

  return (
    <>
      {discoveries && (
        <>
          <RewindStat>
            <p>
              {t.rich(
                discoveries.shows && discoveries.artists
                  ? 'showsAndArtists'
                  : discoveries.shows
                    ? 'shows'
                    : 'artists',
                {
                  showsValue: discoveries.shows,
                  showsCount: (chunks) => (
                    <span className='rewind-stat'>{chunks}</span>
                  ),
                  shows: (chunks) => (
                    <span className='rewind-cat'>{chunks}</span>
                  ),
                  artistsValue: discoveries.artists,
                  artistsCount: (chunks) => (
                    <span className='rewind-stat'>{chunks}</span>
                  ),
                  artists: (chunks) => (
                    <span className='rewind-cat'>{chunks}</span>
                  ),
                },
              )}
            </p>
          </RewindStat>

          {/* A find the stories before have shown isn't shown again */}
          {discoveries.top && (
            <RewindStat step={TITLE_STEPS.discovery} noScale>
              <p className='mb-2'>
                {t.rich(
                  discoveries.after
                    ? 'after'
                    : discoveries.shows + discoveries.artists > 1
                      ? 'top'
                      : 'only',
                  {
                    headlineValue: discoveries.after ?? '',
                    headline: (chunks) => (
                      <span className='rewind-cat'>{chunks}</span>
                    ),
                    titleValue: discoveries.top.item.title,
                    title: (chunks) => (
                      <RewindCat icon={<SparklesIcon />}>{chunks}</RewindCat>
                    ),
                    durationValue: discoveries.top.duration,
                    duration: (chunks) => (
                      <span className='rewind-stat'>{chunks}</span>
                    ),
                  },
                )}
              </p>

              <TitleMomentCard
                card={discoveries.top}
                mediaServer={userRewind.media_server}
                settings={settings}
              />
            </RewindStat>
          )}
        </>
      )}

      {/* It can be all there is to tell, as the first statement */}
      {gaveUp && (
        <RewindStat step={discoveries ? (discoveries.top ? 2 : 1) : 0}>
          <p>
            {t.rich('gaveUp', {
              percentValue: gaveUp.percent,
              percent: (chunks) => (
                <span className='rewind-stat'>{chunks}</span>
              ),
              titleValue: gaveUp.title,
              title: (chunks) => (
                <RewindCat icon={<BookmarkIcon />}>{chunks}</RewindCat>
              ),
            })}
          </p>
        </RewindStat>
      )}
    </>
  )
}
