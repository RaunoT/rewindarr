import MediaItems from '@/components/MediaItem/MediaItems'
import { RewindStory } from '@/types/rewind'
import { getMediaServerName } from '@/utils/mediaServerName'
import { FingerPrintIcon } from '@heroicons/react/24/outline'
import { useFormatter, useTranslations } from 'next-intl'
import RewindStat from '../RewindStat'

export default function StoryOnlyYou({ userRewind, settings }: RewindStory) {
  const t = useTranslations('Rewind.OnlyYou')
  const format = useFormatter()
  const { onlyYou } = userRewind.social

  if (!onlyYou) {
    return null
  }

  // "0%" would read as if there were none
  const hasShare = Math.round(onlyYou.share * 100) > 0

  return (
    <>
      <RewindStat>
        <p>
          {t.rich('count', {
            countValue: onlyYou.count,
            count: (chunks) => <span className='rewind-stat'>{chunks}</span>,
            only: (chunks) => (
              <span className='rewind-cat'>
                {chunks}
                <FingerPrintIcon />
              </span>
            ),
          })}
        </p>
      </RewindStat>

      <RewindStat step={1}>
        <p>
          {t.rich(hasShare ? 'nobodyElseShare' : 'nobodyElse', {
            countValue: onlyYou.count,
            serverName:
              settings.general.serverName ||
              getMediaServerName(settings.connection.mediaServerType),
            plex: (chunks) => chunks,
            shareValue: format.number(onlyYou.share, { style: 'percent' }),
            share: (chunks) => <span className='rewind-stat'>{chunks}</span>,
          })}
        </p>
      </RewindStat>

      <RewindStat step={2} noScale>
        <p className='mb-2'>
          {t.rich('top', {
            countValue: onlyYou.count,
            titleValue: onlyYou.item.data.title,
            title: (chunks) => <span className='rewind-cat'>{chunks}</span>,
          })}
        </p>

        <div className='text-base leading-normal font-normal tracking-normal'>
          <MediaItems
            type={onlyYou.item.type}
            items={[onlyYou.item.data]}
            mediaServer={userRewind.media_server}
            rows
            settings={settings}
            isRanked={false}
            // Only the user watched it, so its people would only say 1
            activeStats={settings.general.activeItemStatistics.filter(
              (stat) => stat !== 'users',
            )}
          />
        </div>
      </RewindStat>
    </>
  )
}
