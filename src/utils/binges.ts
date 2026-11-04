import { HistoryPlay } from '@/types/statsSource'
import { toDateKey } from './dateKeys'

// The show of an episode or the artist of a track, which a binge stays on.
// Without either, there's no telling what it belongs to, so it's on its own.
function getBingeKey(play: HistoryPlay): string | null {
  if (play.mediaType !== 'episode' && play.mediaType !== 'track') {
    return null
  }

  const parent =
    play.grandparentRatingKey ||
    (play.mediaType === 'episode' ? play.showTitle : play.artistName)

  return parent
    ? [play.mediaType, play.userId || play.identityId, parent].join('|')
    : null
}

// Whether a play belongs in the same binge as another: an episode of the same
// show, or a track by the same artist, that the same user played on the same
// day. The day is the server's without a time zone.
export function isSameBinge(
  play: HistoryPlay,
  other: HistoryPlay,
  timeZone?: string,
): boolean {
  const key = getBingeKey(play)

  return (
    key !== null &&
    key === getBingeKey(other) &&
    toDateKey(play.startedAt, timeZone) === toDateKey(other.startedAt, timeZone)
  )
}
