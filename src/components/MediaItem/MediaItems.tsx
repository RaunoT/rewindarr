import { PublicSettings } from '@/types/settings'
import { MediaServer } from '@/types/statsSource'
import { TautulliItemRow } from '@/types/tautulli'
import clsx from 'clsx'
import { AnimatePresence } from 'motion/react'
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
  // In a countdown, the index of the highest place shown. Only the places
  // from it down are listed, so each new one comes in at the top.
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
  const isCountdown = shownFrom !== undefined
  const rowsList = items.map((itemData, i) =>
    isCountdown && i < shownFrom ? null : (
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
        isCountdown={isCountdown}
      />
    ),
  )

  return (
    <ul
      className={clsx(
        'flex flex-col overflow-hidden text-white',
        rows && 'mt-4 sm:mt-5',
      )}
    >
      {isCountdown ? <AnimatePresence>{rowsList}</AnimatePresence> : rowsList}
    </ul>
  )
}
