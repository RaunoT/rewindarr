import { PublicSettings } from '@/types/settings'
import { MediaServer } from '@/types/statsSource'
import { TautulliItemRow } from '@/types/tautulli'
import clsx from 'clsx'
import MediaItem from './MediaItem'

type Props = {
  items: TautulliItemRow[]
  type: 'movie' | 'show' | 'artist' | 'users'
  mediaServer: MediaServer | null
  rows?: boolean
  settings: PublicSettings
  loggedInUserId?: string
  isRanked?: boolean
  // In place of the item statistics chosen in the settings
  activeStats?: string[]
  // In a countdown, the index of the highest place shown. The places above it
  // keep their room, unseen and unheard, until it reaches them.
  shownFrom?: number
}

export default function MediaItems({
  items,
  type,
  mediaServer,
  rows,
  settings,
  loggedInUserId,
  isRanked,
  activeStats = settings.general.activeItemStatistics,
  shownFrom,
}: Props) {
  return (
    <ul
      className={clsx(
        'flex flex-col overflow-hidden text-white',
        rows && 'mt-4 sm:mt-5',
      )}
    >
      {items.map((itemData, i) => (
        <MediaItem
          data={itemData}
          i={i}
          key={i}
          type={type}
          mediaServer={mediaServer}
          activeStats={activeStats}
          settings={settings}
          loggedInUserId={loggedInUserId}
          isRanked={isRanked}
          isHidden={shownFrom === undefined ? undefined : i < shownFrom}
        />
      ))}
    </ul>
  )
}
