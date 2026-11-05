import { Settings } from '@/types/settings'
import { decode, getToken } from 'next-auth/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { recheckServerUser } from './lib/auth'
import { createNonce, getContentSecurityPolicy } from './utils/csp'
import getSettings from './utils/getSettings'
import {
  checkRequiredSettings,
  getSettingsPage,
  isInitialSetup,
  isPostUpdateMissingSettings,
} from './utils/helpers'

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
function nextWithCsp(req: NextRequest): NextResponse {
  const nonce = createNonce()
  const policy = getContentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === 'development',
  )
  const headers = new Headers(req.headers)

  headers.set('x-nonce', nonce)
  headers.set('Content-Security-Policy', policy)

  const response = NextResponse.next({ request: { headers } })

  response.headers.set('Content-Security-Policy', policy)

  return response
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
    req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.slice(0, -1)

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
    const isSettingsPage = pathname.includes('settings')
    const isAdmin = token?.isAdmin
    const isInitialSetupMode = isInitialSetup(settings)
    const isPostUpdateMode = isPostUpdateMissingSettings(settings)

    // During initial setup, allow access to settings pages for any user (including unauthenticated)
    if (isInitialSetupMode && isSettingsPage) {
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

    if (
      redirectPage &&
      pathname !== redirectPage &&
      !pathname.includes('settings')
    ) {
      return NextResponse.redirect(new URL(redirectPage, req.nextUrl))
    }
  }

  return nextWithCsp(req)
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
