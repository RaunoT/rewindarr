import { MEDIA_ICONS } from '@/components/icons'
import MediaItems from '@/components/MediaItem/MediaItems'
import { RewindStory } from '@/types/rewind'
import { SocialItem } from '@/types/rewindSocial'
import { hasRewindPlays } from '@/utils/helpers'
import { getMediaServerName } from '@/utils/mediaServerName'
import { UsersIcon } from '@heroicons/react/24/outline'
import { useFormatter, useTranslations } from 'next-intl'
import RewindStat from '../RewindStat'

export default function StoryServerYear({ userRewind, settings }: RewindStory) {
  const t = useTranslations('Rewind.ServerYear')
  const format = useFormatter()
  const { serverYear } = userRewind.social

  if (!serverYear) {
    return null
  }

  const hasPlays = hasRewindPlays(userRewind)
  // "0%" would read as if the user played nothing. Without a play that counts,
  // the user's short plays would belie the lead-in.
  const hasShare = hasPlays && Math.round(serverYear.share * 100) > 0

  function renderItem(item: SocialItem) {
    return (
      <div className='text-base leading-normal font-normal tracking-normal'>
        <MediaItems
          type={item.type}
          items={[item.data]}
          mediaServer={userRewind.media_server}
          rows
          settings={settings}
          isRanked={false}
        />
      </div>
    )
  }

  return (
    <>
      <RewindStat>
        <p>
          {/* Leads in to everyone else's year for a user who played nothing */}
          {t.rich(hasPlays ? 'duration' : 'durationAway', {
            usersValue: serverYear.users,
            durationValue: serverYear.duration,
            serverName:
              settings.general.serverName ||
              getMediaServerName(settings.connection.mediaServerType),
            plex: (chunks) => chunks,
            users: (chunks) => (
              <span className='rewind-cat'>
                {chunks}
                <UsersIcon />
              </span>
            ),
            duration: (chunks) => <span className='rewind-stat'>{chunks}</span>,
          })}
        </p>
      </RewindStat>

      {hasShare && (
        <RewindStat step={1}>
          <p>
            {t.rich('share', {
              shareValue: format.number(serverYear.share, { style: 'percent' }),
              share: (chunks) => <span className='rewind-stat'>{chunks}</span>,
            })}
          </p>
        </RewindStat>
      )}

      {serverYear.movie && (
        <RewindStat step={2} noScale>
          <p className='mb-2'>
            {t.rich('movie', {
              titleValue: serverYear.movie.data.title,
              title: (chunks) => <span className='rewind-cat'>{chunks}</span>,
              movies: (chunks) => (
                <span className='rewind-cat'>
                  {chunks}
                  <MEDIA_ICONS.movie />
                </span>
              ),
            })}
          </p>

          {renderItem(serverYear.movie)}
        </RewindStat>
      )}

      {serverYear.show && (
        <RewindStat step={3} noScale>
          <p className='mb-2'>
            {t.rich('show', {
              titleValue: serverYear.show.data.title,
              title: (chunks) => <span className='rewind-cat'>{chunks}</span>,
              shows: (chunks) => (
                <span className='rewind-cat'>
                  {chunks}
                  <MEDIA_ICONS.show />
                </span>
              ),
            })}
          </p>

          {renderItem(serverYear.show)}
        </RewindStat>
      )}
    </>
  )
}
