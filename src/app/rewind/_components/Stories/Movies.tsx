import MediaItems from '@/components/MediaItem/MediaItems'
import { RewindStory } from '@/types/rewind'
import { getServerName } from '@/utils/mediaServerName'
import { FilmIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import CountUp from '../CountUp'
import { isFavorite } from '../favorite'
import PlaytimeShare from '../PlaytimeShare'
import PreviousFavorite from '../PreviousFavorite'
import RewindCat from '../RewindCat'
import RewindStat from '../RewindStat'

export default function StoryMovies({ userRewind, settings }: RewindStory) {
  const t = useTranslations('Rewind.Movies')
  const top = userRewind.movies.top[0]
  const isOnly = userRewind.movies.top.length === 1
  // Without a rewatch, it's only the one with the most watch time
  const isTopFavorite = isFavorite(top)

  return (
    <>
      {userRewind.movies.duration ? (
        <>
          <RewindStat>
            <p>
              {t.rich('duration', {
                durationValue: userRewind.movies.duration,
                duration: (chunks) => (
                  <span className='rewind-stat'>{chunks}</span>
                ),
                movies: (chunks) => (
                  <RewindCat icon={<FilmIcon />}>{chunks}</RewindCat>
                ),
              })}
            </p>
          </RewindStat>

          <PlaytimeShare percentage={userRewind.movies.percentage} step={1} />

          {/* The watch time can be from plays that don't count */}
          {userRewind.movies.count > 0 && (
            <RewindStat step={2}>
              <p>
                {t.rich('count', {
                  countValue: userRewind.movies.count,
                  count: (chunks) => (
                    <span className='rewind-stat'>
                      <CountUp value={userRewind.movies.count}>
                        {chunks}
                      </CountUp>
                    </span>
                  ),
                  movies: (chunks) => (
                    <span className='rewind-cat'>{chunks}</span>
                  ),
                })}
              </p>
            </RewindStat>
          )}

          <RewindStat step={3} noScale>
            <p className='mb-2'>
              {t(isOnly ? 'only' : isTopFavorite ? 'favorite' : 'mostTime')}{' '}
              <span className='rewind-cat'>{top.title}</span>
            </p>

            <div className='text-base leading-normal font-normal tracking-normal'>
              <MediaItems
                type='movie'
                items={[top]}
                mediaServer={userRewind.media_server}
                rows
                settings={settings}
              />
            </div>
          </RewindStat>

          {/* Last time's favourite would follow on from this one */}
          {isTopFavorite && (
            <PreviousFavorite
              yearOverYear={userRewind.yearOverYear}
              type='movies'
              step={4}
            />
          )}
        </>
      ) : (
        <RewindStat noScale>
          <p>
            {t.rich('noData', {
              movies: (chunks) => (
                <RewindCat icon={<FilmIcon />}>{chunks}</RewindCat>
              ),
              serverName: getServerName(settings),
              emoji: (chunks) => <span className='not-italic'>{chunks}</span>,
            })}
          </p>
        </RewindStat>
      )}
    </>
  )
}
