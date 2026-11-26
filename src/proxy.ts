import { Settings } from '@/types/settings'
import { decode, getToken } from 'next-auth/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { recheckServerUser } from './lib/auth'
import { CALLBACK_URL_PARAM, getCallbackPath } from './utils/callbackUrl'
import { createNonce, getContentSecurityPolicy } from './utils/csp'
import getSettings from './utils/getSettings'
import {
  checkRequiredSettings,
  getFirstHeaderValue,
  getSettingsPage,
  isInitialSetup,
  isLoginRequired,
  isPostUpdateMissingSettings,
  isRewindOnly,
  isSettingsPath,
} from './utils/helpers'
import {
  canOpenRewindShare,
  isRewindShareKey,
  REWIND_SHARE_COOKIE,
  REWIND_SHARE_HEADER,
  toShareCookie,
} from './utils/rewindShare'

// The proxy runs on the Node.js runtime, so it reads the settings file
// directly instead of going through an HTTP round trip.
function readSettings(): Settings | null {
  try {
    return getSettings()
  } catch (error) {
    console.error('[PROXY] - Failed to read settings!', error)

    return null
  }
}

// Next.js reads the nonce from the request's CSP header and adds it to the
// scripts it renders, so the request and the response carry the same policy.
// The Rewind layout can't read the URL, so it's told whose shared Rewind it
// is, and never by the browser.
function nextWithCsp(req: NextRequest, sharedUserId?: string): NextResponse {
  const nonce = createNonce()
  const policy = getContentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === 'development',
  )
  const headers = new Headers(req.headers)

  headers.set('x-nonce', nonce)
  headers.set('Content-Security-Policy', policy)
  headers.delete(REWIND_SHARE_HEADER)

  if (sharedUserId) {
    headers.set(REWIND_SHARE_HEADER, sharedUserId)
  }

  const response = NextResponse.next({ request: { headers } })

  response.headers.set('Content-Security-Policy', policy)

  return response
}

// The home page has the login, which returns to the page asked for. Without
// the `_rsc` of a client-side navigation, which is Next.js' own.
function redirectToLogin(req: NextRequest): NextResponse {
  const url = new URL('/', req.nextUrl)
  const callbackUrl = req.nextUrl.clone()

  callbackUrl.searchParams.delete('_rsc')
  url.searchParams.set(
    CALLBACK_URL_PARAM,
    callbackUrl.pathname + callbackUrl.search,
  )

  return NextResponse.redirect(url)
}

// next-auth names its session cookie after the protocol of its address, which
// without NEXTAUTH_URL is the request's. Next.js only fills in a missing
// x-forwarded-proto after the proxy, from the connection.
function hasSecureCookie(req: NextRequest): boolean {
  const authUrl = process.env.NEXTAUTH_URL

  if (authUrl) {
    return authUrl.startsWith('https://')
  }

  const protocol =
    getFirstHeaderValue(req.headers.get('x-forwarded-proto'))?.toLowerCase() ||
    req.nextUrl.protocol.slice(0, -1)

  return protocol !== 'http'
}

// getToken only decodes the cookie, so the token gets the same re-check as
// getServerSession. A removed user's re-check throws, which leaves no token.
// The cookie isn't refreshed here, so the re-check remembers its results.
function getSessionToken(req: NextRequest) {
  return getToken({
    req,
    secureCookie: hasSecureCookie(req),
    decode: async (params) => {
      const token = await decode(params)

      return token && recheckServerUser(token)
    },
  })
}

// The user and key of a shared Rewind's link, when it's a valid one
function getRewindShare(
  { pathname, searchParams }: Pick<URL, 'pathname' | 'searchParams'>,
  settings: Settings | null,
) {
  const [userId, ...otherUserIds] = searchParams.getAll('userId')
  const [key, ...otherKeys] = searchParams.getAll('key')

  if (
    pathname !== '/rewind' ||
    !settings ||
    !userId ||
    !key ||
    // The page reads repeated ones as a list, which it turns away
    otherUserIds.length > 0 ||
    otherKeys.length > 0 ||
    !isRewindShareKey(settings, userId, key)
  ) {
    return null
  }

  return { userId, key }
}

// The login's address carries the shared Rewind it returns to, key and all,
// so it's kept from analytics like the Rewind itself
function getLoginShareUserId(
  req: NextRequest,
  settings: Settings | null,
): string | undefined {
  if (req.nextUrl.pathname !== '/') {
    return undefined
  }

  const callbackPath = getCallbackPath(
    req.nextUrl.searchParams.get(CALLBACK_URL_PARAM),
  )

  return getRewindShare(new URL(callbackPath, req.nextUrl), settings)?.userId
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = await getSessionToken(req)
  const settings = readSettings()
  const missingSetting = settings ? checkRequiredSettings(settings) : null

  // Tracearr's shows library was named "TV Shows", so old links still lead
  // to it
  if (
    pathname === '/dashboard/tv-shows' &&
    settings?.connection.statisticsSource === 'tracearr'
  ) {
    const url = req.nextUrl.clone()

    url.pathname = '/dashboard/shows'

    return NextResponse.redirect(url)
  }

  if (missingSetting && settings) {
    const isSettingsPage = isSettingsPath(pathname)
    const isAdmin = token?.isAdmin
    const isInitialSetupMode = isInitialSetup(settings)
    const isPostUpdateMode = isPostUpdateMissingSettings(settings)

    // During initial setup, allow access to settings pages for any user (including unauthenticated)
    if (isInitialSetupMode && isSettingsPage) {
      if (
        !settings.connection.complete &&
        pathname !== '/settings/connection'
      ) {
        return NextResponse.redirect(
          new URL('/settings/connection', req.nextUrl),
        )
      }

      return nextWithCsp(req)
    }

    // For post-update missing settings, only allow admin access
    if (isPostUpdateMode && !isAdmin) {
      if (pathname !== '/') {
        return NextResponse.redirect(new URL('/', req.nextUrl))
      }

      return nextWithCsp(req)
    }

    // Handle redirects for missing settings
    let redirectPage = getSettingsPage(missingSetting)

    if (missingSetting.startsWith('connection')) {
      redirectPage = getSettingsPage('connection')
    }

    if (redirectPage && pathname !== redirectPage && !isSettingsPage) {
      return NextResponse.redirect(new URL(redirectPage, req.nextUrl))
    }

    if (
      !settings.connection.complete &&
      isSettingsPage &&
      pathname !== '/settings/connection'
    ) {
      return NextResponse.redirect(new URL('/settings/connection', req.nextUrl))
    }
  }

  const share = getRewindShare(req.nextUrl, settings)
  // A shared Rewind opens without signing in, unless its links ask for it
  const rewindShare =
    share && settings && canOpenRewindShare(settings, !!token) ? share : null

  // The login returns to the link, key and all
  if (
    !token &&
    !rewindShare &&
    req.method === 'GET' &&
    settings &&
    (share || isLoginRequired(settings, pathname))
  ) {
    return redirectToLogin(req)
  }

  // The music the shared Rewind plays checks it too
  if (rewindShare) {
    const response = nextWithCsp(req, rewindShare.userId)

    response.cookies.set(
      REWIND_SHARE_COOKIE,
      toShareCookie(rewindShare.userId, rewindShare.key),
      {
        httpOnly: true,
        sameSite: 'lax',
        secure: hasSecureCookie(req),
        path: '/api/rewind',
      },
    )

    return response
  }

  // Here rather than in the home page, so its loading state doesn't show first
  if (
    pathname === '/' &&
    token &&
    req.method === 'GET' &&
    settings &&
    !missingSetting &&
    isRewindOnly(settings, { isLoggedIn: true, isAdmin: !!token.isAdmin })
  ) {
    return NextResponse.redirect(new URL('/rewind', req.nextUrl))
  }

  return nextWithCsp(req, getLoginShareUserId(req, settings))
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - files with an extension (sw.js, manifest.json, images, ...)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)',
  ],
}
