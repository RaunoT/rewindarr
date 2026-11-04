import { UserRewind } from '@/types/rewind'
import { TautulliItemRow } from '@/types/tautulli'
import { describe, expect, it } from 'vitest'
import {
  getArtDimming,
  getLuminance,
  getStoryArt,
  getVisibleArea,
  WHITE_ART_DIMMING,
} from './storyArt'

const BACKDROP = 'https://image.tmdb.org/t/p/w300/backdrop.jpg'
const TMDB_POSTER = 'https://image.tmdb.org/t/p/w300//poster.jpg'

function item(overrides: Partial<TautulliItemRow> = {}): TautulliItemRow {
  return {
    title: 'Dark',
    thumb: '',
    tmdb_poster: null,
    tmdb_backdrop: null,
    ...overrides,
  } as TautulliItemRow
}

// Only what the art is picked from
function rewind(overrides: Record<string, unknown> = {}): UserRewind {
  return {
    shows: { top: [] },
    movies: { top: [] },
    audio: { top: [], topTrack: null },
    titleMoments: {
      comfortWatch: null,
      timeTravel: null,
      discoveries: null,
      gaveUp: null,
    },
    moments: { monthly: null, binge: null, biggestDay: null, streak: null },
    social: { onlyYou: null, requestsReach: null, serverYear: null },
    firstPlay: null,
    ...overrides,
  } as unknown as UserRewind
}

// The text over the art: the statements, the stats, the titles' details and
// the playtime share's grey
const TEXT_COLORS = [
  [245, 245, 245],
  [229, 160, 13],
  [212, 212, 212],
  [161, 161, 161],
]

function getContrast(foreground: number[], background: number[]) {
  const [lighter, darker] = [
    getLuminance(foreground[0], foreground[1], foreground[2]),
    getLuminance(background[0], background[1], background[2]),
  ].sort((a, b) => b - a)

  return (lighter + 0.05) / (darker + 0.05)
}

// RGBA pixels, all opaque
function pixels(...colors: number[][]) {
  return colors.flatMap((color) => [...color, 255])
}

// The lowest contrast of any text over any of the pixels, once dimmed
function getLowestContrast(colors: number[][]) {
  const scale = 1 - getArtDimming(pixels(...colors))

  return Math.min(
    ...colors.flatMap((color) => {
      const dimmed = color.map((channel) => channel * scale)

      return TEXT_COLORS.map((text) => getContrast(text, dimmed))
    }),
  )
}

describe('getStoryArt', () => {
  it("tries TMDB's backdrop, then the posters", () => {
    const top = item({
      thumb: '/library/metadata/1/thumb/2',
      tmdb_backdrop: BACKDROP,
      tmdb_poster: TMDB_POSTER,
    })
    const userRewind = rewind({ shows: { top: [top] } })

    expect(getStoryArt('shows', userRewind)).toEqual([
      BACKDROP,
      '/api/image?img=%2Flibrary%2Fmetadata%2F1%2Fthumb%2F2&width=300',
      TMDB_POSTER,
    ])
  })

  it('tries a poster from TMDB once, as it is', () => {
    const top = item({ thumb: TMDB_POSTER, tmdb_poster: TMDB_POSTER })
    const userRewind = rewind({ movies: { top: [top] } })

    expect(getStoryArt('movies', userRewind)).toEqual([TMDB_POSTER])
  })

  it('has none for a title without pictures', () => {
    const userRewind = rewind({ movies: { top: [item()] } })

    expect(getStoryArt('movies', userRewind)).toEqual([])
  })

  it("has none for a story that isn't about one title", () => {
    const top = item({ tmdb_backdrop: BACKDROP })
    const userRewind = rewind({ shows: { top: [top] } })

    for (const id of ['welcome', 'shows_top', 'shows_genres', 'goodbye']) {
      expect(getStoryArt(id, userRewind)).toEqual([])
    }
  })

  const title = item({ tmdb_backdrop: BACKDROP })

  it.each<[string, Record<string, unknown>]>([
    ['comfort_watch', { titleMoments: { comfortWatch: { item: title } } }],
    [
      'time_travel',
      { titleMoments: { timeTravel: { oldest: { item: title } } } },
    ],
    [
      'discoveries',
      { titleMoments: { discoveries: { top: { item: title } } } },
    ],
    ['binge', { moments: { binge: { item: title } } }],
    ['only_you', { social: { onlyYou: { item: { data: title } } } }],
    [
      'requests_reach',
      { social: { requestsReach: { item: { data: title } } } },
    ],
    ['first_play', { firstPlay: { item: { data: title } } }],
  ])('shows the title of the %s story', (id, overrides) => {
    expect(getStoryArt(id, rewind(overrides))).toEqual([BACKDROP])
  })

  it('shows the artist of the top track', () => {
    const royksopp = item({
      title: 'Röyksopp',
      thumb: '/library/metadata/1/thumb/1',
    })
    const robyn = item({ title: 'Robyn', thumb: '/library/metadata/2/thumb/1' })
    const userRewind = rewind({
      audio: {
        top: [royksopp, robyn],
        topTrack: { title: 'Dancing On My Own', artist: 'Robyn' },
      },
    })

    expect(getStoryArt('audio', userRewind)).toEqual([
      '/api/image?img=%2Flibrary%2Fmetadata%2F2%2Fthumb%2F1&width=300',
    ])
  })

  it("shows the top artist when the top track's isn't among them", () => {
    const royksopp = item({
      title: 'Röyksopp',
      thumb: '/library/metadata/1/thumb/1',
    })
    const userRewind = rewind({
      audio: {
        top: [royksopp],
        topTrack: { title: 'Hard To Get', artist: null },
      },
    })

    expect(getStoryArt('audio', userRewind)).toEqual([
      '/api/image?img=%2Flibrary%2Fmetadata%2F1%2Fthumb%2F1&width=300',
    ])
  })

  it("shows the server's top movie, or its top show without one", () => {
    const movie = { data: item({ tmdb_backdrop: BACKDROP }) }
    const show = { data: item({ tmdb_backdrop: `${BACKDROP}?show` }) }
    const withMovie = rewind({ social: { serverYear: { movie, show } } })
    const withoutMovie = rewind({
      social: { serverYear: { movie: null, show } },
    })

    expect(getStoryArt('server_year', withMovie)).toEqual([BACKDROP])
    expect(getStoryArt('server_year', withoutMovie)).toEqual([
      `${BACKDROP}?show`,
    ])
  })
})

describe('getLuminance', () => {
  it("matches WCAG's", () => {
    expect(getLuminance(255, 255, 255)).toBeCloseTo(1)
    expect(getLuminance(0, 0, 0)).toBe(0)
    expect(getLuminance(119, 119, 119)).toBeCloseTo(0.1845, 4)
  })
})

describe('getArtDimming', () => {
  it('leaves dark art as it is', () => {
    expect(getArtDimming(pixels([0, 0, 0], [20, 30, 40]))).toBe(0)
  })

  it.each<[string, number[][]]>([
    ['white', [[255, 255, 255]]],
    ['grey', [[128, 128, 128]]],
    ['red', [[255, 0, 0]]],
    ['blue', [[0, 0, 255]]],
    [
      'a dark scene with a bright sky',
      [
        [10, 15, 20],
        [200, 220, 255],
      ],
    ],
  ])('keeps the text at WCAG AA over %s art', (_, colors) => {
    expect(getLowestContrast(colors)).toBeGreaterThanOrEqual(4.5)
  })

  it('dims no more than it needs to', () => {
    expect(getLowestContrast([[255, 255, 255]])).toBeLessThan(4.6)
  })

  it('dims art by its brightest part', () => {
    const white = getArtDimming(pixels([255, 255, 255]))

    expect(getArtDimming(pixels([0, 0, 0], [255, 255, 255]))).toBe(white)
    expect(getArtDimming(pixels([128, 128, 128]))).toBeLessThan(white)
  })

  it('dims blue less than white, as it looks darker', () => {
    expect(getArtDimming(pixels([0, 0, 255]))).toBeLessThan(
      getArtDimming(pixels([255, 255, 255])),
    )
  })

  it('dims unmeasured art as if it were white', () => {
    expect(WHITE_ART_DIMMING).toBe(getArtDimming(pixels([255, 255, 255])))
  })
})

describe('getVisibleArea', () => {
  const ART = { width: 80, height: 45 }

  it('takes the middle of a wide backdrop in a tall card', () => {
    const area = getVisibleArea(
      { width: 1600, height: 900 },
      { width: 400, height: 800 },
      1.5,
      40,
    )

    // Covering the card's height, a pixel of the card is 900 / 800 of the
    // art's. What shows is 400 / 1.5 by 800 / 1.5, and the blur reaches 120
    // further on each side.
    expect(area.width).toBeCloseTo(((400 / 1.5 + 240) * 900) / 800)
    expect(area.height).toBeCloseTo(((800 / 1.5 + 240) * 900) / 800)
    expect(area.x).toBeCloseTo((1600 - area.width) / 2)
    expect(area.y).toBeCloseTo((900 - area.height) / 2)
  })

  it('takes all of the art when the blur reaches its edges', () => {
    const area = getVisibleArea(ART, { width: 160, height: 90 }, 1.5, 40)

    expect(area).toEqual({ x: 0, y: 0, ...ART })
  })

  it('takes all of the art before the card has a size', () => {
    const area = getVisibleArea(ART, { width: 0, height: 0 }, 1.5, 40)

    expect(area).toEqual({ x: 0, y: 0, ...ART })
  })
})
