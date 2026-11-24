import { authOptions } from '@/lib/auth'
import '@/styles/globals.css'
import {
  ACTIVITY_DETAILS_COOKIE_NAME,
  APP_NAME,
  getSiteUrl,
  META_DESCRIPTION,
} from '@/utils/constants'
import getSettings from '@/utils/getSettings'
import getVersion from '@/utils/getVersion'
import {
  canViewFeature,
  checkRequiredSettings,
  getFirstHeaderValue,
  getViewer,
  isRewindOnly,
  sortByActiveLibraries,
} from '@/utils/helpers'
import { toPublicSettings } from '@/utils/publicSettings'
import { REWIND_SHARE_HEADER } from '@/utils/rewindShare'
import { getReachableLibraries } from '@/utils/statsSource'
import { SerwistProvider } from '@serwist/next/react'
import { Metadata, Viewport } from 'next'
import { getServerSession } from 'next-auth'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
import { ReactNode } from 'react'
import AppProvider from './_components/AppProvider'
import GoogleAnalytics from './_components/GoogleAnalytics'
import SessionProviderWrapper from './_components/SessionProvider'

// Link previews need the full address of the image. Without a set one, it's
// the address the page was asked for.
async function getMetadataBase(): Promise<URL | null> {
  const siteUrl = getSiteUrl()

  if (siteUrl) {
    return URL.parse(siteUrl)
  }

  const requestHeaders = await headers()
  const host =
    getFirstHeaderValue(requestHeaders.get('x-forwarded-host')) ||
    requestHeaders.get('host')?.trim()
  const protocol =
    getFirstHeaderValue(
      requestHeaders.get('x-forwarded-proto'),
    )?.toLowerCase() === 'https'
      ? 'https'
      : 'http'

  return host ? URL.parse(`${protocol}://${host}`) : null
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = getSettings()
  const serverName = settings.general.serverName
  const baseTitle = serverName ? `${serverName}` : APP_NAME
  const titleTemplate = serverName ? `%s | ${serverName}` : `%s | ${APP_NAME}`

  return {
    metadataBase: await getMetadataBase(),
    applicationName: baseTitle,
    title: {
      default: baseTitle,
      template: titleTemplate,
    },
    description: META_DESCRIPTION,
    manifest: '/manifest.json',
    appleWebApp: {
      title: baseTitle,
      statusBarStyle: 'black',
    },
    openGraph: {
      type: 'website',
      siteName: baseTitle,
      title: {
        default: baseTitle,
        template: titleTemplate,
      },
      description: META_DESCRIPTION,
    },
    twitter: {
      card: 'summary_large_image',
      title: {
        default: baseTitle,
        template: titleTemplate,
      },
      description: META_DESCRIPTION,
    },
  }
}

export const viewport: Viewport = {
  themeColor: '#000000',
}

type Props = {
  children: ReactNode
}

export default async function RootLayout({ children }: Props) {
  const settings = getSettings()
  const version = await getVersion()
  const locale = await getLocale()
  const missingSetting = checkRequiredSettings(settings)
  const session = await getServerSession(authOptions)
  // Set by the proxy. Reading it also keeps every page dynamically rendered,
  // which the nonce needs: a static page would have none.
  const requestHeaders = await headers()
  const nonce = requestHeaders.get('x-nonce') ?? undefined
  // Its address is the key to a user's Rewind, which analytics would keep
  const isSharedRewind = requestHeaders.has(REWIND_SHARE_HEADER)
  const detailsCookie = (await cookies()).get(
    ACTIVITY_DETAILS_COOKIE_NAME,
  )?.value
  // For the sidebar, which lists the libraries only while the dashboard is on.
  // Not awaited, so a slow source doesn't hold up every page.
  const libraries =
    !missingSetting && canViewFeature(settings, 'dashboard', getViewer(session))
      ? getReachableLibraries().then(
          (libraries) =>
            libraries && sortByActiveLibraries(libraries, settings),
        )
      : Promise.resolve([])

  return (
    <html lang={locale}>
      <body className='h-full min-h-dvh bg-black text-white'>
        <div className='status-bar-fade' aria-hidden />
        <SerwistProvider
          swUrl='/sw.js'
          disable={process.env.NODE_ENV === 'development'}
        >
          <NextIntlClientProvider>
            {settings.general.googleAnalyticsId && !isSharedRewind && (
              <GoogleAnalytics
                id={settings.general.googleAnalyticsId}
                isSignedIn={!!session}
                nonce={nonce}
              />
            )}
            <SessionProviderWrapper session={session}>
              <AppProvider
                missingSetting={missingSetting}
                version={version}
                libraries={libraries}
                settings={toPublicSettings(settings)}
                canBrowse={!!session || settings.general.isOutsideAccess}
                isRewindOnly={isRewindOnly(settings, getViewer(session))}
                isActivityDetailsHidden={
                  detailsCookie ? detailsCookie !== 'shown' : undefined
                }
              >
                {children}
              </AppProvider>
            </SessionProviderWrapper>
          </NextIntlClientProvider>
        </SerwistProvider>
      </body>
    </html>
  )
}
