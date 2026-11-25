'use client'

import Toasts from '@/components/Toasts'
import { Version } from '@/types'
import { PublicSettings } from '@/types/settings'
import { Library } from '@/types/statsSource'
import { TIME_ZONE_COOKIE_NAME } from '@/utils/constants'
import { getCookie, setCookie } from '@/utils/cookies'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import clsx from 'clsx'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { ReactNode, useEffect, useState } from 'react'
import stars from '../_assets/stars.png'
import GlobalContextProvider from './GlobalContextProvider'
import HeaderControls, {
  AppInfoContext,
  SETTINGS_RETURN_KEY,
} from './HeaderControls'
import Sidebar from './Sidebar'
import SourceOutageNotice from './SourceOutageNotice'

type Props = {
  children: ReactNode
  missingSetting: string | null
  version: Version
  // Streamed in, and null when the source can't be reached
  libraries: Promise<Library[] | null>
  settings: PublicSettings
  canBrowse: boolean
  // Rewind is all the viewer can open, so a sidebar would only hold its link
  isRewindOnly: boolean
  // From its cookie, missing until the choice was first saved there
  isActivityDetailsHidden?: boolean
}

const SIDEBAR_ROUTES = [
  '/dashboard',
  '/rewind',
  '/activity',
  '/history',
  '/settings',
]

export default function AppProvider({
  children,
  missingSetting,
  version,
  libraries,
  settings,
  canBrowse,
  isRewindOnly,
  isActivityDetailsHidden,
}: Props) {
  const [queryClient] = useState(() => new QueryClient())
  const pathname = usePathname()
  const router = useRouter()
  // Not during setup or before logging in, when there's nothing to browse yet
  const isBrowsing =
    !missingSetting &&
    canBrowse &&
    (pathname === '/' ||
      SIDEBAR_ROUTES.some((route) => pathname.startsWith(route)))
  const hasSidebar = isBrowsing && !isRewindOnly

  // Saved on every page, so it's there by the time a timezone-aware page is
  // opened. A page rendered without it, or with an old one, is rendered again
  // once it's saved.
  useEffect(() => {
    const { timeZone } = Intl.DateTimeFormat().resolvedOptions()

    if (getCookie(TIME_ZONE_COOKIE_NAME) === timeZone) {
      return
    }

    setCookie(TIME_ZONE_COOKIE_NAME, timeZone)

    const usesTimeZone =
      (pathname === '/' && isBrowsing) ||
      pathname.startsWith('/history') ||
      pathname.startsWith('/rewind')

    // With cookies blocked, rendering again would change nothing
    if (usesTimeZone && getCookie(TIME_ZONE_COOKIE_NAME) === timeZone) {
      router.refresh()
    }
  }, [isBrowsing, pathname, router])

  useEffect(() => {
    if (!pathname.startsWith('/settings')) {
      try {
        sessionStorage.setItem(
          SETTINGS_RETURN_KEY,
          pathname + window.location.search,
        )
      } catch {}
    }
  }, [pathname])

  return (
    <QueryClientProvider client={queryClient}>
      <GlobalContextProvider isDetailsHidden={isActivityDetailsHidden}>
        <AppInfoContext value={{ missingSetting, version }}>
          <div className='group/app' data-sidebar={hasSidebar || undefined}>
            {hasSidebar && (
              <Sidebar libraries={libraries} settings={settings} />
            )}
            <main
              className={clsx(
                // The same 16px around the page, the sidebar and between blocks.
                // Clipped rather than hidden, which would make it a scroll
                // container and keep sticky things inside from sticking.
                'group/main flex h-full min-h-dvh flex-col items-center overflow-x-clip p-4 pt-(--page-top)',
                {
                  'justify-center': pathname === '/' && !isBrowsing,
                  'lg:pl-68': hasSidebar,
                },
              )}
            >
              <div className='fixed inset-0 -z-10 overflow-hidden bg-black select-none after:absolute after:inset-0 after:bg-black/50 after:content-[""]'>
                <div className='relative h-screen w-screen'>
                  <Image
                    src={stars}
                    alt=''
                    className='object-cover'
                    fill
                    preload
                  />
                </div>
                <div className='bg-twinkling' />
                <div className='bg-clouds sm:opacity-50' />
              </div>

              {/* The sidebar, or a page's header on smaller screens, shows these controls instead. A page can also show them itself. */}
              <HeaderControls className='absolute top-(--page-top) right-4 z-10 group-has-[[data-own-controls]]/main:hidden max-lg:group-has-[[data-page-header]]/main:hidden lg:group-data-[sidebar]/app:hidden' />

              {isBrowsing && (
                <SourceOutageNotice
                  source={settings.connection.statisticsSource}
                />
              )}
              {children}
            </main>
          </div>
          <Toasts />
        </AppInfoContext>
      </GlobalContextProvider>
    </QueryClientProvider>
  )
}
