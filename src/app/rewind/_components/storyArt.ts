import { UserRewind } from '@/types/rewind'
import { TautulliItemRow } from '@/types/tautulli'
import { getImageProxyUrl } from '@/utils/imageProxy'
import { uniq } from 'lodash'

function toLinear(channel: number) {
  const value = channel / 255

  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

// WCAG's relative luminance of an sRGB colour, its channels from 0 to 255
export function getLuminance(red: number, green: number, blue: number) {
  return (
    0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue)
  )
}

// The brightest the art may get: the dimmest text over it, the playtime
// share's neutral-400, keeps WCAG AA's contrast of 4.5:1
const MAX_ART_LUMINANCE = (getLuminance(161, 161, 161) + 0.05) / 4.5 - 0.05

function getBrightest(pixels: ArrayLike<number>, scale: number) {
  let brightest = 0

  for (let i = 0; i < pixels.length; i += 4) {
    brightest = Math.max(
      brightest,
      getLuminance(
        pixels[i] * scale,
        pixels[i + 1] * scale,
        pixels[i + 2] * scale,
      ),
    )
  }

  return brightest
}

// How much black, from 0 to 1, goes over art with these RGBA pixels, so its
// brightest pixel keeps the text readable. Blurring only averages pixels, so
// the blurred art is no brighter. Dark art is dimmed less, or not at all.
export function getArtDimming(pixels: ArrayLike<number>): number {
  if (getBrightest(pixels, 1) <= MAX_ART_LUMINANCE) {
    return 0
  }

  // The brightest scale that stays under the limit, to well within a percent
  let low = 0
  let high = 1

  for (let i = 0; i < 12; i++) {
    const middle = (low + high) / 2

    if (getBrightest(pixels, middle) <= MAX_ART_LUMINANCE) {
      low = middle
    } else {
      high = middle
    }
  }

  return 1 - low
}

// For when the art can't be measured
export const WHITE_ART_DIMMING = getArtDimming([255, 255, 255, 255])

type Size = {
  width: number
  height: number
}

// The part of the art a card shows, in the art's own pixels. The art covers
// the card from the middle, scaled up by `scale`, and its blur reaches three
// times its radius into the part that's cut off.
export function getVisibleArea(
  art: Size,
  card: Size,
  scale: number,
  blur: number,
) {
  const cover = Math.max(card.width / art.width, card.height / art.height)
  const reach = blur * 3
  const width = Math.min(art.width, (card.width / scale + reach * 2) / cover)
  const height = Math.min(art.height, (card.height / scale + reach * 2) / cover)

  return {
    x: (art.width - width) / 2,
    y: (art.height - height) / 2,
    width,
    height,
  }
}

function getPoster(item: TautulliItemRow) {
  if (!item.thumb) {
    return undefined
  }

  return item.thumb.startsWith('https://image.tmdb.org')
    ? item.thumb
    : getImageProxyUrl(item.thumb)
}

// The artist of the music story's top track, when they're among the top
// artists, or the top artist
function getMusicTitle({ audio }: UserRewind) {
  const artist = audio.topTrack?.artist

  return audio.top.find(({ title }) => title === artist) ?? audio.top[0]
}

function getStoryTitle(
  id: string,
  userRewind: UserRewind,
): TautulliItemRow | null | undefined {
  const { titleMoments, moments, social, firstPlay } = userRewind

  switch (id) {
    case 'shows':
      return userRewind.shows.top[0]
    case 'movies':
      return userRewind.movies.top[0]
    case 'audio':
      return getMusicTitle(userRewind)
    case 'comfort_watch':
      return titleMoments.comfortWatch?.item
    case 'time_travel':
      return titleMoments.timeTravel?.oldest.item
    case 'discoveries':
      return titleMoments.discoveries?.top.item
    case 'binge':
      return moments.binge?.item
    case 'only_you':
      return social.onlyYou?.item.data
    case 'requests_reach':
      return social.requestsReach?.item.data
    // The movie comes first in the story
    case 'server_year':
      return (social.serverYear?.movie ?? social.serverYear?.show)?.data
    case 'first_play':
      return firstPlay?.item?.data
    default:
      return null
  }
}

// The art behind a story about one title, tried in turn: TMDB's backdrop,
// then the posters. Empty for the stories that aren't about one.
export function getStoryArt(id: string, userRewind: UserRewind): string[] {
  const item = getStoryTitle(id, userRewind)

  if (!item) {
    return []
  }

  return uniq(
    [item.tmdb_backdrop, getPoster(item), item.tmdb_poster].filter(
      (src): src is string => !!src,
    ),
  )
}
