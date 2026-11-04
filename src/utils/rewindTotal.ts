import { TautulliItemRow } from '@/types/tautulli'

const DAY_SECONDS = 86400
// With fewer users, the users' top says more than a percent
const MIN_RANKED_USERS = 10
// Further down, being in the top part isn't much of a highlight
const MAX_TOP_PERCENT = 25

// The top percent of users the user is in by their time, rounded up so it
// never flatters them: whole percents below 10, then fives. Null with too few
// users or outside the top quarter. Excluded users aren't among the ranked
// users, so they're placed by their own time.
export function getTopPercent(
  users: Pick<TautulliItemRow, 'user_id' | 'total_duration'>[],
  userId: string,
  duration: number,
): number | null {
  const index = users.findIndex((user) => String(user.user_id) === userId)
  const isRanked = index !== -1

  if (!isRanked && duration <= 0) {
    return null
  }

  const rank = isRanked
    ? index + 1
    : users.filter((user) => user.total_duration > duration).length + 1
  const count = users.length + (isRanked ? 0 : 1)

  if (count < MIN_RANKED_USERS) {
    return null
  }

  // Multiplied first, so a whole percent stays whole
  const percent = (rank * 100) / count

  if (percent > MAX_TOP_PERCENT) {
    return null
  }

  return percent < 10 ? Math.ceil(percent) : Math.ceil(percent / 5) * 5
}

// The user's time in days, as if it were watched in one go. Null under a day,
// and to one decimal below ten days.
export function getNonStopDays(seconds: number): number | null {
  const days = seconds / DAY_SECONDS

  if (days < 1) {
    return null
  }

  return days < 10 ? Math.round(days * 10) / 10 : Math.round(days)
}
