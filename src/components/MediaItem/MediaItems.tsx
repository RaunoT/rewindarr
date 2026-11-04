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
  // In a countdown, the index of the highest place shown. The places from it
  // down are listed first, so each new one comes in at the top, and the
  // places above it keep their room below them, unseen.
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
  function renderItem(
    itemData: TautulliItemRow,
    i: number,
    countdown?: 'reached' | 'placeholder',
  ) {
    return (
      <MediaItem
        data={itemData}
        i={i}
        key={countdown === 'placeholder' ? `placeholder-${i}` : i}
        type={type}
        mediaServer={mediaServer}
        activeStats={activeStats}
        settings={settings}
        loggedInUserId={loggedInUserId}
        isRanked={isRanked}
        countdown={countdown}
      />
    )
  }

  return (
    <ul
      className={clsx(
        'relative flex flex-col overflow-hidden text-white',
        rows && 'mt-4 sm:mt-5',
      )}
    >
      {shownFrom === undefined ? (
        items.map((itemData, i) => renderItem(itemData, i))
      ) : (
        <>
          {/* A place stepped back from leaves the flow at once, so its
              placeholder doesn't make the list taller while it fades */}
          <AnimatePresence mode='popLayout'>
            {items.map((itemData, i) =>
              i < shownFrom ? null : renderItem(itemData, i, 'reached'),
            )}
          </AnimatePresence>
          {items.map((itemData, i) =>
            i < shownFrom ? renderItem(itemData, i, 'placeholder') : null,
          )}
        </>
      )}
    </ul>
  )
}
