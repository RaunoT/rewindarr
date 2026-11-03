import { authOptions } from '@/lib/auth'
import getSettings from '@/utils/getSettings'
import { checkRequiredSettings } from '@/utils/helpers'
import { getServerSession } from 'next-auth'
import { OverviewSkeleton } from '../_components/Overview'

// The home page's own skeleton, so it doesn't change into another one once
// the page arrives. In a route group, so it doesn't stand in for other
// sections while their layouts load.
export default async function Loading() {
  const settings = getSettings()
  const session = await getServerSession(authOptions)

  // The login and setup screens have nothing to stand in for
  if (
    checkRequiredSettings(settings) ||
    (!session && !settings.general.isOutsideAccess)
  ) {
    return null
  }

  return <OverviewSkeleton settings={settings} session={session} />
}
