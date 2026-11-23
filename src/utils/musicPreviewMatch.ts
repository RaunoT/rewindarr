// Tells a title's soundtrack album, or a song, from what else a search for it
// finds, and picks the track to play. Something else's music is worse than
// none, so an album has to carry the title exactly and a song its artist.

export type SoundtrackTitle = {
  kind: 'movie' | 'show'
  // The title and the original one, when they differ
  titles: string[]
  // Of a movie's release or a show's first episode
  year: number | null
  // Who wrote the score, by name
  composers: string[]
}

export type SoundtrackAlbum = {
  title: string
  artist: string
  // Null when not known yet
  year?: number | null
}

export type SoundtrackTrack = {
  title: string
  // The track's place on the album, from 1
  position: number
  // How much it's played, when the service says
  rank?: number
}

export type Song = {
  artist: string
  title: string
}

// What albums add to the title, such as "(Original Motion Picture
// Soundtrack)" or "[Expanded Edition]"
const BRACKETS = /\s*[([][^)\]]*[)\]]/g
// "Title: Original Score" and "Title - The Soundtrack"
const SEPARATED_SUFFIX =
  /\s*[:\-–—]\s*(the\s+)?(original|official|complete|music|motion picture|soundtrack|score|ost)\b.*$/i
// "Title Original Soundtrack"
const PLAIN_SUFFIX =
  /\s+(the\s+)?(original\s+)?(motion picture\s+)?(soundtrack|score|ost)\s*$/i
// A show's albums come per season: "Title: Season 1", "Title, Vol. 2",
// "Title Year 3" and "Title: Seasons 3 & 4". Not "Part 2", which is a sequel's.
const SEASON_SUFFIX =
  /[\s:,\-–—]*\b(seasons?|series|vol(ume)?\.?|years?)\s*(\d+|[ivx]+)(\s*(&|and|[-–,])\s*(\d+|[ivx]+))*\s*$/i
// "Title: Season 2 - Vol. 1" has two of them
const MAX_SEASON_SUFFIXES = 2
// A show's composer can have scored a game or movie of its title too
const SERIES_WORDS = /\b(series|seasons?|television|tv)\b/i
const SOUNDTRACK_WORDS =
  /\b(soundtrack|score|motion picture|music from|ost|bande originale|original (film|movie))\b/i
// The track that opens a score is usually the one known as its theme
const THEME_WORDS =
  /\b(main titles?|main theme|theme|opening|overture|prologue)\b/i
const ARTICLE = /^(the|a|an) /
// A soundtrack comes out around its movie. A later album of that name without
// the composer's is more likely a re-recording or another movie's.
const MAX_YEARS_APART = 1
// What joins the people of an artist credit
const ARTIST_SEPARATOR =
  /\s*(?:[,;&/+]|\b(?:feat|ft|featuring|and|vs)\b\.?)\s*/i
// What a song's title says about the recording: "(Live)", "[2011 Remaster]"
// and "- Acoustic"
const SONG_VERSION = /\s*[([][^)\]]*[)\]]|\s+[-–—]\s+.*$/g
// The recordings that don't sound like the one that was played
const OTHER_RECORDING =
  /\b(live|acoustic|remix|mix|cover|karaoke|instrumental|demo|reprise|tribute)\b/i

// Lowercase words without accents or punctuation, so "Amélie" matches "Amelie"
export function normalizeTitle(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(ARTICLE, '')
}

// The movie's or show's title as the album carries it. A show's also without
// the season, as the title itself can end like one.
export function getAlbumTitles(
  albumTitle: string,
  kind: SoundtrackTitle['kind'],
): string[] {
  const title = albumTitle
    .replace(BRACKETS, '')
    .replace(SEPARATED_SUFFIX, '')
    .replace(PLAIN_SUFFIX, '')
    .trim()
  const titles = [title]

  if (kind === 'show') {
    for (let i = 0; i < MAX_SEASON_SUFFIXES; i++) {
      titles.push(titles[i].replace(SEASON_SUFFIX, '').trim())
    }
  }

  return titles
}

function isTitleMatch(title: SoundtrackTitle, album: SoundtrackAlbum): boolean {
  const albumTitles = getAlbumTitles(album.title, title.kind)
    .map(normalizeTitle)
    .filter(Boolean)

  return title.titles.some((other) =>
    albumTitles.includes(normalizeTitle(other)),
  )
}

// The people an artist credit names: "A & B", "A feat. B" and "A, B"
function getArtists(credit: string): string[] {
  return [credit, ...credit.split(ARTIST_SEPARATOR)]
    .map(normalizeTitle)
    .filter(Boolean)
}

// One is credited in the other, or they're the same. Not by a part of the
// name, which a tribute band shares with who it covers.
function isSameArtist(artist: string, other: string): boolean {
  const name = normalizeTitle(artist)
  const otherName = normalizeTitle(other)

  return (
    !!name &&
    !!otherName &&
    (getArtists(artist).includes(otherName) || getArtists(other).includes(name))
  )
}

// The artist can be several people, the composer one of them
export function isByComposer(
  title: SoundtrackTitle,
  album: SoundtrackAlbum,
): boolean {
  const artists = getArtists(album.artist)

  return title.composers.some((composer) =>
    artists.includes(normalizeTitle(composer)),
  )
}

// How likely the album is the title's, among the ones that can be. The
// composer's is the score, and a show's says it's a series'.
export function rankAlbum(
  title: SoundtrackTitle,
  album: SoundtrackAlbum,
): number {
  return (
    (isByComposer(title, album) ? 2 : 0) +
    (title.kind === 'show' && SERIES_WORDS.test(album.title) ? 1 : 0)
  )
}

// By its title, as the services also file covers under soundtracks
function isSoundtrack(album: SoundtrackAlbum): boolean {
  return SOUNDTRACK_WORDS.test(album.title)
}

// Worth looking the year up for: it has the title, and is either the
// composer's or a movie's soundtrack
export function isAlbumCandidate(
  title: SoundtrackTitle,
  album: SoundtrackAlbum,
): boolean {
  return (
    isTitleMatch(title, album) &&
    (isByComposer(title, album) ||
      (title.kind === 'movie' && isSoundtrack(album)))
  )
}

// The composer's album of the title is its score. Anyone else's, like a
// soundtrack of songs by various artists, has to be from the movie's year. A
// show runs for years, so only its composer's counts.
export function isSoundtrackAlbum(
  title: SoundtrackTitle,
  album: SoundtrackAlbum,
): boolean {
  if (!isAlbumCandidate(title, album)) {
    return false
  }

  if (isByComposer(title, album)) {
    return true
  }

  return (
    !!title.year &&
    !!album.year &&
    Math.abs(album.year - title.year) <= MAX_YEARS_APART
  )
}

function getThemeScore(title: SoundtrackTitle, track: SoundtrackTrack): number {
  const trackTitle = normalizeTitle(track.title)
  const titles = title.titles.map(normalizeTitle).filter(Boolean)

  if (titles.includes(trackTitle)) {
    return 3
  }

  if (THEME_WORDS.test(track.title)) {
    return 2
  }

  return titles.some((other) => ` ${trackTitle} `.includes(` ${other} `))
    ? 1
    : 0
}

// Negative when the first is the better pick
function compareTracks(
  title: SoundtrackTitle,
  a: SoundtrackTrack,
  b: SoundtrackTrack,
): number {
  return (
    (b.rank ?? 0) - (a.rank ?? 0) ||
    getThemeScore(title, b) - getThemeScore(title, a) ||
    a.position - b.position
  )
}

// The most played track, which is the one people know the title by. Without
// plays to go by, the one named like a theme, then the album's first.
export function pickThemeTrack<T extends SoundtrackTrack>(
  title: SoundtrackTitle,
  tracks: T[],
): T | null {
  let best: T | null = null

  for (const track of tracks) {
    if (!best || compareTracks(title, track, best) < 0) {
      best = track
    }
  }

  return best
}

// A song's title without what it says about the recording, which the services
// word their own way
export function getSongName(title: string): string {
  return title.replace(SONG_VERSION, '').trim() || title
}

// 2 for the same recording by its title, 1 for one that sounds like it, such
// as a remaster, and 0 for another song, artist or recording
function getSongScore(song: Song, found: Song): number {
  const name = normalizeTitle(getSongName(song.title))

  if (
    !isSameArtist(song.artist, found.artist) ||
    !name ||
    name !== normalizeTitle(getSongName(found.title))
  ) {
    return 0
  }

  if (normalizeTitle(song.title) === normalizeTitle(found.title)) {
    return 2
  }

  const version = (found.title.match(SONG_VERSION) ?? []).join(' ')

  return OTHER_RECORDING.test(version) && !OTHER_RECORDING.test(song.title)
    ? 0
    : 1
}

// The song among what a search for it found, the first of the best matches.
// Null when it isn't there.
export function pickSong<T extends Song>(song: Song, found: T[]): T | null {
  let best: T | null = null
  let bestScore = 0

  for (const other of found) {
    const score = getSongScore(song, other)

    if (score > bestScore) {
      best = other
      bestScore = score
    }
  }

  return best
}
