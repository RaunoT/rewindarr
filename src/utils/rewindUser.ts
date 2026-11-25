import { SourceUser } from '@/types/statsSource'

// The name the statistics source knows a user by, which the user picker and
// the other pages show too. A Rewind names its user with it in every story,
// whether it's their own, one an admin opened or a shared link, rather than
// with the name of the account they signed in with.
export function getRewindUserName(
  user: Pick<SourceUser, 'friendly_name' | 'username'> | undefined,
  fallback = '',
): string {
  return user?.friendly_name || user?.username || fallback
}
