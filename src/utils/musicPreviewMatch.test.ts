import { describe, expect, it } from 'vitest'
import {
  getAlbumTitles,
  getSongName,
  isAlbumCandidate,
  isSoundtrackAlbum,
  normalizeTitle,
  pickSong,
  pickThemeTrack,
  rankAlbum,
  SoundtrackTitle,
} from './musicPreviewMatch'

function movie(
  title: string,
  year: number | null,
  composers: string[] = [],
  originalTitle = title,
): SoundtrackTitle {
  return {
    kind: 'movie',
    titles: [...new Set([title, originalTitle])],
    year,
    composers,
  }
}

function show(title: string, composers: string[] = []): SoundtrackTitle {
  return { kind: 'show', titles: [title], year: 2022, composers }
}

const matrix = movie('The Matrix', 1999, ['Don Davis'])

describe('normalizeTitle', () => {
  it('drops accents, punctuation and a leading article', () => {
    expect(normalizeTitle('The Amélie: Part II!')).toBe('amelie part ii')
    expect(normalizeTitle("Ocean's Eleven & Co.")).toBe('oceans eleven and co')
  })

  it('keeps titles that have no Latin letters', () => {
    expect(normalizeTitle('기생충')).not.toBe('')
  })
})

describe('getAlbumTitles', () => {
  it.each([
    ['Inception (Music from the Motion Picture)', 'Inception'],
    [
      'Interstellar (Original Motion Picture Soundtrack) [Expanded Edition]',
      'Interstellar',
    ],
    ['Forrest Gump - Original Motion Picture Score', 'Forrest Gump'],
    ['Titanic: Music from the Motion Picture Soundtrack', 'Titanic'],
    ['Spirited Away Soundtrack', 'Spirited Away'],
    ['Dune: Part Two (Original Motion Picture Soundtrack)', 'Dune: Part Two'],
    [
      'Matrix Revolutions: The Motion Picture Soundtrack (U.S. Version)',
      'Matrix Revolutions',
    ],
  ])('reads the movie of "%s"', (album, title) => {
    expect(getAlbumTitles(album, 'movie')).toEqual([title])
  })

  it.each([
    ['Severance: Season 1 (Apple TV+ Original Series Soundtrack)', 'Severance'],
    [
      'Slow Horses: Seasons 3 & 4 (Apple TV+ Original Series Soundtrack)',
      'Slow Horses',
    ],
    ['Fargo Year 2 (Score from the Original Television Series)', 'Fargo'],
    [
      'Stranger Things, Vol. 1 (A Netflix Original Series Soundtrack)',
      'Stranger Things',
    ],
    ['Shōgun (Vol. 2) (Original Soundtrack)', 'Shōgun'],
    ['The Mandalorian: Season 2 - Vol. 1 (Chapters 9-12)', 'The Mandalorian'],
    ['Chernobyl (Music from the Original TV Series)', 'Chernobyl'],
  ])('reads the show of "%s"', (album, title) => {
    expect(getAlbumTitles(album, 'show')).toContain(title)
  })

  it("doesn't take a sequel for a season", () => {
    expect(
      getAlbumTitles('The Last of Us Part II (Original Soundtrack)', 'show'),
    ).not.toContain('The Last of Us')
  })

  it("keeps a show's title that ends like a season", () => {
    expect(getAlbumTitles('Babylon 5 (Original Soundtrack)', 'show')).toContain(
      'Babylon 5',
    )
  })
})

describe('isSoundtrackAlbum', () => {
  it("takes the composer's album of the movie's title, whenever it came out", () => {
    expect(
      isSoundtrackAlbum(matrix, {
        title: 'The Matrix (Original Motion Picture Score / Deluxe Edition)',
        artist: 'Don Davis',
        year: 2020,
      }),
    ).toBe(true)
  })

  it('matches a composer written another way, or among other artists', () => {
    expect(
      isSoundtrackAlbum(movie('Parasite', 2019, ['Jung Jae-il']), {
        title: 'Parasite (Original Motion Picture Soundtrack)',
        artist: 'Jung Jae Il',
        year: 2019,
      }),
    ).toBe(true)
    expect(
      isSoundtrackAlbum(movie('The Dark Knight', 2008, ['Hans Zimmer']), {
        title: 'The Dark Knight',
        artist: 'Hans Zimmer & James Newton Howard',
        year: 2008,
      }),
    ).toBe(true)
  })

  it("leaves out an album by someone who only shares the composer's name", () => {
    expect(
      isSoundtrackAlbum(movie('Inception', 2010, ['Hans Zimmer']), {
        title: 'Inception',
        artist: 'Hans Zimmer Tribute Orchestra',
        year: 2018,
      }),
    ).toBe(false)
  })

  it("leaves out another movie's album", () => {
    expect(
      isSoundtrackAlbum(matrix, {
        title: 'The Matrix Resurrections (Original Motion Picture Soundtrack)',
        artist: 'Johnny Klimek',
        year: 2021,
      }),
    ).toBe(false)
    expect(
      isSoundtrackAlbum(movie('Parasite', 2019), {
        title: 'Ghoulies / Parasite (Original Motion Picture Soundtracks)',
        artist: 'Richard Band',
        year: 2019,
      }),
    ).toBe(false)
    expect(
      isSoundtrackAlbum(movie('Heat', 1995, ['Elliot Goldenthal']), {
        title: 'Heated Rivalry (Original Series Soundtrack)',
        artist: 'Peter Peter',
        year: 1995,
      }),
    ).toBe(false)
  })

  it("takes a soundtrack by other artists only from the movie's year", () => {
    const holdovers = movie('The Holdovers', 2023)
    const album = {
      title: 'The Holdovers (Original Motion Picture Soundtrack)',
      artist: 'Various Artists',
    }

    expect(isSoundtrackAlbum(holdovers, { ...album, year: 2023 })).toBe(true)
    expect(isSoundtrackAlbum(holdovers, { ...album, year: 2024 })).toBe(true)
    expect(isSoundtrackAlbum(holdovers, { ...album, year: 2012 })).toBe(false)
    expect(isSoundtrackAlbum(holdovers, { ...album, year: null })).toBe(false)
    expect(
      isSoundtrackAlbum(movie('The Holdovers', null), { ...album, year: 2023 }),
    ).toBe(false)
  })

  it("leaves out an album of the movie's title that isn't a soundtrack", () => {
    expect(
      isSoundtrackAlbum(movie('F1', 2025, ['Hans Zimmer']), {
        title: 'F1',
        artist: 'Dreaming Piano',
        year: 2025,
      }),
    ).toBe(false)
  })

  it('matches the original title too', () => {
    expect(
      isSoundtrackAlbum(movie('City of God', 2002, [], 'Cidade de Deus'), {
        title: 'Cidade de Deus (Original Motion Picture Soundtrack)',
        artist: 'Various Artists',
        year: 2002,
      }),
    ).toBe(true)
  })

  it("takes a season's album of a show by its composer", () => {
    expect(
      isSoundtrackAlbum(show('Severance', ['Theodore Shapiro']), {
        title: 'Severance: Season 1 (Apple TV+ Original Series Soundtrack)',
        artist: 'Theodore Shapiro',
        year: 2022,
      }),
    ).toBe(true)
  })

  it("leaves out a show's album that isn't its composer's", () => {
    const album = {
      title:
        'Severance Main Titles Piano (Apple TV+ Original Series Soundtrack)',
      artist: 'Jules Piano',
      year: 2022,
    }

    expect(
      isSoundtrackAlbum(show('Severance', ['Theodore Shapiro']), album),
    ).toBe(false)
    expect(
      isSoundtrackAlbum(show('Stranger Things'), {
        title: 'Stranger Things (Original Series Soundtrack)',
        artist: 'Various Artists',
        year: 2022,
      }),
    ).toBe(false)
  })
})

describe('rankAlbum', () => {
  it("puts a show's series album before its composer's others", () => {
    const lastOfUs = show('The Last of Us', ['Gustavo Santaolalla'])
    const artist = 'Gustavo Santaolalla'

    expect(
      rankAlbum(lastOfUs, {
        title: 'The Last of Us: Season 1 (Soundtrack from the HBO Series)',
        artist,
      }),
    ).toBeGreaterThan(
      rankAlbum(lastOfUs, {
        title: 'The Last of Us (Video Game Soundtrack)',
        artist,
      }),
    )
  })

  it("puts the composer's album before the others", () => {
    expect(
      rankAlbum(matrix, { title: 'The Matrix', artist: 'Don Davis' }),
    ).toBeGreaterThan(
      rankAlbum(matrix, { title: 'The Matrix', artist: 'Various Artists' }),
    )
  })
})

describe('isAlbumCandidate', () => {
  it("doesn't need the year, which the search doesn't have", () => {
    expect(
      isAlbumCandidate(movie('The Holdovers', 2023), {
        title: 'The Holdovers (Original Motion Picture Soundtrack)',
        artist: 'Various Artists',
      }),
    ).toBe(true)
  })
})

describe('pickThemeTrack', () => {
  it('picks the most played track', () => {
    expect(
      pickThemeTrack(matrix, [
        { title: 'Main Title', position: 1, rank: 100 },
        { title: 'Time', position: 12, rank: 900 },
      ])?.title,
    ).toBe('Time')
  })

  it('picks the track named like a theme without plays to go by', () => {
    expect(
      pickThemeTrack(matrix, [
        { title: 'Logos', position: 1 },
        { title: 'Main Title / Trinity Infinity', position: 2 },
        { title: 'Unable to Speak', position: 3 },
      ])?.position,
    ).toBe(2)
  })

  it("prefers the track of the movie's title, then the album's first", () => {
    expect(
      pickThemeTrack(matrix, [
        { title: 'Opening', position: 1 },
        { title: 'The Matrix', position: 2 },
      ])?.position,
    ).toBe(2)
    expect(
      pickThemeTrack(matrix, [
        { title: 'Second', position: 2 },
        { title: 'First', position: 1 },
      ])?.title,
    ).toBe('First')
  })

  it('gives nothing without tracks', () => {
    expect(pickThemeTrack(matrix, [])).toBeNull()
  })
})

describe('getSongName', () => {
  it('leaves out what the title says about the recording', () => {
    expect(getSongName('Bohemian Rhapsody - Remastered 2011')).toBe(
      'Bohemian Rhapsody',
    )
    expect(getSongName('Get Lucky (feat. Pharrell Williams)')).toBe('Get Lucky')
    expect(getSongName('Anti-Hero')).toBe('Anti-Hero')
    expect(getSongName("(Sittin' On) The Dock of the Bay")).toBe(
      'The Dock of the Bay',
    )
    expect(getSongName('[Untitled]')).toBe('[Untitled]')
  })
})

describe('pickSong', () => {
  const creep = { artist: 'Radiohead', title: 'Creep' }

  it('picks the same recording over the ones that sound like it', () => {
    expect(
      pickSong(creep, [
        { artist: 'Radiohead', title: 'Creep (2011 Remaster)', id: 1 },
        { artist: 'Radiohead', title: 'Creep', id: 2 },
      ])?.id,
    ).toBe(2)
  })

  it('takes a remaster, but not a live or acoustic recording', () => {
    expect(
      pickSong({ artist: 'Sigur Rós', title: 'Hoppípolla' }, [
        {
          artist: 'Sigur Ros',
          title: 'Hoppipolla (The Tape Variations Remix)',
        },
        { artist: 'Sigur Rós', title: 'Hoppípolla (2025 Remaster)' },
      ])?.title,
    ).toBe('Hoppípolla (2025 Remaster)')
    expect(
      pickSong(creep, [
        { artist: 'Radiohead', title: 'Creep (Acoustic)' },
        { artist: 'Radiohead', title: 'Creep - Live at Glastonbury' },
      ]),
    ).toBeNull()
  })

  it('takes a live recording when that was played', () => {
    expect(
      pickSong({ artist: 'Radiohead', title: 'Creep (Live)' }, [
        { artist: 'Radiohead', title: 'Creep - Live at Glastonbury' },
      ]),
    ).not.toBeNull()
  })

  it("leaves out another artist's song of that title, and another song", () => {
    expect(
      pickSong(creep, [
        { artist: 'TLC', title: 'Creep' },
        { artist: 'Radiohead', title: 'Creep On' },
      ]),
    ).toBeNull()
  })

  it("leaves out an artist who only shares the artist's name", () => {
    expect(
      pickSong({ artist: 'Muse', title: 'Uprising' }, [
        { artist: 'Muse Tribute Band', title: 'Uprising' },
      ]),
    ).toBeNull()
  })

  it('matches an artist among others, and written another way', () => {
    expect(
      pickSong({ artist: 'Beyoncé', title: 'Crazy in Love' }, [
        { artist: 'Beyonce feat. Jay-Z', title: 'Crazy In Love' },
      ]),
    ).not.toBeNull()
  })
})
