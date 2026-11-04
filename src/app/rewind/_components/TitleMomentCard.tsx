import MediaItems from '@/components/MediaItem/MediaItems'
import { PublicSettings } from '@/types/settings'
import { MediaServer } from '@/types/statsSource'
import { TitleCard } from '@/types/titleMoments'

type Props = {
  card: TitleCard
  mediaServer: MediaServer | null
  settings: PublicSettings
  // Left out when the story names a year of its own
  isYearShown?: boolean
}

// A title a story is about, with the user's watch time and plays of it in the
// period
export default function TitleMomentCard({
  card,
  mediaServer,
  settings,
  isYearShown = true,
}: Props) {
  return (
    <div className='text-base leading-normal font-normal tracking-normal'>
      <MediaItems
        type={card.type}
        items={[card.item]}
        mediaServer={mediaServer}
        rows
        settings={settings}
        isRanked={false}
        activeStats={settings.general.activeItemStatistics.filter(
          (stat) => isYearShown || stat !== 'year',
        )}
      />
    </div>
  )
}
