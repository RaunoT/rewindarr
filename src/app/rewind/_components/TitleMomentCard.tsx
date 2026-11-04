import MediaItems from '@/components/MediaItem/MediaItems'
import { PublicSettings } from '@/types/settings'
import { MediaServer } from '@/types/statsSource'
import { TitleCard } from '@/types/titleMoments'
import { RATING_STATISTICS } from '@/utils/constants'

type Props = {
  card: TitleCard
  mediaServer: MediaServer | null
  settings: PublicSettings
  // Left out when the story names a year of its own
  isYearShown?: boolean
}

// A title a story is about, with its year and ratings. Its watch time and
// plays would only count the play the card was made from.
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
          (stat) =>
            (isYearShown && stat === 'year') ||
            (RATING_STATISTICS as readonly string[]).includes(stat),
        )}
      />
    </div>
  )
}
