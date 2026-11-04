'use client'

import Toasts from '@/components/Toasts'
import { Version } from '@/types'
import { PublicSettings } from '@/types/settings'
import { TautulliLibrary } from '@/types/tautulli'
import { TIME_ZONE_COOKIE_NAME } from '@/utils/constants'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import clsx from 'clsx'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { ReactNode, useEffect } from 'react'
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
  libraries: Promise<TautulliLibrary[] | null>
  settings: PublicSettings
  canBrowse: boolean
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
const queryClient = new QueryClient()

function readTimeZoneCookie() {
  return document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${TIME_ZONE_COOKIE_NAME}=`))
    ?.split('=')[1]
}

export default function AppProvider({
  children,
  missingSetting,
  version,
  libraries,
  settings,
  canBrowse,
  isActivityDetailsHidden,
}: Props) {
  const pathname = usePathname()
  const router = useRouter()
  // Not during setup or before logging in, when there's nothing to browse yet
  const hasSidebar =
    !missingSetting &&
    canBrowse &&
    (pathname === '/' ||
      SIDEBAR_ROUTES.some((route) => pathname.startsWith(route)))

  // Saved on every page, so it's there by the time Rewind is opened. A Rewind
  // rendered without it, or with an old one, is rendered again once it's saved.
  useEffect(() => {
    const { timeZone } = Intl.DateTimeFormat().resolvedOptions()

    if (readTimeZoneCookie() === timeZone) {
      return
    }

    document.cookie = `${TIME_ZONE_COOKIE_NAME}=${timeZone}; path=/; max-age=31536000; samesite=lax`

    // With cookies blocked, rendering again would change nothing
    if (pathname.startsWith('/rewind') && readTimeZoneCookie() === timeZone) {
      router.refresh()
    }
  }, [pathname, router])

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
                  'justify-center':
                    (pathname === '/' && !hasSidebar) ||
                    pathname === '/~offline',
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
                    priority
                  />
                </div>
                <div className='bg-twinkling' />
                <div className='bg-clouds sm:opacity-50' />
              </div>

              {/* The sidebar, or a page's header on smaller screens, shows these controls instead */}
              <HeaderControls className='absolute top-(--page-top) right-4 z-10 max-lg:group-has-[[data-page-header]]/main:hidden lg:group-data-[sidebar]/app:hidden' />

              {hasSidebar && (
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
