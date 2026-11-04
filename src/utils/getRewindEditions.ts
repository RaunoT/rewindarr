import getSettings from './getSettings'
import {
  getEditionPeriod,
  getEditionYearsByUser,
  getFirstReadYear,
  getLatestEditionYear,
} from './rewindPeriod'
import { getHistoryReadFrom, getLibraries, getStatsSource } from './statsSource'

// The past editions each user played in, by user ID: everyone's for an admin,
// who can open anyone's Rewind, and otherwise the user's own. Only the years
// the history is read back to the start of, so it doesn't wait for a read.
export default async function getRewindEditions(
  userId: string,
  isAdmin: boolean,
  now: Date = new Date(),
): Promise<Record<string, number[]>> {
  const libraries = await getLibraries()
  const firstYear = getFirstReadYear(await getHistoryReadFrom(libraries))
  const latestYear = getLatestEditionYear(now)

  if (firstYear === null || firstYear >= latestYear) {
    return {}
  }

  const source = getStatsSource(getSettings())
  // The latest edition is always offered, so its plays aren't needed
  const query = {
    since: getEditionPeriod(firstYear).start,
    until: getEditionPeriod(latestYear).start,
    libraries,
  }
  // Everyone's plays leave out excluded users, who still have a Rewind
  const [everyone, own] = await Promise.all([
    isAdmin ? source.getHistoryPlays(query) : [],
    source.getHistoryPlays({ ...query, userId }),
  ])

  return getEditionYearsByUser([...everyone, ...own])
}
