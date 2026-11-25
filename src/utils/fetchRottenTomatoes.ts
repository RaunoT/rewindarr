import { isTimeoutError } from './connectionErrors'
import { isGatewayError, isHostDown, markHostDown } from './hostBackoff'

// Rotten Tomatoes has no public API, so this asks the search its own site uses,
// with the search-only key from that site, the way Seerr does. It's
// unofficial and can stop working, and titles are matched by name and year,
// so a failed or unmatched search just leaves the scores out.
const SEARCH_URL = 'https://79frdp12pn-dsn.algolia.net/1/indexes/*/queries'
const SEARCH_HEADERS = {
  'Content-Type': 'application/json',
  'x-algolia-api-key': '175588f6e5f8319b27702e4cc4013561',
  'x-algolia-application-id': '79FRDP12PN',
}
const REQUEST_TIMEOUT_MS = 10_000
// Scores change slowly
const CACHE_SECONDS = 24 * 60 * 60

type SearchHit = {
  title: string
  type?: string
  releaseYear?: number | string | null
  vanity: string
  rottenTomatoes?: {
    criticsScore?: number | null
    audienceScore?: number | null
  }
}

type SearchResponse = {
  results?: { index: string; hits?: SearchHit[] }[]
}

export type RottenTomatoesScores = {
  url: string
  critics: number | null
  audience: number | null
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase()
}

function findMatch(
  hits: SearchHit[],
  title: string,
  year: number | null,
  type: 'movie' | 'tv',
): SearchHit | undefined {
  const candidates = hits.filter(
    (hit) =>
      !hit.type ||
      (type === 'movie' ? hit.type === 'movie' : hit.type !== 'movie'),
  )
  const needle = normalizeTitle(title)
  const isYear = (hit: SearchHit) => !!year && Number(hit.releaseYear) === year
  const isCloseYear = (hit: SearchHit) => {
    const hitYear = Number(hit.releaseYear)

    return !year || !hitYear || Math.abs(hitYear - year) <= 1
  }
  const isExactTitle = (hit: SearchHit) => normalizeTitle(hit.title) === needle
  const isPartialTitle = (hit: SearchHit) =>
    normalizeTitle(hit.title).includes(needle)

  return (
    candidates.find((hit) => isYear(hit) && isExactTitle(hit)) ??
    candidates.find((hit) => isYear(hit) && isPartialTitle(hit)) ??
    candidates.find((hit) => isExactTitle(hit) && isCloseYear(hit))
  )
}

function getScore(score: number | null | undefined): number | null {
  // A missing score is null, while 0 is a real one
  return typeof score === 'number' ? Math.round(score) : null
}

export default async function fetchRottenTomatoes(
  title: string,
  year: number | null,
  type: 'movie' | 'tv',
): Promise<RottenTomatoesScores | null> {
  if (isHostDown(SEARCH_URL)) {
    return null
  }

  let res: Response | undefined

  try {
    res = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: SEARCH_HEADERS,
      body: JSON.stringify({
        requests: [
          {
            indexName: 'content_rt',
            query: title,
            params: 'filters=isEmsSearchable%20%3D%201&hitsPerPage=20',
          },
        ],
      }),
      cache: 'force-cache',
      next: { revalidate: CACHE_SECONDS },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (!res.ok) {
      await res.body?.cancel()

      if (isGatewayError(res.status)) {
        markHostDown(SEARCH_URL)
      }

      console.error(
        `[ROTTEN TOMATOES] - Search failed for '${title}'.\n`,
        res.status,
        res.statusText,
      )

      return null
    }

    const data: SearchResponse = await res.json()
    const hits =
      data.results?.find((result) => result.index === 'content_rt')?.hits ?? []
    const match = findMatch(hits, title, year, type)

    if (!match?.vanity) {
      return null
    }

    return {
      url: `https://www.rottentomatoes.com/${type === 'movie' ? 'm' : 'tv'}/${match.vanity}`,
      critics: getScore(match.rottenTomatoes?.criticsScore),
      audience: getScore(match.rottenTomatoes?.audienceScore),
    }
  } catch (error) {
    if (!res) {
      markHostDown(SEARCH_URL)
    }

    if (isTimeoutError(error)) {
      console.error(
        `[ROTTEN TOMATOES] - Search timed out after ${REQUEST_TIMEOUT_MS / 1000}s for '${title}'.`,
      )
    } else {
      console.error(
        `[ROTTEN TOMATOES] - Error searching for '${title}'.\n`,
        error,
      )
    }

    return null
  }
}
