import { TautulliItemRow } from '@/types/tautulli'

// With fewer users, the users' top says more than a percent
const MIN_RANKED_USERS = 10
// Further down, being in the top part isn't much of a highlight
const MAX_TOP_PERCENT = 25

// The top percent of users the user is in by their time, rounded up so it
// never flatters them: whole percents below 10, then fives. Null with too few
// users or outside the top quarter. Excluded users aren't among the ranked
// users, so they're placed by their own time. Users with the same time share
// the best place they tie for.
export function getTopPercent(
  users: Pick<TautulliItemRow, 'user_id' | 'total_duration'>[],
  userId: string,
  duration: number,
): number | null {
  const rankedUser = users.find((user) => String(user.user_id) === userId)
  const userDuration = rankedUser?.total_duration ?? duration

  if (userDuration <= 0) {
    return null
  }

  const rank =
    users.filter((user) => user.total_duration > userDuration).length + 1
  const count = users.length + (rankedUser ? 0 : 1)

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
