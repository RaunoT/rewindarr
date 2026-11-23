import { ItemRow, ThemeTitle, TopPeople, TopPerson } from '@/types/statsSource'
import { omit, orderBy, sumBy } from 'lodash'
import fetchTmdb from './fetchTmdb'
import {
  Credits,
  fetchTmdbDetails,
  GetSourceData,
  searchTmdbId,
  TmdbMediaType,
} from './getMediaAdditionalData'
import getSettings from './getSettings'

// Bit parts and cameos would otherwise rank alongside the leads.
const BILLED_ACTORS = 10
const TOP_PEOPLE = 5
// With one title each, everyone ties and the ranking says nothing.
const MIN_TITLES = 2

// A year of movies and shows can be hundreds of lookups, which TMDB
// rate-limits.
export const LOOKUP_CONCURRENCY = 8

// Someone TMDB has no picture of would otherwise cost a lookup per title.
const PORTRAIT_TITLES = 3
// A title without a theme song falls back to the next one
const THEME_TITLES = 3
const TMDB_PROFILE_URL = 'https://image.tmdb.org/t/p/w185'
// A show's plain credits only cover its latest season.
const CREDITS_ENDPOINTS: Record<TmdbMediaType, string> = {
  movie: 'credits',
  tv: 'aggregate_credits',
}

type Role = keyof Credits

type TmdbPerson = {
  name: string
  profile_path?: string | null
}

type TmdbCredits = {
  cast?: (TmdbPerson & { order: number })[]
  crew?: (TmdbPerson & { job?: string })[]
}

export type CreditedTitle = {
  item: ItemRow
  type: TmdbMediaType
  // Where the portraits are looked up, null when TMDB doesn't know the title
  tmdbId: number | null
  // For a show's theme song, null when unknown
  tvdbId: number | null
  credits: Credits
}

// With the titles to look their portrait up in, most watched first, and the
// theme titles' TMDB IDs to look their TVDB IDs up with
type RankedPerson = Omit<TopPerson, 'image' | 'themeTitles'> & {
  tmdbIds: number[]
  themeTitles: (ThemeTitle & { tmdbId: number | null })[]
}

function toKey(name: string): string {
  return name.trim().toLowerCase()
}

function fetchTmdbCredits(
  type: TmdbMediaType,
  tmdbId: number,
): Promise<TmdbCredits | null> {
  return fetchTmdb<TmdbCredits>(`${type}/${tmdbId}/${CREDITS_ENDPOINTS[type]}`)
}

function getTmdbPeople(credits: TmdbCredits, role: Role): TmdbPerson[] {
  return role === 'directors'
    ? (credits.crew ?? []).filter((member) => member.job === 'Director')
    : orderBy(credits.cast ?? [], 'order')
}

async function getTmdbCredits(
  item: ItemRow,
  type: TmdbMediaType,
  tmdbId: number,
  tvdbId: number | null,
): Promise<CreditedTitle | null> {
  const credits = await fetchTmdbCredits(type, tmdbId)

  if (!credits) {
    return null
  }

  return {
    item,
    type,
    tmdbId,
    tvdbId,
    credits: {
      directors: getTmdbPeople(credits, 'directors').map(({ name }) => name),
      actors: getTmdbPeople(credits, 'actors').map(({ name }) => name),
    },
  }
}

// Tracearr's movie plays carry the TMDB ID, which goes straight to TMDB.
// Otherwise the source's own credits come first, then TMDB's for the source's
// ID or for a search, like for a title no longer on the server.
export async function getCredits(
  item: ItemRow,
  type: TmdbMediaType,
  getSourceData: GetSourceData,
): Promise<CreditedTitle | null> {
  if (item.tmdb_id) {
    return getTmdbCredits(item, type, item.tmdb_id, item.tvdb_id ?? null)
  }

  const source = await getSourceData(item, type)
  // A title re-added on the server plays its theme song under its new key
  const sourcedItem = {
    ...item,
    rating_key: source.ratingKey ?? item.rating_key,
  }
  const tvdbId = item.tvdb_id || source.ids?.tvdb || null

  if (source.credits) {
    return {
      item: sourcedItem,
      type,
      tmdbId: source.ids?.tmdb ?? null,
      tvdbId,
      credits: source.credits,
    }
  }

  const tmdbId =
    source.ids?.tmdb ||
    (await searchTmdbId(
      { ...item, year: item.year || source.year || null },
      type,
    ))

  return tmdbId ? getTmdbCredits(sourcedItem, type, tmdbId, tvdbId) : null
}

export async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []

  let next = 0

  async function work() {
    while (next < items.length) {
      const i = next++

      results[i] = await fn(items[i])
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, work))

  return results
}

// People match by name, as Tautulli only gives names. Ties go to the higher
// billed, so a cast that's always together is led by its lead.
export function rankPeople(
  titles: CreditedTitle[],
  role: Role,
): RankedPerson[] {
  const people = new Map<
    string,
    { name: string; titles: CreditedTitle[]; billing: number }
  >()

  for (const title of titles) {
    const names =
      role === 'directors'
        ? title.credits.directors
        : title.credits.actors.slice(0, BILLED_ACTORS)
    // A name can be credited twice on one title, as two roles or jobs.
    const keys = new Set<string>()

    names.forEach((name, billing) => {
      const key = toKey(name)

      if (!key || keys.has(key)) {
        return
      }

      keys.add(key)

      const person = people.get(key) ?? {
        name: name.trim(),
        titles: [],
        billing,
      }

      person.titles.push(title)
      person.billing = Math.min(person.billing, billing)
      people.set(key, person)
    })
  }

  const ranked = [...people.values()]
    .filter((person) => person.titles.length >= MIN_TITLES)
    .map((person) => ({
      ...person,
      duration: sumBy(person.titles, (title) => title.item.total_duration),
    }))
    .sort(
      (a, b) =>
        b.titles.length - a.titles.length ||
        b.duration - a.duration ||
        a.billing - b.billing,
    )
  const shown: ((typeof ranked)[number] & { together: string[] })[] = []

  // Someone whose titles are all listed for a person above says nothing new,
  // so the next one shows. When they're in every one of that person's titles,
  // like the rest of a cast that's always together, they're named with them,
  // even from below the top people.
  for (const person of ranked) {
    const above = shown.find((above) =>
      person.titles.every((title) => above.titles.includes(title)),
    )

    if (above) {
      if (person.titles.length === above.titles.length) {
        above.together.push(person.name)
      }
    } else if (shown.length < TOP_PEOPLE) {
      shown.push({ ...person, together: [] })
    }
  }

  return shown.map((person) => {
    const titles = orderBy(
      person.titles,
      (title) => title.item.total_duration,
      'desc',
    )

    return {
      name: person.name,
      count: titles.length,
      duration: person.duration,
      titles: titles.map((title) => title.item.title),
      themeTitles: titles.slice(0, THEME_TITLES).map((title) => ({
        ratingKey: title.item.rating_key,
        tvdbId: title.tvdbId,
        tmdbId: title.tmdbId,
      })),
      together: person.together,
      tmdbIds: titles.flatMap((title) => (title.tmdbId ? [title.tmdbId] : [])),
    }
  })
}

// From TMDB's credits of a title they're in, which the ranking has usually
// just fetched. A search by name could find someone else of that name.
async function findPortrait(
  person: RankedPerson,
  role: Role,
  type: TmdbMediaType,
): Promise<string | null> {
  const key = toKey(person.name)

  for (const tmdbId of person.tmdbIds.slice(0, PORTRAIT_TITLES)) {
    const credits = await fetchTmdbCredits(type, tmdbId)
    const path =
      credits &&
      getTmdbPeople(credits, role).find(({ name }) => toKey(name) === key)
        ?.profile_path

    if (path) {
      return `${TMDB_PROFILE_URL}${path}`
    }
  }

  return null
}

// A show's theme song goes by its TVDB ID, which TMDB has when the source
// doesn't. Movies have none.
async function findTvdbId(
  title: RankedPerson['themeTitles'][number],
  type: TmdbMediaType,
): Promise<number | null> {
  if (
    title.tvdbId ||
    type !== 'tv' ||
    !title.tmdbId ||
    !getSettings().rewind.isThemeMusicActive
  ) {
    return title.tvdbId
  }

  const details = await fetchTmdbDetails('tv', title.tmdbId)

  return details?.external_ids?.tvdb_id ?? null
}

async function getRanking(
  titles: CreditedTitle[],
  role: Role,
  type: TmdbMediaType,
): Promise<TopPerson[]> {
  const people = rankPeople(
    titles.filter((title) => title.type === type),
    role,
  )

  return Promise.all(
    people.map(async (person) => {
      const [image, themeTitles] = await Promise.all([
        findPortrait(person, role, type),
        Promise.all(
          person.themeTitles.map(async (title) => ({
            ratingKey: title.ratingKey,
            tvdbId: await findTvdbId(title, type),
          })),
        ),
      ])

      return { ...omit(person, 'tmdbIds'), themeTitles, image }
    }),
  )
}

// Movies and shows share one queue of lookups, which keeps to TMDB's limit.
export async function getTopPeople(
  { movies, shows }: { movies: ItemRow[]; shows: ItemRow[] },
  getSourceData: GetSourceData,
): Promise<TopPeople> {
  const lookups = [
    ...movies.map((item) => ({ item, type: 'movie' as const })),
    ...shows.map((item) => ({ item, type: 'tv' as const })),
  ]
  const credited = await mapWithLimit(
    lookups,
    LOOKUP_CONCURRENCY,
    ({ item, type }) => getCredits(item, type, getSourceData),
  )
  const titles = credited.filter(
    (title): title is CreditedTitle => title !== null,
  )
  const [directors, movieActors, showActors] = await Promise.all([
    getRanking(titles, 'directors', 'movie'),
    getRanking(titles, 'actors', 'movie'),
    getRanking(titles, 'actors', 'tv'),
  ])

  return { directors, movieActors, showActors }
}
