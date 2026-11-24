import { authOptions } from '@/lib/auth'
import { getSiteUrl, TIME_ZONE_COOKIE_NAME } from '@/utils/constants'
import getSettings from '@/utils/getSettings'
import {
  checkRequiredSettings,
  getOpenPages,
  sortByActiveLibraries,
} from '@/utils/helpers'
import { toPublicSettings } from '@/utils/publicSettings'
import { getNewEditionYear } from '@/utils/rewindPeriod'
import { getReachableLibraries } from '@/utils/statsSource'
import { toTimeZone } from '@/utils/timeZone'
import { getServerSession } from 'next-auth'
import { cookies } from 'next/headers'
import { Suspense } from 'react'
import Home from '../_components/Home'
import Overview from '../_components/Overview'

export default async function HomePage() {
  const settings = getSettings()
  const missingSetting = checkRequiredSettings(settings)
  const session = await getServerSession(authOptions)

  if (missingSetting || (!session && !settings.general.isOutsideAccess)) {
    // What signing in leads to, as anyone who isn't an admin will see it
    const pages = getOpenPages(settings, { isLoggedIn: true, isAdmin: false })
    const hasRewind = pages.includes('rewind')
    const timeZone = toTimeZone(
      (await cookies()).get(TIME_ZONE_COOKIE_NAME)?.value,
    )

    return (
      <Suspense>
        <Home
          settings={toPublicSettings(settings)}
          missingSetting={missingSetting}
          siteUrl={getSiteUrl()}
          hasRewind={hasRewind}
          hasStats={pages.some((page) => page !== 'rewind')}
          newRewindYear={
            hasRewind ? getNewEditionYear(settings, timeZone) : null
          }
        />
      </Suspense>
    )
  }

  const libraries = await getReachableLibraries()

  return (
    <Overview
      settings={settings}
      session={session}
      libraries={libraries && sortByActiveLibraries(libraries, settings)}
    />
  )
}
